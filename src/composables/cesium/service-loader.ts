/**
 * Cesium 数据服务加载器（设计文档 5.4）
 *
 * 对标 TerriaJS CatalogMemberFactory：采用「注册表式工厂」而非 if/switch 分发。
 * 新增服务类型时只需 registerServiceFactory 注册一个 factory，不改分发逻辑（开闭原则）。
 * 每个句柄带加载状态机（loading/ready/error），区分「服务不可达」与「类型不支持」。
 *
 * 覆盖：imagery / terrain / threed / vector / streetview 五类。
 * streetview(panorama) 走街景服务直连（点集合 + 全景图），analysis 未注册 → 返回 error 句柄。
 */
import {
  ArcGisMapServerImageryProvider,
  ArcGISTiledElevationTerrainProvider,
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Cesium3DTileset,
  CesiumTerrainProvider,
  Color,
  GeographicTilingScheme,
  GeoJsonDataSource,
  HeightReference,
  ImageryLayer,
  JulianDate,
  KmlDataSource,
  LabelGraphics,
  Math as CesiumMath,
  Model,
  PointGraphics,
  PointPrimitiveCollection,
  Rectangle,
  ScreenSpaceEventHandler,
  Transforms,
  ScreenSpaceEventType,
  UrlTemplateImageryProvider,
  Viewer,
  WebMapServiceImageryProvider,
  WebMapTileServiceImageryProvider,
  WebMercatorTilingScheme,
  type Entity,
  type ImageryProvider,
  type PointPrimitive,
  type TerrainProvider
} from 'cesium';
import MVTImageryProvider from 'mvt-imagery-provider';
import type { StyleSpecification } from 'mvt-imagery-provider';
import { MAP_LABEL_SCALE, mapLabelFont } from '@/composables/cesium/label-style';
import { openStreetViewPanorama, type StreetViewPanoramaNeighbor } from '@/components/cesium/street-view-panorama';
import { openIntelDetailCard } from '@/components/cesium/intel-detail-card';
import type { StreetViewFilmstripItem } from '@/components/cesium/street-view-filmstrip';
import { distanceMeters } from './streetview/geo';
import { createPointIndex } from './streetview/point-index';
import { registerStreetViewPicker, type StreetViewPickResult } from './streetview/pick-dispatcher';
import { buildRouteOrder, DEFAULT_MAX_STEP_METERS } from './streetview/route-order';
import { createStreetViewSourceOf } from './streetview/source-factory';
import {
  NEAREST_MAX_METERS,
  StreetViewError,
  parseStreetViewParams,
  type StreetViewPoint,
  type StreetViewSourceKind
} from './streetview/service-api';

/** 加载状态机 */
export type ServiceLayerState = 'loading' | 'ready' | 'error';

/** 图例项：从服务 style/params 解析出的颜色，供图层面板渲染图例 */
export interface ServiceLayerLegendItem {
  color: string;
  label?: string;
}

/** 街景服务元信息（图层条目副标题展示、验收时一眼看出是远程还是本地数据） */
export interface StreetViewHandleMeta {
  /** 数据来源：远程街景服务 / 前端本地目录 */
  source: StreetViewSourceKind;
  /** 街景点数量 */
  points: number;
  /** 道路顺序链（每条链上依次排列的点位下标），供球面绘制街景路线 */
  chains: number[][];
  /** 街景点坐标（与 chains 里的下标一一对应） */
  coordinates: Array<[number, number]>;
  /** 是否采用了推导出的道路顺序（false 表示退回原始顺序） */
  ordered: boolean;
}

/**
 * 街景浏览控制入口（仅 streetview 分类有）
 *
 * 存在的理由：场景页需要在球面上提供「开始浏览 / 上一处 / 下一处」，
 * 而「当前走到哪、下一个是哪个」只有加载器内部知道（它持有道路顺序链），
 * 因此把这几个动作作为能力挂在句柄上，而不是让页面自己去猜顺序。
 */
export interface StreetViewController {
  /** 打开指定街景点；不传则打开漫游路线的第一个点 */
  open(index?: number): void;
  /** 相对当前点前进/后退；尚未打开任何点时从路线端点开始 */
  step(delta: 1 | -1): void;
}

/** 服务图层句柄：状态机 + 图层操作（对标 TerriaJS Workbench 条目） */
export interface ServiceLayerHandle {
  id: number;
  category: Api.DataService.Category;
  type: string;
  name: string;
  state: ServiceLayerState;
  /** 图层当前是否可见（由 show/hide 维护，供图层面板眼睛图标渲染） */
  visible: boolean;
  /** 失败原因（区分「服务不可达」与「类型不支持」） */
  error?: string;
  /** 仅 imagery / vector(mvt) 有效：对应 Cesium ImageryLayer，供模块级显隐（imageryLayers 同步）使用 */
  layer?: ImageryLayer;
  /** 图例（复用 style/params 字段解析出的主色，供图层面板渲染图例） */
  legend?: ServiceLayerLegendItem[];
  /** 街景服务元信息（仅 streetview 分类有） */
  streetview?: StreetViewHandleMeta;
  /** 街景浏览控制入口（仅 streetview 分类有） */
  streetviewController?: StreetViewController;
  show(): void;
  hide(): void;
  remove(): void;
  setOpacity(opacity: number): void;
  /**
   * 当前透明度（仅对支持透明度的类型有意义，其余类型不维护此字段）。
   *
   * 存在的理由与 `visible` 相同：`applyServices` 会 removeAll 后按 provider 重建图层，
   * 重建出的新图层 `alpha` 回到 1 —— 必须把用户意图回放回去，
   * 否则「用户调过的透明度」会在重建后丢失。
   */
  opacity?: number;
  /** 双击图层面板条目时定位到数据范围（extent → 图层自身包围范围），不支持定位的类型可省略 */
  flyTo?(): void;
  /**
   * 重新加载该服务（仅失败/可就绪时有效）。
   *
   * 与 `flyTo?` 一样属于「可选能力」：由 `use-cesium-services` 在登记句柄时注入，
   * 图层面板直接调句柄自身，不必为每个动作再往页面层透传一路回调。
   */
  retry?(): void;
}

/** 服务 → Cesium 对象工厂 */
export type ServiceFactory = (s: Api.DataService.DataServiceItem, viewer: Viewer) => Promise<ServiceLayerHandle>;

/** 注册表：`${category}:${type}` → factory */
const registry = new Map<string, ServiceFactory>();

/** 注册服务工厂 */
export function registerServiceFactory(category: string, type: string, factory: ServiceFactory): void {
  registry.set(`${category}:${type}`, factory);
}

// ─── 通用工具 ───────────────────────────────────────────

function serviceKey(s: Api.DataService.DataServiceItem): string {
  return `${s.category}:${s.type}`;
}

/** 双击定位的默认飞行时长（秒），对齐各模块 flyToPreset 的节奏 */
const FLY_DURATION = 1.4;

/** 解析服务条目 extent（JSON 文本 [west, south, east, north]）为 Cesium Rectangle */
function parseExtentRectangle(s: Api.DataService.DataServiceItem): Rectangle | undefined {
  const extent = parseJson<number[]>(s.extent);
  if (extent && extent.length === 4 && extent.every(v => typeof v === 'number')) {
    return Rectangle.fromDegrees(extent[0], extent[1], extent[2], extent[3]);
  }
  return undefined;
}

/** 相机飞行至矩形范围 */
function flyToRectangle(viewer: Viewer, rect: Rectangle): void {
  viewer.camera.flyTo({ destination: rect, duration: FLY_DURATION });
}

/**
 * 由一组 [lon, lat] 坐标求包围矩形（街景点定位用）
 *
 * 刻意用单次遍历而非 `Math.min(...lons)`：展开运算符会把每个点变成一个实参，
 * 城市级点集（十万级）会直接抛「Maximum call stack size exceeded」。
 */
function rectangleFromCoordinates(coordinates: Array<[number, number]>): Rectangle | undefined {
  if (coordinates.length === 0) return undefined;
  let minLon = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < coordinates.length; i += 1) {
    const [lon, lat] = coordinates[i];
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  const pad = 0.002; // 稍作外扩，避免贴边
  return Rectangle.fromDegrees(minLon - pad, minLat - pad, maxLon + pad, maxLat + pad);
}

function parseJson<T = Record<string, unknown>>(raw?: string): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** 从 params / style 字段解析图例主色（vector 类填充/边线颜色） */
function extractLegend(s: Api.DataService.DataServiceItem): ServiceLayerLegendItem[] | undefined {
  const params = parseJson<Record<string, string>>(s.params) || {};
  const items: ServiceLayerLegendItem[] = [];
  if (params.fillColor) items.push({ color: params.fillColor, label: '填充' });
  if (params.lineColor) items.push({ color: params.lineColor, label: '边线' });

  if (items.length === 0) {
    const style = parseJson<{ layers?: { paint?: Record<string, string> }[] }>(s.style);
    const paint = style?.layers?.[0]?.paint;
    if (paint) {
      const fill = paint['fill-color'] || paint['fill-extrusion-color'];
      const line = paint['line-color'];
      if (fill) items.push({ color: fill, label: '填充' });
      if (line) items.push({ color: line, label: '边线' });
    }
  }
  return items.length > 0 ? items : undefined;
}

/**
 * 解析服务真实地址：
 * - external / 已带 http(s) → 原样
 * - internal 相对路径（如 /system/vector/tile/...）→ 拼接后端 Base URL
 */
export function resolveServiceUrl(s: Api.DataService.DataServiceItem): string {
  if (s.origin === 'external' || /^https?:\/\//.test(s.url)) {
    return s.url;
  }
  // internal 相对路径分两类：
  // 1) 以 "/" 开头：后端接口相对路径（如 /system/vector/tile/...）→ 拼后端 Base URL；
  // 2) 不以 "/" 开头：前端静态资源相对路径（本地离线瓦片目录，如
  //    google satellite-z0-8.yocMFTJvR/{z}/{x}/{y}.jpg）→ 拼前端 BASE_URL，
  //    与 config.json IMAGERY.local 的加载方式保持一致。
  if (s.url.startsWith('/')) {
    const baseUrl =
      // eslint-disable-next-line no-underscore-dangle
      window['__APP_CONFIG__']?.VITE_SERVICE_REAL_BASE_URL ||
      import.meta.env.VITE_SERVICE_REAL_BASE_URL ||
      'http://localhost:8000';
    return `${baseUrl}${s.url}`;
  }
  // BASE_URL 为 "/" 时直接拼接会产生 "//xxx" 的协议相对 URL（浏览器把首段当主机名），需归一化
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return `${base}${s.url}`;
}

function toTilingScheme(value?: string): GeographicTilingScheme | WebMercatorTilingScheme {
  return value === 'Geographic' ? new GeographicTilingScheme() : new WebMercatorTilingScheme();
}

/** extent 字符串 [minLng,minLat,maxLng,maxLat] → Cesium Rectangle */
function toRectangle(s: Api.DataService.DataServiceItem): Rectangle | undefined {
  const extent = parseJson<number[]>(s.extent);
  if (extent && extent.length === 4) {
    return Rectangle.fromDegrees(extent[0], extent[1], extent[2], extent[3]);
  }
  return undefined;
}

// ─── 句柄构造 ───────────────────────────────────────────

/** imagery / vector(mvt) 类：基于 ImageryLayer 的句柄 */
function buildLayerHandle(s: Api.DataService.DataServiceItem, viewer: Viewer, layer: ImageryLayer): ServiceLayerHandle {
  const legend = extractLegend(s);
  return {
    id: s.id,
    category: s.category,
    type: s.type,
    name: s.name,
    state: 'ready',
    visible: true,
    opacity: 1,
    layer,
    legend,
    show() {
      layer.show = true;
      this.visible = true;
    },
    hide() {
      layer.show = false;
      this.visible = false;
    },
    remove() {
      if (!viewer.isDestroyed()) {
        viewer.imageryLayers.remove(layer, true);
      }
    },
    setOpacity(opacity: number) {
      // 记录状态 + 投影到图层：前者用于图层被重建后回放，后者是实际效果
      this.opacity = opacity;
      layer.alpha = opacity;
    },
    flyTo() {
      const rect = parseExtentRectangle(s);
      if (rect) {
        flyToRectangle(viewer, rect);
        return;
      }
      window.$message?.warning(`「${s.name}」未配置数据范围（extent），无法定位`);
    }
  };
}

// ─── imagery 工厂 ───────────────────────────────────────

async function createImageryProvider(s: Api.DataService.DataServiceItem): Promise<ImageryProvider> {
  const url = resolveServiceUrl(s);
  const params = parseJson<Record<string, string | number>>(s.params) || {};
  const rectangle = toRectangle(s);
  const minLevel = s.minZoom ?? 0;
  const maxLevel = s.maxZoom ?? 18;

  switch (s.type) {
    case 'wms':
      return new WebMapServiceImageryProvider({
        url,
        layers: String(params.layers ?? ''),
        parameters: { transparent: 'true' },
        minimumLevel: minLevel,
        maximumLevel: maxLevel,
        rectangle
      });
    case 'wmts':
      return new WebMapTileServiceImageryProvider({
        url,
        layer: String(params.layer ?? ''),
        style: String(params.style ?? 'default'),
        format: String(params.format ?? 'image/png'),
        tileMatrixSetID: String(params.tileMatrixSetID ?? 'EPSG:3857'),
        maximumLevel: maxLevel
      });
    case 'arcgis':
      // Cesium 1.141：arcgis provider 仅支持异步 fromUrl（构造 options 无 url 字段）
      return ArcGisMapServerImageryProvider.fromUrl(url, { maximumLevel: maxLevel });
    case 'xyz':
    case 'tms':
    default:
      return new UrlTemplateImageryProvider({
        url,
        minimumLevel: minLevel,
        maximumLevel: maxLevel,
        tilingScheme: toTilingScheme(String(params.tilingScheme ?? '')),
        rectangle
      });
  }
}

async function createImageryHandle(s: Api.DataService.DataServiceItem, viewer: Viewer): Promise<ServiceLayerHandle> {
  const layer = viewer.imageryLayers.addImageryProvider(await createImageryProvider(s));
  layer.show = true;
  return buildLayerHandle(s, viewer, layer);
}

// ─── terrain 工厂 ───────────────────────────────────────

async function createTerrainHandle(s: Api.DataService.DataServiceItem, viewer: Viewer): Promise<ServiceLayerHandle> {
  const url = resolveServiceUrl(s);
  const params = parseJson<Record<string, unknown>>(s.params) || {};
  const originalProvider = viewer.terrainProvider;
  let provider: TerrainProvider;
  if (s.type === 'elevation') {
    provider = await ArcGISTiledElevationTerrainProvider.fromUrl(url);
  } else {
    provider = await CesiumTerrainProvider.fromUrl(url, {
      requestVertexNormals: Boolean(params.requestVertexNormals),
      requestWaterMask: Boolean(params.requestWaterMask)
    });
  }
  viewer.terrainProvider = provider;
  const handle: ServiceLayerHandle = {
    id: s.id,
    category: s.category,
    type: s.type,
    name: s.name,
    state: 'ready',
    visible: true,
    show() {
      if (!viewer.isDestroyed()) viewer.terrainProvider = provider;
      this.visible = true;
    },
    hide() {
      if (!viewer.isDestroyed()) viewer.terrainProvider = originalProvider;
      this.visible = false;
    },
    remove() {
      if (!viewer.isDestroyed() && viewer.terrainProvider === provider) {
        viewer.terrainProvider = originalProvider;
      }
    },
    setOpacity() {
      /* 地形不支持透明度 */
    },
    flyTo() {
      const rect = parseExtentRectangle(s);
      if (rect) {
        flyToRectangle(viewer, rect);
        return;
      }
      window.$message?.warning(`「${s.name}」未配置数据范围（extent），无法定位`);
    }
  };
  return handle;
}

// ─── threed 工厂 ────────────────────────────────────────

async function createTilesetHandle(s: Api.DataService.DataServiceItem, viewer: Viewer): Promise<ServiceLayerHandle> {
  const url = resolveServiceUrl(s);
  // 摆放位置（可选），兼容两种配置结构：
  // ① 表单差异字段：params.position = '{"lon":121.46,"lat":25.12,"height":-10}'（字符串或对象）
  // ② 顶层直写：params = {"lon":121.46,"lat":25.12,"height":-10}
  // 未配置时模型/瓦片位于 WGS84 原点（数据本身无 transform 的场景）
  const parsedParams = parseJson<Record<string, unknown>>(s.params);
  const rawPosition: unknown = parsedParams?.position;
  const positionConf =
    typeof rawPosition === 'string'
      ? parseJson<{ lon?: number; lat?: number; height?: number }>(rawPosition)
      : (rawPosition as { lon?: number; lat?: number; height?: number } | undefined);
  const positionSource = positionConf ?? (parsedParams as { lon?: number; lat?: number; height?: number } | undefined);
  let positionLonLat: { lon: number; lat: number; height: number } | undefined;
  if (positionSource && positionSource.lon != null && positionSource.lat != null) {
    positionLonLat = { lon: positionSource.lon, lat: positionSource.lat, height: positionSource.height ?? 0 };
  }
  const position = positionLonLat
    ? Cartesian3.fromDegrees(positionLonLat.lon, positionLonLat.lat, positionLonLat.height)
    : undefined;
  // 运行时诊断：摆放未配置/JSON 解析失败都会静默落到 WGS84 原点，控制台明示原因
  if (positionLonLat) {
    console.info(
      `[DataService] ${s.name} 已摆放到 lon=${positionLonLat.lon}, lat=${positionLonLat.lat}, h=${positionLonLat.height}`
    );
  } else {
    console.warn(
      `[DataService] ${s.name} 未应用摆放位置（params.position 未填或 JSON 格式错误），模型位于 WGS84 原点，地图上不可见`
    );
  }
  const modelMatrix = position ? Transforms.eastNorthUpToFixedFrame(position) : undefined;
  let primitive: Cesium3DTileset | Model;
  if (s.type === 'gltf' || s.type === 'glb') {
    primitive = await Model.fromGltfAsync({ url, modelMatrix });
  } else {
    primitive = await Cesium3DTileset.fromUrl(url, modelMatrix ? { modelMatrix } : undefined);
  }
  viewer.scene.primitives.add(primitive);
  const handle: ServiceLayerHandle = {
    id: s.id,
    category: s.category,
    type: s.type,
    name: s.name,
    state: 'ready',
    visible: true,
    show() {
      primitive.show = true;
      this.visible = true;
    },
    hide() {
      primitive.show = false;
      this.visible = false;
    },
    remove() {
      if (!viewer.isDestroyed()) {
        viewer.scene.primitives.remove(primitive);
      }
    },
    setOpacity(opacity: number) {
      // Model 支持 alpha；3D Tiles 透明度控制留待后续（可经 Cesium3DTileStyle）
      if ('alpha' in primitive) {
        (primitive as unknown as { alpha: number }).alpha = opacity;
      }
    },
    flyTo() {
      const rect = parseExtentRectangle(s);
      if (rect) {
        flyToRectangle(viewer, rect);
        return;
      }
      if (viewer.isDestroyed()) return;
      if (position) {
        // 模型被摆放后，primitive.boundingSphere 仍是本地坐标，需以摆放点为球心飞行
        viewer.camera.flyToBoundingSphere(new BoundingSphere(position, Math.max(primitive.boundingSphere.radius, 80)), {
          duration: FLY_DURATION
        });
        return;
      }
      if (primitive instanceof Model) {
        // glTF/glb：按模型包围球飞行（viewer.flyTo 不接受 Model）
        viewer.camera.flyToBoundingSphere(primitive.boundingSphere, { duration: FLY_DURATION });
        return;
      }
      // 聚合式 3D Tiles（如 taibei）顶层 tileset 的 root 包围盒往往被人为放大到覆盖全球
      // （保证根节点不被视野裁剪），直接 flyTo 会"飞了等于没飞"。
      // 改为聚合根瓦片各子节点的包围球（子节点才是真实局部位置）。
      const childSpheres = primitive.root?.children?.map(c => c.boundingSphere).filter(Boolean) ?? [];
      if (childSpheres.length > 0) {
        const union = BoundingSphere.fromPoints(childSpheres.map(b => b.center));
        // fromPoints 只聚合了各子球中心，半径补上子球自身半径，避免贴太近
        union.radius += Math.max(...childSpheres.map(b => b.radius));
        viewer.camera.flyToBoundingSphere(union, { duration: FLY_DURATION });
      } else {
        void viewer.flyTo(primitive, { duration: FLY_DURATION });
      }
    }
  };
  return handle;
}

// ─── vector 工厂 ────────────────────────────────────────

/** 从 style 字段（完整 StyleSpecification JSON）或 params 构造 MVT 样式，泛化 river 的 buildVectorMvtStyle */
function buildMvtStyle(s: Api.DataService.DataServiceItem): StyleSpecification {
  const parsedStyle = parseJson<StyleSpecification>(s.style);
  if (parsedStyle && parsedStyle.version === 8) {
    return parsedStyle;
  }
  const tileUrl = resolveServiceUrl(s);
  const params = parseJson<Record<string, string>>(s.params) || {};
  const sourceName = `service-${s.id}`;
  const sourceLayer = params.sourceLayer || 'vector';
  return {
    version: 8,
    name: sourceName,
    sources: {
      [sourceName]: {
        type: 'vector',
        scheme: 'xyz',
        tiles: tileUrl ? [tileUrl] : []
      }
    },
    // 后端 MVT 由 ST_AsMVT 生成，source-layer 默认固定为 'vector'
    layers: [
      {
        id: `${sourceName}-fill`,
        type: 'fill',
        source: sourceName,
        'source-layer': sourceLayer,
        paint: {
          'fill-color': params.fillColor || 'rgba(255, 140, 0, 0.25)',
          'fill-outline-color': params.fillOutlineColor || 'rgba(255, 140, 0, 0.9)'
        }
      },
      {
        id: `${sourceName}-line`,
        type: 'line',
        source: sourceName,
        'source-layer': sourceLayer,
        paint: {
          'line-color': params.lineColor || 'rgba(255, 140, 0, 0.94)',
          'line-width': 3
        }
      }
    ]
  };
}

async function createMvtHandle(s: Api.DataService.DataServiceItem, viewer: Viewer): Promise<ServiceLayerHandle> {
  const provider = new MVTImageryProvider({ style: buildMvtStyle(s) });
  // 兼容 Cesium 1.143：ImageryProvider 新增抽象方法 getTileCredits，
  // mvt-imagery-provider@1.0.3 基于旧版 Cesium 未实现，这里补默认实现
  (provider as unknown as { getTileCredits: () => unknown[] }).getTileCredits = () => [];
  const layer = viewer.imageryLayers.addImageryProvider(provider as unknown as ImageryProvider);
  layer.show = true;
  return buildLayerHandle(s, viewer, layer);
}

async function createVectorHandle(s: Api.DataService.DataServiceItem, viewer: Viewer): Promise<ServiceLayerHandle> {
  if (s.type === 'mvt') {
    return createMvtHandle(s, viewer);
  }
  const url = resolveServiceUrl(s);
  const dataSource = s.type === 'kml' ? await KmlDataSource.load(url) : await GeoJsonDataSource.load(url);
  viewer.dataSources.add(dataSource);

  // geojson 点带情报属性（properties.image）时：强化点样式 + 名称标签 + 点击弹详情卡
  let intelHandler: ScreenSpaceEventHandler | null = null;
  if (s.type === 'geojson') {
    const intelProps = new Map<string, Record<string, unknown>>();
    const now = JulianDate.now();
    dataSource.entities.values.forEach((entity: Entity) => {
      const props = entity.properties?.getValue(now) as Record<string, unknown> | undefined;
      if (!props || !props.image) return;
      intelProps.set(entity.id, props);
      entity.point = new PointGraphics({
        pixelSize: 12,
        color: Color.fromCssColorString('#ffb02e').withAlpha(0.95),
        outlineColor: Color.WHITE,
        outlineWidth: 1.5,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      });
      if (props.name) {
        entity.label = new LabelGraphics({
          text: String(props.name),
          // 服务图层名称与其它地图注记同尺寸（原为 12px）
          font: mapLabelFont(),
          scale: MAP_LABEL_SCALE,
          fillColor: Color.fromCssColorString('#eaf5ff'),
          showBackground: true,
          backgroundColor: Color.fromCssColorString('rgba(2, 10, 20, 0.78)'),
          backgroundPadding: new Cartesian2(8, 5),
          pixelOffset: new Cartesian2(0, -20),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        });
      }
    });

    if (intelProps.size > 0) {
      intelHandler = new ScreenSpaceEventHandler(viewer.scene.canvas);
      intelHandler.setInputAction((movement: ScreenSpaceEventHandler.PositionedEvent) => {
        const picked = viewer.scene.pick(movement.position);
        const entityId = (picked as { id?: { id?: unknown } } | undefined)?.id?.id;
        const props = intelProps.get(String(entityId));
        if (props) {
          openIntelDetailCard(props as Parameters<typeof openIntelDetailCard>[0]);
        }
      }, ScreenSpaceEventType.LEFT_CLICK);
    }
  }

  const handle: ServiceLayerHandle = {
    id: s.id,
    category: s.category,
    type: s.type,
    name: s.name,
    state: 'ready',
    visible: true,
    legend: extractLegend(s),
    show() {
      dataSource.show = true;
      this.visible = true;
    },
    hide() {
      dataSource.show = false;
      this.visible = false;
    },
    remove() {
      intelHandler?.destroy();
      if (!viewer.isDestroyed()) {
        viewer.dataSources.remove(dataSource, true);
      }
    },
    setOpacity() {
      /* 矢量数据源不支持整体透明度 */
    },
    flyTo() {
      const rect = parseExtentRectangle(s);
      if (rect) {
        flyToRectangle(viewer, rect);
        return;
      }
      // 无 extent 时飞到数据源自带包围范围
      if (!viewer.isDestroyed()) {
        void viewer.flyTo(dataSource, { duration: FLY_DURATION });
      }
    }
  };
  return handle;
}

// ─── streetview 工厂（远程街景服务 / 本地静态目录，两来源同构）─────

/** 街景点配色（与图层面板 streetview 分类色一致） */
const STREETVIEW_POINT_COLOR = '#ff4d8d';

/** 街景点基础尺寸（像素） */
const STREETVIEW_POINT_SIZE = 11;

/** 街景点基础颜色：抽成常量，因为高亮还原时要复用 */
const STREETVIEW_POINT_BASE_COLOR = Color.fromCssColorString(STREETVIEW_POINT_COLOR).withAlpha(0.95);

/** 当前街景点的高亮配色（与系统主色一致） */
const STREETVIEW_POINT_ACTIVE_COLOR = Color.fromCssColorString('#29a3ff').withAlpha(1);

/** 定位街景点时的相机高度（米）：低空俯瞰，看得清街区走向 */
const STREETVIEW_FOCUS_HEIGHT = 1200;

/** 本地街景的自动漫游步进（毫秒）：本地图片命中缓存后可稳定在这个节奏 */
const STREETVIEW_AUTOPLAY_INTERVAL_MS = 2600;

/** 画街景路线的最小链长：两三个点的碎片链画出来只是噪声 */
const STREETVIEW_ROUTE_MIN_POINTS = 5;

/** 街景路线折线的数量上限：城市级点集可能有成百上千条碎片链，全画会拖慢渲染 */
const STREETVIEW_ROUTE_MAX_LINES = 40;

/** 分片撒点的单帧预算（毫秒）：城市级点集不能一次性塞进单次任务，否则首屏明显卡顿 */
const STREETVIEW_CHUNK_BUDGET_MS = 12;

/**
 * 分片把街景点写入点图元集合。
 *
 * 为什么用 `PointPrimitiveCollection` 而不是逐点 Entity：Entity + PointGraphics 每点一个对象、
 * 走动态几何更新，千级以上就明显掉帧；点图元是批渲染，城市级点集仍是单次绘制。
 * 代价是点图元不支持 `heightReference` 贴地，因此用 `disableDepthTestDistance` 保证不被地形遮挡。
 */
async function addStreetPointsInChunks(
  collection: PointPrimitiveCollection,
  points: StreetViewPoint[]
): Promise<PointPrimitive[]> {
  const primitives: PointPrimitive[] = [];
  await new Promise<void>(resolve => {
    let index = 0;
    const step = () => {
      const deadline = performance.now() + STREETVIEW_CHUNK_BUDGET_MS;
      while (index < points.length && performance.now() < deadline) {
        const point = points[index];
        const primitive = collection.add({
          position: Cartesian3.fromDegrees(point.lon, point.lat, 0),
          pixelSize: STREETVIEW_POINT_SIZE,
          color: STREETVIEW_POINT_BASE_COLOR,
          outlineColor: Color.WHITE,
          outlineWidth: 1.5,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        });
        // 下标写在图元上：拾取时 O(1) 读回，替代原先遍历全部点算最近距离
        primitive.id = index;
        primitives.push(primitive);
        index += 1;
      }
      if (index < points.length) setTimeout(step, 0);
      else resolve();
    };
    step();
  });
  return primitives;
}

/** streetview 工厂：撒街景点 + 点击拾取最近街景全景图（远程服务与本地目录同构） */
async function createStreetViewHandle(s: Api.DataService.DataServiceItem, viewer: Viewer): Promise<ServiceLayerHandle> {
  const baseUrl = resolveServiceUrl(s);
  const source = createStreetViewSourceOf(s, baseUrl);
  const params = parseStreetViewParams(s.params);
  const maxStepMeters = Number(params.maxStepMeters) > 0 ? Number(params.maxStepMeters) : DEFAULT_MAX_STEP_METERS;

  // 1) 街景点：远程为区域全量点位，本地为 manifest/geojson 点位
  const points = await source.fetchPoints();
  const coordinates: Array<[number, number]> = points.map(point => [point.lon, point.lat]);

  // 2) 道路顺序：接口不给拓扑（也不可扩展），前进/后退的顺序只能由坐标推导
  const order = buildRouteOrder(coordinates, { maxStepMeters });

  // 3) 撒点：点图元批渲染 + 分片，避免城市级点集阻塞主线程
  const collection = viewer.scene.primitives.add(new PointPrimitiveCollection());
  const primitives = await addStreetPointsInChunks(collection, points);

  // 4) 就近索引：点击未命中图元时用它兜底（邻域查找，不再全量遍历）
  const pointsIndex = createPointIndex(coordinates);

  /** 当前街景点下标（-1 表示尚未打开任何全景） */
  let currentIndex = -1;
  /** 当前高亮的图元下标（用于还原上一个高亮） */
  let highlightedIndex = -1;

  function subtitleOf(point: StreetViewPoint, geoid: string): string {
    return `${geoid} · ${point.lon.toFixed(5)}, ${point.lat.toFixed(5)}`;
  }

  /** 高亮当前街景点：点图元可逐点改样式，改完请求一帧（场景是按需渲染） */
  function highlight(index: number): void {
    if (highlightedIndex === index) return;
    const previous = primitives[highlightedIndex];
    if (previous) {
      previous.pixelSize = STREETVIEW_POINT_SIZE;
      previous.color = STREETVIEW_POINT_BASE_COLOR;
      previous.outlineWidth = 1.5;
    }
    highlightedIndex = index;
    const current = primitives[index];
    if (current) {
      current.pixelSize = STREETVIEW_POINT_SIZE * 1.8;
      current.color = STREETVIEW_POINT_ACTIVE_COLOR;
      current.outlineWidth = 2.5;
    }
    viewer.scene.requestRender();
  }

  /** 把相机定位到某个街景点（切换时跟随、浮窗「定位」按钮共用） */
  function focusOn(index: number, fly = true): void {
    const point = points[index];
    if (!point) return;
    highlight(index);
    if (!fly || viewer.isDestroyed()) {
      viewer.scene.requestRender();
      return;
    }
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(point.lon, point.lat, STREETVIEW_FOCUS_HEIGHT),
      duration: FLY_DURATION
    });
  }

  // 5) 街景路线：把推导出的链画成折线。只有散点时看不出「沿哪条路走」，
  //    而这条线正是「前进/后退」的实际走向，验收时一眼就能对上。
  const routeEntities: Entity[] = [];
  order.chains
    .filter(chain => chain.length >= STREETVIEW_ROUTE_MIN_POINTS)
    .slice(0, STREETVIEW_ROUTE_MAX_LINES)
    .forEach(chain => {
      const positions = chain.map(index => Cartesian3.fromDegrees(coordinates[index][0], coordinates[index][1], 0));
      routeEntities.push(
        viewer.entities.add({
          polyline: {
            positions,
            width: 3,
            material: Color.fromCssColorString(STREETVIEW_POINT_COLOR).withAlpha(0.6),
            clampToGround: true
          }
        })
      );
    });

  // 6) 漫游路线与胶片条
  //    漫游路线取最长的一条链（其余散链多是零散点位）；胶片条只有本地目录能提供 ——
  //    远程服务要逐个问 nearest 才知道 geoid，枚举全量会把服务打爆。
  const longestChain = order.chains.reduce<number[]>(
    (longest, chain) => (chain.length > longest.length ? chain : longest),
    []
  );
  let filmstripItems: StreetViewFilmstripItem[] | undefined;
  const filmstripPositionOf = new Map<number, number>();
  if (typeof source.imageUrlOf === 'function') {
    const imageUrlOf = source.imageUrlOf.bind(source);
    filmstripItems = longestChain.map((pointIndex, position) => {
      filmstripPositionOf.set(pointIndex, position);
      const point = points[pointIndex];
      return { thumbnailUrl: imageUrlOf(point) ?? '', label: point.geoid };
    });
  }

  /** 沿链取相对位置的点位下标（只算不改状态，供预取使用） */
  function neighborIndexAt(fromIndex: number, delta: number): number | undefined {
    const location = order.locate.get(fromIndex);
    if (!location) return undefined;
    return order.chains[location.chain][location.pos + delta];
  }

  /** 由点位组装浮窗切换结果（含行进方位与胶片位置） */
  function neighborOf(pointIndex: number, imageUrl: string, geoid: string): StreetViewPanoramaNeighbor {
    return {
      imageUrl,
      subtitle: subtitleOf(points[pointIndex], geoid),
      index: pointIndex,
      heading: order.bearing.get(pointIndex) ?? null,
      filmstripIndex: filmstripPositionOf.get(pointIndex)
    };
  }

  /**
   * 打开指定街景点的全景。
   *
   * 只开一次浮窗：前进/后退、胶片跳转都复用同一个 PSV 实例（回调驱动），
   * 否则每切一次就重建 WebGL 上下文，切换会明显发卡。
   */
  async function openPanoramaAt(targetIndex: number): Promise<void> {
    const point = points[targetIndex];
    if (!point) return;
    currentIndex = targetIndex;
    focusOn(targetIndex);
    const loading = window.$message?.loading(`正在获取「${s.name}」街景全景图…`, { duration: 0 });
    try {
      const image = await source.resolveImage(point.lon, point.lat);
      openStreetViewPanorama(image.imageUrl, {
        title: s.name,
        subtitle: subtitleOf(point, image.geoid),
        position: { index: targetIndex, total: points.length },
        heading: order.bearing.get(targetIndex) ?? null,
        navigate: delta => navigateBy(delta),
        prefetch: delta => prefetchImage(delta),
        locate: () => focusOn(currentIndex),
        filmstrip: filmstripItems,
        filmstripIndex: filmstripPositionOf.get(targetIndex),
        jumpTo: position => jumpToFilmstrip(position),
        autoPlayIntervalMs: source.kind === 'local' ? STREETVIEW_AUTOPLAY_INTERVAL_MS : undefined
      });
    } catch (e) {
      const reason = e instanceof StreetViewError ? e.message : '街景全景图请求失败，请检查数据服务地址与网络';
      window.$message?.error(`「${s.name}」${reason}`);
      console.error('[streetview] 打开全景失败：', e);
    } finally {
      loading?.destroy();
    }
  }

  /**
   * ←/→ 前进/后退：沿街景链取下一个点。
   *
   * 用链内位置步进而不是数组下标 ±1：原始数组顺序与路网无关，
   * 按它走会出现「跳过一个街区」的跳跃（见 route-order.ts 的推导理由）。
   */
  async function navigateBy(delta: 1 | -1): Promise<StreetViewPanoramaNeighbor | null> {
    const nextIndex = neighborIndexAt(currentIndex, delta);
    if (nextIndex === undefined) return null;
    const point = points[nextIndex];
    const image = await source.resolveImage(point.lon, point.lat);
    currentIndex = nextIndex;
    focusOn(nextIndex);
    return neighborOf(nextIndex, image.imageUrl, image.geoid);
  }

  /** 预取下一张（不动当前位置，只为切换提速） */
  async function prefetchImage(delta: 1 | -1): Promise<string | null> {
    const nextIndex = neighborIndexAt(currentIndex, delta);
    if (nextIndex === undefined) return null;
    const point = points[nextIndex];
    const image = await source.resolveImage(point.lon, point.lat);
    return image.imageUrl;
  }

  /** 胶片点击：跳到漫游路线上的第 position 个街景点 */
  async function jumpToFilmstrip(position: number): Promise<StreetViewPanoramaNeighbor | null> {
    const targetIndex = longestChain[position];
    if (targetIndex === undefined) return null;
    const point = points[targetIndex];
    const image = await source.resolveImage(point.lon, point.lat);
    currentIndex = targetIndex;
    focusOn(targetIndex);
    return neighborOf(targetIndex, image.imageUrl, image.geoid);
  }

  // 6) 点击拾取：登记到 Viewer 的共享分发器（多街景服务同时启用时只打开最近的一个）
  function hitTest(position: Cartesian2): StreetViewPickResult | null {
    // 优先精确拾取点图元：下标直接写在图元 id 上，O(1)
    const picked = viewer.scene.pick(position) as { id?: unknown } | undefined;
    const pickedIndex = typeof picked?.id === 'number' ? picked.id : -1;
    if (pickedIndex >= 0 && pickedIndex < points.length) {
      return { index: pickedIndex, distance: 0 };
    }

    // 兜底：点在点位之间落下时用网格索引就近取点（容差内才触发，避免点远处也弹全景）
    const cartesian = viewer.camera.pickEllipsoid(position, viewer.scene.globe.ellipsoid);
    if (!cartesian) return null;
    const cartographic = Cartographic.fromCartesian(cartesian);
    const lon = CesiumMath.toDegrees(cartographic.longitude);
    const lat = CesiumMath.toDegrees(cartographic.latitude);
    const index = pointsIndex.findNearest(lon, lat, NEAREST_MAX_METERS);
    if (index < 0) return null;
    const point = points[index];
    return { index, distance: distanceMeters(lon, lat, point.lon, point.lat) };
  }

  const unregisterPicker = registerStreetViewPicker(viewer, {
    id: s.id,
    hitTest,
    open: index => void openPanoramaAt(index)
  });

  /** 场景页的「开始浏览 / 上一处 / 下一处」：顺序只在加载器内部可知，故作为能力对外 */
  const controller: StreetViewController = {
    open(index?: number) {
      const target = index ?? longestChain[0] ?? -1;
      if (target >= 0) void openPanoramaAt(target);
    },
    step(delta: 1 | -1) {
      if (currentIndex < 0) {
        const start = delta === 1 ? longestChain[0] : longestChain[longestChain.length - 1];
        if (start !== undefined) void openPanoramaAt(start);
        return;
      }
      const next = neighborIndexAt(currentIndex, delta);
      if (next === undefined) {
        window.$message?.info(delta === 1 ? '已是最后一处街景' : '已是第一处街景');
        return;
      }
      void openPanoramaAt(next);
    }
  };

  // 7) 句柄
  const handle: ServiceLayerHandle = {
    id: s.id,
    category: s.category,
    type: s.type,
    name: s.name,
    state: 'ready',
    visible: true,
    streetview: {
      source: source.kind,
      points: points.length,
      chains: order.chains,
      coordinates,
      ordered: order.derived
    },
    streetviewController: controller,
    show() {
      collection.show = true;
      this.visible = true;
    },
    hide() {
      collection.show = false;
      this.visible = false;
    },
    remove() {
      unregisterPicker();
      if (!viewer.isDestroyed()) {
        routeEntities.forEach(entity => viewer.entities.remove(entity));
        viewer.scene.primitives.remove(collection);
      }
    },
    setOpacity() {
      /* 街景点为批渲染点图元，不支持整体透明度 */
    },
    flyTo() {
      const rect = parseExtentRectangle(s);
      if (rect) {
        flyToRectangle(viewer, rect);
        return;
      }
      // 无 extent 时飞到街景点集合的包围范围
      const pointsRect = rectangleFromCoordinates(points.map(point => [point.lon, point.lat]));
      if (pointsRect) {
        flyToRectangle(viewer, pointsRect);
      } else {
        window.$message?.warning(`「${s.name}」未配置数据范围（extent），无法定位`);
      }
    }
  };
  return handle;
}

// ─── 注册表初始化 ───────────────────────────────────────

registerServiceFactory('imagery', 'xyz', createImageryHandle);
registerServiceFactory('imagery', 'tms', createImageryHandle);
registerServiceFactory('imagery', 'wms', createImageryHandle);
registerServiceFactory('imagery', 'wmts', createImageryHandle);
registerServiceFactory('imagery', 'arcgis', createImageryHandle);
registerServiceFactory('terrain', 'quantized-mesh', createTerrainHandle);
registerServiceFactory('terrain', 'elevation', createTerrainHandle);
registerServiceFactory('threed', '3dtiles', createTilesetHandle);
registerServiceFactory('threed', 'gltf', createTilesetHandle);
registerServiceFactory('threed', 'glb', createTilesetHandle);
registerServiceFactory('vector', 'geojson', createVectorHandle);
registerServiceFactory('vector', 'kml', createVectorHandle);
registerServiceFactory('vector', 'wfs', createVectorHandle);
registerServiceFactory('vector', 'mvt', createVectorHandle);
registerServiceFactory('streetview', 'panorama', createStreetViewHandle);

/**
 * 加载服务：查表 + 状态机包装。
 *
 * 状态机：调用方拿到的是同一 proxy 句柄，工厂返回后 state 变 ready，
 * 工厂抛错则 state 变 error 并记录 error 信息。
 *
 * existing：外部预置的句柄（通常是已登记到面板的 loading 占位）。
 * 传入时直接在原对象上原地更新字段，保证面板里那一条目能从「加载中」
 * 过渡到 ready / error —— 服务不可达导致请求长期挂起时，条目依然可见。
 */
export async function loadService(
  s: Api.DataService.DataServiceItem,
  viewer: Viewer,
  existing?: ServiceLayerHandle
): Promise<ServiceLayerHandle> {
  const key = serviceKey(s);
  const factory = registry.get(key);
  const proxy: ServiceLayerHandle = existing ?? {
    id: s.id,
    category: s.category,
    type: s.type,
    name: s.name,
    state: 'loading',
    visible: false,
    opacity: 1,
    show() {},
    hide() {},
    remove() {},
    setOpacity(opacity: number) {
      // 加载期间用户调过的透明度也要记住，工厂返回后统一回放
      this.opacity = opacity;
    }
  };
  if (!factory) {
    proxy.state = 'error';
    proxy.error = `服务类型不支持（${key}），请在数据服务管理页检查`;
    proxy.visible = false;
    return proxy;
  }
  try {
    const real = await factory(s, viewer);
    // 加载期间用户可能已切换过显隐/透明度，以用户意图为准，不被后续加载结果覆盖
    const keepVisible = proxy.visible;
    const keepOpacity = proxy.opacity;
    proxy.show = real.show;
    proxy.hide = real.hide;
    proxy.remove = real.remove;
    proxy.setOpacity = real.setOpacity;
    proxy.flyTo = real.flyTo;
    proxy.layer = real.layer;
    proxy.legend = real.legend;
    proxy.streetview = real.streetview;
    proxy.streetviewController = real.streetviewController;
    proxy.state = 'ready';
    if (keepVisible) proxy.show();
    else proxy.hide();
    // 透明度同理回放（不支持透明度的类型是空实现，调用无副作用）
    if (keepOpacity !== undefined && keepOpacity !== 1) proxy.setOpacity(keepOpacity);
  } catch (e) {
    proxy.state = 'error';
    proxy.error = e instanceof Error ? e.message : '加载失败';
    // 图层不可用：眼睛置为关闭，避免列表显示「已显示」但球上无图层
    proxy.visible = false;
  }
  return proxy;
}
