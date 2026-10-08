/**
 * 地图选区：框选一片区域，并把它变成可研判的结构化输入
 *
 * 三件事：
 * 1. 画：左键拖拽出矩形，半透明面即时反馈；
 * 2. 采：把落在范围内的场景要素收集成「证据」（id / 图层 / 类型 / 代表点 / 属性）；
 * 3. 建图：从线要素几何反推出路网图（线段端点为节点），这样关键节点与断堵卡风险
 *    不需要数据侧额外标注拓扑就能算——这是本页能对任意路网数据生效的关键。
 *
 * 本模块依赖 Cesium，纯计算部分（bounds/图/目标映射）抽在 map-selection.ts 里，便于单测。
 */

import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  JulianDate,
  Math as CesiumMath,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  type Entity,
  type Viewer
} from 'cesium';
import { computed, ref, shallowRef } from 'vue';
import { buildSelection, type RegionSelection } from '@/composables/intel/map-selection';
import { regionAreaKm2 } from '@/composables/intel/situation-brief';

/** 选区面样式（与情报/研判面板同一套蓝色系） */
const REGION_FILL = Color.fromCssColorString('#2ba3ff').withAlpha(0.12);
const REGION_OUTLINE = Color.fromCssColorString('#2ba3ff').withAlpha(0.9);

/**
 * 判为「有效拖拽」的最小像素距离。
 *
 * 小于此值按误点处理：既不出零面积选区，也不退出框选模式（用户可以直接重新拖）。
 * 8px 是常见的点击抖动阈值——鼠标点击时的位移通常不超过 3~5px。
 */
const MIN_DRAG_PIXELS = 8;

export function useCesiumRegionSelect() {
  const selection = shallowRef<RegionSelection | null>(null);
  const drawing = ref(false);
  /** 拖拽起点（经纬度） */
  const dragStart = ref<{ lon: number; lat: number } | null>(null);
  const hasSelection = computed(() => selection.value !== null);

  let handler: ScreenSpaceEventHandler | null = null;
  let regionEntity: Entity | null = null;
  let activeViewer: Viewer | null = null;
  let detachHandler: (() => void) | null = null;
  /** 按下时的屏幕坐标：用于区分「拖拽框选」与「误点」 */
  let dragStartPixel: Cartesian2 | null = null;
  /** 相机手势的原始开关状态：挂起前后要原样恢复 */
  let cameraState: { rotate: boolean; translate: boolean; tilt: boolean; look: boolean } | null = null;

  /** 屏幕坐标 → 经纬度（拾取球面；未命中则返回 null） */
  function pickLonLat(viewer: Viewer, position: Cartesian2): { lon: number; lat: number } | null {
    const cartesian = viewer.camera.pickEllipsoid(position, viewer.scene.globe.ellipsoid);
    if (!cartesian) return null;
    const carto = Cartographic.fromCartesian(cartesian);
    return { lon: CesiumMath.toDegrees(carto.longitude), lat: CesiumMath.toDegrees(carto.latitude) };
  }

  /**
   * 拖拽期间挂起相机手势。
   *
   * 不挂起的话，按住左键拖框会同时旋转/平移地球：看到的是矩形在画、实际是相机在转，
   * 松手时的范围与用户以为的范围完全不是一回事。滚轮缩放（zoom）保留，便于边框边调视野。
   */
  function suspendCamera(viewer: Viewer): void {
    const controller = viewer.scene.screenSpaceCameraController;
    cameraState = {
      rotate: controller.enableRotate,
      translate: controller.enableTranslate,
      tilt: controller.enableTilt,
      look: controller.enableLook
    };
    controller.enableRotate = false;
    controller.enableTranslate = false;
    controller.enableTilt = false;
    controller.enableLook = false;
  }

  /** 恢复相机手势（按挂起前的原值恢复，不硬编码为 true） */
  function resumeCamera(viewer: Viewer | null): void {
    const controller = viewer?.scene.screenSpaceCameraController;
    if (!controller || !cameraState) return;
    controller.enableRotate = cameraState.rotate;
    controller.enableTranslate = cameraState.translate;
    controller.enableTilt = cameraState.tilt;
    controller.enableLook = cameraState.look;
    cameraState = null;
  }

  /** 由两个角点算矩形范围（顺序无关，用户可能从右上往左下拖） */
  function boundsOf(
    a: { lon: number; lat: number },
    b: { lon: number; lat: number }
  ): [number, number, number, number] {
    return [Math.min(a.lon, b.lon), Math.min(a.lat, b.lat), Math.max(a.lon, b.lon), Math.max(a.lat, b.lat)];
  }

  function rectanglePositions(bounds: [number, number, number, number]): Cartesian3[] {
    const [minLon, minLat, maxLon, maxLat] = bounds;
    return Cartesian3.fromDegreesArray([minLon, minLat, maxLon, minLat, maxLon, maxLat, minLon, maxLat]);
  }

  /** 把场景要素读成可研判的结构（Cesium 属性 → 纯数据） */
  function readEntities(viewer: Viewer): Array<{
    id: string;
    layerName: string;
    name: string;
    kind: 'point' | 'line' | 'polygon';
    vertices: Array<[number, number]>;
    attrs: Record<string, string | number>;
  }> {
    const time = JulianDate.now();
    const result: Array<{
      id: string;
      layerName: string;
      name: string;
      kind: 'point' | 'line' | 'polygon';
      vertices: Array<[number, number]>;
      attrs: Record<string, string | number>;
    }> = [];

    viewer.entities.values.forEach(entity => {
      // 选区面自身与不可见要素不参与研判
      if (!entity.show || entity.id === regionEntity?.id) return;
      const attrs: Record<string, string | number> = {};
      const properties = entity.properties?.getValue(time) as Record<string, unknown> | undefined;
      if (properties) {
        Object.entries(properties).forEach(([key, value]) => {
          if (value === null || value === undefined) return;
          if (typeof value === 'string' || typeof value === 'number') {
            attrs[key] = value;
          } else if (typeof value === 'boolean') {
            attrs[key] = value ? 1 : 0;
          }
        });
      }

      const vertices: Array<[number, number]> = [];
      let kind: 'point' | 'line' | 'polygon' = 'point';
      const position = entity.position?.getValue(time);
      if (position) {
        const carto = Cartographic.fromCartesian(position);
        vertices.push([CesiumMath.toDegrees(carto.longitude), CesiumMath.toDegrees(carto.latitude)]);
      } else if (entity.polyline) {
        kind = 'line';
        const positions = entity.polyline.positions?.getValue(time) as Cartesian3[] | undefined;
        positions?.forEach(item => {
          const carto = Cartographic.fromCartesian(item);
          vertices.push([CesiumMath.toDegrees(carto.longitude), CesiumMath.toDegrees(carto.latitude)]);
        });
      } else if (entity.polygon) {
        kind = 'polygon';
        const hierarchy = entity.polygon.hierarchy?.getValue(time) as { positions?: Cartesian3[] } | undefined;
        hierarchy?.positions?.forEach(item => {
          const carto = Cartographic.fromCartesian(item);
          vertices.push([CesiumMath.toDegrees(carto.longitude), CesiumMath.toDegrees(carto.latitude)]);
        });
      }
      if (vertices.length === 0) return;

      const layerName = typeof attrs.layerName === 'string' ? attrs.layerName : '场景图层';
      result.push({
        id: String(entity.id),
        layerName,
        name: entity.name || String(entity.id),
        kind,
        vertices,
        attrs
      });
    });
    return result;
  }

  /** 采集：把范围内的要素整理成证据 + 目标 + 路网图 */
  function collect(viewer: Viewer, bounds: [number, number, number, number]): RegionSelection {
    return buildSelection({
      name: `研判区 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`,
      bounds,
      areaKm2: regionAreaKm2(bounds),
      features: readEntities(viewer)
    });
  }

  /** 进入框选模式：按下 → 拖动 → 松开三步完成一次框选 */
  function startDraw(viewer: Viewer): void {
    activeViewer = viewer;
    drawing.value = true;
    dragStart.value = null;
    dragStartPixel = null;
    handler?.destroy();

    // 重新框选前先清掉上一次的选区面，避免多块选区叠在一起分不清哪块有效
    if (regionEntity) {
      viewer.entities.remove(regionEntity);
      regionEntity = null;
    }
    suspendCamera(viewer);

    handler = new ScreenSpaceEventHandler(viewer.canvas);

    // ① 按下：记录起点（球面拾取失败说明点到了天空，忽略这次按下）
    handler.setInputAction((event: { position: Cartesian2 }) => {
      const start = pickLonLat(viewer, event.position);
      if (!start) return;
      dragStart.value = start;
      dragStartPixel = Cartesian2.clone(event.position);
    }, ScreenSpaceEventType.LEFT_DOWN);

    // ② 拖动：实时把矩形画出来（选区面在第一次拖动时才创建——空 hierarchy 会让
    //    Cesium 的几何更新抛「至少需要三个点」，所以不能提前建一个空多边形）
    handler.setInputAction((event: { endPosition: Cartesian2 }) => {
      if (!dragStart.value) return;
      const current = pickLonLat(viewer, event.endPosition);
      if (!current) return;
      const bounds = boundsOf(dragStart.value, current);
      if (!regionEntity) {
        regionEntity = viewer.entities.add({
          name: '研判选区',
          polygon: {
            hierarchy: { positions: rectanglePositions(bounds) } as never,
            material: REGION_FILL,
            outline: true,
            outlineColor: REGION_OUTLINE
          }
        });
      } else {
        regionEntity.polygon!.hierarchy = { positions: rectanglePositions(bounds) } as never;
      }
      viewer.scene.requestRender();
    }, ScreenSpaceEventType.MOUSE_MOVE);

    // ③ 松开：距离太小视为误点，保留框选模式让用户重试；否则出选区并立即拆监听
    handler.setInputAction((event: { position: Cartesian2 }) => {
      const start = dragStart.value;
      if (!start) return;
      if (dragStartPixel && Cartesian2.distance(event.position, dragStartPixel) < MIN_DRAG_PIXELS) {
        dragStart.value = null;
        dragStartPixel = null;
        return;
      }
      const end = pickLonLat(viewer, event.position) ?? start;
      const bounds = boundsOf(start, end);
      dragStart.value = null;
      dragStartPixel = null;
      selection.value = collect(viewer, bounds);
      // 框选结束后立即拆掉监听，否则会与地图平移手势抢事件
      stopDraw();
    }, ScreenSpaceEventType.LEFT_UP);

    detachHandler = () => {
      handler?.destroy();
      handler = null;
    };
  }

  /** 只拆事件并恢复相机手势，保留选区面 */
  function stopDraw(): void {
    detachHandler?.();
    detachHandler = null;
    dragStart.value = null;
    dragStartPixel = null;
    drawing.value = false;
    resumeCamera(activeViewer);
  }

  /** 清除选区与监听 */
  function clear(viewer?: Viewer): void {
    stopDraw();
    const target = viewer ?? activeViewer;
    if (target && regionEntity) {
      target.entities.remove(regionEntity);
      target.scene.requestRender();
    }
    regionEntity = null;
    selection.value = null;
  }

  return { selection, drawing, hasSelection, startDraw, clear, stopDraw };
}
