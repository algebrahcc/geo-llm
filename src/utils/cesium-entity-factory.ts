/**
 * Cesium Entity 工厂 —— 统一各模块 Entity 创建，消除重复代码
 *
 * 约定：
 * - 所有函数接收 Viewer 和 Entity 参数，不再需要模块自行 viewer.entities.add
 * - 返回创建的 Entity，由调用方管理生命周期
 */
import {
  Cartesian3,
  Color,
  ColorMaterialProperty,
  HeightReference,
  PolylineDashMaterialProperty,
  PolygonHierarchy,
  type Entity,
  type Viewer
} from 'cesium';

// ── 参数类型 ──────────────────────────────────────────

export interface PointEntityOptions {
  id: string;
  name?: string;
  longitude: number;
  latitude: number;
  height?: number;
  color: string;
  pixelSize?: number;
  outlineColor?: string;
  outlineWidth?: number;
  show?: boolean;
  label?: {
    text: string;
    font?: string;
    fillColor?: string;
    backgroundColor?: string;
    showBackground?: boolean;
    scale?: number;
  };
  clampToGround?: boolean;
  disableDepthTest?: boolean;
}

export interface PolylineEntityOptions {
  id: string;
  name?: string;
  positions: Array<[number, number]>;
  width?: number;
  color: string;
  alpha?: number;
  dash?: boolean;
  show?: boolean;
  clampToGround?: boolean;
}

export interface PolygonEntityOptions {
  id: string;
  name?: string;
  positions: Array<[number, number]>;
  color: string;
  fillAlpha?: number;
  outlineAlpha?: number;
  outlineWidth?: number;
  show?: boolean;
  clampToGround?: boolean;
}

// ── 工厂函数 ──────────────────────────────────────────

/** 创建点状标注 Entity */
export function createPointEntity(viewer: Viewer, opts: PointEntityOptions): Entity {
  const color = Color.fromCssColorString(opts.color);
  const entityOptions: Record<string, any> = {
    id: opts.id,
    name: opts.name,
    position: Cartesian3.fromDegrees(opts.longitude, opts.latitude, opts.height ?? 0),
    point: {
      pixelSize: opts.pixelSize ?? 11,
      color,
      outlineColor: opts.outlineColor ? Color.fromCssColorString(opts.outlineColor) : Color.WHITE,
      outlineWidth: opts.outlineWidth ?? 2,
      heightReference: opts.clampToGround !== false ? HeightReference.CLAMP_TO_GROUND : HeightReference.NONE,
      ...(opts.disableDepthTest ? { disableDepthTestDistance: Number.POSITIVE_INFINITY } : {})
    }
  };

  if (opts.label) {
    entityOptions.label = {
      text: opts.label.text,
      font: opts.label.font ?? '12px Microsoft YaHei',
      fillColor: opts.label.fillColor ? Color.fromCssColorString(opts.label.fillColor) : Color.WHITE,
      showBackground: opts.label.showBackground ?? true,
      backgroundColor: opts.label.backgroundColor
        ? Color.fromCssColorString(opts.label.backgroundColor).withAlpha(0.78)
        : Color.fromCssColorString('#0f172a').withAlpha(0.78),
      scale: opts.label.scale ?? 1,
      heightReference: opts.clampToGround !== false ? HeightReference.CLAMP_TO_GROUND : HeightReference.NONE
    };
  }

  const entity = viewer.entities.add(entityOptions);

  if (opts.show !== undefined) entity.show = opts.show;
  return entity;
}

/** 创建折线标注 Entity */
export function createPolylineEntity(viewer: Viewer, opts: PolylineEntityOptions): Entity {
  const entity = viewer.entities.add({
    id: opts.id,
    name: opts.name,
    polyline: {
      positions: opts.positions.map(p => Cartesian3.fromDegrees(p[0], p[1])),
      width: opts.width ?? 5,
      material: opts.dash
        ? new PolylineDashMaterialProperty({ color: Color.fromCssColorString(opts.color).withAlpha(opts.alpha ?? 0.94) })
        : new ColorMaterialProperty(Color.fromCssColorString(opts.color).withAlpha(opts.alpha ?? 0.35)),
      clampToGround: opts.clampToGround !== false
    }
  });

  if (opts.show !== undefined) entity.show = opts.show;
  return entity;
}

/** 创建多边形标注 Entity */
export function createPolygonEntity(viewer: Viewer, opts: PolygonEntityOptions): Entity {
  const entity = viewer.entities.add({
    id: opts.id,
    name: opts.name,
    polygon: {
      hierarchy: new PolygonHierarchy(
        opts.positions.map(p => Cartesian3.fromDegrees(p[0], p[1]))
      ),
      material: Color.fromCssColorString(opts.color).withAlpha(opts.fillAlpha ?? 0.2),
      outline: true,
      outlineColor: Color.fromCssColorString(opts.color).withAlpha(opts.outlineAlpha ?? 0.95),
      outlineWidth: opts.outlineWidth ?? 2,
      heightReference: opts.clampToGround !== false ? HeightReference.CLAMP_TO_GROUND : HeightReference.NONE
    }
  });

  if (opts.show !== undefined) entity.show = opts.show;
  return entity;
}
