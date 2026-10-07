/**
 * 本地街景数据源：前端 `public/data` 下的静态目录
 *
 * 为什么要有这条路径：真实街景服务（另外系统）接入之前，演示与离线环境需要一份
 * 「能跑起来、能验收」的街景数据；谷歌街景 demo 数据下载后直接丢进 public 即可，
 * 无需改代码、无需动后端。
 *
 * 目录约定：
 *   public/data/streetview/<城市>/
 *     ├── manifest.json      # 可选，优先读取：{ imageTemplate, points: [{ geoid, lon, lat }] }
 *     ├── points.geojson     # 无 manifest 时的点位文件（properties.geoid 作为图片标识）
 *     └── pano/<geoid>.jpg   # 2:1 等距柱状全景图
 *
 * 与远程源唯一的能力差：没有 nearest 接口，就近取图靠本地网格索引（point-index）。
 */
import { createPointIndex, type PointIndex } from './point-index';
import {
  LOCAL_MANIFEST_FILE,
  NEAREST_MAX_METERS,
  StreetViewError,
  buildLocalImageUrl,
  extractStreetPointsFromGeoJson,
  parseLocalManifest,
  tryFetchJson,
  type StreetViewImage,
  type StreetViewPoint,
  type StreetViewSource
} from './service-api';

export interface LocalStreetViewOptions {
  /** 数据目录地址（相对 public，已拼 BASE_URL） */
  baseUrl: string;
  /** 点位文件名（相对数据目录） */
  pointsFile: string;
  /** 全景图路径模板，支持 {geoid} */
  imageTemplate: string;
  /** 来源描述（提示语用） */
  label: string;
}

export function createLocalStreetViewSource(options: LocalStreetViewOptions): StreetViewSource {
  const dir = options.baseUrl.replace(/\/+$/, '');
  let points: StreetViewPoint[] | null = null;
  let index: PointIndex | null = null;
  let template = options.imageTemplate;

  async function loadPoints(): Promise<StreetViewPoint[]> {
    const manifest = await tryFetchJson(`${dir}/${LOCAL_MANIFEST_FILE}`);
    let loaded: StreetViewPoint[];

    if (manifest) {
      const parsed = parseLocalManifest(manifest, template);
      template = parsed.imageTemplate;
      loaded = parsed.points;
    } else {
      const geojson = await tryFetchJson(`${dir}/${options.pointsFile}`);
      if (!geojson) {
        throw new StreetViewError(
          'unreachable',
          `本地街景目录不可访问：${dir}（缺少 ${LOCAL_MANIFEST_FILE} 与 ${options.pointsFile}）`
        );
      }
      loaded = extractStreetPointsFromGeoJson(geojson);
    }

    if (loaded.length === 0) {
      throw new StreetViewError('no-points', `本地街景目录 ${dir} 中没有街景点`);
    }

    points = loaded;
    index = createPointIndex(loaded.map(point => [point.lon, point.lat]));
    return loaded;
  }

  async function fetchPoints(): Promise<StreetViewPoint[]> {
    if (points) return points;
    return loadPoints();
  }

  async function resolveImage(lon: number, lat: number): Promise<StreetViewImage> {
    const list = await fetchPoints();
    const hit = index ? index.findNearest(lon, lat, NEAREST_MAX_METERS) : -1;
    if (hit < 0) {
      throw new StreetViewError('no-nearest', '该位置附近没有街景点');
    }
    const point = list[hit];
    return { geoid: point.geoid, imageUrl: buildLocalImageUrl(dir, template, point.geoid) };
  }

  return {
    kind: 'local',
    label: options.label,
    fetchPoints,
    resolveImage,
    // 本地图片名 = 点位标识 + 路径模板，无需请求即可推出地址（胶片条依赖这一点）
    imageUrlOf: (point: StreetViewPoint) => buildLocalImageUrl(dir, template, point.geoid)
  };
}
