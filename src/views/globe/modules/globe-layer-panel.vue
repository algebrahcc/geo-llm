<script setup lang="ts">
import type { GlobeLayerItem, GlobeLayerKey } from './types';

defineOptions({
  name: 'GlobeLayerPanel'
});

interface Props {
  layers: GlobeLayerItem[];
  collapsed: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  change: [payload: { key: GlobeLayerKey; visible: boolean }];
  toggleCollapse: [];
}>();
</script>

<template>
  <NCard :bordered="false" size="small" class="layer-panel" :class="[{ 'layer-panel--collapsed': collapsed }]">
    <template #header>
      <div class="panel-title-wrap">
        <div class="title-group">
          <SvgIcon icon="mdi:layers-outline" class="panel-icon" />
          <span>图层控制</span>
        </div>
        <NButton quaternary circle size="small" @click="emit('toggleCollapse')">
          <template #icon>
            <SvgIcon :icon="collapsed ? 'mdi:chevron-left' : 'mdi:chevron-right'" />
          </template>
        </NButton>
      </div>
    </template>

    <div v-if="!collapsed" class="layer-list">
      <div v-for="layer in layers" :key="layer.key" class="layer-item">
        <div class="layer-meta">
          <div class="layer-name">{{ layer.label }}</div>
          <div class="layer-desc">{{ layer.description }}</div>
        </div>
        <NSwitch
          :value="layer.visible"
          size="small"
          @update:value="emit('change', { key: layer.key, visible: $event })"
        />
      </div>
    </div>
  </NCard>
</template>

<style scoped>
.layer-panel {
  width: 280px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(15, 23, 42, 0.78);
  backdrop-filter: blur(12px);
}

.panel-title-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: rgba(255, 255, 255, 0.92);
}

.title-group {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.92);
}

.panel-icon {
  font-size: 16px;
  color: #2b6bff;
}

.layer-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.layer-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
}

.layer-meta {
  min-width: 0;
}

.layer-name {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
}

.layer-desc {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.58);
}

.layer-panel--collapsed {
  width: 220px;
}
</style>
