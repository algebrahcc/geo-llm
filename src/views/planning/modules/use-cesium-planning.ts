import { useCesiumBase } from '@/composables/cesium/use-cesium-base';
import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  ColorMaterialProperty,
  ConstantProperty,
  Entity,
  HeightReference,
  HorizontalOrigin,
  LabelStyle,
  Math as CesiumMath,
  PolygonHierarchy,
  VerticalOrigin
} from 'cesium';
import { planningDefaultTaskForm, planningPresets, planningRouteScenes, planningRouteSummaries } from '@/mock/planning';
import { createToolNameMap } from '@/typings/cesium';
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

const toolNameMap = createToolNameMap<PlanningInteractiveTool>([
  ['browse', '浏览'],
  ['pick-start', '选取起点'],
  ['pick-end', '选取终点']
]);

export function useCesiumPlanning(options: UseCesiumPlanningOptions = {}) {
  const base = useCesiumBase();
  const { containerRef, viewerRef } = base;

  const routeEntities: Partial<Record<PlanningRouteKey, Entity>> = {};
  const selectedRiskEntities: Entity[] = [];
  const selectedObstacleEntities: Entity[] = [];
  const waypointMarkerEntities: Entity[] = [];

  let startMarkerEntity: Entity | null = null;
  let endMarkerEntity: Entity | null = null;
  let activeTool: PlanningInteractiveTool = 'browse';
  let currentRoute: PlanningRouteKey = 'route-a';

  const layerVisibility: Record<PlanningLayerKey, boolean> = {
    imagery: true,
    'selected-route': true,
    'candidate-route': true,
    risk: true,
    obstacle: true,
    markers: true,
    waypoints: true
  };

  const computeStatus = base.createEmitStatus(() => ({
    activeTool: toolNameMap[activeTool],
    currentRoute: planningRouteSummaries[currentRoute]?.label ?? '--',
    planningState: '--'
  }));

  function emitStatus(cartesian?: Cartesian3 | null) {
    options.onStatusChange?.(computeStatus(cartesian) as unknown as PlanningStatusInfo);
  }

  // ─── Entity 创建（模块特有样式） ────────────────────

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
        material: new ColorMaterialProperty(base.getColor(item.color, 0.35))
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
        material: base.getColor(item.color, 0.18),
        outline: true,
        outlineColor: base.getColor(item.color, 0.92),
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
        color: base.getColor(item.color),
        outlineColor: Color.WHITE,
        outlineWidth: 2,
        heightReference: HeightReference.CLAMP_TO_GROUND
      },
      label: {
        text: item.name,
        font: '12px Microsoft YaHei',
        fillColor: Color.WHITE,
        showBackground: true,
        backgroundColor: base.getColor('#0f172a', 0.78),
        pixelOffset: new Cartesian2(0, -22),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        style: LabelStyle.FILL,
        verticalOrigin: VerticalOrigin.BOTTOM,
        horizontalOrigin: HorizontalOrigin.CENTER
      }
    });
  }

  // ─── 图层管理 ─────────────────────────────────────

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
          color: base.getColor('#5ea4ff'),
          outlineColor: Color.WHITE,
          outlineWidth: 2,
          heightReference: HeightReference.CLAMP_TO_GROUND
        },
        label: {
          text: `${index + 1}. ${wp.name}`,
          font: '12px Microsoft YaHei',
          fillColor: Color.WHITE,
          showBackground: true,
          backgroundColor: base.getColor('#0f172a', 0.82),
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

    base.requestRender();
  }

  function updateRouteStyles() {
    (Object.keys(planningRouteScenes) as PlanningRouteKey[]).forEach(key => {
      const entity = routeEntities[key];
      const scene = planningRouteScenes[key];

      if (!entity?.polyline) return;

      const selected = key === currentRoute;
      entity.polyline.width = new ConstantProperty(selected ? 5 : 3);
      entity.polyline.material = new ColorMaterialProperty(base.getColor(scene.route.color, selected ? 0.96 : 0.28));
      entity.show = selected ? layerVisibility['selected-route'] : layerVisibility['candidate-route'];
    });
  }

  function syncLayerVisibility() {
    const { imageryLayers } = base;
    imageryLayers.forEach(layer => { layer.show = layerVisibility.imagery; });

    updateRouteStyles();

    selectedRiskEntities.forEach(entity => { entity.show = layerVisibility.risk; });
    selectedObstacleEntities.forEach(entity => { entity.show = layerVisibility.obstacle; });

    if (startMarkerEntity) startMarkerEntity.show = layerVisibility.markers;
    if (endMarkerEntity) endMarkerEntity.show = layerVisibility.markers;

    waypointMarkerEntities.forEach(entity => { entity.show = layerVisibility.waypoints; });

    base.requestRender();
  }

  // ─── 模块业务逻辑 ─────────────────────────────────

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
    base.requestRender();
  }

  function updateMarker(kind: 'start' | 'end', point: { longitude: number; latitude: number; name: string } | null) {
    const viewer = viewerRef.value;
    if (!viewer) return;

    const currentEntity = kind === 'start' ? startMarkerEntity : endMarkerEntity;

    if (currentEntity) {
      viewer.entities.remove(currentEntity);
    }

    if (!point) {
      if (kind === 'start') startMarkerEntity = null;
      else endMarkerEntity = null;
      base.requestRender();
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

    if (entity) entity.show = layerVisibility.markers;

    if (kind === 'start') startMarkerEntity = entity;
    else endMarkerEntity = entity;

    base.requestRender();
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
    base.flyToLocation(
      planningPresets.task.longitude,
      planningPresets.task.latitude,
      planningPresets.task.height,
      1.3
    );
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

  // ─── 初始化 ───────────────────────────────────────

  async function initViewer() {
    await base.initViewer({
      prepareViewer(viewer) {
        viewer.scene.globe.depthTestAgainstTerrain = false;
        viewer.scene.requestRenderMode = true;
        viewer.camera.percentageChanged = 0.01;
        viewer.scene.screenSpaceCameraController.zoomFactor = 1.18;
        viewer.scene.screenSpaceCameraController.inertiaZoom = 0.35;
      },
      afterImagery() {
        // 加载候选路线
        (Object.keys(planningRouteScenes) as PlanningRouteKey[]).forEach(key => {
          const entity = createPolylineEntity(planningRouteScenes[key].route);
          if (entity) routeEntities[key] = entity;
        });

        // 绑定事件
        base.bindMouseEvents({
          onMouseMove: (movement: { endPosition: Cartesian2 }) => {
            const cartesian = base.getCartesianFromScreen(movement.endPosition);
            emitStatus(cartesian);
          },
          onLeftClick: (event: { position: Cartesian2 }) => {
            if (activeTool === 'browse') return;

            const cartesian = base.getCartesianFromScreen(event.position);
            if (!cartesian) return;

            const cartographic = Cartographic.fromCartesian(cartesian);
            options.onPointPicked?.({
              type: activeTool === 'pick-start' ? 'start' : 'end',
              longitude: CesiumMath.toDegrees(cartographic.longitude),
              latitude: CesiumMath.toDegrees(cartographic.latitude)
            });

            emitStatus(cartesian);
          }
        });

        base.addCameraChangeListener(() => emitStatus());

        // 初始化路由和标记
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
    });
  }

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
    zoomIn: base.zoomIn,
    zoomOut: base.zoomOut,
    rotate: base.rotate,
    pitch: base.pitch,
    exportScreenshot: () => base.exportScreenshot(`planning-route-${currentRoute}.png`),
    is2dMode: base.is2dMode,
    toggleViewMode: base.toggleViewMode
  };
}
