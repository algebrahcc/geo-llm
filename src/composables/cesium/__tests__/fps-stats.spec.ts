import { describe, expect, it } from 'vitest';
import { createFpsStats, type FpsStats } from '../fps-stats';

/**
 * 帧率统计的纯逻辑测试。
 *
 * 这份读数是要拿去**验收取证**的（指标要求「街景浏览帧率不低于 30FPS」），
 * 所以两件事必须钉死：读数要准（不是把空闲时间也算成低帧率），
 * 最低帧率要真的留得住最低值（不能被后来的流畅段洗白）。
 */

/** 以固定间隔投喂若干帧，返回下一帧应使用的时间戳 */
function feed(stats: { tick: (ts: number) => void }, startMs: number, frames: number, intervalMs: number): number {
  let ts = startMs;
  for (let i = 0; i < frames; i += 1) {
    stats.tick(ts);
    ts += intervalMs;
  }
  return ts;
}

function expectFps(read: FpsStats, expected: number, digits = 0): void {
  expect(read.current).toBeCloseTo(expected, digits);
}

describe('帧率统计', () => {
  it('单帧不产生读数（避免除零与 NaN）', () => {
    const stats = createFpsStats();
    stats.tick(1000);

    expect(stats.read().current).toBe(0);
    expect(stats.read().average).toBe(0);
    expect(stats.read().frames).toBe(1);
  });

  it('稳定 60FPS：实时、平均、最低都给到 60', () => {
    const stats = createFpsStats();
    feed(stats, 0, 121, 1000 / 60); // 2 秒
    const read = stats.read();

    expectFps(read, 60);
    expect(read.average).toBeCloseTo(60, 0);
    expect(read.min).toBeCloseTo(60, 0);
    expect(read.frames).toBe(121);
  });

  it('稳定 25FPS：读数如实反映未达标的帧率', () => {
    const stats = createFpsStats();
    feed(stats, 0, 26, 40); // 约 1 秒

    expectFps(stats.read(), 25);
  });

  it('静默期不计入平均（切页/后台挂起不该把平均帧率拖低）', () => {
    const stats = createFpsStats();
    const afterFirst = feed(stats, 0, 61, 1000 / 60); // 1 秒 60FPS
    stats.tick(afterFirst + 3000); // 3 秒空档（切走再切回）
    feed(stats, afterFirst + 3000, 61, 1000 / 60); // 又 1 秒 60FPS

    // 若空档被计入，平均会掉到约 30FPS
    expect(stats.read().average).toBeCloseTo(60, 0);
  });

  it('最低帧率保留历史最低值（流畅段不能把它洗白）', () => {
    const stats = createFpsStats();
    let ts = feed(stats, 0, 26, 40); // 约 1 秒 25FPS（不合格段）
    feed(stats, ts, 120, 1000 / 60); // 约 2 秒 60FPS
    const read = stats.read();

    expectFps(read, 60); // 实时读数已恢复
    expect(read.min).toBeLessThan(30); // 但最低值仍留住了那次不合格
    expect(read.min).toBeGreaterThan(20);
  });

  it('重置后读数清零（开始新一次测试会话）', () => {
    const stats = createFpsStats();
    feed(stats, 0, 61, 1000 / 60);
    stats.reset();

    expect(stats.read()).toEqual({ current: 0, average: 0, min: 0, frames: 0 });
  });
});
