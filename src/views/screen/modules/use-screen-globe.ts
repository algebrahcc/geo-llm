/**
 * 统计大屏 Cesium Globe Composable
 *
 * 大屏场景需求特殊（散点涟漪动画、热力图、自动旋转），
 * 因此未使用 useCesiumBase 基座，而是自行管理 Viewer。
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
  SingleTileImageryProvider,
  UrlTemplateImageryProvider,
  Viewer
} from 'cesium';
import { screenGlobePoints, screenHeatmapPoints } from '@/mock/screen';
import { getGlobalImageryUrl, getRegionImageryUrl, getLocalImageryConfig, isOnlineImagery, getOnlineImageryProviderOptions } from '@/utils/imagery';
import { addScatterPoints, updateAnimState, updateRingEntities } from '@/utils/cesium-anim';

export type SceneModeKey = '3d' | '2d';

interface RingAnimState {
  radius: number;
  alpha: number;
}

export function useScreenGlobe() {
  const containerRef = shallowRef<HTMLDivElement | null>(null);
  const viewerRef = shallowRef<Viewer | null>(null);
  const currentMode = shallowRef<SceneModeKey>('2d');

  let resizeObserver: ResizeObserver | null = null;

  const globalImageryUrl = getGlobalImageryUrl();
  const regionImageryUrl = getRegionImageryUrl();
  const localConfig = getLocalImageryConfig();

  const imageryLayers: ImageryLayer[] = [];
  const pointEntities: any[] = [];

  let autoRotateEnabled = true;
  let mouseOverContainer = false;
  let onTickListener: (() => void) | null = null;
  const animStart = Date.now();
  const ringStates: Map<string, RingAnimState> = new Map();

  // ---- Auto-rotate + animation tick ----
  function startAutoRotate() {
    const viewer = viewerRef.value;
    if (!viewer) return;

    autoRotateEnabled = !mouseOverContainer;

    onTickListener = () => {
      const v = viewerRef.value;
      if (!v) return;

      updateAnimState(screenGlobePoints, ringStates, animStart);
      updateRingEntities(v, screenGlobePoints, ringStates);

      if (autoRotateEnabled && v.scene.mode === SceneMode.SCENE3D) {
        v.scene.camera.rotateRight(0.0002);
      }
    };

    viewer.clock.onTick.addEventListener(onTickListener);
  }

  function stopAutoRotate() {
    autoRotateEnabled = false;
  }

  // ---- Heatmap layer ----
  function addHeatmapLayer() {
    const viewer = viewerRef.value;
    if (!viewer) return;

    const points = screenHeatmapPoints;
    if (!points.length) return;

    const canvasW = 512;
    const canvasH = 512;
    const pad = 0.5;
    const west = Math.min(...points.map(p => p.longitude)) - pad;
    const east = Math.max(...points.map(p => p.longitude)) + pad;
    const south = Math.min(...points.map(p => p.latitude)) - pad;
    const north = Math.max(...points.map(p => p.latitude)) + pad;

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d')!;

    const radius = 50;
    points.forEach(p => {
      const x = ((p.longitude - west) / (east - west)) * canvasW;
      const y = ((north - p.latitude) / (north - south)) * canvasH;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, `rgba(0, 0, 0, ${p.value})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    });

    const imageData = ctx.getImageData(0, 0, canvasW, canvasH);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3] / 255;
      if (alpha < 0.02) {
        data[i + 3] = 0;
        continue;
      }
      let r: number, g: number, b: number;
      if (alpha < 0.25) {
        const t = alpha / 0.25;
        r = 0; g = Math.floor(t * 200); b = Math.floor(100 + t * 155);
      } else if (alpha < 0.5) {
        const t = (alpha - 0.25) / 0.25;
        r = 0; g = Math.floor(200 + t * 55); b = Math.floor(255 - t * 55);
      } else if (alpha < 0.75) {
        const t = (alpha - 0.5) / 0.25;
        r = Math.floor(t * 255); g = 255; b = 0;
      } else {
        const t = (alpha - 0.75) / 0.25;
        r = 255; g = Math.floor(255 - t * 200); b = 0;
      }
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = Math.floor(alpha * 180);
    }
    ctx.putImageData(imageData, 0, 0);

    const rectangle = Rectangle.fromDegrees(west, south, east, north);
    viewer.imageryLayers.addImageryProvider(
      new SingleTileImageryProvider({ url: canvas.toDataURL(), rectangle }),
      0
    );
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

    // Screen-specific overlays
    addScatterPoints(viewer, screenGlobePoints, ringStates, pointEntities);
    addHeatmapLayer();

    // Mouse hover pause auto-rotate
    const cesiumContainer = viewer.container;
    cesiumContainer.addEventListener('mouseenter', () => { mouseOverContainer = true; autoRotateEnabled = false; });
    cesiumContainer.addEventListener('mouseleave', () => { mouseOverContainer = false; autoRotateEnabled = true; });

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

    ringStates.clear();
    pointEntities.length = 0;
    imageryLayers.length = 0;

    if (viewerRef.value && !viewerRef.value.isDestroyed()) {
      viewerRef.value.destroy();
    }
  });

  return {
    containerRef,
    currentMode,
    initViewer,
    switchSceneMode
  };
}
