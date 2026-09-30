<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAppStore } from '@/store/modules/app';
import { useThemeStore } from '@/store/modules/theme';

/**
 * 布局与主题抽屉
 *
 * 设计取舍（相对模板原生形态）：
 *  1. **布局模式从下拉改为缩略图**：六种布局的名字（"垂直-混合（顶栏一级）"…）
 *     读不出界面长什么样，点选前不知道会变成什么。改成小示意图后一眼可辨。
 *  2. **高度/宽度从数字框改为滑杆**：这类参数是"连续调节 + 立刻看效果"，
 *     滑杆比敲数字直观，也不会出现越界值。
 *  3. **控件全部自绘**（分段、开关、色板、滑杆）：原生控件在本系统的深色界面里
 *     尺寸与配色都不统一；自绘后统一走 --ui-* 与 --font-* 两套体系，
 *     深色/浅色自动跟随，字号也落在 30-50 岁可读的档位上。
 *  4. 高亮色跟随用户所选主色（--tp-accent），选色时整块面板立刻变色。
 */

defineOptions({ name: 'ThemeDrawer' });

const appStore = useAppStore();
const themeStore = useThemeStore();

/** 当前页签 */
const activeTab = ref<'layout' | 'appearance'>('layout');

const tabs = [
  { key: 'layout' as const, label: '布局' },
  { key: 'appearance' as const, label: '外观' }
];

// ──── 布局 ────
const layoutMode = computed({
  get: () => themeStore.layout.mode,
  set: (val: UnionKey.ThemeLayoutMode) => {
    themeStore.setThemeLayout(val);
  }
});

const scrollMode = computed({
  get: () => themeStore.layout.scrollMode,
  set: (val: UnionKey.ThemeScrollMode) => {
    themeStore.layout.scrollMode = val;
  }
});

/** 六种布局：value 同时用于缩略图的类名（见 .tp-preview--* ） */
const layoutPresets: { label: string; value: UnionKey.ThemeLayoutMode }[] = [
  { label: '垂直', value: 'vertical' },
  { label: '水平', value: 'horizontal' },
  { label: '垂直混合', value: 'vertical-mix' },
  { label: '垂直混合 · 顶栏一级', value: 'vertical-hybrid-header-first' },
  { label: '顶部混合 · 侧栏一级', value: 'top-hybrid-sidebar-first' },
  { label: '顶部混合 · 顶栏一级', value: 'top-hybrid-header-first' }
];

const scrollModeOptions: { label: string; value: UnionKey.ThemeScrollMode }[] = [
  { label: '外层滚动', value: 'wrapper' },
  { label: '内容区滚动', value: 'content' }
];

// ──── 尺寸（滑杆） ────
const headerHeight = computed({
  get: () => themeStore.header.height,
  set: (val: number) => {
    themeStore.header.height = val;
  }
});

const tabHeight = computed({
  get: () => themeStore.tab.height,
  set: (val: number) => {
    themeStore.tab.height = val;
  }
});

const siderWidth = computed({
  get: () => themeStore.sider.width,
  set: (val: number) => {
    themeStore.sider.width = val;
  }
});

const siderCollapsedWidth = computed({
  get: () => themeStore.sider.collapsedWidth,
  set: (val: number) => {
    themeStore.sider.collapsedWidth = val;
  }
});

const themeRadius = computed({
  get: () => themeStore.themeRadius,
  set: (val: number) => {
    themeStore.themeRadius = val;
  }
});

/** 滑杆统一取值：只接受数字，空值回落到最小值（原生 range 不会给 null） */
function onRange(setter: (val: number) => void, min: number) {
  return (event: Event) => {
    const raw = Number((event.target as HTMLInputElement).value);
    setter(Number.isFinite(raw) ? raw : min);
  };
}

// ──── 外观 ────
const themeColor = computed({
  get: () => themeStore.themeColor,
  set: (val: string) => {
    themeStore.updateThemeColors('primary', val);
  }
});

/** 预设主色：覆盖常用色相，避免每次都开取色器 */
const colorPresets = ['#3D6FE0', '#4A7DBD', '#38BDF8', '#00D4AA', '#34D399', '#F1C40F', '#F59E0B', '#A78BFA'];

function isActiveColor(color: string) {
  return themeStore.themeColor?.toLowerCase() === color.toLowerCase();
}

/** 高亮色跟随所选主色，选色即时预览 */
const panelStyle = computed(() => ({ '--tp-accent': themeStore.themeColor }));
</script>

<template>
  <NDrawer v-model:show="appStore.themeDrawerVisible" placement="right" :width="420" class="theme-drawer">
    <div class="tp" :style="panelStyle">
      <!-- ── 标题 ── -->
      <header class="tp-header">
        <div class="tp-header__text">
          <h2 class="tp-title">布局与主题</h2>
          <p class="tp-subtitle">改动即时生效并自动保存</p>
        </div>
        <button
          type="button"
          class="tp-close"
          title="关闭"
          aria-label="关闭布局与主题面板"
          @click="appStore.closeThemeDrawer()"
        >
          <SvgIcon icon="mdi:close" />
        </button>
      </header>

      <!-- ── 页签 ── -->
      <nav class="tp-tabs" role="tablist" aria-label="布局与主题分类">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          role="tab"
          class="tp-tab"
          :class="{ 'tp-tab--active': activeTab === t.key }"
          :aria-selected="activeTab === t.key"
          @click="activeTab = t.key"
        >
          {{ t.label }}
        </button>
      </nav>

      <div class="tp-body">
        <!-- ══ 布局 ══ -->
        <template v-if="activeTab === 'layout'">
          <section class="tp-section">
            <div class="tp-section__head">
              <h3 class="tp-section__title">布局模式</h3>
              <span class="tp-section__hint">点选缩略图切换</span>
            </div>
            <div class="tp-preset-grid">
              <button
                v-for="preset in layoutPresets"
                :key="preset.value"
                type="button"
                class="tp-preset"
                :class="{ 'tp-preset--active': layoutMode === preset.value }"
                :aria-pressed="layoutMode === preset.value"
                @click="layoutMode = preset.value"
              >
                <span class="tp-preview" :class="`tp-preview--${preset.value}`" aria-hidden="true">
                  <span class="tp-preview__header" />
                  <span class="tp-preview__side" />
                  <span class="tp-preview__main" />
                </span>
                <span class="tp-preset__label">{{ preset.label }}</span>
              </button>
            </div>
          </section>

          <section class="tp-section">
            <h3 class="tp-section__title">滚动模式</h3>
            <div class="tp-seg" role="group" aria-label="滚动模式">
              <button
                v-for="option in scrollModeOptions"
                :key="option.value"
                type="button"
                class="tp-seg__item"
                :class="{ 'tp-seg__item--active': scrollMode === option.value }"
                :aria-pressed="scrollMode === option.value"
                @click="scrollMode = option.value"
              >
                {{ option.label }}
              </button>
            </div>
          </section>

          <section class="tp-section">
            <h3 class="tp-section__title">显示</h3>
            <div class="tp-rows">
              <div class="tp-row">
                <span class="tp-row__label">固定顶栏与标签</span>
                <button
                  type="button"
                  role="switch"
                  class="tp-switch"
                  :class="{ 'tp-switch--on': themeStore.fixedHeaderAndTab }"
                  :aria-checked="themeStore.fixedHeaderAndTab"
                  aria-label="固定顶栏与标签"
                  @click="themeStore.fixedHeaderAndTab = !themeStore.fixedHeaderAndTab"
                >
                  <span class="tp-switch__dot" />
                </button>
              </div>
              <div class="tp-row">
                <span class="tp-row__label">显示标签栏</span>
                <button
                  type="button"
                  role="switch"
                  class="tp-switch"
                  :class="{ 'tp-switch--on': themeStore.tab.visible }"
                  :aria-checked="themeStore.tab.visible"
                  aria-label="显示标签栏"
                  @click="themeStore.tab.visible = !themeStore.tab.visible"
                >
                  <span class="tp-switch__dot" />
                </button>
              </div>
              <div class="tp-row">
                <span class="tp-row__label">侧栏反色</span>
                <button
                  type="button"
                  role="switch"
                  class="tp-switch"
                  :class="{ 'tp-switch--on': themeStore.sider.inverted }"
                  :aria-checked="themeStore.sider.inverted"
                  aria-label="侧栏反色"
                  @click="themeStore.sider.inverted = !themeStore.sider.inverted"
                >
                  <span class="tp-switch__dot" />
                </button>
              </div>
              <div class="tp-row">
                <span class="tp-row__label">显示底部栏</span>
                <button
                  type="button"
                  role="switch"
                  class="tp-switch"
                  :class="{ 'tp-switch--on': themeStore.footer.visible }"
                  :aria-checked="themeStore.footer.visible"
                  aria-label="显示底部栏"
                  @click="themeStore.footer.visible = !themeStore.footer.visible"
                >
                  <span class="tp-switch__dot" />
                </button>
              </div>
            </div>
          </section>

          <section class="tp-section">
            <h3 class="tp-section__title">尺寸</h3>
            <label class="tp-slider">
              <span class="tp-slider__head">
                <span class="tp-row__label">顶栏高度</span>
                <span class="tp-slider__value">{{ headerHeight }} px</span>
              </span>
              <input
                type="range"
                class="tp-range"
                :min="44"
                :max="72"
                :value="headerHeight"
                aria-label="顶栏高度"
                @input="onRange(val => (headerHeight = val), 44)"
              />
            </label>
            <label class="tp-slider">
              <span class="tp-slider__head">
                <span class="tp-row__label">标签栏高度</span>
                <span class="tp-slider__value">{{ tabHeight }} px</span>
              </span>
              <input
                type="range"
                class="tp-range"
                :min="32"
                :max="64"
                :value="tabHeight"
                aria-label="标签栏高度"
                @input="onRange(val => (tabHeight = val), 32)"
              />
            </label>
            <label class="tp-slider">
              <span class="tp-slider__head">
                <span class="tp-row__label">侧栏宽度</span>
                <span class="tp-slider__value">{{ siderWidth }} px</span>
              </span>
              <input
                type="range"
                class="tp-range"
                :min="160"
                :max="320"
                :value="siderWidth"
                aria-label="侧栏宽度"
                @input="onRange(val => (siderWidth = val), 160)"
              />
            </label>
            <label class="tp-slider">
              <span class="tp-slider__head">
                <span class="tp-row__label">侧栏收起宽度</span>
                <span class="tp-slider__value">{{ siderCollapsedWidth }} px</span>
              </span>
              <input
                type="range"
                class="tp-range"
                :min="48"
                :max="100"
                :value="siderCollapsedWidth"
                aria-label="侧栏收起宽度"
                @input="onRange(val => (siderCollapsedWidth = val), 48)"
              />
            </label>
          </section>
        </template>

        <!-- ══ 外观 ══ -->
        <template v-else>
          <section class="tp-section">
            <div class="tp-section__head">
              <h3 class="tp-section__title">主色</h3>
              <span class="tp-section__hint">当前 {{ themeStore.themeColor }}</span>
            </div>
            <div class="tp-swatches">
              <button
                v-for="color in colorPresets"
                :key="color"
                type="button"
                class="tp-swatch"
                :class="{ 'tp-swatch--active': isActiveColor(color) }"
                :style="{ background: color }"
                :aria-label="`主色 ${color}`"
                :aria-pressed="isActiveColor(color)"
                @click="themeColor = color"
              >
                <SvgIcon v-if="isActiveColor(color)" icon="mdi:check" />
              </button>
              <NColorPicker v-model:value="themeColor" :modes="['hex']" :show-alpha="false" class="tp-color-picker" />
            </div>
            <div class="tp-rows tp-rows--spaced">
              <div class="tp-row">
                <span class="tp-row__label">启用推荐色阶</span>
                <button
                  type="button"
                  role="switch"
                  class="tp-switch"
                  :class="{ 'tp-switch--on': themeStore.recommendColor }"
                  :aria-checked="themeStore.recommendColor"
                  aria-label="启用推荐色阶"
                  @click="themeStore.recommendColor = !themeStore.recommendColor"
                >
                  <span class="tp-switch__dot" />
                </button>
              </div>
            </div>
          </section>

          <section class="tp-section">
            <h3 class="tp-section__title">圆角</h3>
            <label class="tp-slider">
              <span class="tp-slider__head">
                <span class="tp-row__label">界面圆角</span>
                <span class="tp-slider__value">{{ themeRadius }} px</span>
              </span>
              <input
                type="range"
                class="tp-range"
                :min="0"
                :max="16"
                :value="themeRadius"
                aria-label="界面圆角"
                @input="onRange(val => (themeRadius = val), 0)"
              />
            </label>
          </section>

          <section class="tp-section">
            <h3 class="tp-section__title">辅助</h3>
            <div class="tp-rows">
              <div class="tp-row">
                <span class="tp-row__label">灰度模式</span>
                <button
                  type="button"
                  role="switch"
                  class="tp-switch"
                  :class="{ 'tp-switch--on': themeStore.grayscale }"
                  :aria-checked="themeStore.grayscale"
                  aria-label="灰度模式"
                  @click="themeStore.grayscale = !themeStore.grayscale"
                >
                  <span class="tp-switch__dot" />
                </button>
              </div>
              <div class="tp-row">
                <span class="tp-row__label">色弱模式</span>
                <button
                  type="button"
                  role="switch"
                  class="tp-switch"
                  :class="{ 'tp-switch--on': themeStore.colourWeakness }"
                  :aria-checked="themeStore.colourWeakness"
                  aria-label="色弱模式"
                  @click="themeStore.colourWeakness = !themeStore.colourWeakness"
                >
                  <span class="tp-switch__dot" />
                </button>
              </div>
            </div>
          </section>
        </template>
      </div>
    </div>
  </NDrawer>
</template>

<style scoped>
/* ============================================================
   布局与主题抽屉
   颜色：全部走 --ui-*（深浅两套都有定义，自动跟随主题）
   字号：走 --font-*（30-50 岁基线，正文 15px、说明 ≥13px）
   高亮：--tp-accent 跟随用户所选主色
   ============================================================ */

/* 抽屉面板本身统一底色（内容 padding 由 .tp 自己控制；
   注：naive 的 .n-drawer-body 内边距来自 NDrawerContent，本面板未使用它）。
   用 flex 撑满而不是 height:100% —— 不依赖上层容器是否给了确定高度。 */
.theme-drawer {
  display: flex;
  flex-direction: column;
  background: var(--ui-surface-2);
}

.tp {
  /* 撑满抽屉：flex:1 用于面板已有确定高度的情况，
     max-height 兜住"面板无确定高度"的情况，两种层级下内部都能正常滚动 */
  flex: 1;
  min-height: 0;
  max-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--ui-surface-2);
  color: var(--ui-text-1);
}

/* ── 标题 ── */
.tp-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--ui-border-1);
  flex-shrink: 0;
}

.tp-header__text {
  flex: 1;
  min-width: 0;
}

.tp-title {
  margin: 0;
  font-size: var(--font-xl);
  font-weight: 700;
  letter-spacing: 0.01em;
  color: var(--ui-text-1);
}

.tp-subtitle {
  margin: 3px 0 0;
  font-size: var(--font-xs);
  color: var(--ui-text-3);
}

.tp-close {
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

.tp-close:hover {
  background: var(--ui-surface-3);
  color: var(--ui-text-1);
}

.tp-close:focus-visible {
  outline: 2px solid var(--tp-accent);
  outline-offset: 1px;
}

/* ── 页签（自绘分段，替代 naive Tabs） ── */
.tp-tabs {
  display: flex;
  gap: 6px;
  padding: 12px 18px 0;
  flex-shrink: 0;
}

.tp-tab {
  padding: 7px 18px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--ui-text-3);
  font-size: var(--font-sm);
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
}

.tp-tab:hover {
  background: var(--ui-surface-3);
  color: var(--ui-text-1);
}

.tp-tab--active {
  background: color-mix(in srgb, var(--tp-accent) 16%, transparent);
  border-color: color-mix(in srgb, var(--tp-accent) 45%, transparent);
  color: var(--tp-accent);
}

.tp-tab:focus-visible {
  outline: 2px solid var(--tp-accent);
  outline-offset: 1px;
}

/* ── 滚动体 ── */
.tp-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 18px 22px;
  scrollbar-width: thin;
  scrollbar-color: var(--ui-border-2) transparent;
}

.tp-body::-webkit-scrollbar {
  width: 6px;
}

.tp-body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: var(--ui-border-2);
}

/* ── 分区 ── */
.tp-section {
  margin-bottom: 20px;
}

.tp-section:last-child {
  margin-bottom: 0;
}

.tp-section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.tp-section__title {
  margin: 0 0 10px;
  font-size: var(--font-lg);
  font-weight: 700;
  color: var(--ui-text-1);
}

.tp-section__hint {
  font-size: var(--font-xs);
  color: var(--ui-text-3);
}

/* ── 布局缩略图 ── */
.tp-preset-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.tp-preset {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 9px;
  border: 1px solid var(--ui-border-1);
  border-radius: 10px;
  background: var(--ui-surface-3);
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.15s,
    background 0.15s,
    transform 0.15s;
}

.tp-preset:hover {
  border-color: var(--ui-border-2);
  transform: translateY(-1px);
}

.tp-preset--active {
  border-color: var(--tp-accent);
  background: color-mix(in srgb, var(--tp-accent) 12%, var(--ui-surface-3));
}

.tp-preset:focus-visible {
  outline: 2px solid var(--tp-accent);
  outline-offset: 1px;
}

.tp-preset__label {
  font-size: var(--font-xs);
  font-weight: 600;
  line-height: 1.35;
  color: var(--ui-text-2);
}

.tp-preset--active .tp-preset__label {
  color: var(--tp-accent);
}

/* 缩略图：一个盒子 + 三个块，用 grid-template-areas 区分六种布局 */
.tp-preview {
  display: grid;
  height: 62px;
  gap: 2px;
  padding: 3px;
  border-radius: 7px;
  background: var(--ui-surface-1);
  border: 1px solid var(--ui-border-1);
  overflow: hidden;
}

.tp-preview__header,
.tp-preview__side,
.tp-preview__main {
  border-radius: 3px;
}

.tp-preview__header {
  grid-area: header;
  background: color-mix(in srgb, var(--tp-accent) 55%, transparent);
}

.tp-preview__side {
  grid-area: side;
  background: color-mix(in srgb, var(--ui-text-3) 30%, transparent);
}

.tp-preview__main {
  grid-area: main;
  background: color-mix(in srgb, var(--ui-text-3) 14%, transparent);
}

.tp-preview--vertical {
  grid-template-areas: 'header header' 'side main';
  grid-template-columns: 30% 1fr;
  grid-template-rows: 26% 1fr;
}

.tp-preview--horizontal {
  grid-template-areas: 'header' 'main';
  grid-template-columns: 1fr;
  grid-template-rows: 32% 1fr;
}

.tp-preview--horizontal .tp-preview__side {
  display: none;
}

.tp-preview--vertical-mix {
  grid-template-areas: 'header header' 'side main';
  grid-template-columns: 16% 1fr;
  grid-template-rows: 26% 1fr;
}

.tp-preview--vertical-hybrid-header-first {
  grid-template-areas: 'header header' 'side main';
  grid-template-columns: 24% 1fr;
  grid-template-rows: 40% 1fr;
}

.tp-preview--top-hybrid-sidebar-first {
  grid-template-areas: 'side header' 'side main';
  grid-template-columns: 26% 1fr;
  grid-template-rows: 26% 1fr;
}

.tp-preview--top-hybrid-header-first {
  grid-template-areas: 'header header' 'side main';
  grid-template-columns: 20% 1fr;
  grid-template-rows: 34% 1fr;
}

/* ── 分段控件 ── */
.tp-seg {
  display: flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--ui-border-1);
  border-radius: 10px;
  background: var(--ui-surface-3);
}

.tp-seg__item {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--ui-text-3);
  font-size: var(--font-sm);
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}

.tp-seg__item:hover {
  color: var(--ui-text-1);
}

.tp-seg__item--active {
  background: color-mix(in srgb, var(--tp-accent) 20%, transparent);
  color: var(--tp-accent);
}

.tp-seg__item:focus-visible {
  outline: 2px solid var(--tp-accent);
  outline-offset: -2px;
}

/* ── 行 / 开关 ── */
.tp-rows {
  display: flex;
  flex-direction: column;
}

.tp-rows--spaced {
  margin-top: 12px;
}

.tp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 42px;
  padding: 4px 0;
  border-bottom: 1px solid var(--ui-border-1);
}

.tp-row:last-child {
  border-bottom: none;
}

.tp-row__label {
  font-size: var(--font-sm);
  font-weight: 500;
  color: var(--ui-text-2);
}

.tp-switch {
  position: relative;
  width: 46px;
  height: 26px;
  flex-shrink: 0;
  padding: 0;
  border: 1px solid var(--ui-border-2);
  border-radius: 999px;
  background: var(--ui-surface-1);
  cursor: pointer;
  transition:
    background 0.18s,
    border-color 0.18s;
}

.tp-switch__dot {
  position: absolute;
  top: 50%;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--ui-text-3);
  transform: translateY(-50%);
  transition:
    left 0.18s,
    background 0.18s;
}

.tp-switch--on {
  background: color-mix(in srgb, var(--tp-accent) 70%, transparent);
  border-color: var(--tp-accent);
}

.tp-switch--on .tp-switch__dot {
  left: 23px;
  background: #fff;
}

.tp-switch:focus-visible {
  outline: 2px solid var(--tp-accent);
  outline-offset: 2px;
}

/* ── 滑杆 ── */
.tp-slider {
  display: block;
  padding: 6px 0 2px;
}

.tp-slider__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.tp-slider__value {
  font-size: var(--font-xs);
  font-weight: 600;
  color: var(--tp-accent);
  font-variant-numeric: tabular-nums;
}

.tp-range {
  width: 100%;
  height: 22px;
  margin: 0;
  appearance: none;
  background: transparent;
  cursor: pointer;
}

.tp-range::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 999px;
  background: var(--ui-surface-1);
  border: 1px solid var(--ui-border-1);
}

.tp-range::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  margin-top: -7px;
  border-radius: 50%;
  background: var(--tp-accent);
  border: 2px solid var(--ui-surface-2);
  box-shadow: 0 1px 4px rgb(0 0 0 / 30%);
}

.tp-range::-moz-range-track {
  height: 6px;
  border-radius: 999px;
  background: var(--ui-surface-1);
}

.tp-range::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--tp-accent);
  border: 2px solid var(--ui-surface-2);
}

.tp-range:focus-visible {
  outline: 2px solid var(--tp-accent);
  outline-offset: 2px;
}

/* ── 色板 ── */
.tp-swatches {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.tp-swatch {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 9px;
  color: #fff;
  font-size: var(--font-lg);
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 22%);
  transition: transform 0.15s;
}

.tp-swatch:hover {
  transform: translateY(-2px);
}

.tp-swatch--active {
  border-color: var(--ui-text-1);
}

.tp-swatch:focus-visible {
  outline: 2px solid var(--tp-accent);
  outline-offset: 2px;
}

/* 取色器触发器：与色板同尺寸，避免原生控件大小不一 */
.tp-color-picker {
  width: 34px;
}

.tp-color-picker :deep(.n-color-picker-trigger) {
  width: 34px;
  height: 34px;
  border-radius: 9px;
}
</style>
