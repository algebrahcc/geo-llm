/**
 * 用仓库里真实的本地街景数据（public/data/streetview/taipei）跑一遍取图链路。
 *
 * 存在的理由：界面上「切换街景点失败」是 catch 兜底提示，光看代码很难判断是
 * 就近索引没命中、道路链没建起来，还是全景图 URL 拼错。这里把三种可能一次性钉死。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildLocalImageUrl, NEAREST_MAX_METERS, parseLocalManifest } from '../service-api';
import { createPointIndex } from '../point-index';
import { buildRouteOrder } from '../route-order';

const DIR = '/data/streetview/taipei';

function loadFixtures() {
  const manifest = JSON.parse(readFileSync('public/data/streetview/taipei/manifest.json', 'utf8'));
  const { points, imageTemplate } = parseLocalManifest(manifest);
  const coordinates = points.map(point => [point.lon, point.lat] as [number, number]);
  return {
    points,
    imageTemplate,
    coordinates,
    index: createPointIndex(coordinates),
    order: buildRouteOrder(coordinates)
  };
}

describe('本地台北街景：真实数据链路', () => {
  it('解析出 3 个点位与 pano 模板', () => {
    const { points, imageTemplate } = loadFixtures();
    expect(points.map(point => point.geoid)).toEqual(['tp-01', 'tp-02', 'tp-03']);
    expect(imageTemplate).toBe('pano/{geoid}.png');
  });

  it('每个点都能被就近索引命中（resolveImage 的前提）', () => {
    const { points, index } = loadFixtures();
    points.forEach((point, expected) => {
      const hit = index.findNearest(point.lon, point.lat, NEAREST_MAX_METERS);
      expect(hit, `${point.geoid} 未命中索引`).toBe(expected);
    });
  });

  it('道路顺序把 3 个点连成一条完整链', () => {
    const { order } = loadFixtures();
    expect(order.chains).toHaveLength(1);
    expect(order.chains[0]).toHaveLength(3);
    // 链内每个位置都能反查回来（navigate / jumpTo 都依赖 locate）
    order.chains[0].forEach((pointIndex, position) => {
      expect(order.locate.get(pointIndex)?.pos).toBe(position);
    });
  });

  it('沿链步进与胶片跳转取到的图都能拼出正确地址', () => {
    const { points, imageTemplate, order } = loadFixtures();
    const chain = order.chains[0];
    // 模拟 navigate(±1)：除两端外都应能取到下一个点
    for (let position = 0; position < chain.length; position += 1) {
      const point = points[chain[position]];
      const url = buildLocalImageUrl(DIR, imageTemplate, point.geoid);
      expect(url).toBe(`${DIR}/pano/${point.geoid}.png`);
    }
    // 模拟 jumpTo(position)：两端点也要能取到
    expect(buildLocalImageUrl(DIR, imageTemplate, points[chain[0]].geoid)).toContain('tp-01');
    expect(buildLocalImageUrl(DIR, imageTemplate, points[chain[chain.length - 1]].geoid)).toContain('tp-03');
  });
});
