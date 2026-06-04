

/** 影像配置 - 本地模式 */
export interface ImageryLocalConfig {
  /** 全局底图瓦片路径（相对于 BASE_URL） */
  globalUrl: string;
  /** 区域叠加瓦片路径（相对于 BASE_URL） */
  regionUrl: string;
  /** 区域叠加范围 [west, south, east, north]（度） */
  regionRectangle: [number, number, number, number];
  /** 全局底图最大层级 */
  globalMaxLevel: number;
  /** 区域叠加最大层级 */
  regionMaxLevel: number;
}

/** 影像配置 - 在线 TMS 模式 */
export interface ImageryOnlineConfig {
  /**
   * TMS 瓦片服务 URL 模板
   *
   * 支持 Cesium 占位符：
   * - {z}/{x}/{y}  — XYZ / Google 瓦片方案（Y 从上到下）
   * - {z}/{x}/{-y}  — TMS 瓦片方案（{-y} 自动翻转 Y，适配 TMS 规范 Y 从下到上）
   * - {s}           — 子域名轮询（需配置 subdomains）
   *
   * TMS 服务示例：
   * - 标准 TMS：https://tms.server.com/{z}/{x}/{-y}.png
   * - XYZ/Google 风格：https://tile.server.com/{z}/{x}/{y}.png
   */
  url: string;
  /**
   * 瓦片方案
   * - 'WebMercator' — EPSG:3857 球面墨卡托（默认，适用于大多数在线瓦片服务）
   * - 'Geographic'  — EPSG:4326 地理坐标系（部分 TMS 服务使用）
   */
  tilingScheme: 'WebMercator' | 'Geographic';
  /** 最小层级 */
  minimumLevel: number;
  /** 最大层级 */
  maximumLevel: number;
  /**
   * 可选，限制瓦片加载范围 [west, south, east, north]（度）
   * 设为 null 表示全球范围
   */
  rectangle: [number, number, number, number] | null;
}

/** 影像配置 */
export interface ImageryConfig {
  /** 模式：'local' 使用本地离线瓦片，'online' 使用在线 TMS 服务 */
  mode: 'local' | 'online';
  /** 本地离线影像配置 */
  local: ImageryLocalConfig;
  /** 在线 TMS 影像配置 */
  online: ImageryOnlineConfig;
}

/** 运行时配置文件结构 (public/config.json) */
export interface AppRuntimeConfig {
  /** 后端服务主 Base URL */
  VITE_SERVICE_BASE_URL: string;
  /** 其他后端服务 Base URL（JSON 对象，如 {"demo": "http://localhost:9529"}） */
  VITE_OTHER_SERVICE_BASE_URL: Record<string, string>;
  /** 远程 3D Tiles 数据源 URL */
  VITE_BUILDING_TILESET_URL: string;
  /** Cesium 影像配置 */
  IMAGERY: ImageryConfig;
}

declare global {
  export interface Window {
    /** NProgress instance */
    NProgress?: import('nprogress').NProgress;
    /** Loading bar instance */
    $loadingBar?: import('naive-ui').LoadingBarProviderInst;
    /** Dialog instance */
    $dialog?: import('naive-ui').DialogProviderInst;
    /** Message instance */
    $message?: import('naive-ui').MessageProviderInst;
    /** Notification instance */
    $notification?: import('naive-ui').NotificationProviderInst;
    /** 运行时配置（由 index.html 在 app 加载前从 /config.json 注入） */
    __APP_CONFIG__: AppRuntimeConfig | null;
  }

  /** Build time of the project */
  export const BUILD_TIME: string;
}
