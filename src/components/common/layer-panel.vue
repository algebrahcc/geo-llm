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
  (e: 'remove', id: number): void;
  (e: 'reorder', fromIndex: number, toIndex: number): void;
  (e: 'fly', id: number): void;
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

/** 分类默认主色（图标着色 / 图例回退色） */
const CATEGORY_COLORS: Record<string, string> = {
  imagery: '#6aae8a',
  terrain: '#9b8ec4',
  threed: '#c98a5c',
  vector: '#4a7dbd',
  streetview: '#c47ba8',
  analysis: '#c9a45c'
};

/** 分类类型图标（替代名称前主色块，信息更直观） */
const CATEGORY_ICONS: Record<string, string> = {
  imagery: 'mdi:image-outline',
  terrain: 'mdi:terrain',
  threed: 'mdi:cube-outline',
  vector: 'mdi:vector-polygon',
  streetview: 'mdi:google-street-view',
  analysis: 'mdi:chart-box-outline'
};

const visibleCount = computed(() => props.handles.filter(h => h.visible).length);

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

function categoryIcon(category: string): string {
  return CATEGORY_ICONS[category] ?? 'mdi:layers-outline';
}

function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? '#8db0dd';
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
          <span class="group-icon" :style="{ color: categoryColor(entry.category) }">
            <SvgIcon :icon="categoryIcon(entry.category)" />
          </span>
          <span class="group-title">{{ categoryLabel(entry.category) }}</span>
          <span class="group-count">{{ entry.count }}</span>
          <SvgIcon
            class="group-chevron"
            :icon="collapsedGroups[entry.category] ? 'mdi:chevron-down' : 'mdi:chevron-up'"
          />
        </button>

        <!-- 图层条目（双击定位到数据范围） -->
        <div
          v-else
          class="layer-item"
          :class="{
            'layer-item--dragging': dragIndex === entry.globalIndex,
            'layer-item--over': overIndex === entry.globalIndex && dragIndex !== entry.globalIndex
          }"
          @dragover="onDragOver(entry.globalIndex, $event)"
          @drop="onDrop(entry.globalIndex)"
          @dblclick="entry.handle.state === 'ready' && emit('fly', entry.handle.id)"
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

          <!-- 主体信息 -->
          <div class="layer-meta">
            <div class="layer-name-row">
              <!-- 加载状态不在列表里展示；失败原因降级为 hover 提示，保持列表整洁 -->
              <span
                class="layer-name"
                :class="{ 'layer-name--dim': !entry.handle.visible }"
                :title="
                  entry.handle.error ??
                  (entry.handle.flyTo ? `${entry.handle.name}（双击定位到数据范围）` : entry.handle.name)
                "
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
              class="act-btn act-btn--danger"
              title="移除图层（不删除配置）"
              @click="emit('remove', entry.handle.id)"
            >
              <SvgIcon icon="mdi:close" />
            </button>
          </div>
        </div>
      </template>
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
  color: #8db0dd;
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
  background: rgba(74, 125, 189, 0.14);
  color: #8db0dd;
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
  color: #8db0dd;
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
.group-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  flex-shrink: 0;
  font-size: 15px;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(255, 255, 255, 0.07);
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
  background: rgba(93, 140, 200, 0.08);
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
  color: #8db0dd;
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

/* 分类类型图标（替代主色块） */

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
  color: rgba(255, 255, 255, 0.96);
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
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.035);
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
  color: #8db0dd;
}
.act-btn--danger:hover {
  background: rgba(194, 91, 91, 0.18);
  color: #c25b5b;
}
</style>
