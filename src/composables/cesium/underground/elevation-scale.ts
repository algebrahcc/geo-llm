/**
 * 地下模型的标高 ↔ 剖切滑杆换算（纯函数，不依赖 Cesium，便于单测）。
 *
 * 为什么单独拆一层：剖切交互里真正容易出错的不是 Cesium 的平面构造，而是
 * 「滑杆 0~1」与「模型标高区间」的映射、地下/地上层号换算这些边界逻辑。
 * 把它们做成无依赖纯函数，才能在单测里把 0/负高程/退化范围这些边界钉死。
 */

/** 剖切轴：水平（按标高切层）/ 南北向竖直 / 东西向竖直 */
export type ClipAxis = 'up' | 'east' | 'north';

/** 模型标高范围（世界坐标，单位米；地下为负） */
export interface ElevationRange {
  min: number;
  max: number;
}

/** 楼层面板选项 */
export interface FloorLabelOptions {
  /** 实际地面高程，默认 0 */
  groundHeight?: number;
  /** 标准层高，默认 4m（住宅/办公常见）；工业厂房可用 6m */
  floorHeight?: number;
}

/** 把滑杆值收进 0~1；非数字按 0 处理，避免 NaN 传播进剖切面 */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** 滑杆位置 → 模型标高。范围退化（min=max）时直接返回该值，不做除法 */
export function sliderToElevation(t: number, range: ElevationRange): number {
  const ratio = clamp01(t);
  const span = range.max - range.min;
  if (span === 0) return range.min;
  return range.min + span * ratio;
}

/** 模型标高 → 滑杆位置（sliderToElevation 的逆运算，供相机/剖切联动回写 UI） */
export function elevationToSlider(elevation: number, range: ElevationRange): number {
  const span = range.max - range.min;
  if (span === 0) return 0;
  return clamp01((elevation - range.min) / span);
}

/**
 * 标高 → 楼层标签。
 *
 * 地下按 B1、B2…（B1 为紧邻地面的第一层），地面及以上按 F1、F2…。
 * 不用四舍五入而是 `ceil`：标高 -0.1m 仍属于地下 B1 的范围，
 * 取整会把它误判成地面 F1，在剖切拖动时会出现楼层标签跳变。
 */
export function elevationToFloorLabel(elevation: number, options: FloorLabelOptions = {}): string {
  const { groundHeight = 0, floorHeight = 4 } = options;
  if (floorHeight <= 0) return formatElevation(elevation);
  if (elevation < groundHeight) {
    return `B${Math.ceil((groundHeight - elevation) / floorHeight)}`;
  }
  return `F${Math.floor((elevation - groundHeight) / floorHeight) + 1}`;
}

/** 标高格式化：统一一位小数，地下带负号 */
export function formatElevation(elevation: number): string {
  return `${elevation.toFixed(1)}m`;
}

/** 剖切轴按钮文案 */
export function clipAxisLabel(axis: ClipAxis): string {
  switch (axis) {
    case 'up':
      return '水平剖切';
    case 'east':
      return '南北剖切';
    case 'north':
      return '东西剖切';
    default:
      return '水平剖切';
  }
}

/** 标高范围描述，用于面板副标题 */
export function describeRange(range: ElevationRange): string {
  return `${formatElevation(range.min)} ~ ${formatElevation(range.max)}（跨度 ${formatElevation(range.max - range.min)}）`;
}
