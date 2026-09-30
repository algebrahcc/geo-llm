import { describe, expect, it } from 'vitest';
import { createRouteSituationEngine, type RouteSituationContext } from '../route-situation-engine';

/**
 * 事件推演引擎的纯逻辑测试。
 *
 * 重点锁住「事件词 + 地物 → 标绘图标类型」这条判断：它决定地图上画什么，
 * 而图标本身是 canvas 绘制（无法在 node 里断言），所以把可判定的一侧放在这里。
 */
function makeEngine() {
  const ctx = (): RouteSituationContext => ({
    startName: '南港装载地域',
    endName: '淡水沙崙卸载地域',
    routePreference: '时间最优',
    forceScale: '中型编队'
  });
  return createRouteSituationEngine(ctx);
}

describe('事件标绘图标类型', () => {
  it('桥类地物断裂 → 断桥图标，且不再产出颜色（颜色归图标所有）', () => {
    const engine = makeEngine();
    const result = engine.answer('成功桥遭袭断裂');

    expect(result.plot?.kind).toBe('bridge-broken');
    expect(result.plot?.label).toBe('成功桥·断裂');
    expect(result.plot?.color).toBeUndefined();
  });

  it('非桥地物断裂 → 道路中断图标（"桥断"与"路断"必须分开）', () => {
    const engine = makeEngine();

    expect(engine.answer('剑南路断裂').plot?.kind).toBe('road-closed');
  });

  it('桥被炸 → 仍用断桥图标，而不是损毁图标', () => {
    const engine = makeEngine();

    expect(engine.answer('成功桥被炸').plot?.kind).toBe('bridge-broken');
  });

  it('坍塌 → 塌陷图标；损毁 → 瓦砾图标', () => {
    expect(makeEngine().answer('台2乙塌方').plot?.kind).toBe('sinkhole');
    expect(makeEngine().answer('大度路损毁').plot?.kind).toBe('rubble');
  });

  it('拥堵类事件 → 拥堵图标', () => {
    const engine = makeEngine();

    expect(engine.answer('洲美快速道路拥堵').plot?.kind).toBe('congestion');
  });

  it('普通点名标绘不产出图标类型（仍用点标记 + 自己的颜色）', () => {
    const engine = makeEngine();
    const result = engine.answer('标出成功桥');

    expect(result.plot?.kind).toBeUndefined();
    expect(result.plot?.color).toBe('#5ea4ff');
    expect(result.plot?.label).toBe('成功桥');
  });

  it('回复文案与图上标绘一致：说明用的是哪种图标，而不是已不存在的"红色叉号"', () => {
    const engine = makeEngine();
    const result = engine.answer('成功桥遭袭断裂');

    expect(result.answer).toContain('断桥图标');
    expect(result.answer).not.toContain('叉号');
  });
});
