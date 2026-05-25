<script setup lang="ts">
import type { BuildingStageToolKey, BuildingToolbarItem } from './types-stage';

defineOptions({
  name: 'BuildingToolbar'
});

interface Props {
  items: readonly BuildingToolbarItem[];
  activeKey?: BuildingStageToolKey | null;
  placement: 'left' | 'right';
}

defineProps<Props>();

const emit = defineEmits<{
  select: [key: BuildingStageToolKey];
}>();
</script>

<template>
  <div class="building-toolbar" :class="[`building-toolbar--${placement}`]">
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
.building-toolbar {
  position: absolute;
  top: 92px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.building-toolbar--left {
  left: 16px;
}

.building-toolbar--right {
  right: 16px;
}

.toolbar-button {
  display: flex;
  height: 44px;
  width: 44px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 0;
  background: rgba(9, 14, 28, 0.78);
  color: rgba(255, 255, 255, 0.88);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(14px);
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
  font-size: 18px;
}
</style>
