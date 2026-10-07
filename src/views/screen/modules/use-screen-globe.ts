/**
 * 统计大屏 Cesium Globe Composable
 *
 * 大屏场景需求特殊（3D 模式自动旋转），因此未使用 useCesiumBase 基座，
 * 而是自行管理 Viewer。
 *
 * 地图上目前**不叠加任何业务图层**：原先的散点层与热力层都已移除 ——
 * 前者是 8 个"任务节点"，数值没有单位、也没有来源；后者以索引 0 加在最底层，
 * 被不透明底图整个盖住、根本看不到。两者都是装饰噪声，观众读不出结论。
 *
 * 重新加图层前请先确认数据来源与口径（见 screen-globe-viewer.vue 顶部说明）。
 *
 * @note 若后续需要统一的 2D/3D 切换逻辑，可参考 useCesiumBase.toggleViewMode
 */
import { onBeforeUnmount, shallowRef } from 'vue';
import {
  Cartesian3,
  Color,
  EllipsoidTerrainProvider,
  ImageryLayer,
  Math as CesiumMath,
  Rectangle,
  SceneMode,
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

export type SceneModeKey = '3d' | '2d';

export function useScreenGlobe() {
  const containerRef = shallowRef<HTMLDivElement | null>(null);
  const viewerRef = shallowRef<Viewer | null>(null);
  const currentMode = shallowRef<SceneModeKey>('2d');

  let resizeObserver: ResizeObserver | null = null;

  const globalImageryUrl = getGlobalImageryUrl();
  const regionImageryUrl = getRegionImageryUrl();
  const localConfig = getLocalImageryConfig();

  const imageryLayers: ImageryLayer[] = [];

  let autoRotateEnabled = true;
  let mouseOverContainer = false;
  let onTickListener: (() => void) | null = null;

  // ---- Auto-rotate tick ----
  function startAutoRotate() {
    const viewer = viewerRef.value;
    if (!viewer) return;

    autoRotateEnabled = !mouseOverContainer;

    onTickListener = () => {
      const v = viewerRef.value;
      if (!v) return;

      if (autoRotateEnabled && v.scene.mode === SceneMode.SCENE3D) {
        v.scene.camera.rotateRight(0.0002);
      }
    };

    viewer.clock.onTick.addEventListener(onTickListener);
  }

  function stopAutoRotate() {
    autoRotateEnabled = false;
  }

  // ---- Scene mode switching (3D / 2D only) ----
  function switchSceneMode(mode: SceneModeKey) {
    const viewer = viewerRef.value;
    if (!viewer) return;

    stopAutoRotate();
    if (onTickListener) {
      viewer.clock.onTick.removeEventListener(onTickListener);
      onTickListener = null;
    }

    currentMode.value = mode;

    if (mode === '3d') {
      viewer.scene.morphTo3D(1.0);
    } else {
      viewer.scene.morphTo2D(1.0);
    }

    const removeListener = viewer.scene.morphComplete.addEventListener(() => {
      const controller = viewer.scene.screenSpaceCameraController;

      if (mode === '2d') {
        controller.enableRotate = false;
        controller.enableTranslate = true;
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(120.5, 24.5, 1500000),
          duration: 2.0
        });
      } else {
        controller.enableRotate = true;
        controller.enableTranslate = false;
      }

      startAutoRotate();
      removeListener();
    });
  }

  // ---- Init ----
  async function initViewer() {
    if (!containerRef.value || viewerRef.value) return;

    const viewer = new Viewer(containerRef.value, {
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
      baseLayer: false,
      terrainProvider: new EllipsoidTerrainProvider(),
      requestRenderMode: false
    });

    viewerRef.value = viewer;

    // Dark theme
    viewer.scene.globe.showGroundAtmosphere = false;
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = false;
    }
    viewer.scene.globe.baseColor = Color.fromCssColorString('#07101d');
    viewer.scene.backgroundColor = Color.fromCssColorString('#04101c');

    // 2D default camera control
    const controller = viewer.scene.screenSpaceCameraController;
    controller.enableRotate = false;
    controller.enableZoom = true;
    controller.enableTilt = false;
    controller.enableTranslate = true;
    controller.zoomFactor = 0.8;
    controller.minimumZoomDistance = 200000;
    controller.maximumZoomDistance = 20000000;
    controller.enableLook = false;

    (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';

    // Add imagery layers
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
            minimumLevel: 9,
            maximumLevel: localConfig.regionMaxLevel,
            rectangle: Rectangle.fromDegrees(...localConfig.regionRectangle)
          })
        )
      );
    }

    // Initial camera
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(120.5, 24.5, 1500000),
      orientation: { heading: CesiumMath.toRadians(0), pitch: CesiumMath.toRadians(-90), roll: 0 }
    });

    viewer.scene.morphTo2D(0);

    // 不叠加业务图层：散点层与热力层已移除（原因见文件头注释）

    // Mouse hover pause auto-rotate
    const cesiumContainer = viewer.container;
    cesiumContainer.addEventListener('mouseenter', () => {
      mouseOverContainer = true;
      autoRotateEnabled = false;
    });
    cesiumContainer.addEventListener('mouseleave', () => {
      mouseOverContainer = false;
      autoRotateEnabled = true;
    });

    startAutoRotate();

    if (containerRef.value) {
      resizeObserver = new ResizeObserver(() => {
        const v = viewerRef.value;
        if (v && !v.isDestroyed()) v.resize();
      });
      resizeObserver.observe(containerRef.value);
    }
  }

  // ---- Cleanup ----
  onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;

    if (onTickListener && viewerRef.value) {
      viewerRef.value.clock.onTick.removeEventListener(onTickListener);
    }

    imageryLayers.length = 0;

    if (viewerRef.value && !viewerRef.value.isDestroyed()) {
      viewerRef.value.destroy();
    }
  });

  return {
    containerRef,
    /** 暴露 Viewer 供帧率监测订阅 postRender（大屏没有坐标浮窗，帧率角标独立贴角） */
    viewerRef,
    currentMode,
    initViewer,
    switchSceneMode
  };
}
