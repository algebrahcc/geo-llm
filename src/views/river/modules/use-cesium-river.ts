import { useCesiumBase } from '@/composables/cesium/use-cesium-base';
import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  ColorMaterialProperty,
  ConstantProperty,
  Entity,
  GeoJsonDataSource,
  HeightReference,
  HorizontalOrigin,
  JulianDate,
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
import { fetchVectorExtent, fetchVectorFeaturesInBbox } from '@/service/api/vector';
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

  // ─── 矢量图层 Map（按视口流式加载 GeoJSON，避免 Cesium MVTDataProvider 同步解码卡死） ───
  const vectorDataSourceMap = new Map<string, GeoJsonDataSource>();
  let vectorRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  let vectorRefreshing = false;
  // 上次请求的视口，用于判断是否需要刷新（避免相机微动触发频繁全量重建）
  let lastViewport: { minLng: number; minLat: number; maxLng: number; maxLat: number; zoom: number } | null = null;

  /** 将相机高度(m)映射为近似缩放级别（按 45° 视锥 + 256 瓦片推导） */
  function heightToZoom(height: number) {
    const h = Math.max(height, 1);
    // Cesium 默认视锥约 45°（垂直半角 ~0.35rad），据此估算屏幕像素米分辨率
    const visibleMeters = 2 * h * Math.tan(0.35);
    // 屏幕约 2000px 宽，每像素米数
    const metersPerPixel = visibleMeters / 2000;
    // zoom0 赤道约 156543m/px
    const z = Math.log2(156543.03 / metersPerPixel);
    return Math.max(0, Math.min(20, Math.round(z)));
  }

  function getCurrentViewport() {
    const viewer = viewerRef.value;
    if (!viewer) return null;
    const rect = viewer.camera.computeViewRectangle();
    if (!rect) return null;

    const minLng = CesiumMath.toDegrees(rect.west);
    const minLat = CesiumMath.toDegrees(rect.south);
    const maxLng = CesiumMath.toDegrees(rect.east);
    const maxLat = CesiumMath.toDegrees(rect.north);

    // 1.2 倍缓冲区，避免边缘处要素闪烁
    const lngBuf = Math.max(0.001, (maxLng - minLng) * 0.2);
    const latBuf = Math.max(0.001, (maxLat - minLat) * 0.2);
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

    const height = viewer.camera.positionCartographic.height;
    const zoom = heightToZoom(height);

    // bbox 量化到 zoom 对应网格，使相近视野请求相同 bbox，显著提高后端 Redis 缓存命中率
    const grid = 360 / Math.pow(2, Math.max(0, Math.min(zoom, 20)));
    const quantize = (v: number, step: number) => Math.round(v / step) * step;
    const qMinLng = quantize(clamp(minLng - lngBuf, -180, 180), grid);
    const qMinLat = quantize(clamp(minLat - latBuf, -90, 90), grid);
    const qMaxLng = quantize(clamp(maxLng + lngBuf, -180, 180), grid);
    const qMaxLat = quantize(clamp(maxLat + latBuf, -90, 90), grid);

    return {
      minLng: qMinLng,
      minLat: qMinLat,
      maxLng: qMaxLng,
      maxLat: qMaxLat,
      zoom
    };
  }

  /** 判断新视口相比上次是否需要重新请求（位移或缩放超阈值，或跨 zoom 才刷新） */
  function shouldRefreshViewport(next: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
    zoom: number;
  }) {
    const prev = lastViewport;
    if (!prev) return true;
    // zoom 变化必须刷新（点聚合粒度、视野数据都会变）
    if (prev.zoom !== next.zoom) return true;
    const prevW = prev.maxLng - prev.minLng;
    const prevH = prev.maxLat - prev.minLat;
    // 视野平移超过原宽/高的 20% 才刷新
    if (Math.abs(next.minLng - prev.minLng) > prevW * 0.2 || Math.abs(next.minLat - prev.minLat) > prevH * 0.2) {
      return true;
    }
    // 视野缩放超过 15% 才刷新
    const nextW = next.maxLng - next.minLng;
    const nextH = next.maxLat - next.minLat;
    if (Math.abs(nextW - prevW) > prevW * 0.15 || Math.abs(nextH - prevH) > prevH * 0.15) {
      return true;
    }
    return false;
  }

  function styleVectorEntities(ds: GeoJsonDataSource) {
    const entities = ds.entities.values;
    // 快速遍历（数组/集合），避免 for...of 迭代器开销
    for (let i = 0; i < entities.length; i += 1) {
      const entity = entities[i];
      if (!entity) continue;

      if (entity.point) {
        const props: any = entity.properties;
        // 聚合点：根据 _count 放大显示
        let count = 1;
        try {
          // eslint-disable-next-line no-underscore-dangle
          count = Number(props?._count?.getValue?.(JulianDate.now()) ?? 1);
        } catch {
          /* ignore */
        }
        entity.point.color = new ConstantProperty(base.getColor('#ff8c00'));
        entity.point.outlineColor = new ConstantProperty(Color.WHITE);
        entity.point.outlineWidth = new ConstantProperty(2);
        entity.point.pixelSize = new ConstantProperty(Math.max(8, Math.min(28, 6 + count * 0.8)));
        entity.point.heightReference = new ConstantProperty(HeightReference.CLAMP_TO_GROUND);
        entity.point.disableDepthTestDistance = new ConstantProperty(Number.POSITIVE_INFINITY);
        entity.point.scaleByDistance = new ConstantProperty(new NearFarScalar(500, 1.5, 50000, 0.5));
      }

      if (entity.polyline) {
        entity.polyline.material = new ColorMaterialProperty(base.getColor('#ff8c00', 0.94));
        entity.polyline.width = new ConstantProperty(3);
        entity.polyline.clampToGround = new ConstantProperty(true);
      }

      if (entity.polygon) {
        entity.polygon.material = new ColorMaterialProperty(base.getColor('#ff8c00', 0.25));
        entity.polygon.outline = new ConstantProperty(true);
        entity.polygon.outlineColor = new ConstantProperty(base.getColor('#ff8c00', 0.9));
        entity.polygon.outlineWidth = new ConstantProperty(2);
        entity.polygon.heightReference = new ConstantProperty(HeightReference.CLAMP_TO_GROUND);
      }
    }
  }

  function unwrapResponseData(result: any): any {
    if (!result || typeof result !== 'object') return result;
    // 已经是 GeoJSON / 数组等平铺数据
    if (result.type === 'FeatureCollection' || Array.isArray(result)) return result;
    // 剥掉 R 包装或 Axios 响应包装
    if (result.data !== undefined) return unwrapResponseData(result.data);
    if (result.response?.data !== undefined) return unwrapResponseData(result.response.data);
    return result;
  }

  async function refreshVectorLayer(vectorId: string, force = false) {
    const ds = vectorDataSourceMap.get(vectorId);
    if (!ds || !ds.show) return;

    // 并发锁：上一次请求未完成时跳过本次，避免多个请求并发覆盖导致反复全量重建
    if (vectorRefreshing) return;

    const vp = getCurrentViewport();
    if (!vp) return;
    if (!force && !shouldRefreshViewport(vp)) return;

    vectorRefreshing = true;
    try {
      const result: any = await fetchVectorFeaturesInBbox(vectorId, vp);
      let geojson = unwrapResponseData(result);
      if (typeof geojson === 'string') {
        try {
          geojson = JSON.parse(geojson);
        } catch {
          console.warn('[Vector] 后端返回的 GeoJSON 字符串解析失败:', result);
          return;
        }
      }
      if (!geojson || geojson.type !== 'FeatureCollection') {
        console.warn('[Vector] 后端返回不是有效的 FeatureCollection:', result);
        return;
      }
      // 视野外无要素时不重建，保留上次已加载的数据，避免空视野闪烁
      const features = (geojson as { features?: unknown[] }).features;
      if (features && features.length > 0) {
        lastViewport = vp;
        await ds.load(geojson, { clampToGround: true });
        styleVectorEntities(ds);
        base.requestRender();
      } else {
        lastViewport = vp;
      }
    } catch (e: any) {
      console.error('[Vector] 视口 GeoJSON 加载失败:', e.message);
    } finally {
      vectorRefreshing = false;
    }
  }

  function scheduleVectorRefresh() {
    if (vectorRefreshTimer) {
      clearTimeout(vectorRefreshTimer);
      vectorRefreshTimer = null;
    }
    vectorRefreshTimer = setTimeout(() => {
      vectorRefreshTimer = null;
      // 相机停止后统一刷新一次；请求未完成时由并发锁自然跳过
      vectorDataSourceMap.forEach((_, id) => refreshVectorLayer(id));
    }, 600);
  }

  async function loadVectorLayer(vectorId: string, vectorName: string) {
    const viewer = viewerRef.value;
    if (!viewer) return;
    const existing = vectorDataSourceMap.get(vectorId);
    if (existing) {
      existing.show = true;
      refreshVectorLayer(vectorId);
      base.requestRender();
      return;
    }

    try {
      const ds = new GeoJsonDataSource(vectorName);
      await viewer.dataSources.add(ds);
      ds.show = true;
      vectorDataSourceMap.set(vectorId, ds);

      let extent: number[] | null = null;
      try {
        const extentResult: any = await fetchVectorExtent(vectorId);
        extent = unwrapResponseData(extentResult) as number[] | null;
      } catch {
        /* 无 extent 也能加载 */
      }

      if (extent && extent.length === 4) {
        const centerLng = (extent[0] + extent[2]) / 2;
        const centerLat = (extent[1] + extent[3]) / 2;
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(centerLng, centerLat, 12000),
          complete: () => refreshVectorLayer(vectorId)
        });
      } else {
        window.$message?.warning(`图层 "${vectorName}" 已加载（未获取到范围）`);
        await refreshVectorLayer(vectorId);
      }

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
      if (show) refreshVectorLayer(vectorId);
      base.requestRender();
    }
  }

  function removeVectorLayer(vectorId: string) {
    const viewer = viewerRef.value;
    const ds = vectorDataSourceMap.get(vectorId);
    if (viewer && ds) {
      viewer.dataSources.remove(ds, true);
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
        base.addCameraChangeListener(scheduleVectorRefresh);
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
