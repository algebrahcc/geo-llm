<script setup lang="ts">
/**
 * 地下空间场景右侧控制面板：模型清单 + 剖切控制 + 视角预设。
 *
 * UI 完全对齐渡河场景的方案设置面板（`river-setting-panel.vue`）：
 *   - 同一个面板外壳：`#0e1626` 底 + 10px 圆角 + 大投影 + 顶部标题栏；
 *   - 内部用「分区」组织（左侧 2px 蓝条 + 可折叠标题），而不是堆三张独立卡片；
 *   - 文字一律「白色 + 降不透明度」分档，字号走全局字号阶 `--font-*`
 *     （深色底上用灰色会与底色糊在一起，这也是全局 css 里写明的约定）；
 *   - 图标按钮 32×32、无边框、`rgba(255,255,255,.06)` 底，与 `.action-btn` 一致。
 */
import { computed, reactive, ref, watch } from 'vue';
import { useDraggable } from '@/composables/use-draggable';
import type { ClippingState } from '@/composables/cesium/underground/clipping';
import {
  clipAxisLabel,
  formatElevation,
  type ClipAxis,
  type ElevationRange
} from '@/composables/cesium/underground/elevation-scale';
import type { UndergroundModelItem, ViewPreset } from './use-cesium-underground';

defineOptions({ name: 'UndergroundPanel' });

interface Props {
  models: UndergroundModelItem[];
  activeId: number | null;
  clipping: ClippingState;
  elevationRange: ElevationRange | null;
  currentElevation: number;
  currentFloorLabel: string;
  loading: boolean;
  hasAnchor: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [id: number];
  toggle: [id: number];
  fly: [id: number];
  retry: [id: number];
  refresh: [];
  /** 回传完整的剖切状态：子组件不直接改写父组件对象，由父组件统一落到 Cesium */
  'clip-change': [state: ClippingState];
  'fly-preset': [preset: ViewPreset];
}>();

/**
 * 剖切状态的本地工作副本。
 *
 * 不能直接改 `props.clipping`：那是父组件（组合式函数）里的唯一事实来源，
 * 子组件改写它属于越权（eslint `vue/no-mutating-props` 也会拦下）。
 * 这里维护一份同步副本——用户操作改副本，再通过 `clip-change` 把完整状态回传，
 * 由父组件统一应用到 Cesium；父组件状态变化时再同步回来，避免两边不一致。
 */
const draft = reactive<ClippingState>({ ...props.clipping });

watch(
  () => props.clipping,
  value => Object.assign(draft, value),
  { deep: true }
);

/** 改副本并回传（所有剖切操作的唯一出口） */
function commit(patch: Partial<ClippingState>): void {
  Object.assign(draft, patch);
  emit('clip-change', { ...draft });
}

/**
 * 面板可拖动。
 *
 * 固定位置在实际使用里会挡住要剖切的模型：用户往往需要把面板挪到屏幕另一侧
 * 才能一边拖标高一边看剖面，所以位置必须能自己摆。锚点用 right（面板停靠右侧）。
 */
const { style: dragStyle, dragging, onDragStart } = useDraggable({ anchor: 'right', initialX: 12, initialY: 52 });

/** 分区折叠（对齐渡河面板的 section 交互） */
const sectionCollapsed = ref<Record<string, boolean>>({
  models: false,
  clip: false,
  views: false
});

function toggleSection(key: string): void {
  sectionCollapsed.value[key] = !sectionCollapsed.value[key];
}

const AXES: ClipAxis[] = ['up', 'east', 'north'];

const PRESETS: Array<{ key: ViewPreset; label: string; icon: string }> = [
  { key: 'top', label: '俯视', icon: 'mdi:arrow-collapse-down' },
  { key: 'front', label: '正视', icon: 'mdi:arrow-left-right' },
  { key: 'side', label: '侧视', icon: 'mdi:arrow-up-down' },
  { key: 'oblique', label: '斜视', icon: 'mdi:cube-outline' }
];

/** 已加载并显示中的模型数（面板标题右侧读数） */
const loadedCount = computed(() => props.models.filter(item => item.visible && item.state === 'ready').length);

/** 未配置摆放位置的模型无法剖切与定位，面板要给出原因而不是静默禁用 */
const missingAnchor = computed(() => !props.hasAnchor);

/** 滑杆进度的百分比，用于给轨道上色 */
const sliderPercent = computed(() => `${(draft.slider * 100).toFixed(2)}%`);

/** 地面 0m 在滑杆上的进度（0~1）；标高范围不含 0 时为 null（此时不画基准线） */
const groundRatio = computed(() => {
  const range = props.elevationRange;
  if (!range || range.max - range.min === 0) return null;
  if (range.min > 0 || range.max < 0) return null;
  return (0 - range.min) / (range.max - range.min);
});

/** 清单状态点：一处判定，避免模板里散落三元表达式 */
function statusOf(item: UndergroundModelItem): { tone: string; title: string } {
  if (!item.enabled) return { tone: 'idle', title: '数据服务未启用，点眼睛加载' };
  if (item.state === 'error') return { tone: 'error', title: item.error ?? '加载失败' };
  if (item.state === 'loading') return { tone: 'loading', title: '加载中' };
  return item.visible ? { tone: 'on', title: '已加载并显示' } : { tone: 'off', title: '已加载，当前隐藏' };
}

function onAxisChange(axis: ClipAxis): void {
  commit({ axis });
}

function onSliderInput(event: Event): void {
  commit({ slider: Number((event.target as HTMLInputElement).value) });
}

function toggleEnabled(): void {
  const enabled = !draft.enabled;
  // 开启时若滑杆还停在范围中段（用户没调过），先落到地面基准：
  // 剖切面在 0m 时正侧（地面上方）被裁掉，正好是「切开地表看地下」这个最常用起点，
  // 否则默认 0.5 会直接切到模型半高，看起来像模型缺了一半。
  const slider =
    enabled && groundRatio.value !== null && Math.abs(draft.slider - 0.5) < 0.02 ? groundRatio.value : draft.slider;
  commit({ enabled, slider });
}

function toggleGlobe(): void {
  commit({ clipGlobe: !draft.clipGlobe });
}

function toggleFlip(): void {
  commit({ flip: !draft.flip });
}
</script>

<template>
  <div class="ug-panel" :style="dragStyle">
    <!-- 标题栏（兼作拖动抓手） -->
    <header
      class="ug-header"
      :class="{ 'ug-header--grabbing': dragging }"
      title="按住拖动面板"
      @mousedown="onDragStart"
    >
      <span class="ug-header__title">地下空间</span>
      <span class="ug-header__meta">{{ loadedCount }}/{{ models.length }}</span>
      <div class="ug-header__actions">
        <button type="button" class="ug-action-btn" title="重新读取数据服务" @mousedown.stop @click="emit('refresh')">
          <SvgIcon icon="mdi:refresh" :class="{ 'ug-spin': loading }" />
        </button>
      </div>
    </header>

    <div class="ug-body">
      <!-- ══ 三维模型 ══ -->
      <section class="ug-section">
        <div class="ug-section__label" @click="toggleSection('models')">
          三维模型
          <SvgIcon
            class="ug-section__chevron"
            :icon="sectionCollapsed.models ? 'mdi:chevron-down' : 'mdi:chevron-up'"
          />
        </div>

        <div v-show="!sectionCollapsed.models" class="ug-section__body">
          <p v-if="models.length === 0" class="ug-hint">
            暂无三维模型数据。请在「数据管理 → 数据服务」新增
            <b>三维模型</b>
            类服务，地址填
            <code>public/data</code>
            下的相对路径。
          </p>

          <ul v-else class="ug-list">
            <li
              v-for="item in models"
              :key="item.id"
              class="ug-item"
              :class="{ 'ug-item--active': item.id === activeId }"
              @click="emit('select', item.id)"
            >
              <span class="ug-dot" :class="`ug-dot--${statusOf(item).tone}`" :title="statusOf(item).title" />

              <span class="ug-item__name" :title="`${item.name}\n${item.url}`">{{ item.name }}</span>
              <span class="ug-item__type">{{ item.type === '3dtiles' ? '3DT' : item.type.toUpperCase() }}</span>

              <span class="ug-item__actions">
                <button
                  v-if="item.enabled && item.state === 'error'"
                  type="button"
                  class="ug-action-btn ug-act ug-act--retry"
                  title="重试加载"
                  @click.stop="emit('retry', item.id)"
                >
                  <SvgIcon icon="mdi:reload" />
                </button>
                <button
                  type="button"
                  class="ug-action-btn ug-act ug-act--eye"
                  :title="item.visible ? '隐藏' : item.enabled ? '显示' : '加载并显示'"
                  @click.stop="emit('toggle', item.id)"
                >
                  <SvgIcon :icon="item.visible ? 'mdi:eye' : 'mdi:eye-off-outline'" />
                </button>
                <button
                  type="button"
                  class="ug-action-btn ug-act ug-act--fly"
                  title="定位"
                  @click.stop="emit('fly', item.id)"
                >
                  <SvgIcon icon="mdi:crosshairs-gps" />
                </button>
              </span>
            </li>
          </ul>

          <p v-if="models.some(item => !item.enabled)" class="ug-hint ug-hint--foot">
            灰点为「未启用」的数据服务，点眼睛即可加载
          </p>
        </div>
      </section>

      <!-- ══ 剖切 ══ -->
      <section class="ug-section">
        <div class="ug-section__label" @click="toggleSection('clip')">
          剖切与楼层
          <button
            type="button"
            class="ug-toggle"
            :class="{ 'ug-toggle--on': draft.enabled }"
            :title="draft.enabled ? '关闭剖切' : '开启剖切'"
            @click.stop="toggleEnabled"
          >
            <span class="ug-toggle__track"><span class="ug-toggle__thumb" /></span>
          </button>
          <SvgIcon class="ug-section__chevron" :icon="sectionCollapsed.clip ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
        </div>

        <div v-show="!sectionCollapsed.clip" class="ug-section__body">
          <p v-if="activeId === null" class="ug-hint">请先在上方选择一个模型</p>

          <p v-else-if="missingAnchor" class="ug-hint ug-hint--warn">
            该模型未配置摆放位置（
            <code>params.position</code>
            ），剖切与定位不可用
          </p>

          <template v-else>
            <div class="ug-field">
              <span class="ug-field__label">剖切方向</span>
              <div class="ug-segment">
                <button
                  v-for="axis in AXES"
                  :key="axis"
                  type="button"
                  class="ug-segment__item"
                  :class="{ 'ug-segment__item--on': draft.axis === axis }"
                  @click="onAxisChange(axis)"
                >
                  {{ clipAxisLabel(axis) }}
                </button>
              </div>
            </div>

            <div class="ug-field">
              <span class="ug-field__label">
                标高
                <b class="ug-field__value">{{ formatElevation(currentElevation) }}</b>
                <span class="ug-field__floor">{{ currentFloorLabel }}</span>
              </span>

              <div class="ug-slider-wrap">
                <input
                  class="ug-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.001"
                  :value="draft.slider"
                  :disabled="!draft.enabled"
                  :style="{ '--pos': sliderPercent }"
                  @input="onSliderInput"
                />
                <!--
 地面基准线：0m 在滑杆上的位置。
                     left 要补偿 .ug-slider-wrap 的 13px 左右内边距，否则会与滑杆错位 
-->
                <span
                  v-if="groundRatio !== null"
                  class="ug-slider__ground"
                  :style="{ left: `calc(13px + (100% - 26px) * ${groundRatio})` }"
                />
              </div>

              <div v-if="elevationRange" class="ug-scale">
                <span>{{ formatElevation(elevationRange.min) }}</span>
                <!-- 图例只在基准线真的画出来时才给，否则（模型整体在地下）会误导 -->
                <span v-if="groundRatio !== null" class="ug-scale__mid">地面 0m</span>
                <span v-else />
                <span>{{ formatElevation(elevationRange.max) }}</span>
              </div>
            </div>

            <div class="ug-field">
              <div class="ug-options">
                <button
                  type="button"
                  class="ug-check"
                  :class="{ 'ug-check--on': draft.clipGlobe }"
                  @click="toggleGlobe"
                >
                  <SvgIcon :icon="draft.clipGlobe ? 'mdi:checkbox-marked' : 'mdi:checkbox-blank-outline'" />
                  切开地表
                </button>
                <button type="button" class="ug-check" :class="{ 'ug-check--on': draft.flip }" @click="toggleFlip">
                  <SvgIcon :icon="draft.flip ? 'mdi:checkbox-marked' : 'mdi:checkbox-blank-outline'" />
                  翻转保留侧
                </button>
              </div>
            </div>
          </template>
        </div>
      </section>

      <!-- ══ 标准视图 ══ -->
      <section class="ug-section">
        <div class="ug-section__label" @click="toggleSection('views')">
          标准视图
          <SvgIcon class="ug-section__chevron" :icon="sectionCollapsed.views ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
        </div>

        <div v-show="!sectionCollapsed.views" class="ug-section__body">
          <div class="ug-views">
            <button
              v-for="preset in PRESETS"
              :key="preset.key"
              type="button"
              class="ug-view-btn"
              :disabled="!hasAnchor"
              @click="emit('fly-preset', preset.key)"
            >
              <SvgIcon :icon="preset.icon" />
              <span>{{ preset.label }}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* ── 面板外壳（对齐 river-setting-panel 的外观：深蓝底 + 10px 圆角 + 大投影）── */
.ug-panel {
  /* 文字层级：深色底上用「白色 + 降不透明度」，不用灰色（灰会与底色糊在一起） */
  --ug-text-1: rgb(255 255 255 / 95%);
  --ug-text-2: rgb(255 255 255 / 84%);
  --ug-text-3: rgb(255 255 255 / 70%);
  --ug-text-4: rgb(255 255 255 / 56%);
  /* 分区左蓝条与交互蓝（取自 river 面板的 section-label / action-btn hover） */
  --ug-bar: rgb(93 140 200 / 45%);
  --ug-blue-bg: rgb(43 107 255 / 15%);
  --ug-blue-border: rgb(93 140 200 / 50%);

  /* 位置由 useDraggable 的 inline style 给出（可拖动），此处不要写死 top/right */
  position: absolute;
  z-index: 10;
  display: flex;
  flex-direction: column;
  width: 380px;
  max-height: calc(100% - 32px);
  overflow: hidden;
  color: var(--ug-text-2);
  font-size: var(--font-sm);
  background: #0e1626;
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgb(0 0 0 / 45%);
}

/* ── 标题栏 ── */
.ug-header {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid rgb(255 255 255 / 6%);
  cursor: grab;
  user-select: none;
}

.ug-header--grabbing {
  cursor: grabbing;
}

.ug-header__title {
  font-size: var(--font-xl);
  font-weight: 700;
  color: var(--ug-text-1);
}

.ug-header__meta {
  margin-left: auto;
  color: var(--ug-text-4);
  font-size: var(--font-xs);
}

.ug-header__actions {
  display: flex;
  gap: 4px;
}

/* 图标按钮：与渡河面板的 .action-btn 同规格（32×32、无边框、浅底、hover 蓝） */
.ug-action-btn {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: var(--ug-text-3);
  font-size: var(--font-xl);
  cursor: pointer;
  background: rgb(255 255 255 / 6%);
  border: none;
  border-radius: 6px;
  transition:
    background 0.18s,
    color 0.18s;
}

.ug-action-btn:hover {
  color: var(--ug-text-1);
  background: var(--ug-blue-bg);
}

/* ── 内容滚动区 ── */
.ug-body {
  flex: 1;
  min-height: 0;
  padding: 14px 16px 10px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgb(141 184 255 / 24%) transparent;
}

.ug-body::-webkit-scrollbar {
  width: 5px;
}

.ug-body::-webkit-scrollbar-thumb {
  background: rgb(141 184 255 / 24%);
  border-radius: 999px;
}

/* ── 分区（对齐 river 的 .form-section / .section-label）── */
.ug-section {
  margin-bottom: 12px;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 5%);
  border-radius: 10px;
}

.ug-section:last-child {
  margin-bottom: 0;
}

.ug-section__label {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 9px 12px;
  color: var(--ug-text-3);
  font-size: var(--font-sm);
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  background: rgb(255 255 255 / 2%);
  border-left: 2px solid var(--ug-bar);
  user-select: none;
}

.ug-section__label:hover {
  color: var(--ug-text-1);
}

.ug-section__chevron {
  margin-left: auto;
  color: var(--ug-text-4);
  font-size: var(--font-lg);
}

/* 剖切分区的开关与箭头同时在（开关自带 margin-left:auto 靠右），
   这里把箭头的 auto 让出去，否则两个 auto 会平分剩余空间、开关停在标题栏中间。 */
.ug-section__label .ug-toggle ~ .ug-section__chevron {
  margin-left: 0;
}

.ug-section__body {
  padding: 10px 12px 12px;
}

/* ── 模型清单 ── */
.ug-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ug-item {
  position: relative;
  display: flex;
  gap: 10px;
  align-items: center;
  height: 38px;
  padding: 0 2px 0 10px;
  border-radius: 7px;
  cursor: pointer;
}

.ug-item::before {
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 0;
  width: 2px;
  background: transparent;
  border-radius: 1px;
  content: '';
}

.ug-item:hover {
  background: rgb(255 255 255 / 4%);
}

.ug-item--active {
  background: rgb(43 107 255 / 12%);
}

.ug-item--active::before {
  background: #3b82f6;
}

.ug-dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.ug-dot--on {
  background: #4f9e75;
}

.ug-dot--off {
  background: rgb(255 255 255 / 30%);
}

.ug-dot--idle {
  background: transparent;
  border: 1px solid rgb(255 255 255 / 30%);
}

.ug-dot--loading {
  background: #b8934a;
  animation: ug-pulse 1.2s ease-in-out infinite;
}

.ug-dot--error {
  background: #b8635f;
}

.ug-item__name {
  flex: 1;
  overflow: hidden;
  color: var(--ug-text-1);
  font-size: var(--font-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ug-item__type {
  flex: none;
  color: var(--ug-text-4);
  font-size: var(--font-xs);
}

.ug-item__actions {
  display: inline-flex;
  flex: none;
  gap: 4px;
  align-items: center;
}

/* 清单里的按钮小一号：标题栏的 32px 用在行内会撑高整行 */
.ug-item__actions .ug-action-btn {
  width: 26px;
  height: 26px;
  font-size: var(--font-md);
  background: transparent;
}

.ug-item__actions .ug-action-btn:hover {
  background: var(--ug-blue-bg);
}

/* 常态只留眼睛：模型显隐是最高频操作，且「眼睛关着」本身就是关键状态；
   定位与重试出现频率低，悬停或选中时再展开，避免一行里挤四个按钮。 */
.ug-act--retry,
.ug-act--fly {
  display: none;
}

.ug-item:hover .ug-act,
.ug-item--active .ug-act {
  display: flex;
}

/* ── 提示文案 ── */
.ug-hint {
  margin: 0;
  color: var(--ug-text-4);
  font-size: var(--font-xs);
  line-height: var(--font-lh-body);
}

.ug-hint--foot {
  margin-top: 8px;
}

.ug-hint--warn {
  color: rgb(255 208 130 / 85%);
}

.ug-hint b {
  color: var(--ug-text-2);
}

.ug-hint code {
  padding: 0 4px;
  color: var(--ug-text-3);
  font-family: ui-monospace, consolas, monospace;
  font-size: var(--font-xs);
  background: rgb(255 255 255 / 6%);
  border-radius: 4px;
}

/* ── 字段 ── */
.ug-field + .ug-field {
  margin-top: 12px;
}

.ug-field__label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  color: var(--ug-text-3);
  font-size: var(--font-sm);
  font-weight: 500;
}

.ug-field__value {
  margin-left: auto;
  color: var(--ug-text-1);
  font-family: ui-monospace, consolas, monospace;
  font-size: var(--font-md);
  font-weight: 600;
}

/* 层号：低饱和琥珀 + 细边框，只作为定位信息，不抢读数 */
.ug-field__floor {
  padding: 0 6px;
  color: rgb(201 164 92 / 95%);
  font-size: var(--font-xs);
  border: 1px solid rgb(201 164 92 / 35%);
  border-radius: 5px;
}

/* ── 剖切方向分段 ── */
.ug-segment {
  display: flex;
  gap: 4px;
}

.ug-segment__item {
  flex: 1;
  padding: 7px 0;
  color: var(--ug-text-3);
  font-size: var(--font-sm);
  cursor: pointer;
  background: rgb(255 255 255 / 6%);
  border: 1px solid transparent;
  border-radius: 7px;
  transition:
    background 0.18s,
    color 0.18s,
    border-color 0.18s;
}

.ug-segment__item:hover {
  color: var(--ug-text-1);
  background: rgb(255 255 255 / 10%);
}

.ug-segment__item--on {
  color: var(--ug-text-1);
  background: rgb(43 107 255 / 22%);
  border-color: var(--ug-blue-border);
}

/* ── 剖切开关 ── */
.ug-toggle {
  margin-left: auto;
  cursor: pointer;
}

.ug-toggle__track {
  display: block;
  width: 34px;
  height: 18px;
  padding: 2px;
  background: rgb(255 255 255 / 12%);
  border-radius: 4px;
  transition: background 0.18s;
}

.ug-toggle__thumb {
  display: block;
  width: 14px;
  height: 14px;
  background: rgb(255 255 255 / 70%);
  border-radius: 3px;
  transition:
    transform 0.18s,
    background 0.18s;
}

.ug-toggle--on .ug-toggle__track {
  background: rgb(43 107 255 / 45%);
}

.ug-toggle--on .ug-toggle__thumb {
  background: #fff;
  transform: translateX(16px);
}

/* ── 标高滑杆 ── */
.ug-slider-wrap {
  position: relative;
  padding: 0 13px;
}

.ug-slider {
  display: block;
  width: 100%;
  height: 22px;
  background: transparent;
  appearance: none;
  cursor: ew-resize;
}

.ug-slider:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ug-slider::-webkit-slider-runnable-track {
  height: 4px;
  background: linear-gradient(90deg, #3b82f6 0 var(--pos, 50%), rgb(255 255 255 / 14%) var(--pos, 50%) 100%);
  border-radius: 2px;
}

.ug-slider::-webkit-slider-thumb {
  width: 14px;
  height: 14px;
  margin-top: -5px;
  background: #fff;
  border: none;
  border-radius: 50%;
  appearance: none;
}

.ug-slider::-moz-range-track {
  height: 4px;
  background: rgb(255 255 255 / 14%);
  border-radius: 2px;
}

.ug-slider::-moz-range-progress {
  height: 4px;
  background: #3b82f6;
  border-radius: 2px;
}

.ug-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: #fff;
  border: none;
  border-radius: 50%;
}

.ug-slider__ground {
  position: absolute;
  top: 6px;
  width: 2px;
  height: 10px;
  background: rgb(201 164 92 / 95%);
  pointer-events: none;
}

.ug-scale {
  display: flex;
  justify-content: space-between;
  padding: 2px 13px 0;
  color: var(--ug-text-4);
  font-size: var(--font-xs);
}

.ug-scale__mid {
  color: rgb(201 164 92 / 95%);
}

/* ── 选项 ── */
.ug-options {
  display: flex;
  gap: 16px;
}

.ug-check {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: var(--ug-text-3);
  font-size: var(--font-sm);
  cursor: pointer;
}

.ug-check:hover {
  color: var(--ug-text-1);
}

.ug-check--on {
  color: var(--ug-text-1);
}

.ug-check--on :deep(svg) {
  color: #5d9bff;
}

/* ── 标准视图 ── */
.ug-views {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.ug-view-btn {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  padding: 9px 0 7px;
  color: var(--ug-text-3);
  font-size: var(--font-sm);
  cursor: pointer;
  background: rgb(255 255 255 / 6%);
  border: 1px solid transparent;
  border-radius: 7px;
  transition:
    background 0.18s,
    color 0.18s,
    border-color 0.18s;
}

.ug-view-btn :deep(svg) {
  font-size: var(--font-lg);
}

.ug-view-btn:hover:not(:disabled) {
  color: var(--ug-text-1);
  background: rgb(255 255 255 / 10%);
}

.ug-view-btn:disabled {
  color: var(--ug-text-4);
  cursor: not-allowed;
  background: rgb(255 255 255 / 3%);
}

/* ── 动效 ── */
.ug-spin {
  animation: ug-rotate 1.1s linear infinite;
}

@keyframes ug-rotate {
  to {
    transform: rotate(360deg);
  }
}

@keyframes ug-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.35;
  }
}
</style>
