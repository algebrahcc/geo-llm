/**
 * 从百度地图「全景静态图 API」导入真实街景全景到本地街景目录
 *
 * 为什么可行：官方文档明确 `fov=360` 可返回**整幅全景图**，而尺寸上限为 width≤4096、height≤512，
 * 因此 `width=1024&height=512` 恰好得到 **2:1 等距柱状**图片，可直接喂给系统的全景浏览器；
 * 且支持 `coordtype=wgs84ll`，我们手上的 GPS 经纬度不用换算。接口免费，每 AK 每天 10 万次。
 *
 * 点位从哪来：百度是按坐标取"最近的全景"，所以需要一份**沿道路**的点位清单。
 * 这里用 OpenStreetMap 的 Overpass 取指定 bbox 内的道路几何，再按间距等距采样。
 *
 * 用法：
 *   node scripts/import-baidu-pano.mjs --ak <百度AK> --dir beijing --name "北京街景" \
 *        --bbox 116.370,39.900,116.410,39.920 --spacing 25 --limit 6
 *
 * 合规提示：百度官方文档未明确说明返回图片能否存储/二次分发，正式交付前请向百度确认
 * （mapapi@baidu.com）。本脚本用于原型演示，请勿二次分发所得影像。
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const BAIDU = 'http://api.map.baidu.com/panorama/v2';

const argv = process.argv.slice(2);
function option(name, fallback) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
}

const AK = option('ak', process.env.BAIDU_AK ?? '');
const DIR = option('dir', 'beijing');
const NAME = option('name', `${DIR} 街景（百度）`);
const BBOX = option('bbox', '116.370,39.900,116.410,39.920');
const SPACING = Number(option('spacing', '25'));
const LIMIT = Number(option('limit', '6'));
const WIDTH = Number(option('width', '1024'));
const HEIGHT = Number(option('height', '512'));
const ROADS = option('roads', 'primary,secondary').split(',').filter(Boolean);
/** 沿道路取点的首选方式：OSRM 路线（形如 "lon,lat;lon,lat"）。留空则退回 Overpass 道路查询。 */
const ROUTE = option('route', '');
const PROXY = option('proxy', process.env.HTTPS_PROXY ?? '');

const CURL_BASE = ['-s', '-L', '-m', '90', '-A', 'geo-llm-streetview-import/1.0'];
if (PROXY) CURL_BASE.push('-x', PROXY);

/** 本脚本参数用 minLon,minLat,maxLon,maxLat；Overpass 要求 south,west,north,east（纬度在前） */
const [MIN_LON, MIN_LAT, MAX_LON, MAX_LAT] = BBOX.split(',').map(Number);
if ([MIN_LON, MIN_LAT, MAX_LON, MAX_LAT].some(value => !Number.isFinite(value))) {
  console.error('--bbox 需要 4 个数字：minLon,minLat,maxLon,maxLat');
  process.exit(1);
}
const OVERPASS_BBOX = `${MIN_LAT},${MIN_LON},${MAX_LAT},${MAX_LON}`;

/** 经纬度近似距离（米）：与前端 streetview/geo.ts 同口径 */
function distanceMeters(aLon, aLat, bLon, bLat) {
  const midLat = ((aLat + bLat) / 2) * (Math.PI / 180);
  const dx = (bLon - aLon) * 111320 * Math.cos(midLat);
  const dy = (bLat - aLat) * 110540;
  return Math.hypot(dx, dy);
}

/**
 * 用 OSRM 取一条沿道路的折线。
 *
 * 为什么优先 OSRM 而不是 Overpass：Overpass 的主实例（overpass-api.de）常年"太忙"直接返回错误，
 * 而 OSRM 只按起终点算路线，稳定得多；本项目其它脚本也已在用它。
 */
function fetchRouteGeometry(route) {
  const url = `https://router.project-osrm.org/route/v1/driving/${route}?overview=full&geometries=geojson&steps=false`;
  const output = execFileSync('curl', [...CURL_BASE, url], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const payload = JSON.parse(output);
  const coordinates = payload?.routes?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    throw new Error(`OSRM 未返回路线几何：${payload?.message ?? payload?.code ?? '未知原因'}`);
  }
  return coordinates;
}

/** 取 bbox 内某类道路的几何（每次只查一个 highway 值：正则里的 | 会让 Overpass 返回 400） */
function fetchRoadGeometry(highway) {
  const query = `[out:json][timeout:60];way["highway"="${highway}"](${OVERPASS_BBOX});out geom;`;
  const output = execFileSync('curl', [...CURL_BASE, '--data-urlencode', `data=${query}`, OVERPASS], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  const payload = JSON.parse(output);
  return (payload.elements ?? []).map(element => (element.geometry ?? []).map(point => [point.lon, point.lat]));
}

/** 沿折线按固定间距采样（每条道路独立采样，避免跨路跳跃） */
function sampleAlong(points, spacing) {
  const result = [];
  let nextAt = 0;
  let travelled = 0;
  for (let i = 1; i < points.length; i += 1) {
    const [aLon, aLat] = points[i - 1];
    const [bLon, bLat] = points[i];
    const segment = distanceMeters(aLon, aLat, bLon, bLat);
    if (segment <= 0) continue;
    while (nextAt <= travelled + segment) {
      const ratio = (nextAt - travelled) / segment;
      result.push([aLon + (bLon - aLon) * ratio, aLat + (bLat - aLat) * ratio]);
      nextAt += spacing;
    }
    travelled += segment;
  }
  return result;
}

/**
 * 取一张全景图。
 *
 * 注意：百度在参数/权限有问题时也返回 HTTP 200，只是响应体是 JSON 错误说明（content-type 为 text/html），
 * 所以不能只看状态码，必须看是不是图片；失败时把 JSON 里的 message 读出来，便于区分
 * 「AK 有误」和「该点没有 panoid」这两类完全不同的问题。
 */
function fetchPanorama(lon, lat, file) {
  const url =
    `${BAIDU}?ak=${encodeURIComponent(AK)}&width=${WIDTH}&height=${HEIGHT}` +
    `&location=${lon},${lat}&fov=360&coordtype=wgs84ll`;
  const output = execFileSync('curl', [...CURL_BASE, '-o', file, '-w', '%{http_code} %{content_type}', url], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024
  }).trim();
  const [statusText, contentType = ''] = output.split(' ');
  const status = Number(statusText);

  if (status === 200 && contentType.startsWith('image/')) {
    return { ok: true, status, message: '' };
  }

  let message = '';
  try {
    message = readFileSync(file, 'utf8').slice(0, 200).replace(/\s+/g, ' ');
  } catch {
    message = '（无法读取响应体）';
  }
  return { ok: false, status, message };
}

if (!AK) {
  console.error('缺少百度 AK：用 --ak <AK> 或设置 BAIDU_AK 环境变量（https://lbsyun.baidu.com 免费申请）');
  process.exit(1);
}

console.log(`百度全景导入：${NAME}`);
console.log(`bbox=${BBOX} 间距=${SPACING}m 上限=${LIMIT} 张 尺寸=${WIDTH}x${HEIGHT} 道路=${ROADS.join('/')}`);
if (PROXY) console.log(`使用代理：${PROXY}`);

// 1) 采集沿路点位：优先 OSRM 路线（稳定），其次 Overpass 道路查询
const points = [];
if (ROUTE) {
  const geometry = fetchRouteGeometry(ROUTE);
  sampleAlong(geometry, SPACING).forEach(point => points.push(point));
  console.log(`  OSRM 路线：几何点 ${geometry.length} 个 → 采样出 ${points.length} 个候选点位`);
} else {
  for (const highway of ROADS) {
    const geometries = fetchRoadGeometry(highway);
    geometries.forEach(geometry => {
      sampleAlong(geometry, SPACING).forEach(point => points.push(point));
    });
    console.log(`  道路类型 ${highway}：${geometries.length} 条，累计候选点位 ${points.length}`);
  }
}
if (points.length === 0) {
  console.error('没有取到沿路点位：换 --route / --bbox，或换 --roads 类型');
  process.exit(1);
}

// 2) 逐个取全景（点数按 --limit 截断，小批量试跑）
const panoDir = join(ROOT, 'public', 'data', 'streetview', DIR, 'pano');
mkdirSync(panoDir, { recursive: true });

const imported = [];
let index = 0;
for (const [lon, lat] of points) {
  // 上限按「尝试次数」计：点位未必都有街景，若按成功数计，一个无覆盖的城市会一路试完全部候选点
  if (index >= LIMIT) break;
  index += 1;
  const geoid = `bd-${String(index).padStart(4, '0')}`;
  const file = join(panoDir, `${geoid}.jpg`);
  const result = fetchPanorama(lon, lat, file);
  if (!result.ok) {
    // 失败时百度返回的是 JSON 错误体，别把这种文件当成全景图留在目录里
    rmSync(file, { force: true });
    console.log(`  ✗ ${geoid}（${lon.toFixed(5)}, ${lat.toFixed(5)}）：${result.message}`);
    continue;
  }
  const sizeKb = (statSync(file).size / 1024).toFixed(0);
  console.log(`  ✓ ${geoid}  ${lon.toFixed(5)}, ${lat.toFixed(5)}  ${sizeKb} KB`);
  imported.push({ geoid, lon, lat });
}

if (imported.length === 0) {
  console.error('没有取到任何全景图：检查 AK 是否有效、该区域是否有街景覆盖（台湾/港澳基本无覆盖）');
  process.exit(1);
}

writeFileSync(
  join(ROOT, 'public', 'data', 'streetview', DIR, 'manifest.json'),
  `${JSON.stringify({ name: NAME, imageTemplate: 'pano/{geoid}.jpg', points: imported }, null, 2)}\n`
);
console.log(`\n完成：${imported.length} 张全景，manifest 已写入 public/data/streetview/${DIR}/manifest.json`);
console.log('提示：百度文档未明确授予图片存储/分发权，仅建议用于原型演示。');
