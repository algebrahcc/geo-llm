<script setup lang="ts">
import { ref } from 'vue';

export interface LayerItem {
  key: string;
  label: string;
  description: string;
  visible: boolean;
}

const props = defineProps<{
  collapsed: boolean;
  layers: LayerItem[];
}>();

const emit = defineEmits<{
  (e: 'toggle-layer', key: string): void;
  (e: 'toggle-collapse'): void;
  (e: 'close'): void;
}>();

const visibleCount = () => props.layers.filter(l => l.visible).length;

function handleLayerToggle(key: string) {
  emit('toggle-layer', key);
}
</script>

<template>
  <div class="layer-panel" :class="{ 'layer-panel--collapsed': collapsed }">
    <!-- 标题栏 -->
    <div class="panel-header">
      <span class="header-icon">🗺️</span>
      <span class="header-title">图层面板</span>
      <span class="layer-count">{{ visibleCount() }}/{{ layers.length }} 可见</span>
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
      <div class="layer-list">
        <label
          v-for="layer in layers"
          :key="layer.key"
          class="layer-item"
          :class="{ 'layer-item--active': layer.visible }"
        >
          <div class="layer-check">
            <input
              type="checkbox"
              :checked="layer.visible"
              @change="handleLayerToggle(layer.key)"
            />
            <div class="layer-color" :class="`layer-color--${layer.key}`" />
          </div>
          <div class="layer-info">
            <span class="layer-name">{{ layer.label }}</span>
            <span class="layer-desc">{{ layer.description }}</span>
          </div>
        </label>
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
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.header-icon {
  font-size: 16px;
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

.panel-content::-webkit-scrollbar {
  width: 5px;
}

.panel-content::-webkit-scrollbar-track {
  background: transparent;
}

.panel-content::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(141, 184, 255, 0.24);
}

/* ──── 图层列表 ──── */
.layer-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.layer-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s;
}

.layer-item:hover {
  background: rgba(43, 107, 255, 0.06);
}

.layer-item--active {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.06);
}

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

.layer-color--imagery { background: #22c55e; }
.layer-color--channel { background: #3b82f6; }
.layer-color--assembly { background: #f59e0b; }
.layer-color--risk { background: #ef4444; }
.layer-color--mark { background: #a855f7; }
.layer-color--route { background: #ec4899; }

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
