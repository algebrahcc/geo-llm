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
  NearFarScalar,
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
  riverFlowTemplate,
  riverPlanScenes,
  riverPlanSummaries,
  riverPresets,
  riverStaticAssemblyZones,
  riverStaticChannels
} from '@/mock/river';
import type {
  RiverInteractiveTool,
  RiverLayerKey,
  RiverPlanKey,
  RiverPointOverlay,
  RiverPolygonOverlay,
  RiverStatusInfo,
  RiverLineOverlay
} from './types';

interface UseCesiumRiverOptions {
  onStatusChange?: (status: RiverStatusInfo) => void;
}

const toolNameMap: Record<RiverInteractiveTool | 'browse', string> = {
  browse: '浏览',
  annotate: '标注'
};

function sleep(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

export function useCesiumRiver(options: UseCesiumRiverOptions = {}) {
  const containerRef = shallowRef<HTMLDivElement | null>(null);
  const viewerRef = shallowRef<Viewer | null>(null);

  const globalImageryUrl = getGlobalImageryUrl();
  const regionImageryUrl = getRegionImageryUrl();
  const localConfig = getLocalImageryConfig();

  const imageryLayers: ImageryLayer[] = [];
  const staticEntities: Record<'channel' | 'assembly', Entity[]> = {
    channel: [],
    assembly: []
  };
  const planEntities: Record<'route' | 'risk' | 'mark', Entity[]> = {
    route: [],
    risk: [],
    mark: []
  };
  const dynamicMarkEntities: Entity[] = [];

  const layerVisibility: Record<RiverLayerKey, boolean> = {
    imagery: true,
    channel: true,
    assembly: true,
    risk: true,
    mark: true,
    route: true
  };

  let activeTool: RiverInteractiveTool | 'browse' = 'browse';
  let activePlan: RiverPlanKey = 'plan-a';
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
      activeTool: toolNameMap[activeTool],
      currentPlan: riverPlanSummaries[activePlan].label
    });
  }

  function requestRender() {
    viewerRef.value?.scene.requestRender();
  }

  function getColor(css: string, alpha = 1) {
    return Color.fromCssColorString(css).withAlpha(alpha);
  }

  function createPolylineEntity(layerKey: RiverLayerKey, item: RiverLineOverlay) {
    const viewer = viewerRef.value;

    if (!viewer) return null;

    const entity = viewer.entities.add({
      id: item.id,
      name: item.name,
      polyline: ({
        positions: item.positions.map(position => Cartesian3.fromDegrees(position[0], position[1])),
        width: item.width ?? 5,
        material: getColor(item.color, 0.94),
        clampToGround: true,
        depthFail: getColor(item.color, 0.4)
      } as any)
    });

    entity.show = layerVisibility[layerKey];

    return entity;
  }

  function createPolygonEntity(layerKey: RiverLayerKey, item: RiverPolygonOverlay) {
    const viewer = viewerRef.value;

    if (!viewer) return null;

    const entity = viewer.entities.add({
      id: item.id,
      name: item.name,
      polygon: {
        hierarchy: new PolygonHierarchy(
          item.positions.map(position => Cartesian3.fromDegrees(position[0], position[1]))
        ),
        material: getColor(item.color, 0.2),
        outline: true,
        outlineColor: getColor(item.color, 0.95),
        outlineWidth: 2,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        depthFail: getColor(item.color, 0.1)
      } as any
    });

    entity.show = layerVisibility[layerKey];

    return entity;
  }

  function createPointEntity(layerKey: RiverLayerKey, item: RiverPointOverlay) {
    const viewer = viewerRef.value;

    if (!viewer) return null;

    const entity = viewer.entities.add({
      id: item.id,
      name: item.name,
      position: Cartesian3.fromDegrees(item.longitude, item.latitude),
      point: {
        pixelSize: 14,
        color: getColor(item.color),
        outlineColor: Color.WHITE,
        outlineWidth: 3,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new NearFarScalar(500, 1.8, 50000, 0.4)
      },
      label: {
        text: item.name,
        font: 'bold 13px Microsoft YaHei',
        fillColor: Color.WHITE,
        showBackground: true,
        backgroundColor: getColor('#0a1628', 0.85),
        backgroundPadding: new Cartesian2(6, 4),
        pixelOffset: new Cartesian2(0, -24),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        style: LabelStyle.FILL_AND_OUTLINE,
        outlineColor: getColor(item.color, 0.9),
        outlineWidth: 2,
        verticalOrigin: VerticalOrigin.BOTTOM,
        horizontalOrigin: HorizontalOrigin.CENTER
      }
    });

    entity.show = layerVisibility[layerKey];

    return entity;
  }

  function clearPlanEntities() {
    const viewer = viewerRef.value;

    if (!viewer) return;

    Object.values(planEntities).forEach(entities => {
      entities.forEach(entity => viewer.entities.remove(entity));
      entities.splice(0, entities.length);
    });
  }

  function syncLayerVisibility() {
    imageryLayers.forEach(layer => {
      layer.show = layerVisibility.imagery;
    });

    staticEntities.channel.forEach(entity => {
      entity.show = layerVisibility.channel;
    });

    staticEntities.assembly.forEach(entity => {
      entity.show = layerVisibility.assembly;
    });

    planEntities.route.forEach(entity => {
      entity.show = layerVisibility.route;
    });

    planEntities.risk.forEach(entity => {
      entity.show = layerVisibility.risk;
    });

    [...planEntities.mark, ...dynamicMarkEntities].forEach(entity => {
      entity.show = layerVisibility.mark;
    });

    requestRender();
  }

  function addStaticEntities() {
    riverStaticChannels.forEach(item => {
      const entity = createPolylineEntity('channel', item);

      if (entity) staticEntities.channel.push(entity);
    });

    riverStaticAssemblyZones.forEach(item => {
      const entity = createPolygonEntity('assembly', item);

      if (entity) staticEntities.assembly.push(entity);
    });
  }

  function showPlan(planKey: RiverPlanKey) {
    activePlan = planKey;
    clearPlanEntities();

    const scene = riverPlanScenes[planKey];
    const routeEntity = createPolylineEntity('route', scene.route);

    if (routeEntity) planEntities.route.push(routeEntity);

    scene.riskZones.forEach(item => {
      const entity = createPolygonEntity('risk', item);

      if (entity) planEntities.risk.push(entity);
    });

    scene.marks.forEach(item => {
      const entity = createPointEntity('mark', item);

      if (entity) planEntities.mark.push(entity);
    });

    syncLayerVisibility();
    emitStatus();
  }

  function flyToPreset() {
    const viewer = viewerRef.value;

    if (!viewer) return;

    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(
        riverPresets.task.longitude,
        riverPresets.task.latitude,
        riverPresets.task.height
      ),
      duration: 1.4
    });
  }

  function flyToLocation(longitude: number, latitude: number, height = riverPresets.task.height) {
    const viewer = viewerRef.value;

    if (!viewer) return;

    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(longitude, latitude, height),
      duration: 1.2
    });
  }

  function setActiveTool(tool: RiverInteractiveTool | 'browse') {
    activeTool = tool;
    emitStatus();
  }

  function setLayerVisible(key: RiverLayerKey, visible: boolean) {
    layerVisibility[key] = visible;
    syncLayerVisibility();
  }

  function resetView() {
    activeTool = 'browse';
    flyToPreset();
    emitStatus();
  }

  function zoomIn() {
    const viewer = viewerRef.value;

    if (!viewer) return;

    viewer.camera.zoomIn(1200);
    emitStatus();
  }

  function zoomOut() {
    const viewer = viewerRef.value;

    if (!viewer) return;

    viewer.camera.zoomOut(1200);
    emitStatus();
  }

  function rotate() {
    const viewer = viewerRef.value;

    if (!viewer) return;

    viewer.camera.rotateRight(CesiumMath.toRadians(10));
    emitStatus();
  }

  function pitch() {
    const viewer = viewerRef.value;

    if (!viewer) return;

    viewer.camera.lookUp(CesiumMath.toRadians(8));
    emitStatus();
  }

  function clearAnnotations() {
    const viewer = viewerRef.value;

    if (!viewer) return;

    dynamicMarkEntities.forEach(entity => viewer.entities.remove(entity));
    dynamicMarkEntities.splice(0, dynamicMarkEntities.length);
    requestRender();
  }

  function createDynamicMark(longitude: number, latitude: number, name = `临时标注 ${annotationIndex}`) {
    const entity = createPointEntity('mark', {
      id: `river-dynamic-mark-${annotationIndex}`,
      name,
      longitude,
      latitude,
      color: '#ffd166'
    });

    annotationIndex += 1;

    if (entity) {
      dynamicMarkEntities.push(entity);
      requestRender();
    }
  }

  function generateMark() {
    createDynamicMark(riverPresets.task.longitude + 0.012, riverPresets.task.latitude - 0.005, '临时保障点');
  }

  async function startAnalysis(planKey: RiverPlanKey, onStep?: (index: number) => void) {
    for (let index = 0; index < riverFlowTemplate.length; index += 1) {
      onStep?.(index);
      await sleep(index === riverFlowTemplate.length - 1 ? 480 : 620);
    }

    showPlan(planKey);
    flyToPreset();
  }

  function exportScreenshot() {
    const viewer = viewerRef.value;

    if (!viewer) return;

    try {
      requestRender();
      const url = viewer.canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `river-plan-${activePlan}.png`;
      link.click();
      window.$message?.success('已导出当前视角截图');
    } catch {
      window.$message?.error('截图导出失败');
    }
  }

  function getCartesianFromScreen(position: Cartesian2) {
    const viewer = viewerRef.value;

    if (!viewer) return null;

    return viewer.camera.pickEllipsoid(position, viewer.scene.globe.ellipsoid);
  }

  function bindSceneEvents() {
    const viewer = viewerRef.value;

    if (!viewer) return;

    eventHandler = new ScreenSpaceEventHandler(viewer.scene.canvas);

    eventHandler.setInputAction((movement: { endPosition: Cartesian2 }) => {
      const cartesian = getCartesianFromScreen(movement.endPosition);
      emitStatus(cartesian);
    }, ScreenSpaceEventType.MOUSE_MOVE);

    eventHandler.setInputAction((event: { position: Cartesian2 }) => {
      if (activeTool !== 'annotate') return;

      const cartesian = getCartesianFromScreen(event.position);

      if (!cartesian) return;

      const cartographic = Cartographic.fromCartesian(cartesian);
      createDynamicMark(CesiumMath.toDegrees(cartographic.longitude), CesiumMath.toDegrees(cartographic.latitude));
      emitStatus(cartesian);
    }, ScreenSpaceEventType.LEFT_CLICK);

    cameraChangedListener = () => emitStatus();
    viewer.camera.changed.addEventListener(cameraChangedListener);
  }

  async function initViewer() {
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
      shouldAnimate: false,
      terrainProvider: new EllipsoidTerrainProvider(),
      timeline: false
    });

    viewerRef.value = viewer;
    viewer.scene.globe.depthTestAgainstTerrain = false;
    viewer.scene.requestRenderMode = true;
    viewer.camera.percentageChanged = 0.01;
    viewer.scene.screenSpaceCameraController.zoomFactor = 1.18;
    viewer.scene.screenSpaceCameraController.inertiaZoom = 0.35;

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

    addStaticEntities();
    showPlan(activePlan);
    bindSceneEvents();
    flyToPreset();
    emitStatus(Cartesian3.fromDegrees(riverPresets.task.longitude, riverPresets.task.latitude, 0));
  }

  onBeforeUnmount(() => {
    if (eventHandler) {
      eventHandler.destroy();
      eventHandler = null;
    }

    if (viewerRef.value && cameraChangedListener) {
      viewerRef.value.camera.changed.removeEventListener(cameraChangedListener);
      cameraChangedListener = null;
    }

    viewerRef.value?.destroy();
    viewerRef.value = null;
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
    exportScreenshot,
    showPlan
  };
}
