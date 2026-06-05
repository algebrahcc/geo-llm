/**
 * Cesium 高程（地形）配置工具
 *
 * 从 public/config.json 的 TERRAIN 配置中读取高程服务参数，
 * 提供给 use-cesium-base composable 在 Viewer 初始化时加载地形。
 *
 * 部署后可直接修改 dist/config.json 开关高程或切换服务地址，无需重新打包。
 */
import { CesiumTerrainProvider } from 'cesium';
import type { TerrainConfig } from '@/typings/global';

/** 默认地形配置 */
const DEFAULT_TERRAIN: TerrainConfig = {
  enabled: false,
  url: '',
  requestVertexNormals: false,
  requestWaterMask: false
};

/**
 * 获取运行时地形配置
 */
export function getTerrainConfig(): TerrainConfig {
  // eslint-disable-next-line no-underscore-dangle
  const config = window.__APP_CONFIG__?.TERRAIN;
  return config ? { ...DEFAULT_TERRAIN, ...config } : DEFAULT_TERRAIN;
}

/**
 * 根据配置创建地形 Provider
 *
 * @returns 如果启用且 url 有效，返回 CesiumTerrainProvider；否则返回 null
 */
export async function createTerrainProvider(): Promise<CesiumTerrainProvider | null> {
  const config = getTerrainConfig();
  if (!config.enabled || !config.url) return null;

  try {
    const provider = await CesiumTerrainProvider.fromUrl(config.url, {
      requestVertexNormals: config.requestVertexNormals,
      requestWaterMask: config.requestWaterMask
    });
    return provider;
  } catch (error) {
    console.warn('[Terrain] 高程服务加载失败，将不使用地形数据:', error);
    return null;
  }
}
