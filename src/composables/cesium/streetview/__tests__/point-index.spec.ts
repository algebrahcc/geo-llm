import { describe, expect, it } from 'vitest';
import { createPointIndex } from '../point-index';

/**
 * 街景点网格索引的纯逻辑测试。
 *
 * 索引存在的唯一理由：点击拾取与「本地街景就近取图」都不能对城市级点集（数万～十万）
 * 做 O(n) 遍历，但又必须与暴力遍历给出**相同结论** —— 因此这里的真值来自暴力实现，
 * 而不是把索引的内部结构复述一遍。
 */

/** 暴力最近邻：作为索引实现的对照真值 */
function bruteNearest(points: Array<[number, number]>, lon: number, lat: number, maxMeters: number): number {
  let best = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  points.forEach(([pLon, pLat], index) => {
    const dist = distanceMeters(lon, lat, pLon, pLat);
    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
  });
  return bestDist <= maxMeters ? best : -1;
}

/** 与实现同口径的局部等距近似（仅用于测试比对，不引用实现内部符号） */
function distanceMeters(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const midLat = ((lat1 + lat2) / 2) * (Math.PI / 180);
  const dx = (lon2 - lon1) * 111320 * Math.cos(midLat);
  const dy = (lat2 - lat1) * 110540;
  return Math.hypot(dx, dy);
}

/** 固定种子的线性同余伪随机，保证对照测试可复现 */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe('街景点网格索引', () => {
  it('空点集：尺寸为 0，查询无命中', () => {
    const index = createPointIndex([]);

    expect(index.size).toBe(0);
    expect(index.findNearest(121.5, 25.03, 100)).toBe(-1);
  });

  it('阈值内命中唯一街景点，并返回其输入下标', () => {
    const index = createPointIndex([[121.5, 25.03]]);

    expect(index.size).toBe(1);
    expect(index.findNearest(121.50005, 25.03005, 100)).toBe(0);
  });

  it('超出阈值不命中（避免点击远处误弹全景）', () => {
    const index = createPointIndex([[121.5, 25.03]]);

    // 0.01° 纬度 ≈ 1105m，远超 100m 阈值
    expect(index.findNearest(121.5, 25.04, 100)).toBe(-1);
  });

  it('多点时返回真正最近的一个', () => {
    const points: Array<[number, number]> = [
      [121.5, 25.03],
      [121.5003, 25.03],
      [121.4, 25.0]
    ];
    const index = createPointIndex(points);

    expect(index.findNearest(121.50029, 25.03, 100)).toBe(1);
  });

  it('查询点与命中点分属相邻网格时依然命中（环搜索不漏点）', () => {
    const points: Array<[number, number]> = [
      [121.5, 25.03],
      [121.6, 25.13]
    ];
    // 小网格（≈55m）保证两点一定落在不同格子，查询点贴着格边界
    const index = createPointIndex(points, 0.0005);

    expect(index.findNearest(121.5002, 25.0301, 100)).toBe(0);
  });

  it('高纬地区按 cos(纬度) 折算经度距离，不把远处点误判为命中', () => {
    const index = createPointIndex([[10, 60]]);

    // 纬度 60° 处 0.01° 经度 ≈ 556m：500m 阈值不命中，600m 命中
    expect(index.findNearest(10.01, 60, 500)).toBe(-1);
    expect(index.findNearest(10.01, 60, 600)).toBe(0);
  });

  it('与暴力遍历结论一致（固定种子随机点集对照）', () => {
    const random = createRandom(20260930);
    const points: Array<[number, number]> = [];
    for (let i = 0; i < 500; i += 1) {
      points.push([121.4 + random() * 0.3, 24.9 + random() * 0.3]);
    }
    const index = createPointIndex(points);

    expect(index.size).toBe(500);
    for (let i = 0; i < 300; i += 1) {
      const lon = 121.4 + random() * 0.3;
      const lat = 24.9 + random() * 0.3;
      const maxMeters = [50, 200, 1000][i % 3];
      const expected = bruteNearest(points, lon, lat, maxMeters);
      const actual = index.findNearest(lon, lat, maxMeters);

      if (expected === -1) {
        expect(actual).toBe(-1);
      } else {
        expect(actual).not.toBe(-1);
        // 并列距离时允许取到不同的点，因此比较距离而非下标
        expect(distanceMeters(lon, lat, points[actual][0], points[actual][1])).toBeCloseTo(
          distanceMeters(lon, lat, points[expected][0], points[expected][1]),
          6
        );
      }
    }
  });
});
