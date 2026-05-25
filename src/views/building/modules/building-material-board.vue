<script setup lang="ts">
import type { BuildingMaterial } from './types';

defineOptions({
  name: 'BuildingMaterialBoard'
});

interface Props {
  materials: BuildingMaterial[];
}

defineProps<Props>();
</script>

<template>
  <div class="material-board">
    <div v-for="item in materials" :key="item.id" class="material-item">
      <div class="material-main">
        <div class="material-title">{{ item.title }}</div>
        <div class="material-summary">{{ item.summary }}</div>
        <div class="material-time">{{ item.createdAt }}</div>
      </div>
      <NImage
        v-if="item.imageUrl"
        :src="item.imageUrl"
        object-fit="cover"
        width="140"
        height="88"
        preview-disabled
        class="material-image"
      />
    </div>
  </div>
</template>

<style scoped>
.material-board {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.material-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 14px;
  padding: 14px;
}

.material-title {
  font-size: 14px;
  font-weight: 600;
}

.material-summary,
.material-time {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--n-text-color-3);
}

.material-image {
  overflow: hidden;
  border-radius: 10px;
}
</style>
