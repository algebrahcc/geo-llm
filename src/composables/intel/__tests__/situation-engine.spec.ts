import { describe, expect, it } from 'vitest';
import { runRuleEngine } from '../situation-engine';
import { assembleBrief, citationHitRate, ruleAgreementRate, type EvidenceSource } from '../situation-brief';
import type { RoadEdge, RoadNode } from '../route-critical-nodes';
import type { PassTarget } from '../passability';

function source(id: string, attrs: Record<string, string | number> = {}): EvidenceSource {
  return { id, layerId: 'road', layerName: '交通路网', kind: 'point', label: id, lon: 10.2, lat: 20.2, attrs };
}

const BRIEF = assembleBrief({
  region: { name: '研判区', bounds: [10, 20, 11, 21] },
  evidences: [source('n1', { obstacleCount: 2 }), source('n2'), source('n3')],
  vehicle: { type: 'tracked', label: '履带车辆' }
});

const TARGETS: Array<PassTarget & { lon: number; lat: number }> = [
  // 4.5m 窄路：轮式（最小 4m）可通行，履带（最小 5m）不可通行 —— 用于验证车型差异
  { id: 'n1', kind: 'road', attrs: { widthM: 4.5 }, lon: 10.2, lat: 20.2 }
];

const NODES: Array<RoadNode & { lon: number; lat: number }> = [
  { id: 'n1', name: '一号路口', attrs: {}, lon: 10.2, lat: 20.2 },
  { id: 'n2', attrs: {}, lon: 10.3, lat: 20.3 },
  { id: 'n3', attrs: {}, lon: 10.4, lat: 20.4 }
];

const EDGES: RoadEdge[] = [
  { id: 'e1', from: 'n1', to: 'n2' },
  { id: 'e2', from: 'n2', to: 'n3' }
];

describe('runRuleEngine', () => {
  it('产出四类结论：通过性、关键节点、风险、临机通路', () => {
    const result = runRuleEngine({
      brief: BRIEF,
      targets: TARGETS,
      roadNodes: NODES,
      roadEdges: EDGES,
      vehicle: 'tracked'
    });
    const topics = new Set(result.conclusion.items.map(item => item.topic));
    expect(topics.has('passability')).toBe(true);
    expect(topics.has('critical-node')).toBe(true);
    expect(topics.has('risk')).toBe(true);
    expect(topics.has('bypass')).toBe(true);
  });

  it('规则通道的引用全部命中上下文包（不允许无依据结论）', () => {
    const result = runRuleEngine({
      brief: BRIEF,
      targets: TARGETS,
      roadNodes: NODES,
      roadEdges: EDGES,
      vehicle: 'wheeled'
    });
    expect(citationHitRate(result.conclusion.items, BRIEF)).toBe(1);
  });

  it('车型影响通过性结论：同一条窄路对履带与轮式判定不同', () => {
    const tracked = runRuleEngine({
      brief: BRIEF,
      targets: TARGETS,
      roadNodes: NODES,
      roadEdges: EDGES,
      vehicle: 'tracked'
    });
    const wheeled = runRuleEngine({
      brief: BRIEF,
      targets: TARGETS,
      roadNodes: NODES,
      roadEdges: EDGES,
      vehicle: 'wheeled'
    });
    const pick = (run: typeof tracked) => run.conclusion.items.find(item => item.topic === 'passability');
    expect(pick(wheeled)?.level).not.toBe(pick(tracked)?.level);
  });

  it('有坐标的结论产出可落图的覆盖要素', () => {
    const result = runRuleEngine({
      brief: BRIEF,
      targets: TARGETS,
      roadNodes: NODES,
      roadEdges: EDGES,
      vehicle: 'tracked'
    });
    expect(result.conclusion.overlays.length).toBeGreaterThan(0);
    expect(result.conclusion.overlays[0].positions[0]).toHaveLength(2);
  });

  it('规则基线可用于度量一致性（自身比对应为 1）', () => {
    const result = runRuleEngine({
      brief: BRIEF,
      targets: TARGETS,
      roadNodes: NODES,
      roadEdges: EDGES,
      vehicle: 'tracked'
    });
    expect(ruleAgreementRate(result.facts, result.facts)).toBe(1);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('空输入不抛错', () => {
    const empty = assembleBrief({
      region: { name: '空区', bounds: [10, 20, 11, 21] },
      evidences: [],
      vehicle: { type: 'wheeled', label: '轮式车辆' }
    });
    const result = runRuleEngine({ brief: empty, targets: [], roadNodes: [], roadEdges: [], vehicle: 'wheeled' });
    expect(result.conclusion.items).toEqual([]);
  });
});
