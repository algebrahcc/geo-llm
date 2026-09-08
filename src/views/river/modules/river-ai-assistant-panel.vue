<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import MarkdownIt from 'markdown-it';
import { crossingResourceSpecs } from '@/mock/river';
import type {
  AiAnalysisStep,
  ChatMessage,
  CrossingResourceAttr,
  CrossingResourceSpec,
  CrossingSettingForm,
  KnowledgeHitDisplay,
  RiverPlanKey
} from './types';

/** AI 回答 markdown 渲染（html:false 防 XSS） */
const md = new MarkdownIt({ html: false, linkify: true, breaks: true });
function renderMarkdown(text: string): string {
  return md.render(text);
}

const props = defineProps<{
  collapsed: boolean;
  running: boolean;
  form: CrossingSettingForm | null;
  steps: AiAnalysisStep[];
  knowledgeHits: KnowledgeHitDisplay[];
  references: string[];
}>();

const emit = defineEmits<{
  (e: 'toggle-collapse'): void;
  (e: 'close'): void;
  (e: 'send-message', msg: string): void;
  (e: 'generate-plan'): void;
  /** 战场态势注入：事件名须与父组件 @situation-applied 一致，否则推荐方案不会切换 */
  (e: 'situation-applied', title: string, recommendedKey: RiverPlanKey): void;
}>();

// ──── 离线演示模式：未绑定 Dify 应用时，按预置问答库生成固定回答 ────

// ──── 区块折叠状态（默认只展开核心区块：输入参数核心行 + 分析过程） ────
const sectionCollapsed = ref<Record<string, boolean>>({
  params: false,
  resources: true,
  progress: false,
  knowledge: true
});

/**
 * 上下文区展开态：首次进入时若已存在研判步骤则默认展开，
 * 让分析过程（研判进程时间线）直接可见。
 */
const contextExpanded = ref(props.steps.length > 0);

function toggleSection(key: string) {
  sectionCollapsed.value[key] = !sectionCollapsed.value[key];
}

// 分析开始：同时展开上下文区与"研判进程"，实时呈现分析过程
watch(
  () => props.running,
  running => {
    if (running) {
      sectionCollapsed.value.progress = false;
      contextExpanded.value = true;
    }
  }
);

// ──── 对话 ────
const chatInput = ref('');
const messages = ref<ChatMessage[]>([
  {
    id: 'welcome',
    role: 'assistant',
    content: '您好，我是渡河工程方案助手。基于您提供的要求参数，我将为您进行智能分析并生成最优渡河工程保障。',
    timestamp: Date.now()
  }
]);

// ──── 后端 SSE 对话状态 ────
const streaming = ref(false);

// ──── 对话跟随：消息/流式输出变化时自动滚动到底部 ────
const scrollBodyRef = ref<HTMLElement | null>(null);

function scrollToLatest() {
  const el = scrollBodyRef.value;
  if (!el) return;
  // 用户上翻查看历史（距底 >90px）时不强行拉回；新消息或流式输出中强制跟随
  const latest = messages.value[messages.value.length - 1];
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
  if (nearBottom || streaming.value || (latest && latest.role === 'user')) {
    nextTick(() => {
      el.scrollTop = el.scrollHeight;
    });
  }
}

watch(messages, () => scrollToLatest(), { deep: true });
let typeOutSkip = false;

const expandedKnowledge = ref<string | null>(null);

/** 空状态快捷提问：一键发起高频问题与态势注入 */
const quickAsks = ['为什么推荐方案一？', '当前水文条件如何？', '关渡大桥遭袭损毁', '重新生成方案'];

// ──── 参数回显列表 ────
const paramList = ref<Array<{ label: string; value: string }>>([]);

// ──── 参数回显：核心参数常显，其余折叠在"全部参数"下 ────
const coreParamLabels = ['任务名称', '渡河位置', '保障兵力', '时间约束'];
const showAllParams = ref(false);
const coreParams = computed(() => paramList.value.filter(p => coreParamLabels.includes(p.label)));
const extraParams = computed(() => paramList.value.filter(p => !coreParamLabels.includes(p.label)));

watch(
  () => props.form,
  form => {
    if (!form) {
      paramList.value = [];
      return;
    }
    paramList.value = [
      { label: '任务名称', value: form.taskName },
      { label: '渡河位置', value: form.location },
      { label: '任务类型', value: form.taskType },
      { label: '作战时间', value: form.actionTime },
      { label: '保障兵力', value: form.forceScale },
      { label: '河宽', value: `${form.riverWidth}m` },
      { label: '水深', value: form.waterDepthRange },
      { label: '流速', value: form.flowVelocity },
      { label: '河床地形', value: form.riverbedTerrain },
      { label: '天气条件', value: form.weatherCondition },
      { label: '能见度', value: `${form.visibilityKm} km` },
      { label: '时间约束', value: form.timeConstraint },
      { label: '其他要求', value: form.otherRequirements }
    ].filter(item => item.value && item.value !== '0' && item.value !== '0m' && item.value !== '0 km');
  },
  { immediate: true, deep: true }
);

// ──── 所选可用资源的规格属性（长度/宽度/高度等） ────
const selectedResourceSpecs = computed<CrossingResourceSpec[]>(() => {
  const resources = props.form?.availableResources ?? [];
  return resources
    .map(name => crossingResourceSpecs[name])
    .filter((spec): spec is CrossingResourceSpec => Boolean(spec));
});

/** 手风琴展开的资源名（默认全部折叠，仅显示尺寸摘要行） */
const expandedResource = ref<string | null>(null);

function toggleResource(name: string) {
  expandedResource.value = expandedResource.value === name ? null : name;
}

/** 折叠态摘要：长 × 宽 × 高（从属性中按标签匹配尺寸项） */
function getResourceDims(spec: CrossingResourceSpec): string {
  const dims = [
    spec.attrs.find(a => a.label.includes('长度')),
    spec.attrs.find(a => a.label.includes('宽度')),
    spec.attrs.find(a => a.label.includes('高度'))
  ].filter((a): a is CrossingResourceAttr => Boolean(a));
  if (dims.length === 0) return spec.model;
  const nums = dims.map(a => a.value.replace(/[^\d.]/g, ''));
  const unit = dims[0].value.replace(/[\d.\s]/g, '') || '';
  return `${nums.join(' × ')} ${unit}`.trim();
}

// ──── 计算完成/总数 ────
const completedStepsCount = () => props.steps.filter(s => s.status === 'success').length;
const totalStepsCount = () => props.steps.length;

/** 整体研判进度百分比（顶部进度条使用） */
const progressPercent = computed(() => {
  const total = props.steps.length;
  if (total === 0) return 0;
  return Math.round((completedStepsCount() / total) * 100);
});

// ──── 单栏布局：摘要条 chips 与上下文可见性判断 ────
/** 摘要条 chips：核心参数前 4 项（窄容器下单芯片超长自动省略） */
const summaryChips = computed(() => coreParams.value.slice(0, 4).map(p => ({ label: p.label, value: p.value })));

/** 存在任意可展开上下文时才渲染摘要条 */
const hasContext = computed(
  () =>
    paramList.value.length > 0 ||
    selectedResourceSpecs.value.length > 0 ||
    props.knowledgeHits.length > 0 ||
    props.steps.length > 0
);

// ──── 离线演示：预置问答库（回答注入当前任务要素与三方案上下文） ────
interface OfflineQA {
  keywords: string[];
  answer: (ctx: { riverWidth: number; forceScale: string; timeConstraint: string }) => string;
}

const OFFLINE_QA: OfflineQA[] = [
  {
    keywords: ['为什么', '推荐', '门桥'],
    answer: c =>
      `**方案一（门桥漕渡主渡方案）是当前条件下的最优解**，理由有三：

1. **渡段最优**：渡场选在关渡大桥上游约 1km 的窄段，实测河幅约 ${c.riverWidth}m，单程漕渡时间最短；
2. **观察条件好**：西岸狮子头为突出部高地，可通视桥区与对岸登陆场；
3. **避让约束**：登陆场设在关渡宫南侧，避开了红树林保育区北缘。

对比：方案二通行能力强但桥位暴露、社子岛纵深受限；方案三只能送轻装人员。需要我详细对比三个方案吗？`
  },
  {
    keywords: ['方案二', '浮桥'],
    answer: () =>
      `**方案二（浮桥分段架设方案）**：在社子岛头—五股段架设浮桥，重型舟桥器材 2 套（530m 架设能力）覆盖约 492m 断面。

- **优势**：通行能力最强（2 个营/h），适合重装梯队连续通过
- **风险**：架设期间桥位暴露于主槽；社子岛为滞洪区、堤防高，上岸后纵深机动受限
- **适用**：常规投送与保障编组，或方案一受阻时接替

作为**备案**保留，主攻仍建议方案一。`
  },
  {
    keywords: ['方案三', '冲锋舟', '突击'],
    answer: () =>
      `**方案三（冲锋舟突击方案）**：应急选项——从八里渡船头下水面出发，在下游竹围岸段多点突击登陆。

- **优势**：部署最快（约 1h50min）、隐蔽性好、多点分散降低暴露
- **风险**：仅能输送轻装人员；靠近河口强潮区，必须严格按**平潮窗口**行动
- **定位**：前两条路线受阻时的应急预案，或配合正面佯渡使用`
  },
  {
    keywords: ['水文', '河宽', '河幅', '流速', '水深'],
    answer: c =>
      `当前任务水文要素（已录入分析）：

| 要素 | 值 |
| --- | --- |
| 河幅 | 实测 ${c.riverWidth}m（关渡段断面） |
| 水深 | 4~8m（感潮段主槽较深） |
| 流速 | 0.8~1.8 m/s（涨落潮时增大） |
| 河床 | 泥沙质为主，利于门桥泊岸 |

该段为**感潮河段**，作业窗口须结合潮汐计算。`
  },
  {
    keywords: ['潮汐', '平潮', '涨潮', '潮流'],
    answer: () =>
      `**平潮窗口**是本渡河的关键约束：

- 淡水河关渡段为半日潮感潮河段，每日两涨两落，潮差约 2.3m
- 涨落潮中间各有约 **1.5~2 小时平潮期**，流速接近 0，是漕渡与浮桥架设的最佳窗口
- 高流速时段（>1.5m/s）门桥操纵困难，须暂停作业或转上游渡场

建议：装载与编组在平潮前完成，窗口开启后立即下水。`
  },
  {
    keywords: ['红树林', '保育', '登陆'],
    answer: () =>
      `**红树林约束**：东岸关渡自然保留区分布红树林滩地（渡场约束之一），滩面不可通行。

处置：登陆场特意选在**关渡宫南侧**（红树林北缘以南），门桥直接泊岸硬质滩区；上岸后由引导分队标识安全通道，防止车辆误入滩地陷淤。`
  },
  {
    keywords: ['装备', '资源', '编成', '登陆艇'],
    answer: () =>
      `当前可用装备编成（按所选资源）：${Object.values(crossingResourceSpecs)
        .slice(0, 4)
        .map(
          spec =>
            `\n- **${spec.name}**×${spec.count}：${spec.attrs.find(a => a.label.includes('长度'))?.value ?? ''} 起，参数齐备`
        )
        .join('')}

完整规格可在上方"装备编成"区展开查看。`
  },
  {
    keywords: ['时间', '时限', '小时'],
    answer: c =>
      `**时限分析**：任务要求 ${c.timeConstraint}。

- 方案一总耗时约 2h46min，满足时限且有余量
- 方案二约 3h20min（含浮桥架设）；方案三约 1h50min（仅轻装）

结论：主攻按方案一组织，预留 15 分钟编队缓冲即可。`
  }
];

// ──── 战场态势事件引擎：态势注入 → 方案影响矩阵 → 综合推荐结论变更 ────

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
  answer: (ctx: { riverWidth: number; forceScale: string; timeConstraint: string }) => string;
  impacts: { planA: SituationImpact; planB: SituationImpact; planC: SituationImpact };
}

const SITUATION_RULES: SituationRule[] = [
  {
    id: 'bridge-down',
    keywords: ['大桥损毁', '大桥被炸', '大桥坍塌', '大桥中断', '大桥封锁', '大桥遭袭'],
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

/** 已激活的战场态势（持续影响后续问答与方案推荐） */
const activeSituations = ref<Array<{ id: string; title: string }>>([]);

/**
 * 综合所有已激活态势的评分，得出当前推荐方案。
 * 多条态势叠加时取累计分最高者，而非沿用最后一条注入的结论。
 */
function resolveRecommendedPlan(): RiverPlanKey {
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

function buildSituationAnswer(
  rule: SituationRule,
  ctx: { riverWidth: number; forceScale: string; timeConstraint: string }
): string {
  const impactRow = (label: string, key: 'planA' | 'planB' | 'planC') => {
    const impact = rule.impacts[key];
    return `| ${label} | ${IMPACT_LABEL[impact.level]} | ${impact.text} |`;
  };
  // 本条态势已先入栈，故此处算得的是叠加后的综合结论
  const recommended = resolveRecommendedPlan();
  const changed = recommended !== BASELINE_PLAN;
  return `**态势已注入：${rule.title}**（当前激活态势 ${activeSituations.value.length} 条）

对三个候选方案的影响：

| 方案 | 影响评估 | 说明 |
| --- | --- | --- |
${impactRow('方案一 门桥漕渡', 'planA')}
${impactRow('方案二 浮桥架设', 'planB')}
${impactRow('方案三 冲锋舟突击', 'planC')}

📌 **推荐结论${changed ? '将变更' : '维持'}**：${changed ? `主推方案由${PLAN_LABEL[BASELINE_PLAN]}调整为**${PLAN_LABEL[recommended]}**` : `主推方案维持**${PLAN_LABEL[recommended]}**`}，任务要素：${ctx.forceScale}、渡区河幅 ${ctx.riverWidth}m、时限 ${ctx.timeConstraint}。

⚠ 该结论**尚未上图**：保持当前方案与地图标绘不变，输入"重新生成方案"后才会一次性更新方案面板与地图。`;
}

const GENERATE_INTENT = /(生成|重新|给出|制定|输出).{0,6}(方案|推荐|分析)/;

function buildOfflineAnswer(question: string): {
  answer: string;
  isGenerate: boolean;
  situationTitle?: string;
  recommendedKey?: RiverPlanKey;
} {
  const ctx = {
    riverWidth: props.form?.riverWidth ?? 491,
    forceScale: props.form?.forceScale ?? '1个合成营',
    timeConstraint: props.form?.timeConstraint ?? '3小时内完成渡河'
  };
  // ① 生成方案指令：按已激活态势重新推荐
  if (GENERATE_INTENT.test(question)) {
    const active = activeSituations.value.map(s => s.title).join('、') || '无（基线条件）';
    return {
      isGenerate: true,
      answer: `好的，已按当前战场态势重新执行智能分析：

- 激活态势：${active}
- 综合推荐：**${PLAN_LABEL[resolveRecommendedPlan()]}**
- 任务规模：${ctx.forceScale}
- 渡区河幅：实测 ${ctx.riverWidth}m（关渡段断面）
- 时限要求：${ctx.timeConstraint}

方案面板与地图标绘已同步更新，请查看推荐结论。`
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
      recommendedKey: resolveRecommendedPlan()
    };
  }
  // ③ 态势汇总查询
  if (question.includes('当前态势') || question.includes('态势汇总') || question.includes('影响评估')) {
    if (activeSituations.value.length === 0) {
      return {
        isGenerate: false,
        answer: `当前**无激活态势**，基线条件下的推荐结论为**${PLAN_LABEL[BASELINE_PLAN]}（门桥漕渡主渡方案）**。\n\n可注入的战场态势示例："关渡大桥遭袭损毁""登陆场被占""流速超限""对岸发现敌火力""转入夜间"。`
      };
    }
    const matrix = activeSituations.value.map(s => `- ${s.title}`).join('\n');
    return {
      isGenerate: false,
      answer: `当前已激活 ${activeSituations.value.length} 条战场态势：\n\n${matrix}\n\n综合影响下的推荐结论为**${PLAN_LABEL[resolveRecommendedPlan()]}**——输入"重新生成方案"按态势更新推荐。`
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
    answer: `我可以结合当前任务与三个方案回答问题，也可以接收**战场态势变化**并评估其对渡河方案的影响。示例：

- "为什么推荐方案一？"
- "当前水文条件怎么样？"
- **注入态势**："关渡大桥遭袭损毁""流速超限""对岸发现敌火力""转入夜间"
- 输入"重新生成方案"按态势更新推荐`
  };
}

/** 模拟流式输出（打字机），增强演示真实感 */
function typeOut(msgId: string, full: string): Promise<void> {
  return new Promise(resolve => {
    let i = 0;
    const timer = window.setInterval(() => {
      const msg = messages.value.find(m => m.id === msgId);
      if (!msg) {
        window.clearInterval(timer);
        resolve();
        return;
      }
      if (typeOutSkip) i = full.length;
      i = Math.min(i + 2, full.length);
      msg.content = full.slice(0, i);
      if (i >= full.length) {
        window.clearInterval(timer);
        resolve();
      }
    }, 24);
  });
}

async function offlineReply(question: string) {
  const assistantId = `assistant-offline-${Date.now()}`;
  messages.value.push({
    id: assistantId,
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    streaming: true
  });
  streaming.value = true;
  const { answer, isGenerate, situationTitle, recommendedKey } = buildOfflineAnswer(question);
  await typeOut(assistantId, answer);
  const msg = messages.value.find(m => m.id === assistantId);
  if (msg) msg.streaming = false;
  streaming.value = false;
  if (isGenerate) {
    emit('generate-plan');
  }
  if (situationTitle && recommendedKey) {
    emit('situation-applied', situationTitle, recommendedKey);
  }
}

/** 统一发送入口：输入框回车/发送按钮与空状态快捷提问共用 */
async function sendText(raw: string) {
  const text = raw.trim();
  if (!text || streaming.value) return;

  messages.value.push({
    id: `user-${Date.now()}`,
    role: 'user',
    content: text,
    timestamp: Date.now()
  });
  chatInput.value = '';
  emit('send-message', text);

  // 离线推演：匹配问答库/态势规则，流式生成回答
  await offlineReply(text);
}

// ──── 发送消息（接入后端 Dify SSE 流式对话） ────
function handleSend() {
  void sendText(chatInput.value);
}

// ──── 停止生成 ────
function handleStop() {
  typeOutSkip = true;
}

function toggleKnowledgeHit(docName: string) {
  expandedKnowledge.value = expandedKnowledge.value === docName ? null : docName;
}

function getStepStatusLabel(status: AiAnalysisStep['status']) {
  if (status === 'success') return '已完成';
  if (status === 'running') return '进行中';
  return '等待中';
}
</script>

<template>
  <div class="ai-panel" :class="{ 'ai-panel--collapsed': collapsed }">
    <!-- ── 标题栏 ── -->
    <header class="panel-header">
      <span class="brand-mark">
        <SvgIcon icon="mdi:robot-outline" />
      </span>
      <div class="header-title-group">
        <span class="header-title">渡河工程方案助手</span>
        <span class="header-subtitle">智能推演 · 方案生成</span>
      </div>
      <span class="agent-status" :class="running ? 'agent-status--busy' : 'agent-status--online'">
        <span class="status-dot" />
        {{ running ? '分析中' : '待命' }}
      </span>
      <div class="header-actions">
        <button
          type="button"
          class="action-btn"
          :title="collapsed ? '展开' : '折叠'"
          :aria-label="collapsed ? '展开面板' : '折叠面板'"
          @click="emit('toggle-collapse')"
        >
          <SvgIcon :icon="collapsed ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
        </button>
        <button
          type="button"
          class="action-btn action-btn--danger"
          title="关闭"
          aria-label="关闭助手面板"
          @click="emit('close')"
        >
          <SvgIcon icon="mdi:close" />
        </button>
      </div>
    </header>

    <!-- ── 整体研判进度 ── -->
    <div v-if="totalStepsCount() > 0" class="progress-strip">
      <div class="progress-head">
        <span class="progress-label">研判进度</span>
        <span class="progress-count">{{ completedStepsCount() }}/{{ totalStepsCount() }}</span>
      </div>
      <div
        class="progress-track"
        role="progressbar"
        :aria-valuenow="completedStepsCount()"
        aria-valuemin="0"
        :aria-valuemax="totalStepsCount()"
      >
        <div
          class="progress-fill"
          :class="{ 'progress-fill--running': running }"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>
    </div>

    <div v-show="!collapsed" class="ai-panel-body">
      <!-- ┐── 已激活战场态势（关键状态，常驻可见） ┐── -->
      <div v-if="activeSituations.length > 0" class="situation-chips">
        <span class="situation-chips__label">战场态势</span>
        <span v-for="s in activeSituations" :key="s.id" class="situation-chip">{{ s.title }}</span>
      </div>

      <!-- ══ 上下文：摘要条常驻，详情按需展开 ══ -->
      <section v-if="hasContext" class="context-bar">
        <button
          type="button"
          class="context-toggle"
          :aria-expanded="contextExpanded"
          :title="contextExpanded ? '收起上下文详情' : '展开上下文详情'"
          @click="contextExpanded = !contextExpanded"
        >
          <span class="context-summary">
            <span
              v-for="chip in summaryChips"
              :key="chip.label"
              class="context-chip"
              :title="`${chip.label}：${chip.value}`"
            >
              <span class="context-chip__label">{{ chip.label }}</span>
              <span class="context-chip__value">{{ chip.value }}</span>
            </span>
            <span v-if="selectedResourceSpecs.length > 0" class="context-chip context-chip--violet">
              装备 {{ selectedResourceSpecs.length }}
            </span>
            <span v-if="knowledgeHits.length > 0" class="context-chip context-chip--green">
              检索 {{ knowledgeHits.length }}
            </span>
          </span>
          <SvgIcon
            class="context-chevron"
            :class="{ 'context-chevron--open': contextExpanded }"
            icon="mdi:chevron-down"
          />
        </button>
        <div v-show="contextExpanded" class="context-body">
          <!-- ┐── 智能体分析进度（分析过程优先展示，故置顶） ┐── -->
          <section v-if="steps.length > 0" class="content-section">
            <div
              class="section-header-bar"
              role="button"
              :aria-expanded="!sectionCollapsed.progress"
              tabindex="0"
              @click="toggleSection('progress')"
              @keydown.enter.prevent="toggleSection('progress')"
              @keydown.space.prevent="toggleSection('progress')"
            >
              <span class="section-quick-title">研判进程</span>
              <span class="section-badge section-badge--accent">{{ steps.length }} 步</span>
              <SvgIcon
                class="section-chevron"
                :class="{ 'section-chevron--open': !sectionCollapsed.progress }"
                icon="mdi:chevron-down"
              />
            </div>
            <div v-show="!sectionCollapsed.progress" class="section-body">
              <div class="step-list">
                <div
                  v-for="(step, idx) in steps"
                  :key="step.key"
                  class="step-item"
                  :class="{
                    'step-item--running': step.status === 'running',
                    'step-item--done': step.status === 'success'
                  }"
                >
                  <!-- 左侧圆点+连线 -->
                  <div class="step-indicator">
                    <div class="step-dot" :class="`step-dot--${step.status}`">
                      <span v-if="step.status === 'success'" class="dot-check">✓</span>
                      <span v-else-if="step.status === 'running'" class="dot-spinner" />
                    </div>
                    <div
                      v-if="idx < steps.length - 1"
                      class="step-line"
                      :class="{ 'step-line--done': step.status === 'success' }"
                    />
                  </div>
                  <!-- 内容 -->
                  <div class="step-body">
                    <div class="step-top">
                      <span class="step-label">{{ step.label }}</span>
                      <span class="step-status-tag" :class="`tag-${step.status}`">
                        {{ getStepStatusLabel(step.status) }}
                      </span>
                      <span v-if="step.duration" class="step-duration">
                        <SvgIcon icon="mdi:clock-outline" />
                        {{ step.duration }}
                      </span>
                    </div>
                    <div v-if="step.tool" class="step-tool">调用：{{ step.tool }}</div>
                    <div v-if="step.description" class="step-desc">{{ step.description }}</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- ┐── 输入参数回显 ┐── -->
          <section v-if="paramList.length > 0" class="content-section">
            <div
              class="section-header-bar"
              role="button"
              :aria-expanded="!sectionCollapsed.params"
              tabindex="0"
              @click="toggleSection('params')"
              @keydown.enter.prevent="toggleSection('params')"
              @keydown.space.prevent="toggleSection('params')"
            >
              <span class="section-quick-title">任务要素</span>
              <span class="section-badge">{{ paramList.length }}</span>
              <SvgIcon
                class="section-chevron"
                :class="{ 'section-chevron--open': !sectionCollapsed.params }"
                icon="mdi:chevron-down"
              />
            </div>
            <div v-show="!sectionCollapsed.params" class="section-body section-body--compact">
              <div class="param-list">
                <div v-for="item in coreParams" :key="item.label" class="param-item">
                  <span class="param-label">{{ item.label }}</span>
                  <span class="param-value">{{ item.value }}</span>
                </div>
              </div>
              <div v-if="extraParams.length" class="param-more">
                <button type="button" class="param-more-btn" @click="showAllParams = !showAllParams">
                  {{ showAllParams ? '收起' : `全部参数（${extraParams.length}）` }}
                  <SvgIcon
                    class="param-more-chevron"
                    :class="{ 'param-more-chevron--open': showAllParams }"
                    icon="mdi:chevron-down"
                  />
                </button>
                <div v-show="showAllParams" class="param-list">
                  <div v-for="item in extraParams" :key="item.label" class="param-item">
                    <span class="param-label">{{ item.label }}</span>
                    <span class="param-value">{{ item.value }}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- ┐── 可用资源属性 ┐── -->
          <section v-if="selectedResourceSpecs.length > 0" class="content-section">
            <div
              class="section-header-bar"
              role="button"
              :aria-expanded="!sectionCollapsed.resources"
              tabindex="0"
              @click="toggleSection('resources')"
              @keydown.enter.prevent="toggleSection('resources')"
              @keydown.space.prevent="toggleSection('resources')"
            >
              <span class="section-quick-title">装备编成</span>
              <span class="section-badge section-badge--violet">{{ selectedResourceSpecs.length }}</span>
              <SvgIcon
                class="section-chevron"
                :class="{ 'section-chevron--open': !sectionCollapsed.resources }"
                icon="mdi:chevron-down"
              />
            </div>
            <div v-show="!sectionCollapsed.resources" class="section-body section-body--compact">
              <div class="resource-spec-list">
                <div
                  v-for="spec in selectedResourceSpecs"
                  :key="spec.name"
                  class="resource-spec-card"
                  :class="{ 'resource-spec-card--expanded': expandedResource === spec.name }"
                >
                  <!-- 折叠态：一行摘要（名称 + 长×宽×高） -->
                  <div
                    class="resource-spec-row"
                    role="button"
                    :aria-expanded="expandedResource === spec.name"
                    tabindex="0"
                    @click="toggleResource(spec.name)"
                    @keydown.enter.prevent="toggleResource(spec.name)"
                    @keydown.space.prevent="toggleResource(spec.name)"
                  >
                    <span class="resource-spec-icon">{{ spec.icon }}</span>
                    <span class="resource-spec-name">{{ spec.name }}</span>
                    <span class="resource-spec-dims">{{ getResourceDims(spec) }}</span>
                    <SvgIcon
                      class="resource-spec-chevron"
                      :class="{ 'resource-spec-chevron--open': expandedResource === spec.name }"
                      icon="mdi:chevron-down"
                    />
                  </div>
                  <!-- 展开态：型号 + 完整属性 -->
                  <div v-if="expandedResource === spec.name" class="resource-spec-detail">
                    <div class="resource-spec-model">{{ spec.model }}</div>
                    <div class="resource-attr-grid">
                      <div v-for="attr in spec.attrs" :key="attr.label" class="resource-attr-item">
                        <span class="attr-label">{{ attr.label }}</span>
                        <span class="attr-value">{{ attr.value }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- ┐── 知识库检索结果 ┐── -->
          <section v-if="knowledgeHits.length > 0" class="content-section">
            <div
              class="section-header-bar"
              role="button"
              :aria-expanded="!sectionCollapsed.knowledge"
              tabindex="0"
              @click="toggleSection('knowledge')"
              @keydown.enter.prevent="toggleSection('knowledge')"
              @keydown.space.prevent="toggleSection('knowledge')"
            >
              <span class="section-quick-title">知识检索</span>
              <span class="section-badge section-badge--green">{{ knowledgeHits.length }}</span>
              <SvgIcon
                class="section-chevron"
                :class="{ 'section-chevron--open': !sectionCollapsed.knowledge }"
                icon="mdi:chevron-down"
              />
            </div>
            <div v-show="!sectionCollapsed.knowledge" class="section-body">
              <div class="knowledge-list">
                <div
                  v-for="hit in knowledgeHits"
                  :key="hit.documentName"
                  class="knowledge-card"
                  :class="{ 'knowledge-card--expanded': expandedKnowledge === hit.documentName }"
                >
                  <div
                    class="knowledge-card-header"
                    role="button"
                    :aria-expanded="expandedKnowledge === hit.documentName"
                    tabindex="0"
                    @click="toggleKnowledgeHit(hit.documentName)"
                    @keydown.enter.prevent="toggleKnowledgeHit(hit.documentName)"
                    @keydown.space.prevent="toggleKnowledgeHit(hit.documentName)"
                  >
                    <div class="doc-info">
                      <span class="doc-name">{{ hit.documentName }}</span>
                      <span class="doc-category">{{ hit.documentCategory }}</span>
                    </div>
                    <div class="doc-meta">
                      <span class="doc-format">{{ hit.documentFormat }}</span>
                      <span class="doc-match">{{ hit.matchCount }} 条</span>
                      <SvgIcon
                        class="doc-chevron"
                        :class="{ 'doc-chevron--open': expandedKnowledge === hit.documentName }"
                        icon="mdi:chevron-down"
                      />
                    </div>
                  </div>
                  <div v-if="expandedKnowledge === hit.documentName" class="knowledge-card-body">
                    <div v-for="(snippet, sIdx) in hit.topSnippets" :key="sIdx" class="snippet-item">
                      <div class="snippet-header">
                        <span class="snippet-title">{{ snippet.chunkTitle }}</span>
                        <span class="snippet-score-badge">{{ snippet.score.toFixed(1) }}</span>
                      </div>
                      <div class="snippet-text">{{ snippet.snippet }}</div>
                      <div class="snippet-score-bar">
                        <div class="score-track">
                          <div class="score-fill" :style="{ width: `${snippet.score * 25}%` }" />
                        </div>
                        <span class="score-label">相关性 {{ (snippet.score * 25).toFixed(0) }}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>

      <!-- ══ 对话区（全宽） ══ -->
      <div ref="scrollBodyRef" class="chat-scroll">
        <!-- ┐── 引用来源 ┐── -->
        <div v-if="references.length > 0" class="references-section">
          <div class="ref-label">引用来源</div>
          <div class="ref-tags">
            <span
              v-for="(ref, i) in references"
              :key="i"
              class="ref-tag"
              :class="i < references.length - 2 ? 'ref-tag--doc' : 'ref-tag--sys'"
            >
              {{ ref }}
            </span>
          </div>
        </div>

        <!-- ┐── 空状态引导 ┐── -->
        <div v-if="messages.length <= 1" class="chat-empty">
          <span class="empty-icon">
            <SvgIcon icon="mdi:robot-outline" />
          </span>
          <p class="empty-title">有什么可以帮您？</p>
          <p class="empty-desc">可询问方案对比、水文与潮汐条件，也可注入战场态势触发重新研判</p>
          <div class="quick-asks">
            <button v-for="q in quickAsks" :key="q" type="button" class="quick-ask" @click="void sendText(q)">
              {{ q }}
            </button>
          </div>
        </div>

        <!-- ┐── 对话消息 ┐── -->
        <div v-else class="chat-messages">
          <div class="chat-divider"><span>对话记录</span></div>
          <div v-for="msg in messages.slice(1)" :key="msg.id" class="chat-msg" :class="`chat-msg--${msg.role}`">
            <span class="msg-avatar" :class="`msg-avatar--${msg.role}`">
              <SvgIcon :icon="msg.role === 'user' ? 'mdi:account' : 'mdi:robot-outline'" />
            </span>
            <div class="msg-bubble" :class="`msg-bubble--${msg.role}`">
              <template v-if="msg.role === 'assistant' && msg.streaming && !msg.content">
                <span class="thinking">正在思考</span>
                <span class="stream-caret" />
              </template>
              <template v-else-if="msg.role === 'assistant'">
                <div class="chat-md" v-html="renderMarkdown(msg.content)" />
                <span v-if="msg.streaming" class="stream-caret" />
              </template>
              <template v-else>{{ msg.content }}</template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══ 对话输入 ══ -->
    <div v-show="!collapsed" class="chat-input-area">
      <div class="chat-input-wrapper">
        <input
          v-model="chatInput"
          type="text"
          class="chat-input"
          placeholder="输入消息与助手对话，或注入战场态势…"
          :disabled="streaming"
          @keyup.enter="handleSend"
        />
        <button
          v-if="streaming"
          type="button"
          class="send-btn send-btn--stop"
          title="停止生成"
          aria-label="停止生成"
          @click="handleStop"
        >
          <SvgIcon icon="mdi:stop" />
        </button>
        <button
          v-else
          type="button"
          class="send-btn"
          :disabled="!chatInput.trim()"
          title="发送"
          aria-label="发送消息"
          @click="handleSend"
        >
          <SvgIcon icon="mdi:send" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════
   渡河工程方案助手 — 局部设计 Token
   主色对齐主题 #4A7DBD；语义色对齐 src/theme/settings.ts
   （success #6AAE8A / warning #C9A45C / error #C25B5B / info #4A7DBD）
   ═══════════════════════════════════════════════════════════════ */
.ai-panel {
  /* ── 品牌主色 ── */
  --ai-primary: #4a7dbd;
  --ai-primary-deep: #3d6fb4;
  --ai-primary-soft: rgb(74 125 189 / 12%);
  --ai-primary-line: rgb(74 125 189 / 34%);
  --ai-accent: #8db8ff;
  --ai-accent-soft: rgb(141 184 255 / 12%);

  /* ── 语义色 ── */
  --ai-success: #6aae8a;
  --ai-success-soft: rgb(106 174 138 / 13%);
  --ai-warning: #c9a45c;
  --ai-warning-soft: rgb(201 164 92 / 13%);
  --ai-danger: #c25b5b;
  --ai-danger-soft: rgb(194 91 91 / 14%);
  --ai-violet: #a78bfa;
  --ai-violet-soft: rgb(167 139 250 / 13%);

  /* ── 文本层级 ── */
  --ai-text-1: rgb(255 255 255 / 92%);
  --ai-text-2: rgb(255 255 255 / 72%);
  --ai-text-3: rgb(255 255 255 / 48%);
  --ai-text-4: rgb(255 255 255 / 32%);

  /* ── 面与线 ── */
  --ai-surface: rgb(255 255 255 / 2%);
  --ai-surface-2: rgb(255 255 255 / 4%);
  --ai-surface-3: rgb(255 255 255 / 6%);
  --ai-line: rgb(255 255 255 / 6%);
  --ai-line-2: rgb(255 255 255 / 10%);
  --ai-solid: rgb(15 20 35 / 96%);

  /* ── 圆角 / 间距 / 动效 ── */
  --ai-r-lg: 12px;
  --ai-r: 10px;
  --ai-r-sm: 8px;
  --ai-r-xs: 6px;
  --ai-ease: cubic-bezier(0.4, 0, 0.2, 1);
  --ai-fast: 0.15s;
  --ai-base: 0.22s;
  --ai-slow: 0.4s;

  width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/* ─────────── 通用：细滚动条 ─────────── */
.context-body,
.chat-scroll {
  scrollbar-width: thin;
  scrollbar-color: var(--ai-primary-line) transparent;
}

.context-body::-webkit-scrollbar,
.chat-scroll::-webkit-scrollbar {
  width: 5px;
}

.context-body::-webkit-scrollbar-track,
.chat-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.context-body::-webkit-scrollbar-thumb,
.chat-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: var(--ai-primary-line);
}

.context-body::-webkit-scrollbar-thumb:hover,
.chat-scroll::-webkit-scrollbar-thumb:hover {
  background: rgb(74 125 189 / 55%);
}

/* ─────────── 标题栏 ─────────── */
.panel-header {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--ai-line);
  flex-shrink: 0;
}

.brand-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--ai-r-sm);
  background: linear-gradient(135deg, var(--ai-primary) 0%, var(--ai-primary-deep) 100%);
  color: #fff;
  font-size: 15px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgb(74 125 189 / 28%);
}

.header-title-group {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.header-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--ai-text-1);
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-subtitle {
  font-size: 10px;
  color: var(--ai-text-4);
  letter-spacing: 0.04em;
}

.agent-status {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 999px;
  font-weight: 600;
  border: 1px solid transparent;
  flex-shrink: 0;
  transition: all var(--ai-base) var(--ai-ease);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.agent-status--online {
  background: var(--ai-success-soft);
  color: var(--ai-success);
  border-color: rgb(106 174 138 / 32%);
}

.agent-status--busy {
  background: var(--ai-warning-soft);
  color: var(--ai-warning);
  border-color: rgb(201 164 92 / 36%);
}

.agent-status--busy .status-dot {
  animation: pulse-dot 1.4s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.35;
    transform: scale(0.75);
  }
}

.header-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--ai-r-xs);
  background: var(--ai-surface-3);
  color: var(--ai-text-3);
  cursor: pointer;
  font-size: 16px;
  transition:
    background var(--ai-fast) var(--ai-ease),
    color var(--ai-fast) var(--ai-ease);
}

.action-btn:hover {
  background: var(--ai-primary-soft);
  color: var(--ai-text-1);
}

.action-btn--danger:hover {
  background: var(--ai-danger-soft);
  color: #f0a0a0;
}

.action-btn:focus-visible {
  outline: 2px solid var(--ai-primary);
  outline-offset: 1px;
}

/* ─────────── 研判进度条 ─────────── */
.progress-strip {
  padding: 9px 14px 10px;
  border-bottom: 1px solid var(--ai-line);
  flex-shrink: 0;
}

.progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.progress-label {
  font-size: 11px;
  color: var(--ai-text-3);
}

.progress-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--ai-text-2);
  font-variant-numeric: tabular-nums;
}

.progress-track {
  height: 4px;
  background: var(--ai-surface-2);
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--ai-primary) 0%, var(--ai-accent) 100%);
  transition: width var(--ai-slow, 0.4s) var(--ai-ease);
}

.progress-fill--running {
  background-image: linear-gradient(90deg, var(--ai-primary) 0%, var(--ai-accent) 50%, var(--ai-primary) 100%);
  background-size: 200% 100%;
  animation: flow 1.6s linear infinite;
}

@keyframes flow {
  to {
    background-position: -200% 0;
  }
}

/* ─────────── 主体：信息栏 + 对话栏 ─────────── */
.ai-panel-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ─────────── 上下文摘要条 ─────────── */
.context-bar {
  flex-shrink: 0;
  border-bottom: 1px solid var(--ai-line);
}

.context-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 12px;
  border: none;
  background: var(--ai-surface);
  cursor: pointer;
  text-align: left;
  transition: background var(--ai-fast) var(--ai-ease);
}

.context-toggle:hover {
  background: var(--ai-primary-soft);
}

.context-toggle:focus-visible {
  outline: 2px solid var(--ai-primary);
  outline-offset: -2px;
}

.context-summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  flex: 1;
  min-width: 0;
}

.context-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 132px;
  padding: 2px 7px;
  border-radius: var(--ai-r-xs);
  background: var(--ai-surface-2);
  border: 1px solid var(--ai-line);
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
}

.context-chip__label {
  color: var(--ai-text-4);
  flex-shrink: 0;
}

.context-chip__value {
  color: var(--ai-text-2);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
}

.context-chip--violet {
  background: var(--ai-violet-soft);
  border-color: rgb(167 139 250 / 32%);
  color: var(--ai-violet);
}

.context-chip--green {
  background: var(--ai-success-soft);
  border-color: rgb(106 174 138 / 32%);
  color: var(--ai-success);
}

.context-chevron {
  font-size: 14px;
  color: var(--ai-text-4);
  flex-shrink: 0;
  transition: transform var(--ai-base) var(--ai-ease);
}

.context-chevron--open {
  transform: rotate(180deg);
}

/* 展开的上下文详情：限高并自身滚动，保证对话区始终保留可视空间 */
.context-body {
  max-height: 42vh;
  overflow-y: auto;
  padding: 6px 8px 8px;
  border-top: 1px solid var(--ai-line);
}

.chat-scroll {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow-y: auto;
  padding: 8px 12px;
}

/* ─────────── 折叠区块 ─────────── */
.content-section {
  margin-bottom: 6px;
  border: 1px solid var(--ai-line);
  border-radius: var(--ai-r);
  overflow: hidden;
  transition: border-color var(--ai-base) var(--ai-ease);
}

.content-section:hover {
  border-color: var(--ai-line-2);
}

.section-header-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 11px;
  background: var(--ai-surface);
  cursor: pointer;
  user-select: none;
  transition: background var(--ai-fast) var(--ai-ease);
}

.section-header-bar:hover {
  background: var(--ai-primary-soft);
}

.section-header-bar:focus-visible {
  outline: 2px solid var(--ai-primary);
  outline-offset: -2px;
}

.section-quick-title {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: var(--ai-text-2);
}

.section-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--ai-accent-soft);
  color: var(--ai-accent);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.section-badge--accent {
  background: var(--ai-primary-soft);
  color: var(--ai-accent);
}

.section-badge--green {
  background: var(--ai-success-soft);
  color: var(--ai-success);
}

.section-badge--violet {
  background: var(--ai-violet-soft);
  color: var(--ai-violet);
}

/* 折叠指示箭头：单一图标 + 旋转过渡，避免换图标导致的跳变 */
.section-chevron,
.resource-spec-chevron,
.doc-chevron,
.param-more-chevron {
  font-size: 14px;
  color: var(--ai-text-4);
  transition: transform var(--ai-base) var(--ai-ease);
  flex-shrink: 0;
}

.section-chevron--open,
.resource-spec-chevron--open,
.doc-chevron--open,
.param-more-chevron--open {
  transform: rotate(180deg);
}

.section-body {
  padding: 8px 11px 10px;
  border-top: 1px solid var(--ai-line);
}

.section-body--compact {
  padding: 6px 11px 8px;
}

/* ─────────── 参数列表（单列，窄栏下不再挤压） ─────────── */
.param-list {
  display: flex;
  flex-direction: column;
}

.param-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
  font-size: 11px;
  border-bottom: 1px solid rgb(255 255 255 / 3%);
}

.param-item:last-child {
  border-bottom: none;
}

.param-label {
  color: var(--ai-text-3);
  flex-shrink: 0;
}

.param-value {
  color: var(--ai-text-1);
  font-weight: 500;
  text-align: right;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ─────────── 全部参数折叠 ─────────── */
.param-more {
  margin-top: 4px;
}

.param-more-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px dashed var(--ai-line-2);
  border-radius: var(--ai-r-xs);
  background: transparent;
  color: var(--ai-accent);
  cursor: pointer;
  font-size: 11px;
  transition:
    border-color var(--ai-fast) var(--ai-ease),
    color var(--ai-fast) var(--ai-ease);
}

.param-more-btn:hover {
  border-color: var(--ai-primary-line);
  color: #cbe3ff;
}

/* ─────────── 装备编成卡片 ─────────── */
.resource-spec-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.resource-spec-card {
  border: 1px solid var(--ai-line-2);
  border-radius: var(--ai-r-sm);
  overflow: hidden;
  transition: border-color var(--ai-fast) var(--ai-ease);
}

.resource-spec-card:hover {
  border-color: rgb(167 139 250 / 40%);
}

.resource-spec-card--expanded {
  border-color: rgb(167 139 250 / 48%);
  background: var(--ai-violet-soft);
}

.resource-spec-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 9px;
  cursor: pointer;
  user-select: none;
  transition: background var(--ai-fast) var(--ai-ease);
}

.resource-spec-row:hover {
  background: rgb(167 139 250 / 8%);
}

.resource-spec-row:focus-visible {
  outline: 2px solid var(--ai-violet);
  outline-offset: -2px;
}

.resource-spec-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.resource-spec-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--ai-text-1);
  flex-shrink: 0;
}

.resource-spec-dims {
  flex: 1;
  font-size: 11px;
  color: var(--ai-text-3);
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}

.resource-spec-detail {
  padding: 6px 9px 7px;
  border-top: 1px solid var(--ai-line);
}

.resource-spec-model {
  font-size: 10px;
  color: var(--ai-violet);
  margin-bottom: 4px;
  opacity: 0.85;
}

.resource-attr-grid {
  display: flex;
  flex-direction: column;
}

.resource-attr-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
  font-size: 11px;
  border-bottom: 1px solid rgb(255 255 255 / 3%);
}

.resource-attr-item:last-child {
  border-bottom: none;
}

.attr-label {
  color: var(--ai-text-3);
  flex-shrink: 0;
}

.attr-value {
  color: var(--ai-text-1);
  font-weight: 500;
  text-align: right;
  white-space: nowrap;
}

/* ─────────── 战场态势 ─────────── */
.situation-chips {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 11px;
  margin: 6px 8px;
  border: 1px solid rgb(201 164 92 / 35%);
  border-radius: var(--ai-r-sm);
  background: var(--ai-warning-soft);
}

.situation-chips__label {
  font-size: 11px;
  font-weight: 600;
  color: var(--ai-text-3);
  flex-shrink: 0;
}

.situation-chip {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgb(201 164 92 / 18%);
  color: var(--ai-warning);
  border: 1px solid rgb(201 164 92 / 38%);
  font-weight: 500;
}

/* ─────────── 研判进程时间线 ─────────── */
.step-list {
  display: flex;
  flex-direction: column;
}

.step-item {
  display: flex;
  gap: 10px;
}

.step-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 20px;
  flex-shrink: 0;
}

.step-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  border: 2px solid var(--ai-line-2);
  background: var(--ai-surface-2);
  transition: all 0.3s var(--ai-ease);
}

.step-dot--success {
  border-color: rgb(106 174 138 / 60%);
  background: var(--ai-success-soft);
  color: var(--ai-success);
}

.step-dot--running {
  border-color: var(--ai-primary-line);
  background: var(--ai-primary-soft);
  box-shadow: 0 0 0 3px rgb(74 125 189 / 10%);
}

.dot-check {
  font-size: 10px;
  font-weight: 700;
}

.dot-spinner {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 2px solid var(--ai-primary-deep);
  border-top-color: transparent;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.step-line {
  flex: 1;
  width: 2px;
  min-height: 18px;
  background: var(--ai-line-2);
  margin: 4px 0;
  transition: background 0.3s var(--ai-ease);
}

.step-line--done {
  background: rgb(106 174 138 / 32%);
}

.step-body {
  flex: 1;
  padding: 2px 0 10px;
  min-width: 0;
}

.step-item:last-child .step-body {
  padding-bottom: 0;
}

.step-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.step-label {
  font-size: 12px;
  color: var(--ai-text-2);
  font-weight: 500;
  flex: 1;
}

.step-item--done .step-label {
  color: var(--ai-text-3);
}

.step-item--running .step-label {
  color: var(--ai-text-1);
  font-weight: 600;
}

.step-status-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: var(--ai-r-xs);
  font-weight: 600;
  flex-shrink: 0;
}

.tag-success {
  background: var(--ai-success-soft);
  color: var(--ai-success);
}

.tag-running {
  background: var(--ai-primary-soft);
  color: var(--ai-accent);
}

.tag-waiting {
  background: var(--ai-surface-2);
  color: var(--ai-text-4);
}

.step-tool {
  font-size: 11px;
  color: var(--ai-accent);
  margin-top: 2px;
  opacity: 0.9;
}

.step-duration {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--ai-surface-2);
  color: var(--ai-text-3);
  font-variant-numeric: tabular-nums;
}

.step-desc {
  font-size: 11px;
  color: var(--ai-text-3);
  margin-top: 2px;
  line-height: 1.5;
}

/* ─────────── 知识检索卡片 ─────────── */
.knowledge-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.knowledge-card {
  border: 1px solid var(--ai-line-2);
  border-radius: var(--ai-r-sm);
  overflow: hidden;
  transition:
    border-color var(--ai-base) var(--ai-ease),
    box-shadow var(--ai-base) var(--ai-ease);
}

.knowledge-card:hover {
  border-color: var(--ai-primary-line);
}

.knowledge-card--expanded {
  border-color: var(--ai-primary-line);
  box-shadow: 0 2px 10px rgb(74 125 189 / 10%);
}

.knowledge-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  cursor: pointer;
  background: var(--ai-surface);
  transition: background var(--ai-fast) var(--ai-ease);
  gap: 8px;
}

.knowledge-card-header:hover {
  background: var(--ai-primary-soft);
}

.knowledge-card-header:focus-visible {
  outline: 2px solid var(--ai-primary);
  outline-offset: -2px;
}

.doc-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.doc-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--ai-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-category {
  font-size: 10px;
  color: var(--ai-text-4);
}

.doc-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.doc-format {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--ai-accent-soft);
  color: var(--ai-accent);
}

.doc-match {
  font-size: 10px;
  color: var(--ai-text-3);
}

.knowledge-card-body {
  padding: 6px 10px 8px;
  border-top: 1px solid var(--ai-line);
}

.snippet-item {
  padding: 6px 0;
  border-bottom: 1px solid rgb(255 255 255 / 4%);
}

.snippet-item:last-child {
  border-bottom: none;
}

.snippet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
  gap: 8px;
}

.snippet-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--ai-accent);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snippet-score-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--ai-surface-3);
  color: var(--ai-text-2);
  font-weight: 600;
  flex-shrink: 0;
}

.snippet-text {
  font-size: 11px;
  color: var(--ai-text-3);
  line-height: 1.55;
  margin-bottom: 5px;
}

.snippet-score-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.score-track {
  flex: 1;
  height: 3px;
  background: var(--ai-surface-2);
  border-radius: 999px;
  overflow: hidden;
}

.score-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--ai-primary) 0%, var(--ai-accent) 100%);
  border-radius: 999px;
  transition: width 0.4s var(--ai-ease);
}

.score-label {
  font-size: 10px;
  color: var(--ai-text-4);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/* ─────────── 引用来源 ─────────── */
.references-section {
  padding: 2px 0 10px;
  border-bottom: 1px solid var(--ai-line);
  margin-bottom: 10px;
}

.ref-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--ai-text-3);
  margin-bottom: 6px;
}

.ref-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.ref-tag {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 5px;
  border: 1px solid transparent;
  font-weight: 500;
}

.ref-tag--doc {
  background: var(--ai-surface-2);
  color: var(--ai-text-2);
  border-color: var(--ai-line-2);
}

.ref-tag--sys {
  background: var(--ai-surface);
  color: var(--ai-text-4);
  border-color: var(--ai-line);
}

/* ─────────── 空状态引导 ─────────── */
.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 26px 12px 18px;
}

.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--ai-primary-soft);
  border: 1px solid var(--ai-primary-line);
  color: var(--ai-accent);
  font-size: 20px;
  margin-bottom: 10px;
}

.empty-title {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ai-text-1);
}

.empty-desc {
  margin: 0 0 14px;
  font-size: 11px;
  color: var(--ai-text-3);
  line-height: 1.6;
  max-width: 260px;
}

.quick-asks {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}

.quick-ask {
  padding: 5px 11px;
  border: 1px solid var(--ai-primary-line);
  border-radius: 999px;
  background: var(--ai-primary-soft);
  color: var(--ai-accent);
  font-size: 11px;
  cursor: pointer;
  transition:
    background var(--ai-fast) var(--ai-ease),
    color var(--ai-fast) var(--ai-ease),
    transform var(--ai-fast) var(--ai-ease);
}

.quick-ask:hover {
  background: rgb(74 125 189 / 22%);
  color: #cbe3ff;
  transform: translateY(-1px);
}

.quick-ask:focus-visible {
  outline: 2px solid var(--ai-primary);
  outline-offset: 1px;
}

/* ─────────── 对话消息 ─────────── */
.chat-messages {
  margin-top: 2px;
}

.chat-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 2px 0 8px;
}

.chat-divider::before,
.chat-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--ai-line);
}

.chat-divider span {
  font-size: 10px;
  color: var(--ai-text-4);
  letter-spacing: 0.06em;
}

.chat-msg {
  display: flex;
  gap: 8px;
  padding: 5px 0;
  align-items: flex-start;
}

.chat-msg--user {
  flex-direction: row-reverse;
}

.msg-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  flex-shrink: 0;
  font-size: 13px;
  border: 1px solid var(--ai-line-2);
}

.msg-avatar--assistant {
  background: var(--ai-primary-soft);
  color: var(--ai-accent);
  border-color: var(--ai-primary-line);
}

.msg-avatar--user {
  background: var(--ai-surface-3);
  color: var(--ai-text-2);
}

.msg-bubble {
  font-size: 12px;
  padding: 7px 11px;
  border-radius: var(--ai-r);
  max-width: calc(100% - 40px);
  line-height: 1.6;
  word-break: break-word;
}

.msg-bubble--assistant {
  background: var(--ai-surface-2);
  color: var(--ai-text-2);
  border: 1px solid var(--ai-line);
  border-top-left-radius: 3px;
}

.msg-bubble--user {
  background: linear-gradient(135deg, var(--ai-primary) 0%, var(--ai-primary-deep) 100%);
  color: #fff;
  border-top-right-radius: 3px;
}

/* 流式输出光标 */
.stream-caret {
  display: inline-block;
  width: 2px;
  height: 12px;
  margin-left: 2px;
  vertical-align: text-bottom;
  background: var(--ai-accent);
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

.thinking {
  color: var(--ai-text-3);
}

/* ─────────── 输入区 ─────────── */
.chat-input-area {
  padding: 10px 14px;
  border-top: 1px solid var(--ai-line);
  flex-shrink: 0;
  background: var(--ai-solid);
}

.chat-input-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
}

.chat-input {
  flex: 1;
  min-width: 0;
  padding: 9px 12px;
  border: 1px solid var(--ai-line-2);
  border-radius: var(--ai-r);
  background: var(--ai-surface-2);
  color: var(--ai-text-1);
  font-size: 12px;
  outline: none;
  transition:
    border-color var(--ai-base) var(--ai-ease),
    box-shadow var(--ai-base) var(--ai-ease);
}

.chat-input::placeholder {
  color: var(--ai-text-4);
}

.chat-input:focus {
  border-color: var(--ai-primary-line);
  box-shadow: 0 0 0 3px rgb(74 125 189 / 12%);
}

.chat-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: var(--ai-r);
  background: linear-gradient(135deg, var(--ai-primary) 0%, var(--ai-primary-deep) 100%);
  color: #fff;
  cursor: pointer;
  font-size: 16px;
  transition:
    opacity var(--ai-fast) var(--ai-ease),
    transform var(--ai-fast) var(--ai-ease),
    background var(--ai-fast) var(--ai-ease);
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  opacity: 0.92;
  transform: scale(1.04);
}

.send-btn:active:not(:disabled) {
  transform: scale(0.96);
}

.send-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.send-btn--stop {
  background: var(--ai-danger-soft);
  color: #f0a0a0;
  border: 1px solid rgb(194 91 91 / 40%);
}

.send-btn:focus-visible {
  outline: 2px solid var(--ai-primary);
  outline-offset: 2px;
}

/* ─────────── Markdown 渲染 ─────────── */
.chat-md :deep(p) {
  margin: 0 0 6px;
}

.chat-md :deep(p:last-child) {
  margin-bottom: 0;
}

.chat-md :deep(strong) {
  color: var(--ai-text-1);
  font-weight: 600;
}

.chat-md :deep(ul),
.chat-md :deep(ol) {
  margin: 4px 0 6px;
  padding-left: 18px;
}

.chat-md :deep(li) {
  margin: 2px 0;
}

.chat-md :deep(code) {
  background: var(--ai-surface-3);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 11px;
  font-family: 'Consolas', monospace;
}

.chat-md :deep(pre) {
  background: rgb(0 0 0 / 35%);
  border: 1px solid var(--ai-line-2);
  border-radius: var(--ai-r-xs);
  padding: 8px 10px;
  overflow-x: auto;
  margin: 6px 0;
}

.chat-md :deep(pre code) {
  background: transparent;
  padding: 0;
}

.chat-md :deep(table) {
  border-collapse: separate;
  border-spacing: 0;
  margin: 6px 0;
  font-size: 11px;
  width: 100%;
  border: 1px solid var(--ai-line-2);
  border-radius: var(--ai-r-xs);
  overflow: hidden;
}

.chat-md :deep(th),
.chat-md :deep(td) {
  padding: 5px 9px;
  text-align: left;
  border-bottom: 1px solid var(--ai-line);
}

.chat-md :deep(th) {
  background: var(--ai-primary-soft);
  color: var(--ai-accent);
  font-weight: 600;
  white-space: nowrap;
}

.chat-md :deep(td) {
  color: var(--ai-text-2);
}

.chat-md :deep(tbody tr:last-child td) {
  border-bottom: none;
}

.chat-md :deep(tbody tr:hover td) {
  background: var(--ai-surface-2);
}

.chat-md :deep(blockquote) {
  margin: 6px 0;
  padding: 4px 10px;
  border-left: 3px solid var(--ai-warning);
  background: var(--ai-warning-soft);
  border-radius: 0 var(--ai-r-xs) var(--ai-r-xs) 0;
  color: var(--ai-text-2);
}

.chat-md :deep(h1),
.chat-md :deep(h2),
.chat-md :deep(h3),
.chat-md :deep(h4) {
  font-size: 13px;
  margin: 8px 0 4px;
  color: var(--ai-text-1);
}

.chat-md :deep(hr) {
  border: none;
  border-top: 1px solid var(--ai-line);
  margin: 8px 0;
}
</style>
