import { describe, expect, it } from 'vitest';
import { buildRouteOrder } from '../route-order';

/**
 * 道路顺序推导的纯逻辑测试。
 *
 * 唯一目的是让「前进/后退」真的沿着街道走：接口只给一堆坐标（没有拓扑、没有相邻关系），
 * 顺序只能自己推。这里锁住三件事——**连续性**（相邻项在空间上真的相邻）、
 * **不折返**（不会刚走过去又折回来）、**有安全网**（推不出来时退回原始顺序，不能更差）。
 */

const BASE_LON = 121.56;
const BASE_LAT = 25.03;
/** 约 20m（纬度 25° 处 0.0002° 经度 ≈ 20.2m） */
const STEP = 0.0002;

/** 东西向直线点集 */
function eastLine(count: number): Array<[number, number]> {
  return Array.from({ length: count }, (_, i) => [BASE_LON + STEP * i, BASE_LAT]);
}

/** 链中相邻两项的空间连续性：每一步都不超过给定米数 */
function maxAdjacentStep(points: Array<[number, number]>, chain: number[]): number {
  let max = 0;
  for (let i = 1; i < chain.length; i += 1) {
    const [lon1, lat1] = points[chain[i - 1]];
    const [lon2, lat2] = points[chain[i]];
    const midLat = ((lat1 + lat2) / 2) * (Math.PI / 180);
    max = Math.max(max, Math.hypot((lon2 - lon1) * 111320 * Math.cos(midLat), (lat2 - lat1) * 110540));
  }
  return max;
}

describe('街景道路顺序推导', () => {
  it('空点集：无链，且不声称推导成功', () => {
    const order = buildRouteOrder([]);

    expect(order.chains).toEqual([]);
    expect(order.derived).toBe(false);
  });

  it('乱序输入被纠正为连续的一条链（相邻项间距仅一个步长）', () => {
    const points = eastLine(6);
    // 输入顺序刻意打乱
    const shuffled = [points[3], points[0], points[5], points[2], points[1], points[4]];
    const order = buildRouteOrder(shuffled);

    expect(order.chains).toHaveLength(1);
    expect(order.chains[0]).toHaveLength(6);
    expect(new Set(order.chains[0]).size).toBe(6);
    // 每一步都恰好是一个步长，说明沿直线连续走，没有跳点
    expect(maxAdjacentStep(shuffled, order.chains[0])).toBeLessThan(STEP * 111320 * 1.05);
    expect(order.derived).toBe(true);
  });

  it('T 形路口：先走直线，支路另成一条链（不折返）', () => {
    const points: Array<[number, number]> = [
      [BASE_LON, BASE_LAT], // 0 主路西端
      [BASE_LON + STEP, BASE_LAT], // 1 路口
      [BASE_LON + STEP * 2, BASE_LAT], // 2 主路东端
      [BASE_LON + STEP, BASE_LAT + STEP] // 3 北向支路
    ];
    // 阈值取 25m：主路两点相距 20m 视为相邻，而路口对角点相距 30m 不算相邻，
    // 否则对角点会把主路与支路缝成一条链（这正是阈值必须显式写清的原因）
    const order = buildRouteOrder(points, { maxStepMeters: 25 });

    const mainChain = order.chains.find(chain => chain.length === 3);
    expect(mainChain).toBeDefined();
    // 主链是 0-1-2（或反向），不会出现 1→2→1 这类折返
    expect(new Set(mainChain)).toEqual(new Set([0, 1, 2]));
    expect(order.chains).toHaveLength(2);
  });

  it('相距 5km 的两簇点各自成链（超出最大步长即断链）', () => {
    const west = eastLine(3);
    const east = eastLine(3).map(([lon, lat]) => [lon + 0.05, lat] as [number, number]);
    const order = buildRouteOrder([...west, ...east], { maxStepMeters: 60 });

    expect(order.chains).toHaveLength(2);
    order.chains.forEach(chain => expect(chain).toHaveLength(3));
  });

  it('几乎重合的重复点不会让链在两点间来回', () => {
    const points: Array<[number, number]> = [
      [BASE_LON, BASE_LAT],
      [BASE_LON + 0.000005, BASE_LAT], // ≈0.5m 外，视作同一位置的重复点
      [BASE_LON + STEP * 2, BASE_LAT]
    ];
    const order = buildRouteOrder(points);
    const chain = order.chains[0];

    expect(chain).toHaveLength(3);
    expect(new Set(chain).size).toBe(3);
  });

  it('方位角指向链上的下一个点（用于全景初始朝向对齐道路前方）', () => {
    const points = eastLine(3);
    const order = buildRouteOrder(points);
    const chain = order.chains[0];
    const first = chain[0];
    const second = chain[1];
    const expected = second === first + 1 ? 90 : 270; // 向东 90°，向西 270°

    expect(order.bearing.get(first)).toBeCloseTo(expected, 0);
    // 链尾没有「前方」，取 null 由调用方兜底
    expect(order.bearing.get(chain[chain.length - 1])).toBeNull();
  });

  it('每个点都能被定位（点位 → 链与链内位置），保证前进后退不漏点', () => {
    const points = eastLine(5);
    const order = buildRouteOrder(points);

    points.forEach((_, index) => {
      const location = order.locate.get(index);
      expect(location).toBeDefined();
      expect(order.chains[location!.chain][location!.pos]).toBe(index);
    });
  });

  it('点集规模超过上限时退回原始顺序（宁可顺序朴素，也不要卡住主线程）', () => {
    const points = eastLine(5);
    const order = buildRouteOrder(points, { maxPoints: 3 });

    expect(order.derived).toBe(false);
    expect(order.chains).toEqual([[0, 1, 2, 3, 4]]);
  });
});
