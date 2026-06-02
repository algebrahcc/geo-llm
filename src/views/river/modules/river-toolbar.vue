<script setup lang="ts">
import type { RiverToolKey, RiverToolbarItem } from './types';

defineOptions({
  name: 'RiverToolbar'
});

interface Props {
  items: readonly RiverToolbarItem[];
  activeKey?: RiverToolKey | null;
  placement: 'left' | 'right';
}

defineProps<Props>();

const emit = defineEmits<{
  select: [key: RiverToolKey];
}>();
</script>

<template>
  <div class="river-toolbar" :class="[`river-toolbar--${placement}`]">
    <NTooltip v-for="item in items" :key="item.key" placement="right">
      <template #trigger>
        <button
          type="button"
          class="toolbar-button"
          :class="[{ 'toolbar-button--active': activeKey === item.key }]"
          @click="emit('select', item.key)"
        >
          <SvgIcon :icon="item.icon" class="toolbar-icon" />
        </button>
      </template>
      <span>{{ item.label }}</span>
    </NTooltip>
  </div>
</template>

<style scoped>
.river-toolbar {
  position: absolute;
  top: 18px;
  z-index: 22;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.river-toolbar--left {
  left: 18px;
}

.river-toolbar--right {
  right: 18px;
}

.toolbar-button {
  display: flex; height: 42px; width: 42px;
  align-items: center; justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(12, 18, 30, 0.9);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.toolbar-button:hover {
  border-color: rgba(94, 164, 255, 0.3);
  background: rgba(20, 30, 50, 0.95);
}
.toolbar-button--active {
  border-color: rgba(94, 164, 255, 0.5);
  background: rgba(59, 130, 246, 0.1);
}

.toolbar-icon {
  font-size: 18px;
}
</style>
