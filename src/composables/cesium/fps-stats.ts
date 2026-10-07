/**
 * 帧率统计（纯函数，不碰 DOM 与 Cesium）
 *
 * 两个刻意的口径，都是为了让读数能拿去验收：
 *  1. **静默期不计入**：切页、后台挂起时根本没有渲染，把这段空档算进平均帧率
 *     会把「其实很流畅」的场景算成不合格；超过 `silenceMs` 没有新帧即视为静默，
 *     窗口清空、该段不计入时长。
 *  2. **最低帧率取「每满一个窗口的读数」的最小值**：不能用单帧间隔反推（一帧抖动就误报），
 *     也不能被后面的流畅段洗白——所以 `min` 只降不升，直到 `reset()`。
 *
 * 用法：每渲染一帧调用一次 `tick(performance.now())`。
 */

export interface FpsStats {
  /** 1 秒滑动窗口内的实时帧率 */
  current: number;
  /** 会话平均帧率（不含静默期） */
  average: number;
  /** 会话最低帧率（按满窗口读数取最小，只降不升） */
  min: number;
  /** 已统计的帧数 */
  frames: number;
}

export interface FpsStatsOptions {
  /** 实时读数的滑动窗口（毫秒），默认 1000 */
  windowMs?: number;
  /** 超过该间隔没有新帧即视为静默（切页/后台），默认 1000 */
  silenceMs?: number;
}

export interface FpsStatsRecorder {
  /** 每渲染一帧调用一次 */
  tick(timestampMs: number): void;
  /** 读取当前统计快照 */
  read(): FpsStats;
  /** 开始新会话（清零平均与最低值） */
  reset(): void;
}

const DEFAULT_WINDOW_MS = 1000;
const DEFAULT_SILENCE_MS = 1000;

export function createFpsStats(options: FpsStatsOptions = {}): FpsStatsRecorder {
  const windowMs = options.windowMs && options.windowMs > 0 ? options.windowMs : DEFAULT_WINDOW_MS;
  const silenceMs = options.silenceMs && options.silenceMs > 0 ? options.silenceMs : DEFAULT_SILENCE_MS;

  /** 当前窗口内的帧时间戳（队首最早） */
  let windowTimestamps: number[] = [];
  /** 会话内累计的有效时长（毫秒，不含静默期） */
  let activeMs = 0;
  /** 会话内累计的有效间隔数（帧率 = 间隔数 / 时长） */
  let intervals = 0;
  let frames = 0;
  let lastTimestamp: number | null = null;
  let current = 0;
  let min = Number.POSITIVE_INFINITY;

  function tick(timestampMs: number): void {
    if (lastTimestamp !== null) {
      const gap = timestampMs - lastTimestamp;
      if (gap > silenceMs) {
        // 静默：丢弃窗口，本帧只作为新段起点，空档不计入时长
        windowTimestamps = [];
        lastTimestamp = timestampMs;
        return;
      }
      activeMs += gap;
      intervals += 1;
    }

    lastTimestamp = timestampMs;
    frames += 1;
    windowTimestamps.push(timestampMs);

    const windowStart = timestampMs - windowMs;
    while (windowTimestamps.length > 0 && windowTimestamps[0] < windowStart) {
      windowTimestamps.shift();
    }

    const span = timestampMs - windowTimestamps[0];
    if (windowTimestamps.length >= 2 && span > 0) {
      current = ((windowTimestamps.length - 1) * 1000) / span;
      // 只把「已经攒满一窗」的读数纳入最低值，避免启动瞬间的短窗误报
      if (span >= windowMs * 0.9) {
        min = Math.min(min, current);
      }
    }
  }

  function read(): FpsStats {
    return {
      current,
      average: activeMs > 0 ? intervals / (activeMs / 1000) : 0,
      min: Number.isFinite(min) ? min : 0,
      frames
    };
  }

  function reset(): void {
    windowTimestamps = [];
    activeMs = 0;
    intervals = 0;
    frames = 0;
    lastTimestamp = null;
    current = 0;
    min = Number.POSITIVE_INFINITY;
  }

  return { tick, read, reset };
}
