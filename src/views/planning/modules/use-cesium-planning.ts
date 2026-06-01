import { onBeforeUnmount, shallowRef } from 'vue';
import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  ColorMaterialProperty,
  ConstantProperty,
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
import { planningDefaultTaskForm, planningPresets, planningRouteScenes, planningRouteSummaries } from '@/mock/planning';
import type {
  PlanningInteractiveTool,
  PlanningLayerKey,
  PlanningPickedPoint,
  PlanningPointOverlay,
  PlanningPolygonOverlay,
  PlanningRouteKey,
  PlanningStatusInfo,
  PlanningLineOverlay,
  PlanningWaypoint
} from './types';

interface UseCesiumPlanningOptions {
  onStatusChange?: (status: PlanningStatusInfo) => void;
  onPointPicked?: (payload: PlanningPickedPoint) => void;
}

const toolNameMap: Record<PlanningInteractiveTool, string> = {
  browse: '浏览',
  'pick-start': '选取起点',
  'pick-end': '选取终点'
};

export function useCesiumPlanning(options: UseCesiumPlanningOptions = {}) {
  const containerRef = shallowRef<HTMLDivElement | null>(null);
  const viewerRef = shallowRef<Viewer | null>(null);

  const globalImageryUrl = getGlobalImageryUrl();
  const regionImageryUrl = getRegionImageryUrl();
  const localConfig = getLocalImageryConfig();

  const imageryLayers: ImageryLayer[] = [];
  const routeEntities: Partial<Record<PlanningRouteKey, Entity>> = {};
  const selectedRiskEntities: Entity[] = [];
  const selectedObstacleEntities: Entity[] = [];
  const waypointMarkerEntities: Entity[] = [];

  let startMarkerEntity: Entity | null = null;
  let endMarkerEntity: Entity | null = null;
  let activeTool: PlanningInteractiveTool = 'browse';
  let currentRoute: PlanningRouteKey = 'route-a';
  let eventHandler: ScreenSpaceEventHandler | null = null;
  let cameraChangedListener: (() => void) | null = null;

  const layerVisibility: Record<PlanningLayerKey, boolean> = {
    imagery: true,
    'selected-route': true,
    'candidate-route': true,
    risk: true,
    obstacle: true,
    markers: true,
    waypoints: true
  };

  function requestRender() {
    viewerRef.value?.scene.requestRender();
  }

  function getColor(css: string, alpha = 1) {
    return Color.fromCssColorString(css).withAlpha(alpha);
  }

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
      currentRoute: planningRouteSummaries[currentRoute].label,
      planningState: '--'
    });
  }

  function createPolylineEntity(item: PlanningLineOverlay) {
    const viewer = viewerRef.value;

    if (!viewer) return null;

    return viewer.entities.add({
      id: item.id,
      name: item.name,
      polyline: {
        positions: item.positions.map(position => Cartesian3.fromDegrees(position[0], position[1])),
        width: new ConstantProperty(item.width ?? 4),
        clampToGround: true,
        material: new ColorMaterialProperty(getColor(item.color, 0.35))
      }
    });
  }

  function createPolygonEntity(item: PlanningPolygonOverlay) {
    const viewer = viewerRef.value;

    if (!viewer) return null;

    return viewer.entities.add({
      id: item.id,
      name: item.name,
      polygon: {
        hierarchy: new PolygonHierarchy(
          item.positions.map(position => Cartesian3.fromDegrees(position[0], position[1]))
        ),
        material: getColor(item.color, 0.18),
        outline: true,
        outlineColor: getColor(item.color, 0.92),
        heightReference: HeightReference.CLAMP_TO_GROUND
      }
    });
  }

  function createPointEntity(item: PlanningPointOverlay, pixelSize = 11) {
    const viewer = viewerRef.value;

    if (!viewer) return null;

    return viewer.entities.add({
      id: item.id,
      name: item.name,
      position: Cartesian3.fromDegrees(item.longitude, item.latitude),
      point: {
        pixelSize,
        color: getColor(item.color),
        outlineColor: Color.WHITE,
        outlineWidth: 2,
        heightReference: HeightReference.CLAMP_TO_GROUND
      },
      label: {
        text: item.name,
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
  }

  function clearSelectedEntities() {
    const viewer = viewerRef.value;

    if (!viewer) return;

    selectedRiskEntities.forEach(entity => viewer.entities.remove(entity));
    selectedObstacleEntities.forEach(entity => viewer.entities.remove(entity));
    selectedRiskEntities.splice(0, selectedRiskEntities.length);
    selectedObstacleEntities.splice(0, selectedObstacleEntities.length);
  }

  function clearWaypointMarkers() {
    const viewer = viewerRef.value;

    if (!viewer) return;

    waypointMarkerEntities.forEach(entity => viewer.entities.remove(entity));
    waypointMarkerEntities.splice(0, waypointMarkerEntities.length);
  }

  function showWaypoints(waypoints: PlanningWaypoint[]) {
    const viewer = viewerRef.value;

    if (!viewer) return;

    clearWaypointMarkers();

    waypoints.forEach((wp, index) => {
      if (wp.longitude == null || wp.latitude == null) return;

      const entity = viewer.entities.add({
        id: `planning-waypoint-${wp.id}`,
        name: wp.name,
        position: Cartesian3.fromDegrees(wp.longitude, wp.latitude),
        point: {
          pixelSize: 10,
          color: getColor('#5ea4ff'),
          outlineColor: Color.WHITE,
          outlineWidth: 2,
          heightReference: HeightReference.CLAMP_TO_GROUND
        },
        label: {
          text: `${index + 1}. ${wp.name}`,
          font: '12px Microsoft YaHei',
          fillColor: Color.WHITE,
          showBackground: true,
          backgroundColor: getColor('#0f172a', 0.82),
          pixelOffset: new Cartesian2(0, -20),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          style: LabelStyle.FILL,
          verticalOrigin: VerticalOrigin.BOTTOM,
          horizontalOrigin: HorizontalOrigin.CENTER
        }
      });

      if (entity) {
        entity.show = layerVisibility.waypoints;
        waypointMarkerEntities.push(entity);
      }
    });

    requestRender();
  }

  function updateRouteStyles() {
    (Object.keys(planningRouteScenes) as PlanningRouteKey[]).forEach(key => {
      const entity = routeEntities[key];
      const scene = planningRouteScenes[key];

      if (!entity?.polyline) return;

      const selected = key === currentRoute;
      entity.polyline.width = new ConstantProperty(selected ? 5 : 3);
      entity.polyline.material = new ColorMaterialProperty(getColor(scene.route.color, selected ? 0.96 : 0.28));
      entity.show = selected ? layerVisibility['selected-route'] : layerVisibility['candidate-route'];
    });
  }

  function syncLayerVisibility() {
    imageryLayers.forEach(layer => {
      layer.show = layerVisibility.imagery;
    });

    updateRouteStyles();

    selectedRiskEntities.forEach(entity => {
      entity.show = layerVisibility.risk;
    });

    selectedObstacleEntities.forEach(entity => {
      entity.show = layerVisibility.obstacle;
    });

    if (startMarkerEntity) {
      startMarkerEntity.show = layerVisibility.markers;
    }

    if (endMarkerEntity) {
      endMarkerEntity.show = layerVisibility.markers;
    }

    waypointMarkerEntities.forEach(entity => {
      entity.show = layerVisibility.waypoints;
    });

    requestRender();
  }

  function showRoute(routeKey: PlanningRouteKey) {
    currentRoute = routeKey;
    clearSelectedEntities();

    const scene = planningRouteScenes[routeKey];
    updateRouteStyles();

    scene.risks.forEach(item => {
      const entity = createPolygonEntity(item);

      if (entity) {
        entity.show = layerVisibility.risk;
        selectedRiskEntities.push(entity);
      }
    });

    scene.obstacles.forEach(item => {
      const entity = createPointEntity(item, 10);

      if (entity) {
        entity.show = layerVisibility.obstacle;
        selectedObstacleEntities.push(entity);
      }
    });

    emitStatus();
    requestRender();
  }

  function updateMarker(kind: 'start' | 'end', point: { longitude: number; latitude: number; name: string } | null) {
    const viewer = viewerRef.value;

    if (!viewer) return;

    const currentEntity = kind === 'start' ? startMarkerEntity : endMarkerEntity;

    if (currentEntity) {
      viewer.entities.remove(currentEntity);
    }

    if (!point) {
      if (kind === 'start') {
        startMarkerEntity = null;
      } else {
        endMarkerEntity = null;
      }
      requestRender();
      return;
    }

    const entity = createPointEntity(
      {
        id: `planning-${kind}-marker`,
        name: point.name,
        longitude: point.longitude,
        latitude: point.latitude,
        color: kind === 'start' ? '#2ee59d' : '#5ea4ff'
      },
      12
    );

    if (entity) {
      entity.show = layerVisibility.markers;
    }

    if (kind === 'start') {
      startMarkerEntity = entity;
    } else {
      endMarkerEntity = entity;
    }

    requestRender();
  }

  function setStartPoint(longitude: number | null, latitude: number | null, name = '起点') {
    if (longitude == null || latitude == null) {
      updateMarker('start', null);
      return;
    }

    updateMarker('start', { longitude, latitude, name });
  }

  function setEndPoint(longitude: number | null, latitude: number | null, name = '终点') {
    if (longitude == null || latitude == null) {
      updateMarker('end', null);
      return;
    }

    updateMarker('end', { longitude, latitude, name });
  }

  function flyToPreset() {
    const viewer = viewerRef.value;

    if (!viewer) return;

    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(
        planningPresets.task.longitude,
        planningPresets.task.latitude,
        planningPresets.task.height
      ),
      duration: 1.3
    });
  }

  function setActiveTool(tool: PlanningInteractiveTool) {
    activeTool = tool;
    emitStatus();
  }

  function setLayerVisible(key: PlanningLayerKey, visible: boolean) {
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
    requestRender();
    emitStatus();
  }

  function zoomOut() {
    const viewer = viewerRef.value;

    if (!viewer) return;

    viewer.camera.zoomOut(1200);
    requestRender();
    emitStatus();
  }

  function exportScreenshot() {
    const viewer = viewerRef.value;

    if (!viewer) return;

    try {
      requestRender();
      const url = viewer.canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `planning-route-${currentRoute}.png`;
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
      if (activeTool === 'browse') return;

      const cartesian = getCartesianFromScreen(event.position);

      if (!cartesian) return;

      const cartographic = Cartographic.fromCartesian(cartesian);
      options.onPointPicked?.({
        type: activeTool === 'pick-start' ? 'start' : 'end',
        longitude: CesiumMath.toDegrees(cartographic.longitude),
        latitude: CesiumMath.toDegrees(cartographic.latitude)
      });

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

    (Object.keys(planningRouteScenes) as PlanningRouteKey[]).forEach(key => {
      const entity = createPolylineEntity(planningRouteScenes[key].route);

      if (entity) {
        routeEntities[key] = entity;
      }
    });

    bindSceneEvents();
    showRoute(currentRoute);
    setStartPoint(
      planningDefaultTaskForm.startLongitude,
      planningDefaultTaskForm.startLatitude,
      planningDefaultTaskForm.startName
    );
    setEndPoint(
      planningDefaultTaskForm.endLongitude,
      planningDefaultTaskForm.endLatitude,
      planningDefaultTaskForm.endName
    );
    flyToPreset();
    emitStatus(Cartesian3.fromDegrees(planningPresets.task.longitude, planningPresets.task.latitude, 0));
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
    showRoute,
    showWaypoints,
    setStartPoint,
    setEndPoint,
    resetView,
    zoomIn,
    zoomOut,
    exportScreenshot
  };
}
