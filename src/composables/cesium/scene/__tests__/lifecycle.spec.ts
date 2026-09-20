/**
 * 生命周期原语边界测试（RFC-0001 · 第 2 步）
 *
 * 断言的是三条不变量本身（顺序 / 幂等 / 异步兜底）与超时契约，
 * 都是行为描述，内部实现重构不应让它们变红。
 */
import { describe, expect, it, vi } from 'vitest';
import { createDisposalRegistry, withTimeout } from '../lifecycle';
import { createFakeTimers } from '../../testing/fakes';

describe('DisposalRegistry', () => {
  it('逆序清理：后注册先执行（Viewer 最先创建 → 最后销毁）', async () => {
    const order: string[] = [];
    const registry = createDisposalRegistry();

    registry.push(() => {
      order.push('viewer');
    });
    registry.push(() => {
      order.push('layers');
    });
    registry.push(() => {
      order.push('panel');
    });
    await registry.runAll();

    expect(order).toEqual(['panel', 'layers', 'viewer']);
  });

  it('幂等：重复 runAll 只执行一次', async () => {
    const cleanup = vi.fn();
    const registry = createDisposalRegistry();
    registry.push(cleanup);

    await registry.runAll();
    await registry.runAll();
    await registry.runAll();

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(registry.disposed).toBe(true);
    expect(registry.size).toBe(0);
  });

  it('单项失败不中断其余清理，异常交给 onError（teardown 绝不外抛）', async () => {
    const order: string[] = [];
    const onError = vi.fn();
    const registry = createDisposalRegistry(onError);

    registry.push(() => {
      order.push('viewer');
    });
    registry.push(() => {
      throw new Error('panel 清理失败');
    });
    registry.push(() => {
      order.push('layers');
    });

    await expect(registry.runAll()).resolves.toBeUndefined();
    expect(order).toEqual(['layers', 'viewer']);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('异步清理会被逐个 await，顺序仍为逆序', async () => {
    const order: string[] = [];
    const registry = createDisposalRegistry();

    registry.push(async () => {
      await Promise.resolve();
      order.push('viewer');
    });
    registry.push(async () => {
      await Promise.resolve();
      order.push('layers');
    });

    await registry.runAll();
    expect(order).toEqual(['layers', 'viewer']);
  });

  it('清理之后才注册的动作立即执行，且不外抛异常', async () => {
    const late = vi.fn();
    const onError = vi.fn();
    const registry = createDisposalRegistry(onError);

    await registry.runAll();
    registry.push(late);
    registry.push(() => {
      throw new Error('late fail');
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(late).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe('withTimeout', () => {
  it('promise 先完成时不留下悬挂定时器', async () => {
    const timers = createFakeTimers();

    await expect(withTimeout(Promise.resolve('ok'), 8000, '超时', timers)).resolves.toBe('ok');
    expect(timers.pendingCount()).toBe(0);
  });

  it('超时后以给定原因拒绝', async () => {
    const timers = createFakeTimers();
    const pending = withTimeout(new Promise(() => {}), 8000, '服务加载超时', timers);

    timers.advance(7999);
    expect(timers.pendingCount()).toBe(1);

    timers.advance(1);
    await expect(pending).rejects.toThrow('服务加载超时');
  });

  it('超时值由调用方注入（不依赖任何内置常量）', async () => {
    const timers = createFakeTimers();
    const pending = withTimeout(new Promise(() => {}), 50, '太快了', timers);

    timers.advance(50);
    await expect(pending).rejects.toThrow('太快了');
  });
});
