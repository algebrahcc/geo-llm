/**
 * 渡河工程计算引擎
 *
 * 基于工程教范近似公式，由输入表单与资源规格计算各渡河方式的可行性、耗时与运力。
 * 公式为简化近似，用于前端模拟；后续可迁移到后端统一计算 API。
 */
import { crossingResourceSpecs } from '@/mock/river';
import type {
  CrossingPlanCard,
  CrossingResourceSpec,
  CrossingSettingForm,
  RejectedRouteData,
  RiverPlanKey
} from '@/views/river/modules/types';

/** 兵力规模 → 估算装备编成 */
const FORCE_SCALES: Record<string, { label: string; personnel: number; armored: number; wheeled: number }> = {
  '1个连': { label: '连', personnel: 120, armored: 4, wheeled: 10 },
  '1个营': { label: '营', personnel: 400, armored: 15, wheeled: 40 },
  '1个合成营': { label: '合成营', personnel: 550, armored: 25, wheeled: 60 },
  '1个团': { label: '团', personnel: 1800, armored: 60, wheeled: 180 }
};

const DEFAULT_FORCE = FORCE_SCALES['1个合成营'];

function getForce(form: CrossingSettingForm) {
  return FORCE_SCALES[form.forceScale] ?? DEFAULT_FORCE;
}

/** 从资源属性中按标签关键字取值，取不到返回 fallback */
function attr(spec: CrossingResourceSpec, labelContains: string, fallback = 0): number {
  const a = spec.attrs.find(x => x.label.includes(labelContains));
  if (!a) return fallback;
  return Number.parseFloat(a.value.replace(/[^\d.]/g, '')) || fallback;
}

interface CrossingMethodInput {
  name: string;
  spec: CrossingResourceSpec;
  form: CrossingSettingForm;
}

interface MethodResult {
  name: string;
  key: RiverPlanKey;
  feasible: boolean;
  reason?: string;
  durationMin: number;
  capacityPerHour: number;
  safety: '优' | '良' | '中' | '差';
  score: number;
  /** 计算过程摘要（用于方案卡片 scenario 字段） */
  calculation: string[];
}

/**
 * 计算所有已选资源的渡河可行性与耗时
 *
 * - 无人机只用于侦察辅助，不参与渡河运力计算
 * - 每种渡河方式的耗时独立计算，最终按评分排序
 */
export function calculateCrossingPlans(form: CrossingSettingForm): {
  plans: CrossingPlanCard[];
  rejected: RejectedRouteData[];
  knowledgeHits: number;
  dataCompleteness: number;
} {
  const resources = (form.availableResources ?? [])
    .map(name => crossingResourceSpecs[name])
    .filter(Boolean) as CrossingResourceSpec[];
  if (resources.length === 0) {
    return { plans: [], rejected: [], knowledgeHits: 0, dataCompleteness: 0 };
  }

  const force = getForce(form);
  const riverWidth = form.riverWidth || 400;
  const flowMax = extractMaxFromRange(form.flowVelocity) || 2;
  const depthMax = extractMaxFromRange(form.waterDepthRange) || 5;
  const visibility = form.visibilityKm || 10;
  const timeLimitMin = parseTimeConstraintMin(form.timeConstraint);

  const results: MethodResult[] = [];
  const rejectedMethods: MethodResult[] = [];

  for (const spec of resources) {
    if (spec.name === '无人机') continue; // 侦察辅助，不直接渡河

    const input: CrossingMethodInput = { name: spec.name, spec, form };
    const r = evaluateMethod(input, riverWidth, flowMax, depthMax, visibility, force);
    if (r.feasible) {
      results.push(r);
    } else {
      rejectedMethods.push(r);
    }
  }

  // ── 评分排序 ──
  results.sort((a, b) => b.score - a.score);

  const plans: CrossingPlanCard[] = results.slice(0, 3).map((r, idx) => {
    const key: RiverPlanKey = idx === 0 ? 'plan-a' : idx === 1 ? 'plan-b' : 'plan-c';
    const stars =
      r.safety === '优' && r.durationMin < timeLimitMin
        ? 5
        : r.safety === '优' || (r.safety === '良' && r.durationMin < timeLimitMin)
          ? 4
          : r.safety === '良'
            ? 3
            : 2;
    return buildPlanCard(r, idx + 1, key, stars, force);
  });

  // ── 生成淘汰方式的路线数据 ──
  const rejected: RejectedRouteData[] = rejectedMethods.map((r, idx) => buildRejectedRouteData(r, idx));

  // 数据完整度
  const filled = [
    form.taskName,
    form.location,
    form.taskType,
    form.actionTime,
    form.forceScale,
    form.riverWidth > 0 ? 'y' : '',
    form.waterDepthRange,
    form.flowVelocity,
    form.riverbedTerrain,
    form.weatherCondition,
    form.visibilityKm > 0 ? 'y' : '',
    form.timeConstraint,
    form.availableResources.length > 0 ? 'y' : ''
  ].filter(Boolean).length;
  const dataCompleteness = Math.round((filled / 13) * 100);

  return {
    plans,
    rejected,
    knowledgeHits: estimateKnowledgeHits(form),
    dataCompleteness
  };
}

/** 计算单个渡河方式的耗时、运力与可行性 */
function evaluateMethod(
  { name, spec }: CrossingMethodInput,
  riverWidth: number,
  flowMax: number,
  depthMax: number,
  visibility: number,
  force: { personnel: number; armored: number; wheeled: number }
): MethodResult {
  const flowLimit = attr(spec, '流速', attr(spec, '浪高', 99) === 99 ? 99 : 2);
  const depthLimit = attr(spec, '吃水', attr(spec, '涉水', 99));
  const widthLimit = attr(spec, '架设长度', attr(spec, '桥体跨长', 0)) || attr(spec, '桥体跨长', 0);
  const slopeLimit = attr(spec, '岸坡', 10); // 默认 10°
  const loadCapacity = attr(spec, '载重', attr(spec, '载员', 0));
  const speedKmH = attr(spec, '航速', attr(spec, '涉水', 0));
  const buildTime = attr(spec, '架设时间', 0);

  const calc: string[] = [];
  const reasons: string[] = [];

  // 约束校验
  if (flowMax > flowLimit) {
    reasons.push(`流速 ${flowMax} m/s 超出适应上限 ${flowLimit} m/s`);
    calc.push(`流速校验：${flowMax} > ${flowLimit} m/s ✗`);
  } else {
    calc.push(`流速校验：${flowMax} ≤ ${flowLimit} m/s ✓`);
  }

  // 浮桥/架桥类：河道宽度约束
  const isBridgeType = name === '浮桥' || name === '架桥坦克';
  if (isBridgeType && widthLimit > 0 && riverWidth > widthLimit) {
    reasons.push(`河宽 ${riverWidth}m 超出单套器材最大架设长度 ${widthLimit}m`);
    calc.push(`河宽校验：${riverWidth}m > ${widthLimit}m ✗`);
  }

  if (depthLimit < 99 && depthMax > depthLimit) {
    reasons.push(`最大水深 ${depthMax}m 超出器材吃水/涉水限制 ${depthLimit}m`);
    calc.push(`水深校验：${depthMax}m > ${depthLimit}m ✗`);
  }

  if (visibility < 3 && name !== '架桥坦克') {
    reasons.push(`能见度 ${visibility}km 低于最低作业要求 3km`);
    calc.push(`能见度校验：${visibility}km < 3km ✗`);
  }

  // ── 耗时计算 ──
  let durationMin = 0;
  let capacityPerHour = 0;

  if (name === '浮桥') {
    const sectionLen = attr(spec, '单节长度', 6.75);
    const sections = Math.ceil(riverWidth / sectionLen);
    const setupTime = buildTime * (1 + sections * 0.02);
    calc.push(`浮桥节数：${riverWidth}m ÷ ${sectionLen}m = ${sections} 节`);
    calc.push(`架设耗时：约 ${setupTime.toFixed(0)} min`);
    capacityPerHour = loadCapacity > 0 ? Math.floor(3600 / 180) : 0; // 约 3min/辆
    const throughput = capacityPerHour * 40; // 40t/辆
    const totalTons = force.armored * 45 + force.wheeled * 20 + force.personnel * 0.1;
    const crossMin = Math.ceil(totalTons / (throughput / 60));
    durationMin = setupTime + crossMin + 15; // 15min 编队缓冲
    calc.push(`通行能力：约 ${capacityPerHour} 辆/h`);
    calc.push(`总装备 ${totalTons.toFixed(0)}t 过河：约 ${crossMin} min`);
  } else if (name === '架桥坦克') {
    const span = attr(spec, '桥体跨长', 22);
    const setupTime = buildTime || 5;
    const capacity = attr(spec, '通载等级', 60);
    calc.push(`桥体跨长：${span}m，架设：约 ${setupTime} min`);
    calc.push(`通载能力：${capacity}t 级`);
    // 架桥坦克主要用于短距冲击桥，长河道无法独立覆盖
    if (riverWidth <= span) {
      capacityPerHour = Math.floor(3600 / 90); // 约 1.5min/辆
      const totalVehicles = force.armored + force.wheeled;
      const crossMin = Math.ceil(totalVehicles / capacityPerHour) * 60;
      durationMin = setupTime + crossMin / 60;
    } else {
      reasons.push(`河宽 ${riverWidth}m 远超桥体跨长 ${span}m，需配合其他渡河方式`);
      calc.push(`河宽 ${riverWidth}m 远超 ${span}m 跨长 ✗`);
    }
  } else {
    // 舟艇类：按批次计算
    const speedMs = (speedKmH * 1000) / 3600;
    const crossingTimeOneWay = riverWidth / (speedMs || 3);
    const roundTrip = crossingTimeOneWay * 2.2; // 含装卸、回程
    calc.push(`单程：${riverWidth}m ÷ ${speedKmH}km/h = ${(crossingTimeOneWay / 60).toFixed(1)} min`);
    calc.push(`往返（含装卸）：约 ${(roundTrip / 60).toFixed(1)} min`);

    const count = spec.count;
    let perTrip = 0;
    if (name === '登陆艇') {
      perTrip = count * 2; // 2 辆装甲/轮式
    } else if (name === '冲锋舟') {
      perTrip = count * Math.floor(loadCapacity || 10); // 人员
    } else if (name === '两栖坦克') {
      perTrip = count; // 1:1
    }

    let totalBatches = 0;
    if (name === '登陆艇') {
      const vehicles = force.armored + force.wheeled;
      totalBatches = Math.ceil(vehicles / perTrip);
      calc.push(`总车辆 ${vehicles}，单批 ${perTrip} 辆，需 ${totalBatches} 批`);
    } else if (name === '冲锋舟') {
      totalBatches = Math.ceil(force.personnel / perTrip);
      calc.push(`总人员 ${force.personnel}，单批 ${perTrip} 人，需 ${totalBatches} 批`);
    } else if (name === '两栖坦克') {
      totalBatches = Math.ceil(force.armored / perTrip);
      calc.push(`装甲车辆 ${force.armored}，单批 ${perTrip} 辆，需 ${totalBatches} 批`);
    }

    const parallel = Math.min(count, 4); // 并行批次
    durationMin = Math.ceil(totalBatches / parallel) * (roundTrip / 60) + 10;
    capacityPerHour = Math.floor(3600 / (roundTrip / parallel)) * perTrip;
  }

  if (reasons.length > 0) {
    return {
      name,
      key: 'plan-a',
      feasible: false,
      reason: reasons.join('；'),
      durationMin: 0,
      capacityPerHour: 0,
      safety: '差',
      score: 0,
      calculation: calc
    };
  }

  // 安全评级
  const safetyRatio = flowMax / flowLimit;
  const safety: MethodResult['safety'] =
    safetyRatio < 0.5 ? '优' : safetyRatio < 0.75 ? '良' : safetyRatio < 0.95 ? '中' : '差';

  // 综合评分（0~100）
  let score = 60;
  if (safety === '优') score += 25;
  else if (safety === '良') score += 15;
  else if (safety === '中') score += 5;
  if (durationMin < 120) score += 10;
  if (durationMin < 180) score += 5;
  if (visibility > 5) score += 3;
  if (slopeLimit >= 8) score += 2;

  return { name, key: 'plan-a', feasible: true, durationMin, capacityPerHour, safety, score, calculation: calc };
}

/** 淘汰方式专用配色（与可行方案色系区分，偏灰红） */
const REJECTED_COLORS = ['#fb7185', '#f97316', '#a855f7'];

/**
 * 淡水河段河道中心线（与主渡河通道 mock 坐标一致，保证渡场点落在河面上）。
 * 河道整体呈东北走向，相邻点间距约 500m。
 */
const RIVER_CENTERLINE: Array<[number, number]> = [
  [121.465, 25.085],
  [121.467, 25.09],
  [121.469, 25.095],
  [121.47, 25.1],
  [121.473, 25.105],
  [121.476, 25.11],
  [121.478, 25.115],
  [121.482, 25.122],
  [121.485, 25.13]
];

/** 垂直于河道走向的两岸偏移向量（河道走向约 (0.02, 0.045)，归一化后旋转 90°） */
const CROSS_OFFSET: [number, number] = [0.0055, -0.0024];

/**
 * 为淘汰方式生成路线数据：渡场锚点取河道中心线上不同位置（沿河段错开），
 * 路线为垂直横跨河道的"南岸机动 → 渡场 → 北岸机动"短线，与真实渡河工程表达一致。
 */
function buildRejectedRouteData(r: MethodResult, idx: number): RejectedRouteData {
  const anchorIdx = Math.min(2 + idx * 2, RIVER_CENTERLINE.length - 2);
  const [alon, alat] = RIVER_CENTERLINE[anchorIdx];
  const anchor: [number, number] = [alon, alat];
  const south: [number, number] = [alon + CROSS_OFFSET[0], alat + CROSS_OFFSET[1]];
  const north: [number, number] = [alon - CROSS_OFFSET[0], alat - CROSS_OFFSET[1]];
  const southExt: [number, number] = [alon + CROSS_OFFSET[0] * 1.8, alat + CROSS_OFFSET[1] * 1.8];
  const northExt: [number, number] = [alon - CROSS_OFFSET[0] * 1.8, alat - CROSS_OFFSET[1] * 1.8];

  return {
    id: `rejected-${idx}`,
    name: r.name,
    icon: crossingResourceSpecs[r.name]?.icon ?? '⛔',
    reason: r.reason ?? '条件不满足',
    detail: r.calculation,
    color: REJECTED_COLORS[idx % REJECTED_COLORS.length],
    positions: [southExt, south, anchor, north, northExt],
    mark: { longitude: alon, latitude: alat }
  };
}

function buildPlanCard(
  r: MethodResult,
  rank: number,
  key: RiverPlanKey,
  stars: number,
  _force: { personnel: number; armored: number; wheeled: number }
): CrossingPlanCard {
  const hours = Math.floor(r.durationMin / 60);
  const mins = r.durationMin % 60;
  const duration = hours > 0 ? `约${hours}h${mins}min` : `约${mins}min`;
  const throughput = r.capacityPerHour > 0 ? `${r.capacityPerHour} 单位/h` : '—';

  return {
    rank,
    key,
    label: `方案${['一', '二', '三'][rank - 1]}`,
    title: `${r.name}${r.name === '浮桥' ? '分段渡河方案' : r.name === '登陆艇' ? '门桥渡河方案' : r.name === '冲锋舟' ? '突击渡河方案' : '快速渡河方案'}`,
    isRecommended: rank === 1 && stars >= 4,
    stars,
    duration,
    capacity: throughput,
    safety: r.safety,
    scenario: r.calculation.slice(0, 3).join('；'),
    routeDesc: `采用${r.name}为主渡河方式，预计总耗时 ${duration}`,
    keyEquipment: [`${r.name}×${crossingResourceSpecs[r.name]?.count ?? 1}`, '工兵作业车×2', '无人机×2'],
    advantages: buildAdvantages(r),
    risks: buildRisks(r),
    conditions: buildConditions(r)
  };
}

function buildAdvantages(r: MethodResult): string[] {
  const list: string[] = [];
  if (r.safety === '优' || r.safety === '良') list.push(`安全等级${r.safety}，水文余量充足`);
  if (r.durationMin < 120) list.push('总耗时短，符合快速渡河要求');
  if (r.name === '浮桥') list.push('通载能力强，适合重装部队');
  if (r.name === '登陆艇') list.push('单次运力大，适合车辆集中渡河');
  if (r.name === '冲锋舟') list.push('机动灵活，部署快');
  if (r.name === '两栖坦克') list.push('自渡能力强，无需外部保障');
  if (list.length === 0) list.push('满足基本渡河要求');
  return list.slice(0, 3);
}

function buildRisks(r: MethodResult): string[] {
  const list: string[] = [];
  if (r.safety === '中' || r.safety === '差') list.push(`当前水文条件下安全余量偏低（${r.safety}）`);
  if (r.durationMin > 180) list.push('总耗时较长，需预留充足时间窗口');
  if (r.name === '浮桥') list.push('架设期间桥位暴露，需组织掩护');
  if (r.name === '登陆艇') list.push('高流速下操纵难度增大');
  if (r.name === '冲锋舟') list.push('单次运力有限，重装备无法渡河');
  if (r.name === '两栖坦克') list.push('涉水期间机动能力受限');
  if (list.length === 0) list.push('需持续监测水文变化');
  return list.slice(0, 2);
}

function buildConditions(r: MethodResult): string[] {
  const spec = crossingResourceSpecs[r.name];
  if (!spec) return ['水文条件良好'];
  const list: string[] = [];
  const flowLimit = attr(spec, '流速', 0);
  if (flowLimit) list.push(`流速 ≤ ${flowLimit} m/s`);
  const depthLimit = attr(spec, '吃水', attr(spec, '涉水', 0));
  if (depthLimit && depthLimit < 99) list.push(`水深 ≤ ${depthLimit} m`);
  list.push('能见度 ≥ 3 km');
  return list.slice(0, 3);
}

/** 根据关键词估计知识库命中条数（用于模拟检索反馈） */
function estimateKnowledgeHits(form: CrossingSettingForm): number {
  const tokens = [
    form.taskType,
    form.riverbedTerrain,
    form.flowVelocity,
    form.waterDepthRange,
    ...form.availableResources
  ].filter(Boolean);
  return Math.min(tokens.length * 3 + 5, 38);
}

/** 从 "3~7m" / "1.0~2.0 m/s" 提取最大值 */
function extractMaxFromRange(s: string): number {
  if (!s) return 0;
  const m = s.match(/(\d+(?:\.\d+)?)\s*(?:~|–|-)\s*(\d+(?:\.\d+)?)/);
  return m ? Number.parseFloat(m[2]) : 0;
}

/** 从 "3小时内完成渡河" 提取分钟数 */
function parseTimeConstraintMin(s: string): number {
  if (!s) return 240;
  const hm = s.match(/(\d+)\s*h/);
  if (hm) return Number.parseInt(hm[1]) * 60;
  const m = s.match(/(\d+)\s*小时/);
  if (m) return Number.parseInt(m[1]) * 60;
  const min = s.match(/(\d+)\s*分/);
  if (min) return Number.parseInt(min[1]);
  return 240;
}

/** 根据数据完整度、检索命中、方案质量计算置信度 */
export function calculateConfidence(dataCompleteness: number, knowledgeHits: number, bestScore: number): number {
  const dataPart = Math.min(dataCompleteness, 100) * 0.25;
  const knowledgePart = Math.min(knowledgeHits / 20, 1) * 30;
  const qualityPart = Math.min(bestScore, 100) * 0.45;
  return Math.round(dataPart + knowledgePart + qualityPart);
}
