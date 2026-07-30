/**
 * OpenLayers 底图配置工具
 *
 * 从 public/config.json 的 BASEMAP 配置中读取底图模式与参数，
 * 提供给矢量地图组件使用。
 *
 * 部署后可直接修改 dist/config.json 切换本地/在线/无底图，无需重新打包。
 */
import type { OLBasemapConfig } from '@/typings/global';

/** 默认底图配置（无底图） */
const DEFAULT_BASEMAP: OLBasemapConfig = {
  mode: 'none',
  local: { url: '', maxZoom: 18 },
  online: { url: '', maxZoom: 18 }
};

/**
 * 获取运行时底图配置
 *
 * 优先使用 window.__APP_CONFIG__.BASEMAP，
 * 不可用时回退到无底图。
 */
export function getBasemapConfig(): OLBasemapConfig {
  // eslint-disable-next-line no-underscore-dangle
  const config = window.__APP_CONFIG__?.BASEMAP;
  if (!config) return DEFAULT_BASEMAP;
  return {
    mode: config.mode || DEFAULT_BASEMAP.mode,
    local: { ...DEFAULT_BASEMAP.local, ...config.local },
    online: { ...DEFAULT_BASEMAP.online, ...config.online }
  };
}

/**
 * 获取底图瓦片 URL
 *
 * - local 模式：拼接 BASE_URL + local.url
 * - online 模式：直接使用 online.url
 * - none 模式：返回 null
 */
export function getBasemapUrl(): string | null {
  const config = getBasemapConfig();
  if (config.mode === 'none') return null;
  if (config.mode === 'online') return config.online.url;
  // local
  const url = config.local.url;
  if (!url) return null;
  return `${import.meta.env.BASE_URL}${url}`;
}

/**
 * 获取底图最大缩放级别
 */
export function getBasemapMaxZoom(): number {
  const config = getBasemapConfig();
  if (config.mode === 'online') return config.online.maxZoom;
  if (config.mode === 'local') return config.local.maxZoom;
  return 18;
}

/**
 * 判断当前是否使用在线底图
 */
export function isOnlineBasemap(): boolean {
  return getBasemapConfig().mode === 'online';
}

/**
 * 判断当前是否无底图
 */
export function isNoBasemap(): boolean {
  return getBasemapConfig().mode === 'none';
}
