/**
 * 街景点网格索引（纯函数，不依赖 Cesium）
 *
 * 存在的理由：街景点是城市级点集（台北/新北可达数万～十万），而两处交互都必须「就近取点」——
 *  1. 球上点击拾取（点在点图元之间落下时，要找 100m 内最近的街景点）；
 *  2. 本地街景数据源没有 nearest 接口，只能自己在点集里找最近点。
 * 两者都不能每次做 O(n) 遍历，于是按经纬度分桶，只在查询点周围的格子环里找。
 *
 * 正确性约定：结果必须与暴力遍历一致。环搜索的停止条件是保守下界
 * （环外任意点的距离 ≥ ring × 每格最小米数），因此不会漏掉更近的点。
 */
import { distanceMeters, METERS_PER_DEG_LAT, METERS_PER_DEG_LON_EQUATOR } from './geo';

/** 默认网格边长（度）：约 110m，与街景 100m 命中阈值同量级 */
export const DEFAULT_CELL_DEGREES = 0.001;

const DEG_TO_RAD = Math.PI / 180;

export interface PointIndex {
  /** 点总数 */
  readonly size: number;
  /**
   * 查询给定坐标附近最近的点。
   *
   * @returns 命中点的输入下标；阈值内无点则返回 -1
   */
  findNearest(lon: number, lat: number, maxMeters: number): number;
}

/**
 * 构建索引。
 *
 * @param points 点集（经纬度）
 * @param cellDegrees 网格边长（度），默认 0.001；点稀疏时调大可减少空桶查找
 */
export function createPointIndex(
  points: Array<[number, number]>,
  cellDegrees: number = DEFAULT_CELL_DEGREES
): PointIndex {
  const cell = cellDegrees > 0 ? cellDegrees : DEFAULT_CELL_DEGREES;
  const buckets = new Map<string, number[]>();

  points.forEach(([lon, lat], index) => {
    const key = bucketKey(Math.floor(lon / cell), Math.floor(lat / cell));
    const bucket = buckets.get(key);
    if (bucket) bucket.push(index);
    else buckets.set(key, [index]);
  });

  // 每格的纬度方向米数固定；经度方向随纬度收缩，取两者较小值作为环外下界
  const cellMetersLat = cell * METERS_PER_DEG_LAT;

  function findNearest(lon: number, lat: number, maxMeters: number): number {
    if (points.length === 0) return -1;

    const cellMetersLon = Math.abs(cell * METERS_PER_DEG_LON_EQUATOR * Math.cos(lat * DEG_TO_RAD));
    const cellMetersMin = Math.max(1e-6, Math.min(cellMetersLat, cellMetersLon));
    const originX = Math.floor(lon / cell);
    const originY = Math.floor(lat / cell);
    const maxRing = Math.ceil(maxMeters / cellMetersMin) + 1;

    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let ring = 0; ring <= maxRing; ring += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        for (let dy = -ring; dy <= ring; dy += 1) {
          // 只扫当前环的外圈：内圈已在前几轮扫过，跳过可把重复访问降到 O(环长)
          if (ring > 0 && Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
          const bucket = buckets.get(bucketKey(originX + dx, originY + dy));
          if (!bucket) continue;
          for (let i = 0; i < bucket.length; i += 1) {
            const index = bucket[i];
            const point = points[index];
            const distance = distanceMeters(lon, lat, point[0], point[1]);
            if (distance < bestDistance) {
              bestDistance = distance;
              bestIndex = index;
            }
          }
        }
      }
      // 环外任意点至少跨出 ring 个格子 → 距离 ≥ ring × 每格最小米数，已不可能更近
      if (ring > 0 && bestDistance <= ring * cellMetersMin) break;
    }

    return bestDistance <= maxMeters ? bestIndex : -1;
  }

  return { size: points.length, findNearest };
}

function bucketKey(x: number, y: number): string {
  return `${x}:${y}`;
}
