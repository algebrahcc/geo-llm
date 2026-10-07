/**
 * 街景数据来源的公共契约、解析工具与工厂。
 *
 * 为什么要先抽象「来源」：街景的两套取数方式必须共用同一份交互——
 * 球上撒点、点击拾取、沿道路前进后退、全景浮窗、帧率监测都只写一遍。
 *  - **remote**：另外系统提供的街景服务（`/api/query/geojson/points`、`/api/nearest/point`、`/api/image`）；
 *  - **local** ：前端 `public/data` 下的静态目录（`manifest.json` 或 `points.geojson` + `pano/{geoid}.jpg`），
 *              用于演示、离线环境与尚未接入真实服务时的谷歌街景 demo 数据。
 *
 * 来源判定口径与 `resolveServiceUrl` 完全一致：`origin=external` 或 url 以 `http(s)` 开头 → remote，
 * 相对路径 → local（前端静态资源）。这样后端 `data_service` 无需新增类型或字段。
 */

/** 街景点：经纬度 + 全景图标识 */
export interface StreetViewPoint {
  lon: number;
  lat: number;
  /** 全景图标识：远程由 nearest 接口给出，本地即图片文件名（无属性时用序号占位） */
  geoid: string;
}

/** 由坐标解析出的全景图 */
export interface StreetViewImage {
  imageUrl: string;
  geoid: string;
}

export type StreetViewSourceKind = 'remote' | 'local';

/** 街景数据来源：两种来源对上层完全同构 */
export interface StreetViewSource {
  readonly kind: StreetViewSourceKind;
  /** 来源描述（提示语与自检弹窗展示用） */
  readonly label: string;
  /** 拉取全部街景点 */
  fetchPoints(): Promise<StreetViewPoint[]>;
  /** 由坐标取最近街景点的全景图 */
  resolveImage(lon: number, lat: number): Promise<StreetViewImage>;
  /**
   * 可直接推出全景图地址时返回。
   *
   * 本地目录按模板拼即可（胶片条要一次性列出整条路线的缩略图）；
   * 远程服务必须先由坐标问 nearest 才知道 geoid，无法枚举，故不实现。
   */
  imageUrlOf?(point: StreetViewPoint): string | null;
}

/** 失败分类：提示语要能指向「去改什么」，而不是笼统的「加载失败」 */
export type StreetViewErrorKind = 'no-rid' | 'unreachable' | 'http' | 'bad-data' | 'no-points' | 'no-nearest';

export class StreetViewError extends Error {
  readonly kind: StreetViewErrorKind;

  constructor(kind: StreetViewErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = 'StreetViewError';
  }
}

/** 点击就近取点的默认容差（米），对齐既有「100m 内才弹全景」的交互约定 */
export const NEAREST_MAX_METERS = 100;

/** 本地街景目录的默认约定 */
export const LOCAL_MANIFEST_FILE = 'manifest.json';
export const LOCAL_POINTS_FILE = 'points.geojson';
export const LOCAL_IMAGE_TEMPLATE = 'pano/{geoid}.jpg';

/** 数据服务条目上的街景参数（params 字段） */
export interface StreetViewParams {
  /** 远程区域 ID */
  rid: string;
  /** 远程全景图级别 */
  level: string;
  /** 本地点位文件名（相对数据目录） */
  pointsFile: string;
  /** 本地全景图路径模板，支持 {geoid} */
  imageTemplate: string;
  /** 道路顺序推导的相邻点最大间距（米），留空用默认值 */
  maxStepMeters: string;
}

export function parseStreetViewParams(raw?: string): StreetViewParams {
  const parsed = safeParseJson<Record<string, unknown>>(raw) ?? {};
  const read = (key: string): string => {
    const value = parsed[key];
    return value === undefined || value === null ? '' : String(value);
  };
  return {
    rid: read('rid'),
    level: read('level') || '4',
    pointsFile: read('pointsFile') || LOCAL_POINTS_FILE,
    imageTemplate: read('imageTemplate') || LOCAL_IMAGE_TEMPLATE,
    maxStepMeters: read('maxStepMeters')
  };
}

/** 是否本地静态目录来源（与 resolveServiceUrl 的分支口径一致） */
export function isLocalStreetViewSource(item: Pick<Api.DataService.DataServiceItem, 'origin' | 'url'>): boolean {
  return item.origin !== 'external' && !/^https?:\/\//i.test(item.url || '');
}

// ─── HTTP 与解析工具（球上加载与数据服务自检共用）─────────────────

export function safeParseJson<T>(raw?: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * 取 JSON。
 *
 * 失败必须分类：`fetch` 抛错既可能是服务没起，也可能是跨域被拦——这两件事
 * 的处置方式完全不同（一个去启动服务，一个去加 CORS 头），所以提示要合并写清。
 */
export async function fetchJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new StreetViewError('unreachable', `无法访问街景数据：${url}（服务未启动或未允许跨域 CORS）`);
  }
  if (!response.ok) {
    throw new StreetViewError('http', `街景数据请求失败：HTTP ${response.status}（${url}）`);
  }
  try {
    return await response.json();
  } catch {
    throw new StreetViewError('bad-data', `街景数据不是合法 JSON：${url}`);
  }
}

/** 取 JSON 并重试一次（网络抖动时不再让用户手动重点） */
export async function fetchJsonWithRetry(url: string): Promise<unknown> {
  try {
    return await fetchJson(url);
  } catch {
    return fetchJson(url);
  }
}

/** 取 JSON，404 视为「该文件不存在」返回 null（本地目录探测用） */
export async function tryFetchJson(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url);
    if (response.status === 404) return null;
    if (!response.ok) throw new StreetViewError('http', `街景数据请求失败：HTTP ${response.status}（${url}）`);
    return await response.json();
  } catch (error) {
    if (error instanceof StreetViewError) throw error;
    throw new StreetViewError('unreachable', `无法访问街景数据：${url}（服务未启动或未允许跨域 CORS）`);
  }
}

/** 从远程响应里取出 GeoJSON（兼容 `{data: "<geojson 字符串>"}` 与直接返回对象） */
export function extractGeoJsonPayload(payload: unknown): unknown {
  const record = payload as Record<string, unknown> | null;
  const data = record?.data;
  if (typeof data === 'string') {
    return safeParseJson(data) ?? null;
  }
  return data ?? payload;
}

/** 递归提取 [lon, lat] 坐标（支持 FeatureCollection / Feature / Point / MultiPoint / 裸坐标数组） */
export function extractStreetPointCoordinates(geojson: unknown): Array<[number, number]> {
  const result: Array<[number, number]> = [];
  const push = (coords: unknown): void => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === 'number') {
      if (coords.length >= 2) result.push([Number(coords[0]), Number(coords[1])]);
      return;
    }
    coords.forEach(push);
  };

  const g = geojson as
    | {
        type?: string;
        coordinates?: unknown;
        geometry?: { coordinates?: unknown };
        features?: Array<{ geometry?: { coordinates?: unknown } }>;
      }
    | undefined;
  if (!g || typeof g !== 'object') return result;

  if (g.type === 'FeatureCollection') {
    g.features?.forEach(f => push(f?.geometry?.coordinates));
    return result;
  }
  if (g.type === 'Feature') {
    push(g.geometry?.coordinates);
    return result;
  }
  push(g.coordinates ?? (Array.isArray(geojson) ? geojson : undefined));
  return result;
}

/**
 * 从 GeoJSON 提取带标识的街景点（本地数据用）。
 *
 * 标识优先取 `properties.geoid`，其次 `properties.id / properties.name`；
 * 都没有时用序号占位（`p-0001`），保证「点位 → 图片名」始终可推算。
 */
export function extractStreetPointsFromGeoJson(geojson: unknown): StreetViewPoint[] {
  const g = geojson as
    | {
        type?: string;
        features?: Array<{
          properties?: Record<string, unknown>;
          geometry?: { type?: string; coordinates?: unknown };
        }>;
      }
    | undefined;
  if (!g || g.type !== 'FeatureCollection' || !Array.isArray(g.features)) return [];

  const points: StreetViewPoint[] = [];
  g.features.forEach((feature, index) => {
    const coordinates = feature?.geometry?.coordinates;
    if (!Array.isArray(coordinates) || typeof coordinates[0] !== 'number') return;
    const props = feature.properties ?? {};
    const rawId = props.geoid ?? props.id ?? props.name;
    const geoid =
      rawId === undefined || rawId === null || String(rawId).trim() === ''
        ? `p-${String(index + 1).padStart(4, '0')}`
        : String(rawId);
    points.push({ lon: Number(coordinates[0]), lat: Number(coordinates[1]), geoid });
  });
  return points;
}

/** 从 nearest 接口返回中提取 geoid（兼容 `{geoid}` / `{data:{geoid}}` / `{data:"geoid"}`） */
export function extractGeoid(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const obj = payload as Record<string, unknown>;
  if (typeof obj.geoid === 'string') return obj.geoid;
  if (obj.data && typeof obj.data === 'object') {
    const data = obj.data as Record<string, unknown>;
    if (typeof data.geoid === 'string') return data.geoid;
  }
  if (typeof obj.data === 'string') return obj.data;
  return undefined;
}

/** 本地 manifest.json 结构（可选文件；存在时优先于 points.geojson） */
export interface LocalStreetViewManifest {
  name?: string;
  imageTemplate?: string;
  points?: Array<{ geoid?: string; lon?: number; lat?: number }>;
}

/** 解析本地 manifest.json；缺失字段用目录默认约定补齐 */
export function parseLocalManifest(
  payload: unknown,
  fallbackTemplate: string = LOCAL_IMAGE_TEMPLATE
): { points: StreetViewPoint[]; imageTemplate: string } {
  const manifest = (payload ?? {}) as LocalStreetViewManifest;
  const template = manifest.imageTemplate?.trim() || fallbackTemplate;
  const points: StreetViewPoint[] = [];
  (manifest.points ?? []).forEach((point, index) => {
    const lon = Number(point?.lon);
    const lat = Number(point?.lat);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    const geoid =
      point?.geoid === undefined || String(point.geoid).trim() === ''
        ? `p-${String(index + 1).padStart(4, '0')}`
        : String(point.geoid);
    points.push({ lon, lat, geoid });
  });
  return { points, imageTemplate: template };
}

/** 由模板与 geoid 拼接本地全景图地址（模板不含 `{geoid}` 时按「目录 + geoid」处理） */
export function buildLocalImageUrl(dir: string, template: string, geoid: string): string {
  const base = dir.replace(/\/+$/, '');
  const encoded = encodeURIComponent(geoid);
  if (template.includes('{geoid}')) {
    return `${base}/${template.split('{geoid}').join(encoded)}`;
  }
  const trimmed = template.replace(/\/+$/, '');
  return trimmed ? `${base}/${trimmed}/${encoded}` : `${base}/${encoded}`;
}
