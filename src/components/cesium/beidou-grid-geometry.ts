import {
  Cartesian3,
  Color,
  GeometryInstance,
  Material,
  MaterialAppearance,
  PolygonGeometry,
  PolygonHierarchy,
  PolylineGeometry,
  PolylineMaterialAppearance,
  Primitive,
  type Viewer
} from 'cesium';
import { GRID_STEPS, MAX_LEVEL, POLAR_LAT_LIMIT, clamp, rangeAlignToLevel, type GeoRect } from './beidou-grid-code';

/**
 * 北斗网格「局部精确模式」几何渲染。
 *
 * 与早期实现的差别：
 * 1. 按「经纬线集合」生成 —— 经线、纬线各一次，消除每格 4 条边的重复（几何量 O(n+m) 而非 O(n·m)）；
 * 2. 按子矩形分块为多个 Primitive，利用 Cesium 对 Primitive 包围球的内建视锥剔除，
 *    实现「离开视野即不渲染」；
 * 3. 支持高度层与立体网格柱。
 *
 * 注意：高度分层为等距示意（与国标对数高度域编码不一致，面板需显式标注）。
 */

export interface BeidouGridGeometryOptions {
  outline?: boolean;
  faces?: boolean;
  lineColor?: string;
  fillColor?: string;
  extrudeColor?: string;
}

export interface BeidouGridGeometryStats {
  /** 经向格数 */
  cols: number;
  /** 纬向格数 */
  rows: number;
  /** 二维格子总数 */
  cells: number;
  /** 高度层数 */
  layers: number;
  /** 线条总数 */
  lineCount: number;
  /** 分块数（决定 Cesium 剔除粒度） */
  chunkCount: number;
  /** 生成耗时（毫秒） */
  durationMs: number;
}

/** 每块最多包含的格数（经向 × 纬向），决定包围球剔除的粒度 */
const CHUNK_CELLS = 48;
/** 局部精确模式的格子数上限（超出应改用大面积模式） */
export const MAX_LOCAL_CELLS = 8000;
/** 立体层的厚度基准：与该级纬向步长的地面长度成比例（示意，非国标高度分层） */
const METERS_PER_DEG_LAT = 110574;

const DEFAULT_LINE_COLOR = 'rgba(255, 255, 255, 0.55)';
/** 网格面：功能色绿（#34D399），用于区分格块与底图；透明度需高于线色才不会被底图压掉 */
const DEFAULT_FILL_COLOR = 'rgba(52, 211, 153, 0.3)';
const DEFAULT_EXTRUDE_COLOR = 'rgba(141, 184, 255, 0.4)';

/** 预估给定范围在指定层级下的格数（供面板预检，避免生成时才发现超限） */
export function estimateGridCells(rect: GeoRect, level: number): { cols: number; rows: number; cells: number } {
  const lv = clamp(Math.floor(level), 1, MAX_LEVEL);
  const step = GRID_STEPS[lv - 1];
  const aligned = rangeAlignToLevel(rect, lv);
  const cols = Math.max(0, Math.round((aligned.east - aligned.west) / step.lon));
  const rows = Math.max(0, Math.round((aligned.north - aligned.south) / step.lat));
  return { cols, rows, cells: cols * rows };
}

export class BeidouGridGeometry {
  outline: boolean;
  faces: boolean;
  lineColor: string;
  fillColor: string;
  extrudeColor: string;

  private readonly viewer: Viewer;
  private primitives: Primitive[] = [];

  constructor(viewer: Viewer, options: BeidouGridGeometryOptions = {}) {
    this.viewer = viewer;
    this.outline = options.outline ?? true;
    this.faces = options.faces ?? false;
    this.lineColor = options.lineColor ?? DEFAULT_LINE_COLOR;
    this.fillColor = options.fillColor ?? DEFAULT_FILL_COLOR;
    this.extrudeColor = options.extrudeColor ?? DEFAULT_EXTRUDE_COLOR;
  }

  /** 生成局部网格（先清除旧的），返回统计信息 */
  build(rect: GeoRect, level: number, heightCount = 1): BeidouGridGeometryStats {
    const startedAt = performance.now();
    this.clear();

    const lv = clamp(Math.floor(level), 1, MAX_LEVEL);
    const step = GRID_STEPS[lv - 1];
    const aligned = rangeAlignToLevel(rect, lv);
    const cols = Math.max(0, Math.round((aligned.east - aligned.west) / step.lon));
    const rows = Math.max(0, Math.round((aligned.north - aligned.south) / step.lat));
    const layers = clamp(Math.floor(heightCount), 1, 10);
    const layerHeight = step.lat * METERS_PER_DEG_LAT;

    const stats: BeidouGridGeometryStats = {
      cols,
      rows,
      cells: cols * rows,
      layers,
      lineCount: 0,
      chunkCount: 0,
      durationMs: 0
    };
    if (cols === 0 || rows === 0) {
      stats.durationMs = performance.now() - startedAt;
      return stats;
    }

    const colChunks = Math.ceil(cols / CHUNK_CELLS);
    const rowChunks = Math.ceil(rows / CHUNK_CELLS);
    const chunkCols = Math.ceil(cols / colChunks);
    const chunkRows = Math.ceil(rows / rowChunks);

    for (let ci = 0; ci < colChunks; ci++) {
      for (let ri = 0; ri < rowChunks; ri++) {
        const i0 = ci * chunkCols;
        const j0 = ri * chunkRows;
        const i1 = Math.min(cols, i0 + chunkCols);
        const j1 = Math.min(rows, j0 + chunkRows);
        const chunkRect: GeoRect = {
          west: aligned.west + i0 * step.lon,
          east: aligned.west + i1 * step.lon,
          south: aligned.south + j0 * step.lat,
          north: aligned.south + j1 * step.lat
        };
        stats.chunkCount++;
        stats.lineCount += this.buildChunk(chunkRect, step.lon, step.lat, i0, i1, j0, j1, layers, layerHeight);
      }
    }

    stats.durationMs = performance.now() - startedAt;
    return stats;
  }

  /** 生成单个分块：水平网格环 + 立体竖线 + 可选填充面 */
  private buildChunk(
    chunkRect: GeoRect,
    stepLon: number,
    stepLat: number,
    i0: number,
    i1: number,
    j0: number,
    j1: number,
    layers: number,
    layerHeight: number
  ): number {
    const lineInstances: GeometryInstance[] = [];
    const faceInstances: GeometryInstance[] = [];
    let lineCount = 0;
    // 分块东界即「西界 + 列数 × 经向步长」，无需单独取用
    const { west, south, north } = chunkRect;
    const topHeight = layerHeight * (layers - 1);

    // 极区（|lat| ≥ 88°）按国标合并为单一格：其内不再画经纬线与网格柱。
    // 另外该处的纬线两端点重合于极点（3D 位置相同），Cesium 会判定为退化线段而中断渲染。
    const meridianSouth = Math.max(south, -POLAR_LAT_LIMIT);
    const meridianNorth = Math.min(north, POLAR_LAT_LIMIT);

    if (this.outline) {
      // 经线：每列一条，纵向贯穿本块（极区截断）
      if (meridianNorth > meridianSouth) {
        for (let i = i0; i <= i1; i++) {
          const lon = west + (i - i0) * stepLon;
          for (let l = 0; l < layers; l++) {
            const height = l * layerHeight;
            lineCount++;
            lineInstances.push(
              new GeometryInstance({
                geometry: new PolylineGeometry({
                  positions: Cartesian3.fromDegreesArrayHeights([
                    lon,
                    meridianSouth,
                    height,
                    lon,
                    meridianNorth,
                    height
                  ]),
                  width: 1
                })
              })
            );
          }
        }
      }
      // 纬线：每行一条，横向贯穿本块（极区跳过）。
      // 必须按经向格步密化取点：只给两端点时 Cesium 按大圆插值，跨度大时
      // （全球范围每块可达 180°）纬线会绕极点成弧，看起来就不像纬线了。
      const parallelLons: number[] = [];
      for (let i = i0; i <= i1; i++) parallelLons.push(west + (i - i0) * stepLon);
      for (let j = j0; j <= j1; j++) {
        const lat = south + (j - j0) * stepLat;
        if (Math.abs(lat) >= POLAR_LAT_LIMIT) continue;
        for (let l = 0; l < layers; l++) {
          const height = l * layerHeight;
          const coordinates: number[] = [];
          for (const lon of parallelLons) coordinates.push(lon, lat, height);
          lineCount++;
          lineInstances.push(
            new GeometryInstance({
              geometry: new PolylineGeometry({
                positions: Cartesian3.fromDegreesArrayHeights(coordinates),
                width: 1
              })
            })
          );
        }
      }
      // 立体网格柱：多层时在格点拉竖向线（极区跳过）
      if (layers >= 2) {
        for (let i = i0; i <= i1; i++) {
          const lon = west + (i - i0) * stepLon;
          for (let j = j0; j <= j1; j++) {
            const lat = south + (j - j0) * stepLat;
            if (Math.abs(lat) >= POLAR_LAT_LIMIT) continue;
            lineCount++;
            lineInstances.push(
              new GeometryInstance({
                geometry: new PolylineGeometry({
                  positions: Cartesian3.fromDegreesArrayHeights([lon, lat, 0, lon, lat, topHeight]),
                  width: 1
                })
              })
            );
          }
        }
      }
    }

    if (this.faces && i1 > i0 && j1 > j0) {
      const faceHeight = layers >= 2 ? topHeight : 0;
      for (let i = i0; i < i1; i++) {
        for (let j = j0; j < j1; j++) {
          const lon0 = west + (i - i0) * stepLon;
          const lon1 = lon0 + stepLon;
          const lat0 = south + (j - j0) * stepLat;
          const lat1 = lat0 + stepLat;
          if (Math.abs(lat0) >= POLAR_LAT_LIMIT || Math.abs(lat1) >= POLAR_LAT_LIMIT) continue;
          faceInstances.push(
            new GeometryInstance({
              geometry: new PolygonGeometry({
                polygonHierarchy: new PolygonHierarchy(
                  Cartesian3.fromDegreesArrayHeights([
                    lon0,
                    lat0,
                    faceHeight,
                    lon1,
                    lat0,
                    faceHeight,
                    lon1,
                    lat1,
                    faceHeight,
                    lon0,
                    lat1,
                    faceHeight
                  ])
                ),
                perPositionHeight: true
              })
            })
          );
        }
      }
    }

    // 拾取由门面按数理反算完成，几何不参与拾取可显著降低开销
    if (lineInstances.length > 0) {
      this.addPrimitive(
        new Primitive({
          geometryInstances: lineInstances,
          allowPicking: false,
          appearance: new PolylineMaterialAppearance({
            material: Material.fromType('Color', { color: Color.fromCssColorString(this.lineColor) }),
            translucent: true
          })
        })
      );
    }

    if (faceInstances.length > 0) {
      this.addPrimitive(
        new Primitive({
          geometryInstances: faceInstances,
          allowPicking: false,
          appearance: new MaterialAppearance({
            material: Material.fromType('Color', { color: Color.fromCssColorString(this.fillColor) }),
            translucent: true
          })
        })
      );
    }

    return lineCount;
  }

  /** 整体显隐（不清除几何，供切换显示使用） */
  setVisible(visible: boolean): void {
    this.primitives.forEach(primitive => {
      primitive.show = visible;
    });
  }

  private addPrimitive(primitive: Primitive): void {
    this.viewer.scene.primitives.add(primitive);
    this.primitives.push(primitive);
  }

  /** 清除已生成几何 */
  clear(): void {
    this.primitives.forEach(primitive => {
      this.viewer.scene.primitives.remove(primitive);
    });
    this.primitives = [];
  }

  destroy(): void {
    this.clear();
  }
}
