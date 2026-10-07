/**
 * 街景胶片条（全景浮窗底部的缩略图导航）
 *
 * 为什么值得单独做：全景里的「前进/后退」只能一步一步走，而**本地街景数据**（public/data 下的
 * demo 数据）点位与图片都是已知的，可以直接列出整条路线的缩略图 —— 点哪张看哪张，
 * 比连按十几次「下一处」直观得多。远程服务拿不到「全量 geoid → 图片」的映射，因此
 * 服务层只对本地来源提供胶片数据（见 service-loader 的 streetview 工厂）。
 *
 * 窗口化渲染：街景点可能上千，一次性铺 1000 个 DOM 会卡住浮窗打开。这里只渲染以
 * 当前点位为中心的窗口（前后各 `WINDOW_RADIUS` 张），随选中项滚动更新。
 */

export interface StreetViewFilmstripItem {
  /** 缩略图地址（本地全景图可直接复用，浏览器按尺寸缩放即可） */
  thumbnailUrl: string;
  /** 提示文案（点位标识 / 道路名） */
  label?: string;
}

export interface StreetViewFilmstripHandle {
  /** 胶片条根元素（由浮窗插入到自己的布局里） */
  element: HTMLElement;
  /** 高亮某一项（会随选中项滚动窗口） */
  setActive(index: number): void;
  /** 释放（移除样式与事件） */
  destroy(): void;
}

export interface StreetViewFilmstripOptions {
  items: StreetViewFilmstripItem[];
  /** 初始高亮项 */
  activeIndex?: number;
  /** 点击某一项 */
  onSelect: (index: number) => void;
}

/**
 * 选中项前后各渲染多少张。
 *
 * 取 20（一次最多 41 张）的原因：胶片用的是**全景原图**当缩略图（服务端没有单独的缩略图接口），
 * 窗口开太大就会一次性发起上百张几 MB 的请求，既抢带宽也容易因缺图刷出加载失败。
 */
const WINDOW_RADIUS = 20;

/** 单次渲染上限（2×radius + 1 之外的兜底，防止极端窗口） */
const MAX_RENDERED = WINDOW_RADIUS * 2 + 1;

let styleInjected = false;

function ensureStyle(): void {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
  style.id = 'street-view-filmstrip-style';
  style.textContent = `
    .svf {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 10px; overflow-x: auto; overflow-y: hidden;
      background: rgba(4, 17, 34, .94);
      border-top: 1px solid rgba(43, 131, 255, .25);
      scrollbar-width: thin; scrollbar-color: rgba(43, 131, 255, .45) transparent;
    }
    .svf::-webkit-scrollbar { height: 6px; }
    .svf::-webkit-scrollbar-thumb { background: rgba(43, 131, 255, .45); border-radius: 3px; }
    .svf-item {
      position: relative; flex: 0 0 auto; width: 96px; height: 54px;
      border-radius: 6px; overflow: hidden; cursor: pointer;
      border: 1px solid rgba(45, 111, 183, .35); background: #06192f;
      transition: border-color .18s ease, box-shadow .18s ease;
    }
    .svf-item img {
      width: 100%; height: 100%; object-fit: cover; display: block;
      opacity: .72; transition: opacity .18s ease, transform .25s ease;
    }
    .svf-item:hover img { opacity: 1; transform: scale(1.05); }
    .svf-item--active {
      border-color: #29a3ff;
      box-shadow: 0 0 0 1px rgba(41, 163, 255, .55), 0 0 12px rgba(41, 163, 255, .35);
    }
    .svf-item--active img { opacity: 1; }
    .svf-item__label {
      position: absolute; left: 0; right: 0; bottom: 0;
      padding: 2px 5px; font-size: 10px; line-height: 1.4; color: #cbe3ff;
      background: linear-gradient(180deg, transparent, rgba(2, 10, 20, .88));
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .svf-more {
      flex: 0 0 auto; padding: 0 8px; font-size: 11px; color: rgba(147, 196, 255, .7);
      white-space: nowrap; user-select: none;
    }
  `;
  document.head.appendChild(style);
}

export function createFilmstrip(options: StreetViewFilmstripOptions): StreetViewFilmstripHandle {
  ensureStyle();

  const root = document.createElement('div');
  root.className = 'svf';

  let activeIndex = options.activeIndex ?? 0;
  /** 当前渲染窗口的起始下标 */
  let windowStart = 0;

  function render(): void {
    const total = options.items.length;
    const half = Math.floor(MAX_RENDERED / 2);
    // 以选中项为中心取窗口，并夹在合法区间内
    windowStart = Math.max(0, Math.min(total - MAX_RENDERED, activeIndex - half));
    if (windowStart < 0) windowStart = 0;
    const windowEnd = Math.min(total, windowStart + MAX_RENDERED);

    root.replaceChildren();

    if (windowStart > 0) {
      const hint = document.createElement('span');
      hint.className = 'svf-more';
      hint.textContent = `前 ${windowStart} 张`;
      root.append(hint);
    }

    for (let index = windowStart; index < windowEnd; index += 1) {
      const item = options.items[index];
      const node = document.createElement('button');
      node.type = 'button';
      node.className = index === activeIndex ? 'svf-item svf-item--active' : 'svf-item';
      node.title = item.label ?? `第 ${index + 1} 张`;
      node.addEventListener('click', () => options.onSelect(index));

      const image = document.createElement('img');
      // 懒加载：横向滚动出可视区的缩略图不发起请求
      image.loading = 'lazy';
      image.src = item.thumbnailUrl;
      image.alt = item.label ?? `街景 ${index + 1}`;
      // 缩略图缺失（本地图未下载）时保留占位底色，不弹破图图标；
      // 同时必须挂监听，否则浏览器会把加载失败报成 Uncaught (in promise) Event
      image.addEventListener('error', () => {
        image.style.opacity = '0';
      });
      node.append(image);

      if (item.label) {
        const label = document.createElement('span');
        label.className = 'svf-item__label';
        label.textContent = item.label;
        node.append(label);
      }

      root.append(node);
    }

    if (windowEnd < total) {
      const hint = document.createElement('span');
      hint.className = 'svf-more';
      hint.textContent = `后 ${total - windowEnd} 张`;
      root.append(hint);
    }

    const active = root.querySelector<HTMLElement>('.svf-item--active');
    active?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  function setActive(index: number): void {
    if (index === activeIndex) return;
    activeIndex = index;
    render();
  }

  render();

  return {
    element: root,
    setActive,
    destroy() {
      root.replaceChildren();
      root.remove();
    }
  };
}
