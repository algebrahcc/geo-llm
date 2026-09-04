#!/usr/bin/env node
/**
 * 台北北部路网下载器（Overpass API → GeoJSON）
 *
 * 用途：为"机动路线规划"场景下载南港—淡水走廊的真实道路网，
 * 输出带 Cesium 样式属性（stroke/stroke-width）的 GeoJSON，
 * 供系统管理"数据服务"注册为 vector/geojson 类型，加载到 Cesium 底图。
 *
 * 数据源：OpenStreetMap Overpass API（https://overpass-api.de/api/interpreter）
 * 注意：overpass-api.de 要求带 User-Agent（否则 406），并有并发限流（429），脚本内置重试退避。
 * 无第三方依赖，Node 18+ 自带 fetch。
 *
 * 用法：
 *   node scripts/download-taipei-roads.mjs
 *   node scripts/download-taipei-roads.mjs --bbox "25.03,121.40,25.20,121.63" --out public/data/taipei-roads.geojson
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(scriptDir, '..');

// ──── 默认参数：南港装载地域(121.606,25.054) ~ 淡水沙崙卸载地域(121.433,25.175)，外扩覆盖走廊 ────
// Overpass bbox 顺序：南,西,北,东（south,west,north,east）
const args = process.argv.slice(2);
const getArg = name => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const BBOX = getArg('--bbox') ?? '25.03,121.40,25.20,121.63';
const OUT = resolve(ROOT, getArg('--out') ?? 'public/data/taipei-roads.geojson');

const USER_AGENT = 'geo-llm-demo/1.0 (route-network-downloader)';

// 道路等级 → 颜色/线宽（Cesium GeoJsonDataSource 读取 properties.stroke / stroke-width）
const STYLE = {
  motorway: { color: '#ff9f43', width: 3.2 },
  trunk: { color: '#f7b267', width: 2.6 },
  primary: { color: '#ffd166', width: 2.2 },
  secondary: { color: '#cbe3ff', width: 1.6 },
  tertiary: { color: '#8db8ff', width: 1.2 },
  unclassified: { color: '#5f7ea8', width: 1 },
  residential: { color: '#465e82', width: 0.9 },
  service: { color: '#3c4f6e', width: 0.8 }
};

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter'
];

function buildQuery(bbox) {
  // 仅取道路网：高速/快速/主干/次干/支路/居住区道路/服务道路，排除人行道/步道/铁路
  return `[out:json][timeout:180];
(
  way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|service)$"](${bbox});
);
out geom;`;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** 带 UA + 重试（429/406 退避 5s 递增，最多 3 次）的 Overpass 请求 */
async function fetchOverpass(query) {
  let lastErr;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
          body: `data=${encodeURIComponent(query)}`
        });
        if (res.status === 429 || res.status === 406) {
          const wait = 5000 * (attempt + 1);
          console.warn(`[overpass] ${endpoint} HTTP ${res.status}（限流/拒绝），${wait / 1000}s 后重试...`);
          await sleep(wait);
          continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.remark && json.remark.includes('runtime error')) {
          throw new Error(`Overpass runtime error: ${json.remark}`);
        }
        console.log(`[overpass] 使用端点 ${endpoint} 成功`);
        return json;
      } catch (err) {
        lastErr = err;
        console.warn(`[overpass] ${endpoint} 失败：${err.message}，尝试下一个...`);
        await sleep(3000);
        break;
      }
    }
  }
  throw new Error(`所有 Overpass 端点均失败：${lastErr?.message}`);
}

function toGeoJson(overpassJson) {
  const features = [];
  let skipped = 0;

  for (const el of overpassJson.elements ?? []) {
    if (el.type !== 'way' || !Array.isArray(el.geometry) || el.geometry.length < 2) {
      skipped += 1;
      continue;
    }
    const highway = (el.tags?.highway ?? '').replace(/_link$/, '');
    const style = STYLE[highway] ?? { color: '#465e82', width: 1 };

    // 无名的服务道路/支路跳过，减少噪点
    const name = el.tags?.name ?? '';
    if (highway === 'service' && !name) {
      skipped += 1;
      continue;
    }

    const props = {
      highway,
      name: name || undefined,
      ref: el.tags?.ref || undefined,
      oneway: el.tags?.oneway === 'yes' ? 'yes' : undefined,
      maxspeed: el.tags?.maxspeed || undefined,
      // Cesium GeoJsonDataSource 样式属性
      stroke: style.color,
      'stroke-width': style.width
    };
    // 去掉 undefined 属性，保持文件精简
    Object.keys(props).forEach(k => props[k] === undefined && delete props[k]);

    features.push({
      type: 'Feature',
      properties: props,
      geometry: {
        type: 'LineString',
        coordinates: el.geometry.map(g => [g.lon, g.lat])
      }
    });
  }

  return { features, skipped };
}

async function main() {
  console.log(`[下载] 边界 ${BBOX}（南港—淡水走廊）`);
  const overpassJson = await fetchOverpass(buildQuery(BBOX));

  const { features, skipped } = toGeoJson(overpassJson);
  const geojson = {
    type: 'FeatureCollection',
    name: '台北北部路网（OSM Overpass）',
    features
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(geojson), 'utf8');

  const bytes = Buffer.byteLength(JSON.stringify(geojson), 'utf8');
  const mb = (bytes / 1024 / 1024).toFixed(2);
  const count = {};
  features.forEach(f => {
    count[f.properties.highway] = (count[f.properties.highway] ?? 0) + 1;
  });

  console.log(`[完成] 输出：${OUT}`);
  console.log(`      要素 ${features.length} 条（跳过 ${skipped}），文件 ${mb} MB`);
  console.log(
    '      道路分布：',
    Object.entries(count)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ')
  );
  console.log('\n[注册] 在"数据中心-数据服务"新增：');
  console.log('      分类=矢量 | 类型=geojson | 来源=内部服务 | 名称=台北北部路网');
  console.log(`      URL=/data/taipei-roads.geojson（需将文件放入前端 public/data/ 或由后端静态托管）`);
}

main().catch(err => {
  console.error(`[失败] ${err.message}`);
  process.exit(1);
});
