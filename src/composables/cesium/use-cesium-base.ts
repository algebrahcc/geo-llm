import { onBeforeUnmount, ref, shallowRef, type Ref } from 'vue';
import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  EllipsoidTerrainProvider,
  ImageryLayer,
  Math as CesiumMath,
  Rectangle,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  UrlTemplateImageryProvider,
  Viewer
} from 'cesium';
import {
  getGlobalImageryUrl,
  getRegionImageryUrl,
  getLocalImageryConfig,
  isOnlineImagery,
  getOnlineImageryProviderOptions
} from '@/utils/imagery';
import { createTerrainProvider } from '@/utils/terrain';
import { loadService, type ServiceLayerHandle } from './service-loader';
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
 * 数据服务加载超时（ms）。
 *
 * 服务地址不可达时 Cesium provider 请求（terrain layer.json 等）可能长期挂起而不 reject，
 * 需兜底中断，避免拖垮整个初始化流程。与 useCesiumServices 内的超时保持一致。
 */
const SERVICE_LOAD_TIMEOUT_MS = 8000;

/** 为 Promise 附加超时：超时后以 reason 拒绝，避免挂起请求长期占用初始化流程 */
function withTimeout<T>(promise: Promise<T>, ms: number, reason: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(reason)), ms);
    })
  ]);
}

/**
 * Cesium Viewer 基础 Composable
 *
 * 封装所有模块公用的 Viewer 生命周期、影像层加载、事件管理、镜头控制，
 * 减少 useCesiumRiver / useCesiumPlanning / useCesiumGlobe / useBuildingModel
 * 之间的重复代码。
 */
export function useCesiumBase(): CesiumBaseReturn {
  const containerRef: Ref<HTMLDivElement | null> = shallowRef(null);
  const viewerRef: Ref<Viewer | null> = shallowRef(null);
  const imageryLayers: ImageryLayer[] = [];

  const globalImageryUrl = getGlobalImageryUrl();
  const regionImageryUrl = getRegionImageryUrl();
  const localConfig = getLocalImageryConfig();

  let eventHandler: ScreenSpaceEventHandler | null = null;
  const cameraChangeListeners: Set<() => void> = new Set();

  // ─── Viewer 生命周期 ─────────────────────────────────

  async function initViewer(hooks?: ViewerInitHooks) {
    const container = containerRef.value;
    if (!container || viewerRef.value) return;

    const viewer = new Viewer(container, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      // 禁用默认底图：Cesium 默认加载 Ion 的 World Imagery（asset 2），
      // 项目未配置 Ion.defaultAccessToken，会打 INVALID_TOKEN 401。
      // 底图统一由下方 addDefaultImagery / applyServices 挂载。
      baseLayer: false,
      terrainProvider: new EllipsoidTerrainProvider(),
      contextOptions: {
        webgl: {
          preserveDrawingBuffer: true
        }
      }
    });

    viewerRef.value = viewer;

    // 模块自定义的 Viewer 配置
    hooks?.prepareViewer?.(viewer);

    // 加载影像层（默认 config.json 兜底；存在数据服务影像时由 applyServices 替换）
    viewer.imageryLayers.removeAll();
    imageryLayers.splice(0, imageryLayers.length);
    addDefaultImagery(viewer);

    // 异步加载高程（地形）数据，不阻塞初始化流程
    createTerrainProvider().then(provider => {
      // 快速离开页面时 viewer 可能已被销毁，异步结果回来时需二次校验，避免写已销毁对象抛异常
      if (provider && !viewer.isDestroyed()) {
        viewer.terrainProvider = provider;
      }
    });

    // 异步 hook（如等待模块初始化完成后才返回）
    await hooks?.afterImageryAsync?.(viewer);

    // 同步 hook
    hooks?.afterImagery?.(viewer);
  }

  function destroyViewer() {
    if (eventHandler) {
      eventHandler.destroy();
      eventHandler = null;
    }

    cameraChangeListeners.forEach(listener => {
      viewerRef.value?.camera.changed.removeEventListener(listener);
    });
    cameraChangeListeners.clear();

    if (viewerRef.value && !viewerRef.value.isDestroyed()) {
      viewerRef.value.destroy();
    }
    viewerRef.value = null;
  }

  /** 加载 config.json 兜底影像层（全局 + 区域叠加），并登记进 imageryLayers 供模块显隐控制 */
  function addDefaultImagery(viewer: Viewer) {
    imageryLayers.push(
      viewer.imageryLayers.addImageryProvider(
        new UrlTemplateImageryProvider(
          isOnlineImagery()
            ? getOnlineImageryProviderOptions()
            : { url: globalImageryUrl, minimumLevel: 0, maximumLevel: localConfig.globalMaxLevel }
        )
      )
    );
    if (regionImageryUrl) {
      imageryLayers.push(
        viewer.imageryLayers.addImageryProvider(
          new UrlTemplateImageryProvider({
            url: regionImageryUrl,
            minimumLevel: 0,
            maximumLevel: localConfig.regionMaxLevel,
            rectangle: Rectangle.fromDegrees(...localConfig.regionRectangle)
          })
        )
      );
    }
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
        addDefaultImagery(viewer);
      }
    } else {
      addDefaultImagery(viewer);
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
            SERVICE_LOAD_TIMEOUT_MS,
            `地形服务 ${SERVICE_LOAD_TIMEOUT_MS / 1000}s 未响应`
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

  function requestRender() {
    viewerRef.value?.scene.requestRender();
  }

  function getColor(css: string, alpha = 1) {
    return Color.fromCssColorString(css).withAlpha(alpha);
  }

  function getCartesianFromScreen(position: Cartesian2): Cartesian3 | null {
    const viewer = viewerRef.value;
    if (!viewer) return null;
    return viewer.camera.pickEllipsoid(position, viewer.scene.globe.ellipsoid) ?? null;
  }

  // ─── emitStatus 工厂 ───────────────────────────────
  //
  // 各模块只需通过 extraFieldsFn 提供扩展字段，
  // 基座自动计算经纬度/高度/相机高度等公共字段并合并返回。
  //
  // 返回函数的类型在调用处用 Record<string, unknown> 桥接，避免泛型推断 void。

  function createEmitStatus<T extends Record<string, unknown>>(
    extraFieldsFn: () => T
  ): (cartesian?: Cartesian3 | null) => BaseStatusInfo & T {
    return (cartesian?: Cartesian3 | null) => {
      const viewer = viewerRef.value;
      const cameraHeight = viewer ? viewer.camera.positionCartographic.height : 0;
      let longitude = '--';
      let latitude = '--';
      let altitude = '--';

      if (cartesian && viewer) {
        const cartographic = Cartographic.fromCartesian(cartesian);
        longitude = CesiumMath.toDegrees(cartographic.longitude).toFixed(4);
        latitude = CesiumMath.toDegrees(cartographic.latitude).toFixed(4);
        altitude = `${Math.max(cartographic.height, 0).toFixed(0)} m`;
      }

      return {
        longitude,
        latitude,
        altitude,
        cameraHeight: `${(cameraHeight / 1000).toFixed(1)} km`,
        ...extraFieldsFn()
      } as unknown as BaseStatusInfo & T;
    };
  }

  /** 仅计算基础状态字段（不含扩展字段），供 building 模块等特殊场景使用 */
  function computeBaseStatus(cartesian?: Cartesian3 | null): {
    longitude: string;
    latitude: string;
    altitude: string;
    cameraHeight: string;
  } {
    const viewer = viewerRef.value;
    const cameraHeight = viewer ? viewer.camera.positionCartographic.height : 0;
    let longitude = '--';
    let latitude = '--';
    let altitude = '--';

    if (cartesian && viewer) {
      const cartographic = Cartographic.fromCartesian(cartesian);
      longitude = CesiumMath.toDegrees(cartographic.longitude).toFixed(4);
      latitude = CesiumMath.toDegrees(cartographic.latitude).toFixed(4);
      altitude = `${Math.max(cartographic.height, 0).toFixed(0)} m`;
    }

    return { longitude, latitude, altitude, cameraHeight: `${(cameraHeight / 1000).toFixed(1)} km` };
  }

  // ─── 事件绑定 ─────────────────────────────────────

  function bindMouseEvents(handlers: {
    onMouseMove?: (movement: { endPosition: Cartesian2 }) => void;
    onLeftClick?: (event: { position: Cartesian2 }) => void;
  }) {
    const viewer = viewerRef.value;
    if (!viewer) return;

    eventHandler?.destroy();
    eventHandler = new ScreenSpaceEventHandler(viewer.scene.canvas);

    if (handlers.onMouseMove) {
      eventHandler.setInputAction(handlers.onMouseMove, ScreenSpaceEventType.MOUSE_MOVE);
    }

    if (handlers.onLeftClick) {
      eventHandler.setInputAction(handlers.onLeftClick, ScreenSpaceEventType.LEFT_CLICK);
    }
  }

  function addCameraChangeListener(listener: () => void) {
    cameraChangeListeners.add(listener);
    viewerRef.value?.camera.changed.addEventListener(listener);
  }

  function removeCameraChangeListener(listener: () => void) {
    cameraChangeListeners.delete(listener);
    viewerRef.value?.camera.changed.removeEventListener(listener);
  }

  // ─── 镜头控制 ─────────────────────────────────────

  function flyToLocation(longitude: number, latitude: number, height = 20000, duration = 1.3) {
    const viewer = viewerRef.value;
    if (!viewer) return;
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(longitude, latitude, height),
      duration
    });
  }

  function zoomIn(amount = 3000) {
    viewerRef.value?.camera.zoomIn(amount);
  }

  function zoomOut(amount = 3000) {
    viewerRef.value?.camera.zoomOut(amount);
  }

  function rotate(radians = CesiumMath.toRadians(12)) {
    viewerRef.value?.camera.rotateLeft(radians);
  }

  function pitch(radians = CesiumMath.toRadians(8)) {
    viewerRef.value?.camera.lookUp(radians);
  }

  // ─── 2D / 3D 视图切换 ──────────────────────────────

  const is2dMode = ref(false);

  function toggleViewMode() {
    const viewer = viewerRef.value;
    if (!viewer) return;

    if (is2dMode.value) {
      // 切换到 3D
      viewer.scene.morphTo3D(0);
      viewer.scene.screenSpaceCameraController.enableRotate = true;
      viewer.scene.screenSpaceCameraController.enableTilt = true;
    } else {
      // 切换到 2D
      viewer.scene.morphTo2D(0);
      viewer.scene.screenSpaceCameraController.enableRotate = false;
      viewer.scene.screenSpaceCameraController.enableTilt = false;
    }

    is2dMode.value = !is2dMode.value;
  }

  // ─── 截图 ─────────────────────────────────────────

  function exportScreenshot(filename: string) {
    const viewer = viewerRef.value;
    if (!viewer) return;

    try {
      // 强制同步渲染确保画布内容最新
      viewer.render();
      const url = viewer.canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.$message?.success('已导出当前视角截图');
    } catch (err) {
      console.error('[Screenshot] 导出失败:', err);
      window.$message?.error('截图导出失败');
    }
  }

  // ─── 自动清理 ─────────────────────────────────────

  onBeforeUnmount(destroyViewer);

  // ─── 地表透视（地下模式）：地表半透明，透视查看地下管线/模型 ───
  let surfaceTranslucent = false;

  function setGlobeSurfaceTranslucent(enabled: boolean) {
    const viewer = viewerRef.value;
    if (!viewer || surfaceTranslucent === enabled) return;
    surfaceTranslucent = enabled;
    const globe = viewer.scene.globe;
    globe.translucency.enabled = enabled;
    globe.translucency.frontFaceAlpha = enabled ? 0.32 : 1.0;
    globe.translucency.backFaceAlpha = enabled ? 0.12 : 1.0;
    // 透视模式需要地表参与深度测试，否则半透明混合顺序不正确
    globe.depthTestAgainstTerrain = enabled;
    // 地下漫游：关闭相机碰撞检测（默认开启会把相机挡在椭球面/地形之上，无法进入地下模型内部），
    // 并放宽最小缩放距离，允许贴近视点观察
    viewer.scene.screenSpaceCameraController.enableCollisionDetection = !enabled;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = enabled ? 0.2 : 1.0;
    requestRender();
  }

  return {
    containerRef,
    viewerRef,
    imageryLayers,
    initViewer,
    destroyViewer,
    applyServices,
    requestRender,
    setGlobeSurfaceTranslucent,
    getColor,
    getCartesianFromScreen,
    createEmitStatus,
    computeBaseStatus,
    bindMouseEvents,
    addCameraChangeListener,
    removeCameraChangeListener,
    flyToLocation,
    zoomIn,
    zoomOut,
    rotate,
    pitch,
    exportScreenshot,
    is2dMode,
    toggleViewMode
  };
}
