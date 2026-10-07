/**
 * 帧率监测（组合式函数）
 *
 * 与「用 requestAnimationFrame 采样」的区别：渡河与规划场景开启了
 * `scene.requestRenderMode = true`（按需渲染），空闲时根本没有新帧 —— 用 rAF 采样会得到
 * 「浏览器刷新率」这种和渲染无关的假读数。这里改为订阅 `scene.postRender`，
 * 数的是**真正画出来的帧**。
 *
 * 测试会话（start/stop）的取值逻辑：
 *  - 验收要求「街景浏览帧率不低于 30FPS」，但按需渲染下只要不动相机就不重绘，
 *    读数会掉到近乎 0 —— 那不代表渲染能力不足。因此测试会话期间临时关闭
 *    requestRenderMode（连续渲染），结束时**恢复原值**，这样得到的平均/最低帧率
 *    才是可复现、可截图的证据。
 */
import { onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue';
import type { Viewer } from 'cesium';
import { createFpsStats, type FpsStats } from './fps-stats';

export interface FpsMonitorOptions {
  /**
   * 读数发布间隔（毫秒），默认 250。
   *
   * 为什么不通每帧写 ref：60FPS 下每秒会触发 60 次 Vue 重渲染，
   * 监测本身反而成了掉帧的来源；4 次/秒的读数刷新在人眼里已经连续。
   */
  publishIntervalMs?: number;
}

export interface FpsMonitorReturn {
  /** 当前读数 */
  stats: Ref<FpsStats>;
  /** 是否处于测试会话中 */
  recording: Ref<boolean>;
  /** 本次测试会话已采样的时长（毫秒） */
  elapsedMs: Ref<number>;
  /** 开始测试会话（连续渲染，读数可作验收证据） */
  start: () => void;
  /** 结束测试会话（恢复场景原有的按需渲染设置） */
  stop: () => void;
  /** 清空读数（开始新一轮取证） */
  reset: () => void;
}

const DEFAULT_PUBLISH_INTERVAL_MS = 250;

export function useFpsMonitor(viewerSource: Ref<Viewer | null>, options: FpsMonitorOptions = {}): FpsMonitorReturn {
  const publishIntervalMs = options.publishIntervalMs ?? DEFAULT_PUBLISH_INTERVAL_MS;

  const stats = ref<FpsStats>({ current: 0, average: 0, min: 0, frames: 0 });
  const recording = ref(false);
  const elapsedMs = ref(0);

  const recorder = createFpsStats();
  const attachedViewer = shallowRef<Viewer | null>(null);
  let removeListener: (() => void) | null = null;
  let lastPublish = 0;
  let sessionStart = 0;
  /** 场景原本的按需渲染设置（会话结束时恢复，不假设它一定是 true） */
  let originalRequestRenderMode: boolean | null = null;

  function publish(now: number): void {
    stats.value = recorder.read();
    if (recording.value) elapsedMs.value = now - sessionStart;
  }

  function onPostRender(): void {
    const now = performance.now();
    recorder.tick(now);
    if (now - lastPublish < publishIntervalMs) return;
    lastPublish = now;
    publish(now);
  }

  function detach(): void {
    if (removeListener) {
      removeListener();
      removeListener = null;
    }
    attachedViewer.value = null;
  }

  function attach(viewer: Viewer | null): void {
    detach();
    if (!viewer || viewer.isDestroyed()) return;
    attachedViewer.value = viewer;
    removeListener = viewer.scene.postRender.addEventListener(onPostRender);
  }

  watch(
    viewerSource,
    next => {
      attach(next ?? null);
    },
    { immediate: true }
  );

  function start(): void {
    recorder.reset();
    stats.value = recorder.read();
    elapsedMs.value = 0;
    sessionStart = performance.now();
    lastPublish = 0;
    recording.value = true;

    const viewer = attachedViewer.value;
    if (!viewer || viewer.isDestroyed()) return;
    originalRequestRenderMode = viewer.scene.requestRenderMode;
    viewer.scene.requestRenderMode = false;
    viewer.scene.requestRender();
  }

  function stop(): void {
    recording.value = false;
    const viewer = attachedViewer.value;
    if (viewer && !viewer.isDestroyed() && originalRequestRenderMode !== null) {
      viewer.scene.requestRenderMode = originalRequestRenderMode;
      originalRequestRenderMode = null;
      viewer.scene.requestRender();
    }
  }

  function reset(): void {
    recorder.reset();
    stats.value = recorder.read();
    elapsedMs.value = 0;
    lastPublish = 0;
    if (recording.value) sessionStart = performance.now();
  }

  onBeforeUnmount(() => {
    stop();
    detach();
  });

  return { stats, recording, elapsedMs, start, stop, reset };
}
