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
  display: flex;
  height: 44px;
  width: 44px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.74);
  color: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    transform 0.18s ease;
}

.toolbar-button:hover {
  border-color: rgba(43, 107, 255, 0.48);
  background: rgba(19, 31, 54, 0.88);
}

.toolbar-button--active {
  border-color: rgba(43, 107, 255, 0.78);
  background: rgba(43, 107, 255, 0.18);
  transform: translateY(-1px);
}

.toolbar-icon {
  font-size: 18px;
}
</style>
