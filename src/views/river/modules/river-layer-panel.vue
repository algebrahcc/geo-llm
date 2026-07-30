<script setup lang="ts">
import type { VectorLayerItem } from './types';

/** 底图项（始终存在） */
export interface BasemapItem {
  key: 'basemap';
  label: string;
  visible: boolean;
}

const props = defineProps<{
  collapsed: boolean;
  basemap: BasemapItem;
  vectorLayers: VectorLayerItem[];
  vectorLoading: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-basemap'): void;
  (e: 'toggle-vector', id: string): void;
  (e: 'toggle-collapse'): void;
  (e: 'close'): void;
}>();

const visibleCount = () => {
  let c = props.basemap.visible ? 1 : 0;
  c += props.vectorLayers.filter(l => l.visible).length;
  return c;
};
const totalCount = () => 1 + props.vectorLayers.length;

/** 给每个矢量图层分配一个颜色（循环取色） */
const VECTOR_COLORS = ['#ff6600', '#5ea4ff', '#2ee59d', '#ffcf5c', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];
function vectorColor(index: number) {
  return VECTOR_COLORS[index % VECTOR_COLORS.length];
}
</script>

<template>
  <div class="layer-panel" :class="{ 'layer-panel--collapsed': collapsed }">
    <!-- 标题栏 -->
    <div class="panel-header">
      <span class="header-icon">
        <SvgIcon icon="mdi:layers-outline" />
      </span>
      <span class="header-title">图层面板</span>
      <span class="layer-count">{{ visibleCount() }}/{{ totalCount() }} 可见</span>
      <div class="header-actions">
        <button type="button" class="action-btn" title="折叠" @click="emit('toggle-collapse')">
          <SvgIcon :icon="collapsed ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
        </button>
        <button type="button" class="action-btn" title="关闭" @click="emit('close')">
          <SvgIcon icon="mdi:close" />
        </button>
      </div>
    </div>

    <div v-show="!collapsed" class="panel-content">
      <!-- ====== Section 1：底图 ====== -->
      <div class="layer-section-title">底图</div>
      <label class="layer-item" :class="{ 'layer-item--active': basemap.visible }">
        <div class="layer-check">
          <input type="checkbox" :checked="basemap.visible" @change="emit('toggle-basemap')" />
          <span class="layer-color layer-color--basemap" />
        </div>
        <div class="layer-info">
          <span class="layer-name">{{ basemap.label }}</span>
          <span class="layer-desc">影像底图</span>
        </div>
      </label>

      <!-- ====== Section 2：矢量图层 ====== -->
      <div class="layer-section-title">
        矢量图层
        <span v-if="vectorLoading" class="loading-dot">加载中...</span>
      </div>

      <div v-if="vectorLayers.length === 0 && !vectorLoading" class="layer-empty">
        暂无矢量图层，请先在 <a href="/#/system/vector" target="_blank">矢量数据管理</a> 上传数据
      </div>

      <label
        v-for="(layer, idx) in vectorLayers"
        :key="layer.id"
        class="layer-item"
        :class="{ 'layer-item--active': layer.visible }"
      >
        <div class="layer-check">
          <input type="checkbox" :checked="layer.visible" @change="emit('toggle-vector', layer.id)" />
          <span class="layer-color" :style="{ background: vectorColor(idx) }" />
        </div>
        <div class="layer-info">
          <span class="layer-name">{{ layer.label }}</span>
          <span class="layer-desc">{{ layer.sourceType }} · {{ layer.featureCount }} 要素</span>
        </div>
      </label>
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
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.header-icon {
  font-size: 18px;
  color: #62c4ff;
}

.header-title {
  flex: 1;
  font-size: 14px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
}

.layer-count {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 8px;
  background: rgba(141, 184, 255, 0.1);
  color: #8db8ff;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  font-size: 16px;
  transition: background 0.18s, color 0.18s;
}

.action-btn:hover {
  background: rgba(43, 107, 255, 0.15);
  color: rgba(255, 255, 255, 0.85);
}

.panel-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 12px 10px;
  scrollbar-width: thin;
  scrollbar-color: rgba(141, 184, 255, 0.24) transparent;
}

.panel-content::-webkit-scrollbar { width: 5px; }
.panel-content::-webkit-scrollbar-track { background: transparent; }
.panel-content::-webkit-scrollbar-thumb { border-radius: 999px; background: rgba(141, 184, 255, 0.24); }

/* ──── Section 标题 ──── */
.layer-section-title {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.3);
  padding: 6px 12px 2px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.loading-dot {
  font-size: 10px;
  color: rgba(141, 184, 255, 0.6);
  text-transform: none;
  letter-spacing: 0;
}
.layer-empty {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.28);
  padding: 10px 12px;
  line-height: 1.6;
}
.layer-empty a {
  color: #62c4ff;
  text-decoration: none;
}
.layer-empty a:hover { text-decoration: underline; }

/* ──── 图层列表项 ──── */
.layer-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s;
}
.layer-item:hover { background: rgba(43, 107, 255, 0.06); }
.layer-item--active { background: rgba(255, 255, 255, 0.03); border-color: rgba(255, 255, 255, 0.06); }

.layer-check {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.layer-check input[type='checkbox'] {
  accent-color: #2b6bff;
  width: 14px;
  height: 14px;
  cursor: pointer;
}

.layer-color {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}
.layer-color--basemap { background: #22c55e; }

.layer-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.layer-name {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.82);
}
.layer-desc {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
