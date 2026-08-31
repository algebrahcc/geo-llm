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
  Cartesian3,
  Cesium3DTileset,
  CesiumTerrainProvider,
  Color,
  GeographicTilingScheme,
  GeoJsonDataSource,
  HeightReference,
  ImageryLayer,
  KmlDataSource,
  Model,
  Rectangle,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  UrlTemplateImageryProvider,
  Viewer,
  WebMapServiceImageryProvider,
  WebMapTileServiceImageryProvider,
  WebMercatorTilingScheme,
  type Entity,
  type ImageryProvider,
  type TerrainProvider
} from 'cesium';
import MVTImageryProvider from 'mvt-imagery-provider';
import type { StyleSpecification } from 'mvt-imagery-provider';
import { openStreetViewPanorama } from '@/components/cesium/street-view-panorama';

/** 加载状态机 */
export type ServiceLayerState = 'loading' | 'ready' | 'error';

/** 图例项：从服务 style/params 解析出的颜色，供图层面板渲染图例 */
export interface ServiceLayerLegendItem {
  color: string;
  label?: string;
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
  show(): void;
  hide(): void;
  remove(): void;
  setOpacity(opacity: number): void;
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
function resolveUrl(s: Api.DataService.DataServiceItem): string {
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
  return `${import.meta.env.BASE_URL}${s.url}`;
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
      layer.alpha = opacity;
    }
  };
}

// ─── imagery 工厂 ───────────────────────────────────────

async function createImageryProvider(s: Api.DataService.DataServiceItem): Promise<ImageryProvider> {
  const url = resolveUrl(s);
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
  const url = resolveUrl(s);
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
    }
  };
  return handle;
}

// ─── threed 工厂 ────────────────────────────────────────

async function createTilesetHandle(s: Api.DataService.DataServiceItem, viewer: Viewer): Promise<ServiceLayerHandle> {
  const url = resolveUrl(s);
  let primitive: Cesium3DTileset | Model;
  if (s.type === 'gltf' || s.type === 'glb') {
    primitive = await Model.fromGltfAsync({ url });
  } else {
    primitive = await Cesium3DTileset.fromUrl(url);
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
  const tileUrl = resolveUrl(s);
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
  const url = resolveUrl(s);
  const dataSource = s.type === 'kml' ? await KmlDataSource.load(url) : await GeoJsonDataSource.load(url);
  viewer.dataSources.add(dataSource);
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
      if (!viewer.isDestroyed()) {
        viewer.dataSources.remove(dataSource, true);
      }
    },
    setOpacity() {
      /* 矢量数据源不支持整体透明度 */
    }
  };
  return handle;
}

// ─── streetview 工厂（参考 xxfw 街景数据加载）────────────

/** 街景服务接口路径约定（相对服务根地址 url，对齐 xxfw 后端 /streetview/api/*） */
const STREETVIEW_POINTS_PATH = '/api/query/geojson/points';
const STREETVIEW_NEAREST_PATH = '/api/nearest/point';
const STREETVIEW_IMAGE_PATH = '/api/image';

/** 从 GeoJSON 递归提取 [lon, lat] 坐标（支持 MultiPoint / Point / Feature / FeatureCollection） */
function extractStreetPointCoordinates(geojson: unknown): Array<[number, number]> {
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
  // Point / MultiPoint / 裸坐标数组
  push(g.coordinates ?? (Array.isArray(geojson) ? geojson : undefined));
  return result;
}

/** 从 nearest 接口返回中提取 geoid（兼容 {geoid} / {data:{geoid}} / {data:"geoid"}） */
function extractGeoid(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const obj = payload as Record<string, unknown>;
  if (typeof obj.geoid === 'string') return obj.geoid;
  if (obj.data && typeof obj.data === 'object') {
    const d = obj.data as Record<string, unknown>;
    if (typeof d.geoid === 'string') return d.geoid;
  }
  if (typeof obj.data === 'string') return obj.data;
  return undefined;
}

async function fetchJson(url: string): Promise<unknown> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

/** 点击街景点：查最近街景点 geoid → 拼全景图 URL → 打开全景查看器 */
async function openNearestPanorama(
  baseUrl: string,
  lon: number,
  lat: number,
  level: string,
  s: Api.DataService.DataServiceItem
): Promise<void> {
  try {
    const nearestUrl = `${baseUrl}${STREETVIEW_NEAREST_PATH}/${lat}/${lon}`;
    const payload = await fetchJson(nearestUrl);
    const geoid = extractGeoid(payload);
    if (!geoid) {
      window.$message?.warning('未找到附近街景点的全景图');
      return;
    }
    const imageUrl = `${baseUrl}${STREETVIEW_IMAGE_PATH}?level=${level}&geoid=${encodeURIComponent(geoid)}`;
    openStreetViewPanorama(imageUrl, {
      title: s.name,
      subtitle: `${geoid} · ${lon.toFixed(5)}, ${lat.toFixed(5)}`
    });
  } catch (e) {
    window.$message?.error('街景全景图请求失败，请检查街景服务地址');
    console.error('[streetview] nearest 请求失败：', e);
  }
}

/** streetview:panorama 工厂：撒街景点 + 点击拾取最近街景全景图 */
async function createStreetViewHandle(s: Api.DataService.DataServiceItem, viewer: Viewer): Promise<ServiceLayerHandle> {
  const baseUrl = resolveUrl(s).replace(/\/+$/, '');
  const params = parseJson<Record<string, string | number>>(s.params) || {};
  const rid = params.rid ? String(params.rid) : '';
  const level = params.level ? String(params.level) : '4';

  if (!rid) {
    throw new Error('街景服务缺少区域 ID（rid），请在「连接参数」中配置 {"rid":"..."}');
  }

  // 1) 拉取区域所有街景点（响应 data 为字符串化 GeoJSON）
  const pointsUrl = `${baseUrl}${STREETVIEW_POINTS_PATH}?rid=${encodeURIComponent(rid)}`;
  const payload = (await fetchJson(pointsUrl)) as Record<string, unknown>;
  const geojsonStr = typeof payload?.data === 'string' ? payload.data : JSON.stringify(payload?.data ?? payload);
  const coordinates = extractStreetPointCoordinates(JSON.parse(geojsonStr));
  if (coordinates.length === 0) {
    throw new Error('街景服务未返回任何街景点坐标');
  }

  // 2) 撒点：每个街景点一个 entity，经纬度/笛卡尔坐标登记到 Map 供点击拾取
  const pointLatLon = new Map<string, { lon: number; lat: number; cartesian: Cartesian3 }>();
  const pointEntities: Entity[] = [];
  coordinates.forEach(([lon, lat], index) => {
    const id = `streetview-${s.id}-${index}`;
    const cartesian = Cartesian3.fromDegrees(lon, lat, 0);
    pointLatLon.set(id, { lon, lat, cartesian });
    pointEntities.push(
      viewer.entities.add({
        id,
        position: cartesian,
        point: {
          pixelSize: 11,
          color: Color.fromCssColorString('#ff4d8d').withAlpha(0.95),
          outlineColor: Color.WHITE,
          outlineWidth: 1.5,
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      })
    );
  });

  // 3) 点击拾取街景点 → 查最近街景全景图
  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((movement: ScreenSpaceEventHandler.PositionedEvent) => {
    // 优先精确拾取街景点 entity
    const picked = viewer.scene.pick(movement.position);
    const entityId = (picked as { id?: { id?: unknown } } | undefined)?.id?.id;
    let ll = pointLatLon.get(String(entityId));

    // 兜底：未点中点时，反算地表点并命中距离阈值内的最近街景点
    if (!ll) {
      const cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid);
      if (cartesian) {
        let best: { lon: number; lat: number; cartesian: Cartesian3 } | undefined;
        let bestDist = Number.POSITIVE_INFINITY;
        for (const p of pointLatLon.values()) {
          const d = Cartesian3.distance(cartesian, p.cartesian);
          if (d < bestDist) {
            bestDist = d;
            best = p;
          }
        }
        // 阈值 100 米内才触发，避免点击远处误弹全景
        if (best && bestDist < 100) ll = best;
      }
    }

    if (!ll) return;
    void openNearestPanorama(baseUrl, ll.lon, ll.lat, level, s);
  }, ScreenSpaceEventType.LEFT_CLICK);

  // 4) 句柄
  const handle: ServiceLayerHandle = {
    id: s.id,
    category: s.category,
    type: s.type,
    name: s.name,
    state: 'ready',
    visible: true,
    show() {
      pointEntities.forEach(e => {
        e.show = true;
      });
      this.visible = true;
    },
    hide() {
      pointEntities.forEach(e => {
        e.show = false;
      });
      this.visible = false;
    },
    remove() {
      handler.destroy();
      if (!viewer.isDestroyed()) {
        pointEntities.forEach(e => viewer.entities.remove(e));
      }
    },
    setOpacity() {
      /* 街景点为点实体，不支持整体透明度 */
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
    show() {},
    hide() {},
    remove() {},
    setOpacity() {}
  };
  if (!factory) {
    proxy.state = 'error';
    proxy.error = `服务类型不支持（${key}），请在数据服务管理页检查`;
    proxy.visible = false;
    return proxy;
  }
  try {
    const real = await factory(s, viewer);
    // 加载期间用户可能已切换过显隐，以用户意图为准，不被后续加载结果覆盖
    const keepVisible = proxy.visible;
    proxy.show = real.show;
    proxy.hide = real.hide;
    proxy.remove = real.remove;
    proxy.setOpacity = real.setOpacity;
    proxy.layer = real.layer;
    proxy.legend = real.legend;
    proxy.state = 'ready';
    if (keepVisible) proxy.show();
    else proxy.hide();
  } catch (e) {
    proxy.state = 'error';
    proxy.error = e instanceof Error ? e.message : '加载失败';
    // 图层不可用：眼睛置为关闭，避免列表显示「已显示」但球上无图层
    proxy.visible = false;
  }
  return proxy;
}
