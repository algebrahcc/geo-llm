import { Event, Math as CesiumMath, Rectangle, WebMercatorTilingScheme } from 'cesium';
import type { TilingScheme } from 'cesium';
import { GRID_STEPS, POLAR_LAT_LIMIT, clamp, latToTileY, pickGridLevelByTileExtent } from './beidou-grid-code';

/**
 * 北斗网格「大面积模式」瓦片 Provider。
 *
 * 思路：挂一层不发起任何网络请求的假底图 —— requestImage 在浏览器端把该瓦片的网格线
 * 画进 canvas 直接返回。四叉树调度、视锥裁剪、屏幕空间误差、加载优先级、瓦片池全部复用
 * Cesium 已有实现，因此绘制成本与「屏幕内瓦片数」成正比，而不是与网格总数成正比。
 *
 * 与底图一致的墨卡托瓦片方案，故纬度方向需按墨卡托投影做归一化，不能按线性比例换算。
 */

export interface BeidouGridTileProviderOptions {
  tilingScheme?: TilingScheme;
  tileWidth?: number;
  tileHeight?: number;
  minimumLevel?: number;
  maximumLevel?: number;
  outline?: boolean;
  faces?: boolean;
  lineColor?: string;
  fillColor?: string;
  /** 用户锁定的网格层级（null 表示随视野自适应） */
  lockedLevel?: number | null;
}

export interface BeidouGridTileStats {
  /** 最近处理的瓦片级别 */
  tileLevel: number;
  /** 该瓦片级别下实际生效的网格级别 */
  gridLevel: number;
  /** 每瓦片网格线条数 */
  linesPerTile: number;
  /** 因锁级后过密而跳过绘制 */
  skippedByDensity: boolean;
}

/**
 * 网格面填充门槛（屏幕像素）：格子在屏幕上小于该尺寸时整体不填充，避免细碎色块糊住底图。
 * 由门面按「当前生效层级」全局判定后下发（见 fillEnabled），
 * 使同一视野内所有瓦片判定一致——逐瓦片判定会在 LOD 过渡期出现拼块。
 */
export const MIN_FILL_PX = 26;
/** 单瓦片线条数硬上限（防御异常输入导致的极端绘制量） */
const MAX_LINES_HARD = 400;
const EPS = 1e-9;

export class BeidouGridTileProvider {
  tileWidth: number;
  tileHeight: number;
  maximumLevel: number;
  minimumLevel: number;
  tilingScheme: TilingScheme;
  rectangle: Rectangle;
  readonly hasAlphaChannel = true;
  readonly ready = true;
  readonly readyPromise: Promise<boolean> = Promise.resolve(true);
  readonly tileDiscardPolicy = undefined;
  readonly credit = undefined;
  readonly errorEvent = new Event();

  /** 绘制开关（供门面增量更新） */
  outline: boolean;
  faces: boolean;
  /** 网格面是否填充：由门面按屏幕格尺寸全局判定后下发，所有瓦片一致 */
  fillEnabled = true;
  lineColor: string;
  fillColor: string;
  lockedLevel: number | null;

  /** 最近一次瓦片统计（供面板状态区展示） */
  stats: BeidouGridTileStats = { tileLevel: 0, gridLevel: 1, linesPerTile: 0, skippedByDensity: false };

  /** 累计绘制的瓦片数（反映当前视野的瓦片规模） */
  paintedTiles = 0;

  /** 各瓦片级别已选定的网格级别（带滞回，避免缩放时级别抖动） */
  private readonly gridLevelByTileLevel = new Map<number, number>();

  constructor(options: BeidouGridTileProviderOptions = {}) {
    this.tilingScheme = options.tilingScheme ?? new WebMercatorTilingScheme();
    this.tileWidth = options.tileWidth ?? 256;
    this.tileHeight = options.tileHeight ?? 256;
    this.minimumLevel = options.minimumLevel ?? 0;
    this.maximumLevel = options.maximumLevel ?? 20;
    this.outline = options.outline ?? true;
    this.faces = options.faces ?? false;
    this.lineColor = options.lineColor ?? 'rgba(255, 255, 255, 0.42)';
    // 网格面：功能色绿（#34D399），与几何层保持一致；透明度需高于线色才不会被底图压掉
    this.fillColor = options.fillColor ?? 'rgba(52, 211, 153, 0.3)';
    this.lockedLevel = options.lockedLevel ?? null;

    // 极区（国标 88° 以外）在墨卡托下本就不可见，此处按国标裁掉，避免为极冠生成无效瓦片
    const limit = Rectangle.fromDegrees(-180, -POLAR_LAT_LIMIT, 180, POLAR_LAT_LIMIT);
    this.rectangle = Rectangle.intersection(this.tilingScheme.rectangle, limit) ?? this.tilingScheme.rectangle;
  }

  /** 编码内核之外唯一需要按瓦片提供的 Cesium 协议方法：本方案不使用瓦片级版权信息 */
  getTileCredits(): unknown[] {
    return [];
  }

  /** 网格为程序化绘制，不支持要素拾取（拾取由门面按数理反算实现） */
  pickFeatures(): undefined {
    return undefined;
  }

  /** 参数变更后清空级别缓存，使后续瓦片按新参数重新选级 */
  resetLevelCache(): void {
    this.gridLevelByTileLevel.clear();
  }

  /**
   * Cesium 契约要求返回 Promise（`Promise<ImageryTypes> | undefined`）：
   * 直接返回 canvas 会触发 "imagePromise.then is not a function" 并中断渲染。
   * 本方案绘制是同步的，用 Promise.resolve 包装即可。
   */
  requestImage(x: number, y: number, level: number): Promise<HTMLCanvasElement> {
    return Promise.resolve(this.paintTile(x, y, level));
  }

  /** 同步绘制单张瓦片 */
  private paintTile(x: number, y: number, level: number): HTMLCanvasElement {
    this.paintedTiles++;
    const canvas = document.createElement('canvas');
    canvas.width = this.tileWidth;
    canvas.height = this.tileHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const rect = this.tilingScheme.tileXYToRectangle(x, y, level);
    const west = CesiumMath.toDegrees(rect.west);
    const east = CesiumMath.toDegrees(rect.east);
    const south = CesiumMath.toDegrees(rect.south);
    const north = CesiumMath.toDegrees(rect.north);
    const extentLon = east - west;
    if (!(extentLon > 0)) return canvas;

    const gridLevel = this.resolveGridLevel(level, extentLon);
    const step = GRID_STEPS[gridLevel - 1];
    const firstLonIndex = Math.ceil((west - EPS) / step.lon);
    const lastLonIndex = Math.floor((east + EPS) / step.lon);
    const firstLatIndex = Math.ceil((south - EPS) / step.lat);
    const lastLatIndex = Math.floor((north + EPS) / step.lat);
    const lonLines = lastLonIndex - firstLonIndex + 1;
    const latLines = lastLatIndex - firstLatIndex + 1;

    // 锁级后过密：跳过绘制并回报，由面板提示用户改用大面积模式或调低层级
    if (lonLines > MAX_LINES_HARD || latLines > MAX_LINES_HARD) {
      this.stats = { tileLevel: level, gridLevel, linesPerTile: Math.max(lonLines, latLines), skippedByDensity: true };
      return canvas;
    }

    const width = this.tileWidth;
    const height = this.tileHeight;
    const xOf = (lon: number) => ((lon - west) / extentLon) * width;
    const yOf = (lat: number) => this.tileY(lat, north, south) * height;

    // 是否填充由门面按屏幕格尺寸全局判定（fillEnabled）。
    // 这里取「与瓦片相交的全部单元格」并裁剪到瓦片内：相邻瓦片各自补全跨界的格子，
    // 使同一格在各瓦片上的着色连续——若只填「瓦片内的完整格」，
    // 跨界的格子会被两侧同时跳过，出现补丁与缝隙
    if (this.faces && this.fillEnabled) {
      ctx.fillStyle = this.fillColor;
      const startLonIndex = Math.floor((west - EPS) / step.lon);
      const endLonIndex = Math.floor((east + EPS) / step.lon);
      const startLatIndex = Math.floor((south - EPS) / step.lat);
      const endLatIndex = Math.floor((north + EPS) / step.lat);
      for (let i = startLonIndex; i <= endLonIndex; i++) {
        const x0 = Math.max(0, xOf(i * step.lon));
        const x1 = Math.min(width, xOf((i + 1) * step.lon));
        if (!(x1 > x0)) continue;
        for (let j = startLatIndex; j <= endLatIndex; j++) {
          const yA = Math.max(0, Math.min(height, yOf((j + 1) * step.lat)));
          const yB = Math.max(0, Math.min(height, yOf(j * step.lat)));
          const h = Math.abs(yB - yA);
          if (!(h > 0)) continue;
          ctx.fillRect(x0, Math.min(yA, yB), x1 - x0, h);
        }
      }
    }

    if (this.outline) {
      ctx.strokeStyle = this.lineColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = firstLonIndex; i <= lastLonIndex; i++) {
        const px = Math.round(xOf(i * step.lon)) + 0.5;
        ctx.moveTo(px, 0);
        ctx.lineTo(px, height);
      }
      for (let j = firstLatIndex; j <= lastLatIndex; j++) {
        const py = Math.round(yOf(j * step.lat)) + 0.5;
        ctx.moveTo(0, py);
        ctx.lineTo(width, py);
      }
      ctx.stroke();
    }

    this.stats = {
      tileLevel: level,
      gridLevel,
      linesPerTile: Math.max(lonLines, latLines),
      skippedByDensity: false
    };
    return canvas;
  }

  /** 纬度 → 瓦片内归一化 y：墨卡托方案按投影换算，经纬度方案线性换算 */
  private tileY(lat: number, north: number, south: number): number {
    return latToTileY(lat, north, south, this.tilingScheme instanceof WebMercatorTilingScheme);
  }

  /** 选定瓦片的网格层级：锁定级别优先，否则按瓦片跨度自适应并复用滞回缓存 */
  private resolveGridLevel(tileLevel: number, extentLon: number): number {
    if (this.lockedLevel) {
      this.gridLevelByTileLevel.set(tileLevel, this.lockedLevel);
      return clamp(this.lockedLevel, 1, GRID_STEPS.length);
    }
    const cached = this.gridLevelByTileLevel.get(tileLevel);
    const chosen = pickGridLevelByTileExtent(extentLon, cached);
    this.gridLevelByTileLevel.set(tileLevel, chosen);
    return chosen;
  }
}
