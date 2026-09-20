/**
 * Cesium 场景内核 —— Cesium 造物适配器（RFC-0001 · 第 2 步）
 *
 * 这是整个 `ports/` 目录里**唯一** import `cesium` 的文件：它是第三方边界
 * （依赖分类里的 "True external"），也是全项目唯一创建 Viewer、事件处理器与 provider 的位置。
 *
 * 关键设计：`ViewerPort` 用**显式包装**实现，而不是 `as unknown as ViewerPort` 糊过去。
 * 好处是「端口方法 → 实际 Cesium 调用」的映射集中在这一处、可逐行审计；
 * 一旦 Cesium 升级改了某处细节，只需要改这里，而不是靠类型强转把问题藏起来。
 *
 * 行为与现状一致：默认 Viewer 选项与 `use-cesium-base.ts` 逐项相同，
 * 兜底影像/地形的构造也与 `addDefaultImagery` / `createTerrainProvider` 相同。
 */
import {
  Cartesian3,
  Cartographic,
  EllipsoidTerrainProvider,
  Math as CesiumMath,
  Rectangle,
  SceneMode,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  UrlTemplateImageryProvider,
  Viewer
} from 'cesium';
import type { Cartesian2, ImageryLayer, ImageryProvider, TerrainProvider } from 'cesium';
import {
  getGlobalImageryUrl,
  getLocalImageryConfig,
  getOnlineImageryProviderOptions,
  getRegionImageryUrl,
  isOnlineImagery
} from '@/utils/imagery';
import { createTerrainProvider as buildTerrainProvider } from '@/utils/terrain';
import type { CameraPort, GlobePort, ImageryLayersPort, SceneKit, ScenePort, ViewerPort } from './types';

/**
 * Viewer 默认选项。
 *
 * - 关闭全部默认控件：界面由场景页自己组织；
 * - `baseLayer: false`：Cesium 默认会拉 Ion 的 World Imagery（asset 2），
 *   本项目未配置 `Ion.defaultAccessToken`，会打 INVALID_TOKEN 401，故底图统一自行挂载；
 * - `preserveDrawingBuffer: true`：截图（`canvas.toDataURL`）的前提，被覆盖会导致截图静默变黑；
 * - `terrainProvider` 先用椭球体，真实地形异步加载后替换。
 */
export function createDefaultViewerOptions(): Record<string, unknown> {
  return {
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
    contextOptions: {
      webgl: {
        preserveDrawingBuffer: true
      }
    }
  };
}

/** camera 端口包装：粗粒度命令，不泄漏 positionCartographic / ellipsoid 等取值路径 */
function wrapCamera(viewer: Viewer): CameraPort {
  return {
    flyToGeo: (point, duration) => {
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(point.longitude, point.latitude, point.height),
        duration
      });
    },
    zoomIn: amount => viewer.camera.zoomIn(amount),
    zoomOut: amount => viewer.camera.zoomOut(amount),
    rotate: radians => viewer.camera.rotateLeft(radians),
    pitch: radians => viewer.camera.lookUp(radians),
    height: () => viewer.camera.positionCartographic.height,
    pickGlobe: screen => viewer.camera.pickEllipsoid(screen as Cartesian2, viewer.scene.globe.ellipsoid) ?? null,
    onChange: listener => viewer.camera.changed.addEventListener(listener),
    offChange: listener => viewer.camera.changed.removeEventListener(listener),
    get percentageChanged() {
      return viewer.camera.percentageChanged;
    },
    set percentageChanged(value: number) {
      viewer.camera.percentageChanged = value;
    }
  };
}

/** globe 端口包装 */
function wrapGlobe(viewer: Viewer): GlobePort {
  return {
    setDepthTestAgainstTerrain: on => {
      // 透视模式需要地表参与深度测试，否则半透明混合顺序不正确
      viewer.scene.globe.depthTestAgainstTerrain = on;
    },
    setTranslucency: ({ enabled, frontFaceAlpha, backFaceAlpha }) => {
      const translucency = viewer.scene.globe.translucency;
      translucency.enabled = enabled;
      translucency.frontFaceAlpha = frontFaceAlpha;
      translucency.backFaceAlpha = backFaceAlpha;
    }
  };
}

/** scene 端口包装 */
function wrapScene(viewer: Viewer): ScenePort {
  return {
    requestRender: () => viewer.scene.requestRender(),
    render: () => viewer.render(),
    mode: () => (viewer.scene.mode === SceneMode.SCENE2D ? '2D' : '3D'),
    morphTo2D: duration => viewer.scene.morphTo2D(duration),
    morphTo3D: duration => viewer.scene.morphTo3D(duration),
    setController: patch => {
      const controller = viewer.scene.screenSpaceCameraController;
      if (patch.enableRotate !== undefined) controller.enableRotate = patch.enableRotate;
      if (patch.enableTilt !== undefined) controller.enableTilt = patch.enableTilt;
      if (patch.enableCollisionDetection !== undefined)
        controller.enableCollisionDetection = patch.enableCollisionDetection;
      if (patch.zoomFactor !== undefined) controller.zoomFactor = patch.zoomFactor;
      if (patch.inertiaZoom !== undefined) controller.inertiaZoom = patch.inertiaZoom;
      if (patch.minimumZoomDistance !== undefined) controller.minimumZoomDistance = patch.minimumZoomDistance;
    },
    globe: wrapGlobe(viewer)
  };
}

/** imageryLayers 端口包装 */
function wrapImageryLayers(viewer: Viewer): ImageryLayersPort {
  return {
    removeAll: () => {
      viewer.imageryLayers.removeAll();
    },
    addImageryProvider: (provider: ImageryProvider) => viewer.imageryLayers.addImageryProvider(provider),
    // 显隐投影：与 service-loader 里 imagery 句柄的 show/hide、setOpacity 逐项一致
    setVisible: (layer, visible) => {
      (layer as ImageryLayer).show = visible;
    },
    setOpacity: (layer, opacity) => {
      (layer as ImageryLayer).alpha = opacity;
    }
  };
}

/** 把真实 Viewer 包成端口（唯一一处「端口 ↔ Cesium」映射） */
function wrapViewer(viewer: Viewer): ViewerPort {
  return {
    canvas: viewer.canvas,
    camera: wrapCamera(viewer),
    scene: wrapScene(viewer),
    imageryLayers: wrapImageryLayers(viewer),
    get terrainProvider() {
      return viewer.terrainProvider;
    },
    set terrainProvider(value: TerrainProvider | undefined) {
      if (value) viewer.terrainProvider = value;
    },
    isDestroyed: () => viewer.isDestroyed(),
    destroy: () => {
      viewer.destroy();
    },
    // 逃生口：仅供 use-cesium-base 的 viewerRef 使用（见 ports/types.ts 的说明）
    rawViewer: () => viewer
  };
}

/**
 * config.json 兜底影像 provider 列表：全局底图 + 可选区域叠加。
 * 与 `use-cesium-base.addDefaultImagery` 的构造逐项一致。
 */
function buildDefaultImageryProviders(): ImageryProvider[] {
  const localConfig = getLocalImageryConfig();
  const providers: ImageryProvider[] = [
    new UrlTemplateImageryProvider(
      isOnlineImagery()
        ? getOnlineImageryProviderOptions()
        : { url: getGlobalImageryUrl(), minimumLevel: 0, maximumLevel: localConfig.globalMaxLevel }
    )
  ];

  const regionUrl = getRegionImageryUrl();
  if (regionUrl) {
    providers.push(
      new UrlTemplateImageryProvider({
        url: regionUrl,
        minimumLevel: 0,
        maximumLevel: localConfig.regionMaxLevel,
        rectangle: Rectangle.fromDegrees(...localConfig.regionRectangle)
      })
    );
  }

  return providers;
}

/** Cesium 造物端口的生产实现 */
export function createCesiumKit(): SceneKit {
  return {
    createViewer(container, options = {}) {
      const viewer = new Viewer(container, {
        ...createDefaultViewerOptions(),
        ...options
      } as ConstructorParameters<typeof Viewer>[1]);
      return wrapViewer(viewer);
    },

    createEventHandler(surface) {
      const handler = new ScreenSpaceEventHandler(surface as HTMLCanvasElement);
      return {
        setInputAction(action, type) {
          handler.setInputAction(action as never, type as never);
        },
        destroy() {
          handler.destroy();
        }
      };
    },

    toGeo: cartesian => {
      if (!cartesian) return null;
      const cartographic = Cartographic.fromCartesian(cartesian as Cartesian3);
      return {
        longitude: CesiumMath.toDegrees(cartographic.longitude),
        latitude: CesiumMath.toDegrees(cartographic.latitude),
        height: cartographic.height
      };
    },

    createDefaultImageryProviders: buildDefaultImageryProviders,

    createTerrainProvider: () => buildTerrainProvider() as Promise<TerrainProvider | undefined>,

    inputTypes: {
      MOUSE_MOVE: ScreenSpaceEventType.MOUSE_MOVE,
      LEFT_CLICK: ScreenSpaceEventType.LEFT_CLICK
    }
  };
}
