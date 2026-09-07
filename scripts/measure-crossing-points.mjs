#!/usr/bin/env node
/**
 * 淡水河渡河断面量算器（Overpass 水域面 → 水线坐标）
 *
 * 用途：从 OSM 水域多边形（natural=water / waterway=riverbank）量算三个渡河断面
 * （方案一 关渡段 / 方案二 社子岛头段 / 方案三 渡船头—竹围段）的：
 *   - 西岸水线点（下水点）
 *   - 东岸水线点（登陆点）
 *   - 实测河幅（米）
 * 输出结果用于回填 src/mock/river.ts 与 docs/渡河场景点位表.md，
 * 保证标绘点位与真实影像/地图上的河道水线一致。
 *
 * 无第三方依赖，Node 18+。用法：node scripts/measure-crossing-points.mjs
 */
import { writeFile } from 'node:fs/promises';

const BBOX = '25.03,121.38,25.22,121.66'; // 覆盖淡水河干流 + 基隆河河口
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const UA = 'geo-llm-demo/1.0 (river-crossing-measure)';

const QUERY = `[out:json][timeout:180];
(
  way["waterway"="riverbank"](${BBOX});
  way["natural"="water"](${BBOX});
  relation["natural"="water"](${BBOX});
  relation["waterway"="riverbank"](${BBOX});
);
out geom;`;

/** 三个断面：近似垂直于河道走向的截线（p1→p2），ref 为参考河心点 */
const TRANSECTS = [
  {
    key: 'plan-a',
    name: '方案一 关渡段（关渡大桥上游约1km）',
    p1: [121.446, 25.1185],
    p2: [121.472, 25.1225],
    ref: [121.45949, 25.12]
  },
  {
    key: 'plan-b',
    name: '方案二 社子岛头段',
    p1: [121.447, 25.1115],
    p2: [121.474, 25.1155],
    ref: [121.46168, 25.1135]
  },
  {
    key: 'plan-c',
    name: '方案三 渡船头—竹围段',
    p1: [121.438, 25.1425],
    p2: [121.464, 25.1505],
    ref: [121.452, 25.1465]
  }
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmt = v => Number(v.toFixed(5));

async function fetchOverpass() {
  let lastErr;
  for (const endpoint of ENDPOINTS) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
          body: `data=${encodeURIComponent(QUERY)}`
        });
        if (res.status === 429 || res.status === 406) {
          const wait = 5000 * (attempt + 1);
          console.warn(`[overpass] HTTP ${res.status}，${wait / 1000}s 后重试...`);
          await sleep(wait);
          continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        console.log(`[overpass] ${endpoint} 成功，elements=${json.elements?.length ?? 0}`);
        return json;
      } catch (err) {
        lastErr = err;
        console.warn(`[overpass] ${endpoint} 失败：${err.message}`);
        await sleep(3000);
        break;
      }
    }
  }
  throw new Error(`Overpass 全部失败：${lastErr?.message}`);
}

/** 收集全部水域边线段（闭合环/分段 way/multipolygon member 均可，求交不需要闭合） */
function collectWaterSegments(overpassJson) {
  const segments = []; // [{x1,y1,x2,y2}]
  let wayCount = 0;
  const pushPolyline = geometry => {
    if (!Array.isArray(geometry) || geometry.length < 2) return;
    for (let i = 0; i < geometry.length - 1; i += 1) {
      const a = geometry[i];
      const b = geometry[i + 1];
      if (!a || !b) continue;
      segments.push([a.lon, a.lat, b.lon, b.lat]);
    }
  };
  for (const el of overpassJson.elements ?? []) {
    if (el.type === 'way' && Array.isArray(el.geometry)) {
      pushPolyline(el.geometry);
      wayCount += 1;
    } else if (el.type === 'relation' && Array.isArray(el.members)) {
      el.members.forEach(m => {
        if (m.type === 'way' && Array.isArray(m.geometry)) pushPolyline(m.geometry);
      });
    }
  }
  console.log(`[水域面] way ${wayCount} 个，边线段 ${segments.length} 条`);
  return segments;
}

/** 截线（p1→p2）与全部水域边线段的交点，返回 [{s, lon, lat}]，s 为沿线参数 */
function intersectionsAlongLine(segments, p1, p2) {
  const d1x = p2[0] - p1[0];
  const d1y = p2[1] - p1[1];
  const pts = [];
  for (const [x1, y1, x2, y2] of segments) {
    const d2x = x2 - x1;
    const d2y = y2 - y1;
    const denom = d1x * d2y - d1y * d2x;
    if (Math.abs(denom) < 1e-12) continue;
    const s = ((x1 - p1[0]) * d2y - (y1 - p1[1]) * d2x) / denom;
    const t = ((x1 - p1[0]) * d1y - (y1 - p1[1]) * d1x) / denom;
    if (s < 0 || s > 1 || t < 0 || t > 1) continue;
    pts.push({ s, lon: p1[0] + s * d1x, lat: p1[1] + s * d1y });
  }
  return pts.sort((a, b) => a.s - b.s);
}

function distM(a, b) {
  const dx = (b[0] - a[0]) * 111320 * Math.cos((a[1] * Math.PI) / 180);
  const dy = (b[1] - a[1]) * 110540;
  return Math.hypot(dx, dy);
}

/** 对一个断面：求所有水域跨度（沿线参数配对），取包含参考点的跨度（否则最宽） */
function measureTransect(segments, t) {
  const pts = intersectionsAlongLine(segments, t.p1, t.p2);
  const spans = [];
  for (let i = 0; i + 1 < pts.length; i += 2) {
    const w = distM([pts[i].lon, pts[i].lat], [pts[i + 1].lon, pts[i + 1].lat]);
    if (w < 80) continue; // 过滤池塘/小水洼
    spans.push({ a: pts[i], b: pts[i + 1], widthM: w });
  }
  if (spans.length === 0) return null;
  // 主槽：优先取包含参考点的跨度；否则取最宽
  const containing = spans.filter(s => Math.abs(s.a.s - s.b.s) > 0 && s.a.s <= 1 && s.b.s >= 0);
  const pool = spans;
  const mainSpan =
    (containing.length > 0 ? containing : pool).reduce((best, cur) => {
      const mid = [(cur.a.lon + cur.b.lon) / 2, (cur.a.lat + cur.b.lat) / 2];
      const bestMid = best ? [(best.a.lon + best.b.lon) / 2, (best.a.lat + best.b.lat) / 2] : mid;
      const dCur = distM(mid, t.ref);
      const dBest = distM(bestMid, t.ref);
      return dCur < dBest ? cur : best;
    }, null) ?? spans[0];
  return {
    key: t.key,
    name: t.name,
    west: [fmt(mainSpan.a.lon), fmt(mainSpan.a.lat)],
    east: [fmt(mainSpan.b.lon), fmt(mainSpan.b.lat)],
    center: [fmt((mainSpan.a.lon + mainSpan.b.lon) / 2), fmt((mainSpan.a.lat + mainSpan.b.lat) / 2)],
    widthM: Math.round(mainSpan.widthM),
    spanCount: spans.length
  };
}

async function main() {
  const overpassJson = await fetchOverpass();
  const segments = collectWaterSegments(overpassJson);
  const results = TRANSECTS.map(t => measureTransect(segments, t));

  console.log('\n=== 量算结果（水线点 / 实测河幅） ===');
  for (const r of results) {
    if (!r) {
      console.log('存在未量算到水线的断面！');
      continue;
    }
    console.log(
      `${r.key} ${r.name}\n  西岸水线(下水): [${r.west[0]}, ${r.west[1]}]\n  东岸水线(登陆): [${r.east[0]}, ${r.east[1]}]\n  河心: [${r.center[0]}, ${r.center[1]}]\n  实测河幅: ${r.widthM} m（候选跨度 ${r.spanCount} 个）`
    );
  }

  await writeFile('scripts/crossing-measurements.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('\n[输出] scripts/crossing-measurements.json');
}

main().catch(err => {
  console.error(`[失败] ${err.message}`);
  process.exit(1);
});
