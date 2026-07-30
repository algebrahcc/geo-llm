import { useCesiumBase } from '@/composables/cesium/use-cesium-base';
import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  Entity,
  GeoJsonDataSource,
  HeightReference,
  HorizontalOrigin,
  LabelStyle,
  Math as CesiumMath,
  NearFarScalar,
  PolylineDashMaterialProperty,
  PolygonHierarchy,
  VerticalOrigin
} from 'cesium';
import {
  riverFlowTemplate,
  riverPlanScenes,
  riverPlanSummaries,
  riverPresets,
  riverStaticAssemblyZones,
  riverStaticChannels
} from '@/mock/river';
import { sleep } from '@/utils/async';
import { fetchVectorGeoJson, fetchVectorExtent } from '@/service/api/vector';
import type {
  RiverInteractiveTool,
  RiverLayerKey,
  RiverPlanKey,
  RiverPointOverlay,
  RiverPolygonOverlay,
  RiverStatusInfo,
  RiverLineOverlay
} from './types';
import { createToolNameMap } from '@/typings/cesium';

interface UseCesiumRiverOptions {
  onStatusChange?: (status: RiverStatusInfo) => void;
}

const toolNameMap = createToolNameMap<RiverInteractiveTool | 'browse'>([
  ['browse', '浏览'],
  ['annotate', '标注']
]);

export function useCesiumRiver(options: UseCesiumRiverOptions = {}) {
  const base = useCesiumBase();
  const { containerRef, viewerRef } = base;

  // ─── mock 静态/方案 entities（保留分析流程用） ───
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
    imagery: true
  };

  let activeTool: RiverInteractiveTool | 'browse' = 'browse';
  let activePlan: RiverPlanKey = 'plan-a';
  let annotationIndex = 1;

  const computeStatus = base.createEmitStatus(() => ({
    activeTool: toolNameMap[activeTool],
    currentPlan: riverPlanSummaries[activePlan].label
  }));

  function emitStatus(cartesian?: Cartesian3 | null) {
    options.onStatusChange?.(computeStatus(cartesian) as unknown as RiverStatusInfo);
  }

  // ─── Entity 创建（模块特有样式） ────────────────────

  function createPolylineEntity(layerKey: RiverLayerKey, item: RiverLineOverlay) {
    const viewer = viewerRef.value;
    if (!viewer) return null;
    const entity = viewer.entities.add({
      id: item.id,
      name: item.name,
      polyline: {
        positions: item.positions.map(p => Cartesian3.fromDegrees(p[0], p[1])),
        width: item.width ?? 5,
        material: new PolylineDashMaterialProperty({ color: base.getColor(item.color, 0.94) }),
        clampToGround: true
      }
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
        hierarchy: new PolygonHierarchy(item.positions.map(p => Cartesian3.fromDegrees(p[0], p[1]))),
        material: base.getColor(item.color, 0.2),
        outline: true,
        outlineColor: base.getColor(item.color, 0.95),
        outlineWidth: 2,
        heightReference: HeightReference.CLAMP_TO_GROUND
      }
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
        color: base.getColor(item.color),
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
        backgroundColor: base.getColor('#0a1628', 0.85),
        backgroundPadding: new Cartesian2(6, 4),
        pixelOffset: new Cartesian2(0, -24),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        style: LabelStyle.FILL_AND_OUTLINE,
        outlineColor: base.getColor(item.color, 0.9),
        outlineWidth: 2,
        verticalOrigin: VerticalOrigin.BOTTOM,
        horizontalOrigin: HorizontalOrigin.CENTER
      }
    });
    entity.show = layerVisibility[layerKey];
    return entity;
  }

  // ─── 底图 layerVisibility 同步 ─────────────────────

  function syncLayerVisibility() {
    const { imageryLayers } = base;
    imageryLayers.forEach(layer => { layer.show = layerVisibility.imagery; });
    staticEntities.channel.forEach(e => { e.show = layerVisibility.imagery; });
    staticEntities.assembly.forEach(e => { e.show = layerVisibility.imagery; });
    planEntities.route.forEach(e => { e.show = layerVisibility.imagery; });
    planEntities.risk.forEach(e => { e.show = layerVisibility.imagery; });
    [...planEntities.mark, ...dynamicMarkEntities].forEach(e => { e.show = layerVisibility.imagery; });
    base.requestRender();
  }

  // ─── 矢量图层 DataSource Map ───
  const vectorDataSourceMap = new Map<string, GeoJsonDataSource>();

  // ─── 矢量图层管理（后端 GeoJSON → GeoJsonDataSource） ──

  async function loadVectorLayer(vectorId: string, vectorName: string) {
    const viewer = viewerRef.value;
    if (!viewer) return;
    if (vectorDataSourceMap.has(vectorId)) {
      vectorDataSourceMap.get(vectorId)!.show = true;
      base.requestRender();
      return;
    }

    try {
      const result = await fetchVectorGeoJson(vectorId);
      let geojson = result?.data;
      if (geojson && geojson.code !== undefined) geojson = geojson.data ?? geojson;

      if (!geojson || !geojson.features?.length) {
        window.$message?.warning(`图层 "${vectorName}" 无有效数据`);
        return;
      }

      const ds = await GeoJsonDataSource.load(geojson, {
        stroke: Color.fromCssColorString('#ff6600').withAlpha(0.9),
        fill: Color.fromCssColorString('#ff6600').withAlpha(0.4),
        strokeWidth: 2,
        clampToGround: false
      });
      ds.entities.values.forEach((e: any) => {
        if (e.polygon) e.polygon.height = { valueOf: () => 0 };
        if (e.polyline) e.polyline.clampToGround = true;
        if (e.point) {
          e.point.heightReference = HeightReference.CLAMP_TO_GROUND;
          e.point.disableDepthTestDistance = Number.POSITIVE_INFINITY;
        }
      });

      ds.name = vectorName;
      await viewer.dataSources.add(ds);
      vectorDataSourceMap.set(vectorId, ds);

      // 飞到数据范围
      try {
        const result: any = await fetchVectorExtent(vectorId);
        const extent = (result?.data ?? result?.response?.data) as number[] | null;
        if (extent && extent.length === 4) {
          base.flyToLocation(
            (extent[0] + extent[2]) / 2,
            (extent[1] + extent[3]) / 2,
            12000
          );
        }
      } catch { /* ignore */ }

      base.requestRender();
    } catch (e: any) {
      console.error('[Vector] 加载失败:', e.message);
      window.$message?.warning(`图层 "${vectorName}" 渲染失败`);
    }
  }

  function setVectorLayerVisible(vectorId: string, show: boolean) {
    const ds = vectorDataSourceMap.get(vectorId);
    if (ds) {
      ds.show = show;
      base.requestRender();
    }
  }

  function removeVectorLayer(vectorId: string) {
    const viewer = viewerRef.value;
    const ds = vectorDataSourceMap.get(vectorId);
    if (viewer && ds) {
      viewer.dataSources.remove(ds);
      vectorDataSourceMap.delete(vectorId);
      base.requestRender();
    }
  }

  // ─── 模块数据加载（mock 分析流程中仍用 mock 数据填充静态/方案 entity） ───

  function clearPlanEntities() {
    const viewer = viewerRef.value;
    if (!viewer) return;
    Object.values(planEntities).forEach(entities => {
      entities.forEach(e => viewer.entities.remove(e));
      entities.splice(0, entities.length);
    });
  }

  function addStaticEntities() {
    riverStaticChannels.forEach(item => {
      const entity = createPolylineEntity('imagery', item);
      if (entity) staticEntities.channel.push(entity);
    });
    riverStaticAssemblyZones.forEach(item => {
      const entity = createPolygonEntity('imagery', item);
      if (entity) staticEntities.assembly.push(entity);
    });
  }

  function showPlan(planKey: RiverPlanKey) {
    activePlan = planKey;
    clearPlanEntities();
    const scene = riverPlanScenes[planKey];
    const routeEntity = createPolylineEntity('imagery', scene.route);
    if (routeEntity) planEntities.route.push(routeEntity);
    scene.riskZones.forEach(item => {
      const entity = createPolygonEntity('imagery', item);
      if (entity) planEntities.risk.push(entity);
    });
    scene.marks.forEach(item => {
      const entity = createPointEntity('imagery', item);
      if (entity) planEntities.mark.push(entity);
    });
    syncLayerVisibility();
    emitStatus();
  }

  function flyToPreset() {
    base.flyToLocation(riverPresets.task.longitude, riverPresets.task.latitude, riverPresets.task.height, 1.4);
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

  function clearAnnotations() {
    const viewer = viewerRef.value;
    if (!viewer) return;
    dynamicMarkEntities.forEach(e => viewer.entities.remove(e));
    dynamicMarkEntities.splice(0, dynamicMarkEntities.length);
    base.requestRender();
  }

  function createDynamicMark(longitude: number, latitude: number, name = `临时标注 ${annotationIndex}`) {
    const entity = createPointEntity('imagery', {
      id: `river-dynamic-mark-${annotationIndex}`,
      name,
      longitude,
      latitude,
      color: '#ffd166'
    });
    annotationIndex += 1;
    if (entity) {
      dynamicMarkEntities.push(entity);
      base.requestRender();
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

  // ─── 初始化 ───────────────────────────────────────

  async function initViewer() {
    await base.initViewer({
      prepareViewer(viewer) {
        viewer.scene.globe.depthTestAgainstTerrain = false;
        viewer.scene.requestRenderMode = true;
        viewer.camera.percentageChanged = 0.01;
        viewer.scene.screenSpaceCameraController.zoomFactor = 3.0;
        viewer.scene.screenSpaceCameraController.inertiaZoom = 0.35;
        (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';
      },
      afterImagery() {
        base.bindMouseEvents({
          onMouseMove: (movement: { endPosition: Cartesian2 }) => {
            const cartesian = base.getCartesianFromScreen(movement.endPosition);
            emitStatus(cartesian);
          },
          onLeftClick: (event: { position: Cartesian2 }) => {
            if (activeTool !== 'annotate') return;
            const cartesian = base.getCartesianFromScreen(event.position);
            if (!cartesian) return;
            const cartographic = Cartographic.fromCartesian(cartesian);
            createDynamicMark(
              CesiumMath.toDegrees(cartographic.longitude),
              CesiumMath.toDegrees(cartographic.latitude)
            );
            emitStatus(cartesian);
          }
        });
        base.addCameraChangeListener(() => emitStatus());
        flyToPreset();
        emitStatus(Cartesian3.fromDegrees(riverPresets.task.longitude, riverPresets.task.latitude, 0));
      }
    });
  }

  function initMapOverlays() {
    addStaticEntities();
    showPlan(activePlan);
    flyToPreset();
    emitStatus(Cartesian3.fromDegrees(riverPresets.task.longitude, riverPresets.task.latitude, 0));
  }

  return {
    containerRef,
    initViewer,
    initMapOverlays,
    setActiveTool,
    setLayerVisible,
    flyToPreset,
    flyToLocation: base.flyToLocation,
    resetView,
    zoomIn: base.zoomIn,
    zoomOut: base.zoomOut,
    rotate: base.rotate,
    pitch: base.pitch,
    clearAnnotations,
    generateMark,
    startAnalysis,
    exportScreenshot: () => base.exportScreenshot(`river-plan-${activePlan}.png`),
    showPlan,
    is2dMode: base.is2dMode,
    toggleViewMode: base.toggleViewMode,
    // 矢量图层
    loadVectorLayer,
    setVectorLayerVisible,
    removeVectorLayer
  };
}
