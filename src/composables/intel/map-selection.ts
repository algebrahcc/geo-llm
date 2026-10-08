/**
 * 选区 → 研判输入（纯函数，不依赖 Cesium，便于单测）
 *
 * 输入是「场景要素」（由 use-cesium-region-select 从 Cesium 实体读出），输出是研判需要的三样东西：
 *   证据   —— 进入上下文包、供结论引用与地图高亮
 *   目标   —— 可判通过性的路口/桥梁/道路/街区
 *   路网图 —— 从线要素几何反推（端点为节点），用于关键节点与断堵卡风险
 *
 * 属性名做常见别名兜底（width/load/slope/roadType 等）：数据侧的命名差异不该导致
 * 一项都算不出来——算不出来时界面只能显示「属性缺失」，评审时无法解释。
 */

import type { PassTarget, PassTargetAttrs, PassTargetKind } from './passability';
import type { RoadEdge, RoadNode } from './route-critical-nodes';
import type { Bounds, EvidenceSource } from './situation-brief';
import type { GeoLocated } from './situation-engine';

export interface SceneFeature {
  id: string;
  layerName: string;
  name: string;
  kind: 'point' | 'line' | 'polygon';
  /** 全部顶点经纬度（点要素为单点） */
  vertices: Array<[number, number]>;
  attrs: Record<string, string | number>;
}

export interface RegionSelection {
  name: string;
  bounds: Bounds;
  areaKm2: number;
  evidences: EvidenceSource[];
  targets: Array<PassTarget & GeoLocated>;
  roadNodes: Array<RoadNode & GeoLocated>;
  roadEdges: RoadEdge[];
}

export interface BuildSelectionInput {
  name: string;
  bounds: Bounds;
  areaKm2: number;
  features: SceneFeature[];
}

const KIND_ALIASES: Record<string, PassTargetKind> = {
  road: 'road',
  street: 'road',
  道路: 'road',
  bridge: 'bridge',
  桥梁: 'bridge',
  intersection: 'intersection',
  junction: 'intersection',
  路口: 'intersection',
  block: 'block',
  街区: 'block'
};

/** 按别名取数值属性（宽/限重/坡度等命名差异很常见） */
function numberAttr(attrs: Record<string, string | number>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = attrs[key];
    if (value === undefined) continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function textAttr(attrs: Record<string, string | number>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = attrs[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return undefined;
}

/** 目标属性映射（含别名兜底） */
export function toPassTargetAttrs(attrs: Record<string, string | number>): PassTargetAttrs {
  return {
    widthM: numberAttr(attrs, ['widthM', 'width', 'roadWidth', 'width_m']),
    loadLimitT: numberAttr(attrs, ['loadLimitT', 'loadLimit', 'load', 'load_limit_t']),
    slopeDeg: numberAttr(attrs, ['slopeDeg', 'slope', 'slope_deg']),
    surface: textAttr(attrs, ['surface', 'roadType', 'road_type', 'pavement']),
    obstacleCount: numberAttr(attrs, ['obstacleCount', 'obstacles', 'obstacle_count'])
  };
}

/** 目标类型推断：显式 kind 优先，其次按属性特征判断，最后按几何类型 */
export function inferTargetKind(
  attrs: Record<string, string | number>,
  geometryKind: SceneFeature['kind']
): PassTargetKind | null {
  for (const key of ['kind', 'type', 'category']) {
    const raw = attrs[key];
    if (typeof raw === 'string') {
      const mapped = KIND_ALIASES[raw] ?? KIND_ALIASES[raw.toLowerCase()];
      if (mapped) return mapped;
    }
  }
  if (numberAttr(attrs, ['loadLimitT', 'loadLimit', 'load']) !== undefined) return 'bridge';
  if (numberAttr(attrs, ['obstacleCount', 'obstacles']) !== undefined) return 'block';
  if (geometryKind === 'line') return 'road';
  if (numberAttr(attrs, ['lanes']) !== undefined) return 'intersection';
  return null;
}

function isInside(vertex: [number, number], bounds: Bounds): boolean {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  return vertex[0] >= minLon && vertex[0] <= maxLon && vertex[1] >= minLat && vertex[1] <= maxLat;
}

function representativePoint(feature: SceneFeature): [number, number] {
  const total = feature.vertices.reduce<[number, number]>(
    (sum, vertex) => [sum[0] + vertex[0], sum[1] + vertex[1]],
    [0, 0]
  );
  const count = feature.vertices.length || 1;
  return [total[0] / count, total[1] / count];
}

/**
 * 从线要素几何反推路网图。
 *
 * 节点 id 用坐标取整到 1e-5 度（约 1m）：同一路口的多条道路端点在数据里必然是同一坐标，
 * 用坐标做 id 才能让它们合并成同一个节点——这正是能算出割点与枢纽的前提。
 */
function nodeId(vertex: [number, number]): string {
  return `n${vertex[0].toFixed(5)},${vertex[1].toFixed(5)}`;
}

export function buildSelection(input: BuildSelectionInput): RegionSelection {
  const evidences: EvidenceSource[] = [];
  const targets: Array<PassTarget & GeoLocated> = [];
  const nodeMap = new Map<string, RoadNode & GeoLocated>();
  const edges: RoadEdge[] = [];

  input.features.forEach(feature => {
    const inside = feature.vertices.some(vertex => isInside(vertex, input.bounds));
    if (!inside) return;

    const [lon, lat] = representativePoint(feature);
    evidences.push({
      id: feature.id,
      layerId: feature.layerName,
      layerName: feature.layerName,
      kind: feature.kind,
      label: feature.name,
      lon,
      lat,
      attrs: { ...feature.attrs }
    });

    const kind = inferTargetKind(feature.attrs, feature.kind);
    if (kind) {
      targets.push({
        id: feature.id,
        kind,
        name: feature.name,
        attrs: toPassTargetAttrs(feature.attrs),
        lon,
        lat
      });
    }

    // 线要素 → 路网边与节点（端点坐标即节点）
    if (feature.kind === 'line' && feature.vertices.length >= 2) {
      const first = feature.vertices[0];
      const last = feature.vertices[feature.vertices.length - 1];
      const fromId = nodeId(first);
      const toId = nodeId(last);
      if (fromId === toId) return; // 闭环自环对连通性判定没有意义
      const nodeAttrs = {
        lanes: numberAttr(feature.attrs, ['lanes', 'laneCount']),
        dailyFlow: numberAttr(feature.attrs, ['dailyFlow', 'flow', 'traffic']),
        widthM: numberAttr(feature.attrs, ['widthM', 'width'])
      };
      if (!nodeMap.has(fromId)) {
        nodeMap.set(fromId, { id: fromId, name: feature.name, attrs: nodeAttrs, lon: first[0], lat: first[1] });
      }
      if (!nodeMap.has(toId)) {
        nodeMap.set(toId, { id: toId, name: feature.name, attrs: nodeAttrs, lon: last[0], lat: last[1] });
      }
      edges.push({ id: `${fromId}->${toId}`, from: fromId, to: toId, attrs: { name: feature.name } });
    }
  });

  return {
    name: input.name,
    bounds: input.bounds,
    areaKm2: input.areaKm2,
    evidences,
    targets,
    roadNodes: [...nodeMap.values()],
    roadEdges: edges
  };
}
