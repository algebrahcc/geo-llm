/**
 * OpenLayers 底图配置工具
 *
 * 沿用 public/config.json 的 IMAGERY 配置（与 Cesium 影像共用同一份配置），
 * 提供给矢量地图组件生成 OpenLayers XYZ 底图图层。
 *
 * - local 模式：使用 local.globalUrl（拼接 BASE_URL）
 * - online 模式：直接使用 online.url
 *
 * 部署后可直接修改 dist/config.json 切换本地/在线影像，无需重新打包。
 */
import { getImageryConfig } from './imagery';

/**
 * 获取 OpenLayers 底图瓦片 URL
 *
 * 读取 IMAGERY 配置：
 * - local 模式：拼接 BASE_URL + local.globalUrl
 * - online 模式：直接使用 online.url
 */
export function getBasemapUrl(): string | null {
  const config = getImageryConfig();
  if (config.mode === 'online') {
    return config.online.url || null;
  }
  // local
  const url = config.local.globalUrl;
  if (!url) return null;
  return `${import.meta.env.BASE_URL}${url}`;
}

/**
 * 获取 OpenLayers 底图最大缩放级别
 *
 * 读取 IMAGERY 配置：
 * - online 模式：online.maximumLevel
 * - local 模式：local.globalMaxLevel
 */
export function getBasemapMaxZoom(): number {
  const config = getImageryConfig();
  if (config.mode === 'online') return config.online.maximumLevel;
  return config.local.globalMaxLevel;
}
