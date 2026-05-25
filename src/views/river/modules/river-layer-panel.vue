<script setup lang="ts">
import type { RiverLayerItem, RiverLayerKey } from './types';

defineOptions({
  name: 'RiverLayerPanel'
});

defineProps<{
  collapsed: boolean;
  layers: RiverLayerItem[];
}>();

const emit = defineEmits<{
  change: [payload: { key: RiverLayerKey; visible: boolean }];
  toggleCollapse: [];
}>();
</script>

<template>
  <NCard
    :bordered="false"
    size="small"
    class="layer-panel"
    :class="[{ 'layer-panel--collapsed': collapsed }]"
    :content-style="{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }"
  >
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
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(14px);
}

.layer-panel :deep(.n-card__content) {
  scrollbar-width: thin;
  scrollbar-color: rgba(141, 184, 255, 0.38) rgba(255, 255, 255, 0.05);
}

.layer-panel :deep(.n-card__content::-webkit-scrollbar) {
  width: 8px;
}

.layer-panel :deep(.n-card__content::-webkit-scrollbar-thumb) {
  border: 2px solid transparent;
  border-radius: 999px;
  background: rgba(141, 184, 255, 0.38);
  background-clip: padding-box;
}

.layer-panel :deep(.n-card__content::-webkit-scrollbar-track) {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
}

.panel-title-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
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
  gap: 10px;
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

.layer-name {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
}

.layer-desc {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.58);
}

.layer-panel--collapsed {
  width: 220px;
}
</style>
