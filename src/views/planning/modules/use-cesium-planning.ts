import { useCesiumBase } from '@/composables/cesium/use-cesium-base';
import { useCesiumAiPlot } from '@/composables/cesium/use-cesium-ai-plot';
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
  type ImageryLayer,
  LabelStyle,
  Math as CesiumMath,
  PolygonHierarchy,
  Rectangle,
  SingleTileImageryProvider,
  VerticalOrigin
} from 'cesium';
import {
  planningDefaultTaskForm,
  planningPresets,
  planningRouteA1Scene,
  planningRouteScenes,
  planningRouteSummaries
} from '@/mock/planning';
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

interface ObstacleTileDefinition {
  id: string;
  name: string;
  path: string;
  z: number;
  x: number;
  y: number;
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
  color: string;
}

/** public/data/obstacle 下的三张 18 级 XYZ 障碍识别结果瓦片。 */
const OBSTACLE_TILES: readonly ObstacleTileDefinition[] = [
  {
    id: 'broken-bridge',
    name: '断桥障碍',
    path: 'data/obstacle/broken_bridge/18/219515/112159.png',
    z: 18,
    x: 219515,
    y: 112159,
    minLon: 121.45837,
    minLat: 25.12579,
    maxLon: 121.45906,
    maxLat: 25.12664,
    color: '#ef4444'
  },
  {
    id: 'rubble',
    name: '瓦砾障碍',
    path: 'data/obstacle/rubble/18/219516/112144.png',
    z: 18,
    x: 219516,
    y: 112144,
    minLon: 121.45974,
    minLat: 25.14477,
    maxLon: 121.46028,
    maxLat: 25.14534,
    color: '#f97316'
  },
  {
    id: 'sinkhole',
    name: '塌陷坑障碍',
    path: 'data/obstacle/sinkhole/18/219595/112203.png',
    z: 18,
    x: 219595,
    y: 112203,
    minLon: 121.56852,
    minLat: 25.07082,
    maxLon: 121.56873,
    maxLat: 25.07098,
    color: '#eab308'
  }
];

/** 将标准 Web Mercator XYZ 瓦片编号换算成 Cesium 地理矩形。 */
function xyzTileRectangle(z: number, x: number, y: number): Rectangle {
  const tileCount = 2 ** z;
  const longitude = (tileX: number) => (tileX / tileCount) * 360 - 180;
  const latitude = (tileY: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * tileY) / tileCount))) * 180) / Math.PI;
  return Rectangle.fromDegrees(longitude(x), latitude(y + 1), longitude(x + 1), latitude(y));
}

export function useCesiumPlanning(options: UseCesiumPlanningOptions = {}) {
  const base = useCesiumBase();
  const { containerRef, viewerRef } = base;
  // 数据服务组合层：管理激活服务图层句柄，供图层面板渲染（与渡河保障一致）
  const services = useCesiumServices(base);
  // 矢量图层组合层（通用）：mvt-imagery-provider 按瓦片渲染后端 MVT
  const vectorLayers = useCesiumVectorLayer(base);

  // 智能体标绘层（共享）：AI 指令 → 点/线/面/文字，按 id 管理，可单删/全清
  const aiPlot = useCesiumAiPlot({
    viewerRef,
    requestRender: base.requestRender,
    createPoint: item => createPointEntity(item),
    createLine: item => createPolylineEntity(item),
    createPolygon: item => createPolygonEntity(item)
  });

  const routeEntities: Partial<Record<PlanningRouteKey, Entity>> = {};
  const selectedRiskEntities: Entity[] = [];
  const selectedObstacleEntities: Entity[] = [];
  const waypointMarkerEntities: Entity[] = [];
  const blockedCrossEntities = new Map<string, Entity>();
  const obstacleTileLayers: ImageryLayer[] = [];
  const obstacleBubbleEntities = new Map<string, Entity>();
  const obstacleBubbleTargets = new Map<string, Rectangle>();

  let startMarkerEntity: Entity | null = null;
  let endMarkerEntity: Entity | null = null;
  let activeTool: PlanningInteractiveTool = 'browse';
  let currentRoute: PlanningRouteKey = 'route-a';
  // 路线/风险/障碍是否可见：页面初始只显示起终点标记，AI 智能规划完成后 revealRoutes() 打开
  let routesVisible = false;
  // 事件排除的路线：重新规划后在地图上隐藏其折线（方案面板同步过滤）
  const excludedRouteKeys = new Set<PlanningRouteKey>();

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

      // 事件排除的路线：直接隐藏
      if (excludedRouteKeys.has(key)) {
        entity.show = false;
        return;
      }

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
    obstacleTileLayers.forEach(layer => {
      layer.show = layerVisibility.obstacle;
    });
    obstacleBubbleEntities.forEach(entity => {
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

  /** 事件排除：隐藏被排除的候选路线（调用方随后 showRoute 指定当前路线） */
  function setExcludedRoutes(excluded: PlanningRouteKey[], active?: PlanningRouteKey) {
    excludedRouteKeys.clear();
    excluded.forEach(k => excludedRouteKeys.add(k));
    if (active) currentRoute = active;
    updateRouteStyles();
    base.requestRender();
  }

  /** 在原路线一与成功桥中断后的 A1 应急绕行线之间切换。 */
  function setRouteADetour(enabled: boolean) {
    const entity = routeEntities['route-a'];
    if (entity?.polyline) {
      const route = enabled ? planningRouteA1Scene.route : planningRouteScenes['route-a'].route;
      entity.name = route.name;
      entity.polyline.positions = new ConstantProperty(
        route.positions.map(position => Cartesian3.fromDegrees(position[0], position[1]))
      );
    }
    updateRouteStyles();
    base.requestRender();
  }

  /** 绘制始终醒目的红色叉号，表示桥梁/道路不可通行。 */
  function drawBlockedCross(item: { id: string; lon: number; lat: number; name: string; color?: string }) {
    const viewer = viewerRef.value;
    if (!viewer) return;
    const previous = blockedCrossEntities.get(item.id);
    if (previous) viewer.entities.remove(previous);

    const entity = viewer.entities.add({
      id: item.id,
      name: item.name,
      position: Cartesian3.fromDegrees(item.lon, item.lat),
      label: {
        text: `✕  ${item.name}`,
        font: 'bold 30px Microsoft YaHei',
        scale: 0.72,
        fillColor: base.getColor(item.color ?? '#ef4444'),
        outlineColor: Color.WHITE,
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        showBackground: true,
        backgroundColor: base.getColor('#450a0a', 0.86),
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.BOTTOM,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });
    blockedCrossEntities.set(item.id, entity);
    base.requestRender();
  }

  /**
   * 规划完成后加载三张本地障碍瓦片，并在各瓦片中心添加可点击气泡。
   * 使用 SingleTileImageryProvider，避免单张示例瓦片周边产生无效的模板瓦片请求。
   */
  async function loadObstacleTiles() {
    const viewer = viewerRef.value;
    if (!viewer) return;

    // 重复规划时复用已有图层与气泡，不重复添加实体。
    if (obstacleTileLayers.length === OBSTACLE_TILES.length) {
      obstacleTileLayers.forEach(layer => {
        layer.show = layerVisibility.obstacle;
      });
      obstacleBubbleEntities.forEach(entity => {
        entity.show = layerVisibility.obstacle;
      });
      base.requestRender();
      return;
    }

    const publicBase = import.meta.env.BASE_URL.endsWith('/')
      ? import.meta.env.BASE_URL
      : `${import.meta.env.BASE_URL}/`;
    for (const item of OBSTACLE_TILES) {
      if (obstacleBubbleEntities.has(item.id)) continue;
      try {
        const rectangle = xyzTileRectangle(item.z, item.x, item.y);
        const obstacleRectangle = Rectangle.fromDegrees(item.minLon, item.minLat, item.maxLon, item.maxLat);
        const positions = Cartesian3.fromDegreesArray([
          item.minLon,
          item.minLat,
          item.minLon,
          item.maxLat,
          item.maxLon,
          item.maxLat,
          item.maxLon,
          item.minLat,
          item.minLon,
          item.minLat
        ]);
        const provider = await SingleTileImageryProvider.fromUrl(`${publicBase}${item.path}`, { rectangle });
        const layer = viewer.imageryLayers.addImageryProvider(provider);
        layer.show = layerVisibility.obstacle;
        obstacleTileLayers.push(layer);

        const center = Rectangle.center(obstacleRectangle);
        const entityId = `planning-obstacle-tile-${item.id}`;
        const bubble = viewer.entities.add({
          id: entityId,
          name: item.name,
          position: Cartesian3.fromRadians(center.longitude, center.latitude),
          point: {
            pixelSize: 12,
            color: base.getColor(item.color),
            outlineColor: Color.WHITE,
            outlineWidth: 2,
            heightReference: HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          },
          polyline: {
            material: base.getColor(item.color),
            positions: positions,
            clampToGround: true,
            width: 3.0
          },
          label: {
            text: item.name,
            font: 'bold 24px Microsoft YaHei',
            scale: 0.55,
            fillColor: Color.WHITE,
            showBackground: true,
            backgroundColor: base.getColor(item.color, 0.9),
            backgroundPadding: new Cartesian2(12, 8),
            pixelOffset: new Cartesian2(0, -24),
            horizontalOrigin: HorizontalOrigin.CENTER,
            verticalOrigin: VerticalOrigin.BOTTOM,
            heightReference: HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          }
        });
        bubble.show = layerVisibility.obstacle;
        obstacleBubbleEntities.set(item.id, bubble);
        obstacleBubbleTargets.set(entityId, rectangle);
      } catch (error) {
        console.warn(`[Planning] 障碍瓦片加载失败：${item.name}`, error);
      }
    }
    base.requestRender();
  }

  /** 命中障碍气泡后，将对应 18 级瓦片完整置于视口中央。 */
  function focusObstacleBubble(screenPosition: Cartesian2): boolean {
    const viewer = viewerRef.value;
    if (!viewer) return false;
    const picked = viewer.scene.pick(screenPosition) as { id?: Entity } | undefined;
    const entityId = picked?.id?.id;
    if (!entityId) return false;
    const rectangle = obstacleBubbleTargets.get(entityId);
    if (!rectangle) return false;
    viewer.camera.flyTo({ destination: rectangle, duration: 1.2 });
    return true;
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
            if (focusObstacleBubble(event.position)) return;
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

  return {
    containerRef,
    viewerRef,
    cursorCoordinates: base.cursorCoordinates,
    initViewer,
    setActiveTool,
    setGlobeSurfaceTranslucent: base.setGlobeSurfaceTranslucent,
    setLayerVisible,
    showRoute,
    revealRoutes,
    setExcludedRoutes,
    setRouteADetour,
    drawBlockedCross,
    loadObstacleTiles,
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
    drawAiMark: aiPlot.drawAiMark,
    drawAiLine: aiPlot.drawAiLine,
    drawAiPolygon: aiPlot.drawAiPolygon,
    drawAiText: aiPlot.drawAiText,
    removeAiOverlay: aiPlot.removeAiOverlay,
    clearAiOverlays: aiPlot.clearAiOverlays
  };
}
