<script setup lang="ts">
/**
 * 场景通用浮动面板外壳（纯容器，不含 Transition / v-if）
 *
 * 收敛 river / planning 各页面手写的浮动面板容器：
 * - 可见性与过渡由宿主页面控制：`<Transition name><ScenePanel v-if="…">…</ScenePanel></Transition>`
 * - 根元素是普通 div，宿主传入的 class（.side-panel / .floating-panel / .result-panel 等）
 *   与 :style（拖拽定位 / resize 宽高）会被 Vue 合并到根上；由于根是普通元素，
 *   宿主页面 scoped 样式（`.side-panel[data-v-x]`、`.panel-slide-*` 过渡规则）可正常命中
 * - 折叠交互保留在内容组件内部（各面板自管 collapsed 并 emit `toggle-collapse`），
 *   本外壳不做整块隐藏，避免「折叠后展开按钮一起消失」
 * - header 两种形态：`#header` 插槽原样渲染宿主拖拽手柄（保留各自视觉）；
 *   未提供时渲染默认 header（title + 可选 close）
 */
import SvgIcon from '@/components/custom/svg-icon.vue';

defineOptions({ name: 'ScenePanel' });

withDefaults(
  defineProps<{
    /** 默认 header 标题（未提供 #header 插槽时显示） */
    title?: string;
    /** 是否显示关闭按钮（默认 header 内） */
    closable?: boolean;
  }>(),
  {
    title: '',
    closable: false
  }
);

type Emits = import('@/typings/panel-emits').PanelEmits & {
  /** 拖拽开始（默认 header 或 #header 插槽内触发），传 MouseEvent 供 useDraggable.onDragStart 消费 */
  dragStart: [e: MouseEvent];
};

const emit = defineEmits<Emits>();

function handleDragStart(e: MouseEvent) {
  emit('dragStart', e);
}
</script>

<template>
  <div class="scene-panel">
    <!-- 页面自定义拖拽手柄：原样放入，保留各自 scoped 视觉 -->
    <slot v-if="$slots.header" name="header" :on-drag-start="handleDragStart" />
    <!-- 默认 header：仅在未提供 #header 时使用 -->
    <div v-else class="scene-panel__drag-handle" @mousedown="handleDragStart">
      <span class="scene-panel__drag-dots">⋮⋮</span>
      <span class="scene-panel__title">{{ title }}</span>
      <button v-if="closable" type="button" class="scene-panel__close-btn" @click.stop="emit('close')">
        <SvgIcon icon="mdi:close" />
      </button>
    </div>

    <!-- 内容区：折叠由内容组件自管，这里不做显隐切换 -->
    <slot />
  </div>
</template>

<style scoped>
/* 薄外壳：定位/宽度/布局/颜色等由宿主透传的 class（.side-panel / .floating-panel / .result-panel 等）决定，
   因此这里不强加 flex/背景样式，避免与页面既有布局叠加导致回归。 */

/* ─── 默认 header（供不使用 #header 插槽的宿主） ─── */
.scene-panel__drag-handle {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 22px;
  flex-shrink: 0;
  padding: 0 8px;
  color: rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.02);
  cursor: move;
  user-select: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.scene-panel__drag-handle:hover {
  color: rgba(255, 255, 255, 0.55);
  background: rgba(255, 255, 255, 0.04);
}
.scene-panel__drag-dots {
  font-size: 14px;
  line-height: 1;
  letter-spacing: 2px;
}
.scene-panel__title {
  font-size: 11px;
}
.scene-panel__close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-left: auto;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  font-size: 14px;
}
.scene-panel__close-btn:hover {
  background: rgba(251, 113, 133, 0.16);
  color: #fb7185;
}
</style>
