<script setup lang="ts">
import { computed } from 'vue';
import { useThemeStore } from '@/store/modules/theme';

/**
 * 应用抽屉外壳（所有右侧抽屉共用）
 *
 * 为什么要有这一层：
 *  1. 抽屉此前直接用 naive 的 NDrawerContent，标题栏/内边距/底栏都是库的默认观感，
 *     与本系统深色界面不统一；
 *  2. 三处抽屉（布局与主题、编辑文档、集合编辑）各写一遍标题栏与滚动逻辑会重复；
 *  3. 统一在这里之后，**颜色走 --ui-*、字号走 --font-*、高亮走 --dw-accent
 *     （跟随用户所选主色）**，深浅色自动成立。
 *
 * 保留 naive 的能力：NDrawer 继续负责遮罩、过渡、Esc 关闭、焦点陷阱等行为，
 * 这里只接管观感，不重写交互。
 *
 * 槽位：默认 = 主体（内部滚动）；footer = 底部操作区（可选）。
 */
interface Props {
  /** 显示状态（v-model:show） */
  show: boolean;
  /** 标题 */
  title: string;
  /** 副标题（可选，一句话说明用途） */
  subtitle?: string;
  /** 面板宽度，默认 440 */
  width?: number;
  /** 点击遮罩是否关闭，默认允许 */
  maskClosable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  subtitle: '',
  width: 440,
  maskClosable: true
});

const emit = defineEmits<{
  'update:show': [value: boolean];
}>();

const themeStore = useThemeStore();

/** 高亮色跟随所选主色：抽屉里的选中态与主按钮都随之变化 */
const panelStyle = computed(() => ({ '--dw-accent': themeStore.themeColor }));

function close() {
  emit('update:show', false);
}
</script>

<template>
  <NDrawer
    :show="props.show"
    :width="props.width"
    :mask-closable="props.maskClosable"
    placement="right"
    class="app-drawer"
    @update:show="emit('update:show', $event)"
  >
    <div class="dw" :style="panelStyle">
      <header class="dw-header">
        <div class="dw-header__text">
          <h2 class="dw-title">{{ props.title }}</h2>
          <p v-if="props.subtitle" class="dw-subtitle">{{ props.subtitle }}</p>
        </div>
        <button type="button" class="dw-close" title="关闭" :aria-label="`关闭${props.title}`" @click="close">
          <SvgIcon icon="mdi:close" />
        </button>
      </header>

      <div class="dw-body">
        <slot />
      </div>

      <footer v-if="$slots.footer" class="dw-footer">
        <slot name="footer" />
      </footer>
    </div>
  </NDrawer>
</template>

<style scoped>
/* ============================================================
   颜色：--ui-*（深浅两套均有定义）
   字号：--font-*（30-50 岁基线）
   高亮：--dw-accent（跟随用户所选主色）
   ============================================================ */

.app-drawer {
  display: flex;
  flex-direction: column;
  background: var(--ui-surface-2);
}

.dw {
  /* flex 撑满 + max-height 兜底：不依赖上层容器是否给了确定高度 */
  flex: 1;
  min-height: 0;
  max-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--ui-surface-2);
  color: var(--ui-text-1);
}

/* ── 标题栏 ── */
.dw-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--ui-border-1);
  flex-shrink: 0;
}

.dw-header__text {
  flex: 1;
  min-width: 0;
}

.dw-title {
  margin: 0;
  font-size: var(--font-xl);
  font-weight: 700;
  letter-spacing: 0.01em;
  color: var(--ui-text-1);
}

.dw-subtitle {
  margin: 3px 0 0;
  font-size: var(--font-xs);
  color: var(--ui-text-3);
}

.dw-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ui-text-3);
  font-size: var(--font-xl);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}

.dw-close:hover {
  background: var(--ui-surface-3);
  color: var(--ui-text-1);
}

.dw-close:focus-visible {
  outline: 2px solid var(--dw-accent);
  outline-offset: 1px;
}

/* ── 主体（内部滚动） ── */
.dw-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 18px 20px;
  scrollbar-width: thin;
  scrollbar-color: var(--ui-border-2) transparent;
}

.dw-body::-webkit-scrollbar {
  width: 6px;
}

.dw-body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: var(--ui-border-2);
}

/* ── 底部操作区 ── */
.dw-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 18px;
  border-top: 1px solid var(--ui-border-1);
  flex-shrink: 0;
}

/* ── 槽位里的 naive 表单：只调观感，行为与可访问性交给 naive ──
   这些规则写在 .dw 之下，插槽内容同样落在 .dw 内部，因此可以被命中。 */
.dw :deep(.n-form-item .n-form-item-label) {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--ui-text-2);
  padding-bottom: 6px;
}

.dw :deep(.n-input),
.dw :deep(.n-base-selection),
.dw :deep(.n-input-number) {
  --n-border-radius: 8px;
  --n-height: 38px;
  --n-font-size: var(--font-base);
}

.dw :deep(.n-input.n-input--textarea) {
  --n-height: auto;
}

.dw :deep(.n-form-item) {
  margin-bottom: 4px;
}

/* 底栏按钮：统一到与全站一致的尺寸与圆角（颜色仍取用户所选主色） */
.dw-footer :deep(.n-button) {
  --n-height: 38px;
  --n-font-size: var(--font-sm);
  --n-border-radius: 8px;
  padding: 0 18px;
}
</style>
