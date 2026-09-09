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
  Entity,
  HeightReference,
  HorizontalOrigin,
  LabelStyle,
  Math as CesiumMath,
  NearFarScalar,
  PolylineArrowMaterialProperty,
  PolylineDashMaterialProperty,
  PolygonHierarchy,
  VerticalOrigin
} from 'cesium';
import { riverFlowTemplate, riverPlanScenes, riverPlanSummaries, riverPresets } from '@/mock/river';
import { sleep } from '@/utils/async';
import { unwrapResponseData } from '@/service/request/envelope';
import type {
  RejectedRouteData,
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
  // 矢量图层组合层（通用）：mvt-imagery-provider 按瓦片渲染后端 MVT
  const vectorLayers = useCesiumVectorLayer(base);

  // 智能体标绘层（共享）：AI 指令 → 点/线/面/文字，按 id 管理，可单删/全清
  const aiPlot = useCesiumAiPlot({
    viewerRef,
    requestRender: base.requestRender,
    createPoint: item => createPointEntity('imagery', item),
    createLine: item => createPolylineEntity('imagery', item),
    createPolygon: item => createPolygonEntity('imagery', item)
  });

  // ─── 方案 entities（分析完成后上图；路线/标注点，无色块区域） ───
  const planEntities: Record<'route' | 'risk' | 'mark', Entity[]> = {
    route: [],
    risk: [],
    mark: []
  };
  const dynamicMarkEntities: Entity[] = [];
  // 淘汰方式路线（常驻弱化显示，与可行方案路线并存）
  const rejectedEntities: Entity[] = [];
  let currentRejectedRoutes: RejectedRouteData[] = [];

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

  // ─── 军事符号纹理（白框深底制式点标：方=渡场/作业，圆=登陆/接引，三角=观察哨） ───
  const symbolTextureCache = new Map<string, HTMLCanvasElement>();

  function createSymbolTexture(symbol: 'square' | 'circle' | 'triangle'): HTMLCanvasElement {
    const cached = symbolTextureCache.get(symbol);
    if (cached) return cached;
    // 2 倍分辨率栅格化（显示 18px），billboard 缩小采样保持符号边缘锐利
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    const cx = size / 2;
    const cy = size / 2;
    ctx.fillStyle = 'rgba(255, 250, 244, 0.96)';
    ctx.strokeStyle = '#d5443c';
    ctx.lineWidth = 5;
    ctx.beginPath();
    if (symbol === 'square') {
      ctx.rect(cx - 18, cy - 18, 36, 36);
    } else if (symbol === 'circle') {
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    } else {
      ctx.moveTo(cx, cy - 22);
      ctx.lineTo(cx + 22, cy + 18);
      ctx.lineTo(cx - 22, cy + 18);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
    symbolTextureCache.set(symbol, canvas);
    return canvas;
  }

  const CN_INDEX = ['①', '②', '③', '④', '⑤', '⑥'];

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

  /** 方案机动路线：我方要素按我军标图惯例用红色——选中=红色机动箭头实线，候选=暗红虚线（预备路线） */
  function createRouteEntity(item: RiverLineOverlay, selected: boolean) {
    const viewer = viewerRef.value;
    if (!viewer) return null;
    const entity = viewer.entities.add({
      id: selected ? item.id : `${item.id}-candidate`,
      name: item.name,
      polyline: {
        positions: item.positions.map(p => Cartesian3.fromDegrees(p[0], p[1])),
        width: selected ? 8 : 2,
        material: selected
          ? new PolylineArrowMaterialProperty(Color.fromCssColorString('#d5443c'))
          : new PolylineDashMaterialProperty({ color: base.getColor('#d5443c', 0.3) }),
        clampToGround: true
      }
    });
    entity.show = layerVisibility.imagery;
    return entity;
  }

  function createPointEntity(layerKey: RiverLayerKey, item: RiverPointOverlay, index?: number) {
    const viewer = viewerRef.value;
    if (!viewer) return null;
    const symbol = item.symbol ?? 'circle';
    const isTextOnly = symbol === 'label';
    // 注记规范：非文字要素带编号（① 主渡场下水点），文字注记（河幅）不编号
    const labelText = index ? `${CN_INDEX[index - 1] ?? ''} ${item.name}` : item.name;
    const entity = viewer.entities.add({
      id: item.id,
      name: item.name,
      position: Cartesian3.fromDegrees(item.longitude, item.latitude),
      billboard: isTextOnly
        ? undefined
        : {
            image: createSymbolTexture(symbol),
            width: 18,
            height: 18,
            heightReference: HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            scaleByDistance: new NearFarScalar(800, 1.0, 60000, 0.55),
            verticalOrigin: VerticalOrigin.CENTER
          },
      label: {
        // 超采样：2 倍字号栅格化 + scale 0.5 显示，消除高分屏下 Cesium 文字发虚
        text: labelText,
        font: 'bold 24px Microsoft YaHei',
        scale: 0.5,
        fillColor: Color.WHITE,
        showBackground: true,
        backgroundColor: base.getColor('#050d18', 0.92),
        backgroundPadding: new Cartesian2(9, 6),
        pixelOffset: new Cartesian2(0, isTextOnly ? -14 : -22),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        style: LabelStyle.FILL,
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
    planEntities.route.forEach(e => {
      e.show = layerVisibility.imagery;
    });
    planEntities.risk.forEach(e => {
      e.show = layerVisibility.imagery;
    });
    [...planEntities.mark, ...dynamicMarkEntities].forEach(e => {
      e.show = layerVisibility.imagery;
    });
    rejectedEntities.forEach(e => {
      e.show = layerVisibility.imagery;
    });
    aiPlot.eachAiOverlay(e => {
      e.show = layerVisibility.imagery;
    });
    base.requestRender();
  }

  // ─── 矢量图层（通用组合层，mvt-imagery-provider 渲染后端 MVT） ───

  // ─── 模块数据加载（mock 分析流程中仍用 mock 数据填充静态/方案 entity） ───

  function clearPlanEntities() {
    const viewer = viewerRef.value;
    if (!viewer) return;
    Object.values(planEntities).forEach(entities => {
      entities.forEach(e => viewer.entities.remove(e));
      entities.splice(0, entities.length);
    });
  }

  function showPlan(planKey: RiverPlanKey) {
    activePlan = planKey;
    clearPlanEntities();
    // 三条路线同图：选中方案=机动箭头实线，候选方案=灰虚线（预备路线军线语义）
    (Object.keys(riverPlanScenes) as RiverPlanKey[]).forEach(key => {
      const entity = createRouteEntity(riverPlanScenes[key].route, key === planKey);
      if (entity) planEntities.route.push(entity);
    });
    const scene = riverPlanScenes[planKey];
    scene.riskZones.forEach(item => {
      const entity = createPolygonEntity('imagery', item);
      if (entity) planEntities.risk.push(entity);
    });
    // 点位制式符号：非文字要素按顺序编号（①②③），文字注记（河幅）不编号
    let markIndex = 0;
    scene.marks.forEach(item => {
      const isText = item.symbol === 'label';
      if (!isText) markIndex += 1;
      const entity = createPointEntity('imagery', item, isText ? undefined : markIndex);
      if (entity) planEntities.mark.push(entity);
    });
    syncLayerVisibility();
    emitStatus();
  }

  // ─── 淘汰方式路线（常驻弱化虚线，供对照查看） ───

  function clearRejectedEntities() {
    const viewer = viewerRef.value;
    if (!viewer) return;
    rejectedEntities.forEach(e => viewer.entities.remove(e));
    rejectedEntities.splice(0, rejectedEntities.length);
  }

  /** 显示所有淘汰方式的路线（弱化虚线 + 渡场点），与可行方案路线并存 */
  function showRejectedRoutes(routes: RejectedRouteData[]) {
    const viewer = viewerRef.value;
    if (!viewer) return;
    clearRejectedEntities();
    currentRejectedRoutes = [...routes];
    routes.forEach(route => {
      const line = createPolylineEntity('imagery', {
        id: `${route.id}-route`,
        name: `${route.name}（已淘汰）`,
        color: route.color,
        positions: route.positions,
        width: 3
      });
      if (line) rejectedEntities.push(line);
      if (route.mark) {
        const mark = createPointEntity('imagery', {
          id: `${route.id}-mark`,
          name: `${route.name} 渡场（不可行）`,
          longitude: route.mark.longitude,
          latitude: route.mark.latitude,
          color: route.color
        });
        if (mark) rejectedEntities.push(mark);
      }
    });
    base.requestRender();
  }

  /** 聚焦某条淘汰路线（飞行至其渡场点；横渡短线较短，视高低于方案路线） */
  function focusRejectedRoute(id: string) {
    const route = currentRejectedRoutes.find(r => r.id === id);
    if (!route?.mark) return;
    base.flyToLocation(route.mark.longitude, route.mark.latitude, 3500, 1.4);
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
        // 按设备推荐分辨率（DPR）渲染，高分屏（Windows 125%/150% 缩放）下文字/线划不发虚
        viewer.useBrowserRecommendedResolution = true;
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
            const lon = CesiumMath.toDegrees(cartographic.longitude);
            const lat = CesiumMath.toDegrees(cartographic.latitude);
            createDynamicMark(lon, lat);
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

  function initMapOverlays(showPlanFirst = true) {
    if (showPlanFirst) showPlan(activePlan);
    flyToPreset();
    emitStatus(Cartesian3.fromDegrees(riverPresets.task.longitude, riverPresets.task.latitude, 0));
  }

  return {
    containerRef,
    cursorCoordinates: base.cursorCoordinates,
    initViewer,
    initMapOverlays,
    setGlobeSurfaceTranslucent: base.setGlobeSurfaceTranslucent,
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
    showRejectedRoutes,
    clearRejectedEntities,
    focusRejectedRoute,
    drawAiMark: aiPlot.drawAiMark,
    drawAiLine: aiPlot.drawAiLine,
    drawAiPolygon: aiPlot.drawAiPolygon,
    drawAiText: aiPlot.drawAiText,
    removeAiOverlay: aiPlot.removeAiOverlay,
    clearAiOverlays: aiPlot.clearAiOverlays,
    is2dMode: base.is2dMode,
    toggleViewMode: base.toggleViewMode,
    // 矢量图层（通用组合层）
    loadVectorLayer: vectorLayers.loadVectorLayer,
    flyToVector: vectorLayers.flyToVector,
    setVectorLayerVisible: vectorLayers.setVectorLayerVisible,
    removeVectorLayer: vectorLayers.removeVectorLayer,
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
