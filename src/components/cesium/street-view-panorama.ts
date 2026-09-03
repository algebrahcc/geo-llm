/**
 * 街景全景图查看器（Photo Sphere Viewer）
 *
 * 基于 @photo-sphere-viewer/core（three.js / WebGL）实现 360° 全景展示：
 * 鼠标拖拽旋转、滚轮缩放、惯性滑动、←/→ 切换相邻街景点、Esc 关闭。
 *
 * 面板形态：右下角浮动卡片（主地图保持可见），可一键切换全屏；
 * 内置方位罗盘（CompassPlugin）随视角旋转，顶栏显示当前点位位置（N / M）。
 *
 * 说明：
 * - 全景图由街景服务 /streetview/api/image 返回（2:1 等距柱状投影图）；
 * - PSV 经 WebGL 纹理渲染，要求街景服务图片允许跨域读取（CORS）；
 *   加载失败时会在查看器内提示。
 */
import { EquirectangularAdapter, Viewer } from '@photo-sphere-viewer/core';
import { CompassPlugin } from '@photo-sphere-viewer/compass-plugin';
import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/compass-plugin/index.css';
import { enableOverlayDrag, resetOverlayPosition } from '@/components/cesium/overlay-drag';

export interface StreetViewPanoramaNeighbor {
  /** 街景点的全景图 URL */
  imageUrl: string;
  /** 副标题（如街景点 geoid / 经纬度） */
  subtitle?: string;
  /** 切换后的点位序号（0 起），用于顶栏位置指示 */
  index?: number;
}

export interface StreetViewPanoramaOptions {
  /** 弹窗标题（默认「360° 全景」） */
  title?: string;
  /** 副标题（如街景点 geoid / 经纬度） */
  subtitle?: string;
  /** 初始位置指示（当前点序号 / 总数），不传则不显示 */
  position?: { index: number; total: number };
  /**
   * 左右键切换相邻街景点：delta 1 = 下一个，-1 = 上一个。
   * 返回 null 表示已到头（无法继续切换）；切换中抛错会在查看器内提示。
   */
  navigate?: (delta: 1 | -1) => Promise<StreetViewPanoramaNeighbor | null>;
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
      position: fixed; right: 70px; bottom: 18px; z-index: 99999;
      width: min(620px, calc(100vw - 140px)); height: min(64vh, 700px);
      background: rgba(2, 10, 20, 0.96);
      border: 1px solid rgba(43, 131, 255, 0.35);
      border-radius: 12px; overflow: hidden;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
      display: flex; flex-direction: column;
      animation: svp-fade .18s ease;
    }
    .svp-overlay--fullscreen {
      right: 0; bottom: 0;
      width: 100vw; height: 100vh;
      border-radius: 0; border: none;
    }
    .svp-overlay__bar {
      position: relative; z-index: 3;
      display: flex; align-items: center; gap: 10px;
      padding: 12px 16px;
      background: linear-gradient(180deg, rgba(5, 24, 46, .98), rgba(5, 24, 46, .7));
      border-bottom: 1px solid rgba(43, 131, 255, .3);
      color: #eaf5ff;
    }
    .svp-overlay__title { font-size: 14px; font-weight: 700; letter-spacing: .3px; white-space: nowrap; }
    .svp-overlay__subtitle {
      font-size: 12px; color: rgba(147, 196, 255, .7);
      font-family: 'Consolas', monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .svp-overlay__spacer { flex: 1; }
    .svp-overlay__position {
      font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 8px;
      background: rgba(43, 131, 255, .15); color: #8db8ff;
      font-family: 'Consolas', monospace; white-space: nowrap;
    }
    .svp-overlay__hint { font-size: 12px; color: rgba(147, 196, 255, .55); white-space: nowrap; }
    .svp-overlay__btn {
      width: 32px; height: 32px; border-radius: 6px; border: 1px solid rgba(45, 111, 183, .35);
      background: rgba(6, 25, 50, .7); color: #cbe3ff; cursor: pointer;
      display: grid; place-items: center; transition: all .2s ease; flex-shrink: 0;
    }
    .svp-overlay__btn:hover { color: #29a3ff; border-color: rgba(70, 176, 255, .5); }
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

const FULLSCREEN_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';
const CLOSE_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';

export function openStreetViewPanorama(imageUrl: string, options: StreetViewPanoramaOptions = {}): void {
  // 关闭已有实例，保证单例
  active?.close();
  ensureStyle();

  const title = options.title || '360° 全景';
  const subtitle = options.subtitle || '';

  // ─── DOM 结构（右下角浮动卡片，可切换全屏） ────────
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

  // 位置指示（第 N / M 个街景点）
  const positionEl = document.createElement('span');
  positionEl.className = 'svp-overlay__position';
  function updatePosition(index: number) {
    if (!options.position) return;
    positionEl.textContent = `${index + 1} / ${options.position.total}`;
  }
  if (options.position) {
    positionEl.textContent = `${options.position.index + 1} / ${options.position.total}`;
    bar.append(positionEl);
  }

  const hint = document.createElement('span');
  hint.className = 'svp-overlay__hint';
  const HINT_TEXT = options.navigate ? '←/→ 切换街景点 · 拖动旋转 · Esc 关闭' : '拖动旋转 · 滚轮缩放 · Esc 关闭';
  hint.textContent = HINT_TEXT;

  const fullscreenBtn = document.createElement('button');
  fullscreenBtn.className = 'svp-overlay__btn';
  fullscreenBtn.innerHTML = FULLSCREEN_SVG;
  fullscreenBtn.title = '全屏 / 退出全屏';
  fullscreenBtn.addEventListener('click', () => {
    overlay.classList.toggle('svp-overlay--fullscreen');
    // 全屏/还原时回到样式表默认锚点，避免拖拽残留的 left/top 与全屏定位冲突
    resetOverlayPosition(overlay);
  });

  const closeBtn = document.createElement('button');
  closeBtn.className = 'svp-overlay__btn';
  closeBtn.innerHTML = CLOSE_SVG;
  closeBtn.title = '关闭 (Esc)';

  bar.append(titleEl, subtitleEl, spacer, hint, fullscreenBtn, closeBtn);

  const stage = document.createElement('div');
  stage.className = 'svp-overlay__stage';

  const viewerContainer = document.createElement('div');
  viewerContainer.className = 'svp-overlay__viewer';
  stage.appendChild(viewerContainer);

  overlay.append(bar, stage);
  document.body.appendChild(overlay);

  // 标题栏可拖拽移动卡片
  bar.style.cursor = 'grab';
  bar.style.userSelect = 'none';
  const disposeDrag = enableOverlayDrag(bar, overlay);

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
    clearTimeout(hintTimer);
    window.removeEventListener('keydown', onKeydown);
    disposeDrag();
    viewer?.destroy();
    viewer = null;
    overlay.remove();
    if (active?.close === close) active = null;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      void switchTo(e.key === 'ArrowRight' ? 1 : -1);
    }
  }

  // ─── 左右键切换相邻街景点 ──────────────────────────
  let switching = false;

  async function switchTo(delta: 1 | -1) {
    if (!options.navigate || switching) return;
    switching = true;
    try {
      const next = await options.navigate(delta);
      if (!next) {
        flashHint(delta === 1 ? '已是最后一个街景点' : '已是第一个街景点');
        return;
      }
      subtitleEl.textContent = next.subtitle ?? '';
      if (next.index !== undefined) updatePosition(next.index);
      // setPanorama 自带 loading 遮罩，无需额外处理
      await viewer?.setPanorama(next.imageUrl);
    } catch {
      showError('切换街景点失败，请稍后重试');
    } finally {
      switching = false;
    }
  }

  /** 到头提示：临时改 hint 文案后恢复 */
  let hintTimer: ReturnType<typeof setTimeout> | undefined;
  function flashHint(text: string) {
    clearTimeout(hintTimer);
    hint.textContent = text;
    hint.style.color = 'rgba(255, 196, 87, .9)';
    hintTimer = setTimeout(() => {
      hint.textContent = HINT_TEXT;
      hint.style.color = '';
    }, 1600);
  }

  closeBtn.addEventListener('click', close);
  window.addEventListener('keydown', onKeydown);
  active = { close };

  // ─── 创建 PSV 查看器（含方位罗盘） ─────────────────
  try {
    viewer = new Viewer({
      container: viewerContainer,
      panorama: imageUrl,
      // 关闭 XMP 元数据读取，避免额外请求街景服务图片头部
      adapter: EquirectangularAdapter.withConfig({ useXmpData: false }),
      navbar: false,
      keyboard: false,
      loadingTxt: '正在加载全景图…',
      plugins: [CompassPlugin.withConfig({ size: '64px' })]
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
