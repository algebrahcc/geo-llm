import { useCesiumBase } from '@/composables/cesium/use-cesium-base';
import { useCesiumServices } from '@/composables/cesium/use-cesium-services';
import { fetchEnabledDataServices } from '@/service/api/dataservice';
import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  Entity,
  HeightReference,
  HorizontalOrigin,
  ImageryLayer,
  LabelStyle,
  Math as CesiumMath,
  NearFarScalar,
  PolylineDashMaterialProperty,
  PolygonHierarchy,
  VerticalOrigin
} from 'cesium';
import MVTImageryProvider from 'mvt-imagery-provider';
import type { StyleSpecification } from 'mvt-imagery-provider';
import type { ImageryProvider } from 'cesium';
import {
  riverFlowTemplate,
  riverPlanScenes,
  riverPlanSummaries,
  riverPresets,
  riverStaticAssemblyZones,
  riverStaticChannels
} from '@/mock/river';
import { sleep } from '@/utils/async';
import { fetchVectorExtent, getVectorTileUrl } from '@/service/api/vector';
import { unwrapResponseData } from '@/service/request/envelope';
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

// useCesiumRiver：河流通用分析 Cesium 球
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
  // 数据服务组合层（阶段二）：管理激活服务图层句柄，供图层面板渲染
  const services = useCesiumServices(base);

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
    imageryLayers.forEach(layer => {
      layer.show = layerVisibility.imagery;
    });
    staticEntities.channel.forEach(e => {
      e.show = layerVisibility.imagery;
    });
    staticEntities.assembly.forEach(e => {
      e.show = layerVisibility.imagery;
    });
    planEntities.route.forEach(e => {
      e.show = layerVisibility.imagery;
    });
    planEntities.risk.forEach(e => {
      e.show = layerVisibility.imagery;
    });
    [...planEntities.mark, ...dynamicMarkEntities].forEach(e => {
      e.show = layerVisibility.imagery;
    });
    base.requestRender();
  }

  // ─── 矢量图层 Map（mvt-imagery-provider 按瓦片渲染后端 MVT 接口） ───
  interface VectorLayerEntry {
    provider: MVTImageryProvider;
    layer: ImageryLayer;
  }
  const vectorLayerMap = new Map<string, VectorLayerEntry>();

  /**
   * 构造矢量图层的 Mapbox StyleSpec：sources 指向后端 MVT 瓦片 URL，
   * layers 定义橙色系（#ff8c00）点/线/面三套样式，所有矢量图层共用。
   */
  function buildVectorMvtStyle(vectorId: string, sourceType: string): StyleSpecification {
    const tileUrl = getVectorTileUrl(vectorId, sourceType);
    const sourceName = `vector-${vectorId}`;
    return {
      version: 8,
      name: `vector-${vectorId}`,
      sources: {
        [sourceName]: {
          type: 'vector',
          scheme: 'xyz',
          tiles: tileUrl ? [tileUrl] : []
        }
      },
      // 后端 MVT 由 ST_AsMVT(tile, 'vector', 4096, 'geom') 生成，source-layer 固定为 'vector'。
      // mvt-basic-render 要求每个矢量图层必须显式指定 source-layer，否则构建失败。
      layers: [
        {
          id: `${sourceName}-fill`,
          type: 'fill',
          source: sourceName,
          'source-layer': 'vector',
          paint: {
            'fill-color': 'rgba(255, 140, 0, 0.25)',
            'fill-outline-color': 'rgba(255, 140, 0, 0.9)'
          }
        },
        {
          id: `${sourceName}-line`,
          type: 'line',
          source: sourceName,
          'source-layer': 'vector',
          paint: {
            'line-color': 'rgba(255, 140, 0, 0.94)',
            'line-width': 3
          }
        }
      ]
    };
  }

  async function loadVectorLayer(vectorId: string, vectorName: string, sourceType = '') {
    const viewer = viewerRef.value;
    if (!viewer) return;
    const existing = vectorLayerMap.get(vectorId);
    if (existing) {
      existing.layer.show = true;
      base.requestRender();
      return;
    }

    try {
      const provider = new MVTImageryProvider({
        style: buildVectorMvtStyle(vectorId, sourceType)
      });
      // 兼容 Cesium 1.143：ImageryProvider 新增了抽象方法 getTileCredits，
      // 而 mvt-imagery-provider@1.0.3 基于旧版 Cesium（1.106）实现，未提供该方法。
      // 这里补一个默认实现（返回空数组，无瓦片级 credit），并断言为 ImageryProvider。
      (provider as unknown as { getTileCredits: () => unknown[] }).getTileCredits = () => [];
      const layer = viewer.imageryLayers.addImageryProvider(provider as unknown as ImageryProvider);
      layer.show = true;
      vectorLayerMap.set(vectorId, { provider, layer });

      let extent: number[] | null = null;
      try {
        const extentResult = await fetchVectorExtent(vectorId);
        extent = unwrapResponseData<number[]>(extentResult);
      } catch {
        /* 无 extent 也能加载 */
      }

      if (extent && extent.length === 4) {
        const centerLng = (extent[0] + extent[2]) / 2;
        const centerLat = (extent[1] + extent[3]) / 2;
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(centerLng, centerLat, 12000)
        });
      } else {
        window.$message?.warning(`图层 "${vectorName}" 已加载（未获取到范围）`);
      }

      base.requestRender();
    } catch (e: any) {
      console.error('[Vector] 加载失败:', e.message);
      window.$message?.warning(`图层 "${vectorName}" 渲染失败`);
    }
  }

  function setVectorLayerVisible(vectorId: string, show: boolean) {
    const entry = vectorLayerMap.get(vectorId);
    if (entry) {
      entry.layer.show = show;
      base.requestRender();
    }
  }

  function removeVectorLayer(vectorId: string) {
    const viewer = viewerRef.value;
    const entry = vectorLayerMap.get(vectorId);
    if (viewer && entry) {
      viewer.imageryLayers.remove(entry.layer, true);
      vectorLayerMap.delete(vectorId);
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

    // 阶段二：加载全部启用中的数据服务（登记句柄供图层面板渲染）→ 重建影像/地形层序
    try {
      const serviceResult = await fetchEnabledDataServices();
      const serviceList = unwrapResponseData<Api.DataService.DataServiceItem[]>(serviceResult) ?? [];
      await services.loadEnabled(undefined, serviceList);
      await base.applyServices(serviceList, services.handles.value);
    } catch (e) {
      console.warn('[River] 数据服务加载失败，使用默认图源:', e);
    }
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
    removeVectorLayer,
    // 数据服务（阶段二）
    serviceHandles: services.handles,
    loadService: services.loadOne,
    removeService: services.removeService,
    toggleService: services.toggleService,
    setServiceOpacity: services.setOpacity,
    switchImagery: services.switchImagery,
    reorderService: services.reorder
  };
}
