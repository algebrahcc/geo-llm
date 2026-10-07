/**
 * 街景模块的测地工具（纯函数，不依赖 Cesium）
 *
 * 为什么单独一份：街景的道路顺序推导、网格索引、行进方向三处都要「两点间距离」与
 * 「方位角」，而它们又必须在 node 环境（vitest）里可测 —— 一旦用 Cesium 的
 * `Cartesian3.distance` / `EllipsoidGeodesic`，这些模块就得跑在浏览器里。
 *
 * 精度口径：城市尺度（几十公里内）用局部等距圆柱近似，误差在千分之一量级，
 * 远小于「相邻街景点 10~30m」的判定需求；不追求大地线精度。
 */

/** 纬度方向每度米数（WGS84 平均值，随纬度变化 < 0.5%） */
export const METERS_PER_DEG_LAT = 110540;

/** 赤道处经度方向每度米数（实际值需乘 cos(纬度)） */
export const METERS_PER_DEG_LON_EQUATOR = 111320;

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/** 两点间近似距离（米） */
export function distanceMeters(aLon: number, aLat: number, bLon: number, bLat: number): number {
  const midLat = ((aLat + bLat) / 2) * DEG_TO_RAD;
  const dx = (bLon - aLon) * METERS_PER_DEG_LON_EQUATOR * Math.cos(midLat);
  const dy = (bLat - aLat) * METERS_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

/**
 * 由 a 指向 b 的方位角（度，0 = 正北，顺时针增大）
 *
 * 用于「迎面看向道路前方」：全景初始朝向取当前点指向下一个点的方位角。
 */
export function bearingDegrees(aLon: number, aLat: number, bLon: number, bLat: number): number {
  const phi1 = aLat * DEG_TO_RAD;
  const phi2 = bLat * DEG_TO_RAD;
  const deltaLon = (bLon - aLon) * DEG_TO_RAD;
  const y = Math.sin(deltaLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLon);
  return (Math.atan2(y, x) * RAD_TO_DEG + 360) % 360;
}

/** 局部米制坐标（以给定原点为 0,0，x 向东、y 向北） */
export interface LocalMeters {
  x: number;
  y: number;
}

/**
 * 把经纬度投影为局部米制坐标（等距圆柱，原点附近）
 *
 * 道路顺序推导需要反复算「距离」与「转角」，在米制平面里做既直观又快；
 * 原点取点集中心可把投影畸变压到最小。
 */
export function projectToLocalMeters(originLon: number, originLat: number, lon: number, lat: number): LocalMeters {
  const cosLat = Math.cos(originLat * DEG_TO_RAD);
  return {
    x: (lon - originLon) * METERS_PER_DEG_LON_EQUATOR * cosLat,
    y: (lat - originLat) * METERS_PER_DEG_LAT
  };
}

/**
 * 由一组经纬度求中心点（投影原点用）
 *
 * 用单次遍历而非 `Math.min(...arr)`：后者在十万级点集上会因参数过多抛栈溢出。
 */
export function centerOf(points: Array<[number, number]>): [number, number] {
  if (points.length === 0) return [0, 0];
  let minLon = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < points.length; i += 1) {
    const [lon, lat] = points[i];
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
}
