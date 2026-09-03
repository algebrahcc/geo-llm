/**
 * 浮动卡片拖拽支持：按住标题栏（或指定把手）拖动 fixed 定位卡片。
 *
 * 首次拖动时把 CSS 的 right/bottom 锚点换算为 left/top，之后由 left/top 定位；
 * 拖动范围限制在视口内（至少保留 80×40px 在屏幕内，防止拖丢）。
 * 标题栏内的按钮（关闭/全屏等）不触发拖拽。
 *
 * 用法：
 *   const dispose = enableOverlayDrag(bar, overlay);
 *   // 关闭卡片时调用 dispose() 移除全局监听
 *   // 全屏切换等需要回到默认锚点的场景调用 resetOverlayPosition(overlay)
 */

/** 拖动后重置为样式表默认锚点（右下角） */
export function resetOverlayPosition(overlay: HTMLElement): void {
  overlay.style.left = '';
  overlay.style.top = '';
  overlay.style.right = '';
  overlay.style.bottom = '';
}

export function enableOverlayDrag(dragHandle: HTMLElement, overlay: HTMLElement): () => void {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  function onDown(e: MouseEvent) {
    if (e.button !== 0) return;
    // 标题栏上的按钮（关闭/全屏等）不触发拖拽
    if ((e.target as HTMLElement).closest('button')) return;
    dragging = true;
    const rect = overlay.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    // 由 right/bottom 锚点切换为 left/top 定位
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.right = 'auto';
    overlay.style.bottom = 'auto';
    overlay.style.cursor = 'grabbing';
    e.preventDefault();
  }

  function onMove(e: MouseEvent) {
    if (!dragging) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = overlay.offsetWidth;
    let left = startLeft + (e.clientX - startX);
    let top = startTop + (e.clientY - startY);
    left = Math.min(Math.max(left, 80 - w), vw - 80);
    top = Math.min(Math.max(top, 0), vh - 40);
    overlay.style.left = `${left}px`;
    overlay.style.top = `${top}px`;
  }

  function onUp() {
    if (!dragging) return;
    dragging = false;
    overlay.style.cursor = '';
  }

  dragHandle.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);

  return () => {
    dragHandle.removeEventListener('mousedown', onDown);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
}
