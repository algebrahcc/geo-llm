<script setup lang="ts">
import type { GlobeStatusInfo } from './types';

defineOptions({
  name: 'GlobeStatusBar'
});

defineProps<{
  status: GlobeStatusInfo;
}>();
</script>

<template>
  <div class="status-bar">
    <div class="status-item">
      <span class="status-label">经度</span>
      <span class="status-value">{{ status.longitude }}</span>
    </div>
    <div class="status-item">
      <span class="status-label">纬度</span>
      <span class="status-value">{{ status.latitude }}</span>
    </div>
    <div class="status-item">
      <span class="status-label">海拔</span>
      <span class="status-value">{{ status.altitude }}</span>
    </div>
    <div class="status-item">
      <span class="status-label">视高</span>
      <span class="status-value">{{ status.cameraHeight }}</span>
    </div>
    <div class="status-item">
      <span class="status-label">模式</span>
      <span class="status-value">{{ status.activeTool }}</span>
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 10px 12px;
  background: rgba(15, 23, 42, 0.72);
  backdrop-filter: blur(10px);
}

.status-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.status-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.status-value {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.92);
}
</style>
