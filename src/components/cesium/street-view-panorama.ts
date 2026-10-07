/**
 * 街景全景图查看器（Photo Sphere Viewer）
 *
 * 基于 @photo-sphere-viewer/core（three.js / WebGL）实现 360° 全景展示：
 * 鼠标拖拽旋转、滚轮缩放、惯性滑动、方位罗盘、全屏、Esc 关闭。
 *
 * 面板形态：右下角浮动卡片（主地图保持可见），可切换全屏；
 * 底部可选胶片条（本地街景数据可列举整条路线的缩略图，点击直达）。
 *
 * 这一层只负责「看」与「操作」，不关心数据从哪来：所有取图/取相邻点都通过
 * `navigate` / `prefetch` / `jumpTo` 回调交回调用方（见 service-loader 的 streetview 工厂），
 * 于是远程服务与本地目录共用同一套浏览体验。
 *
 * 说明：
 * - 全景图为 2:1 等距柱状投影；PSV 经 WebGL 纹理渲染，要求图片允许跨域读取（CORS）；
 * - 「朝向对齐道路前方」依赖数据侧的图像定向：当前约定图像水平中心为正北，
 *   数据若带定向元数据，需要在这里补一次 yaw 偏移；
 * - 顶栏帧率是**主线程可用性**读数（rAF 采样）：主线程被大点集构建等任务拖住时，
 *   全景拖动会真的变卡，这个读数会同步下降。
 */
import { EquirectangularAdapter, Viewer } from '@photo-sphere-viewer/core';
import { CompassPlugin } from '@photo-sphere-viewer/compass-plugin';
import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/compass-plugin/index.css';
import { enableOverlayDrag, resetOverlayPosition } from '@/components/cesium/overlay-drag';
import {
  createFilmstrip,
  type StreetViewFilmstripHandle,
  type StreetViewFilmstripItem
} from '@/components/cesium/street-view-filmstrip';
import { createFpsStats } from '@/composables/cesium/fps-stats';

export interface StreetViewPanoramaNeighbor {
  /** 街景点的全景图 URL */
  imageUrl: string;
  /** 副标题（如街景点 geoid / 经纬度） */
  subtitle?: string;
  /** 切换后的点位序号（0 起），用于顶栏位置指示 */
  index?: number;
  /** 行进方位（度，0=正北）：切换后按此朝向前方 */
  heading?: number | null;
  /** 胶片条高亮位置（本地数据可与点位一一对应） */
  filmstripIndex?: number;
}

export interface StreetViewPanoramaOptions {
  /** 弹窗标题（默认「360° 全景」） */
  title?: string;
  /** 副标题（如街景点 geoid / 经纬度） */
  subtitle?: string;
  /** 初始位置指示（当前点序号 / 总数），不传则不显示 */
  position?: { index: number; total: number };
  /**
   * 前进/后退：delta 1 = 下一处，-1 = 上一处。
   * 返回 null 表示已到头（无法继续切换）；切换中抛错会在查看器内提示。
   */
  navigate?: (delta: 1 | -1) => Promise<StreetViewPanoramaNeighbor | null>;
  /**
   * 预取下一张全景图地址。
   *
   * 必须与 `navigate` 分开：预取只是「先把图下载到浏览器缓存」，不能推进调用方的
   * 当前位置（否则连按前进会跳点）。失败静默忽略，不影响浏览。
   */
  prefetch?: (delta: 1 | -1) => Promise<string | null>;
  /** 初始朝向（度，0=正北）：迎面看向道路前方 */
  heading?: number | null;
  /** 定位到当前街景点（球面相机跟随 + 当前点高亮），不传则不显示定位按钮 */
  locate?: () => void;
  /** 胶片条数据（本地街景数据可列举；远程大数据集不要传，DOM 撑不住） */
  filmstrip?: StreetViewFilmstripItem[];
  /** 胶片初始高亮 */
  filmstripIndex?: number;
  /** 胶片点击：跳到指定点位（与 navigate 同构，只切换全景，不重建浮窗） */
  jumpTo?: (filmstripIndex: number) => Promise<StreetViewPanoramaNeighbor | null>;
  /** 自动漫游步进（毫秒），不传则不显示自动漫游按钮 */
  autoPlayIntervalMs?: number;
}

interface ActivePanorama {
  close: () => void;
}

/** 单例：同一时刻只保留一个全景查看器，重复打开会先关闭上一个 */
let active: ActivePanorama | null = null;

/** 注入一次全局样式（避免每次打开重复注入） */
let styleInjected = false;

/** 帧率低于该值时高亮（考核指标：不低于 30FPS） */
const FPS_THRESHOLD = 30;

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
      display: flex; align-items: center; gap: 8px;
      padding: 12px 16px;
      background: linear-gradient(180deg, rgba(5, 24, 46, .98), rgba(5, 24, 46, .7));
      border-bottom: 1px solid rgba(43, 131, 255, .3);
      color: #eaf5ff;
    }
    .svp-overlay__title { font-size: 14px; font-weight: 700; letter-spacing: .3px; white-space: nowrap; }
    .svp-overlay__subtitle {
      font-size: 12px; color: rgba(147, 196, 255, .7);
      font-family: 'Consolas', monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      max-width: 190px;
    }
    .svp-overlay__spacer { flex: 1; }
    .svp-overlay__position {
      font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 8px;
      background: rgba(43, 131, 255, .15); color: #8db8ff;
      font-family: 'Consolas', monospace; white-space: nowrap;
    }
    .svp-overlay__fps {
      font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 8px;
      background: rgba(43, 131, 255, .12); color: #8db8ff;
      font-family: 'Consolas', monospace; white-space: nowrap;
      transition: color .2s ease, background .2s ease;
    }
    .svp-overlay__fps--low {
      color: #ffb04d; background: rgba(255, 176, 77, .14);
      animation: svp-breathe 1.6s ease-in-out infinite;
    }
    .svp-overlay__hint { font-size: 12px; color: rgba(147, 196, 255, .55); white-space: nowrap; }
    .svp-overlay__btn {
      width: 32px; height: 32px; border-radius: 6px; border: 1px solid rgba(45, 111, 183, .35);
      background: rgba(6, 25, 50, .7); color: #cbe3ff; cursor: pointer;
      display: grid; place-items: center; transition: all .2s ease; flex-shrink: 0;
    }
    .svp-overlay__btn:hover { color: #29a3ff; border-color: rgba(70, 176, 255, .5); }
    .svp-overlay__btn:active { transform: scale(.94); }
    .svp-overlay__btn:disabled { opacity: .4; cursor: not-allowed; transform: none; }
    .svp-overlay__btn--active {
      color: #29a3ff; border-color: rgba(70, 176, 255, .6);
      background: rgba(41, 163, 255, .16);
    }
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
    @keyframes svp-breathe { 0%, 100% { opacity: 1; } 50% { opacity: .62; } }
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

const ICONS = {
  prev: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>',
  next: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>',
  play: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  pause:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
  north:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l4 9h-2.5v11h-3V11H8z"/></svg>',
  zoomIn:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/></svg>',
  zoomOut: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 13H5v-2h14z"/></svg>',
  locate:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 8a4 4 0 100 8 4 4 0 000-8zm9 3h-2.06A7 7 0 0013 5.06V3h-2v2.06A7 7 0 005.06 11H3v2h2.06A7 7 0 0011 18.94V21h2v-2.06A7 7 0 0018.94 13H21z"/></svg>',
  fullscreen:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
  close:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'
};

/**
 * 预取图片到浏览器缓存。
 *
 * 失败必须静默处理：预取只是加速手段，真正切换时会重新请求并给出可执行提示。
 * 若不给 `error` 挂监听，浏览器会把这次加载失败报成
 * 「Uncaught (in promise) Event {type: 'error', target: img}」——看起来像应用崩溃，
 * 实际只是"下一张没预取成功"。
 */
function preloadImage(url: string): void {
  const image = new Image();
  image.decoding = 'async';
  image.addEventListener('error', () => {
    console.warn('[street-view] 预取全景图失败（不影响浏览）：', url);
  });
  image.src = url;
}

function normalizeHeading(heading: number): number {
  return ((heading % 360) + 360) % 360;
}

export function openStreetViewPanorama(imageUrl: string, options: StreetViewPanoramaOptions = {}): void {
  // 关闭已有实例，保证单例
  active?.close();
  ensureStyle();

  const title = options.title || '360° 全景';
  const canNavigate = typeof options.navigate === 'function';

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
  subtitleEl.textContent = options.subtitle ?? '';

  const spacer = document.createElement('span');
  spacer.className = 'svp-overlay__spacer';

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

  const fpsEl = document.createElement('span');
  fpsEl.className = 'svp-overlay__fps';
  fpsEl.textContent = 'FPS --';
  fpsEl.title = '当前主线程帧率（低于 30 会高亮）';

  const hint = document.createElement('span');
  hint.className = 'svp-overlay__hint';
  const HINT_TEXT = canNavigate ? '←/→ 前进后退 · 拖动旋转 · Esc 关闭' : '拖动旋转 · 滚轮缩放 · Esc 关闭';
  hint.textContent = HINT_TEXT;

  function makeButton(icon: string, titleText: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'svp-overlay__btn';
    button.innerHTML = icon;
    button.title = titleText;
    button.addEventListener('click', onClick);
    return button;
  }

  const prevBtn = makeButton(ICONS.prev, '上一处街景 (←)', () => void switchTo(-1));
  const nextBtn = makeButton(ICONS.next, '下一处街景 (→)', () => void switchTo(1));
  const autoBtn = options.autoPlayIntervalMs
    ? makeButton(ICONS.play, '开始自动漫游', () => toggleAutoPlay())
    : undefined;
  const northBtn = makeButton(ICONS.north, '正北复位', () => resetToNorth());
  const zoomOutBtn = makeButton(ICONS.zoomOut, '缩小 (-)', () => viewer?.zoomOut(1));
  const zoomInBtn = makeButton(ICONS.zoomIn, '放大 (+)', () => viewer?.zoomIn(1));
  const locateBtn = options.locate
    ? makeButton(ICONS.locate, '在三维球上定位当前街景点', () => options.locate?.())
    : undefined;

  const fullscreenBtn = makeButton(ICONS.fullscreen, '全屏 / 退出全屏', () => {
    overlay.classList.toggle('svp-overlay--fullscreen');
    // 全屏/还原时回到样式表默认锚点，避免拖拽残留的 left/top 与全屏定位冲突
    resetOverlayPosition(overlay);
  });

  const closeBtn = makeButton(ICONS.close, '关闭 (Esc)', () => close());

  [prevBtn, nextBtn, autoBtn, northBtn, zoomOutBtn, zoomInBtn, locateBtn].forEach(button => {
    if (button) bar.append(button);
  });
  bar.append(titleEl, subtitleEl, spacer, hint, fpsEl, fullscreenBtn, closeBtn);

  const stage = document.createElement('div');
  stage.className = 'svp-overlay__stage';

  const viewerContainer = document.createElement('div');
  viewerContainer.className = 'svp-overlay__viewer';
  stage.appendChild(viewerContainer);

  overlay.append(bar, stage);
  document.body.appendChild(overlay);

  // ─── 胶片条（可选：本地街景数据可列举整条路线） ─────
  let filmstrip: StreetViewFilmstripHandle | null = null;
  let currentFilmstripIndex = options.filmstripIndex ?? -1;
  if (options.filmstrip && options.filmstrip.length > 0 && typeof options.jumpTo === 'function') {
    filmstrip = createFilmstrip({
      items: options.filmstrip,
      activeIndex: currentFilmstripIndex >= 0 ? currentFilmstripIndex : 0,
      onSelect: index => void jumpToFilmstrip(index)
    });
    overlay.append(filmstrip.element);
  }

  // 标题栏可拖拽移动卡片
  bar.style.cursor = 'grab';
  bar.style.userSelect = 'none';
  const disposeDrag = enableOverlayDrag(bar, overlay);

  // ─── 关闭清理 ──────────────────────────────────────
  let viewer: Viewer | null = null;
  let closed = false;
  let switching = false;
  /** 切换序号：只接受最新一次请求的结果，避免连点造成「跳着走」 */
  let switchSeq = 0;
  let autoPlayTimer: number | undefined;
  let fpsHandle: number | undefined;

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

  function setNavDisabled(disabled: boolean) {
    prevBtn.disabled = disabled;
    nextBtn.disabled = disabled;
    if (autoBtn) autoBtn.disabled = disabled;
  }

  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(hintTimer);
    if (autoPlayTimer !== undefined) window.clearInterval(autoPlayTimer);
    if (fpsHandle !== undefined) cancelAnimationFrame(fpsHandle);
    window.removeEventListener('keydown', onKeydown);
    disposeDrag();
    filmstrip?.destroy();
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
      return;
    }
    if (e.key === '+' || e.key === '=') {
      viewer?.zoomIn(1);
      return;
    }
    if (e.key === '-' || e.key === '_') {
      viewer?.zoomOut(1);
    }
  }

  // ─── 切换、预取与朝向 ──────────────────────────────
  function resetToNorth(): void {
    // PSV 的 yaw 以图像水平中心为 0：数据未带定向元数据时，约定图像中心即正北
    void viewer?.animate({ yaw: '0deg', pitch: 0, speed: '360ms' });
  }

  function applyHeading(heading?: number | null): void {
    if (!viewer || heading === undefined || heading === null) return;
    void viewer.animate({ yaw: `${normalizeHeading(heading)}deg`, pitch: 0, speed: '360ms' });
  }

  async function applyNeighbor(neighbor: StreetViewPanoramaNeighbor): Promise<void> {
    subtitleEl.textContent = neighbor.subtitle ?? '';
    if (neighbor.index !== undefined) updatePosition(neighbor.index);
    if (neighbor.filmstripIndex !== undefined) {
      currentFilmstripIndex = neighbor.filmstripIndex;
      filmstrip?.setActive(currentFilmstripIndex);
    }
    await viewer?.setPanorama(neighbor.imageUrl);
    applyHeading(neighbor.heading);
  }

  /** 取到邻居后先预取「再下一张」，让连按前进时不必等图 */
  function prefetchNext(): void {
    if (!options.prefetch) return;
    void options
      .prefetch(1)
      .then(url => {
        if (url) preloadImage(url);
      })
      .catch(() => {
        /* 预取失败静默：真正切换时会再请求一次并给出提示 */
      });
  }

  async function switchTo(delta: 1 | -1): Promise<void> {
    if (!options.navigate || switching || closed) return;
    switching = true;
    setNavDisabled(true);
    const seq = ++switchSeq;
    try {
      const next = await options.navigate(delta);
      if (seq !== switchSeq || closed) return;
      if (!next) {
        flashHint(delta === 1 ? '已是最后一处街景' : '已是第一处街景');
        return;
      }
      await applyNeighbor(next);
      prefetchNext();
    } catch {
      showError('切换街景点失败，请稍后重试');
    } finally {
      switching = false;
      if (!closed) setNavDisabled(false);
    }
  }

  async function jumpToFilmstrip(index: number): Promise<void> {
    if (!options.jumpTo || switching || closed) return;
    if (index === currentFilmstripIndex) return;
    switching = true;
    setNavDisabled(true);
    const seq = ++switchSeq;
    try {
      const next = await options.jumpTo(index);
      if (seq !== switchSeq || closed) return;
      if (!next) {
        flashHint('该位置没有可用的街景');
        return;
      }
      await applyNeighbor({ ...next, filmstripIndex: next.filmstripIndex ?? index });
      prefetchNext();
    } catch {
      showError('切换街景点失败，请稍后重试');
    } finally {
      switching = false;
      if (!closed) setNavDisabled(false);
    }
  }

  // ─── 自动漫游 ──────────────────────────────────────
  function toggleAutoPlay(): void {
    if (autoPlayTimer !== undefined) {
      window.clearInterval(autoPlayTimer);
      autoPlayTimer = undefined;
      autoBtn?.classList.remove('svp-overlay__btn--active');
      if (autoBtn) autoBtn.innerHTML = ICONS.play;
      if (autoBtn) autoBtn.title = '开始自动漫游';
      return;
    }
    const interval = options.autoPlayIntervalMs ?? 2500;
    autoBtn?.classList.add('svp-overlay__btn--active');
    if (autoBtn) autoBtn.innerHTML = ICONS.pause;
    if (autoBtn) autoBtn.title = '暂停自动漫游';
    autoPlayTimer = window.setInterval(() => void switchTo(1), interval);
  }

  function stopAutoPlay(): void {
    if (autoPlayTimer === undefined) return;
    window.clearInterval(autoPlayTimer);
    autoPlayTimer = undefined;
    autoBtn?.classList.remove('svp-overlay__btn--active');
    if (autoBtn) autoBtn.innerHTML = ICONS.play;
    if (autoBtn) autoBtn.title = '开始自动漫游';
  }

  /** 到头提示：临时改 hint 文案后恢复；自动漫游同时停下 */
  let hintTimer: ReturnType<typeof setTimeout> | undefined;
  function flashHint(text: string) {
    if (autoPlayTimer !== undefined) stopAutoPlay();
    clearTimeout(hintTimer);
    hint.textContent = text;
    hint.style.color = 'rgba(255, 196, 87, .9)';
    hintTimer = setTimeout(() => {
      hint.textContent = HINT_TEXT;
      hint.style.color = '';
    }, 1600);
  }

  window.addEventListener('keydown', onKeydown);
  active = { close };

  // ─── 帧率采样（主线程可用性读数） ──────────────────
  const fps = createFpsStats();
  function startFpsSampling() {
    const loop = () => {
      if (closed) return;
      fps.tick(performance.now());
      const read = fps.read();
      fpsEl.textContent = `FPS ${Math.round(read.current)}`;
      fpsEl.classList.toggle('svp-overlay__fps--low', read.current > 0 && read.current < FPS_THRESHOLD);
      fpsHandle = requestAnimationFrame(loop);
    };
    fpsHandle = requestAnimationFrame(loop);
  }

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
      showError('全景图加载失败，请检查数据地址及跨域（CORS）配置');
    });

    // 初始朝向直接落位（不做动画，避免打开时先转到别处再转回来）
    if (options.heading !== undefined && options.heading !== null) {
      viewer.rotate({ yaw: `${normalizeHeading(options.heading)}deg`, pitch: 0 });
    }

    // 打开即预取下一张，第一次按「下一处」通常已是缓存命中
    prefetchNext();
    startFpsSampling();
  } catch (e) {
    // 构造失败（如浏览器不支持 WebGL）
    console.error('[street-view] Photo Sphere Viewer 初始化失败：', e);
    showError('当前浏览器无法渲染全景图（WebGL 不可用）');
  }
}
