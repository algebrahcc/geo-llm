/**
 * Cesium 影像配置工具
 *
 * 从 public/config.json 的 IMAGERY 配置中读取影像模式与参数，
 * 提供给各 use-cesium-*.ts composable 使用。
 *
 * 部署后可直接修改 dist/config.json 切换本地/在线影像，无需重新打包。
 */
import { GeographicTilingScheme, Rectangle, UrlTemplateImageryProvider, WebMercatorTilingScheme } from 'cesium';
import type { ImageryConfig, ImageryLocalConfig, ImageryOnlineConfig } from '@/typings/global';

/** 默认本地影像配置（与原硬编码一致） */
const DEFAULT_LOCAL: ImageryLocalConfig = {
  globalUrl: 'google satellite-z0-8.yocMFTJvR/{z}/{x}/{y}.jpg',
  regionUrl: 'taiwan/{z}/{x}/{y}.jpg',
  regionRectangle: [119.9, 21.8, 122.2, 25.5],
  globalMaxLevel: 8,
  regionMaxLevel: 14
};

/** 默认在线影像配置 */
const DEFAULT_ONLINE: ImageryOnlineConfig = {
  url: 'https://tms.example.com/{z}/{x}/{-y}.png',
  tilingScheme: 'WebMercator',
  minimumLevel: 0,
  maximumLevel: 18,
  rectangle: null
};

/** 默认影像整体配置 */
const DEFAULT_IMAGERY: ImageryConfig = {
  mode: 'local',
  local: DEFAULT_LOCAL,
  online: DEFAULT_ONLINE
};

/**
 * 获取运行时影像配置
 *
 * 优先使用 window.__APP_CONFIG__.IMAGERY，
 * 不可用时回退到默认本地离线配置。
 */
export function getImageryConfig(): ImageryConfig {
  // eslint-disable-next-line no-underscore-dangle
  return window.__APP_CONFIG__?.IMAGERY || DEFAULT_IMAGERY;
}

/**
 * 判断当前是否使用在线影像模式
 */
export function isOnlineImagery(): boolean {
  return getImageryConfig().mode === 'online';
}

/**
 * 获取本地影像配置（合并默认值）
 */
export function getLocalImageryConfig(): ImageryLocalConfig {
  const config = getImageryConfig();
  return { ...DEFAULT_LOCAL, ...config.local };
}

/**
 * 获取在线影像配置（合并默认值）
 */
export function getOnlineImageryConfig(): ImageryOnlineConfig {
  const config = getImageryConfig();
  return { ...DEFAULT_ONLINE, ...config.online };
}

/**
 * 获取全局底图完整 URL
 *
 * - local 模式：拼接 BASE_URL + local.globalUrl
 * - online 模式：直接使用 online.url
 */
export function getGlobalImageryUrl(): string {
  if (isOnlineImagery()) {
    return getOnlineImageryConfig().url;
  }
  const local = getLocalImageryConfig();
  return `${import.meta.env.BASE_URL}${local.globalUrl}`;
}

/**
 * 获取区域叠加底图完整 URL（仅 local 模式有效）
 *
 * online 模式返回 null
 */
export function getRegionImageryUrl(): string | null {
  if (isOnlineImagery()) {
    return null;
  }
  const local = getLocalImageryConfig();
  return `${import.meta.env.BASE_URL}${local.regionUrl}`;
}

/**
 * 根据在线配置构建 UrlTemplateImageryProvider 构造参数
 *
 * 处理 tilingScheme 和 rectangle 的映射，
 * 返回可直接传给 `new UrlTemplateImageryProvider()` 的选项对象。
 */
export function getOnlineImageryProviderOptions(): UrlTemplateImageryProvider.ConstructorOptions {
  const online = getOnlineImageryConfig();
  const options: UrlTemplateImageryProvider.ConstructorOptions = {
    url: online.url,
    minimumLevel: online.minimumLevel,
    maximumLevel: online.maximumLevel
  };

  // tilingScheme 映射
  if (online.tilingScheme === 'Geographic') {
    options.tilingScheme = new GeographicTilingScheme();
  } else {
    options.tilingScheme = new WebMercatorTilingScheme();
  }

  // 可选 rectangle 限制
  if (online.rectangle) {
    options.rectangle = Rectangle.fromDegrees(...online.rectangle);
  }

  return options;
}
