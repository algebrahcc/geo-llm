/**
 * 机动路线规划助手 — 事件推演引擎（纯逻辑，不依赖任何 UI）
 *
 * 设计意图（deep module，精简版）：只保留一个核心闭环——
 *   用户说明一个事件（如"成功桥断裂"） → 识别事件点与受影响路线
 *   → 地图标绘 → 输入"重新规划路线" → 排除受影响路线后重新生成。
 *
 * 对外入口：
 *   - `activeEvents`：已记录事件（响应式，供界面展示）
 *   - `excludedRoutes`：累计需排除的路线（响应式，供父页面过滤方案/隐藏路线）
 *   - `answer(question)`：输入一句话，产出回答 + 意图 + 排除清单 + 可选标绘点
 *
 * 不设复杂的方案影响矩阵与评分：受影响路线直接排除，剩余路线按默认优先级
 * （路线一 → 路线二 → 路线三）取推荐。
 */
import { ref } from 'vue';
import { planningRouteTraffic } from '@/mock/planning';
import type { PlanningRouteKey } from './types';

/** 推演上下文：由调用方按需提供最新任务要素 */
export interface RouteSituationContext {
  startName: string;
  endName: string;
  /** 已本地化的路线偏好，如"时间最优" */
  routePreference: string;
  /** 已本地化的编队规模，如"中型编队" */
  forceScale: string;
}

/** 地图标绘点（事件注入或点名标绘时产出） */
export interface RouteSituationPlot {
  id: string;
  lon: number;
  lat: number;
  label: string;
  color: string;
}

/** 单轮问答的产出 */
export interface RouteOfflineAnswer {
  answer: string;
  isGenerate: boolean;
  /** 本次新增需排除的路线（父页面据此过滤方案卡片并在地图上隐藏） */
  excluded?: PlanningRouteKey[];
  /** 地图标绘点 */
  plot?: RouteSituationPlot;
}

// ══════════════════ 地名词典（精简：事件点 → 经纬度 + 经过的路线） ══════════════════

interface GazetteerEntry {
  /** 别名按长度降序匹配，避免"洲美快速"抢先匹配"洲美快速道路"等长词 */
  aliases: string[];
  lon: number;
  lat: number;
  label: string;
  /** 经过该地物的候选路线（事件发生时这些路线将被排除） */
  routes: PlanningRouteKey[];
}

/**
 * 锚点取自 OSRM 真实路网折线（planning-route-coords.ts）上的实际路径点，
 * 统一精确到小数点后 4 位（约 11m 精度），保证地图标绘落点与路线一致。
 */
const GAZETTEER: GazetteerEntry[] = [
  // 成功桥/成美桥同为成功路跨基隆河的桥，锚点取 OSRM 折线在河面上的跨河点（121.5910, 25.0619）
  { aliases: ['成功桥', '成功路'], lon: 121.591, lat: 25.0619, label: '成功桥', routes: ['route-a'] },
  { aliases: ['成美桥', '成美大桥'], lon: 121.591, lat: 25.0619, label: '成美桥', routes: ['route-a'] },
  {
    aliases: ['洲美快速道路', '洲美快速', '洲美高架', '洲美大桥'],
    lon: 121.488,
    lat: 25.1217,
    label: '洲美快速道路',
    routes: ['route-a']
  },
  { aliases: ['剑南路', '剑南隧道'], lon: 121.559, lat: 25.101, label: '剑南路', routes: ['route-a'] },
  {
    aliases: ['台2乙', '台二乙', '淡金公路'],
    lon: 121.448,
    lat: 25.1666,
    label: '台2乙（淡金公路）',
    routes: ['route-a', 'route-b', 'route-c']
  },
  { aliases: ['大度路'], lon: 121.4444, lat: 25.1695, label: '大度路', routes: ['route-a', 'route-b', 'route-c'] }
];

/** 事件关键词：命中即视为在该位置发生阻断/拥堵类事件（含口语化单字变体，支持部分匹配） */
const EVENT_KEYWORDS = [
  '断裂',
  '损毁',
  '被炸',
  '坍塌',
  '断了',
  '断开',
  '中断',
  '封闭',
  '禁行',
  '塌方',
  '积水',
  '管制',
  '封锁',
  '拥堵',
  '堵车',
  '塞车',
  '缓行',
  '炸了',
  '塌了',
  '堵了',
  '毁了'
];

/** 重新规划指令 */
const GENERATE_INTENT = /(重新|再次|拟制|重排|制定|给出|输出|生成).{0,6}(路线|方案|规划|计划)/;

const ROUTE_ORDER: PlanningRouteKey[] = ['route-a', 'route-b', 'route-c'];

const ROUTE_LABEL: Record<PlanningRouteKey, string> = {
  'route-a': '路线一 快速通达',
  'route-b': '路线二 均衡通行',
  'route-c': '路线三 低风险绕行'
};

// ══════════════════ 位置解析 ══════════════════

/** 中国大陆/台湾常用经纬度范围（用于消除"经度,纬度"与"纬度,经度"歧义） */
const LON_RANGE: [number, number] = [73, 136];
const LAT_RANGE: [number, number] = [3, 54];

function isLon(v: number) {
  return v >= LON_RANGE[0] && v <= LON_RANGE[1];
}

function isLat(v: number) {
  return v >= LAT_RANGE[0] && v <= LAT_RANGE[1];
}

/**
 * 从自然语言中解析经纬度。支持的写法：
 * - "121.48, 25.13" / "121.48，25.13"（经度在前；若顺序相反会自动交换）
 * - "经度121.48 纬度25.13" / "北纬25.129 东经121.484" / "lon:121.48 lat:25.13"
 */
export function extractCoordinates(question: string): { lon: number; lat: number } | null {
  const normalized = question
    .replace(/东经|经度|lng|lon|longitude/gi, 'LON')
    .replace(/北纬|纬度|lat|latitude/gi, 'LAT');

  // 带标签写法：LON 121.48 ... LAT 25.13（或相反顺序）
  const labeled =
    /LAT[:：]?\s*(\d{1,2}(?:\.\d+)?)[^\d-]*?LON[:：]?\s*(\d{1,3}(?:\.\d+)?)|LON[:：]?\s*(\d{1,3}(?:\.\d+)?)[^\d-]*?LAT[:：]?\s*(\d{1,2}(?:\.\d+)?)/i.exec(
      normalized
    );
  if (labeled) {
    const lat = Number(labeled[1] ?? labeled[4]);
    const lon = Number(labeled[2] ?? labeled[3]);
    if (isLon(lon) && isLat(lat)) return { lon, lat };
  }

  // 裸数字对："121.48, 25.13" 或 "25.13, 121.48"。
  // 经度范围(73~136)与纬度范围(3~54)无交集，按范围归属即可无歧义区分顺序。
  const pair = /(\d{1,3}(?:\.\d+)?)\s*[,，、;；]\s*(\d{1,3}(?:\.\d+)?)/.exec(question);
  if (pair) {
    const a = Number(pair[1]);
    const b = Number(pair[2]);
    if (isLon(a) && isLat(b)) return { lon: a, lat: b };
    if (isLat(a) && isLon(b)) return { lon: b, lat: a };
  }

  return null;
}

/** 提问中解析出的位置（显式经纬度或地名词典） */
export interface ResolvedPlace {
  lon: number;
  lat: number;
  /** 展示名：显式经纬度时为"指定位置"，地名为地物名 */
  label: string;
  /** 该位置涉及（会被排除）的路线 */
  routes: PlanningRouteKey[];
}

/**
 * 解析提问中的位置：显式经纬度优先；其次匹配地名词典
 * （按别名长度降序，防止"洲美快速"抢先匹配"洲美快速道路"等长词）。
 */
function resolvePlace(question: string): ResolvedPlace | null {
  const coords = extractCoordinates(question);
  if (coords) return { lon: coords.lon, lat: coords.lat, label: '指定位置', routes: [] };
  const byLength = GAZETTEER.flatMap(e => e.aliases.map(alias => ({ alias, entry: e }))).sort(
    (x, y) => y.alias.length - x.alias.length
  );
  for (const { alias, entry } of byLength) {
    if (question.includes(alias)) {
      return { lon: entry.lon, lat: entry.lat, label: entry.label, routes: entry.routes };
    }
  }
  return null;
}

// ══════════════════ 精简问答库 ══════════════════

interface OfflineQA {
  keywords: string[];
  answer: (ctx: RouteSituationContext) => string;
}

const OFFLINE_QA: OfflineQA[] = [
  {
    keywords: ['推荐', '理由', '为什么'],
    answer: () =>
      `按当前"时间最优"的要求，推荐路线一：全程 27.4 公里，预计 33 分钟，三条里最快。\n\n主要走成功路、成美桥过基隆河，上堤顶大道接洲美快速道路，出城后基本没有信号瓶颈。路线二稳妥但要多花 14 分钟；路线三风险最低，可要花上 60 分钟。没有特殊情况，建议走路线一。`
  },
  {
    keywords: ['路线一', '快速通达'],
    answer: () =>
      `路线一，快速通达：27.4 公里，预计 33 分钟。\n\n从南港装载地域出发，经成功路、成美桥过基隆河，上堤顶大道转剑南路，接洲美快速道路，过大度路后沿台2乙到淡水沙崙。\n\n两个注意点：南港出发段红灯较密，建议梯次出发；洲美快速早晚高峰容易排队，要预留时间。`
  },
  {
    keywords: ['路线二', '均衡通行'],
    answer: () =>
      `路线二，均衡通行：31.8 公里，预计 47 分钟。\n\n经基隆路、民权东路、承德路向西，过大度路后汇入台2乙。比路线一多 14 分钟，但绕开了剑南路隧道，沿线路况平稳，适合常规编组，也可作路线一的备用。`
  },
  {
    keywords: ['路线三', '低风险', '绕行'],
    answer: () =>
      `路线三，低风险绕行：35.3 公里，预计 60 分钟。\n\n全程走外围：研究院路、内湖堤顶、大直、北投外围接台2乙。不穿隧道、暴露小，但里程最长、最耗时，一般作备份路线，或重装梯队稳妥机动时使用。`
  },
  {
    keywords: ['交通', '路况', '通行情况', '通行状况'],
    answer: () => {
      const row = (key: PlanningRouteKey) => {
        const t = planningRouteTraffic[key];
        const label = key === 'route-a' ? '路线一' : key === 'route-b' ? '路线二' : '路线三';
        return `${label}：${t.level}，均速 ${t.avgSpeed}${t.delayMin > 0 ? `，预计延误 ${t.delayMin} 分钟` : '，无延误'}`;
      };
      return `目前三条路线整体可控。

${row('route-a')}，瓶颈在洲美快速段，高峰期有排队；
${row('route-b')}，主要是路口等待；
${row('route-c')}，但绕行里程长。

出发前建议再核实一次洲美快速段的实时路况。`;
    }
  }
];

/**
 * 创建事件推演引擎。
 * @param getCtx 每次问答时调用，返回当前任务要素（保证读到最新的表单值）
 */
export function createRouteSituationEngine(getCtx: () => RouteSituationContext) {
  /** 已记录事件（持续影响后续问答与路线排除） */
  const activeEvents = ref<Array<{ place: string; routes: PlanningRouteKey[] }>>([]);
  /** 累计需排除的路线 */
  const excludedRoutes = ref<PlanningRouteKey[]>([]);

  const remainingRoutes = () => ROUTE_ORDER.filter(r => !excludedRoutes.value.includes(r));

  /** 剩余路线中按默认优先级取综合推荐（路线一 → 路线二 → 路线三） */
  function recommendedRoute(): PlanningRouteKey {
    return remainingRoutes()[0] ?? 'route-a';
  }

  /** 输入一句话，产出回答与意图 */
  function answer(question: string): RouteOfflineAnswer {
    const ctx = getCtx();
    const place = resolvePlace(question);
    const eventWord = EVENT_KEYWORDS.find(k => question.includes(k)) ?? null;

    // ① 重新规划指令：按当前事件排除的路线重新推荐
    if (GENERATE_INTENT.test(question)) {
      const remaining = remainingRoutes();
      const recommended = recommendedRoute();
      const excludedText = excludedRoutes.value.length
        ? `受${activeEvents.value.map(e => e.place).join('、')}情况影响，${excludedRoutes.value.map(r => ROUTE_LABEL[r]).join('、')}已不纳入考虑；`
        : '当前没有需要避开的情况，三条路线均可通行；';
      return {
        isGenerate: true,
        answer: `已重新规划。${excludedText}剩余路线中，${ROUTE_LABEL[recommended]}条件最好，建议作为主用路线；${
          remaining.length > 1
            ? `其余（${remaining
                .filter(r => r !== recommended)
                .map(r => ROUTE_LABEL[r])
                .join('、')}）留作备份。`
            : ''
        }\n\n方案面板与地图已同步更新。`
      };
    }

    // ② 事件注入：点名地物 + 事件词 → 排除该地物涉及的路线并标绘
    if (place && eventWord) {
      const newly = place.routes.filter(r => !excludedRoutes.value.includes(r));
      if (newly.length) {
        excludedRoutes.value = [...excludedRoutes.value, ...newly];
        activeEvents.value.push({ place: place.label, routes: newly });
      }
      const remaining = remainingRoutes();
      let eventAnswer: string;
      if (newly.length) {
        eventAnswer = `收到。${place.label}发生${eventWord}，位置已标到图上。\n\n该处位于${newly.map(r => ROUTE_LABEL[r]).join('、')}的实际经过段，这部分路线暂时走不了。剩余可选：${remaining.length ? remaining.map(r => ROUTE_LABEL[r]).join('、') : '无'}。需要重新排方案时，输入"重新规划路线"。`;
      } else if (place.routes.length === 0) {
        eventAnswer = `收到，${place.label}的情况已标到图上（${place.lon.toFixed(4)}, ${place.lat.toFixed(4)}）。\n\n这个位置不在候选路线的关键节点上，暂不影响现有方案。`;
      } else {
        eventAnswer = `${place.label}的情况此前已记录，相关路线已在排除之列。当前可选：${remaining.length ? remaining.map(r => ROUTE_LABEL[r]).join('、') : '无'}，输入"重新规划路线"即可重新生成。`;
      }
      return {
        isGenerate: false,
        excluded: newly,
        plot: {
          id: `event-${place.label}`,
          lon: place.lon,
          lat: place.lat,
          label: `${place.label}·${eventWord}`,
          color: '#f87171'
        },
        answer: eventAnswer
      };
    }

    // ③ 纯标绘意图：点名地物或附经纬度并要求标注（不排除路线）
    if (place && /标绘|标注|标记|标出|标一下/.test(question)) {
      return {
        isGenerate: false,
        answer: `已在地图上标出${place.label}的位置（${place.lon.toFixed(4)}, ${place.lat.toFixed(4)}）。\n\n如果该处发生了影响通行的情况，直接说明即可（例如"${place.label}断裂"），我会把经过它的路线排除掉。`,
        plot: { id: 'route-manual-plot', lon: place.lon, lat: place.lat, label: place.label, color: '#5ea4ff' }
      };
    }

    // ④ 静态问答（路线/交通等）
    for (const qa of OFFLINE_QA) {
      if (qa.keywords.some(k => question.includes(k))) {
        const prefix =
          excludedRoutes.value.length > 0
            ? `提醒：受此前事件影响，${excludedRoutes.value.map(r => ROUTE_LABEL[r]).join('、')}已不纳入考虑。\n\n`
            : '';
        return { answer: prefix + qa.answer(ctx), isGenerate: false };
      }
    }

    // ⑤ 兜底引导
    return {
      isGenerate: false,
      answer: `我负责本次机动的路线规划。可以直接问路况、各条路线的情况；\n\n遇到突发情况——桥断了、道路中断、严重拥堵——把地点和情况告诉我，我会在图上标出来，重新规划时避开受影响的路线。方案需要重排时，输入"重新规划路线"。`
    };
  }

  return { activeEvents, excludedRoutes, recommendedRoute, answer };
}
