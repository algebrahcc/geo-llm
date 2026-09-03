/**
 * 情报点详情卡片（Cesium GeoJSON 数据点点击弹窗）
 *
 * 展示无人机拍摄情报/检测类 GeoJSON 点的标注图与检测摘要：
 * 点击球面数据点 → 右下角浮动卡片显示「标注图 + 类别构成 chips + 检测结论 + 元信息」。
 *
 * UI 与数据目录分析弹窗的检测面板同一设计语言（utils/detect-colors 共享配色）：
 * 类别按稳定哈希取色、最高置信度按分级配色、类别构成以 chips 展示。
 *
 * DOM 单例模式（同 street-view-panorama.ts）：重复打开先关闭上一个，Esc / 关闭按钮关闭。
 * 标题栏支持拖拽移动（overlay-drag.ts 通用工具）。
 * 触发约定：GeoJSON feature 的 properties 里带 `image` 字段即视为情报点。
 */

import { enableOverlayDrag, resetOverlayPosition } from '@/components/cesium/overlay-drag';
import { classColor, confLevel } from '@/utils/detect-colors';

/** 类别构成（GeoJSON properties.classes 元素） */
export interface IntelClassItem {
  name: string;
  count: number;
}

/** 单目标检测框（GeoJSON properties.detectionList 元素，bbox 为原图像素坐标） */
export interface IntelDetectionBox {
  class_name_zh: string;
  class_name: string;
  confidence: number;
  bbox: number[];
}

export interface IntelDetail {
  /** 情报点名称（卡片标题） */
  name?: string;
  /** 检测中文摘要，如「检测到 坦克×10、士兵×6」 */
  summary?: string;
  /** 标注图地址（相对 BASE_URL 或完整 http 地址） */
  image?: string;
  /** 原始图地址（可选，点击标注图切换/对比查看） */
  originImage?: string;
  /** 检出目标数 */
  detections?: number | string;
  /** 最高置信度 0-1（按分级配色：高绿/中蓝/低橙） */
  maxConf?: number | string;
  /** 类别构成（可选，渲染为类别 chips） */
  classes?: IntelClassItem[];
  /** 逐目标检测框（可选，原图叠加中文标签框；与检测面板同一配色体系） */
  detectionList?: IntelDetectionBox[];
  /** 数据来源（valid / test / train） */
  source?: string;
  /** 检测时间 */
  time?: string;
  /** 场景描述 */
  scene?: string;
  /** 使用的模型（military / road） */
  model?: string;
}

interface ActiveCard {
  close: () => void;
}

let active: ActiveCard | null = null;
let styleInjected = false;

function ensureStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const css = `
    .idc-overlay {
      position: fixed; right: 70px; bottom: 18px; z-index: 99998;
      width: min(460px, calc(100vw - 140px));
      background: linear-gradient(180deg, rgba(4, 20, 44, 0.98), rgba(2, 14, 30, 0.98));
      border: 1px solid rgba(43, 131, 255, 0.35);
      border-top: 2px solid rgba(41, 163, 255, 0.45);
      border-radius: 12px; overflow: hidden;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), 0 0 60px rgba(41, 163, 255, 0.06);
      display: flex; flex-direction: column;
      animation: idc-fade .18s ease;
    }
    .idc-overlay__bar {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px;
      background: linear-gradient(90deg, rgba(0, 60, 140, .28), rgba(0, 20, 60, .1));
      border-bottom: 1px solid rgba(43, 131, 255, .3);
      color: #eaf5ff;
    }
    .idc-overlay__badge {
      font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 8px; flex-shrink: 0;
      background: rgba(41, 163, 255, .15); color: #8db8ff; white-space: nowrap;
    }
    .idc-overlay__title {
      font-size: 13px; font-weight: 700; letter-spacing: .3px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .idc-overlay__spacer { flex: 1; }
    .idc-overlay__btn {
      width: 28px; height: 28px; border-radius: 6px; border: 1px solid rgba(45, 111, 183, .35);
      background: rgba(6, 25, 50, .7); color: #cbe3ff; cursor: pointer;
      display: grid; place-items: center; transition: all .2s ease; flex-shrink: 0;
    }
    .idc-overlay__btn:hover { color: #29a3ff; border-color: rgba(70, 176, 255, .5); }
    .idc-overlay__image {
      width: 100%; display: block; background: #010c1a; min-height: 120px; object-fit: contain;
    }
    /* 原图 + 中文检测框叠加（与检测面板同一配色体系） */
    .idc-overlay__frame { position: relative; }
    .idc-overlay__frame img { width: 100%; display: block; }
    .idc-overlay__dbox {
      position: absolute; border: 2px solid; box-sizing: border-box;
      cursor: crosshair; transition: box-shadow .15s ease, opacity .15s ease;
    }
    .idc-overlay__dbox:hover {
      box-shadow: 0 0 0 2px rgba(255, 255, 255, .85), 0 0 14px rgba(41, 163, 255, .5);
      z-index: 3;
    }
    .idc-overlay__dbox--low { border-style: dashed; opacity: .8; }
    .idc-overlay__dbox-tag {
      position: absolute; top: -20px; left: -2px;
      font-size: 11px; font-weight: 600; color: #fff;
      padding: 1px 6px; border-radius: 3px; line-height: 18px;
      white-space: nowrap; pointer-events: none;
      text-shadow: 0 1px 2px rgba(0, 0, 0, .45);
    }
    .idc-overlay__views {
      position: absolute; top: 10px; right: 10px; z-index: 5;
      display: inline-flex; border: 1px solid rgba(43, 131, 255, .35); border-radius: 6px; overflow: hidden;
      background: rgba(2, 10, 20, .8); backdrop-filter: blur(4px);
    }
    .idc-overlay__view-btn {
      padding: 4px 10px; font-size: 11px;
      color: rgba(203, 227, 255, .75); background: transparent; border: none; cursor: pointer;
      transition: all .15s ease;
    }
    .idc-overlay__view-btn--active { color: #eaf5ff; background: rgba(41, 163, 255, .28); font-weight: 600; }
    .idc-overlay__body { padding: 10px 14px 12px; display: flex; flex-direction: column; gap: 8px; }
    .idc-overlay__summary {
      display: flex; align-items: flex-start; gap: 6px;
      font-size: 13px; font-weight: 600; color: #7ee787; line-height: 1.5;
    }
    /* 类别构成 chips（与检测面板同一配色体系） */
    .idc-overlay__classes { display: flex; flex-wrap: wrap; gap: 6px; }
    .idc-overlay__class-chip {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 11px; padding: 2px 9px; border-radius: 10px;
      color: rgba(203, 227, 255, .88); background: rgba(41, 163, 255, .06);
      border: 1px solid rgba(41, 163, 255, .3);
    }
    .idc-overlay__class-dot { width: 7px; height: 7px; border-radius: 50%; }
    .idc-overlay__class-count { color: rgba(147, 196, 255, .7); }
    /* 元信息 pills */
    .idc-overlay__meta { display: flex; flex-wrap: wrap; gap: 6px; }
    .idc-overlay__meta-pill {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 11px; padding: 2px 9px; border-radius: 10px;
      color: rgba(203, 227, 255, .8); background: rgba(2, 18, 36, .6);
      border: 1px solid rgba(25, 95, 176, .3);
    }
    .idc-overlay__meta-label { color: rgba(147, 196, 255, .55); }
    .idc-overlay__meta-value { font-weight: 600; }
    .idc-overlay__meta-value--high { color: #7ee787; }
    .idc-overlay__meta-value--mid { color: #8db8ff; }
    .idc-overlay__meta-value--low { color: #ffb02e; }
    .idc-overlay__scene {
      font-size: 11px; color: rgba(147, 196, 255, .55); line-height: 1.6;
      border-top: 1px solid rgba(25, 95, 176, .18); padding-top: 8px;
    }
    @keyframes idc-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    .idc-overlay--fullscreen {
      right: 0; bottom: 0;
      width: 100vw; height: 100vh;
      border-radius: 0; border: none;
    }
    /* 全屏时图像区占满剩余空间 */
    .idc-overlay--fullscreen .idc-overlay__image {
      flex: 1; min-height: 0; object-fit: contain;
    }
    .idc-overlay--fullscreen .idc-overlay__body {
      flex-shrink: 0; max-height: 40vh; overflow-y: auto;
    }
  `;
  const style = document.createElement('style');
  style.id = 'intel-detail-card-style';
  style.textContent = css;
  document.head.appendChild(style);
}

export function closeIntelDetailCard(): void {
  active?.close();
  active = null;
}

const CLOSE_SVG =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';

const FULLSCREEN_SVG =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';

/** 解析图片地址：完整 http / 根路径原样；否则按前端静态资源相对路径拼 BASE_URL */
function resolveImageUrl(url: string): string {
  if (/^(https?:)?\/\//.test(url) || url.startsWith('/')) return url;
  return `${import.meta.env.BASE_URL}${url}`;
}

/** 来源标注中文 */
const SOURCE_LABELS: Record<string, string> = {
  valid: '验证集',
  test: '测试集',
  train: '训练集'
};

export function openIntelDetailCard(detail: IntelDetail): void {
  active?.close();
  ensureStyle();

  const title = detail.name || '情报点详情';
  const modelBadge = detail.model ? `模型 · ${detail.model}` : '图像情报';
  const maxConf = detail.maxConf === undefined ? undefined : Number(detail.maxConf);

  const overlay = document.createElement('div');
  overlay.className = 'idc-overlay';

  const bar = document.createElement('div');
  bar.className = 'idc-overlay__bar';

  const badge = document.createElement('span');
  badge.className = 'idc-overlay__badge';
  badge.textContent = modelBadge;

  const titleEl = document.createElement('span');
  titleEl.className = 'idc-overlay__title';
  titleEl.textContent = title;
  titleEl.title = title;

  const spacer = document.createElement('span');
  spacer.className = 'idc-overlay__spacer';

  const fullscreenBtn = document.createElement('button');
  fullscreenBtn.className = 'idc-overlay__btn';
  fullscreenBtn.innerHTML = FULLSCREEN_SVG;
  fullscreenBtn.title = '全屏 / 退出全屏';
  fullscreenBtn.addEventListener('click', () => {
    overlay.classList.toggle('idc-overlay--fullscreen');
    // 全屏/还原时回到样式表默认锚点，避免拖拽残留的 left/top 与全屏定位冲突
    resetOverlayPosition(overlay);
  });

  const closeBtn = document.createElement('button');
  closeBtn.className = 'idc-overlay__btn';
  closeBtn.innerHTML = CLOSE_SVG;
  closeBtn.title = '关闭 (Esc)';

  bar.append(badge, titleEl, spacer, fullscreenBtn, closeBtn);

  // 图像区：默认「原图 + 中文检测框」，点击图片显示/隐藏检测框（纯原图对比）
  const boxes = Array.isArray(detail.detectionList) ? detail.detectionList : [];
  const hasBoxes = boxes.length > 0;
  const overlaySrc = detail.originImage || detail.image || '';

  const frame = document.createElement('div');
  frame.className = 'idc-overlay__frame';

  const imageEl = document.createElement('img');
  imageEl.className = 'idc-overlay__image';
  imageEl.alt = title;
  imageEl.src = resolveImageUrl(overlaySrc || detail.image || '');
  frame.appendChild(imageEl);

  // 检测框：图片加载拿到 naturalWidth 后按百分比布局（缩放自适应）
  const boxEls: Array<{ el: HTMLDivElement; d: IntelDetectionBox }> = [];
  if (hasBoxes) {
    let showingBoxes = true;
    boxes.forEach(d => {
      const box = document.createElement('div');
      box.className = `idc-overlay__dbox${confLevel(d.confidence) === 'low' ? ' idc-overlay__dbox--low' : ''}`;
      box.title = `${d.class_name_zh} · 置信度 ${(d.confidence * 100).toFixed(1)}% · bbox [${d.bbox.join(', ')}]`;
      const tag = document.createElement('span');
      tag.className = 'idc-overlay__dbox-tag';
      tag.style.background = classColor(d.class_name_zh || d.class_name);
      tag.textContent = `${d.class_name_zh} ${(d.confidence * 100).toFixed(0)}%`;
      box.appendChild(tag);
      frame.appendChild(box);
      boxEls.push({ el: box, d });
    });

    function layoutBoxes() {
      const nw = imageEl.naturalWidth;
      const nh = imageEl.naturalHeight;
      if (!nw || !nh) return;
      boxEls.forEach(({ el, d }) => {
        const [x1, y1, x2, y2] = d.bbox;
        el.style.left = `${((x1 / nw) * 100).toFixed(3)}%`;
        el.style.top = `${((y1 / nh) * 100).toFixed(3)}%`;
        el.style.width = `${(((x2 - x1) / nw) * 100).toFixed(3)}%`;
        el.style.height = `${(((y2 - y1) / nh) * 100).toFixed(3)}%`;
      });
    }
    imageEl.addEventListener('load', layoutBoxes);
    if (imageEl.complete) layoutBoxes();

    // 点击图片显示/隐藏检测框
    imageEl.style.cursor = 'pointer';
    const updateHint = () => {
      imageEl.title = showingBoxes ? '点击隐藏检测框' : '点击显示检测框';
    };
    updateHint();
    imageEl.addEventListener('click', () => {
      showingBoxes = !showingBoxes;
      boxEls.forEach(b => {
        b.el.style.display = showingBoxes ? 'block' : 'none';
      });
      updateHint();
    });
  }

  // 内容区（标注图/原图 + 摘要 + chips + 元信息）
  const body = document.createElement('div');
  body.className = 'idc-overlay__body';

  if (detail.summary) {
    const summary = document.createElement('div');
    summary.className = 'idc-overlay__summary';
    summary.textContent = detail.summary;
    body.appendChild(summary);
  }

  // 类别构成 chips（颜色与检测面板一致）
  const classes = Array.isArray(detail.classes) ? detail.classes : [];
  if (classes.length > 0) {
    const row = document.createElement('div');
    row.className = 'idc-overlay__classes';
    classes.forEach(c => {
      const chip = document.createElement('span');
      chip.className = 'idc-overlay__class-chip';
      const dot = document.createElement('span');
      dot.className = 'idc-overlay__class-dot';
      dot.style.background = classColor(c.name);
      const text = document.createElement('span');
      text.textContent = c.name;
      const count = document.createElement('span');
      count.className = 'idc-overlay__class-count';
      count.textContent = `×${c.count}`;
      chip.append(dot, text, count);
      row.appendChild(chip);
    });
    body.appendChild(row);
  }

  // 元信息 pills（最高置信度按分级配色；检测时间取当前系统时间——实时检测语义）
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const nowText = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const meta = document.createElement('div');
  meta.className = 'idc-overlay__meta';
  const metaItems: Array<[string, string | undefined, string?]> = [];
  if (detail.detections !== undefined) {
    metaItems.push(['目标数', String(detail.detections)]);
  }
  if (maxConf !== undefined && !Number.isNaN(maxConf)) {
    metaItems.push(['最高置信度', `${(maxConf * 100).toFixed(1)}%`, `idc-overlay__meta-value--${confLevel(maxConf)}`]);
  }
  if (detail.source) {
    metaItems.push(['数据来源', SOURCE_LABELS[detail.source] ?? detail.source]);
  }
  metaItems.push(['检测时间', nowText]);
  metaItems.forEach(([label, value, valueClass]) => {
    const pill = document.createElement('span');
    pill.className = 'idc-overlay__meta-pill';
    const labelEl = document.createElement('span');
    labelEl.className = 'idc-overlay__meta-label';
    labelEl.textContent = `${label} `;
    const valueEl = document.createElement('span');
    valueEl.className = valueClass ? `idc-overlay__meta-value ${valueClass}` : 'idc-overlay__meta-value';
    valueEl.textContent = value ?? '';
    pill.append(labelEl, valueEl);
    meta.appendChild(pill);
  });
  if (meta.childElementCount > 0) body.appendChild(meta);

  if (detail.scene) {
    const scene = document.createElement('div');
    scene.className = 'idc-overlay__scene';
    scene.textContent = detail.scene;
    body.appendChild(scene);
  }

  overlay.append(bar, frame, body);
  document.body.appendChild(overlay);

  // 标题栏可拖拽移动卡片
  bar.style.cursor = 'grab';
  bar.style.userSelect = 'none';
  const disposeDrag = enableOverlayDrag(bar, overlay);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKeydown);
    disposeDrag();
    overlay.remove();
    if (active?.close === close) active = null;
  }
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  closeBtn.addEventListener('click', close);
  window.addEventListener('keydown', onKeydown);
  active = { close };
}
