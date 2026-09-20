/**
 * 场景内核（RFC-0001 · 第 2 步）
 *
 * 把原先散在 `use-cesium-base.ts` 里的生命周期与基础能力收进一个**不依赖 Cesium**
 * 的核心：它只认 `ports/types.ts` 里的端口，因此可以在 Node 环境用替身完整测试
 * （挂载序列、超时、清理顺序、幂等）。
 *
 * 三条不变量由 `lifecycle.ts` 的清理栈结构性保证：
 *   1. 顺序：Viewer 最先创建 → 最先入栈 → **最后销毁**；事件处理器、相机监听先于它释放。
 *      这消除了「父组件先销毁 viewer、子组件再访问 camera 抛错并打断路由」那一类事故。
 *   2. 幂等：`dispose()` 重复调用只清理一次。
 *   3. 异步兜底：所有异步回调（地形、provider、事件）落地前都过一遍 `alive`，
 *      销毁后到达的结果一律短路，不再需要各处手写 `isDestroyed()` 守卫。
 */
import { ref, shallowRef, type Ref } from 'vue';
import type { BaseStatusInfo } from '@/typings/cesium';
import { createDisposalRegistry, type DisposalRegistry } from './lifecycle';
import { createLayerRegistry, type LayerRegistry, type LayerTarget } from './layer-registry';
import type { InputHandlerPort, SceneDeps, ScreenPoint, ViewerPort } from '../ports/types';

/** 坐标浮窗内容（与现状字段一致） */
export interface CursorInfo {
  longitude: string;
  latitude: string;
  altitude: string;
  cameraHeight: string;
}

/** 挂载钩子：与 `ViewerInitHooks` 对应，但拿到的是端口而不是原生 Viewer */
export interface SceneHooks {
  /** 影像层加载前（模块做 scene / 相机控制器等专属配置） */
  prepare?(viewer: ViewerPort): void;
  /** 影像层加载完成后、mount 返回前 */
  afterImagery?(viewer: ViewerPort): void;
  /** 异步版本，等它完成 mount 才返回 */
  afterImageryAsync?(viewer: ViewerPort): Promise<void>;
}

export interface SceneOptions {
  /** 依赖集合（生产用 `createBrowserSceneDeps()`，测试用替身） */
  deps: SceneDeps;
  /** Viewer 选项覆盖（默认与现状一致，见造物适配器） */
  viewer?: Record<string, unknown>;
  /** 是否挂载 config.json 兜底影像（默认 true） */
  baseImagery?: boolean;
  /** 是否异步加载 config.json 地形（默认 true） */
  terrain?: boolean;
}

export interface MouseEventHandlers {
  onMouseMove?: (movement: { endPosition: ScreenPoint }) => void;
  onLeftClick?: (event: { position: ScreenPoint }) => void;
}

export interface Scene {
  /** 模板绑定的容器：`<div ref="scene.container">` */
  container: Ref<HTMLElement | null>;
  readonly deps: SceneDeps;
  readonly alive: boolean;
  readonly is2d: Ref<boolean>;
  readonly cursor: Ref<CursorInfo>;
  /** 当前兜底/服务影像层（不透明句柄，由调用方按需转型） */
  readonly imageryLayers: unknown[];

  /** 幂等：容器缺失或已挂载时直接返回 */
  mount(hooks?: SceneHooks): Promise<void>;
  /**
   * 追加 config.json 兜底影像。
   *
   * 供 `applyServices` 在清空服务影像后回退使用（调用方先自行 removeAll），
   * 与挂载时的兜底走同一份构造代码，避免两处各写一遍。
   */
  addFallbackImagery(): void;

  /** 图层显隐真相登记表（每个 key 的归属明确，见 `layer-registry.ts`） */
  readonly layers: LayerRegistry;
  /** 底图（config.json 兜底影像）显隐：模块的"底图"开关走这里 */
  setBaseImageryVisible(visible: boolean): void;
  /** 幂等：先让 `alive` 失效，再逆序清理 */
  dispose(): Promise<void>;

  /** 逃生口：需要 Cesium 原生能力时用（显式命名，集中审计） */
  viewerPort(): ViewerPort | null;

  requestRender(): void;
  flyTo(longitude: number, latitude: number, height?: number, duration?: number): void;
  zoomIn(amount?: number): void;
  zoomOut(amount?: number): void;
  rotate(radians?: number): void;
  pitch(radians?: number): void;
  toggleViewMode(): void;
  setGlobeSurfaceTranslucent(enabled: boolean): void;
  bindMouseEvents(handlers: MouseEventHandlers): void;
  onCameraChange(listener: () => void): void;
  offCameraChange(listener: () => void): void;
  getCartesianFromScreen(position: ScreenPoint): unknown | null;
  computeBaseStatus(cartesian?: unknown | null): BaseStatusInfo;
  createEmitStatus<T extends Record<string, unknown>>(
    extraFields: () => T
  ): (cartesian?: unknown | null) => BaseStatusInfo & T;
  exportScreenshot(filename: string): void;
}

/** 与现状一致的默认值 */
const DEFAULT_FLY_HEIGHT = 20000;
const DEFAULT_FLY_DURATION = 1.3;
const DEFAULT_ZOOM_AMOUNT = 3000;
const DEFAULT_ROTATE_RADIANS = (12 * Math.PI) / 180;
const DEFAULT_PITCH_RADIANS = (8 * Math.PI) / 180;

/**
 * config.json 兜底影像在登记表里的 key。
 *
 * 兜底影像可能有两层（全局底图 + 区域叠加），它们共享一个 key：面板上的"底图"开关
 * 对它们是一个整体。数据服务影像各有自己的 key，因此"关底图"不会再误伤服务影像
 * （RFC-0001 第 3 步）。
 */
export const FALLBACK_IMAGERY_KEY = 'fallback-imagery';

export function createScene(options: SceneOptions): Scene {
  const { deps } = options;

  const container = shallowRef<HTMLElement | null>(null);
  const is2d = ref(false);
  const cursor = ref<CursorInfo>({ longitude: '--', latitude: '--', altitude: '--', cameraHeight: '--' });
  const imageryLayers: unknown[] = [];

  const registry: DisposalRegistry = createDisposalRegistry(error => {
    // teardown 阶段向外抛错会打断调用方（例如路由跳转），只记录
    console.warn('[Scene] 清理动作失败（已忽略，不影响其它清理）', error);
  });

  /** 图层显隐真相（Cesium 图层只是投影，见 `layer-registry.ts`） */
  const layers = createLayerRegistry();

  let viewer: ViewerPort | null = null;
  let eventHandler: InputHandlerPort | null = null;
  const cameraListeners = new Set<() => void>();
  let surfaceTranslucent = false;

  function alive(): boolean {
    return viewer !== null && !viewer.isDestroyed();
  }

  /**
   * 追加 config.json 兜底影像（不做 removeAll：清空与否由调用方决定）。
   *
   * 生成后统一绑定到 `FALLBACK_IMAGERY_KEY`：`attach` 会立即回放当前真相，
   * 因此重建/追加出来的新图层不会沿用 Cesium 默认的 `show = true`
   * —— 这正是"隐藏过的图层自己亮回来"那个缺陷的结构性修复。
   */
  function appendDefaultImagery(port: ViewerPort) {
    const targets: LayerTarget[] = [];
    for (const provider of deps.kit.createDefaultImageryProviders()) {
      try {
        const layer = port.imageryLayers.addImageryProvider(provider);
        imageryLayers.push(layer);
        targets.push({
          setVisible: visible => port.imageryLayers.setVisible(layer, visible),
          setOpacity: opacity => port.imageryLayers.setOpacity(layer, opacity)
        });
      } catch (error) {
        console.warn('[Scene] 兜底影像加载失败', error);
      }
    }
    layers.attach(FALLBACK_IMAGERY_KEY, targets);
  }

  async function mount(hooks?: SceneHooks) {
    const el = container.value;
    if (!el || viewer) return; // 幂等：容器未就绪或已挂载

    const port = deps.kit.createViewer(el, { ...options.viewer });
    viewer = port;

    // ① 最早入栈 → 最后执行：Viewer 一定晚于挂在它上面的一切资源被销毁
    registry.push(() => {
      if (!port.isDestroyed()) port.destroy();
    });
    // ② 事件处理器必须在 viewer 之前销毁（它由 viewer.scene.canvas 构造）
    registry.push(() => {
      eventHandler?.destroy();
      eventHandler = null;
    });
    // ③ 相机监听同理
    registry.push(() => {
      cameraListeners.forEach(listener => port.camera.offChange(listener));
      cameraListeners.clear();
    });

    hooks?.prepare?.(port);

    // 先确立兜底影像的真相（默认可见）；已登记则不覆盖 ——
    // 用户在挂载前就关掉底图（例如模块初始化时 syncLayerVisibility）也能生效
    layers.register(FALLBACK_IMAGERY_KEY);

    if (options.baseImagery !== false) {
      port.imageryLayers.removeAll();
      imageryLayers.splice(0, imageryLayers.length);
      appendDefaultImagery(port);
    }

    if (options.terrain !== false) {
      // 异步不阻塞初始化；回来时若已销毁则静默丢弃（不再需要各处 isDestroyed 守卫）
      void deps.kit
        .createTerrainProvider()
        .then(provider => {
          if (!provider || !alive()) return;
          const current = viewer;
          if (!current) return;
          current.terrainProvider = provider;
        })
        .catch(error => {
          console.warn('[Scene] 地形加载失败', error);
        });
    }

    await hooks?.afterImageryAsync?.(port);
    hooks?.afterImagery?.(port);
  }

  function addFallbackImagery() {
    const port = viewer;
    if (!port || !alive()) return;
    appendDefaultImagery(port);
  }

  /**
   * 底图（config.json 兜底影像）显隐。
   *
   * 模块的"底图"开关此前是遍历 `base.imageryLayers` 逐层写 `show`，
   * 而该数组里同时混着数据服务影像 —— 关底图会把服务影像一起关掉。
   * 现在只改这一个 key，服务影像各自由面板控制。
   */
  function setBaseImageryVisible(visible: boolean) {
    layers.setVisible(FALLBACK_IMAGERY_KEY, visible);
  }

  async function dispose() {
    // 先让 alive 失效：teardown 期间到达的异步回调一律短路
    viewer = null;
    // runAll 在清理动作全为同步时会同步跑完整栈（见 lifecycle.ts），
    // 因此调用方在 destroyViewer() 返回时 Viewer 已经销毁，行为与重构前一致。
    await registry.runAll();
    eventHandler = null;
  }

  function requestRender() {
    if (!alive()) return;
    viewer?.scene.requestRender();
  }

  function flyTo(longitude: number, latitude: number, height = DEFAULT_FLY_HEIGHT, duration = DEFAULT_FLY_DURATION) {
    if (!alive()) return;
    viewer?.camera.flyToGeo({ longitude, latitude, height }, duration);
  }

  function zoomIn(amount = DEFAULT_ZOOM_AMOUNT) {
    if (!alive()) return;
    viewer?.camera.zoomIn(amount);
  }

  function zoomOut(amount = DEFAULT_ZOOM_AMOUNT) {
    if (!alive()) return;
    viewer?.camera.zoomOut(amount);
  }

  function rotate(radians = DEFAULT_ROTATE_RADIANS) {
    if (!alive()) return;
    viewer?.camera.rotate(radians);
  }

  function pitch(radians = DEFAULT_PITCH_RADIANS) {
    if (!alive()) return;
    viewer?.camera.pitch(radians);
  }

  function toggleViewMode() {
    const port = viewer;
    if (!port || !alive()) return;

    if (is2d.value) {
      // 切回 3D：恢复旋转与倾斜
      port.scene.morphTo3D(0);
      port.scene.setController({ enableRotate: true, enableTilt: true });
    } else {
      // 切到 2D：关闭旋转与倾斜（平面视图下无意义且会误操作）
      port.scene.morphTo2D(0);
      port.scene.setController({ enableRotate: false, enableTilt: false });
    }

    is2d.value = !is2d.value;
  }

  function setGlobeSurfaceTranslucent(enabled: boolean) {
    const port = viewer;
    if (!port || !alive() || surfaceTranslucent === enabled) return;
    surfaceTranslucent = enabled;

    port.scene.globe.setTranslucency({
      enabled,
      frontFaceAlpha: enabled ? 0.32 : 1.0,
      backFaceAlpha: enabled ? 0.12 : 1.0
    });
    // 透视模式需要地表参与深度测试，否则半透明混合顺序不正确
    port.scene.globe.setDepthTestAgainstTerrain(enabled);
    // 地下漫游：关闭相机碰撞检测并放宽最小缩放距离，允许贴近视点观察
    port.scene.setController({
      enableCollisionDetection: !enabled,
      minimumZoomDistance: enabled ? 0.2 : 1.0
    });

    requestRender();
  }

  function getCartesianFromScreen(position: ScreenPoint): unknown | null {
    if (!alive()) return null;
    return viewer?.camera.pickGlobe(position) ?? null;
  }

  function bindMouseEvents(handlers: MouseEventHandlers) {
    const port = viewer;
    if (!port || !alive()) return;

    eventHandler?.destroy();
    const handler = deps.kit.createEventHandler(port.canvas);
    eventHandler = handler;

    handler.setInputAction(event => {
      const movement = event as { endPosition: ScreenPoint };
      const cartesian = port.camera.pickGlobe(movement.endPosition);
      const geo = cartesian ? deps.kit.toGeo(cartesian) : null;

      cursor.value = geo
        ? {
            longitude: `${geo.longitude.toFixed(5)}°`,
            latitude: `${geo.latitude.toFixed(5)}°`,
            altitude: `${Math.max(geo.height, 0).toFixed(0)} m`,
            cameraHeight: `${(port.camera.height() / 1000).toFixed(1)} km`
          }
        : { longitude: '--', latitude: '--', altitude: '--', cameraHeight: '--' };

      handlers.onMouseMove?.(movement);
    }, deps.kit.inputTypes.MOUSE_MOVE);

    if (handlers.onLeftClick) {
      handler.setInputAction(handlers.onLeftClick as (event: unknown) => void, deps.kit.inputTypes.LEFT_CLICK);
    }
  }

  function onCameraChange(listener: () => void) {
    cameraListeners.add(listener);
    viewer?.camera.onChange(listener);
  }

  function offCameraChange(listener: () => void) {
    cameraListeners.delete(listener);
    viewer?.camera.offChange(listener);
  }

  function computeBaseStatus(cartesian?: unknown | null): BaseStatusInfo {
    const port = viewer;
    const cameraHeight = port ? port.camera.height() : 0;
    const geo = cartesian && port ? deps.kit.toGeo(cartesian) : null;

    return {
      longitude: geo ? geo.longitude.toFixed(4) : '--',
      latitude: geo ? geo.latitude.toFixed(4) : '--',
      altitude: geo ? `${Math.max(geo.height, 0).toFixed(0)} m` : '--',
      cameraHeight: `${(cameraHeight / 1000).toFixed(1)} km`
    } as BaseStatusInfo;
  }

  function createEmitStatus<T extends Record<string, unknown>>(
    extraFields: () => T
  ): (cartesian?: unknown | null) => BaseStatusInfo & T {
    return (cartesian?: unknown | null) =>
      ({ ...computeBaseStatus(cartesian), ...extraFields() }) as BaseStatusInfo & T;
  }

  function exportScreenshot(filename: string) {
    const port = viewer;
    if (!port || !alive()) return;

    try {
      // 强制同步渲染，确保画布内容是最新的
      port.scene.render();
      deps.exporter.saveDataUrl(port.canvas.toDataURL('image/png'), filename);
      deps.notify.success('已导出当前视角截图');
    } catch (error) {
      console.error('[Screenshot] 导出失败:', error);
      deps.notify.error('截图导出失败');
    }
  }

  return {
    container,
    deps,
    get alive() {
      return alive();
    },
    is2d,
    cursor,
    imageryLayers,
    layers,
    mount,
    addFallbackImagery,
    setBaseImageryVisible,
    dispose,
    viewerPort: () => viewer,
    requestRender,
    flyTo,
    zoomIn,
    zoomOut,
    rotate,
    pitch,
    toggleViewMode,
    setGlobeSurfaceTranslucent,
    bindMouseEvents,
    onCameraChange,
    offCameraChange,
    getCartesianFromScreen,
    computeBaseStatus,
    createEmitStatus,
    exportScreenshot
  };
}
