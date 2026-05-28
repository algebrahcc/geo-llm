<script setup lang="ts">
import { onMounted } from 'vue';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useScreenGlobe } from './use-screen-globe';

defineOptions({
  name: 'ScreenGlobeViewer'
});

const { containerRef, initViewer, switchSceneMode } = useScreenGlobe();

onMounted(async () => {
  await initViewer();
});

defineExpose({
  switchSceneMode
});
</script>

<template>
  <div ref="containerRef" class="screen-globe-viewer"></div>
</template>

<style scoped>
.screen-globe-viewer {
  height: 100%;
  width: 100%;
  background: #04101c;
}

.screen-globe-viewer :deep(.cesium-widget-credits),
.screen-globe-viewer :deep(.cesium-viewer-bottom),
.screen-globe-viewer :deep(.cesium-credit-logoContainer) {
  display: none !important;
}
</style>
