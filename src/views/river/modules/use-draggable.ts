import { computed, onBeforeUnmount, ref } from 'vue';

export type PanelAnchor = 'left' | 'right' | 'bottom';

export interface DraggableOptions {
  anchor: PanelAnchor;
  initialX: number;
  initialY: number;
}

export function useDraggable(options: DraggableOptions) {
  const pos = ref({ x: options.initialX, y: options.initialY });
  const dragging = ref(false);

  let startX = 0;
  let startY = 0;
  let startPosX = 0;
  let startPosY = 0;

  const style = computed(() => {
    if (options.anchor === 'left') {
      return { left: `${pos.value.x}px`, top: `${pos.value.y}px` };
    }
    if (options.anchor === 'right') {
      return { right: `${pos.value.x}px`, top: `${pos.value.y}px` };
    }
    // bottom
    return { left: `${pos.value.x}px`, bottom: `${pos.value.y}px` };
  });

  function onDragStart(e: MouseEvent) {
    e.preventDefault();
    dragging.value = true;
    startX = e.clientX;
    startY = e.clientY;
    startPosX = pos.value.x;
    startPosY = pos.value.y;
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  }

  function onDragMove(e: MouseEvent) {
    if (!dragging.value) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (options.anchor === 'left') {
      pos.value = { x: Math.max(72, startPosX + dx), y: Math.max(0, startPosY + dy) };
    } else if (options.anchor === 'right') {
      pos.value = { x: Math.max(0, startPosX - dx), y: Math.max(0, startPosY + dy) };
    } else {
      // bottom
      pos.value = { x: Math.max(0, startPosX + dx), y: Math.max(0, startPosY - dy) };
    }
  }

  function onDragEnd() {
    dragging.value = false;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
  }

  onBeforeUnmount(() => {
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
  });

  return { pos, style, dragging, onDragStart };
}
