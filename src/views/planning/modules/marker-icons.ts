import type { PlotMarkerKind } from './types';

/**
 * 机动路线规划 — 事件标绘符号集（军队标号风格，一套 6 个）
 *
 * 三条设计约定 —— 这是"看起来像标图、而不是像地图 App 图标"的关键：
 *
 *  1. **不用圆盘、不用地钉**：标图符号就是线条，符号中心对准点位
 *     （billboard 居中 + `verticalOrigin: CENTER`）。深色圆盘加地钉是
 *     地图 App 的"图钉/气泡"语汇，既压底图，也不符合标图习惯。
 *
 *  2. **白勾边 + 主色线，两遍描**：底图可能是浅色城区，也可能是深色水面，
 *     细线不勾边会直接消失。勾边必须先于**全部**主色绘制 ——
 *     否则后画那笔的勾边会盖住先画那笔的主色，符号会出现断口。
 *
 *  3. **颜色只表达性质，形状表达是什么**：事件与障碍一律用军标红，
 *     靠轮廓区分种类，与军队标号"同色不同形"的读图习惯一致。
 *
 * 符号图例（可据此在界面或文档里作图例）：
 *  · 断桥     —— 桥面双线被爆破闪电打断（两端桥台尚存）
 *  · 道路中断 —— 道路线被叉号切断
 *  · 障碍     —— 桩砦 / 阻绝锯齿线
 *  · 损毁     —— 爆破星
 *  · 塌陷     —— 弹坑同心椭圆 + 放射裂纹
 *  · 拥堵     —— 机动箭头受阻于阻滞横杠
 *
 * 为什么用 canvas 现画而不引入 png / svg：`billboard.image` 直接接受
 * `HTMLCanvasElement`，省掉一次解码（svg 经 `createImageBitmap` 在部分浏览器会失败）；
 * 且符号以代码描述，线宽/颜色改一处即全套生效。
 */

/** 符号在屏幕上的显示边长（px） */
export const MARKER_ICON_SIZE = 40;

/** 军标红：本场景"我方情况"用色，与渡河场景的机动箭头同一色值 */
export const MARKER_SYMBOL_COLOR = '#d5443c';

/** 2 倍画布：billboard 缩小采样后，高分屏下线条依然锐利 */
const CANVAS = MARKER_ICON_SIZE * 2;
/** 符号中心（= 标注坐标点） */
const C = CANVAS / 2;
/** 勾边色 */
const HALO = '#ffffff';
/** 默认线宽（2 倍画布上 ≈2.3px 显示，接近标图细线的手感） */
const LINE_WIDTH = 4.5;

interface MarkerSymbolSpec {
  /** 符号的全部子路径；先全部构建、再统一两遍描，避免勾边互相压盖 */
  paths(): Path2D[];
  /** 需要实心的点：[x, y, r]（同样先白后色） */
  dots?(): Array<[number, number, number]>;
  /** 覆盖默认线宽（细部用） */
  width?: number;
}

function polyline(points: Array<[number, number]>): Path2D {
  const path = new Path2D();
  points.forEach(([x, y], index) => {
    if (index === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  });
  return path;
}

function ellipsePath(x: number, y: number, rx: number, ry: number): Path2D {
  const path = new Path2D();
  path.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  return path;
}

export const MARKER_SYMBOLS: Record<PlotMarkerKind, MarkerSymbolSpec> = {
  /** 断桥：桥面双线在中间被炸断，两端桥台保留，断口用爆破闪电标出 */
  'bridge-broken': {
    paths: () => [
      // 左桥面（双线）
      polyline([
        [10, 32],
        [34, 32]
      ]),
      polyline([
        [10, 40],
        [34, 40]
      ]),
      // 右桥面（双线）
      polyline([
        [46, 32],
        [70, 32]
      ]),
      polyline([
        [46, 40],
        [70, 40]
      ]),
      // 两端桥台
      polyline([
        [10, 26],
        [10, 46]
      ]),
      polyline([
        [70, 26],
        [70, 46]
      ]),
      // 爆破闪电（穿过断口）
      polyline([
        [41, 12],
        [35, 29],
        [45, 36],
        [38, 54]
      ])
    ]
  },
  /** 道路中断：道路线被叉号切断 */
  'road-closed': {
    paths: () => [
      polyline([
        [8, 36],
        [72, 36]
      ]),
      polyline([
        [32, 24],
        [48, 48]
      ]),
      polyline([
        [48, 24],
        [32, 48]
      ])
    ]
  },
  /** 障碍（桩砦 / 阻绝）：锯齿线 */
  obstacle: {
    paths: () => [
      polyline([
        [12, 52],
        [20, 26],
        [28, 52],
        [36, 26],
        [44, 52],
        [52, 26],
        [60, 52],
        [68, 26]
      ])
    ]
  },
  /** 损毁（爆破点）：爆破星，八条长短不一的放射线 + 爆心 */
  rubble: {
    paths: () => [
      polyline([
        [C, C],
        [C, 12]
      ]),
      polyline([
        [C, C],
        [60, 20]
      ]),
      polyline([
        [C, C],
        [68, C]
      ]),
      polyline([
        [C, C],
        [58, 58]
      ]),
      polyline([
        [C, C],
        [C, 68]
      ]),
      polyline([
        [C, C],
        [20, 58]
      ]),
      polyline([
        [C, C],
        [12, C]
      ]),
      polyline([
        [C, C],
        [22, 20]
      ])
    ],
    dots: () => [[C, C, 4.5]],
    width: 4
  },
  /** 塌陷（弹坑）：坑口 + 坑底 + 放射裂纹 */
  sinkhole: {
    paths: () => [
      ellipsePath(C, C - 2, 26, 17),
      ellipsePath(C, C - 2, 12, 7.5),
      polyline([
        [20, 26],
        [12, 18]
      ]),
      polyline([
        [60, 26],
        [68, 18]
      ])
    ]
  },
  /** 拥堵（行进受阻）：机动箭头撞上阻滞横杠 */
  congestion: {
    paths: () => [
      polyline([
        [8, C],
        [52, C]
      ]),
      polyline([
        [52, C],
        [40, C - 10]
      ]),
      polyline([
        [52, C],
        [40, C + 10]
      ]),
      polyline([
        [60, 24],
        [60, 56]
      ])
    ]
  }
};

const textureCache = new Map<PlotMarkerKind, HTMLCanvasElement>();

/**
 * 取符号贴图（同 kind 复用同一画布）。
 *
 * 复用渡河场景的结论：2 倍分辨率栅格化 + billboard 缩小采样，
 * 线条边缘在高分屏下才不发虚。
 */
export function getMarkerCanvas(kind: PlotMarkerKind): HTMLCanvasElement {
  const cached = textureCache.get(kind);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS;
  canvas.height = CANVAS;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const spec = MARKER_SYMBOLS[kind];
    const paths = spec.paths();
    const width = spec.width ?? LINE_WIDTH;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 第一遍：白色勾边（略粗）
    ctx.strokeStyle = HALO;
    ctx.lineWidth = width + 3;
    paths.forEach(path => ctx.stroke(path));

    // 第二遍：军标红
    ctx.strokeStyle = MARKER_SYMBOL_COLOR;
    ctx.lineWidth = width;
    paths.forEach(path => ctx.stroke(path));

    // 实心点：先白后色
    spec.dots?.().forEach(([x, y, r]) => {
      ctx.fillStyle = HALO;
      ctx.beginPath();
      ctx.arc(x, y, r + 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = MARKER_SYMBOL_COLOR;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  textureCache.set(kind, canvas);
  return canvas;
}
