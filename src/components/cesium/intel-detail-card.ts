/**
 * 情报点详情卡片（Cesium GeoJSON 数据点点击弹窗）
 *
 * 展示无人机拍摄情报/检测类 GeoJSON 点的标注图与检测摘要：
 * 点击球面数据点 → 右下角浮动卡片显示「标注图 + 检测结论 + 元信息」。
 *
 * DOM 单例模式（同 street-view-panorama.ts）：重复打开先关闭上一个，Esc / 关闭按钮关闭。
 * 触发约定：GeoJSON feature 的 properties 里带 `image` 字段即视为情报点。
 */

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
  /** 最高置信度 0-1 */
  maxConf?: number | string;
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
      background: rgba(2, 10, 20, 0.96);
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
      background: linear-gradient(180deg, rgba(5, 24, 46, .98), rgba(5, 24, 46, .7));
      border-bottom: 1px solid rgba(43, 131, 255, .3);
      color: #eaf5ff;
    }
    .idc-overlay__title { font-size: 13px; font-weight: 700; letter-spacing: .3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .idc-overlay__badge {
      font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 8px; flex-shrink: 0;
      background: rgba(41, 163, 255, .15); color: #8db8ff; white-space: nowrap;
    }
    .idc-overlay__spacer { flex: 1; }
    .idc-overlay__btn {
      width: 28px; height: 28px; border-radius: 6px; border: 1px solid rgba(45, 111, 183, .35);
      background: rgba(6, 25, 50, .7); color: #cbe3ff; cursor: pointer;
      display: grid; place-items: center; transition: all .2s ease; flex-shrink: 0;
    }
    .idc-overlay__btn:hover { color: #29a3ff; border-color: rgba(70, 176, 255, .5); }
    .idc-overlay__image {
      width: 100%; display: block; cursor: zoom-in; background: #010c1a; min-height: 120px; object-fit: contain;
    }
    .idc-overlay__body { padding: 10px 14px 12px; display: flex; flex-direction: column; gap: 8px; }
    .idc-overlay__summary {
      font-size: 13px; font-weight: 600; color: #7ee787; line-height: 1.5;
    }
    .idc-overlay__meta {
      display: flex; flex-wrap: wrap; gap: 6px 14px;
      font-size: 11px; color: rgba(147, 196, 255, .65);
    }
    .idc-overlay__meta b { color: rgba(203, 227, 255, .85); font-weight: 600; }
    .idc-overlay__scene {
      font-size: 11px; color: rgba(147, 196, 255, .55); line-height: 1.6;
      border-top: 1px solid rgba(25, 95, 176, .18); padding-top: 8px;
    }
    @keyframes idc-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
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

/** 解析图片地址：完整 http / 根路径原样；否则按前端静态资源相对路径拼 BASE_URL */
function resolveImageUrl(url: string): string {
  if (/^(https?:)?\/\//.test(url) || url.startsWith('/')) return url;
  return `${import.meta.env.BASE_URL}${url}`;
}

export function openIntelDetailCard(detail: IntelDetail): void {
  active?.close();
  ensureStyle();

  const title = detail.name || '情报点详情';
  const modelBadge = detail.model ? `模型 · ${detail.model}` : '图像情报';

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

  const closeBtn = document.createElement('button');
  closeBtn.className = 'idc-overlay__btn';
  closeBtn.innerHTML = CLOSE_SVG;
  closeBtn.title = '关闭 (Esc)';

  bar.append(badge, titleEl, spacer, closeBtn);

  const imageEl = document.createElement('img');
  imageEl.className = 'idc-overlay__image';
  imageEl.alt = title;
  imageEl.src = resolveImageUrl(detail.image || detail.originImage || '');

  const body = document.createElement('div');
  body.className = 'idc-overlay__body';

  if (detail.summary) {
    const summary = document.createElement('div');
    summary.className = 'idc-overlay__summary';
    summary.textContent = detail.summary;
    body.appendChild(summary);
  }

  const meta = document.createElement('div');
  meta.className = 'idc-overlay__meta';
  const metaItems: Array<[string, string | undefined]> = [
    ['目标数', detail.detections === undefined ? undefined : String(detail.detections)],
    ['最高置信度', detail.maxConf === undefined ? undefined : `${(Number(detail.maxConf) * 100).toFixed(1)}%`],
    ['数据来源', detail.source],
    ['检测时间', detail.time]
  ];
  metaItems.forEach(([label, value]) => {
    if (!value) return;
    const span = document.createElement('span');
    const b = document.createElement('b');
    b.textContent = `${label}: `;
    span.append(b, value);
    meta.appendChild(span);
  });
  if (meta.childElementCount > 0) body.appendChild(meta);

  if (detail.scene) {
    const scene = document.createElement('div');
    scene.className = 'idc-overlay__scene';
    scene.textContent = detail.scene;
    body.appendChild(scene);
  }

  overlay.append(bar, imageEl, body);
  document.body.appendChild(overlay);

  // 标注图 ↔ 原始图 点击切换对比
  let showingAnnotated = Boolean(detail.image);
  imageEl.title = showingAnnotated ? '点击查看原始图' : '点击查看标注图';
  imageEl.addEventListener('click', () => {
    if (!detail.image && !detail.originImage) return;
    showingAnnotated = !showingAnnotated;
    const next = showingAnnotated ? detail.image : detail.originImage;
    if (next) imageEl.src = resolveImageUrl(next);
    imageEl.title = showingAnnotated ? '点击查看原始图' : '点击查看标注图';
  });

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKeydown);
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
