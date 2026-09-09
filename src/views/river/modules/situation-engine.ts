/**
 * 渡河方案助手 — 离线推演引擎（纯逻辑，不依赖任何 UI）
 *
 * 设计意图（deep module）：对外只暴露 3 个入口——
 *   - `activeSituations`：已激活态势（响应式，供界面展示）
 *   - `recommendedPlan()`：当前综合推荐方案
 *   - `answer(question)`：输入一句话，产出回答 + 意图 + 推荐结论
 *
 * 规则库、加权评分、关键词匹配、意图识别、文案模板全部隐藏在模块内部，
 * 因此无需挂载 Vue 组件、无需 Cesium、无需网络即可直接单测。
 *
 * 状态（activeSituations）由工厂持有而非模块级单例，
 * 保证每个面板实例互不干扰，也便于测试中反复创建干净实例。
 */
import { ref } from 'vue';
import { crossingResourceSpecs } from '@/mock/river';
import type { RiverPlanKey } from './types';

/** 推演上下文：由调用方按需提供最新任务要素 */
export interface SituationContext {
  riverWidth: number;
  forceScale: string;
  timeConstraint: string;
}

/** 单轮问答的产出 */
export interface OfflineAnswer {
  answer: string;
  isGenerate: boolean;
  situationTitle?: string;
  recommendedKey?: RiverPlanKey;
}

// ══════════════════ 预置问答库 ══════════════════

interface OfflineQA {
  keywords: string[];
  answer: (ctx: SituationContext) => string;
}

const OFFLINE_QA: OfflineQA[] = [
  {
    keywords: ['推荐', '理由', '为什么', '门桥'],
    answer: c =>
      `推荐方案一，门桥漕渡主渡。理由有三点：渡场选在关渡大桥上游约 1 公里的窄段，实测河幅约 ${c.riverWidth} 米，单程漕渡时间最短；西岸狮子头是突出部高地，能通视桥区和对岸登陆场；登陆场放在关渡宫南侧，避开了红树林保育区北缘。

方案二通行能力强，但架设期间桥位暴露、社子岛纵深也受限；方案三只能送轻装。正常水文条件下，建议以方案一组织漕渡。`
  },
  {
    keywords: ['方案二', '浮桥'],
    answer: () =>
      `方案二是浮桥分段架设：在社子岛头—五股段架设浮桥，重型舟桥器材两套，架设能力 530 米，覆盖约 492 米断面。

好处是通行能力最强，每小时能过两个营，重装梯队可以连续通过。问题在架设期间桥位暴露在主槽上，而且社子岛是滞洪区、堤防高，上岸后纵深机动受限。

一般作为备案保留，方案一受阻时接替。`
  },
  {
    keywords: ['方案三', '冲锋舟', '突击'],
    answer: () =>
      `方案三是冲锋舟突击：从八里渡船头下水面出发，在下游竹围岸段多点突击登陆。

优点是部署最快，约 1 小时 50 分钟就能到位，多点分散、隐蔽性也好。短板是只能送轻装人员，而且靠近河口强潮区，必须严格按平潮窗口行动。

定位是应急方案：前两条路线受阻时使用，或者配合正面佯渡。`
  },
  {
    keywords: ['水文', '河宽', '河幅', '流速', '水深'],
    answer: c =>
      `当前渡段的水文要素：

河幅实测 ${c.riverWidth} 米（关渡段断面）；水深 4~8 米，感潮段主槽较深；流速 0.8~1.8 米每秒，涨落潮时会增大；河床以泥沙质为主，利于门桥泊岸。

这一段是感潮河段，作业窗口要结合潮汐计算。`
  },
  {
    keywords: ['潮汐', '平潮', '涨潮', '潮流'],
    answer: () =>
      `平潮窗口是这次渡河的关键约束。

关渡段是半日潮感潮河段，每天两涨两落，潮差约 2.3 米。涨落潮中间各有大约 1.5~2 小时的平潮期，流速接近零，是漕渡和浮桥架设的最佳窗口。流速超过 1.5 米每秒时门桥操纵困难，必须暂停作业或转上游渡场。

建议装载和编组在平潮前完成，窗口一开立即下水。`
  },
  {
    keywords: ['红树林', '保育', '登陆'],
    answer: () =>
      `东岸关渡自然保留区分布红树林滩地，滩面不可通行，这是渡场的主要约束之一。

处置办法：登陆场特意选在关渡宫南侧，门桥直接泊硬质滩区，避开红树林北缘；上岸后由引导分队标识安全通道，防止车辆误入滩地陷淤。`
  },
  {
    keywords: ['装备', '资源', '编成', '登陆艇'],
    answer: () =>
      `当前编成内的渡河装备：${Object.values(crossingResourceSpecs)
        .slice(0, 4)
        .map(spec => `\n- ${spec.name}×${spec.count}`)
        .join('')}

完整规格可在左侧设置区"可用资源"中勾选查看。`
  },
  {
    keywords: ['时间', '时限', '小时'],
    answer: c =>
      `任务要求${c.timeConstraint}。

按测算：方案一总耗时约 2 小时 46 分钟，满足时限且有余量；方案二约 3 小时 20 分钟，含浮桥架设；方案三约 1 小时 50 分钟，但只能送轻装。

结论：主攻按方案一组织，预留 15 分钟编队缓冲即可。`
  }
];

// ══════════════════ 战场态势规则库 ══════════════════

/** 方案受影响级别 */
type ImpactLevel = 'blocked' | 'limited' | 'ok' | 'boost';

interface SituationImpact {
  level: ImpactLevel;
  text: string;
}

/** 级别 → 展示文案 */
const IMPACT_LABEL: Record<ImpactLevel, string> = {
  blocked: '不可行',
  limited: '受限',
  ok: '可行',
  boost: '可行性上升'
};

/** 级别 → 综合评分权重（不可行为否决项，给予极大负分） */
const IMPACT_SCORE: Record<ImpactLevel, number> = {
  blocked: -100,
  limited: -1,
  ok: 1,
  boost: 2
};

const PLAN_LABEL: Record<RiverPlanKey, string> = {
  'plan-a': '方案一 门桥漕渡',
  'plan-b': '方案二 浮桥架设',
  'plan-c': '方案三 冲锋舟突击'
};

/** 基线推荐：无态势激活时的默认主推方案 */
const BASELINE_PLAN: RiverPlanKey = 'plan-a';

interface SituationRule {
  id: string;
  keywords: string[];
  title: string;
  answer: (ctx: SituationContext) => string;
  impacts: { planA: SituationImpact; planB: SituationImpact; planC: SituationImpact };
}

const SITUATION_RULES: SituationRule[] = [
  {
    id: 'bridge-down',
    keywords: [
      '大桥损毁',
      '大桥被炸',
      '大桥坍塌',
      '大桥中断',
      '大桥封锁',
      '大桥遭袭',
      '桥损毁',
      '桥被炸',
      '桥断了',
      '桥塌了',
      '断桥'
    ],
    title: '关渡大桥遭袭损毁',
    answer: () => `**桥区已划为禁航区**，落水构件对下游 300m 范围构成漂流物威胁。`,
    impacts: {
      planA: {
        level: 'limited',
        text: '渡场在桥上游约 1km 不受坍落物直接影响，但需加强对空/对岸观察，漂流物警戒分队前出'
      },
      planB: { level: 'boost', text: '桥区禁航后西岸器材机动改陆路，浮桥架设安全边界反而扩大' },
      planC: { level: 'ok', text: '竹围段远离桥区' }
    }
  },
  {
    id: 'landing-blocked',
    keywords: ['登陆场受阻', '登陆场被占', '红树林起火', '滩地布雷', '登陆点被封'],
    title: '关渡登陆场受阻',
    answer: () => `**关渡宫南侧登陆场不可用**，方案一的主要上陆点失效，必须转换上陆点或更换渡河方式。`,
    impacts: {
      planA: { level: 'blocked', text: '主登陆场失效，强渡将造成部队拥挤于滩地边缘' },
      planB: { level: 'ok', text: '改在社子岛头接引，浮桥直通岛内延平北路纵深' },
      planC: { level: 'limited', text: '竹围段距目标纵深过远，仅能作辅助方向' }
    }
  },
  {
    id: 'flow-surge',
    keywords: ['流速超限', '洪峰', '暴雨', '水位暴涨', '涨潮提前'],
    title: '水文条件突变（流速超限）',
    answer: () => `**实测流速已超装备适应上限**，漕渡与浮桥架设暂停，等待下一个平潮窗口（约 1.5~2 小时）。`,
    impacts: {
      planA: { level: 'limited', text: '门桥漕渡暂停，已下水门桥就近锚泊' },
      planB: { level: 'limited', text: '浮桥架设中断，已锚定节段加固待平潮' },
      planC: { level: 'ok', text: '冲锋舟轻载可控，但仅限小批次梯次渡送' }
    }
  },
  {
    id: 'enemy-fire',
    keywords: ['敌方', '火力', '设防', '伏击', '被炮火', '遭火力'],
    title: '对岸发现敌火力点',
    answer: () => `**对岸关渡方向发现敌火力配系**，正面渡场处于直瞄火力覆盖下，正面强渡代价过高。`,
    impacts: {
      planA: { level: 'limited', text: '转为佯渡方向，保持压力牵制敌兵力' },
      planB: { level: 'blocked', text: '浮桥目标大且架设时间长，暂缓' },
      planC: { level: 'ok', text: '冲锋舟多点分散夜渡，配合佯渡方向实施主突' }
    }
  },
  {
    id: 'night-op',
    keywords: ['夜暗', '夜间', '能见度骤降', '大雾'],
    title: '转入夜暗/低能见度条件',
    answer: () => `**能见度低于作业标准**，门桥编队与浮桥架设的目视协同失效，转入夜间隐蔽机动条件。`,
    impacts: {
      planA: { level: 'limited', text: '漕渡协同困难，暂缓至能见度恢复' },
      planB: { level: 'limited', text: '架设作业照明将暴露位置，暂缓' },
      planC: { level: 'ok', text: '冲锋舟夜渡隐蔽性最好，配合灯火管制实施' }
    }
  },
  {
    id: 'equipment-loss',
    keywords: ['装备损失', '器材损毁', '登陆艇损毁', '冲锋舟损失', '浮桥被毁'],
    title: '渡河装备遭损',
    answer: () => `**部分渡河装备遭损**，运力结构变化，需重新核算各方式可输送量。`,
    impacts: {
      planA: { level: 'ok', text: '门桥漕渡受影响最小，成为当前主力方式' },
      planB: { level: 'limited', text: '浮桥器材损失后架设能力下降，需补充器材' },
      planC: { level: 'limited', text: '冲锋舟损失直接削减突击运力' }
    }
  }
];

/** 生成方案意图：命中即视为"重新生成"指令 */
const GENERATE_INTENT = /(生成|重新|给出|制定|输出).{0,6}(方案|推荐|分析)/;

/**
 * 创建离线推演引擎。
 * @param getCtx 每次问答时调用，返回当前任务要素（保证读到最新的表单值）
 */
export function createRiverSituationEngine(getCtx: () => SituationContext) {
  /** 已激活的战场态势（持续影响后续问答与方案推荐） */
  const activeSituations = ref<Array<{ id: string; title: string }>>([]);

  /**
   * 综合所有已激活态势的评分，得出当前推荐方案。
   * 多条态势叠加时取累计分最高者，而非沿用最后一条注入的结论。
   */
  function recommendedPlan(): RiverPlanKey {
    const score: Record<RiverPlanKey, number> = { 'plan-a': 0, 'plan-b': 0, 'plan-c': 0 };
    for (const s of activeSituations.value) {
      const rule = SITUATION_RULES.find(r => r.id === s.id);
      if (!rule) continue;
      score['plan-a'] += IMPACT_SCORE[rule.impacts.planA.level];
      score['plan-b'] += IMPACT_SCORE[rule.impacts.planB.level];
      score['plan-c'] += IMPACT_SCORE[rule.impacts.planC.level];
    }
    return (Object.keys(score) as RiverPlanKey[]).reduce(
      (best, key) => (score[key] > score[best] ? key : best),
      BASELINE_PLAN
    );
  }

  function resolveSituation(question: string): SituationRule | null {
    return (
      SITUATION_RULES.find(
        r => !activeSituations.value.some(s => s.id === r.id) && r.keywords.some(k => question.includes(k))
      ) ?? null
    );
  }

  function buildSituationAnswer(rule: SituationRule, ctx: SituationContext): string {
    const impactLine = (label: string, key: 'planA' | 'planB' | 'planC') => {
      const impact = rule.impacts[key];
      return `- ${label}：${IMPACT_LABEL[impact.level]}——${impact.text}`;
    };
    // 本条态势已先入栈，故此处算得的是叠加后的综合结论
    const recommended = recommendedPlan();
    const changed = recommended !== BASELINE_PLAN;
    return `收到，${rule.title}的情况已记录（当前共 ${activeSituations.value.length} 条态势）。

对三个方案的影响：
${impactLine('方案一 门桥漕渡', 'planA')}
${impactLine('方案二 浮桥架设', 'planB')}
${impactLine('方案三 冲锋舟突击', 'planC')}

综合来看，${changed ? `主推方案由${PLAN_LABEL[BASELINE_PLAN]}调整为${PLAN_LABEL[recommended]}。` : `主推方案仍为${PLAN_LABEL[recommended]}。`}当前兵力${ctx.forceScale}，渡区河幅 ${ctx.riverWidth} 米，时限${ctx.timeConstraint}。

以上结论还没有上图。输入"重新生成方案"后，我会按这些情况统一更新方案面板与地图。`;
  }

  /** 输入一句话，产出回答与推荐结论（纯函数式，除 activeSituations 入栈外无副作用） */
  function answer(question: string): OfflineAnswer {
    const ctx = getCtx();

    // ① 生成方案指令：按已激活态势重新推荐
    if (GENERATE_INTENT.test(question)) {
      const active = activeSituations.value.map(s => s.title).join('、') || '无（基线条件）';
      return {
        isGenerate: true,
        answer: `已结合当前战场态势重新分析。激活的态势：${active}。综合评估，主推方案为${PLAN_LABEL[recommendedPlan()]}。任务规模${ctx.forceScale}，渡区河幅 ${ctx.riverWidth} 米，时限${ctx.timeConstraint}。\n\n方案面板与地图标绘已同步更新。`
      };
    }

    // ② 战场态势注入：激活态势并输出影响矩阵
    const situation = resolveSituation(question);
    if (situation) {
      activeSituations.value.push({ id: situation.id, title: situation.title });
      return {
        answer: buildSituationAnswer(situation, ctx),
        isGenerate: false,
        situationTitle: situation.title,
        recommendedKey: recommendedPlan()
      };
    }

    // ③ 态势汇总查询
    if (question.includes('当前态势') || question.includes('态势汇总') || question.includes('影响评估')) {
      if (activeSituations.value.length === 0) {
        return {
          isGenerate: false,
          answer: `当前没有激活的态势，按基线条件推荐方案一（门桥漕渡主渡）。\n\n有突发情况可以直接说，比如"关渡大桥遭袭损毁""流速超限""对岸发现敌火力""转入夜间"。`
        };
      }
      const matrix = activeSituations.value.map(s => `- ${s.title}`).join('\n');
      return {
        isGenerate: false,
        answer: `当前激活的态势：\n\n${matrix}\n\n综合这些情况，建议主推方案调整为${PLAN_LABEL[recommendedPlan()]}。需要重新排方案时，输入"重新生成方案"。`
      };
    }

    // ④ 静态问答（方案/水文/潮汐/装备等）
    for (const qa of OFFLINE_QA) {
      if (qa.keywords.some(k => question.includes(k))) {
        const prefix =
          activeSituations.value.length > 0
            ? `> ⚠ 当前态势修正：${activeSituations.value.map(s => s.title).join('；')}\n\n`
            : '';
        return { answer: prefix + qa.answer(ctx), isGenerate: false };
      }
    }

    // ⑤ 兜底引导
    return {
      isGenerate: false,
      answer: `我负责这次渡河工程的方案推演。方案对比、水文潮汐、装备时限这些都可以直接问；\n\n有突发情况——桥被炸了、流速超限、发现敌火力、转入夜间——直接说，我会评估对三个方案的影响。需要重排方案时，输入"重新生成方案"。`
    };
  }

  return { activeSituations, recommendedPlan, answer };
}
