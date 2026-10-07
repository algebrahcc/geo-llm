<script setup lang="ts">
/**
 * 城市街景（典型场景）
 *
 * 页面本身只做装配：街景是一屏地图 +（右下角）全景浮窗的形态，
 * 面板、控制与球面逻辑都在 `modules/streetview-viewer.vue` 里，
 * 与渡河 / 规划场景的 `index.vue + modules/xxx-viewer.vue` 结构保持一致。
 */
import StreetviewViewer from './modules/streetview-viewer.vue';

defineOptions({
  name: 'StreetviewPage'
});
</script>

<template>
  <div class="sv-page">
    <StreetviewViewer />
  </div>
</template>

<style scoped>
.sv-page {
  position: relative;
  height: 100%;
  width: 100%;
  overflow: hidden;
}
</style>
