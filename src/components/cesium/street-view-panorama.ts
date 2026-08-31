/**
 * 街景全景图查看器（Photo Sphere Viewer）
 *
 * 基于 @photo-sphere-viewer/core（three.js / WebGL）实现 360° 全景展示：
 * 鼠标拖拽旋转、滚轮缩放、惯性滑动、Esc 关闭。
 *
 * 说明：
 * - 全景图由街景服务 /streetview/api/image 返回（2:1 等距柱状投影图）；
 * - PSV 经 WebGL 纹理渲染，要求街景服务图片允许跨域读取（CORS）；
 *   加载失败时会在查看器内提示。
 */
import { EquirectangularAdapter, Viewer } from '@photo-sphere-viewer/core';
import '@photo-sphere-viewer/core/index.css';

export interface StreetViewPanoramaOptions {
  /** 弹窗标题（默认「360° 全景」） */
  title?: string;
  /** 副标题（如街景点 geoid / 经纬度） */
  subtitle?: string;
}

interface ActivePanorama {
  close: () => void;
}

/** 单例：同一时刻只保留一个全景查看器，重复打开会先关闭上一个 */
let active: ActivePanorama | null = null;

/** 注入一次全局样式（避免每次打开重复注入） */
let styleInjected = false;

function ensureStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const css = `
    .svp-overlay {
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(2, 10, 20, 0.96);
      display: flex; flex-direction: column;
      animation: svp-fade .18s ease;
    }
    .svp-overlay__bar {
      position: relative; z-index: 3;
      display: flex; align-items: center; gap: 14px;
      padding: 14px 20px;
      background: linear-gradient(180deg, rgba(5, 24, 46, .98), rgba(5, 24, 46, .7));
      border-bottom: 1px solid rgba(43, 131, 255, .3);
      color: #eaf5ff;
    }
    .svp-overlay__title { font-size: 15px; font-weight: 700; letter-spacing: .3px; }
    .svp-overlay__subtitle {
      font-size: 12px; color: rgba(147, 196, 255, .7);
      font-family: 'Consolas', monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .svp-overlay__spacer { flex: 1; }
    .svp-overlay__hint { font-size: 12px; color: rgba(147, 196, 255, .55); }
    .svp-overlay__close {
      width: 34px; height: 34px; border-radius: 6px; border: 1px solid rgba(45, 111, 183, .35);
      background: rgba(6, 25, 50, .7); color: #cbe3ff; cursor: pointer; font-size: 18px;
      display: grid; place-items: center; transition: all .2s ease;
    }
    .svp-overlay__close:hover { color: #29a3ff; border-color: rgba(70, 176, 255, .5); }
    .svp-overlay__stage {
      position: relative; flex: 1; min-height: 0; overflow: hidden;
    }
    .svp-overlay__viewer { position: absolute; inset: 0; }
    .svp-overlay__error {
      position: absolute; inset: 0; z-index: 2;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
      color: rgba(203, 227, 255, .8); font-size: 13px; text-align: center; padding: 24px;
      background: rgba(2, 10, 20, .55);
    }
    @keyframes svp-fade { from { opacity: 0; } to { opacity: 1; } }
  `;
  const style = document.createElement('style');
  style.id = 'street-view-panorama-style';
  style.textContent = css;
  document.head.appendChild(style);
}

export function closeStreetViewPanorama(): void {
  active?.close();
  active = null;
}

export function openStreetViewPanorama(imageUrl: string, options: StreetViewPanoramaOptions = {}): void {
  // 关闭已有实例，保证单例
  active?.close();
  ensureStyle();

  const title = options.title || '360° 全景';
  const subtitle = options.subtitle || '';

  // ─── DOM 结构 ──────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.className = 'svp-overlay';

  const bar = document.createElement('div');
  bar.className = 'svp-overlay__bar';

  const titleEl = document.createElement('span');
  titleEl.className = 'svp-overlay__title';
  titleEl.textContent = title;

  const subtitleEl = document.createElement('span');
  subtitleEl.className = 'svp-overlay__subtitle';
  subtitleEl.textContent = subtitle;

  const spacer = document.createElement('span');
  spacer.className = 'svp-overlay__spacer';

  const hint = document.createElement('span');
  hint.className = 'svp-overlay__hint';
  hint.textContent = '拖动旋转 · 滚轮缩放 · Esc 关闭';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'svp-overlay__close';
  closeBtn.innerHTML = '&times;';
  closeBtn.title = '关闭 (Esc)';

  bar.append(titleEl, subtitleEl, spacer, hint, closeBtn);

  const stage = document.createElement('div');
  stage.className = 'svp-overlay__stage';

  const viewerContainer = document.createElement('div');
  viewerContainer.className = 'svp-overlay__viewer';
  stage.appendChild(viewerContainer);

  overlay.append(bar, stage);
  document.body.appendChild(overlay);

  // ─── 关闭清理 ──────────────────────────────────────
  let viewer: Viewer | null = null;
  let closed = false;

  function showError(message: string) {
    const existing = viewerContainer.querySelector<HTMLElement>('.svp-overlay__error');
    if (existing) {
      existing.textContent = message;
      return;
    }
    const err = document.createElement('div');
    err.className = 'svp-overlay__error';
    err.textContent = message;
    viewerContainer.appendChild(err);
  }

  function close() {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKeydown);
    viewer?.destroy();
    viewer = null;
    overlay.remove();
    if (active?.close === close) active = null;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  closeBtn.addEventListener('click', close);
  window.addEventListener('keydown', onKeydown);
  active = { close };

  // ─── 创建 PSV 查看器 ───────────────────────────────
  try {
    viewer = new Viewer({
      container: viewerContainer,
      panorama: imageUrl,
      // 关闭 XMP 元数据读取，避免额外请求街景服务图片头部
      adapter: EquirectangularAdapter.withConfig({ useXmpData: false }),
      navbar: false,
      keyboard: false,
      loadingTxt: '正在加载全景图…'
    });

    viewer.addEventListener('panorama-error', () => {
      showError('全景图加载失败，请检查街景服务地址及跨域（CORS）配置');
    });
  } catch (e) {
    // 构造失败（如浏览器不支持 WebGL）
    console.error('[street-view] Photo Sphere Viewer 初始化失败：', e);
    showError('当前浏览器无法渲染全景图（WebGL 不可用）');
  }
}
