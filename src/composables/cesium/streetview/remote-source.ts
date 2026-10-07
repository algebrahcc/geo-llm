/**
 * 远程街景数据源：另外系统提供的街景服务（xxfw 约定）
 *
 * 端点只有三个，且**不可扩展**（已确认）：
 *  - `GET /api/query/geojson/points?rid=` → 区域全部街景点坐标（data 为字符串化 GeoJSON）
 *  - `GET /api/nearest/point/{lat}/{lon}?rid=` → 最近街景点的 geoid
 *  - `GET /api/image?level=&geoid=&rid=` → 2:1 等距柱状全景图
 * 因此「前进/后退」只能由前端从坐标集合推导（见 route-order.ts）。
 */
import {
  StreetViewError,
  extractGeoJsonPayload,
  extractGeoid,
  extractStreetPointCoordinates,
  fetchJson,
  fetchJsonWithRetry,
  type StreetViewImage,
  type StreetViewPoint,
  type StreetViewSource
} from './service-api';

const POINTS_PATH = '/api/query/geojson/points';
const NEAREST_PATH = '/api/nearest/point';
const IMAGE_PATH = '/api/image';

export interface RemoteStreetViewOptions {
  /** 服务根地址（不含尾斜杠） */
  baseUrl: string;
  /** 区域 ID */
  rid: string;
  /** 全景图级别（0-6） */
  level: string;
  /** 来源描述（提示语用） */
  label: string;
}

export function createRemoteStreetViewSource(options: RemoteStreetViewOptions): StreetViewSource {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const rid = options.rid;
  if (!rid) {
    throw new StreetViewError('no-rid', '街景服务缺少区域 ID（rid），请在「连接参数」中配置 {"rid":"..."}');
  }

  function buildImageUrl(geoid: string): string {
    const query = `level=${encodeURIComponent(options.level)}&geoid=${encodeURIComponent(geoid)}&rid=${encodeURIComponent(rid)}`;
    return `${baseUrl}${IMAGE_PATH}?${query}`;
  }

  async function fetchPoints(): Promise<StreetViewPoint[]> {
    const payload = await fetchJson(`${baseUrl}${POINTS_PATH}?rid=${encodeURIComponent(rid)}`);
    const coordinates = extractStreetPointCoordinates(extractGeoJsonPayload(payload));
    if (coordinates.length === 0) {
      throw new StreetViewError('no-points', '街景服务未返回街景点坐标（请检查 rid 是否有效）');
    }
    // 远程点位的 geoid 由 nearest 接口按坐标反查，这里不预置
    return coordinates.map(([lon, lat]) => ({ lon, lat, geoid: '' }));
  }

  async function resolveImage(lon: number, lat: number): Promise<StreetViewImage> {
    const url = `${baseUrl}${NEAREST_PATH}/${lat}/${lon}?rid=${encodeURIComponent(rid)}`;
    const payload = await fetchJsonWithRetry(url);
    const geoid = extractGeoid(payload);
    if (!geoid) {
      throw new StreetViewError('no-nearest', '该位置附近没有街景点');
    }
    return { geoid, imageUrl: buildImageUrl(geoid) };
  }

  return { kind: 'remote', label: options.label, fetchPoints, resolveImage };
}
