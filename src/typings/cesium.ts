/**
 * Cesium 场景通用类型定义
 */

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
