import { onBeforeUnmount, shallowRef } from 'vue';
import {
  Cartesian3,
  Color,
  ColorMaterialProperty,
  ConstantProperty,
  EllipsoidTerrainProvider,
  HeightReference,
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

  // ---- Animation state cache (updated once per tick) ----
  const ringStates: Map<string, RingAnimState> = new Map();

  // ---- Update animation state (called once per tick) ----
  function updateAnimState() {
    const now = Date.now();
    screenGlobePoints.forEach(point => {
      const elapsed1 = (now - animStart) % 3000;
      const t1 = elapsed1 / 3000;
      ringStates.set(`ring1-${point.id}`, {
        radius: 5000 + t1 * 40000,
        alpha: 0.6 * (1 - t1)
      });

      const elapsed2 = (now - animStart + 1500) % 3000;
      const t2 = elapsed2 / 3000;
      ringStates.set(`ring2-${point.id}`, {
        radius: 5000 + t2 * 40000,
        alpha: 0.4 * (1 - t2)
      });
    });
  }

  // ---- Auto-rotate + animation tick ----
  function startAutoRotate() {
    const viewer = viewerRef.value;
    if (!viewer) return;

    // Only enable rotation if mouse is NOT currently over the container
    autoRotateEnabled = !mouseOverContainer;

    onTickListener = () => {
      const v = viewerRef.value;
      if (!v) return;

      // Pre-compute animation state
      updateAnimState();

      // Update ring entities
      updateRingEntities(v);

      // Auto rotate (only in 3D mode)
      if (autoRotateEnabled && v.scene.mode === SceneMode.SCENE3D) {
        v.scene.camera.rotateRight(0.0002);
      }
    };

    viewer.clock.onTick.addEventListener(onTickListener);
  }

  function stopAutoRotate() {
    autoRotateEnabled = false;
  }

  // ---- Update ring entity properties from cache ----
  function updateRingEntities(viewer: Viewer) {
    screenGlobePoints.forEach(point => {
      const color = valueToColor(point.value);
      const s1 = ringStates.get(`ring1-${point.id}`);
      const ring1 = viewer.entities.getById(`ripple-ring1-${point.id}`);
      if (s1 && ring1) {
        (ring1.ellipse!.semiMinorAxis as ConstantProperty).setValue(s1.radius);
        (ring1.ellipse!.semiMajorAxis as ConstantProperty).setValue(s1.radius);
        (ring1.ellipse!.material as ColorMaterialProperty).color = new ConstantProperty(
          color.withAlpha(s1.alpha)
        );
      }

      const s2 = ringStates.get(`ring2-${point.id}`);
      const ring2 = viewer.entities.getById(`ripple-ring2-${point.id}`);
      if (s2 && ring2) {
        (ring2.ellipse!.semiMinorAxis as ConstantProperty).setValue(s2.radius);
        (ring2.ellipse!.semiMajorAxis as ConstantProperty).setValue(s2.radius);
        (ring2.ellipse!.material as ColorMaterialProperty).color = new ConstantProperty(
          color.withAlpha(s2.alpha)
        );
      }
    });
  }

  // ---- Scatter points with ripple ----
  function valueToColor(value: number): Color {
    // Map value (0-100) to color: blue → cyan → green → yellow → orange → red
    const t = Math.min(value / 100, 1);
    if (t < 0.2) {
      const s = t / 0.2;
      return Color.fromBytes(30, Math.floor(80 + s * 175), 255);
    } else if (t < 0.4) {
      const s = (t - 0.2) / 0.2;
      return Color.fromBytes(30, 255, Math.floor(255 - s * 155));
    } else if (t < 0.6) {
      const s = (t - 0.4) / 0.2;
      return Color.fromBytes(Math.floor(30 + s * 225), 255, Math.floor(100 - s * 100));
    } else if (t < 0.8) {
      const s = (t - 0.6) / 0.2;
      return Color.fromBytes(255, Math.floor(255 - s * 170), 0);
    } else {
      const s = (t - 0.8) / 0.2;
      return Color.fromBytes(255, Math.floor(85 - s * 85), 0);
    }
  }

  function addScatterPoints() {
    const viewer = viewerRef.value;
    if (!viewer) return;

    screenGlobePoints.forEach(point => {
      const position = Cartesian3.fromDegrees(point.longitude, point.latitude, 0);
      const color = valueToColor(point.value);
      const dotSize = 6 + (point.value / 100) * 6; // 6-12px

      // Center dot
      const center = viewer.entities.add({
        id: `ripple-center-${point.id}`,
        position,
        point: {
          pixelSize: dotSize,
          color,
          outlineColor: Color.WHITE.withAlpha(0.7),
          outlineWidth: 1.5,
          heightReference: HeightReference.NONE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
      pointEntities.push(center);

      // Ripple ring 1
      ringStates.set(`ring1-${point.id}`, { radius: 5000, alpha: 0.6 });
      const ring1 = viewer.entities.add({
        id: `ripple-ring1-${point.id}`,
        position,
        ellipse: {
          semiMinorAxis: new ConstantProperty(5000),
          semiMajorAxis: new ConstantProperty(5000),
          material: new ColorMaterialProperty(color.withAlpha(0.6)),
          height: 0,
          outline: false
        }
      });
      pointEntities.push(ring1);

      // Ripple ring 2 (offset phase)
      ringStates.set(`ring2-${point.id}`, { radius: 5000, alpha: 0.4 });
      const ring2 = viewer.entities.add({
        id: `ripple-ring2-${point.id}`,
        position,
        ellipse: {
          semiMinorAxis: new ConstantProperty(5000),
          semiMajorAxis: new ConstantProperty(5000),
          material: new ColorMaterialProperty(color.withAlpha(0.4)),
          height: 0,
          outline: false
        }
      });
      pointEntities.push(ring2);
    });
  }

  // ---- Heatmap layer ----
  function addHeatmapLayer() {
    const viewer = viewerRef.value;
    if (!viewer) return;

    const points = screenHeatmapPoints;
    if (!points.length) return;

    // Canvas dimensions
    const canvasW = 512;
    const canvasH = 512;

    // Bounding box with padding
    const pad = 0.5;
    const west = Math.min(...points.map(p => p.longitude)) - pad;
    const east = Math.max(...points.map(p => p.longitude)) + pad;
    const south = Math.min(...points.map(p => p.latitude)) - pad;
    const north = Math.max(...points.map(p => p.latitude)) + pad;

    // Create offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d')!;

    // Draw heatmap points
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

    // Colorize: map grayscale to gradient (transparent → blue → cyan → green → yellow → red)
    const imageData = ctx.getImageData(0, 0, canvasW, canvasH);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3] / 255;
      if (alpha < 0.02) {
        data[i + 3] = 0;
        continue;
      }
      // Map alpha to color
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
      data[i + 3] = Math.floor(alpha * 180); // semi-transparent
    }
    ctx.putImageData(imageData, 0, 0);

    // Add as imagery layer
    const rectangle = Rectangle.fromDegrees(west, south, east, north);
    viewer.imageryLayers.addImageryProvider(
      new SingleTileImageryProvider({
        url: canvas.toDataURL(),
        rectangle
      }),
      0 // add on top
    );
  }

  // ---- Scene mode switching (3D / 2D only) ----
  function switchSceneMode(mode: SceneModeKey) {
    const viewer = viewerRef.value;
    if (!viewer) return;

    stopAutoRotate();
    // Remove old tick listener to avoid duplicate registration
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

    // Adjust controls and camera after morph completes
    const removeListener = viewer.scene.morphComplete.addEventListener(() => {
      const controller = viewer.scene.screenSpaceCameraController;

      if (mode === '2d') {
        // 2D: allow pan & zoom, no rotate
        controller.enableRotate = false;
        controller.enableTranslate = true;
        // Smooth fly to southeast coast in 2D
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(120.5, 24.5, 1500000),
          duration: 2.0
        });
      } else {
        // 3D: allow rotate & zoom
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

    // 2D default: allow pan & zoom, no rotate/tilt
    const controller = viewer.scene.screenSpaceCameraController;
    controller.enableRotate = false;
    controller.enableZoom = true;
    controller.enableTilt = false;
    controller.enableTranslate = true;
    // Reduce zoom speed: lower zoomFactor = slower zoom
    controller.zoomFactor = 0.8;
    // Constrain zoom range
    controller.minimumZoomDistance = 200000;
    controller.maximumZoomDistance = 20000000;
    controller.enableLook = false;

    // Hide credits
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

    // Set initial camera - China southeast coast, 2D view
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(120.5, 24.5, 1500000),
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-90),
        roll: 0
      }
    });

    // Default to 2D mode
    viewer.scene.morphTo2D(0);

    // Add scatter points with ripple
    addScatterPoints();

    // Add heatmap layer
    addHeatmapLayer();

    // Mouse hover pauses auto-rotate — bind to Cesium's container for reliability
    // Cesium creates its own wrapper div inside containerRef; viewer.container is that wrapper
    const cesiumContainer = viewer.container;
    cesiumContainer.addEventListener('mouseenter', () => {
      mouseOverContainer = true;
      autoRotateEnabled = false;
    });
    cesiumContainer.addEventListener('mouseleave', () => {
      mouseOverContainer = false;
      autoRotateEnabled = true;
    });

    // Start auto rotation
    startAutoRotate();

    // Observe container size changes and resize Cesium canvas
    if (containerRef.value) {
      resizeObserver = new ResizeObserver(() => {
        const viewer = viewerRef.value;
        if (viewer && !viewer.isDestroyed()) {
          viewer.resize();
        }
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
