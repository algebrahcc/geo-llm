/**
 * 研判编排（规则通道）：上下文包 + 路网 + 车型 → 四类结构化结论
 *
 * 分工原则（取自公开的军方媒体分析：由智能模型把指令转成机器语言、由传统规划算法做逻辑校验）：
 *   - 本模块负责**算**：通过性、关键节点、断堵卡风险、临机通路适宜等级，全部可复算；
 *   - 大模型负责**讲与疑**：把这些结论归纳成叙述、指出假设与薄弱点（见研判面板的 LLM 通道）。
 *
 * 规则通道产出的 items 同时作为「规则基线」，用于度量模型通道的一致率与引用命中率。
 */

import { judgePassability, type PassLevel, type PassTarget, type VehicleType } from './passability';
import {
  analyzeCriticalNodes,
  assessBypassSuitability,
  assessRoadRisks,
  type RoadEdge,
  type RoadNode
} from './route-critical-nodes';
import type { ConclusionOverlay, JudgementItem, SituationBrief, SituationConclusion } from './situation-brief';

/** 带坐标的节点/目标（选区侧会补上，用于结论落图） */
export interface GeoLocated {
  lon?: number;
  lat?: number;
}

export interface SituationInput {
  brief: SituationBrief;
  targets: Array<PassTarget & GeoLocated>;
  roadNodes: Array<RoadNode & GeoLocated>;
  roadEdges: RoadEdge[];
  vehicle: VehicleType;
}

export interface SituationRunResult {
  conclusion: SituationConclusion;
  /** 规则基线结论（供模型通道比对一致率） */
  facts: JudgementItem[];
  /** 规则通道耗时（毫秒）—— 实时性口径中的「计算」部分 */
  durationMs: number;
}

const PASS_LEVEL_TEXT: Record<PassLevel, string> = {
  passable: '可通行',
  restricted: '受限通行',
  impassable: '不可通行'
};

const RISK_LEVEL_TEXT: Record<'high' | 'medium' | 'low', string> = { high: '高', medium: '中', low: '低' };

/** 要素密度（个/km²）达到该值时视为建成度极高、可作业面趋近于 0 */
const DENSE_EVIDENCE_PER_KM2 = 400;

/** 关键节点最多列出的条数（面板要能读得完） */
const MAX_CRITICAL_NODES = 5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 开阔度代理指标。
 *
 * 没有 DEM 时用「要素密度」反推：情报/路网要素越密，说明建成度越高、可展开工程作业的面越小。
 * 这是代理量而非实测地形量，故在结论依据里不把它写成地形实测值。
 */
function estimateOpenness(brief: SituationBrief): number {
  const area = brief.region.areaKm2 > 0 ? brief.region.areaKm2 : 1;
  return clamp(1 - brief.evidences.length / area / DENSE_EVIDENCE_PER_KM2, 0, 1);
}

/** 邻域障碍物数量：带 obstacleCount 属性的要素按数量累加，情报类要素按 1 计 */
function countObstacles(brief: SituationBrief): number {
  return brief.evidences.reduce((total, item) => {
    const raw = item.attrs.obstacleCount;
    if (raw !== undefined) {
      const value = Number(raw);
      return total + (Number.isFinite(value) ? value : 0);
    }
    return item.layerName.includes('情报') ? total + 1 : total;
  }, 0);
}

/** 跑规则通道，产出四类结论与可落图要素 */
export function runRuleEngine(input: SituationInput): SituationRunResult {
  const startedAt = performance.now();
  const items: JudgementItem[] = [];
  const overlays: ConclusionOverlay[] = [];

  // ① 通过性（条款 (7)）：目标来自选区内要素，结论逐条引用其 id
  input.targets.forEach(target => {
    const result = judgePassability(target, input.vehicle);
    items.push({
      topic: 'passability',
      targetId: target.id,
      level: PASS_LEVEL_TEXT[result.level],
      conclusion: result.conclusion,
      evidenceIds: [target.id],
      confidence: result.confidence
    });
    if (target.lon !== undefined && target.lat !== undefined) {
      overlays.push({
        type: 'point',
        positions: [[target.lon, target.lat]],
        label: `${target.name ?? target.id}：${PASS_LEVEL_TEXT[result.level]}`,
        targetId: target.id
      });
    }
  });

  // ② 关键节点（条款 (8) 前半）
  const criticalities = analyzeCriticalNodes(input.roadNodes, input.roadEdges);
  const nodeById = new Map(input.roadNodes.map(node => [node.id, node]));
  criticalities
    .filter(item => item.articulation || item.degree >= 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CRITICAL_NODES)
    .forEach(item => {
      items.push({
        topic: 'critical-node',
        targetId: item.nodeId,
        level: item.articulation ? '关键（割点）' : '重要（枢纽）',
        conclusion: `${item.name ?? item.nodeId} 为路网关键节点，关键度 ${item.score}`,
        evidenceIds: [item.nodeId],
        confidence: 0.85
      });
    });

  // ③ 断 / 堵 / 卡风险（条款 (8) 中段）
  const risks = assessRoadRisks(input.roadNodes, input.roadEdges);
  risks.forEach(risk => {
    items.push({
      topic: 'risk',
      targetId: risk.nodeId,
      level: RISK_LEVEL_TEXT[risk.level],
      conclusion: risk.conclusion,
      evidenceIds: [risk.nodeId],
      confidence: risk.confidence
    });
    const node = nodeById.get(risk.nodeId);
    if (node?.lon !== undefined && node.lat !== undefined) {
      overlays.push({
        type: 'point',
        positions: [[node.lon, node.lat]],
        label: `${risk.conclusion}（${risk.reasons[0] ?? ''}）`,
        targetId: risk.nodeId
      });
    }
  });

  // ④ 临机开设通路适宜等级（条款 (8) 后半）：取关键度最高的节点作为候选开设位置
  const primary = [...criticalities].sort((a, b) => b.score - a.score)[0];
  if (primary) {
    const assessment = assessBypassSuitability(primary.nodeId, {
      openness: estimateOpenness(input.brief),
      // 在既有节点附近开设通路，与既有路网的衔接距离按节点本体计（无需另修进出路）
      distanceToRoadM: 0,
      obstacleCount: countObstacles(input.brief)
    });
    items.push({
      topic: 'bypass',
      targetId: primary.nodeId,
      level: `${assessment.level}（${assessment.score}）`,
      conclusion: `${primary.name ?? primary.nodeId} 临近区域临机开设通路适宜等级：${assessment.level}`,
      evidenceIds: [primary.nodeId],
      confidence: 0.75
    });
  }

  return {
    conclusion: { items, overlays },
    facts: items.map(item => ({ ...item, evidenceIds: [...item.evidenceIds] })),
    durationMs: Math.round(performance.now() - startedAt)
  };
}
