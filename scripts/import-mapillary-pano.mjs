/**
 * 从 Mapillary 导入真实街景全景图到本地街景目录
 *
 * 为什么是 Mapillary：它的街景影像以 **CC BY-SA 4.0** 提供，官方 Graph API 明确允许检索与下载，
 * 是"真实 360 全景 + 可合法使用"的组合；谷歌街景没有等价的合规批量下载途径
 * （官方静态图接口上限 640×640 且非全景；第三方抓取违反其服务条款）。
 *
 * 用法：
 *   $env:MAPILLARY_TOKEN="MLY|xxxx"; node scripts/import-mapillary-pano.mjs --limit 3
 *   自定义区域：node scripts/import-mapillary-pano.mjs --dir kaohsiung --name 高雄街景 --bbox 120.29,22.60,120.32,22.64 --limit 3
 *
 * 关于代理：Node 的 fetch 不读系统代理，而 Mapillary 在国内通常需要代理。
 * 因此本脚本用系统自带的 curl 发请求，并按以下顺序取代理：
 *   1) --proxy 参数；2) MAPILLARY_PROXY / HTTPS_PROXY 环境变量；3) Windows 系统代理设置。
 *
 * 图像来源需署名：© Mapillary contributors (CC BY-SA 4.0)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GRAPH = 'https://graph.mapillary.com';
const TOKEN = process.env.MAPILLARY_TOKEN;

const argv = process.argv.slice(2);
function option(name, fallback) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
}

const PER_CITY = Number(option('limit', '3'));

/** 默认两个城市：取市区一小块 bbox，避免一次拉太多 */
const DEFAULT_CITIES = [
  { dir: 'taipei', name: '台北市街景（Mapillary）', bbox: [121.556, 25.03, 121.578, 25.046] },
  { dir: 'newtaipei', name: '新北市街景（Mapillary）', bbox: [121.45, 25.004, 121.47, 25.018] }
];

function resolveCities() {
  const dir = option('dir', '');
  const bbox = option('bbox', '');
  if (!dir || !bbox) return DEFAULT_CITIES;
  const values = bbox.split(',').map(Number);
  if (values.length !== 4 || values.some(value => !Number.isFinite(value))) {
    throw new Error('--bbox 需要 4 个数字：minLon,minLat,maxLon,maxLat');
  }
  return [{ dir, name: option('name', `${dir} 街景（Mapillary）`), bbox: values }];
}

/** 代理探测：显式参数 > 环境变量 > Windows 系统代理 */
function resolveProxy() {
  const explicit = option(
    'proxy',
    process.env.MAPILLARY_PROXY || process.env.HTTPS_PROXY || process.env.https_proxy || ''
  );
  if (explicit) return explicit;
  if (process.platform !== 'win32') return '';
  try {
    const output = execFileSync(
      'reg',
      ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings', '/v', 'ProxyServer'],
      { encoding: 'utf8' }
    );
    const match = output.match(/ProxyServer\s+REG_SZ\s+(\S+)/);
    if (!match) return '';
    return match[1].includes('://') ? match[1] : `http://${match[1]}`;
  } catch {
    return '';
  }
}

const PROXY = resolveProxy();
const CURL_BASE = ['-s', '-L', '-m', '120', '-A', 'geo-llm-streetview-import/1.0'];
if (PROXY) CURL_BASE.push('-x', PROXY);

function curlJson(url) {
  const output = execFileSync('curl', [...CURL_BASE, url], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return JSON.parse(output);
}

/**
 * 下载到文件。
 *
 * 图像走的是 CDN（Mapillary 的 2048 缩略图落在 Facebook CDN 上），节点抖动很常见：
 * curl 会直接以非 0 退出码失败（不是 HTTP 错误码）。因此这里捕获异常并重试，
 * 且**绝不向上抛**——单张图失败不该让整批导入中断、连带 manifest 都写不出来。
 */
function curlDownload(url, file) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const output = execFileSync('curl', [...CURL_BASE, '-o', file, '-w', '%{http_code} %{content_type}', url], {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024
      }).trim();
      const [statusText, contentType = ''] = output.split(' ');
      const status = Number(statusText);
      if (status >= 200 && status < 300) return { ok: true, status, contentType };
      // 4xx 重试也没用（多为鉴权/参数问题），只有 5xx 才值得重试
      if (status < 500) return { ok: false, status, contentType };
    } catch {
      // 网络层错误（CDN 抖动/超时/SSL）：继续重试
    }
  }
  return { ok: false, status: -1, contentType: '' };
}

/** 检索区域内的 360 全景图 */
function searchPanoramas(bbox, limit) {
  const url =
    `${GRAPH}/images?access_token=${encodeURIComponent(TOKEN)}` +
    `&fields=id,is_pano,captured_at,computed_geometry,thumb_2048_url` +
    `&bbox=${bbox.join(',')}&is_pano=true&limit=${limit}`;
  const payload = curlJson(url);
  return Array.isArray(payload?.data) ? payload.data : [];
}

/**
 * 候选下载地址。
 *
 * 默认取 `thumb_2048_url`（2048×1024，约几百 KB）：全景浏览够用、加载快、目录体积可控；
 * 加 `--original` 才优先拉原图端点（动辄 8K／十几 MB，二十张就是几百 MB）。
 * 统一走 curl（带代理），因为 Node 的 fetch 不读系统代理。
 */
function imageUrlsOf(image) {
  const original = `${GRAPH}/${image.id}/image?access_token=${encodeURIComponent(TOKEN)}`;
  const thumb = image.thumb_2048_url;
  return argv.includes('--original') ? [original, thumb] : [thumb, original];
}

async function importCity(city) {
  console.log(`\n== ${city.name} ==`);
  const images = searchPanoramas(city.bbox, PER_CITY);
  if (images.length === 0) {
    console.warn('该区域没有检索到 360 全景图：换 bbox 或换城市重试');
    return 0;
  }

  const panoDir = join(ROOT, 'public', 'data', 'streetview', city.dir, 'pano');
  mkdirSync(panoDir, { recursive: true });

  const points = [];
  /** manifest 模板用的扩展名：取第一张的实际格式，避免"模板写 jpg、文件却是 png" */
  let templateExtension = null;

  for (const image of images) {
    const coordinates = image?.computed_geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      console.warn(`跳过 ${image.id}：缺少坐标`);
      continue;
    }
    const geoid = image.id;
    // 已存在的直接计入：上一轮跑到一半中断时，避免重复下载几百 MB
    const cached = [join(panoDir, `${geoid}.jpg`), join(panoDir, `${geoid}.png`)].find(existsSync);
    if (cached) {
      const cachedExtension = cached.endsWith('.png') ? 'png' : 'jpg';
      if (templateExtension === null) templateExtension = cachedExtension;
      points.push({ geoid, lon: coordinates[0], lat: coordinates[1] });
      console.log(`  = ${geoid} 已存在，跳过下载`);
      continue;
    }

    // 先落临时文件，按真实格式再定名（curl -L 已跟随 CDN 重定向）
    const tempPath = join(panoDir, `${geoid}.tmp`);
    let result = { ok: false, status: 0, contentType: '' };
    for (const url of imageUrlsOf(image)) {
      if (!url) continue;
      result = curlDownload(url, tempPath);
      if (result.ok) break;
    }
    if (!result.ok) {
      rmSync(tempPath, { force: true });
      console.warn(`✗ ${geoid} 下载失败：HTTP ${result.status}`);
      continue;
    }

    const extension = result.contentType.includes('png') ? 'png' : 'jpg';
    const finalPath = join(panoDir, `${geoid}.${extension}`);
    renameSync(tempPath, finalPath);
    if (templateExtension === null) templateExtension = extension;

    points.push({ geoid, lon: coordinates[0], lat: coordinates[1] });
    const sizeKb = (statSync(finalPath).size / 1024).toFixed(0);
    console.log(`✓ ${geoid}  ${coordinates[0].toFixed(5)}, ${coordinates[1].toFixed(5)}  ${sizeKb} KB`);
  }

  if (points.length === 0) return 0;

  writeFileSync(
    join(ROOT, 'public', 'data', 'streetview', city.dir, 'manifest.json'),
    `${JSON.stringify({ name: city.name, imageTemplate: `pano/{geoid}.${templateExtension}`, points }, null, 2)}\n`
  );
  console.log(`manifest 已更新：${points.length} 个点位（模板 pano/{geoid}.${templateExtension}）`);
  return points.length;
}

// 先报告代理（无 token 时也能据此判断链路是否就绪）
console.log(PROXY ? `使用代理：${PROXY}` : '未检测到代理（若访问失败，可用 --proxy http://host:port 指定）');

if (!TOKEN) {
  console.error('缺少 MAPILLARY_TOKEN。到 https://www.mapillary.com/dashboard/developers 免费创建应用即可拿到。');
  process.exit(1);
}

let total = 0;
for (const city of resolveCities()) {
  try {
    total += await importCity(city);
  } catch (e) {
    console.warn(`${city.name} 导入失败：${e instanceof Error ? e.message : e}`);
  }
}

console.log(`\n共导入 ${total} 个街景点。使用需署名：© Mapillary contributors (CC BY-SA 4.0)`);
