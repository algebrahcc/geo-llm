import { onBeforeUnmount, shallowRef } from 'vue';
import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  EllipsoidTerrainProvider,
  Entity,
  HeightReference,
  HorizontalOrigin,
  ImageryLayer,
  LabelStyle,
  Math as CesiumMath,
  PolygonHierarchy,
  Rectangle,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  UrlTemplateImageryProvider,
  VerticalOrigin,
  Viewer
} from 'cesium';
import { getGlobalImageryUrl, getRegionImageryUrl, getLocalImageryConfig, isOnlineImagery, getOnlineImageryProviderOptions } from '@/utils/imagery';
import {
  globeAnalysisResult,
  globeAnalysisSteps,
  globePresets,
  globeStaticMarks,
  globeStaticPipelines,
  globeStaticRoads,
  globeStaticRoutes
} from '@/mock/globe';
import type { GlobeInteractiveTool, GlobeLayerKey, GlobeStatusInfo } from './types';

type Coordinate = readonly [number, number];

interface UseCesiumGlobeOptions {
  onStatusChange?: (status: GlobeStatusInfo) => void;
}

const toolNameMap: Record<GlobeInteractiveTool | 'browse', string> = {
  browse: '浏览',
  annotate: '标注',
  'measure-distance': '测距',
  'measure-area': '测面'
};

function sleep(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

export function useCesiumGlobe(options: UseCesiumGlobeOptions = {}) {
  const containerRef = shallowRef<HTMLDivElement | null>(null);
  const viewerRef = shallowRef<Viewer | null>(null);
  const globalImageryUrl = getGlobalImageryUrl();
  const regionImageryUrl = getRegionImageryUrl();
  const localConfig = getLocalImageryConfig();

  const layerVisibility: Record<GlobeLayerKey, boolean> = {
    imagery: true,
    road: true,
    pipeline: true,
    mark: true,
    route: true
  };

  const staticEntities: Record<Exclude<GlobeLayerKey, 'imagery'>, Entity[]> = {
    road: [],
    pipeline: [],
    mark: [],
    route: []
  };

  const dynamicMarkEntities: Entity[] = [];
  const dynamicRouteEntities: Entity[] = [];
  const dynamicMeasureEntities: Entity[] = [];
  const measurePositions: Cartesian3[] = [];
  const imageryLayers: ImageryLayer[] = [];

  let activeTool: GlobeInteractiveTool | 'browse' = 'browse';
  let annotationIndex = 1;
  let eventHandler: ScreenSpaceEventHandler | null = null;
  let cameraChangedListener: (() => void) | null = null;

  function emitStatus(cartesian?: Cartesian3 | null) {
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

    options.onStatusChange?.({
      longitude,
      latitude,
      altitude,
      cameraHeight: `${(cameraHeight / 1000).toFixed(1)} km`,
      activeTool: toolNameMap[activeTool]
    });
  }

  function requestRender() {
    viewerRef.value?.scene.requestRender();
  }

  function getColor(css: string, alpha = 1) {
    return Color.fromCssColorString(css).withAlpha(alpha);
  }

  function createPointEntity(
    layerKey: Exclude<GlobeLayerKey, 'imagery'>,
    entityOptions: { id: string; name: string; longitude: number; latitude: number; color: string }
  ) {
    const viewer = viewerRef.value;

    if (!viewer) return null;

    const entity = viewer.entities.add({
      id: entityOptions.id,
      position: Cartesian3.fromDegrees(entityOptions.longitude, entityOptions.latitude),
      point: {
        pixelSize: 11,
        color: getColor(entityOptions.color),
        outlineColor: Color.WHITE,
        outlineWidth: 2,
        heightReference: HeightReference.CLAMP_TO_GROUND
      },
      label: {
        text: entityOptions.name,
        font: '12px Microsoft YaHei',
        fillColor: Color.WHITE,
        showBackground: true,
        backgroundColor: getColor('#0f172a', 0.78),
        pixelOffset: new Cartesian2(0, -22),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        style: LabelStyle.FILL,
        verticalOrigin: VerticalOrigin.BOTTOM,
        horizontalOrigin: HorizontalOrigin.CENTER
      }
    });

    entity.show = layerVisibility[layerKey];

    return entity;
  }

  function createPolylineEntity(
    layerKey: Exclude<GlobeLayerKey, 'imagery'>,
    polylineOptions: { id: string; positions: readonly Coordinate[]; color: string; width?: number }
  ) {
    const viewer = viewerRef.value;

    if (!viewer) return null;

    const entity = viewer.entities.add({
      id: polylineOptions.id,
      polyline: {
        positions: polylineOptions.positions.map(position => Cartesian3.fromDegrees(position[0], position[1])),
        width: polylineOptions.width ?? 4,
        material: getColor(polylineOptions.color, 0.92),
        clampToGround: true
      }
    });

    entity.show = layerVisibility[layerKey];

    return entity;
  }

  function createPolygonEntity(polygonOptions: { id: string; positions: readonly Coordinate[]; color: string }) {
    const viewer = viewerRef.value;

    if (!viewer) return null;

    const entity = viewer.entities.add({
      id: polygonOptions.id,
      polygon: {
        hierarchy: new PolygonHierarchy(
          polygonOptions.positions.map(position => Cartesian3.fromDegrees(position[0], position[1]))
        ),
        material: getColor(polygonOptions.color, 0.18),
        outline: true,
        outlineColor: getColor(polygonOptions.color, 0.92),
        heightReference: HeightReference.CLAMP_TO_GROUND
      }
    });

    entity.show = layerVisibility.route;

    return entity;
  }

  function addStaticEntities() {
    globeStaticRoads.forEach(item => {
      const entity = createPolylineEntity('road', item);

      if (entity) staticEntities.road.push(entity);
    });

    globeStaticPipelines.forEach(item => {
      const entity = createPolylineEntity('pipeline', item);

      if (entity) staticEntities.pipeline.push(entity);
    });

    globeStaticRoutes.forEach(item => {
      const route = createPolylineEntity('route', item);

      if (route) staticEntities.route.push(route);
    });

    globeStaticMarks.forEach(item => {
      const entity = createPointEntity('mark', item);

      if (entity) staticEntities.mark.push(entity);
    });
  }

  function clearMeasureDraft() {
    const viewer = viewerRef.value;

    if (!viewer) return;

    dynamicMeasureEntities.splice(0).forEach(entity => viewer.entities.remove(entity));
    measurePositions.length = 0;
    requestRender();
  }

  function clearDynamicMarks() {
    const viewer = viewerRef.value;

    if (!viewer) return;

    dynamicMarkEntities.splice(0).forEach(entity => viewer.entities.remove(entity));
    dynamicRouteEntities.splice(0).forEach(entity => viewer.entities.remove(entity));
    clearMeasureDraft();
    requestRender();
  }

  function getSurfacePosition(position: Cartesian2) {
    const viewer = viewerRef.value;

    if (!viewer) return null;

    return viewer.camera.pickEllipsoid(position, viewer.scene.globe.ellipsoid);
  }

  function addDynamicAnnotation(longitude: number, latitude: number, name?: string) {
    const entity = createPointEntity('mark', {
      id: `manual-mark-${Date.now()}`,
      name: name ?? `标注${annotationIndex++}`,
      longitude,
      latitude,
      color: '#2B6BFF'
    });

    if (entity) {
      dynamicMarkEntities.push(entity);
      requestRender();
    }
  }

  /**
   * 计算两点间球面距离（米）
   */
  function calcDistance(p1: Cartesian3, p2: Cartesian3): number {
    return Cartesian3.distance(p1, p2);
  }

  /**
   * 计算三角形面积（球面近似，平方米）
   * 使用海伦公式对三点间距离进行近似计算
   */
  function calcTriangleArea(p1: Cartesian3, p2: Cartesian3, p3: Cartesian3): number {
    const a = Cartesian3.distance(p1, p2);
    const b = Cartesian3.distance(p2, p3);
    const c = Cartesian3.distance(p3, p1);
    const s = (a + b + c) / 2;
    return Math.sqrt(Math.max(s * (s - a) * (s - b) * (s - c), 0));
  }

  function handleMeasureDistance(position: Cartesian3) {
    measurePositions.push(position);

    const point = viewerRef.value?.entities.add({
      position,
      point: {
        pixelSize: 9,
        color: getColor('#ffd43b'),
        outlineColor: Color.WHITE,
        outlineWidth: 2
      }
    });

    if (point) dynamicMeasureEntities.push(point);

    if (measurePositions.length === 2) {
      const polyline = viewerRef.value?.entities.add({
        polyline: {
          positions: [...measurePositions],
          width: 3,
          material: getColor('#ffd43b'),
          clampToGround: false
        }
      });

      if (polyline) dynamicMeasureEntities.push(polyline);

      const distanceM = calcDistance(measurePositions[0], measurePositions[1]);
      const distanceKm = (distanceM / 1000).toFixed(2);
      window.$message?.success(`测距完成：${distanceKm} km`);
      measurePositions.length = 0;
      activeTool = 'browse';
      emitStatus();
    } else {
      window.$message?.info('请继续选择第二个点');
    }

    requestRender();
  }

  function handleMeasureArea(position: Cartesian3) {
    measurePositions.push(position);

    const point = viewerRef.value?.entities.add({
      position,
      point: {
        pixelSize: 9,
        color: getColor('#ff922b'),
        outlineColor: Color.WHITE,
        outlineWidth: 2
      }
    });

    if (point) dynamicMeasureEntities.push(point);

    if (measurePositions.length === 3) {
      const polygon = viewerRef.value?.entities.add({
        polygon: {
          hierarchy: new PolygonHierarchy([...measurePositions]),
          material: getColor('#ff922b', 0.24),
          outline: true,
          outlineColor: getColor('#ff922b')
        }
      });

      if (polygon) dynamicMeasureEntities.push(polygon);

      const areaSqM = calcTriangleArea(measurePositions[0], measurePositions[1], measurePositions[2]);
      const areaSqKm = (areaSqM / 1e6).toFixed(3);
      window.$message?.success(`测面完成：${areaSqKm} km²`);
      measurePositions.length = 0;
      activeTool = 'browse';
      emitStatus();
    } else {
      window.$message?.info('请继续选择区域顶点');
    }

    requestRender();
  }

  function bindMouseEvents() {
    const viewer = viewerRef.value;

    if (!viewer) return;

    eventHandler = new ScreenSpaceEventHandler(viewer.scene.canvas);

    eventHandler.setInputAction((movement: { endPosition: Cartesian2 }) => {
      emitStatus(getSurfacePosition(movement.endPosition));
    }, ScreenSpaceEventType.MOUSE_MOVE);

    eventHandler.setInputAction((click: { position: Cartesian2 }) => {
      const cartesian = getSurfacePosition(click.position);

      if (!cartesian) return;

      const cartographic = Cartographic.fromCartesian(cartesian);
      const longitude = Number(CesiumMath.toDegrees(cartographic.longitude).toFixed(6));
      const latitude = Number(CesiumMath.toDegrees(cartographic.latitude).toFixed(6));

      if (activeTool === 'annotate') {
        addDynamicAnnotation(longitude, latitude);
        window.$message?.success('已添加标注');
      }

      if (activeTool === 'measure-distance') {
        handleMeasureDistance(cartesian);
      }

      if (activeTool === 'measure-area') {
        handleMeasureArea(cartesian);
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    cameraChangedListener = () => emitStatus();
    viewer.camera.changed.addEventListener(cameraChangedListener);
  }

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
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity
    });

    viewerRef.value = viewer;

    viewer.scene.globe.showGroundAtmosphere = false;
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = false;
    }
    viewer.scene.globe.baseColor = Color.fromCssColorString('#07101d');
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 25000;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 40000000;
    viewer.scene.screenSpaceCameraController.zoomFactor = 1.5;
    viewer.scene.screenSpaceCameraController.inertiaZoom = 0.5;

    (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';

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

    addStaticEntities();
    bindMouseEvents();
    flyToPreset('default');
    emitStatus();
  }

  function flyToPreset(preset: keyof typeof globePresets = 'task') {
    const viewer = viewerRef.value;
    const target = globePresets[preset];

    if (!viewer || !target) return;

    flyToLocation(target.longitude, target.latitude, target.height);
  }

  function flyToLocation(longitude: number, latitude: number, height: number = globePresets.task.height) {
    const viewer = viewerRef.value;

    if (!viewer) return;

    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(longitude, latitude, height),
      duration: 1.3
    });
  }

  function resetView() {
    clearMeasureDraft();
    activeTool = 'browse';
    flyToPreset('default');
    emitStatus();
  }

  function setActiveTool(tool: GlobeInteractiveTool | 'browse') {
    activeTool = tool;

    if (tool === 'browse') {
      clearMeasureDraft();
    }

    emitStatus();
  }

  function setLayerVisible(layerKey: GlobeLayerKey, visible: boolean) {
    const viewer = viewerRef.value;

    layerVisibility[layerKey] = visible;

    if (!viewer) return;

    if (layerKey === 'imagery') {
      imageryLayers.forEach(imageryLayer => {
        imageryLayer.show = visible;
      });
      requestRender();
      return;
    }

    // 静态实体
    staticEntities[layerKey].forEach(entity => {
      entity.show = visible;
    });

    // 动态实体
    if (layerKey === 'mark') {
      dynamicMarkEntities.forEach(entity => {
        entity.show = visible;
      });
    }

    if (layerKey === 'route') {
      dynamicRouteEntities.forEach(entity => {
        entity.show = visible;
      });
    }

    requestRender();
  }

  function zoomIn() {
    viewerRef.value?.camera.zoomIn(25000);
    emitStatus();
  }

  function zoomOut() {
    viewerRef.value?.camera.zoomOut(25000);
    emitStatus();
  }

  function rotate() {
    viewerRef.value?.camera.rotateLeft(CesiumMath.toRadians(18));
    emitStatus();
  }

  function pitch() {
    viewerRef.value?.camera.lookUp(CesiumMath.toRadians(12));
    emitStatus();
  }

  function clearAnnotations() {
    clearDynamicMarks();
    window.$message?.success('已清除标注与测量结果');
  }

  function generateMark() {
    const taskPreset = globePresets.task;
    addDynamicAnnotation(taskPreset.longitude, taskPreset.latitude, `标注${annotationIndex++}`);
    window.$message?.success('已生成预置标注');
  }

  async function startAnalysis(onStep: (text: string) => void) {
    clearDynamicMarks();

    for (const step of globeAnalysisSteps) {
      onStep(step);
      await sleep(900);
    }

    const routeEntity = createPolylineEntity('route', globeAnalysisResult.route);
    const areaEntity = createPolygonEntity(globeAnalysisResult.area);

    if (routeEntity) dynamicRouteEntities.push(routeEntity);
    if (areaEntity) dynamicRouteEntities.push(areaEntity);

    globeAnalysisResult.marks.forEach(item => {
      const entity = createPointEntity('mark', item);

      if (entity) dynamicMarkEntities.push(entity);
    });

    flyToPreset('task');
    requestRender();
  }

  function exportScreenshot() {
    const viewer = viewerRef.value;

    if (!viewer) return;

    const link = document.createElement('a');
    link.download = `webglobe-${Date.now()}.png`;
    link.href = viewer.canvas.toDataURL('image/png');
    link.click();
    window.$message?.success('截图已导出');
  }

  onBeforeUnmount(() => {
    if (cameraChangedListener && viewerRef.value) {
      viewerRef.value.camera.changed.removeEventListener(cameraChangedListener);
    }

    eventHandler?.destroy();

    if (viewerRef.value && !viewerRef.value.isDestroyed()) {
      viewerRef.value.destroy();
    }
  });

  return {
    containerRef,
    initViewer,
    setActiveTool,
    setLayerVisible,
    flyToPreset,
    flyToLocation,
    resetView,
    zoomIn,
    zoomOut,
    rotate,
    pitch,
    clearAnnotations,
    generateMark,
    startAnalysis,
    exportScreenshot
  };
}
