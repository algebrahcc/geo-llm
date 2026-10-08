import { describe, expect, it } from 'vitest';
import { VEHICLE_PROFILE, judgePassability, type PassTarget } from '../passability';

function target(attrs: PassTarget['attrs'], kind: PassTarget['kind'] = 'road'): PassTarget {
  return { id: `${kind}-1`, kind, attrs };
}

describe('judgePassability', () => {
  it('坡度 20°：轮式不通过、履带可通行（条款要求区分车辆类型）', () => {
    const wheeled = judgePassability(target({ slopeDeg: 20 }), 'wheeled');
    const tracked = judgePassability(target({ slopeDeg: 20 }), 'tracked');
    expect(wheeled.level).toBe('impassable');
    expect(tracked.level).toBe('passable');
    expect(wheeled.reasons.join()).toContain('坡度');
  });

  it('桥梁限重 20t：轮式（12t）可通行、履带（40t）不通过', () => {
    const wheeled = judgePassability(target({ loadLimitT: 20, widthM: 8 }, 'bridge'), 'wheeled');
    const tracked = judgePassability(target({ loadLimitT: 20, widthM: 8 }, 'bridge'), 'tracked');
    expect(wheeled.level).toBe('passable');
    expect(tracked.level).toBe('impassable');
    expect(tracked.reasons.join()).toContain('限重');
  });

  it('路宽 4.5m：轮式可通行、履带车体过宽不通过', () => {
    expect(judgePassability(target({ widthM: 4.5 }), 'wheeled').level).toBe('passable');
    expect(judgePassability(target({ widthM: 4.5 }), 'tracked').level).toBe('impassable');
  });

  it('未铺装土路：轮式受限、履带不受影响', () => {
    expect(judgePassability(target({ surface: '土路', widthM: 8 }), 'wheeled').level).toBe('restricted');
    expect(judgePassability(target({ surface: '土路', widthM: 8 }), 'tracked').level).toBe('passable');
  });

  it('街区障碍物 3 处以上判为受阻', () => {
    const result = judgePassability(target({ obstacleCount: 4 }, 'block'), 'tracked');
    expect(result.level).toBe('impassable');
    expect(result.reasons.join()).toContain('障碍物');
  });

  it('属性缺失时不给「可通行」的乐观结论，并降低置信度', () => {
    const result = judgePassability(target({}), 'wheeled');
    expect(result.level).toBe('restricted');
    expect(result.confidence).toBeLessThan(0.5);
    expect(result.conclusion).toContain('数据');
  });

  it('结论带依据与目标标识，便于溯源到要素', () => {
    const result = judgePassability(target({ widthM: 3 }), 'wheeled');
    expect(result.targetId).toBe('road-1');
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.conclusion).toContain(VEHICLE_PROFILE.wheeled.label);
  });
});
