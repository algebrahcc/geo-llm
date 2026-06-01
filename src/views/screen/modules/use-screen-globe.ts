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
  UrlTemplateImageryProvider,
  Viewer
} from 'cesium';
import { screenGlobePoints } from '@/mock/screen';
import { getGlobalImageryUrl, getRegionImageryUrl, getLocalImageryConfig, isOnlineImagery, getOnlineImageryProviderOptions } from '@/utils/imagery';

export type SceneModeKey = '3d' | '2d';

interface RingAnimState {
  radius: number;
  alpha: number;
}

export function useScreenGlobe() {
  const containerRef = shallowRef<HTMLDivElement | null>(null);
  const viewerRef = shallowRef<Viewer | null>(null);
  const currentMode = shallowRef<SceneModeKey>('3d');

  const globalImageryUrl = getGlobalImageryUrl();
  const regionImageryUrl = getRegionImageryUrl();
  const localConfig = getLocalImageryConfig();

  const imageryLayers: ImageryLayer[] = [];
  const pointEntities: any[] = [];

  let autoRotateEnabled = true;
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

    autoRotateEnabled = true;

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
      const s1 = ringStates.get(`ring1-${point.id}`);
      const ring1 = viewer.entities.getById(`ripple-ring1-${point.id}`);
      if (s1 && ring1) {
        (ring1.ellipse!.semiMinorAxis as ConstantProperty).setValue(s1.radius);
        (ring1.ellipse!.semiMajorAxis as ConstantProperty).setValue(s1.radius);
        (ring1.ellipse!.material as ColorMaterialProperty).color = new ConstantProperty(
          Color.fromCssColorString('#29b6ff').withAlpha(s1.alpha)
        );
      }

      const s2 = ringStates.get(`ring2-${point.id}`);
      const ring2 = viewer.entities.getById(`ripple-ring2-${point.id}`);
      if (s2 && ring2) {
        (ring2.ellipse!.semiMinorAxis as ConstantProperty).setValue(s2.radius);
        (ring2.ellipse!.semiMajorAxis as ConstantProperty).setValue(s2.radius);
        (ring2.ellipse!.material as ColorMaterialProperty).color = new ConstantProperty(
          Color.fromCssColorString('#29b6ff').withAlpha(s2.alpha)
        );
      }
    });
  }

  // ---- Scatter points with ripple ----
  function addScatterPoints() {
    const viewer = viewerRef.value;
    if (!viewer) return;

    screenGlobePoints.forEach(point => {
      const position = Cartesian3.fromDegrees(point.longitude, point.latitude, 0);

      // Center dot
      const center = viewer.entities.add({
        id: `ripple-center-${point.id}`,
        position,
        point: {
          pixelSize: 8,
          color: Color.fromCssColorString('#29b6ff'),
          outlineColor: Color.WHITE.withAlpha(0.6),
          outlineWidth: 1,
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
          material: new ColorMaterialProperty(Color.fromCssColorString('#29b6ff').withAlpha(0.6)),
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
          material: new ColorMaterialProperty(Color.fromCssColorString('#29b6ff').withAlpha(0.4)),
          height: 0,
          outline: false
        }
      });
      pointEntities.push(ring2);
    });
  }

  // ---- Scene mode switching (3D / 2D only) ----
  function switchSceneMode(mode: SceneModeKey) {
    const viewer = viewerRef.value;
    if (!viewer) return;

    stopAutoRotate();
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

    // Allow user rotate & zoom, disable tilt/translate
    const controller = viewer.scene.screenSpaceCameraController;
    controller.enableRotate = true;
    controller.enableZoom = true;
    controller.enableTilt = false;
    controller.enableTranslate = false;
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

    // Set initial camera - China southeast coast, top-down view
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(120.5, 24.5, 8000000),
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-90),
        roll: 0
      }
    });

    // Add scatter points with ripple
    addScatterPoints();

    // Mouse hover/interaction pauses auto-rotate
    const container = containerRef.value;
    if (container) {
      container.addEventListener('mouseenter', () => {
        autoRotateEnabled = false;
      });
      container.addEventListener('mouseleave', () => {
        autoRotateEnabled = true;
      });
    }

    // Start auto rotation
    startAutoRotate();
  }

  // ---- Cleanup ----
  onBeforeUnmount(() => {
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
