/**
 * 路网关键节点与通行风险（一期条款 (8)：分析关键节点、预判断堵卡风险、研判临机开设通路适宜等级）
 *
 * 三种风险的判据刻意区分开，避免把「枢纽」与「单点」混为一谈：
 *   断（cut）   结构性单点：失效即导致路网连通性下降（割点）
 *   堵（block） 流量集中但结构上可绕行（度数高且非割点）
 *   卡（choke） 两者兼具：既断又堵，优先级最高
 *
 * 全部为图论/几何计算，纯函数、可复算——大模型只负责把结论讲成人话（见研判面板）。
 */

export interface RoadNode {
  id: string;
  name?: string;
  /** 节点类型（路口/桥梁等），仅用于文案 */
  kind?: string;
  attrs: {
    /** 车道数 */
    lanes?: number;
    /** 日交通量（辆/日） */
    dailyFlow?: number;
    widthM?: number;
  };
}

export interface RoadEdge {
  id: string;
  from: string;
  to: string;
  attrs?: { name?: string; lengthM?: number };
}

export interface NodeCriticality {
  nodeId: string;
  name?: string;
  /** 度数：连接的道路数 */
  degree: number;
  /** 割点：移除此节点会使路网连通分量增加 */
  articulation: boolean;
  /** 综合关键度 0-1（割点权重高于度数） */
  score: number;
  reasons: string[];
}

export type RiskKind = 'cut' | 'block' | 'choke';

export interface RoadRisk {
  nodeId: string;
  kind: RiskKind;
  level: 'high' | 'medium' | 'low';
  conclusion: string;
  reasons: string[];
  confidence: number;
}

export interface BypassTerrain {
  /** 地形开阔度 0-1（1 最开阔，便于展开工程作业） */
  openness: number;
  /** 距既有道路距离（米）：越近越便于衔接 */
  distanceToRoadM: number;
  /** 临近区域障碍物数量（清障工作量） */
  obstacleCount: number;
}

export interface BypassAssessment {
  nodeId: string;
  /** 适宜等级：优 / 良 / 中 / 差 / 劣 */
  level: string;
  score: number;
  reasons: string[];
}

/** 判为「高连接度」的度数阈值（枢纽） */
const HUB_DEGREE = 4;

const RISK_LABEL: Record<RiskKind, string> = { cut: '断', block: '堵', choke: '卡' };

function buildAdjacency(nodes: RoadNode[], edges: RoadEdge[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  nodes.forEach(node => adjacency.set(node.id, new Set()));
  edges.forEach(edge => {
    if (!adjacency.has(edge.from) || !adjacency.has(edge.to)) return; // 挂空边的脏数据直接忽略
    adjacency.get(edge.from)?.add(edge.to);
    adjacency.get(edge.to)?.add(edge.from);
  });
  return adjacency;
}

/** 连通分量数（可排除某个节点，用于割点判定） */
function countComponents(adjacency: Map<string, Set<string>>, exclude?: string): number {
  const visited = new Set<string>(exclude ? [exclude] : []);
  let components = 0;
  adjacency.forEach((_neighbors, id) => {
    if (visited.has(id)) return;
    components += 1;
    const queue = [id];
    visited.add(id);
    while (queue.length > 0) {
      const current = queue.shift() as string;
      adjacency.get(current)?.forEach(next => {
        if (visited.has(next)) return;
        visited.add(next);
        queue.push(next);
      });
    }
  });
  return components;
}

/**
 * 节点关键度：度数 + 割点。
 *
 * 割点用「移除后连通分量是否增加」暴力判定：路网规模在千级以内，暴力比维护
 * Tarjan 算法更不容易出错，且判定过程与要写在结论里的依据完全一致（可解释）。
 */
export function analyzeCriticalNodes(nodes: RoadNode[], edges: RoadEdge[]): NodeCriticality[] {
  if (nodes.length === 0) return [];
  const adjacency = buildAdjacency(nodes, edges);
  const base = countComponents(adjacency);
  const maxDegree = Math.max(...[...adjacency.values()].map(item => item.size), 1);

  return nodes.map(node => {
    const degree = adjacency.get(node.id)?.size ?? 0;
    const articulation = degree > 0 && countComponents(adjacency, node.id) > base;
    const reasons: string[] = [`连接 ${degree} 条道路`];
    if (articulation) {
      reasons.push('为割点：该节点失效将使路网连通分量增加，两翼无法互通');
    }
    const score = (articulation ? 0.6 : 0) + 0.4 * (degree / maxDegree);
    return {
      nodeId: node.id,
      name: node.name,
      degree,
      articulation,
      score: Math.round(score * 100) / 100,
      reasons
    };
  });
}

/** 断/堵/卡风险清单（按等级与关键度排序） */
export function assessRoadRisks(nodes: RoadNode[], edges: RoadEdge[]): RoadRisk[] {
  const criticalities = analyzeCriticalNodes(nodes, edges);
  const risks: RoadRisk[] = [];

  criticalities.forEach(item => {
    const isHub = item.degree >= HUB_DEGREE;
    if (!item.articulation && !isHub) return;

    const kind: RiskKind = item.articulation && isHub ? 'choke' : item.articulation ? 'cut' : 'block';
    const reasons = [...item.reasons];
    if (isHub) {
      reasons.push(`度数 ${item.degree} 达到枢纽阈值 ${HUB_DEGREE}，通行流量集中`);
    }
    const level: RoadRisk['level'] =
      kind === 'cut' || kind === 'choke' ? 'high' : item.degree > HUB_DEGREE ? 'high' : 'medium';
    const tail = kind === 'cut' ? '存在断的风险' : kind === 'block' ? '存在堵的风险' : '既可能断也可能堵（卡）';
    risks.push({
      nodeId: item.nodeId,
      kind,
      level,
      conclusion: `${item.name ?? item.nodeId}（${RISK_LABEL[kind]}）${tail}`,
      reasons,
      confidence: kind === 'choke' ? 0.9 : 0.8
    });
  });

  const severity: Record<RoadRisk['level'], number> = { high: 2, medium: 1, low: 0 };
  const scoreById = new Map(criticalities.map(item => [item.nodeId, item.score]));
  return risks.sort(
    (a, b) => severity[b.level] - severity[a.level] || (scoreById.get(b.nodeId) ?? 0) - (scoreById.get(a.nodeId) ?? 0)
  );
}

const BYPASS_LEVELS: Array<{ min: number; level: string }> = [
  { min: 0.85, level: '优' },
  { min: 0.7, level: '良' },
  { min: 0.5, level: '中' },
  { min: 0.3, level: '差' },
  { min: 0, level: '劣' }
];

/**
 * 临机开设通路适宜等级。
 *
 * 权重口径：地形开阔度 0.5（决定能否展开作业）、距既有道路 0.3（决定衔接代价）、
 * 障碍物 0.2（决定清障量）。三项都可从选区内的地形/路网/情报要素直接算出来。
 */
export function assessBypassSuitability(nodeId: string, terrain: BypassTerrain): BypassAssessment {
  const openness = Math.min(Math.max(terrain.openness, 0), 1);
  const proximity = Math.min(Math.max(1 - terrain.distanceToRoadM / 1000, 0), 1);
  const obstaclePenalty = Math.min(Math.max(terrain.obstacleCount / 4, 0), 1);
  const score = 0.5 * openness + 0.3 * proximity + 0.2 * (1 - obstaclePenalty);
  const rounded = Math.round(score * 100) / 100;
  const level = BYPASS_LEVELS.find(item => rounded >= item.min)?.level ?? '劣';

  const reasons = [
    `地形开阔度 ${openness.toFixed(2)}，${openness >= 0.6 ? '可展开工程作业' : '作业面受限，需先平整'}`,
    `距既有道路 ${Math.round(terrain.distanceToRoadM)}m，${
      terrain.distanceToRoadM <= 200 ? '衔接代价低' : '需新修进出路'
    }`,
    terrain.obstacleCount > 0 ? `临近区域 ${terrain.obstacleCount} 处障碍物，需先清障` : '临近区域未检出障碍物'
  ];
  return { nodeId, level, score: rounded, reasons };
}
