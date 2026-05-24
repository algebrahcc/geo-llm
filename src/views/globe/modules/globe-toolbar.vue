<script setup lang="ts">
import type { GlobeToolKey, GlobeToolbarItem } from './types';

defineOptions({
  name: 'GlobeToolbar'
});

interface Props {
  items: readonly GlobeToolbarItem[];
  activeKey?: GlobeToolKey | null;
  placement: 'left' | 'right';
}

defineProps<Props>();

const emit = defineEmits<{
  select: [key: GlobeToolKey];
}>();
</script>

<template>
  <div class="globe-toolbar" :class="[`globe-toolbar--${placement}`]">
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      class="toolbar-button"
      :class="[{ 'toolbar-button--active': activeKey === item.key }]"
      @click="emit('select', item.key)"
    >
      <SvgIcon :icon="item.icon" class="toolbar-icon" />
      <span class="toolbar-label">{{ item.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.globe-toolbar {
  position: absolute;
  top: 16px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.globe-toolbar--left {
  left: 16px;
}

.globe-toolbar--right {
  right: 16px;
}

.toolbar-button {
  display: flex;
  min-width: 112px;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 10px 12px;
  background: rgba(15, 23, 42, 0.72);
  color: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(10px);
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    transform 0.18s ease;
}

.toolbar-button:hover {
  border-color: rgba(43, 107, 255, 0.45);
  background: rgba(19, 31, 54, 0.88);
}

.toolbar-button--active {
  border-color: rgba(43, 107, 255, 0.72);
  background: rgba(43, 107, 255, 0.18);
  transform: translateX(1px);
}

.toolbar-icon {
  font-size: 16px;
}

.toolbar-label {
  font-size: 13px;
  line-height: 1;
}
</style>
