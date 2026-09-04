/**
 * 浮动面板缩放 Composable
 *
 * 为场景面板提供右下角拖拽调整宽高的能力（与 useDraggable 的移动定位互补）。
 * 约束在 min/max 范围内，拖拽结束移除全局监听。
 */
import { onBeforeUnmount, ref } from 'vue';

export interface PanelResizeOptions {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export function usePanelResize(initial: { width: number; height: number }, options: PanelResizeOptions = {}) {
  const {
    minWidth = 360,
    minHeight = 320,
    maxWidth = 960,
    maxHeight = typeof window !== 'undefined' ? window.innerHeight - 48 : 900
  } = options;

  const size = ref({ width: initial.width, height: initial.height });
  let resizing = false;
  let startX = 0;
  let startY = 0;
  let startW = 0;
  let startH = 0;

  function onResizeMove(e: MouseEvent) {
    if (!resizing) return;
    const width = Math.min(maxWidth, Math.max(minWidth, startW + (e.clientX - startX)));
    const height = Math.min(maxHeight, Math.max(minHeight, startH + (e.clientY - startY)));
    size.value = { width, height };
  }

  function onResizeEnd() {
    resizing = false;
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
  }

  function onResizeStart(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    resizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startW = size.value.width;
    startH = size.value.height;
    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeEnd);
  }

  onBeforeUnmount(onResizeEnd);

  return { size, onResizeStart };
}
