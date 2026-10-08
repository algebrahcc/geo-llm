import { describe, expect, it } from 'vitest';
import {
  analyzeCriticalNodes,
  assessBypassSuitability,
  assessRoadRisks,
  type RoadEdge,
  type RoadNode
} from '../route-critical-nodes';

function node(id: string, attrs: RoadNode['attrs'] = {}): RoadNode {
  return { id, attrs };
}

function edge(from: string, to: string): RoadEdge {
  return { id: `${from}-${to}`, from, to };
}

/** 链状路网 A-B-C：B 是唯一割点 */
const CHAIN_NODES = [node('A'), node('B', { dailyFlow: 900 }), node('C')];
const CHAIN_EDGES = [edge('A', 'B'), edge('B', 'C')];

describe('analyzeCriticalNodes', () => {
  it('链状路网中中间节点是割点，端点是普通节点', () => {
    const result = analyzeCriticalNodes(CHAIN_NODES, CHAIN_EDGES);
    const b = result.find(item => item.nodeId === 'B');
    const a = result.find(item => item.nodeId === 'A');
    expect(b?.articulation).toBe(true);
    expect(a?.articulation).toBe(false);
    expect(b?.score).toBeGreaterThan(a?.score ?? 1);
  });

  it('环状路网没有割点（任意节点失效仍可绕行）', () => {
    const nodes = [node('A'), node('B'), node('C')];
    const edges = [edge('A', 'B'), edge('B', 'C'), edge('C', 'A')];
    const result = analyzeCriticalNodes(nodes, edges);
    expect(result.every(item => !item.articulation)).toBe(true);
  });

  it('度中心性反映连接的道路数', () => {
    const nodes = [node('H', { lanes: 6 }), node('A'), node('B'), node('C'), node('D')];
    const edges = [edge('H', 'A'), edge('H', 'B'), edge('H', 'C'), edge('H', 'D')];
    const hub = analyzeCriticalNodes(nodes, edges).find(item => item.nodeId === 'H');
    expect(hub?.degree).toBe(4);
  });

  it('空路网返回空结果且不抛错', () => {
    expect(analyzeCriticalNodes([], [])).toEqual([]);
  });
});

describe('assessRoadRisks', () => {
  it('割点判为「断」高风险', () => {
    const risks = assessRoadRisks(CHAIN_NODES, CHAIN_EDGES);
    const risk = risks.find(item => item.nodeId === 'B');
    expect(risk?.kind).toBe('cut');
    expect(risk?.level).toBe('high');
    expect(risk?.conclusion).toContain('断');
  });

  it('高连接度但可绕行的节点判为「堵」', () => {
    // 环上枢纽：度数为 4，但移除后环内部仍连通（不是割点）——堵而不断
    const nodes = [node('H'), node('A'), node('B'), node('C'), node('D')];
    const edges = [
      edge('H', 'A'),
      edge('H', 'B'),
      edge('H', 'C'),
      edge('H', 'D'),
      edge('A', 'B'),
      edge('B', 'C'),
      edge('C', 'D'),
      edge('D', 'A')
    ];
    const risk = assessRoadRisks(nodes, edges).find(item => item.nodeId === 'H');
    expect(risk?.kind).toBe('block');
    expect(risk?.reasons.join()).toContain('4');
  });

  it('既割点又高连接度判为「卡」', () => {
    // 双簇路网：唯一连接两簇的 H 既是割点、连接度也高
    const nodes = [node('H'), node('A'), node('B'), node('C'), node('D')];
    const edges = [edge('A', 'B'), edge('A', 'H'), edge('B', 'H'), edge('H', 'C'), edge('C', 'D'), edge('D', 'H')];
    const risk = assessRoadRisks(nodes, edges).find(item => item.nodeId === 'H');
    expect(risk?.kind).toBe('choke');
    expect(risk?.level).toBe('high');
  });

  it('普通端点不产生风险项', () => {
    const risks = assessRoadRisks(CHAIN_NODES, CHAIN_EDGES);
    expect(risks.some(item => item.nodeId === 'A')).toBe(false);
  });
});

describe('assessBypassSuitability', () => {
  it('开阔、临近既有道路、无障碍时适宜等级高', () => {
    const result = assessBypassSuitability('B', { openness: 0.9, distanceToRoadM: 60, obstacleCount: 0 });
    expect(result.level).toBe('优');
    expect(result.score).toBeGreaterThan(0.8);
  });

  it('狭窄、障碍多时适宜等级低', () => {
    const result = assessBypassSuitability('B', { openness: 0.15, distanceToRoadM: 900, obstacleCount: 5 });
    expect(['差', '劣']).toContain(result.level);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('评分随条件单调变化', () => {
    const good = assessBypassSuitability('B', { openness: 0.8, distanceToRoadM: 100, obstacleCount: 0 });
    const worse = assessBypassSuitability('B', { openness: 0.8, distanceToRoadM: 100, obstacleCount: 2 });
    expect(worse.score).toBeLessThan(good.score);
  });
});
