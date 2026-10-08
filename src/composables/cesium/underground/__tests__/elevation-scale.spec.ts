import { describe, expect, it } from 'vitest';
import {
  clamp01,
  clipAxisLabel,
  describeRange,
  elevationToFloorLabel,
  elevationToSlider,
  formatElevation,
  sliderToElevation,
  type ElevationRange
} from '../elevation-scale';

describe('clamp01', () => {
  it('把滑杆值限制在 0~1', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.25)).toBe(0.25);
    expect(clamp01(1.8)).toBe(1);
  });

  it('非数字按 0 处理（滑杆不会传 NaN，但防御性避免脏值传播）', () => {
    expect(clamp01(Number.NaN)).toBe(0);
  });
});

describe('sliderToElevation', () => {
  const range: ElevationRange = { min: -20, max: 60 };

  it('滑杆 0 对应最低标高、1 对应最高标高', () => {
    expect(sliderToElevation(0, range)).toBe(-20);
    expect(sliderToElevation(1, range)).toBe(60);
  });

  it('中点取值在中值上', () => {
    expect(sliderToElevation(0.5, range)).toBe(20);
  });

  it('自动收进范围（滑杆越界不产生范围外的剖切面）', () => {
    expect(sliderToElevation(2, range)).toBe(60);
    expect(sliderToElevation(-1, range)).toBe(-20);
  });

  it('退化范围（min=max）不会除零', () => {
    expect(sliderToElevation(0.7, { min: 5, max: 5 })).toBe(5);
  });
});

describe('elevationToSlider', () => {
  const range: ElevationRange = { min: -20, max: 60 };

  it('与 sliderToElevation 互为逆运算', () => {
    [0, 0.13, 0.5, 0.87, 1].forEach(t => {
      expect(elevationToSlider(sliderToElevation(t, range), range)).toBeCloseTo(t, 6);
    });
  });

  it('范围外的标高被夹到端点', () => {
    expect(elevationToSlider(-999, range)).toBe(0);
    expect(elevationToSlider(999, range)).toBe(1);
  });
});

describe('elevationToFloorLabel', () => {
  it('地面高程以下按地下层编号（B1、B2…）', () => {
    expect(elevationToFloorLabel(-0.1)).toBe('B1');
    expect(elevationToFloorLabel(-4.2)).toBe('B2');
    expect(elevationToFloorLabel(-18.6)).toBe('B5');
  });

  it('地面及以上按地上层编号（F1、F2…）', () => {
    // 层归属按「层顶」判定：3.9m 仍在 4m 层高的 F1 范围内，4.0m 才是 F2 的下边界
    expect(elevationToFloorLabel(0)).toBe('F1');
    expect(elevationToFloorLabel(3.9)).toBe('F1');
    expect(elevationToFloorLabel(4)).toBe('F2');
    expect(elevationToFloorLabel(12)).toBe('F4');
  });

  it('可指定实际地面高程（非 0 的场景，如高程基准面）', () => {
    // 地面在 15m 时，14.9m 应算地下第 1 层
    expect(elevationToFloorLabel(14.9, { groundHeight: 15 })).toBe('B1');
    expect(elevationToFloorLabel(15, { groundHeight: 15 })).toBe('F1');
  });

  it('层高可配置（工业建筑常见的 6m 柱网）', () => {
    expect(elevationToFloorLabel(-3, { floorHeight: 6 })).toBe('B1');
    expect(elevationToFloorLabel(-6.5, { floorHeight: 6 })).toBe('B2');
  });
});

describe('formatElevation', () => {
  it('地下带负号并保留一位小数', () => {
    expect(formatElevation(-6.24)).toBe('-6.2m');
  });

  it('地面与正标高同样保留一位小数', () => {
    expect(formatElevation(0)).toBe('0.0m');
    expect(formatElevation(12.36)).toBe('12.4m');
  });
});

describe('clipAxisLabel', () => {
  it('三个轴各有中文名（面板按钮文案）', () => {
    expect(clipAxisLabel('up')).toBe('水平剖切');
    expect(clipAxisLabel('east')).toBe('南北剖切');
    expect(clipAxisLabel('north')).toBe('东西剖切');
  });
});

describe('describeRange', () => {
  it('展示模型标高跨度', () => {
    expect(describeRange({ min: -12.4, max: 8.6 })).toBe('-12.4m ~ 8.6m（跨度 21.0m）');
  });

  it('退化范围不出现 NaN', () => {
    expect(describeRange({ min: 3, max: 3 })).toContain('跨度 0.0m');
  });
});
