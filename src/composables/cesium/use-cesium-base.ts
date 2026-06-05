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

interface ViewerInitHooks {
  /** 在影像层加载前执行（用于 scene 全局配置、camera 控制器等） */
  prepareViewer?: (viewer: Viewer) => void;
  /** 在影像层加载完成后、initViewer 返回前执行 */
  afterImagery?: (viewer: Viewer) => void;
  /** 在影像层加载完成后、initViewer 返回前执行（异步版本，等它完成后才返回） */
  afterImageryAsync?: (viewer: Viewer) => Promise<void>;
}

export interface CesiumBaseReturn {
  containerRef: Ref<HTMLDivElement | null>;
  viewerRef: Ref<Viewer | null>;
  imageryLayers: ImageryLayer[];
  initViewer: (hooks?: ViewerInitHooks) => Promise<void>;
  destroyViewer: () => void;

  /** 工具函数 */
  requestRender: () => void;
  getColor: (css: string, alpha?: number) => Color;
  getCartesianFromScreen: (position: Cartesian2) => Cartesian3 | null;

  /** 构建带模块扩展字段的 emitStatus */
  createEmitStatus: <T extends Record<string, unknown>>(
    extraFieldsFn: () => T
  ) => (cartesian?: Cartesian3 | null) => void;

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

    // 加载影像层
    viewer.imageryLayers.removeAll();
    imageryLayers.splice(0, imageryLayers.length);

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

    // 异步加载高程（地形）数据，不阻塞初始化流程
    createTerrainProvider().then(provider => {
      if (provider) {
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
    return viewer.camera.pickEllipsoid(position, viewer.scene.globe.ellipsoid);
  }

  // ─── emitStatus 工厂 ───────────────────────────────

  function createEmitStatus<T extends Record<string, unknown>>(
    extraFieldsFn: () => T
  ) {
    return (cartesian?: Cartesian3 | null) => {
      const viewer = viewerRef.value;
      if (!viewer) return;

      const cameraHeight = viewer.camera.positionCartographic.height;
      let longitude = '--';
      let latitude = '--';
      let altitude = '--';

      if (cartesian) {
        const cartographic = Cartographic.fromCartesian(cartesian);
        longitude = CesiumMath.toDegrees(cartographic.longitude).toFixed(4);
        latitude = CesiumMath.toDegrees(cartographic.latitude).toFixed(4);
        altitude = `${Math.max(cartographic.height, 0).toFixed(0)} m`;
      }

      // 各模块扩展的字段由 extraFieldsFn 计算，保持响应式
      extraFieldsFn();

      return {
        longitude,
        latitude,
        altitude,
        cameraHeight: `${(cameraHeight / 1000).toFixed(1)} km`
      };
    };
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

  function zoomIn(amount = 1200) {
    viewerRef.value?.camera.zoomIn(amount);
  }

  function zoomOut(amount = 1200) {
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

  return {
    containerRef,
    viewerRef,
    imageryLayers,
    initViewer,
    destroyViewer,
    requestRender,
    getColor,
    getCartesianFromScreen,
    createEmitStatus,
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
