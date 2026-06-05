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
  PolygonHierarchy,
  VerticalOrigin
} from 'cesium';
import {
  globeAnalysisResult,
  globeAnalysisSteps,
  globePresets,
  globeStaticMarks,
  globeStaticPipelines,
  globeStaticRoads,
  globeStaticRoutes
} from '@/mock/globe';
import { sleep } from '@/utils/async';
import { createToolNameMap } from '@/typings/cesium';
import type { GlobeInteractiveTool, GlobeLayerKey, GlobeStatusInfo } from './types';

type Coordinate = readonly [number, number];

interface UseCesiumGlobeOptions {
  onStatusChange?: (status: GlobeStatusInfo) => void;
}

const toolNameMap = createToolNameMap<GlobeInteractiveTool | 'browse'>([
  ['browse', '浏览'],
  ['annotate', '标注'],
  ['measure-distance', '测距'],
  ['measure-area', '测面']
]);

export function useCesiumGlobe(options: UseCesiumGlobeOptions = {}) {
  const base = useCesiumBase();
  const { containerRef, viewerRef } = base;

  const layerVisibility: Record<GlobeLayerKey, boolean> = {
    imagery: true,
    road: true,
    pipeline: true,
    mark: true,
    route: true
  };

  const staticEntities: Record<Exclude<GlobeLayerKey, 'imagery'>, Entity[]> = {
    road: [],
    pipeline: [],
    mark: [],
    route: []
  };

  const dynamicMarkEntities: Entity[] = [];
  const dynamicRouteEntities: Entity[] = [];
  const dynamicMeasureEntities: Entity[] = [];
  const measurePositions: Cartesian3[] = [];

  let activeTool: GlobeInteractiveTool | 'browse' = 'browse';
  let annotationIndex = 1;

  const computeStatus = base.createEmitStatus(() => ({
    activeTool: toolNameMap[activeTool]
  }));

  function emitStatus(cartesian?: Cartesian3 | null) {
    options.onStatusChange?.(computeStatus(cartesian) as unknown as GlobeStatusInfo);
  }

  // ─── Entity 创建（模块特有样式） ────────────────────

  function createPointEntity(
    layerKey: Exclude<GlobeLayerKey, 'imagery'>,
    entityOptions: { id: string; name: string; longitude: number; latitude: number; color: string }
  ) {
    const viewer = viewerRef.value;
    if (!viewer) return null;

    const entity = viewer.entities.add({
      id: entityOptions.id,
      position: Cartesian3.fromDegrees(entityOptions.longitude, entityOptions.latitude),
      point: {
        pixelSize: 11,
        color: base.getColor(entityOptions.color),
        outlineColor: Color.WHITE,
        outlineWidth: 2,
        heightReference: HeightReference.CLAMP_TO_GROUND
      },
      label: {
        text: entityOptions.name,
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

    entity.show = layerVisibility[layerKey];
    return entity;
  }

  function createPolylineEntity(
    layerKey: Exclude<GlobeLayerKey, 'imagery'>,
    polylineOptions: { id: string; positions: readonly Coordinate[]; color: string; width?: number }
  ) {
    const viewer = viewerRef.value;
    if (!viewer) return null;

    const entity = viewer.entities.add({
      id: polylineOptions.id,
      polyline: {
        positions: polylineOptions.positions.map(position => Cartesian3.fromDegrees(position[0], position[1])),
        width: polylineOptions.width ?? 4,
        material: base.getColor(polylineOptions.color, 0.92),
        clampToGround: true
      }
    });

    entity.show = layerVisibility[layerKey];
    return entity;
  }

  function createPolygonEntity(polygonOptions: { id: string; positions: readonly Coordinate[]; color: string }) {
    const viewer = viewerRef.value;
    if (!viewer) return null;

    const entity = viewer.entities.add({
      id: polygonOptions.id,
      polygon: {
        hierarchy: new PolygonHierarchy(
          polygonOptions.positions.map(position => Cartesian3.fromDegrees(position[0], position[1]))
        ),
        material: base.getColor(polygonOptions.color, 0.18),
        outline: true,
        outlineColor: base.getColor(polygonOptions.color, 0.92),
        heightReference: HeightReference.CLAMP_TO_GROUND
      }
    });

    entity.show = layerVisibility.route;
    return entity;
  }

  // ─── 模块数据加载 ─────────────────────────────────

  function addStaticEntities() {
    globeStaticRoads.forEach(item => {
      const entity = createPolylineEntity('road', item);
      if (entity) staticEntities.road.push(entity);
    });

    globeStaticPipelines.forEach(item => {
      const entity = createPolylineEntity('pipeline', item);
      if (entity) staticEntities.pipeline.push(entity);
    });

    globeStaticRoutes.forEach(item => {
      const route = createPolylineEntity('route', item);
      if (route) staticEntities.route.push(route);
    });

    globeStaticMarks.forEach(item => {
      const entity = createPointEntity('mark', item);
      if (entity) staticEntities.mark.push(entity);
    });
  }

  // ─── 测量与标注工具 ───────────────────────────────

  function clearMeasureDraft() {
    const viewer = viewerRef.value;
    if (!viewer) return;

    dynamicMeasureEntities.splice(0).forEach(entity => viewer.entities.remove(entity));
    measurePositions.length = 0;
    base.requestRender();
  }

  function clearDynamicMarks() {
    const viewer = viewerRef.value;
    if (!viewer) return;

    dynamicMarkEntities.splice(0).forEach(entity => viewer.entities.remove(entity));
    dynamicRouteEntities.splice(0).forEach(entity => viewer.entities.remove(entity));
    clearMeasureDraft();
    base.requestRender();
  }

  function addDynamicAnnotation(longitude: number, latitude: number, name?: string) {
    const entity = createPointEntity('mark', {
      id: `manual-mark-${Date.now()}`,
      name: name ?? `标注${annotationIndex++}`,
      longitude,
      latitude,
      color: '#2B6BFF'
    });

    if (entity) {
      dynamicMarkEntities.push(entity);
      base.requestRender();
    }
  }

  function calcDistance(p1: Cartesian3, p2: Cartesian3): number {
    return Cartesian3.distance(p1, p2);
  }

  function calcTriangleArea(p1: Cartesian3, p2: Cartesian3, p3: Cartesian3): number {
    const a = Cartesian3.distance(p1, p2);
    const b = Cartesian3.distance(p2, p3);
    const c = Cartesian3.distance(p3, p1);
    const s = (a + b + c) / 2;
    return Math.sqrt(Math.max(s * (s - a) * (s - b) * (s - c), 0));
  }

  function handleMeasureDistance(position: Cartesian3) {
    measurePositions.push(position);

    const point = viewerRef.value?.entities.add({
      position,
      point: {
        pixelSize: 9,
        color: base.getColor('#ffd43b'),
        outlineColor: Color.WHITE,
        outlineWidth: 2
      }
    });

    if (point) dynamicMeasureEntities.push(point);

    if (measurePositions.length === 2) {
      const polyline = viewerRef.value?.entities.add({
        polyline: {
          positions: [...measurePositions],
          width: 3,
          material: base.getColor('#ffd43b'),
          clampToGround: false
        }
      });

      if (polyline) dynamicMeasureEntities.push(polyline);

      const distanceM = calcDistance(measurePositions[0], measurePositions[1]);
      window.$message?.success(`测距完成：${(distanceM / 1000).toFixed(2)} km`);
      measurePositions.length = 0;
      activeTool = 'browse';
      emitStatus();
    } else {
      window.$message?.info('请继续选择第二个点');
    }

    base.requestRender();
  }

  function handleMeasureArea(position: Cartesian3) {
    measurePositions.push(position);

    const point = viewerRef.value?.entities.add({
      position,
      point: {
        pixelSize: 9,
        color: base.getColor('#ff922b'),
        outlineColor: Color.WHITE,
        outlineWidth: 2
      }
    });

    if (point) dynamicMeasureEntities.push(point);

    if (measurePositions.length === 3) {
      const polygon = viewerRef.value?.entities.add({
        polygon: {
          hierarchy: new PolygonHierarchy([...measurePositions]),
          material: base.getColor('#ff922b', 0.24),
          outline: true,
          outlineColor: base.getColor('#ff922b')
        }
      });

      if (polygon) dynamicMeasureEntities.push(polygon);

      const areaSqM = calcTriangleArea(measurePositions[0], measurePositions[1], measurePositions[2]);
      window.$message?.success(`测面完成：${(areaSqM / 1e6).toFixed(3)} km²`);
      measurePositions.length = 0;
      activeTool = 'browse';
      emitStatus();
    } else {
      window.$message?.info('请继续选择区域顶点');
    }

    base.requestRender();
  }

  // ─── 公开接口 ─────────────────────────────────────

  function flyToPreset(preset: keyof typeof globePresets = 'task') {
    const target = globePresets[preset];
    if (!target) return;
    base.flyToLocation(target.longitude, target.latitude, target.height);
  }

  function resetView() {
    clearMeasureDraft();
    activeTool = 'browse';
    flyToPreset('default');
    emitStatus();
  }

  function setActiveTool(tool: GlobeInteractiveTool | 'browse') {
    activeTool = tool;
    if (tool === 'browse') clearMeasureDraft();
    emitStatus();
  }

  function setLayerVisible(layerKey: GlobeLayerKey, visible: boolean) {
    const viewer = viewerRef.value;
    layerVisibility[layerKey] = visible;

    if (!viewer) return;

    if (layerKey === 'imagery') {
      base.imageryLayers.forEach(layer => { layer.show = visible; });
      base.requestRender();
      return;
    }

    staticEntities[layerKey].forEach(entity => { entity.show = visible; });

    if (layerKey === 'mark') {
      dynamicMarkEntities.forEach(entity => { entity.show = visible; });
    }

    if (layerKey === 'route') {
      dynamicRouteEntities.forEach(entity => { entity.show = visible; });
    }

    base.requestRender();
  }

  function clearAnnotations() {
    clearDynamicMarks();
    window.$message?.success('已清除标注与测量结果');
  }

  function generateMark() {
    const taskPreset = globePresets.task;
    addDynamicAnnotation(taskPreset.longitude, taskPreset.latitude, `标注${annotationIndex++}`);
    window.$message?.success('已生成预置标注');
  }

  async function startAnalysis(onStep: (text: string) => void) {
    clearDynamicMarks();

    for (const step of globeAnalysisSteps) {
      onStep(step);
      await sleep(900);
    }

    const routeEntity = createPolylineEntity('route', globeAnalysisResult.route);
    const areaEntity = createPolygonEntity(globeAnalysisResult.area);

    if (routeEntity) dynamicRouteEntities.push(routeEntity);
    if (areaEntity) dynamicRouteEntities.push(areaEntity);

    globeAnalysisResult.marks.forEach(item => {
      const entity = createPointEntity('mark', item);
      if (entity) dynamicMarkEntities.push(entity);
    });

    flyToPreset('task');
    base.requestRender();
  }

  // ─── 初始化 ───────────────────────────────────────

  async function initViewer() {
    await base.initViewer({
      prepareViewer(viewer) {
        viewer.scene.globe.showGroundAtmosphere = false;
        if (viewer.scene.skyAtmosphere) {
          viewer.scene.skyAtmosphere.show = false;
        }
        viewer.scene.globe.baseColor = Color.fromCssColorString('#07101d');
        viewer.scene.screenSpaceCameraController.minimumZoomDistance = 25000;
        viewer.scene.screenSpaceCameraController.maximumZoomDistance = 40000000;
        viewer.scene.screenSpaceCameraController.zoomFactor = 1.5;
        viewer.scene.screenSpaceCameraController.inertiaZoom = 0.5;
        (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';
      },
      afterImagery() {
        addStaticEntities();

        base.bindMouseEvents({
          onMouseMove: (movement: { endPosition: Cartesian2 }) => {
            emitStatus(base.getCartesianFromScreen(movement.endPosition));
          },
          onLeftClick: (click: { position: Cartesian2 }) => {
            const cartesian = base.getCartesianFromScreen(click.position);
            if (!cartesian) return;

            const cartographic = Cartographic.fromCartesian(cartesian);
            const longitude = Number(CesiumMath.toDegrees(cartographic.longitude).toFixed(6));
            const latitude = Number(CesiumMath.toDegrees(cartographic.latitude).toFixed(6));

            if (activeTool === 'annotate') {
              addDynamicAnnotation(longitude, latitude);
              window.$message?.success('已添加标注');
            }

            if (activeTool === 'measure-distance') {
              handleMeasureDistance(cartesian);
            }

            if (activeTool === 'measure-area') {
              handleMeasureArea(cartesian);
            }
          }
        });

        base.addCameraChangeListener(() => emitStatus());
        flyToPreset('default');
        emitStatus();
      }
    });
  }

  return {
    containerRef,
    initViewer,
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
    exportScreenshot: () => base.exportScreenshot(`webglobe-${Date.now()}.png`)
  };
}
