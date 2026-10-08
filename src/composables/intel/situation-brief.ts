/**
 * 研判上下文装配：地图选区内的要素 → 结构化上下文包 → 结构化结论
 *
 * 为什么要「装配」而不是把图层数据整包丢给大模型：
 * 1. 体量：一个选区内可能有成百上千个要素，全量坐标会直接打爆 token 与时延；
 * 2. 可溯源：结论必须能指回具体要素，因此上下文里给的是「要素 ID + 属性摘要」，
 *    结论只允许引用这些 ID（引用命中率由此可测）；
 * 3. 分工：数值与几何一律在规则模块算（见 passability / route-critical-nodes），
 *    大模型只做归纳、叙述与质疑，避免它「空想」出无法复算的数字。
 *
 * 本模块只做纯函数装配，不依赖 Cesium / 网络，便于单测与复用。
 */

/** 经纬度范围 [minLon, minLat, maxLon, maxLat] */
export type Bounds = [number, number, number, number];

export type EvidenceKind = 'point' | 'line' | 'polygon';

/** 候选要素（由 Cesium 图层侧产出；只保留装配需要的字段） */
export interface EvidenceSource {
  /** 稳定 id（图层 id + 索引），结论引用它 */
  id: string;
  layerId: string;
  layerName: string;
  kind: EvidenceKind;
  label: string;
  /** 代表点经纬度：点取自身，线与面取首点/质心 */
  lon: number;
  lat: number;
  attrs: Record<string, string | number>;
}

/** 进入上下文包的要素 */
export interface Evidence extends EvidenceSource {}

export interface VehicleInfo {
  type: 'wheeled' | 'tracked';
  label: string;
}

export type JudgementTopic = 'passability' | 'critical-node' | 'risk' | 'bypass';

/** 逐项研判结论（可溯源是硬约束：evidenceIds 必须指向上下文包里的要素） */
export interface JudgementItem {
  topic: JudgementTopic;
  targetId: string;
  level: string;
  conclusion: string;
  evidenceIds: string[];
  confidence: number;
}

/** 可标绘的补充要素（经纬度点序列，与既有的标绘契约同构） */
export interface ConclusionOverlay {
  type: 'point' | 'line' | 'polygon';
  positions: Array<[number, number]>;
  label?: string;
  /** 归属的结论目标 id：结论卡与地图要素靠它一一对应（用 label 匹配会因文案变化而失配） */
  targetId?: string;
}

export interface SituationConclusion {
  items: JudgementItem[];
  overlays: ConclusionOverlay[];
  reportHtml?: string;
}

export interface BriefRegion {
  name: string;
  bounds: Bounds;
  /** 选区面积（平方公里） */
  areaKm2: number;
}

export interface LayerSummary {
  layerId: string;
  name: string;
  featureCount: number;
  summary: string;
}

export interface SituationBrief {
  region: BriefRegion;
  layers: LayerSummary[];
  evidences: Evidence[];
  vehicle: VehicleInfo;
  /** 规则侧已算出的结构化事实，供大模型归纳（不含坐标，体积可控） */
  facts: JudgementItem[];
  /** 是否因超限截断（截断必须在上下文里显式标注，不能让模型以为拿到了全量） */
  truncated: boolean;
}

export type DecisionReview = 'pending' | 'accepted' | 'rejected';

/** 决策日志条目：谁在什么条件下得出什么结论、是否复核（可追溯性要求） */
export interface DecisionLogEntry {
  id: string;
  time: string;
  /** 触发条件（选区/车型/模型等快照） */
  trigger: string;
  region: string;
  vehicle: string;
  conclusionCount: number;
  citationHitRate: number;
  reviewed: DecisionReview;
}

export interface BriefInput {
  region: { name: string; bounds: Bounds };
  evidences: EvidenceSource[];
  vehicle: VehicleInfo;
  facts?: JudgementItem[];
  /** 进入上下文包的要素上限（默认 40） */
  limit?: number;
}

/** 进入上下文包的要素上限：够用且不会把 token 打满 */
export const MAX_EVIDENCES = 40;

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * 选区面积（球面近似）。
 *
 * 用球面公式而不是平面近似：高纬地区同样的经纬跨度对应面积小得多（选区可能在台北、
 * 也可能在高纬），平面近似会把面积算大一倍以上，直接影响研判时的地形判断。
 */
export function regionAreaKm2(bounds: Bounds): number {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const deltaLon = toRadians(Math.abs(maxLon - minLon));
  const deltaSinLat = Math.sin(toRadians(Math.abs(maxLat))) - Math.sin(toRadians(Math.abs(minLat)));
  return Math.abs(EARTH_RADIUS_KM ** 2 * deltaLon * deltaSinLat);
}

function inBounds(source: EvidenceSource, bounds: Bounds): boolean {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  return source.lon >= minLon && source.lon <= maxLon && source.lat >= minLat && source.lat <= maxLat;
}

/** 重要度：显式 importance 优先，其次置信度，都没有按 0（此时按 id 稳定排序） */
function importance(item: EvidenceSource): number {
  const raw = item.attrs.importance ?? item.attrs.confidence ?? 0;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

/**
 * 收集选区内的要素并截断。
 *
 * 排序用「重要度降序 + id 升序」：同一选区、同一图层集合必须得到同一份上下文，
 * 否则每次研判的输入都在变，结论差异无法归因（稳定性也无法度量）。
 */
export function collectEvidences(sources: EvidenceSource[], bounds: Bounds, limit: number = MAX_EVIDENCES): Evidence[] {
  return sources
    .filter(source => inBounds(source, bounds))
    .slice()
    .sort((a, b) => importance(b) - importance(a) || a.id.localeCompare(b.id))
    .slice(0, Math.max(limit, 0))
    .map(source => ({ ...source, attrs: { ...source.attrs } }));
}

function summarizeLayers(evidences: Evidence[], total: number, limit: number): LayerSummary[] {
  const grouped = new Map<string, { name: string; count: number }>();
  evidences.forEach(item => {
    const current = grouped.get(item.layerId);
    if (current) {
      current.count += 1;
    } else {
      grouped.set(item.layerId, { name: item.layerName, count: 1 });
    }
  });
  const tail = total > limit ? `（共 ${total} 个，已截断至 ${limit}）` : '';
  return [...grouped.entries()]
    .map(([layerId, info]) => ({
      layerId,
      name: info.name,
      featureCount: info.count,
      summary: `${info.count} 个要素${tail}`
    }))
    .sort((a, b) => b.featureCount - a.featureCount || a.layerId.localeCompare(b.layerId));
}

/** 装配研判上下文包 */
export function assembleBrief(input: BriefInput): SituationBrief {
  const limit = input.limit ?? MAX_EVIDENCES;
  const inRegion = input.evidences.filter(source => inBounds(source, input.region.bounds));
  const evidences = collectEvidences(input.evidences, input.region.bounds, limit);
  return {
    region: {
      name: input.region.name,
      bounds: input.region.bounds,
      areaKm2: Math.round(regionAreaKm2(input.region.bounds) * 100) / 100
    },
    layers: summarizeLayers(evidences, inRegion.length, limit),
    evidences,
    vehicle: input.vehicle,
    facts: input.facts ?? [],
    truncated: inRegion.length > limit
  };
}

/**
 * 引用命中率：结论引用的要素在上下文包里真实存在的比例。
 *
 * 这是「可追溯性」的可测口径（取自军方媒体对大模型参谋系统的评价维度）：
 * 命中率低说明模型在编造依据，界面必须把它显示出来，而不是只展示结论正文。
 */
export function citationHitRate(items: JudgementItem[], brief: SituationBrief): number {
  const known = new Set(brief.evidences.map(item => item.id));
  let cited = 0;
  let hit = 0;
  items.forEach(item => {
    item.evidenceIds.forEach(id => {
      cited += 1;
      if (known.has(id)) hit += 1;
    });
  });
  return cited === 0 ? 0 : hit / cited;
}

/** 结论与规则基线的一致率（准确性口径）：比对同一目标上的等级是否一致 */
export function ruleAgreementRate(items: JudgementItem[], facts: JudgementItem[]): number {
  const baseline = new Map(facts.map(item => [`${item.topic}:${item.targetId}`, item.level]));
  const comparable = items.filter(item => baseline.has(`${item.topic}:${item.targetId}`));
  if (comparable.length === 0) return 0;
  const agreed = comparable.filter(item => baseline.get(`${item.topic}:${item.targetId}`) === item.level);
  return agreed.length / comparable.length;
}
