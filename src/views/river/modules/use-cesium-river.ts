import { useCesiumBase } from '@/composables/cesium/use-cesium-base';
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
        positions: item.positions.map(position => Cartesian3.fromDegrees(position[0], position[1])),
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
        hierarchy: new PolygonHierarchy(
          item.positions.map(position => Cartesian3.fromDegrees(position[0], position[1]))
        ),
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

  // ─── 图层管理 ─────────────────────────────────────

  function clearPlanEntities() {
    const viewer = viewerRef.value;
    if (!viewer) return;

    Object.values(planEntities).forEach(entities => {
      entities.forEach(entity => viewer.entities.remove(entity));
      entities.splice(0, entities.length);
    });
  }

  function syncLayerVisibility() {
    const { imageryLayers } = base;
    imageryLayers.forEach(layer => { layer.show = layerVisibility.imagery; });

    staticEntities.channel.forEach(entity => { entity.show = layerVisibility.channel; });
    staticEntities.assembly.forEach(entity => { entity.show = layerVisibility.assembly; });
    planEntities.route.forEach(entity => { entity.show = layerVisibility.route; });
    planEntities.risk.forEach(entity => { entity.show = layerVisibility.risk; });
    [...planEntities.mark, ...dynamicMarkEntities].forEach(entity => {
      entity.show = layerVisibility.mark;
    });

    base.requestRender();
  }

  // ─── 模块数据加载 ─────────────────────────────────

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

    dynamicMarkEntities.forEach(entity => viewer.entities.remove(entity));
    dynamicMarkEntities.splice(0, dynamicMarkEntities.length);
    base.requestRender();
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
        viewer.scene.screenSpaceCameraController.zoomFactor = 1.18;
        viewer.scene.screenSpaceCameraController.inertiaZoom = 0.35;
      },
      afterImagery() {
        // 绑定事件
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

  /** 分析完成后调用：加载地图标绘并定位视角 */
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
    toggleViewMode: base.toggleViewMode
  };
}
