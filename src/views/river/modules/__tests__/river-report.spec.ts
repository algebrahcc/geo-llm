import { describe, expect, it } from 'vitest';
import { crossingPlanCards, defaultCrossingSettingForm } from '@/mock/river';
import { surveyReport } from '@/mock/river-survey';
import { buildRiverReportHtml, deriveWorkload, type RiverReportInput } from '../river-report';

describe('deriveWorkload', () => {
  it('按河宽派生展开长度与桥节数', () => {
    const workload = deriveWorkload({ ...defaultCrossingSettingForm, riverWidth: 491 });
    expect(workload.spanMeters).toBe(491);
    // 展开长度 / 单节 6.7m，向上取整
    expect(workload.sections).toBe(Math.ceil(491 / 6.7));
  });

  it('河宽为 0 时不产生负值或 NaN', () => {
    const workload = deriveWorkload({ ...defaultCrossingSettingForm, riverWidth: 0 });
    expect(workload.spanMeters).toBe(0);
    expect(workload.sections).toBe(0);
  });

  it('按兵力规模给出编成，未知规模退回默认编成', () => {
    const battalion = deriveWorkload({ ...defaultCrossingSettingForm, forceScale: '1个营' });
    expect(battalion.teams.some(team => team.name === '架桥分队')).toBe(true);

    const unknown = deriveWorkload({ ...defaultCrossingSettingForm, forceScale: '某规模' });
    expect(unknown.teams.length).toBeGreaterThan(0);
  });
});

describe('buildRiverReportHtml', () => {
  const baseInput: RiverReportInput = {
    form: defaultCrossingSettingForm,
    survey: surveyReport,
    plans: crossingPlanCards,
    mapImage: null,
    generatedAt: new Date('2026-06-15T06:00:00')
  };

  const html = buildRiverReportHtml(baseInput);

  it('包含标准模板的五个章节与封面要素', () => {
    ['任务概况', '渡场勘察数据', '渡场筛选结果', '渡河工程保障方案要点', '矢量地图附图'].forEach(heading => {
      expect(html).toContain(heading);
    });
    expect(html).toContain('2026-06-15 06:00');
    expect(html).toContain(defaultCrossingSettingForm.taskName);
  });

  it('渡场筛选结果带优先级、综合评分与依据表', () => {
    expect(html).toContain('关渡大桥上游 1km 渡场');
    expect(html).toContain('综合评分 89');
    expect(html).toContain('筛选维度');
    expect(html).toContain('流速窗口');
  });

  it('工程量按河宽派生（改河宽报告要跟着变）', () => {
    expect(html).toContain('491 m');
    expect(html).toContain(`${Math.ceil(491 / 6.7)} 节`);
  });

  it('缺图时给出说明而不是留空', () => {
    expect(html).toContain('未取到地图画面');
  });

  it('有图时把 dataURL 嵌进文档', () => {
    const withMap = buildRiverReportHtml({ ...baseInput, mapImage: 'data:image/png;base64,AAAA' });
    expect(withMap).toContain('src="data:image/png;base64,AAAA"');
  });

  it('任务名做 HTML 转义，避免注入与破版', () => {
    const escaped = buildRiverReportHtml({
      ...baseInput,
      form: { ...defaultCrossingSettingForm, taskName: '<img src=x onerror=alert(1)>' }
    });
    expect(escaped).not.toContain('<img src=x');
    expect(escaped).toContain('&lt;img');
  });

  it('无方案时仍可生成（筛选章节给出提示）', () => {
    const noPlan = buildRiverReportHtml({ ...baseInput, plans: [] });
    expect(noPlan).toContain('尚未执行渡场筛选');
  });
});
