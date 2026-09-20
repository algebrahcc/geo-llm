/**
 * Cesium Viewer 基础 Composable（RFC-0001 · 第 2 步：改为薄壳）
 *
 * 对外 API 与重构前**逐项一致**（`CesiumBaseReturn` 未动一个字段），
 * 因此 `cesium-viewer.vue` 与各业务模块零改动。
 *
 * 内部职责已经换位：
 *   - 生命周期、影像/地形、事件与坐标浮窗、镜头、2D3D、透视、截图 → `scene/create-scene.ts` 核心；
 *   - 本文件只做三件事：① 把 Cesium 类型与端口类型在边界处对接（一次转型，集中可审计）；
 *     ② 保留必须依赖组件实例的能力（`onBeforeUnmount`）；③ 保留 `applyServices` 这段服务层逻辑
 *     （它的合并属于后续步骤，此处只把重复的 provider 构造与超时常量改为复用核心）。
 *
 * 由此获得的可验证收益：本文件的 `isDestroyed()` 守卫由 3 处收敛为 1 处
 * （仅剩 `applyServices` 的地形兜底，将在服务层合并时一并吸收），
 * 其余"销毁后访问"风险由核心的单个 `alive` 判断与 LIFO 清理栈统一承担；
 * 清理顺序也由 `scene/lifecycle.ts` 结构性保证（子资源先释放、Viewer 最后销毁），
 * 不再依赖各处手写 try/catch。
 */
import { onBeforeUnmount, shallowRef, type Ref } from 'vue';
import { Color } from 'cesium';
import type { Cartesian2, Cartesian3, ImageryLayer, Viewer } from 'cesium';
import { loadService, type ServiceLayerHandle } from './service-loader';
import { createScene, type MouseEventHandlers } from './scene/create-scene';
import { createBrowserSceneDeps } from './scene/browser-deps';
import { withTimeout } from './scene/lifecycle';
import { createTerrainProvider } from '@/utils/terrain';
import type { BaseStatusInfo } from '@/typings/cesium';

export interface ViewerInitHooks {
  /** 在影像层加载前执行（用于 scene 全局配置、camera 控制器等） */
  prepareViewer?: (viewer: Viewer) => void;
  /** 在影像层加载完成后、initViewer 返回前执行 */
  afterImagery?: (viewer: Viewer) => void;
  /** 在影像层加载完成后、initViewer 返回前执行（异步版本，等它完成后才返回） */
  afterImageryAsync?: (viewer: Viewer) => Promise<void>;
}

export interface CesiumBaseReturn {
  /** 地表透视（地下模式）：globe 半透明，透视查看地下要素 */
  setGlobeSurfaceTranslucent: (enabled: boolean) => void;
  /**
   * 底图（config.json 兜底影像）显隐。
   *
   * 模块的"底图"开关必须走这里，不能再遍历 `imageryLayers` 逐层写 `show`：
   * 该数组中同时混着数据服务影像，逐层写会把它一起关掉并覆盖服务面板的眼睛状态。
   */
  setBaseImageryVisible: (visible: boolean) => void;
  containerRef: Ref<HTMLDivElement | null>;
  viewerRef: Ref<Viewer | null>;
  imageryLayers: ImageryLayer[];
  initViewer: (hooks?: ViewerInitHooks) => Promise<void>;
  destroyViewer: () => void;
  /** 应用数据服务：按 enabled+sort 重建影像/地形层，存在服务时替换 config.json 兜底 */
  applyServices: (services: Api.DataService.DataServiceItem[], handles?: ServiceLayerHandle[]) => Promise<void>;

  /** 工具函数 */
  requestRender: () => void;
  getColor: (css: string, alpha?: number) => Color;
  getCartesianFromScreen: (position: Cartesian2) => Cartesian3 | null;

  /** 当前鼠标在地球表面的经纬度/地表高程/视点高度，供 Viewer 右下角坐标浮窗展示 */
  cursorCoordinates: Ref<{
    longitude: string;
    latitude: string;
    altitude: string;
    cameraHeight: string;
  }>;

  /** 构建带模块扩展字段的 emitStatus */
  createEmitStatus: <T extends Record<string, unknown>>(
    extraFieldsFn: () => T
  ) => (cartesian?: Cartesian3 | null) => BaseStatusInfo & T;

  /** 仅计算基础状态字段（不含扩展字段），供 building 模块等特殊场景使用 */
  computeBaseStatus: (cartesian?: Cartesian3 | null) => {
    longitude: string;
    latitude: string;
    altitude: string;
    cameraHeight: string;
  };

  /** 绑定鼠标与 Camera 事件 */
  bindMouseEvents: (handlers: {
    onMouseMove?: (movement: { endPosition: Cartesian2 }) => void;
    onLeftClick?: (event: { position: Cartesian2 }) => void;
  }) => void;

  /** 注册 camera.changed 监听（支持批量注册） */
  addCameraChangeListener: (listener: () => void) => void;
  removeCameraChangeListener: (listener: () => void) => void;

  /** 镜头控制 */
  flyToLocation: (longitude: number, latitude: number, height?: number, duration?: number) => void;
  zoomIn: (amount?: number) => void;
  zoomOut: (amount?: number) => void;
  rotate: (radians?: number) => void;
  pitch: (radians?: number) => void;

  /** 导出截图 */
  exportScreenshot: (filename: string) => void;

  /** 2D / 3D 视图切换 */
  is2dMode: Ref<boolean>;
  toggleViewMode: () => void;
}

/**
 * Cesium Viewer 基础 Composable
 *
 * 封装所有模块公用的 Viewer 生命周期、影像层加载、事件管理、镜头控制，
 * 减少 useCesiumRiver / useCesiumPlanning / useCesiumGlobe / useBuildingModel
 * 之间的重复代码。
 */
export function useCesiumBase(): CesiumBaseReturn {
  const scene = createScene({ deps: createBrowserSceneDeps() });

  // 与核心共用同一批响应式对象 / 数组实例，避免出现两份状态
  const containerRef = scene.container as Ref<HTMLDivElement | null>;
  const imageryLayers = scene.imageryLayers as ImageryLayer[];
  const cursorCoordinates = scene.cursor;
  const is2dMode = scene.is2d;

  /**
   * 原生 Viewer 句柄。
   *
   * 核心内部只持有 `ViewerPort`；此处通过显式逃生口取回原生实例并暴露为 `viewerRef`，
   * 因为大量模块仍直接使用 `viewer.entities` / `dataSources` / `scene` 等能力。
   * 待后续步骤把这些用法逐个收进端口后，这个 ref 就能继续收窄。
   */
  const viewerRef: Ref<Viewer | null> = shallowRef(null);

  // ─── Viewer 生命周期 ─────────────────────────────────

  async function initViewer(hooks?: ViewerInitHooks) {
    await scene.mount({
      prepare: port => {
        const viewer = port.rawViewer() as Viewer;
        viewerRef.value = viewer;
        hooks?.prepareViewer?.(viewer);
      },
      afterImagery: port => {
        hooks?.afterImagery?.(port.rawViewer() as Viewer);
      },
      afterImageryAsync: async port => {
        await hooks?.afterImageryAsync?.(port.rawViewer() as Viewer);
      }
    });
  }

  function destroyViewer() {
    // 核心先让 alive 失效、再逆序清理（事件处理器/相机监听 → Viewer）。
    // 清理动作全为同步，因此本函数返回时 Viewer 已销毁（与重构前一致）。
    void scene.dispose();
    viewerRef.value = null;
  }

  /**
   * 应用数据服务（设计文档 5.4 第 2 条）：
   * 移除服务加载的影像/地形层，按 enabled+sort 重建；
   * 存在 imagery & enabled=1 时替换 config.json 兜底影像，否则回退兜底。
   * handles 可传入 useCesiumServices 已加载的句柄以复用（避免重复创建）。
   */
  async function applyServices(services: Api.DataService.DataServiceItem[], handles?: ServiceLayerHandle[]) {
    const viewer = viewerRef.value;
    if (!viewer) return;

    const { serviceTimeoutMs } = scene.deps.config;

    const imageryList = services
      .filter(s => s.category === 'imagery' && Number(s.enabled) === 1)
      .sort((a, b) => a.sort - b.sort);
    const terrainList = services
      .filter(s => s.category === 'terrain' && Number(s.enabled) === 1)
      .sort((a, b) => a.sort - b.sort);

    // 1) 清空现有影像层（含兜底与既有服务层）
    viewer.imageryLayers.removeAll();
    imageryLayers.splice(0, imageryLayers.length);

    // 2) 按 enabled+sort 重建影像层；无服务影像时回退 config.json 兜底
    if (imageryList.length > 0) {
      for (const s of imageryList) {
        const reused = handles?.find(h => h.id === s.id && h.layer);
        if (reused?.layer) {
          // removeAll 后旧 layer 已失效，用同一 provider 重建新 layer 并回写到句柄，
          // 保证后续 show/hide/透明度 仍作用于 viewer 上实际显示的图层
          reused.layer = viewer.imageryLayers.addImageryProvider(reused.layer.imageryProvider);
          // 重建出的新 layer 默认 show=true：这里把句柄上的用户意图回放回去，
          // 否则用户关掉的层会在 applyServices 之后自己亮回来。
          // 同一约定见 service-loader.ts:894（加载完成时也以用户意图为准）。
          reused.layer.show = reused.visible;
          // 透明度同理：重建后 alpha 会回到 1，需把用户意图回放回去
          reused.layer.alpha = reused.opacity ?? 1;
          imageryLayers.push(reused.layer);
          continue;
        }
        try {
          const handle = await loadService(s, viewer);
          if (handle.layer) imageryLayers.push(handle.layer);
        } catch (e) {
          console.warn(`[DataService] 影像服务加载失败: ${s.name}`, e);
        }
      }
      // 数据服务影像全部加载失败时，回退 config.json 兜底，避免球上无底图
      if (imageryLayers.length === 0) {
        scene.addFallbackImagery();
      }
    } else {
      scene.addFallbackImagery();
    }

    // 3) 地形：有启用的地形服务则替换，否则回退 config.json 兜底
    const fallbackTerrain = () => {
      createTerrainProvider().then(provider => {
        const v = viewerRef.value;
        if (provider && v && !v.isDestroyed()) {
          v.terrainProvider = provider;
        }
      });
    };
    if (terrainList.length > 0) {
      // 按 id 查找而非限定 state==='ready'：句柄已存在就说明 useCesiumServices 尝试过，
      // 否则这里会对不可达的服务重复发起请求、再次挂起（服务不通时等于卡住初始化）。
      const existing = handles?.find(h => h.id === terrainList[0].id);
      if (existing?.state === 'ready') {
        // createTerrainHandle 内已把 provider 应用到 viewer，无需重复加载
      } else if (existing) {
        // loading / error：等 useCesiumServices 的结果，这里只做兜底地形
        fallbackTerrain();
      } else {
        // 句柄不存在（applyServices 被独立调用）：带超时兜底加载一次
        try {
          await withTimeout(
            loadService(terrainList[0], viewer),
            serviceTimeoutMs,
            `地形服务 ${serviceTimeoutMs / 1000}s 未响应`,
            scene.deps.timers
          );
        } catch (e) {
          console.warn(`[DataService] 地形服务加载失败: ${terrainList[0].name}`, e);
          fallbackTerrain();
        }
      }
    } else {
      fallbackTerrain();
    }

    viewer.scene?.requestRender();
  }

  // ─── 工具函数 ─────────────────────────────────────

  function getColor(css: string, alpha = 1) {
    return Color.fromCssColorString(css).withAlpha(alpha);
  }

  // ─── 端口 ↔ Cesium 类型边界 ────────────────────────
  //
  // 以下几处是整套重构里仅有的"转型"点：核心用不透明类型表达（以便彻底不依赖 Cesium），
  // 薄壳在边界处恢复对外契约的精确类型。集中在此，便于审计。

  function getCartesianFromScreen(position: Cartesian2): Cartesian3 | null {
    return scene.getCartesianFromScreen(position) as Cartesian3 | null;
  }

  function createEmitStatus<T extends Record<string, unknown>>(
    extraFieldsFn: () => T
  ): (cartesian?: Cartesian3 | null) => BaseStatusInfo & T {
    const emit = scene.createEmitStatus(extraFieldsFn);
    return (cartesian?: Cartesian3 | null) => emit(cartesian);
  }

  function computeBaseStatus(cartesian?: Cartesian3 | null) {
    return scene.computeBaseStatus(cartesian);
  }

  /**
   * 鼠标事件绑定：公共契约用 `Cartesian2`，核心用不透明的 `ScreenPoint`。
   * 两者结构兼容（`Cartesian2` 可直接当 `{ x, y }` 使用），但回调参数方向是逆变的，
   * 故此处做一次显式转型 —— 与上面几处同属"端口 ↔ Cesium 类型边界"。
   */
  function bindMouseEvents(handlers: {
    onMouseMove?: (movement: { endPosition: Cartesian2 }) => void;
    onLeftClick?: (event: { position: Cartesian2 }) => void;
  }) {
    scene.bindMouseEvents(handlers as MouseEventHandlers);
  }

  // ─── 自动清理 ─────────────────────────────────────

  onBeforeUnmount(destroyViewer);

  return {
    containerRef,
    viewerRef,
    imageryLayers,
    initViewer,
    destroyViewer,
    applyServices,
    requestRender: scene.requestRender,
    setGlobeSurfaceTranslucent: scene.setGlobeSurfaceTranslucent,
    setBaseImageryVisible: scene.setBaseImageryVisible,
    getColor,
    getCartesianFromScreen,
    cursorCoordinates,
    createEmitStatus,
    computeBaseStatus,
    bindMouseEvents,
    addCameraChangeListener: scene.onCameraChange,
    removeCameraChangeListener: scene.offCameraChange,
    flyToLocation: scene.flyTo,
    zoomIn: scene.zoomIn,
    zoomOut: scene.zoomOut,
    rotate: scene.rotate,
    pitch: scene.pitch,
    exportScreenshot: scene.exportScreenshot,
    is2dMode,
    toggleViewMode: scene.toggleViewMode
  };
}
