/**
 * 地图注记统一样式（地物名、单位名、图层名、途经点…）
 *
 * 为什么集中到一处：地图标注是整屏看得最多的内容，而它的字号此前散落在
 * 渡河 / 规划 / 服务图层三处各自的 `font` 字符串里，且都是
 * 「24px 栅格化 + scale 0.5」= **显示 12px** —— 对 30-50 岁的使用者、
 * 在大屏上远看，是偏小的。
 *
 * 现在的口径：显示 **16px**，仍走「2 倍栅格化 + scale 0.5」的超采样，
 * 保证高分屏下文字边缘不发虚。
 *
 * 用法：
 *   label: { font: mapLabelFont('bold'), scale: MAP_LABEL_SCALE, ... }
 */

/** 超采样倍数（2 倍字号栅格化） */
export const MAP_LABEL_SUPERSAMPLE = 2;

/** 标注在屏幕上的显示字号（px） */
export const MAP_LABEL_DISPLAY_PX = 16;

/** Cesium label 的 `scale`：配合 2 倍栅格化，落到 MAP_LABEL_DISPLAY_PX */
export const MAP_LABEL_SCALE = 1 / MAP_LABEL_SUPERSAMPLE;

/** Cesium label 的 `font` 字符串 */
export function mapLabelFont(weight: 'normal' | 'bold' = 'normal'): string {
  const size = MAP_LABEL_DISPLAY_PX * MAP_LABEL_SUPERSAMPLE;
  return `${weight === 'bold' ? 'bold ' : ''}${size}px "Microsoft YaHei", sans-serif`;
}
