/**
 * 端口测试替身（RFC-0001）
 *
 * 与 `ports/` 下的生产适配器一一对应：核心编排只依赖端口，
 * 于是可以在 Node 环境用这些替身把生命周期、超时、清理顺序全部断言出来。
 *
 * 约定：所有替身都**记录调用序列**，并在「销毁之后仍收到写操作」时单独记为 violation ——
 * 那正是我们要消灭的那类 bug（父组件先销毁 viewer、子组件再访问）。
 */
import { vi } from 'vitest';
import type { GeoPoint, SceneDeps, SceneKit, SceneNotifier, SceneTimers, TimerId, ViewerPort } from '../ports/types';

/* ────────────────────────── 虚拟时钟 ────────────────────────── */

export interface FakeTimers extends SceneTimers {
  /** 同步推进虚拟时间，按到期顺序触发回调（含推进期间新排入且已到期的任务） */
  advance(ms: number): void;
  /** 尚未触发的定时器数量（用于断言"没有悬挂定时器"） */
  pendingCount(): number;
}

/** 可推进的虚拟时钟：替代 setTimeout，使超时分支可确定性断言 */
export function createFakeTimers(): FakeTimers {
  let now = 0;
  let nextId = 1;
  const tasks = new Map<number, { at: number; handler: () => void }>();

  return {
    now: () => now,

    setTimeout(handler, ms) {
      const id = nextId++;
      tasks.set(id, { at: now + ms, handler });
      // 虚拟时钟内部用数字编号；TimerId 是不透明句柄，此处是唯一一次强转（仅测试代码）
      return id as unknown as TimerId;
    },

    clearTimeout(id) {
      // 虚拟时钟内部用数字编号；TimerId 是不透明句柄（仅测试代码此处强转）
      tasks.delete(id as unknown as number);
    },

    advance(ms) {
      const target = now + ms;

      for (;;) {
        const due = [...tasks.entries()].filter(([, task]) => task.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;

        const [id, task] = due;
        tasks.delete(id);
        now = task.at;
        task.handler();
      }

      now = target;
    },

    pendingCount: () => tasks.size
  };
}

/* ────────────────────────── 场景造物替身 ────────────────────────── */

export interface FakeSceneKitResult {
  kit: SceneKit;
  /** 调用序列（按发生顺序） */
  log: string[];
  /** 销毁之后仍发生的写操作（必须为空） */
  violations: string[];
  destroyCount(): number;
  /** terrainProvider 被写入的次数 */
  terrainAssignments(): number;
  /** 地形 provider 就绪（在测试里手动驱动，用于"销毁后才回来"的场景） */
  resolveTerrain(): void;
  /** 地形 provider 失败 */
  rejectTerrain(error: unknown): void;
  /** toGeo 固定返回值 */
  setGeo(geo: GeoPoint | null): void;
  /** 相机高度固定返回值 */
  setCameraHeight(height: number): void;
}

/**
 * 假造物适配器。
 *
 * - 记录每一次端口调用与每一次原生销毁；
 * - `destroy()` 之后再发生的写操作会被记进 `violations`（断言用）；
 * - 地形 provider 的 promise 手动驱动，用于复现"异步结果在销毁之后才回来"。
 */
export function createFakeSceneKit(): FakeSceneKitResult {
  const log: string[] = [];
  const violations: string[] = [];
  let destroyed = false;
  let destroyCount = 0;
  let terrainAssignments = 0;
  let geo: GeoPoint | null = { longitude: 120.12345, latitude: 24.12345, height: 12.5 };
  let cameraHeight = 1000;
  let resolveTerrainFn: (() => void) | null = null;
  let rejectTerrainFn: ((error: unknown) => void) | null = null;
  const cameraListeners = new Set<() => void>();

  function mark(op: string) {
    log.push(op);
    if (destroyed) violations.push(op);
  }

  const fakeViewer: ViewerPort = {
    canvas: { toDataURL: () => 'data:image/png;base64,AAAA' } as unknown as HTMLCanvasElement,

    camera: {
      flyToGeo: (point, duration) =>
        mark(`camera.flyToGeo(${point.longitude},${point.latitude},${point.height},${duration})`),
      zoomIn: amount => mark(`camera.zoomIn(${amount})`),
      zoomOut: amount => mark(`camera.zoomOut(${amount})`),
      rotate: radians => mark(`camera.rotate(${radians})`),
      pitch: radians => mark(`camera.pitch(${radians})`),
      height: () => cameraHeight,
      pickGlobe: () => (geo ? { opaque: true } : null),
      onChange: listener => {
        cameraListeners.add(listener);
        mark('camera.onChange');
      },
      offChange: listener => {
        cameraListeners.delete(listener);
        mark('camera.offChange');
      },
      percentageChanged: 1
    },

    scene: {
      requestRender: () => mark('scene.requestRender'),
      render: () => mark('scene.render'),
      mode: () => '3D',
      morphTo2D: duration => mark(`scene.morphTo2D(${duration})`),
      morphTo3D: duration => mark(`scene.morphTo3D(${duration})`),
      setController: patch => mark(`scene.setController(${Object.keys(patch).sort().join('+')})`),
      globe: {
        setDepthTestAgainstTerrain: on => mark(`globe.depthTest(${on})`),
        setTranslucency: options => mark(`globe.translucency(${options.frontFaceAlpha})`)
      }
    },

    imageryLayers: {
      removeAll: () => mark('imagery.removeAll'),
      addImageryProvider: () => {
        mark('imagery.add');
        return {} as never;
      },
      setVisible: (_layer, visible) => mark(`imagery.visible=${visible}`),
      setOpacity: (_layer, opacity) => mark(`imagery.opacity=${opacity}`)
    },

    get terrainProvider() {
      return undefined;
    },
    set terrainProvider(_value) {
      mark('viewer.setTerrain');
      terrainAssignments += 1;
    },

    isDestroyed: () => destroyed,
    destroy: () => {
      log.push('viewer.destroy');
      destroyCount += 1;
      destroyed = true;
    },
    rawViewer: () => {
      mark('viewer.rawViewer');
      return { fakeViewer: true };
    }
  };

  const kit: SceneKit = {
    createViewer: () => {
      mark('kit.createViewer');
      return fakeViewer;
    },
    createEventHandler: () => {
      mark('kit.createEventHandler');
      return {
        setInputAction: (_action, type) => mark(`handler.setInputAction(${type})`),
        destroy: () => mark('handler.destroy')
      };
    },
    toGeo: () => geo,
    createDefaultImageryProviders: () => {
      mark('kit.imageryProviders');
      return [{} as never];
    },
    createTerrainProvider: () => {
      mark('kit.createTerrain');
      return new Promise((resolve, reject) => {
        // 只对外暴露"无参触发"，不让 Promise 的 resolve 签名泄漏到替身 API 上
        resolveTerrainFn = () => resolve({ fake: 'terrain' } as never);
        rejectTerrainFn = error => reject(error);
      });
    },
    inputTypes: { MOUSE_MOVE: 0, LEFT_CLICK: 2 }
  };

  return {
    kit,
    log,
    violations,
    destroyCount: () => destroyCount,
    terrainAssignments: () => terrainAssignments,
    resolveTerrain: () => resolveTerrainFn?.(),
    rejectTerrain: error => rejectTerrainFn?.(error),
    setGeo: value => {
      geo = value;
    },
    setCameraHeight: value => {
      cameraHeight = value;
    }
  };
}

/* ────────────────────────── 提示替身 ────────────────────────── */

export interface FakeNotifyResult {
  port: SceneNotifier;
  /** 提示记录：`success` / `warning` / `error` */
  messages: Array<{ level: string; text: string }>;
  /** 尚未释放的常驻提示数量 */
  activeLoading(): number;
}

export function createFakeNotify(): FakeNotifyResult {
  const messages: FakeNotifyResult['messages'] = [];
  const actives = new Set<symbol>();

  return {
    port: {
      success: text => messages.push({ level: 'success', text }),
      warning: text => messages.push({ level: 'warning', text }),
      error: text => messages.push({ level: 'error', text }),
      loading: text => {
        messages.push({ level: 'loading', text });
        const token = Symbol('loading');
        actives.add(token);
        return {
          dispose: () => {
            actives.delete(token);
          }
        };
      }
    },
    messages,
    activeLoading: () => actives.size
  };
}

/* ────────────────────────── 依赖集合装配 ────────────────────────── */

/**
 * 组装一份"全替身"的依赖集合：核心测试只需要替换自己关心的那一两项。
 */
export function createStubSceneDeps(overrides: Partial<SceneDeps> = {}): SceneDeps {
  const kit = overrides.kit ?? createFakeSceneKit().kit;
  const notify = overrides.notify ?? createFakeNotify().port;

  return {
    kit,
    notify,
    config: {
      publicBaseUrl: () => '/',
      serviceBaseUrl: () => '/api',
      imagery: () => ({}) as never,
      terrain: () => ({}) as never,
      serviceTimeoutMs: 8000
    },
    timers: createFakeTimers(),
    services: { listEnabled: async () => [] },
    vector: { extent: async () => null, tileUrl: () => null },
    exporter: { saveDataUrl: vi.fn() },
    ...overrides
  };
}
