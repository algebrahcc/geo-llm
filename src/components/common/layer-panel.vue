<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ServiceLayerHandle } from '@/composables/cesium/service-loader';

/**
 * 通用图层面板（设计文档 5.7）
 *
 * 对标 TerriaJS Workbench / ArcGIS LayerList：输入 ServiceLayerHandle[]，
 * 统一「图层卡片」条目结构 —— 眼睛图标切换显隐、六点手柄拖动排序、
 * 图例色块、hover 操作区（透明度 / 移除）、加载状态徽标。
 * 供 river/planning/globe/building 等地图页统一挂载。
 *
 * grouped：服务较多时按 category（影像/地形/三维/…）分组折叠展示，
 * 每组带计数与展开/收起，收敛长列表。
 */
const props = defineProps<{
  /** 激活服务图层句柄（来自 useCesiumServices.handles） */
  handles: ServiceLayerHandle[];
  /** 是否显示自带标题栏（嵌套到其它面板时置 false 避免双标题） */
  showHeader?: boolean;
  /** 是否按分类分组折叠展示 */
  grouped?: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle', id: number, visible: boolean): void;
  (e: 'opacity', id: number, opacity: number): void;
  (e: 'remove', id: number): void;
  (e: 'reorder', fromIndex: number, toIndex: number): void;
}>();

const CATEGORY_LABELS: Record<string, string> = {
  imagery: '影像',
  terrain: '地形',
  threed: '三维',
  vector: '矢量',
  streetview: '街景',
  analysis: '分析'
};

/** 分组固定展示顺序（与业务数据分类一致） */
const CATEGORY_ORDER: string[] = ['imagery', 'terrain', 'threed', 'vector', 'streetview', 'analysis'];

/** 分类默认色块（无图例时回退） */
const CATEGORY_COLORS: Record<string, string> = {
  imagery: '#22c55e',
  terrain: '#a855f7',
  threed: '#f97316',
  vector: '#5ea4ff',
  streetview: '#ec4899',
  analysis: '#facc15'
};

const visibleCount = computed(() => props.handles.filter(h => h.visible).length);

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

/** 主色块：优先图例首色，回退分类色 */
function swatchColor(handle: ServiceLayerHandle): string {
  return handle.legend?.[0]?.color ?? CATEGORY_COLORS[handle.category] ?? '#8db8ff';
}

// ─── 分组（grouped 模式） ────────────────────────────────

interface GroupedItem {
  handle: ServiceLayerHandle;
  /** 在全局 handles 数组中的下标（拖拽排序/移除均按全局下标） */
  globalIndex: number;
}
interface HandleGroup {
  category: string;
  items: GroupedItem[];
}

const groups = computed<HandleGroup[]>(() => {
  const map = new Map<string, GroupedItem[]>();
  props.handles.forEach((h, i) => {
    const arr = map.get(h.category) ?? [];
    arr.push({ handle: h, globalIndex: i });
    map.set(h.category, arr);
  });
  return [...map.entries()]
    .map(([category, items]) => ({ category, items }))
    .sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a.category);
      const bi = CATEGORY_ORDER.indexOf(b.category);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
});

/** 分组折叠状态 */
const collapsedGroups = ref<Record<string, boolean>>({});
function toggleGroup(category: string): void {
  collapsedGroups.value = { ...collapsedGroups.value, [category]: !collapsedGroups.value[category] };
}

/** 统一渲染列表：分组模式插入「组标题」条目，平铺模式仅条目 */
type RenderEntry =
  | { kind: 'group'; category: string; count: number }
  | { kind: 'item'; handle: ServiceLayerHandle; globalIndex: number };

const renderEntries = computed<RenderEntry[]>(() => {
  if (!props.grouped) {
    return props.handles.map((handle, globalIndex) => ({ kind: 'item' as const, handle, globalIndex }));
  }
  const entries: RenderEntry[] = [];
  for (const group of groups.value) {
    entries.push({ kind: 'group', category: group.category, count: group.items.length });
    if (!collapsedGroups.value[group.category]) {
      for (const item of group.items) {
        entries.push({ kind: 'item', handle: item.handle, globalIndex: item.globalIndex });
      }
    }
  }
  return entries;
});

// ─── 拖动排序（index 均为全局 handles 下标） ─────────────────

const dragIndex = ref<number | null>(null);
const overIndex = ref<number | null>(null);

function isSortable(handle: ServiceLayerHandle): boolean {
  return handle.state === 'ready';
}

function onDragStart(index: number): void {
  if (!isSortable(props.handles[index])) return;
  dragIndex.value = index;
}

function onDragOver(index: number, e: DragEvent): void {
  if (dragIndex.value === null || dragIndex.value === index) return;
  e.preventDefault();
  overIndex.value = index;
}

function onDrop(index: number): void {
  if (dragIndex.value !== null && dragIndex.value !== index) {
    emit('reorder', dragIndex.value, index);
  }
  dragIndex.value = null;
  overIndex.value = null;
}

function onDragEnd(): void {
  dragIndex.value = null;
  overIndex.value = null;
}

// ─── 透明度（展开式，本地记忆当前值） ─────────────────────

const opacityOpenId = ref<number | null>(null);
const opacityMap = ref<Record<number, number>>({});

function getOpacity(id: number): number {
  return opacityMap.value[id] ?? 1;
}

function toggleOpacity(id: number): void {
  opacityOpenId.value = opacityOpenId.value === id ? null : id;
}

function onOpacityInput(id: number, value: number): void {
  opacityMap.value = { ...opacityMap.value, [id]: value };
  emit('opacity', id, value);
}
</script>

<template>
  <div class="layer-panel">
    <!-- 标题栏 -->
    <div v-if="showHeader !== false" class="panel-header">
      <span class="header-icon">
        <SvgIcon icon="mdi:layers-outline" />
      </span>
      <span class="header-title">图层</span>
      <span class="layer-count">{{ visibleCount }}/{{ handles.length }}</span>
    </div>

    <div class="panel-content">
      <div v-if="handles.length === 0" class="layer-empty">
        暂无服务图层，请先在
        <a href="/#/data-center/dataservice" target="_blank">数据服务管理</a>
        添加并启用服务
      </div>

      <template
        v-for="entry in renderEntries"
        :key="entry.kind === 'group' ? `group-${entry.category}` : `item-${entry.handle.id}`"
      >
        <!-- 组标题（grouped 模式） -->
        <button v-if="entry.kind === 'group'" type="button" class="group-header" @click="toggleGroup(entry.category)">
          <span class="group-swatch" :style="{ background: CATEGORY_COLORS[entry.category] ?? '#8db8ff' }" />
          <span class="group-title">{{ categoryLabel(entry.category) }}</span>
          <span class="group-count">{{ entry.count }}</span>
          <SvgIcon
            class="group-chevron"
            :icon="collapsedGroups[entry.category] ? 'mdi:chevron-down' : 'mdi:chevron-up'"
          />
        </button>

        <!-- 图层条目 -->
        <div
          v-else
          class="layer-item"
          :class="{
            'layer-item--dragging': dragIndex === entry.globalIndex,
            'layer-item--over': overIndex === entry.globalIndex && dragIndex !== entry.globalIndex
          }"
          @dragover="onDragOver(entry.globalIndex, $event)"
          @drop="onDrop(entry.globalIndex)"
        >
          <!-- 拖动手柄（六点，hover 显示） -->
          <button
            type="button"
            class="drag-handle"
            :class="{ 'drag-handle--disabled': !isSortable(entry.handle) }"
            :draggable="isSortable(entry.handle)"
            :title="isSortable(entry.handle) ? '拖动调整图层顺序' : '加载完成后可排序'"
            @dragstart="onDragStart(entry.globalIndex)"
            @dragend="onDragEnd"
          >
            <SvgIcon icon="mdi:drag" />
          </button>

          <!-- 眼睛：显隐切换 -->
          <button
            type="button"
            class="eye-btn"
            :class="{ 'eye-btn--off': !entry.handle.visible }"
            :title="entry.handle.visible ? '隐藏图层' : '显示图层'"
            @click="emit('toggle', entry.handle.id, !entry.handle.visible)"
          >
            <SvgIcon :icon="entry.handle.visible ? 'mdi:eye' : 'mdi:eye-off'" />
          </button>

          <!-- 图例色块 -->
          <span class="layer-swatch" :style="{ background: swatchColor(entry.handle) }" />

          <!-- 主体信息 -->
          <div class="layer-meta">
            <div class="layer-name-row">
              <!-- 加载状态不在列表里展示；失败原因降级为 hover 提示，保持列表整洁 -->
              <span
                class="layer-name"
                :class="{ 'layer-name--dim': !entry.handle.visible }"
                :title="entry.handle.error ?? entry.handle.name"
              >
                {{ entry.handle.name }}
              </span>
            </div>
            <span class="layer-sub">{{ categoryLabel(entry.handle.category) }} · {{ entry.handle.type }}</span>

            <!-- 图例明细 -->
            <div v-if="entry.handle.state === 'ready' && entry.handle.legend?.length" class="layer-legend-row">
              <span v-for="(item, i) in entry.handle.legend" :key="i" class="legend-item">
                <span class="legend-swatch" :style="{ background: item.color }" />
                <span v-if="item.label" class="legend-label">{{ item.label }}</span>
              </span>
            </div>
          </div>

          <!-- hover 操作区 -->
          <div class="layer-actions">
            <button
              type="button"
              class="act-btn"
              :class="{ 'act-btn--active': opacityOpenId === entry.handle.id }"
              title="透明度"
              @click="toggleOpacity(entry.handle.id)"
            >
              <SvgIcon icon="mdi:opacity" />
            </button>
            <button
              type="button"
              class="act-btn act-btn--danger"
              title="移除图层（不删除配置）"
              @click="emit('remove', entry.handle.id)"
            >
              <SvgIcon icon="mdi:close" />
            </button>
          </div>
        </div>
      </template>

      <!-- 展开的透明度滑杆 -->
      <div v-if="opacityOpenId !== null" class="opacity-expand">
        <span class="opacity-label">透明度</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="getOpacity(opacityOpenId)"
          class="opacity-range"
          @input="onOpacityInput(opacityOpenId, Number(($event.target as HTMLInputElement).value))"
        />
        <span class="opacity-value">{{ Math.round(getOpacity(opacityOpenId) * 100) }}%</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layer-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  flex-shrink: 0;
}

.header-icon {
  font-size: 20px;
  color: #62c4ff;
}

.header-title {
  flex: 1;
  font-size: 15px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
}

.layer-count {
  font-size: 11px;
  padding: 3px 9px;
  border-radius: 10px;
  background: rgba(141, 184, 255, 0.12);
  color: #8db8ff;
  font-weight: 600;
}

.panel-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 12px 14px;
  scrollbar-width: thin;
  scrollbar-color: rgba(141, 184, 255, 0.24) transparent;
}

.panel-content::-webkit-scrollbar {
  width: 6px;
}
.panel-content::-webkit-scrollbar-track {
  background: transparent;
}
.panel-content::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(141, 184, 255, 0.24);
}

.layer-empty {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.32);
  padding: 14px 16px;
  line-height: 1.7;
}
.layer-empty a {
  color: #62c4ff;
  text-decoration: none;
}
.layer-empty a:hover {
  text-decoration: underline;
}

/* ──── 分组标题（grouped 模式） ──── */
.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px 6px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.72);
  cursor: pointer;
  text-align: left;
  transition: color 0.15s;
}
.group-header:hover {
  color: rgba(255, 255, 255, 0.95);
}
.group-swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.2);
}
.group-title {
  flex: 1;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.group-count {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.5);
  font-weight: 600;
}
.group-chevron {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.35);
  transition: transform 0.15s;
}

/* ──── 图层卡片 ──── */
.layer-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: default;
  border: 1px solid transparent;
  transition:
    background 0.15s,
    border-color 0.15s;
}
.layer-item:hover {
  background: rgba(43, 107, 255, 0.07);
}
.layer-item--dragging {
  opacity: 0.4;
}
.layer-item--over {
  border-color: rgba(98, 196, 255, 0.5);
  background: rgba(98, 196, 255, 0.07);
}

/* 拖动手柄：hover 卡片时显现 */
.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 22px;
  margin-top: 0;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  cursor: grab;
  font-size: 18px;
  flex-shrink: 0;
  padding: 0;
  opacity: 0;
  transition:
    opacity 0.15s,
    color 0.15s;
}
.layer-item:hover .drag-handle {
  opacity: 1;
}
.drag-handle:hover {
  color: rgba(255, 255, 255, 0.85);
}
.drag-handle:active {
  cursor: grabbing;
}
.drag-handle--disabled {
  cursor: not-allowed;
}

/* 眼睛：显隐切换 */
.eye-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #62c4ff;
  cursor: pointer;
  font-size: 19px;
  flex-shrink: 0;
  padding: 0;
  transition:
    background 0.15s,
    color 0.15s;
}
.eye-btn:hover {
  background: rgba(98, 196, 255, 0.12);
}
.eye-btn--off {
  color: rgba(255, 255, 255, 0.32);
}
.eye-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* 图例主色块 */
.layer-swatch {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  flex-shrink: 0;
  margin-top: 4px;
  border: 1px solid rgba(255, 255, 255, 0.16);
}

.layer-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}

.layer-name-row {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}
.layer-name {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.layer-name--dim {
  color: rgba(255, 255, 255, 0.45);
}

.layer-sub {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.42);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 图例明细 */
.layer-legend-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 1px;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.legend-swatch {
  width: 13px;
  height: 13px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.18);
}
.legend-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.42);
}

/* hover 操作区 */
.layer-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;
}
.layer-item:hover .layer-actions {
  opacity: 1;
}

.act-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  transition:
    background 0.15s,
    color 0.15s;
}
.act-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
}
.act-btn--active {
  color: #62c4ff;
}
.act-btn--danger:hover {
  background: rgba(248, 113, 113, 0.16);
  color: #f87171;
}

/* 展开的透明度滑杆 */
.opacity-expand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 2px 12px 6px;
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(43, 107, 255, 0.08);
  border: 1px solid rgba(98, 196, 255, 0.16);
}
.opacity-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  flex-shrink: 0;
}
.opacity-range {
  flex: 1;
  height: 4px;
  accent-color: #62c4ff;
  cursor: pointer;
}
.opacity-value {
  font-size: 11px;
  font-weight: 600;
  color: #62c4ff;
  width: 34px;
  text-align: right;
  flex-shrink: 0;
}
</style>
