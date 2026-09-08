import { useCesiumBase } from '@/composables/cesium/use-cesium-base';
import { useCesiumServices } from '@/composables/cesium/use-cesium-services';
import { useCesiumVectorLayer } from '@/composables/cesium/use-cesium-vector-layer';
import { fetchEnabledDataServices } from '@/service/api/dataservice';
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
import { unwrapResponseData } from '@/service/request/envelope';
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
  // 数据服务组合层：管理激活服务图层句柄，供图层面板渲染（与渡河保障一致）
  const services = useCesiumServices(base);
  // 矢量图层组合层（通用）：mvt-imagery-provider 按瓦片渲染后端 MVT
  const vectorLayers = useCesiumVectorLayer(base);

  const routeEntities: Partial<Record<PlanningRouteKey, Entity>> = {};
  const selectedRiskEntities: Entity[] = [];
  const selectedObstacleEntities: Entity[] = [];
  const waypointMarkerEntities: Entity[] = [];
  // 智能体标绘层（AI 指令产生的点/线/面/文字，按 id 管理，可单删/全清）
  const aiOverlayEntries = new Map<string, Entity>();
  let aiPlotSeq = 0;

  let startMarkerEntity: Entity | null = null;
  let endMarkerEntity: Entity | null = null;
  let activeTool: PlanningInteractiveTool = 'browse';
  let currentRoute: PlanningRouteKey = 'route-a';
  // 路线/风险/障碍是否可见：页面初始只显示起终点标记，AI 智能规划完成后 revealRoutes() 打开
  let routesVisible = false;

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
        // 超采样：2 倍字号栅格化 + scale 0.5 显示，消除高分屏下文字发虚
        text: item.name,
        font: '24px Microsoft YaHei',
        scale: 0.5,
        fillColor: Color.WHITE,
        showBackground: true,
        backgroundColor: base.getColor('#050d18', 0.9),
        backgroundPadding: new Cartesian2(9, 6),
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

      // 规划未完成时隐藏全部路线；完成后按选中/候选样式显示
      if (!routesVisible) {
        entity.show = false;
        return;
      }

      const selected = key === currentRoute;
      entity.polyline.width = new ConstantProperty(selected ? 5 : 3);
      entity.polyline.material = new ColorMaterialProperty(base.getColor(scene.route.color, selected ? 0.96 : 0.28));
      entity.show = selected ? layerVisibility['selected-route'] : layerVisibility['candidate-route'];
    });
  }

  function syncLayerVisibility() {
    const { imageryLayers } = base;
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

    if (startMarkerEntity) startMarkerEntity.show = layerVisibility.markers;
    if (endMarkerEntity) endMarkerEntity.show = layerVisibility.markers;

    waypointMarkerEntities.forEach(entity => {
      entity.show = layerVisibility.waypoints;
    });

    base.requestRender();
  }

  // ─── 模块业务逻辑 ─────────────────────────────────

  function showRoute(routeKey: PlanningRouteKey) {
    currentRoute = routeKey;
    clearSelectedEntities();

    const scene = planningRouteScenes[routeKey];
    updateRouteStyles();

    if (!routesVisible) {
      base.requestRender();
      return;
    }

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

  /** AI 智能规划完成后调用：显示全部候选路线（选中路线高亮 + 其余候选淡显），并绘出风险/障碍 */
  function revealRoutes(routeKey: PlanningRouteKey = currentRoute) {
    if (routesVisible) return;
    routesVisible = true;
    showRoute(routeKey);
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
    base.flyToLocation(planningPresets.task.longitude, planningPresets.task.latitude, planningPresets.task.height, 1.3);
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
        // 按设备推荐分辨率（DPR）渲染，高分屏（Windows 125%/150% 缩放）下文字/线划不发虚
        viewer.useBrowserRecommendedResolution = true;
        viewer.camera.percentageChanged = 0.01;
        viewer.scene.screenSpaceCameraController.zoomFactor = 2.2;
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

    // 数据服务（与渡河保障一致）：加载全部启用中的数据服务（登记句柄供图层面板渲染）→ 重建影像/地形层序
    try {
      const serviceResult = await fetchEnabledDataServices();
      const serviceList = unwrapResponseData<Api.DataService.DataServiceItem[]>(serviceResult) ?? [];
      await services.loadEnabled(undefined, serviceList);
      await base.applyServices(serviceList, services.handles.value);
    } catch (e) {
      console.warn('[Planning] 数据服务加载失败，使用默认图源:', e);
    }
  }

  // ─── 智能体标绘层（AI 指令 → 点/线/面/文字，按 id 管理） ───

  interface AiOverlayItem {
    id?: string;
    name?: string;
    color?: string;
  }

  function resolveAiId(item: AiOverlayItem): string {
    return item.id || `ai-plot-${++aiPlotSeq}`;
  }

  function drawAiMark(item: AiOverlayItem & { lon: number; lat: number }): string {
    const id = resolveAiId(item);
    const viewer = viewerRef.value;
    if (!viewer) return id;
    const existing = viewer.entities.getById(id);
    if (existing) viewer.entities.remove(existing);
    const entity = createPointEntity({
      id,
      name: item.name || 'AI 标注',
      longitude: item.lon,
      latitude: item.lat,
      color: item.color || '#fb7185'
    });
    if (entity) {
      aiOverlayEntries.set(id, entity);
      base.requestRender();
    }
    return id;
  }

  function drawAiText(item: AiOverlayItem & { lon: number; lat: number; text: string }): string {
    return drawAiMark({ ...item, name: item.text });
  }

  function drawAiLine(item: AiOverlayItem & { positions: Array<[number, number]> }): string {
    const id = resolveAiId(item);
    const viewer = viewerRef.value;
    if (!viewer) return id;
    const existing = viewer.entities.getById(id);
    if (existing) viewer.entities.remove(existing);
    const entity = createPolylineEntity({
      id,
      name: item.name || 'AI 标绘线',
      color: item.color || '#f7b267',
      positions: item.positions,
      width: 4
    });
    if (entity) {
      aiOverlayEntries.set(id, entity);
      base.requestRender();
    }
    return id;
  }

  function drawAiPolygon(item: AiOverlayItem & { positions: Array<[number, number]> }): string {
    const id = resolveAiId(item);
    const viewer = viewerRef.value;
    if (!viewer) return id;
    const existing = viewer.entities.getById(id);
    if (existing) viewer.entities.remove(existing);
    const entity = createPolygonEntity({
      id,
      name: item.name || 'AI 标绘区域',
      color: item.color || '#fb7185',
      positions: item.positions
    });
    if (entity) {
      aiOverlayEntries.set(id, entity);
      base.requestRender();
    }
    return id;
  }

  function removeAiOverlay(id: string): boolean {
    const entity = aiOverlayEntries.get(id);
    const viewer = viewerRef.value;
    if (!entity || !viewer) return false;
    viewer.entities.remove(entity);
    aiOverlayEntries.delete(id);
    base.requestRender();
    return true;
  }

  function clearAiOverlays(): void {
    const viewer = viewerRef.value;
    if (!viewer) return;
    aiOverlayEntries.forEach(e => viewer.entities.remove(e));
    aiOverlayEntries.clear();
    base.requestRender();
  }

  return {
    containerRef,
    cursorCoordinates: base.cursorCoordinates,
    initViewer,
    setActiveTool,
    setGlobeSurfaceTranslucent: base.setGlobeSurfaceTranslucent,
    setLayerVisible,
    showRoute,
    revealRoutes,
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
    toggleViewMode: base.toggleViewMode,
    // 矢量图层（通用组合层）
    loadVectorLayer: vectorLayers.loadVectorLayer,
    setVectorLayerVisible: vectorLayers.setVectorLayerVisible,
    removeVectorLayer: vectorLayers.removeVectorLayer,
    // 数据服务：激活服务图层句柄 + 管理方法（与渡河保障一致）
    serviceHandles: services.handles,
    loadService: services.loadOne,
    removeService: services.removeService,
    toggleService: services.toggleService,
    setServiceOpacity: services.setOpacity,
    switchImagery: services.switchImagery,
    reorderService: services.reorder,
    // 视角定位（智能体标绘 flyTo 指令用）
    flyToLocation: base.flyToLocation,
    // 智能体标绘层：点/线/面/文字 + 单删/全清
    drawAiMark,
    drawAiLine,
    drawAiPolygon,
    drawAiText,
    removeAiOverlay,
    clearAiOverlays
  };
}
