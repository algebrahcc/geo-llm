/**
 * Cesium 场景通用类型定义
 */

/** 经纬度坐标 [经度, 纬度] */
export type Coordinate = readonly [number, number];

/**
 * 矢量图层（桥接后端 VectorItem + 前端显隐状态）
 *
 * 通用地图图层面板使用的图层条目类型，供 river/planning/globe/building 等地图页复用。
 */
export interface VectorLayerItem {
  key: string; // 'vector-{id}'
  id: string; // 后端矢量图层 ID
  label: string; // vectorName
  sourceType: string; // GeoJSON / Shapefile
  featureCount: number;
  visible: boolean;
}

/** 状态条公共基础字段（activeTool 由各模块扩展提供） */
export interface BaseStatusInfo {
  longitude: string;
  latitude: string;
  altitude: string;
  cameraHeight: string;
}

/** 通用场景层 key/value 映射 */
export type LayerVisibility<T extends string> = Record<T, boolean>;

/** 工具映射辅助：将枚举/联合类型的 tool 映射为中文名 */
export function createToolNameMap<T extends string>(entries: [T, string][]): Record<T, string> {
  return Object.fromEntries(entries) as Record<T, string>;
}
