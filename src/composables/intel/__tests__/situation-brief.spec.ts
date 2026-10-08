import { describe, expect, it } from 'vitest';
import {
  assembleBrief,
  citationHitRate,
  collectEvidences,
  regionAreaKm2,
  type EvidenceSource,
  type JudgementItem
} from '../situation-brief';

function source(overrides: Partial<EvidenceSource> & { id: string; lon: number; lat: number }): EvidenceSource {
  return {
    layerId: 'layer-1',
    layerName: '交通路网',
    kind: 'point',
    label: `目标 ${overrides.id}`,
    attrs: {},
    ...overrides
  };
}

describe('regionAreaKm2', () => {
  it('赤道附近 1°×1° 约 1.23 万平方公里', () => {
    // 参考值来自独立估算：赤道 1° 经差约 111.32km、1° 纬差约 110.57km -> 约 12308km²；
    // 球面公式（R=6371 平均半径）会略高，故用 ±2% 区间而不是等值断言
    const area = regionAreaKm2([0, 0, 1, 1]);
    expect(area).toBeGreaterThan(12000);
    expect(area).toBeLessThan(12600);
  });

  it('同样跨度在高纬面积更小（球面收敛）', () => {
    expect(regionAreaKm2([0, 60, 1, 61])).toBeLessThan(regionAreaKm2([0, 0, 1, 1]));
  });

  it('零面积区域返回 0', () => {
    expect(regionAreaKm2([10, 10, 10, 10])).toBe(0);
  });
});

describe('collectEvidences', () => {
  const sources: EvidenceSource[] = [
    source({ id: 'a', lon: 10.2, lat: 20.2, attrs: { importance: 1 } }),
    source({ id: 'b', lon: 10.5, lat: 20.5, attrs: { importance: 5 } }),
    source({ id: 'c', lon: 10.8, lat: 20.8, attrs: { importance: 3 } }),
    source({ id: 'outside', lon: 30, lat: 40 })
  ];

  it('只保留范围内的要素', () => {
    const result = collectEvidences(sources, [10, 20, 11, 21], 10);
    expect(result.map(item => item.id)).toEqual(['b', 'c', 'a']);
  });

  it('超出上限时按重要度截断，并保持 id 稳定', () => {
    const result = collectEvidences(sources, [10, 20, 11, 21], 2);
    expect(result.map(item => item.id)).toEqual(['b', 'c']);
  });

  it('无重要度属性时按 id 稳定排序（同一输入必得同一上下文）', () => {
    const plain = [source({ id: 'z', lon: 10.1, lat: 20.1 }), source({ id: 'a', lon: 10.2, lat: 20.2 })];
    expect(collectEvidences(plain, [10, 20, 11, 21], 10).map(item => item.id)).toEqual(['a', 'z']);
  });
});

describe('assembleBrief', () => {
  it('按图层聚合要素数并给出统计摘要', () => {
    const brief = assembleBrief({
      region: { name: '研判区', bounds: [10, 20, 11, 21] },
      evidences: [
        source({ id: 'a', lon: 10.2, lat: 20.2, layerId: 'road', layerName: '交通路网' }),
        source({ id: 'b', lon: 10.3, lat: 20.3, layerId: 'road', layerName: '交通路网' }),
        source({ id: 'c', lon: 10.4, lat: 20.4, layerId: 'river', layerName: '水系', kind: 'line' })
      ],
      vehicle: { type: 'tracked', label: '履带车辆' }
    });
    expect(brief.layers).toEqual([
      { layerId: 'road', name: '交通路网', featureCount: 2, summary: '2 个要素' },
      { layerId: 'river', name: '水系', featureCount: 1, summary: '1 个要素' }
    ]);
    expect(brief.region.areaKm2).toBeGreaterThan(0);
    expect(brief.vehicle.type).toBe('tracked');
  });

  it('要素超限时截断并标注，不静默丢数据', () => {
    const many = Array.from({ length: 60 }, (_, index) =>
      source({ id: `p${index}`, lon: 10.1 + index * 0.001, lat: 20.1, attrs: { importance: index } })
    );
    const brief = assembleBrief({
      region: { name: '大区', bounds: [10, 20, 12, 22] },
      evidences: many,
      vehicle: { type: 'wheeled', label: '轮式车辆' }
    });
    expect(brief.evidences.length).toBe(40);
    expect(brief.truncated).toBe(true);
    expect(brief.layers[0].summary).toContain('已截断');
  });
});

describe('citationHitRate', () => {
  const brief = assembleBrief({
    region: { name: '区', bounds: [10, 20, 11, 21] },
    evidences: [source({ id: 'a', lon: 10.2, lat: 20.2 }), source({ id: 'b', lon: 10.3, lat: 20.3 })],
    vehicle: { type: 'wheeled', label: '轮式车辆' }
  });

  it('引用全部命中时为 1', () => {
    const items: JudgementItem[] = [
      {
        topic: 'passability',
        targetId: 'a',
        level: '可通行',
        conclusion: 'x',
        evidenceIds: ['a', 'b'],
        confidence: 0.8
      }
    ];
    expect(citationHitRate(items, brief)).toBe(1);
  });

  it('引用不存在的要素会拉低命中率（可追溯性度量）', () => {
    const items: JudgementItem[] = [
      { topic: 'risk', targetId: 'a', level: '高', conclusion: 'x', evidenceIds: ['a', '不存在'], confidence: 0.5 }
    ];
    expect(citationHitRate(items, brief)).toBe(0.5);
  });

  it('没有任何引用时命中率为 0（不允许无依据结论计入）', () => {
    const items: JudgementItem[] = [
      { topic: 'risk', targetId: 'a', level: '高', conclusion: 'x', evidenceIds: [], confidence: 0.5 }
    ];
    expect(citationHitRate(items, brief)).toBe(0);
  });
});
