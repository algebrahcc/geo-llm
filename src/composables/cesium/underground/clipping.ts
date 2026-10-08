/**
 * 地下模型剖切控制器：把「剖切轴 + 滑杆位置」翻译成 Cesium 的剖切面。
 *
 * 三个关键取舍：
 *
 * 1. **剖切面是地理对齐的，不是模型局部坐标。** 模型通过 `params.position`（ENU 摆放）
 *    落到球上，剖切面必须用同一套地理坐标构造，否则会出现「滑杆拖到底也切不到模型」
 *    或「切出来的位置和标高对不上」。水平面用「该点的椭球表面法线 + 同点」构造
 *    （`Plane.fromPointNormal`），配合 Cesium「法线正侧被裁掉」的语义，
 *    默认就能把地面以上的部分切掉、直接看到地下。
 *
 * 2. **复用同一个 ClippingPlaneCollection，只换里面的平面。** 每帧新建 collection
 *    会让 GPU 侧反复重建裁剪状态，拖动滑杆时明显卡顿。
 *
 * 3. **地表同步剖切是可选的。** 地下模型被地形/影像挡住时必须切开地表才看得见，
 *    但某些场景（模型本身在地上）切开地表反而突兀，所以由调用方决定。
 */
import {
  Cartesian3,
  Cartesian4,
  ClippingPlane,
  ClippingPlaneCollection,
  Ellipsoid,
  Matrix4,
  Plane,
  Transforms,
  type Cesium3DTileset,
  type Model,
  type Viewer
} from 'cesium';
import { sliderToElevation, type ClipAxis, type ElevationRange } from './elevation-scale';

/** 被剖切的三维模型引用 */
export interface ClippableModel {
  /** 三维对象（GLB 走 Model，3D Tiles 走 Cesium3DTileset） */
  primitive: Model | Cesium3DTileset;
  /** 模型摆放点（局部坐标原点对应的经纬高） */
  anchor: { lon: number; lat: number; height: number };
  /** 模型标高范围（世界坐标米）；未提供时由包围球近似 */
  range?: ElevationRange;
  /** 包围球半径（米），竖直剖切跨度以此为基准 */
  radius: number;
}

/** 剖切交互状态 */
export interface ClippingState {
  /** 是否启用剖切 */
  enabled: boolean;
  /** 剖切轴 */
  axis: ClipAxis;
  /** 滑杆位置 0~1 */
  slider: number;
  /** 翻转保留侧（少数模型需要，默认 false） */
  flip: boolean;
  /** 是否同步切开地表 */
  clipGlobe: boolean;
}

export const DEFAULT_CLIPPING_STATE: ClippingState = {
  enabled: false,
  axis: 'up',
  slider: 0.5,
  flip: false,
  clipGlobe: true
};

/**
 * 由地理锚点求出局部的东 / 北单位向量。
 *
 * 用 ENU 变换矩阵的列向量而不是球面三角函数公式：地球是椭球，
 * 三角公式在高纬度会产生可观的方向偏差，剖切面会与模型错位。
 */
function localAxes(lon: number, lat: number, height: number): { east: Cartesian3; north: Cartesian3 } {
  const frame = Transforms.eastNorthUpToFixedFrame(Cartesian3.fromDegrees(lon, lat, height));
  const column = (index: number): Cartesian3 => {
    const c = Matrix4.getColumn(frame, index, new Cartesian4());
    return new Cartesian3(c.x, c.y, c.z);
  };
  return { east: column(0), north: column(1) };
}

/**
 * 水平剖切面：该标高处的水平面。
 *
 * 法线取该点的椭球表面法线（近似天顶方向），因此「法线正侧」= 该标高以上，
 * 正好是要切掉的部分。
 */
function horizontalPlane(lon: number, lat: number, elevation: number, flip: boolean): ClippingPlane {
  const position = Cartesian3.fromDegrees(lon, lat, elevation);
  const normal = Ellipsoid.WGS84.geodeticSurfaceNormal(position, new Cartesian3());
  if (flip) Cartesian3.negate(normal, normal);
  return ClippingPlane.fromPlane(Plane.fromPointNormal(position, normal));
}

/** 竖直剖切面：过模型中心，沿轴向按滑杆偏移 */
function verticalPlane(
  anchor: { lon: number; lat: number; height: number },
  axis: 'east' | 'north',
  slider: number,
  radius: number,
  centerElevation: number,
  flip: boolean
): ClippingPlane {
  const { east, north } = localAxes(anchor.lon, anchor.lat, anchor.height);
  const axisVector = axis === 'east' ? east : north;
  const offset = (slider - 0.5) * 2 * radius;
  const center = Cartesian3.fromDegrees(anchor.lon, anchor.lat, centerElevation);
  const point = Cartesian3.add(
    center,
    Cartesian3.multiplyByScalar(axisVector, offset, new Cartesian3()),
    new Cartesian3()
  );
  const normal = flip ? Cartesian3.negate(axisVector, new Cartesian3()) : axisVector;
  return ClippingPlane.fromPlane(Plane.fromPointNormal(point, normal));
}

/** 当前滑杆位置对应的剖切面（世界坐标） */
export function buildClippingPlane(model: ClippableModel, state: ClippingState): ClippingPlane | undefined {
  const { anchor, range } = model;
  // 标高范围：优先用配置的真实范围，缺省退化为以摆放点为中心、包围球半径为半径
  const elevationRange: ElevationRange = range ?? {
    min: anchor.height - model.radius,
    max: anchor.height + model.radius
  };

  if (state.axis === 'up') {
    return horizontalPlane(anchor.lon, anchor.lat, sliderToElevation(state.slider, elevationRange), state.flip);
  }

  const centerElevation = (elevationRange.min + elevationRange.max) / 2;
  return verticalPlane(anchor, state.axis, state.slider, model.radius, centerElevation, state.flip);
}

/**
 * 给三维对象设置/清除剖切面。
 *
 * `Model.clippingPlanes` 与 `Cesium3DTileset.clippingPlanes` 在类型声明上不一致
 * （前者是 Property，后者是裸 collection），清除时也都需要写 undefined。
 * 在这里一次性转换，避免调用点各写一份断言。
 */
function setClipping(primitive: Model | Cesium3DTileset, planes: ClippingPlaneCollection | undefined): void {
  (primitive as unknown as { clippingPlanes: ClippingPlaneCollection | undefined }).clippingPlanes = planes;
}

/**
 * 创建剖切控制器。
 *
 * 返回的 `apply` 是幂等的：状态没变就不动 Cesium 对象，避免拖动滑杆时反复赋值触发重绘。
 */
export function createClippingController(viewer: Viewer, model: ClippableModel) {
  let collection: ClippingPlaneCollection | undefined;
  let lastKey = '';

  function clear(): void {
    lastKey = 'cleared';
    setClipping(model.primitive, undefined);
    viewer.scene.globe.clippingPlanes = undefined as unknown as ClippingPlaneCollection;
    collection = undefined;
    viewer.scene.requestRender();
  }

  function apply(state: ClippingState): void {
    const key = `${state.enabled}|${state.axis}|${state.slider.toFixed(4)}|${state.flip}|${state.clipGlobe}`;
    if (key === lastKey) return;
    lastKey = key;

    if (!state.enabled) {
      clear();
      return;
    }

    const plane = buildClippingPlane(model, state);
    if (!plane) return;

    if (collection) {
      // 复用 collection，只替换平面本体
      collection.removeAll();
      collection.add(plane);
    } else {
      collection = new ClippingPlaneCollection({ planes: [plane] });
    }

    const activeCollection = collection;
    setClipping(model.primitive, activeCollection);
    viewer.scene.globe.clippingPlanes = state.clipGlobe
      ? activeCollection
      : (undefined as unknown as ClippingPlaneCollection);
    viewer.scene.requestRender();
  }

  function dispose(): void {
    clear();
  }

  return { apply, clear, dispose };
}

/**
 * 由模型与摆放点推断标高范围（供面板初始化滑杆用）。
 *
 * 优先读 `params.elevation`（离线量测的真实标高范围），否则用包围球近似。
 */
export function resolveElevationRange(model: {
  anchor: { height: number };
  radius: number;
  range?: ElevationRange;
}): ElevationRange {
  return model.range ?? { min: model.anchor.height - model.radius, max: model.anchor.height + model.radius };
}
