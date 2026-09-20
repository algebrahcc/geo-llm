/**
 * Cesium 场景内核 —— 端口定义（RFC-0001 · 第 1 步）
 *
 * 设计意图：核心编排只依赖这里的窄接口，**不 import `cesium` 的有状态对象、不读
 * `window` / `import.meta`**，因此可以在 Node 环境注入替身，把生命周期、超时、
 * 清理顺序这些不变量用边界测试锁住。
 *
 * 只把「会创建 WebGL / 发起网络 / 读全局 / 写 DOM」的东西做成端口；
 * Cesium 的纯值类型（Cartesian2/3、Cartographic、Color、Rectangle）保持直接 import
 * —— 它们在 Node 下无副作用可求值，端口化只会把数学搬进适配器、并丢掉类型安全。
 */
import type { ImageryLayer, ImageryProvider, TerrainProvider } from 'cesium';
import type { getImageryConfig } from '@/utils/imagery';
import type { getTerrainConfig } from '@/utils/terrain';

/** 屏幕坐标（结构上兼容 Cesium 的 Cartesian2：{ x, y }） */
export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * 经纬高。
 *
 * 核心内部一律用这个朴素结构，而不是 Cesium 的 Cartesian3 / Cartographic ——
 * 这样核心不依赖 Cesium 的取值路径（`Cartographic.fromCartesian` 等），
 * 也就能在 Node 里被完整测试（见 `scene/create-scene.ts`）。
 */
export interface GeoPoint {
  longitude: number;
  latitude: number;
  height: number;
}

/** 可释放句柄 */
export interface Disposable {
  dispose(): void;
}

/** 提示端口：吸收散落各处的 `window.$message` */
export interface SceneNotifier {
  success(message: string): void;
  warning(message: string): void;
  error(message: string): void;
  /** 常驻提示（duration=0），调用方负责释放 */
  loading(message: string): Disposable;
}

/**
 * 运行时配置端口：吸收 `import.meta.env` / `window.__APP_CONFIG__`
 * 与 `utils/imagery`、`utils/terrain` 的配置读取。
 */
export interface SceneEnvConfig {
  /** `import.meta.env.BASE_URL` */
  publicBaseUrl(): string;
  /** 真实后端基址：运行时 config.json > 构建期变量 > 默认值 */
  serviceBaseUrl(): string;
  /** 默认影像配置 */
  imagery(): ReturnType<typeof getImageryConfig>;
  /** 地形配置 */
  terrain(): ReturnType<typeof getTerrainConfig>;
  /**
   * 数据服务加载超时（ms）—— **唯一来源**。
   * 现状在 `use-cesium-base.ts` 与 `use-cesium-services.ts` 各写了一份 8000，
   * 本端口是收敛点（第 2 步把两处改为引用它）。
   */
  serviceTimeoutMs: number;
}

/**
 * 定时器句柄。
 *
 * 刻意从 `globalThis` 推导而不是写死 `number`：浏览器下是数字、Node 下是 Timeout 对象，
 * 端口只把它当不透明句柄传递（调用方从不解析它），这样生产适配器与测试替身都能零强转地满足契约。
 */
export type TimerId = ReturnType<typeof globalThis.setTimeout>;

/** 定时器端口：Node 测试注入虚拟时钟，可断言超时分支且不产生悬挂定时器 */
export interface SceneTimers {
  setTimeout(handler: () => void, ms: number): TimerId;
  clearTimeout(id: TimerId): void;
  now(): number;
}

/** 服务目录端口：吸收 `fetchEnabledDataServices` + 信封解包 */
export interface SceneServiceSource {
  /** 启用中的数据服务（适配器内完成信封解包，调用方拿到的就是业务数据） */
  listEnabled(): Promise<Api.DataService.DataServiceItem[]>;
}

/** 矢量数据端口：吸收 `fetchVectorExtent` / `getVectorTileUrl` */
export interface SceneVectorSource {
  /** 矢量数据范围（用于飞行定位），无范围时返回 null */
  extent(vectorId: string | number): Promise<number[] | null>;
  /** MVT 瓦片模板 URL，不可用时返回 null */
  tileUrl(vectorId: string | number, sourceType: string): string | null;
}

/** 事件处理器窄契约（Cesium `ScreenSpaceEventHandler` 的最小子集） */
export interface InputHandlerPort {
  setInputAction(action: (event: unknown) => void, type: number): void;
  destroy(): void;
}

/** 相机控制器参数（模块在场景 prepare 阶段按需设置） */
export interface CameraControllerPatch {
  enableRotate?: boolean;
  enableTilt?: boolean;
  enableCollisionDetection?: boolean;
  zoomFactor?: number;
  inertiaZoom?: number;
  minimumZoomDistance?: number;
}

/**
 * 相机端口：只给**粗粒度命令**，不逐方法镜像 Cesium。
 *
 * 例如不暴露 `camera.positionCartographic`，只给 `height()`；
 * 不暴露 `camera.pickEllipsoid + globe.ellipsoid`，只给 `pickGlobe()`。
 * 这样核心不必知道 Cesium 的取值路径，替换实现（含假替身）也更容易。
 */
export interface CameraPort {
  /** 飞行到目标点（用经纬高表达，核心不构造 Cartesian3） */
  flyToGeo(point: GeoPoint, duration: number): void;
  zoomIn(amount: number): void;
  zoomOut(amount: number): void;
  rotate(radians: number): void;
  pitch(radians: number): void;
  /** 视点距地表高度（米） */
  height(): number;
  /**
   * 屏幕坐标 → 地表交点。
   *
   * 返回的是**不透明**的 Cesium 笛卡尔坐标：核心只负责把它原样传给别人
   * （例如 `getCartesianFromScreen` 的返回值、`computeBaseStatus` 的入参），
   * 需要经纬度时用 `SceneKit.toGeo()` 转换，不自己解析。
   */
  pickGlobe(screen: ScreenPoint): unknown | null;
  /** camera.changed 监听（视点变化节流上报由调用方决定阈值） */
  onChange(listener: () => void): void;
  offChange(listener: () => void): void;
  /** 视点变化上报阈值（模块在 prepare 阶段设置） */
  percentageChanged: number;
}

/** 地球端口：核心用到的地表开关 */
export interface GlobePort {
  /** 地表是否参与深度测试（透视模式需要开启，否则半透明混合顺序不对） */
  setDepthTestAgainstTerrain(on: boolean): void;
  setTranslucency(options: { enabled: boolean; frontFaceAlpha: number; backFaceAlpha: number }): void;
}

/** 场景端口 */
export interface ScenePort {
  requestRender(): void;
  /** 强制同步渲染（截图前，保证画布内容最新） */
  render(): void;
  /** 当前模式（morph 过程中即目标模式） */
  mode(): '2D' | '3D';
  morphTo2D(duration: number): void;
  morphTo3D(duration: number): void;
  setController(patch: CameraControllerPatch): void;
  readonly globe: GlobePort;
}

/** 影像层集合端口 */
export interface ImageryLayersPort {
  removeAll(): void;
  addImageryProvider(provider: ImageryProvider): ImageryLayer;
  /**
   * 显隐/透明度投影：核心只持有不透明的图层句柄与显隐真相，
   * 由端口负责落到 Cesium 图层的 `show` / `alpha`（与 service-loader 中 imagery 句柄的写法一致）。
   */
  setVisible(layer: unknown, visible: boolean): void;
  setOpacity(layer: unknown, opacity: number): void;
}

/**
 * Viewer 窄契约：核心只依赖这些成员。
 *
 * 划定准则：**只把「核心需要据以编排 / 判断」的能力纳入端口**；
 * 一次性的、场景特有的能力走逃生口（后续步骤提供），避免端口被撑成 Viewer 的再导出。
 */
export interface ViewerPort {
  readonly canvas: HTMLCanvasElement;
  readonly camera: CameraPort;
  readonly scene: ScenePort;
  readonly imageryLayers: ImageryLayersPort;
  terrainProvider: TerrainProvider | undefined;
  isDestroyed(): boolean;
  destroy(): void;

  /**
   * 逃生口：取出底层原生对象（实际就是 Cesium `Viewer`）。
   *
   * 存在的唯一理由：`use-cesium-base` 必须继续对外暴露 `viewerRef: Ref<Viewer | null>`，
   * 因为大量模块直接使用 `viewer.entities` / `dataSources` / `scene` 等原生能力。
   * 它是**显式命名**的单一出口，便于集中审计「谁还在绕过端口」；
   * 核心自身绝不调用它。
   */
  rawViewer(): unknown;
}

/**
 * Cesium 造物端口：**全项目唯一**创建 Viewer、事件处理器与 provider 的地方。
 *
 * 它是这批端口里唯一的 "True external"（第三方、不受本仓库控制）边界，
 * 因此也是唯一允许 `import { Viewer } from 'cesium'` 的适配器文件。
 * 影像与地形的构造也在这里 —— 它们同样需要 `new` Cesium 类，
 * 让核心只拿到「provider 数组 / provider」即可，不必知道配置来自哪、用哪个类。
 */
export interface SceneKit {
  createViewer(container: HTMLElement, options?: Record<string, unknown>): ViewerPort;
  createEventHandler(surface: unknown): InputHandlerPort;
  /** 把不透明的笛卡尔坐标转成经纬高（核心用它算状态条/坐标浮窗） */
  toGeo(cartesian: unknown): GeoPoint | null;
  /** config.json 兜底影像（全局 + 可选区域叠加） */
  createDefaultImageryProviders(): ImageryProvider[];
  /** config.json 地形（异步，不可用时返回 undefined） */
  createTerrainProvider(): Promise<TerrainProvider | undefined>;
  readonly inputTypes: {
    readonly MOUSE_MOVE: number;
    readonly LEFT_CLICK: number;
  };
}

/** 截图落盘端口：把 dataURL 交给浏览器下载（DOM 操作，不进核心） */
export interface ExporterPort {
  saveDataUrl(dataUrl: string, filename: string): void;
}

/** 场景依赖集合：逐个场景注入，不做模块级全局单例（否则测试会互相污染） */
export interface SceneDeps {
  kit: SceneKit;
  notify: SceneNotifier;
  config: SceneEnvConfig;
  timers: SceneTimers;
  services: SceneServiceSource;
  vector: SceneVectorSource;
  exporter: ExporterPort;
}
