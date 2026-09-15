import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  CustomDataSource,
  LabelCollection,
  LabelStyle,
  Math as CesiumMath,
  Rectangle,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  type Entity,
  type ImageryLayer,
  type ImageryProvider,
  type TilingScheme,
  type Viewer
} from 'cesium';
import {
  GRID_STEPS,
  MAX_LEVEL,
  POLAR_LAT_LIMIT,
  clamp,
  getFullGridCode,
  parseGridCode,
  pickGridLevelByTileExtent,
  rangeAlignToLevel,
  resolveGridCell,
  type GeoRect,
  type GridCodeRect
} from './beidou-grid-code';
import { BeidouGridGeometry, MAX_LOCAL_CELLS, estimateGridCells } from './beidou-grid-geometry';
import { BeidouGridTileProvider, MIN_FILL_PX } from './beidou-grid-tile-provider';

/**
 * 北斗网格位置码（GB/T 39409-2020）统一门面。
 *
 * - 大面积模式：瓦片 Provider 借 Cesium 瓦片调度实现 LOD 与视锥裁剪；
 * - 局部精确模式：分块 Primitive 几何 + 立体网格柱；
 * - 标签独立成层：相机静止后节流刷新，按格子屏幕尺寸抽稀与隐藏；
 * - 拾取：屏幕坐标反算经纬度后按数理求码，命中宿主既有图元时让位；
 * - 定位与查询：按码反解、按坐标求码。
 */

export type BeidouGridMode = 'tile' | 'geometry';

export interface BeidouGridRectangle extends GeoRect {}

export interface BeidouGridOptions {
  mode?: BeidouGridMode;
  /** 网格层级；'auto' 表示随视野自适应 */
  level?: number | 'auto';
  showOutline?: boolean;
  showFaces?: boolean;
  /** 是否显示编码标签 */
  labels?: boolean;
  tilingScheme?: TilingScheme;
}

export interface BeidouGridStats {
  mode: BeidouGridMode;
  /** 当前实际生效层级 */
  activeLevel: number;
  /** 已绘制的影像瓦片累计数（反映当前视野规模） */
  paintedTiles: number;
  /** 局部精确模式的格子数 */
  localCellCount: number;
  /** 局部网格高度层数（1 为贴地平面网格，≥2 为立体网格柱） */
  localLayers: number;
  /** 当前标签数 */
  labelCount: number;
  /** 网格面是否实际填充（当前层级格子在屏幕上过小时整体隐藏，避免拼块与糊图） */
  faceFillVisible: boolean;
  /** 当前生效层级格子的屏幕像素尺寸（0 表示未取到） */
  faceCellPixels: number;
  /** 锁级过密而跳过绘制 */
  skippedByDensity: boolean;
}

export interface GridPickResult {
  code: string;
  level: number;
  longitude: number;
  latitude: number;
  rect: GridCodeRect;
}

/** 格子屏幕尺寸小于该像素时不显示标签（斜视同样按相机高度换算，避免过早隐藏） */
const MIN_LABEL_CELL_PX = 46;
/** 标签总量上限 */
const MAX_LABELS = 120;
/** 标签在经向 / 纬向的最大排布数（乘积即上限内的抽稀网格） */
const LABEL_COLUMNS = 12;
const LABEL_ROWS = 10;
/** 相机静止后的刷新节流 */
const SETTLE_THROTTLE_MS = 180;
const METERS_PER_DEG_LON = 111320;
/** 立体网格高度层数上限（与几何实现一致） */
export const MAX_HEIGHT_LAYERS = 10;

export class BeidouGrid {
  readonly provider: BeidouGridTileProvider;
  readonly geometry: BeidouGridGeometry;

  private readonly viewer: Viewer;
  private readonly labelCollection: LabelCollection;
  private readonly highlightSource: CustomDataSource;

  private tileLayer: ImageryLayer | null = null;
  private highlightEntity: Entity | null = null;
  private pickEventHandler: ScreenSpaceEventHandler | null = null;
  private readonly pickHandlers = new Set<(result: GridPickResult) => void>();
  private cameraListener: (() => void) | null = null;
  private settleTimer: number | null = null;

  private mode: BeidouGridMode;
  private lockedLevel: number | null;
  private geometryLevel = 5;
  /** 上次生成局部网格的范围与层数：层数变更时据此按原范围重建 */
  private localRect: GeoRect | null = null;
  private localLayers = 1;
  /** 网格面是否填充：按当前生效层级的屏幕格尺寸全局判定，避免逐瓦片判定产生拼块 */
  private faceFillVisible = true;
  /** 当前生效层级的格子在屏幕上的像素尺寸（供面板提示，0 表示取不到） */
  private faceCellPixels = 0;
  /** 按屏幕跨度推算的生效层级（供状态显示；stats.gridLevel 仅为最后请求瓦片的级别，不代表当前视野） */
  private faceLevel = 1;
  private visible = true;
  private labelsEnabled: boolean;
  private localCellCount = 0;
  private labelCount = 0;
  private destroyed = false;

  constructor(viewer: Viewer, options: BeidouGridOptions = {}) {
    this.viewer = viewer;
    this.mode = options.mode ?? 'tile';
    this.labelsEnabled = options.labels ?? false;
    this.lockedLevel =
      options.level === undefined || options.level === 'auto' ? null : clamp(Math.floor(options.level), 1, MAX_LEVEL);

    this.provider = new BeidouGridTileProvider({
      tilingScheme: options.tilingScheme,
      outline: options.showOutline ?? true,
      faces: options.showFaces ?? false,
      lockedLevel: this.lockedLevel
    });
    this.geometry = new BeidouGridGeometry(viewer, {
      outline: options.showOutline ?? true,
      faces: options.showFaces ?? false
    });
    this.labelCollection = viewer.scene.primitives.add(new LabelCollection());
    this.highlightSource = new CustomDataSource('beidou-grid-highlight');
    void viewer.dataSources.add(this.highlightSource);

    if (this.mode === 'tile') this.recreateTileLayer();
    this.bindCamera();
  }

  get stats(): Readonly<BeidouGridStats> {
    return {
      mode: this.mode,
      activeLevel: this.faceLevel,
      paintedTiles: this.provider.paintedTiles,
      localCellCount: this.localCellCount,
      localLayers: this.localLayers,
      labelCount: this.labelCount,
      faceFillVisible: this.faceFillVisible,
      faceCellPixels: Math.round(this.faceCellPixels),
      skippedByDensity: this.provider.stats.skippedByDensity
    };
  }

  // ─────────────── 模式与参数 ───────────────

  setMode(mode: BeidouGridMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    if (mode === 'tile') {
      this.geometry.setVisible(false);
      this.syncFaceFill();
      this.recreateTileLayer();
    } else {
      if (this.tileLayer) this.tileLayer.show = false;
      this.geometry.setVisible(this.visible);
    }
    this.scheduleSettle();
    this.requestRender();
  }

  /** 设置层级：数值为锁定级别，'auto' 为随视野自适应 */
  setLevel(level: number | 'auto'): void {
    const next = level === 'auto' ? null : clamp(Math.floor(level), 1, MAX_LEVEL);
    if (next === this.lockedLevel) return;
    this.lockedLevel = next;
    this.provider.lockedLevel = next;
    this.provider.resetLevelCache();
    this.syncFaceFill();
    if (this.mode === 'tile') this.recreateTileLayer();
    this.scheduleSettle();
    this.requestRender();
  }

  setVisibility(patch: { outline?: boolean; faces?: boolean; labels?: boolean }): void {
    let tilesDirty = false;
    if (patch.outline !== undefined && patch.outline !== this.provider.outline) {
      this.provider.outline = patch.outline;
      this.geometry.outline = patch.outline;
      tilesDirty = true;
    }
    if (patch.faces !== undefined && patch.faces !== this.provider.faces) {
      this.provider.faces = patch.faces;
      this.geometry.faces = patch.faces;
      // 填充判定与显示开关独立：开启前先按当前视野重算，避免用到过期的判定
      this.syncFaceFill();
      tilesDirty = true;
    }
    if (patch.labels !== undefined) this.labelsEnabled = patch.labels;
    if (tilesDirty && this.mode === 'tile') this.recreateTileLayer();
    this.scheduleSettle();
    this.requestRender();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (this.tileLayer) this.tileLayer.show = visible && this.mode === 'tile';
    this.geometry.setVisible(visible && this.mode === 'geometry');
    this.labelCollection.show = visible;
    this.refreshLabels();
    this.requestRender();
  }

  // ─────────────── 局部精确模式 ───────────────

  /** 预估格数（不生成），供面板预检 */
  estimateLocal(rect: GeoRect, level: number): number {
    return estimateGridCells(rect, level).cells;
  }

  /** 生成局部网格；超过上限时返回 estimated 且不生成 */
  buildLocal(
    rect: GeoRect,
    level: number,
    heightCount = 1
  ): { cellCount: number; estimated: number; tooLarge: boolean } {
    const lv = clamp(Math.floor(level), 1, MAX_LEVEL);
    const estimated = estimateGridCells(rect, lv).cells;
    if (estimated > MAX_LOCAL_CELLS) {
      this.geometry.clear();
      this.localCellCount = 0;
      this.localRect = null;
      return { cellCount: 0, estimated, tooLarge: true };
    }
    this.geometryLevel = lv;
    this.localRect = { ...rect };
    this.localLayers = clamp(Math.floor(heightCount), 1, MAX_HEIGHT_LAYERS);
    const result = this.geometry.build(rect, lv, this.localLayers);
    this.geometry.setVisible(this.visible && this.mode === 'geometry');
    this.localCellCount = result.cells;
    this.scheduleSettle();
    this.requestRender();
    return { cellCount: result.cells, estimated, tooLarge: false };
  }

  /**
   * 设置局部网格高度层数：1 为贴地平面网格，≥2 生成立体网格柱。
   * 已生成网格时按原范围立即重建，使层数调整无需重新点生成。
   * 返回是否实际重建了几何。
   */
  setLocalLayers(count: number): boolean {
    const next = clamp(Math.floor(count), 1, MAX_HEIGHT_LAYERS);
    if (next === this.localLayers) return false;
    this.localLayers = next;
    const rect = this.localRect;
    if (!rect) return false;
    const result = this.geometry.build(rect, this.geometryLevel, next);
    this.geometry.setVisible(this.visible && this.mode === 'geometry');
    this.localCellCount = result.cells;
    this.scheduleSettle();
    this.requestRender();
    return true;
  }

  clearLocal(): void {
    this.geometry.clear();
    this.localCellCount = 0;
    this.localRect = null;
    this.scheduleSettle();
    this.requestRender();
  }

  // ─────────────── 拾取 / 查询 / 定位 ───────────────

  setPickEnabled(enabled: boolean): void {
    if (enabled === (this.pickEventHandler !== null)) return;
    if (!enabled) {
      this.pickEventHandler?.destroy();
      this.pickEventHandler = null;
      return;
    }
    const handler = new ScreenSpaceEventHandler(this.viewer.scene.canvas);
    handler.setInputAction((movement: unknown) => {
      this.handlePick((movement as { position: Cartesian2 }).position);
    }, ScreenSpaceEventType.LEFT_CLICK);
    this.pickEventHandler = handler;
  }

  /** 订阅拾取结果，返回取消订阅函数 */
  onPick(handler: (result: GridPickResult) => void): () => void {
    this.pickHandlers.add(handler);
    return () => this.pickHandlers.delete(handler);
  }

  queryCell(longitude: number, latitude: number, level: number): GridPickResult {
    const cell = resolveGridCell(longitude, latitude, level);
    return {
      code: cell.code,
      level: cell.level,
      longitude,
      latitude,
      rect: { west: cell.west, south: cell.south, east: cell.east, north: cell.north, level: cell.level }
    };
  }

  /** 按码定位并高亮；编码非法返回 null */
  highlightByCode(code: string, flyTo = false): GridPickResult | null {
    const parsed = parseGridCode(code);
    if (!parsed) return null;
    this.clearHighlight();
    const centerLon = (parsed.west + parsed.east) / 2;
    const centerLat = (parsed.south + parsed.north) / 2;
    this.highlightEntity = this.highlightSource.entities.add({
      rectangle: {
        coordinates: Rectangle.fromDegrees(parsed.west, parsed.south, parsed.east, parsed.north),
        // 显式给 0 高度：贴地钳制会禁用描边（Cesium 提示 outlines are unsupported on terrain）
        height: 0,
        material: Color.fromCssColorString('rgba(74, 125, 189, 0.35)'),
        outline: true,
        outlineColor: Color.fromCssColorString('rgba(141, 184, 255, 0.95)')
      }
    });
    if (flyTo) {
      this.viewer.camera.flyTo({
        destination: Rectangle.fromDegrees(parsed.west, parsed.south, parsed.east, parsed.north),
        duration: 1.2
      });
    }
    this.requestRender();
    return this.queryCell(centerLon, centerLat, parsed.level);
  }

  clearHighlight(): void {
    if (this.highlightEntity) {
      this.highlightSource.entities.remove(this.highlightEntity);
      this.highlightEntity = null;
      this.requestRender();
    }
  }

  // ─────────────── 释放 ───────────────

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.settleTimer !== null) window.clearTimeout(this.settleTimer);
    this.settleTimer = null;

    // 不依赖 Viewer 的清理先行，保证任何情况下都会执行
    this.setPickEnabled(false);
    this.pickHandlers.clear();
    this.clearHighlight();

    // 以下都需要访问 Viewer，但宿主 Viewer 可能已经先被销毁：
    // 场景页（渡河 / 机动规划）在离开时销毁 Viewer，而本面板是其子组件，
    // 子组件的卸载晚于父组件的销毁逻辑，此时访问 camera 会抛
    // "Cannot read properties of undefined (reading 'scene')"。
    // 该异常会中断路由跳转，表现为「点了返回却没反应」。
    const viewerAlive = !this.viewer.isDestroyed();
    try {
      if (viewerAlive) {
        if (this.cameraListener) {
          this.viewer.camera.moveEnd.removeEventListener(this.cameraListener);
        }
        this.geometry.destroy();
        if (this.tileLayer) {
          this.viewer.imageryLayers.remove(this.tileLayer, true);
        }
        this.viewer.dataSources.remove(this.highlightSource, true);
        this.viewer.scene.primitives.remove(this.labelCollection);
      }
    } catch {
      // 兜底：teardown 阶段绝不向外抛错（抛错会中断路由跳转）
    }

    this.cameraListener = null;
    this.tileLayer = null;
    this.labelCount = 0;
    this.highlightEntity = null;
  }

  // ─────────────── 内部实现 ───────────────

  private currentLevel(): number {
    if (this.lockedLevel) return this.lockedLevel;
    if (this.mode === 'geometry') return this.geometryLevel;
    return clamp(this.provider.stats.gridLevel, 1, MAX_LEVEL);
  }

  private requestRender(): void {
    if (!this.destroyed) this.viewer.scene?.requestRender();
  }

  /** 图层重建：瓦片为同步生成、零网络请求，重挂即可让新参数立即生效 */
  private recreateTileLayer(): void {
    const layers = this.viewer.imageryLayers;
    const index = this.tileLayer ? Math.max(0, layers.indexOf(this.tileLayer)) : layers.length;
    if (this.tileLayer) layers.remove(this.tileLayer, true);

    const layer = layers.addImageryProvider(
      this.provider as unknown as ImageryProvider,
      clamp(index, 0, layers.length)
    );
    layer.show = this.visible && this.mode === 'tile';
    this.tileLayer = layer;
    this.provider.paintedTiles = 0;
    // 宿主新增加载影像服务后仍保持网格在顶层
    layers.raiseToTop(layer);
    this.requestRender();
  }

  private bindCamera(): void {
    const listener = () => this.scheduleSettle();
    this.cameraListener = listener;
    this.viewer.camera.moveEnd.addEventListener(listener);
    this.scheduleSettle();
  }

  /** 相机静止后节流刷新标签（避免连续缩放期间反复重建） */
  private scheduleSettle(): void {
    if (this.destroyed) return;
    if (this.settleTimer !== null) window.clearTimeout(this.settleTimer);
    this.settleTimer = window.setTimeout(() => {
      this.settleTimer = null;
      this.syncFaceFill();
      this.refreshLabels();
    }, SETTLE_THROTTLE_MS);
  }

  private handlePick(position: Cartesian2): void {
    const scene = this.viewer.scene;
    // 命中宿主既有图元/实体时让位，不抢占其交互
    const picked = scene.pick(position);
    if (picked && 'id' in picked && picked.id && picked.id !== this.highlightEntity) return;

    const ray = this.viewer.camera.getPickRay(position);
    const cartesian = ray ? scene.globe.pick(ray, scene) : undefined;
    if (!cartesian) return;
    const carto = Cartographic.fromCartesian(cartesian);
    if (!carto) return;
    const result = this.queryCell(
      CesiumMath.toDegrees(carto.longitude),
      CesiumMath.toDegrees(carto.latitude),
      this.currentLevel()
    );
    this.pickHandlers.forEach(handler => handler(result));
  }

  /** 当前视野范围（度）；视野跨 180° 时退化为全球范围以保证安全 */
  private viewRectangle(): GeoRect | null {
    const rect = this.viewer.camera.computeViewRectangle(this.viewer.scene.globe.ellipsoid);
    if (!rect) return null;
    let west = CesiumMath.toDegrees(rect.west);
    let east = CesiumMath.toDegrees(rect.east);
    const south = clamp(CesiumMath.toDegrees(rect.south), -90, 90);
    const north = clamp(CesiumMath.toDegrees(rect.north), -90, 90);
    if (!(east > west)) {
      west = -180;
      east = 180;
    }
    return { west, south, east, north };
  }

  /**
   * 网格面填充判定：按当前生效层级的格子投影到屏幕的尺寸全局判定一次，下发给 Provider。
   * 逐瓦片判定会因 LOD 混级（不同级别瓦片取到不同网格层级）而出现拼块，故统一为全局开关。
   */
  private syncFaceFill(): void {
    if (this.destroyed) return;
    let cellPixels = 0;
    const metersPerPixel = this.metersPerPixel();
    const view = this.viewRectangle();
    if (metersPerPixel > 0 && view) {
      // 层级来源：立体模式用已生成网格的层级；二维用锁定层级，未锁定时按屏幕跨度套用
      // Provider 同一套选级规则。stats.gridLevel 只是「最后请求的那个瓦片」的级别
      // （初始粗瓦片会把它压低），据此判定与显示都会失真。
      let level: number;
      if (this.mode === 'geometry') {
        level = this.geometryLevel;
      } else {
        const viewSpan = view.east - view.west > 0 ? view.east - view.west : 360;
        level = this.lockedLevel ?? pickGridLevelByTileExtent(viewSpan);
      }
      level = clamp(level, 1, MAX_LEVEL);
      this.faceLevel = level;
      const step = GRID_STEPS[level - 1];
      const centerLat = (view.north + view.south) / 2;
      const cellMeters = step.lon * METERS_PER_DEG_LON * Math.cos(CesiumMath.toRadians(centerLat));
      cellPixels = cellMeters / metersPerPixel;
    }
    this.faceCellPixels = cellPixels;
    // 取不到像素尺寸（0）时不隐藏，避免因缺少信息把填充关掉
    const visible = cellPixels === 0 || cellPixels >= MIN_FILL_PX;
    if (visible === this.faceFillVisible && this.provider.fillEnabled === visible) return;
    this.faceFillVisible = visible;
    this.provider.fillEnabled = visible;
    // 已绘制瓦片按旧判定上色，重建图层让其按新判定重绘
    if (this.mode === 'tile') this.recreateTileLayer();
  }

  /** 相机高度换算的每像素地面米数（比相机到点直线距离更贴合斜视） */
  private metersPerPixel(): number {
    const scene = this.viewer.scene;
    const canvas = scene.canvas;
    const height = this.viewer.camera.positionCartographic.height;
    // 正交/自由投影视锥没有 fovy，取不到时退化为 60°
    const frustum = scene.camera.frustum as { fovy?: number };
    const fovy = typeof frustum.fovy === 'number' ? frustum.fovy : Math.PI / 3;
    if (height > 0 && canvas.clientHeight > 0) {
      return (2 * Math.tan(fovy / 2) * height) / canvas.clientHeight;
    }
    const rect = this.viewRectangle();
    const width = rect ? (rect.east - rect.west) * METERS_PER_DEG_LON : 0;
    return canvas.clientWidth > 0 && width > 0 ? width / canvas.clientWidth : 0;
  }

  private refreshLabels(): void {
    if (this.destroyed) return;
    this.labelCollection.removeAll();
    this.labelCount = 0;
    if (!this.visible || !this.labelsEnabled) {
      this.requestRender();
      return;
    }

    const view = this.viewRectangle();
    if (!view) return;
    const level = this.currentLevel();
    const step = GRID_STEPS[level - 1];

    // 格子在地面的宽度换算成屏幕像素，过小则整层隐藏（细级别在远视距下不再堆字）
    const metersPerPixel = this.metersPerPixel();
    const centerLat = (view.north + view.south) / 2;
    const cellMeters = step.lon * METERS_PER_DEG_LON * Math.cos(CesiumMath.toRadians(centerLat));
    if (metersPerPixel > 0 && cellMeters / metersPerPixel < MIN_LABEL_CELL_PX) {
      this.requestRender();
      return;
    }

    const aligned = rangeAlignToLevel(view, level);
    const cols = Math.max(1, Math.round((aligned.east - aligned.west) / step.lon));
    const rows = Math.max(1, Math.round((aligned.north - aligned.south) / step.lat));
    const lonStride = Math.max(1, Math.ceil(cols / LABEL_COLUMNS));
    const latStride = Math.max(1, Math.ceil(rows / LABEL_ROWS));

    // 标签沿用全站样式：白字 + 深色底衬（与渡河、规划、数据服务图层标注一致），
    // 纯描边在卫星底图上易与纹理混读
    const fill = Color.WHITE;
    const background = Color.fromCssColorString('rgba(5, 13, 24, 0.82)');
    for (let i = 0; i < cols; i += lonStride) {
      for (let j = 0; j < rows; j += latStride) {
        if (this.labelCount >= MAX_LABELS) break;
        const lon = aligned.west + (i + 0.5) * step.lon;
        const lat = aligned.south + (j + 0.5) * step.lat;
        if (lat >= POLAR_LAT_LIMIT || lat <= -POLAR_LAT_LIMIT) continue;
        this.labelCollection.add({
          position: Cartesian3.fromDegrees(lon, lat, 0),
          text: getFullGridCode(lon, lat, level),
          font: 'bold 22px "Microsoft YaHei", sans-serif',
          style: LabelStyle.FILL,
          fillColor: fill,
          showBackground: true,
          backgroundColor: background,
          backgroundPadding: new Cartesian2(6, 3),
          scale: 0.5
        });
        this.labelCount++;
      }
    }
    this.requestRender();
  }
}
