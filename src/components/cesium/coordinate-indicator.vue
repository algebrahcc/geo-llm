<script setup lang="ts">
/**
 * 地图右下角坐标浮窗（river / planning / globe 等 Cesium 场景共用）
 *
 * 抽取自各 viewer.vue 中重复的「经度/纬度/高程/视高」展示块与样式，
 * 数据源统一为 useCesiumBase 的 cursorCoordinates。
 */
interface Props {
  longitude: string;
  latitude: string;
  altitude: string;
  cameraHeight: string;
}

defineProps<Props>();

defineOptions({ name: 'CoordinateIndicator' });
</script>

<template>
  <div class="coordinate-indicator" aria-live="polite">
    <span>经度 {{ longitude }}</span>
    <span class="coordinate-indicator__divider" />
    <span>纬度 {{ latitude }}</span>
    <span class="coordinate-indicator__divider" />
    <span>高程 {{ altitude }}</span>
    <span class="coordinate-indicator__divider" />
    <span>视高 {{ cameraHeight }}</span>
  </div>
</template>

<style scoped>
/* 与渡河场景面板同一套外观：深蓝实底 + 细白边 + 白色分档文字（不用玻璃与发光） */
.coordinate-indicator {
  position: absolute;
  right: 14px;
  bottom: 14px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 11px;
  background: rgb(14 22 38 / 92%);
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 8px;
  box-shadow: 0 3px 12px rgb(0 0 0 / 35%);
  color: rgb(255 255 255 / 84%);
  font-family: ui-monospace, consolas, monospace;
  font-size: var(--font-xs);
  line-height: 1;
  pointer-events: none;
}

.coordinate-indicator__divider {
  width: 1px;
  height: 12px;
  background: rgb(255 255 255 / 14%);
}
</style>
