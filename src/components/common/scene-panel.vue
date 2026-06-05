<script setup lang="ts">
/**
 * 场景通用面板容器
 *
 * 统一各场景中可拖拽/折叠/关闭的浮动面板样式与交互。
 * 配合 useDraggable composable 使用。
 */
import SvgIcon from '@/components/custom/svg-icon.vue';

defineOptions({ name: 'ScenePanel' });

const props = withDefaults(
  defineProps<{
    /** 面板标题 */
    title: string;
    /** 是否可见 */
    visible: boolean;
    /** 是否折叠 */
    collapsed: boolean;
    /** 面板位置，影响过渡动画方向 */
    placement: 'left' | 'right' | 'bottom';
    /** 面板宽度（px） */
    width?: number;
    /** 自定义 style 覆盖 */
    style?: Record<string, string>;
    /** 是否显示关闭按钮 */
    closable?: boolean;
  }>(),
  {
    width: 340,
    closable: true
  }
);

const emit = defineEmits<{
  /** 拖拽开始，传 MouseEvent */
  dragStart: [e: MouseEvent];
  /** 折叠/展开 */
  'toggle-collapse': [];
  /** 关闭面板 */
  close: [];
}>();

function handleDragStart(e: MouseEvent) {
  emit('dragStart', e);
}
</script>

<template>
  <Transition :name="`panel-slide-${placement}`">
    <div
      v-if="visible"
      class="scene-panel"
      :class="[`scene-panel--${placement}`]"
      :style="{ '--panel-width': `${width}px`, ...style }"
    >
      <!-- 拖拽手柄 -->
      <div
        class="scene-panel__drag-handle"
        :class="{ 'scene-panel__drag-handle--horizontal': placement === 'bottom' }"
        @mousedown="handleDragStart"
      >
        <span class="scene-panel__drag-dots">{{ placement === 'bottom' ? '⋯' : '⋮⋮' }}</span>
        <span class="scene-panel__title">{{ title }}</span>
        <button
          v-if="closable"
          type="button"
          class="scene-panel__close-btn"
          @click.stop="emit('close')"
        >
          <SvgIcon icon="mdi:close" />
        </button>
      </div>

      <!-- 折叠内容 -->
      <div v-show="!collapsed" class="scene-panel__body">
        <slot />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.scene-panel {
  position: fixed;
  display: flex;
  flex-direction: column;
  background: rgba(15, 23, 42, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(14px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  z-index: 21;
  border-radius: 14px;
}
.scene-panel--left {
  width: var(--panel-width);
  max-height: calc(100vh - 36px);
}
.scene-panel--right {
  width: min(var(--panel-width), calc(100vw - 72px));
  max-height: calc(100vh - 120px);
}
.scene-panel--bottom {
  width: min(96vw, 1100px);
  max-height: 300px;
}

/* ─── 拖拽手柄 ─── */
.scene-panel__drag-handle {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.36);
  background: rgba(255, 255, 255, 0.03);
  cursor: move;
  user-select: none;
  flex-shrink: 0;
  letter-spacing: 0.04em;
}
.scene-panel__drag-handle:hover {
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.06);
}
.scene-panel__drag-dots {
  font-size: 14px;
  line-height: 1;
  letter-spacing: 2px;
}
.scene-panel__title {
  font-size: 11px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.4);
}
.scene-panel__close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.35);
  cursor: pointer;
  font-size: 14px;
  margin-left: auto;
  transition: all 0.18s;
}
.scene-panel__close-btn:hover {
  background: rgba(251, 113, 133, 0.15);
  color: #fb7185;
}

/* ─── 内容区 ─── */
.scene-panel__body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(141, 184, 255, 0.24) transparent;
}
.scene-panel__body::-webkit-scrollbar {
  width: 5px;
}
.scene-panel__body::-webkit-scrollbar-track {
  border-radius: 999px;
  background: transparent;
}
.scene-panel__body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(141, 184, 255, 0.24);
}
.scene-panel__body::-webkit-scrollbar-thumb:hover {
  background: rgba(141, 184, 255, 0.48);
}

/* ─── 面板内组件去边框 ─── */
.scene-panel :deep(.setting-panel),
.scene-panel :deep(.info-panel),
.scene-panel :deep(.ai-panel),
.scene-panel :deep(.route-settings),
.scene-panel :deep(.support-settings),
.scene-panel :deep(.route-ai-panel),
.scene-panel :deep(.support-ai-panel),
.scene-panel :deep(.route-result-bar),
.scene-panel :deep(.support-result-bar),
.scene-panel :deep(.result-bar) {
  width: 100% !important;
  border: none !important;
  background: transparent !important;
  backdrop-filter: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}

/* ─── 过渡动画 ─── */
.panel-slide-left-enter-active,
.panel-slide-left-leave-active {
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.28s ease;
}
.panel-slide-left-enter-from { transform: translateX(-20px); opacity: 0; }
.panel-slide-left-leave-to { transform: translateX(-20px); opacity: 0; }

.panel-slide-right-enter-active,
.panel-slide-right-leave-active {
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.28s ease;
}
.panel-slide-right-enter-from { transform: translateX(20px); opacity: 0; }
.panel-slide-right-leave-to { transform: translateX(20px); opacity: 0; }

.panel-slide-up-enter-active,
.panel-slide-up-leave-active {
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.28s ease;
}
.panel-slide-up-enter-from { transform: translateX(-50%) translateY(20px); opacity: 0; }
.panel-slide-up-leave-to { transform: translateX(-50%) translateY(20px); opacity: 0; }

/* ─── 响应式 ─── */
@media (max-width: 1280px) {
  .scene-panel--left { width: min(340px, calc(100vw - 72px)); }
  .scene-panel--right { width: min(380px, calc(100vw - 72px)); }
  .scene-panel--bottom { width: min(96vw, 960px); }
}
</style>
