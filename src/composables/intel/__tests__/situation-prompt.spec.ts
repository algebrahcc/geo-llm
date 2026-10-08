import { describe, expect, it } from 'vitest';
import { buildSituationContext, parseSituationItems, stripSituationBlock } from '../situation-prompt';
import { assembleBrief, type EvidenceSource } from '../situation-brief';

function source(id: string): EvidenceSource {
  return { id, layerId: 'road', layerName: '交通路网', kind: 'line', label: id, lon: 10.2, lat: 20.2, attrs: {} };
}

const BRIEF = assembleBrief({
  region: { name: '研判区', bounds: [10, 20, 11, 21] },
  evidences: [source('n1'), source('n2')],
  vehicle: { type: 'tracked', label: '履带车辆' }
});

describe('parseSituationItems', () => {
  it('解析 ```situation 代码块中的结构化结论', () => {
    const raw = [
      '已对选区完成归纳。',
      '```situation',
      '[{"topic":"risk","targetId":"n1","level":"高","conclusion":"存在断的风险","evidenceIds":["n1"],"confidence":0.8}]',
      '```'
    ].join('\n');
    const items = parseSituationItems(raw);
    expect(items).toHaveLength(1);
    expect(items[0].topic).toBe('risk');
    expect(items[0].evidenceIds).toEqual(['n1']);
  });

  it('容忍裸 JSON 数组与流式中间态', () => {
    expect(
      parseSituationItems(
        '说明文字 [{"topic":"passability","targetId":"n2","level":"可通行","evidenceIds":["n2"]}] 结束'
      )
    ).toHaveLength(1);
    expect(parseSituationItems('{"topic":"risk"')).toEqual([]);
  });

  it('丢弃非法 topic 与没有依据的条目（乱编依据不算命中）', () => {
    const raw = JSON.stringify([
      { topic: 'unknown', targetId: 'n1', level: '高', evidenceIds: ['n1'] },
      { topic: 'risk', targetId: 'n1', level: '高', evidenceIds: [] }
    ]);
    expect(parseSituationItems(raw)).toEqual([]);
  });
});

describe('stripSituationBlock', () => {
  it('剥掉结构化块只留叙述', () => {
    const raw = '归纳如下。\n```situation\n[]\n```';
    expect(stripSituationBlock(raw)).toBe('归纳如下。');
  });
});

describe('buildSituationContext', () => {
  it('上下文只带聚合统计与要素摘要，不带全量坐标', () => {
    const context = JSON.parse(buildSituationContext(BRIEF));
    expect(context.evidences[0].id).toBe('n1');
    expect(context.evidences[0].lon).toBeUndefined();
    expect(context.region.areaKm2).toBeGreaterThan(0);
    expect(context.promptVersion).toBeTruthy();
  });
});
