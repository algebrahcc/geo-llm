/**
 * 场景生命周期原语（RFC-0001 · 第 2 步）
 *
 * 这里承载三条清理不变量，把它们从「靠注释与 try/catch 人工维持」变成**结构保证**：
 *
 * 1. **顺序**：后注册先清理（LIFO）。Viewer 最先创建、最先入栈 → 最后销毁，
 *    于是子资源（事件处理器、图层、网格、面板）必然先于 Viewer 释放。
 *    这直接消除 `components/cesium/beidou-grid.ts:372-392` 那类事故
 *    （父组件先 destroy viewer，子组件再访问 camera 抛
 *    `Cannot read properties of undefined (reading 'scene')`，进而中断路由跳转）。
 * 2. **幂等**：`runAll()` 重复调用只执行一次。
 * 3. **异步兜底**：逐个 `await`，单项失败不中断其余清理，异常只上报不外抛 —— 因为
 *    teardown 阶段向外抛错会打断调用方（例如路由跳转）。
 */
import type { SceneTimers, TimerId } from '../ports/types';

/** 清理动作：同步或异步均可 */
export type CleanupFn = () => void | Promise<void>;

export interface DisposalRegistry {
  /** 是否已清理 */
  readonly disposed: boolean;
  /** 尚未清理的注册项数量 */
  readonly size: number;
  /** 注册清理动作（LIFO） */
  push(cleanup: CleanupFn): void;
  /** 逆序执行全部清理；幂等；异常只上报 */
  runAll(): Promise<void>;
}

/**
 * 创建清理栈。
 *
 * @param onError 单项清理失败时的上报回调（默认静默 —— 调用方可接日志或提示端口）
 */
export function createDisposalRegistry(onError?: (error: unknown) => void): DisposalRegistry {
  const stack: CleanupFn[] = [];
  let disposed = false;

  async function runAll(): Promise<void> {
    if (disposed) return;
    disposed = true;

    // 逆序弹出：后注册者先清理。
    // 同步清理不 await（直接跑完整栈），以此保住「同步 teardown」这条既有保证：
    // 旧的 destroyViewer 是同步销毁 Viewer，调用方可能依赖"返回时 viewer 已销毁"
    // （例如同一 tick 内在同一容器上重建 Viewer）。只有真的返回 Promise 时才让出。
    while (stack.length > 0) {
      const cleanup = stack.pop() as CleanupFn;
      try {
        const result = cleanup();
        if (result && typeof (result as Promise<void>).then === 'function') {
          await result;
        }
      } catch (error) {
        onError?.(error);
      }
    }
  }

  return {
    get disposed() {
      return disposed;
    },
    get size() {
      return stack.length;
    },
    push(cleanup) {
      if (disposed) {
        // 清理之后才注册：立即执行以免泄漏；同样只上报不外抛
        void Promise.resolve()
          .then(cleanup)
          .catch(error => onError?.(error));
        return;
      }
      stack.push(cleanup);
    },
    runAll
  };
}

/**
 * 为 Promise 附加超时兜底。
 *
 * 服务地址不可达时，Cesium 的 provider 请求（terrain layer.json、3DTiles tileset.json）
 * 可能长期挂起而不 reject；超时后以 `reason` 拒绝，避免拖垮初始化流程。
 *
 * 超时值由调用方从端口传入（`SceneEnvConfig.serviceTimeoutMs`），
 * 取代原先 `use-cesium-base.ts` 与 `use-cesium-services.ts` 各写一份的 8000。
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, reason: string, timers: SceneTimers): Promise<T> {
  let timerId: TimerId | undefined;

  return Promise.race([
    promise.finally(() => {
      // 先完成时清掉定时器，避免悬挂
      if (timerId !== undefined) timers.clearTimeout(timerId);
    }),
    new Promise<never>((_, reject) => {
      timerId = timers.setTimeout(() => reject(new Error(reason)), ms);
    })
  ]);
}
