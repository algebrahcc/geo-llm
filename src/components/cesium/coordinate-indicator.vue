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
.coordinate-indicator {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 10px;
  border: 1px solid rgba(92, 184, 255, 0.32);
  border-radius: 4px;
  background: rgba(4, 19, 40, 0.84);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.28);
  color: rgba(214, 237, 255, 0.9);
  font-family: 'DIN', Consolas, monospace;
  font-size: 12px;
  line-height: 1;
  pointer-events: none;
  backdrop-filter: blur(6px);
}

.coordinate-indicator__divider {
  width: 1px;
  height: 12px;
  background: rgba(120, 190, 255, 0.28);
}
</style>
