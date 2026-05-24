<script setup lang="ts">
import { onMounted } from 'vue';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useCesiumGlobe } from './use-cesium-globe';
import type { GlobeInteractiveTool, GlobeLayerKey, GlobeStatusInfo } from './types';

defineOptions({
  name: 'GlobeViewer'
});

const emit = defineEmits<{
  ready: [];
  statusChange: [status: GlobeStatusInfo];
}>();

const {
  containerRef,
  initViewer,
  setActiveTool,
  setLayerVisible,
  flyToPreset,
  resetView,
  zoomIn,
  zoomOut,
  rotate,
  pitch,
  clearAnnotations,
  generateMark,
  startAnalysis,
  exportScreenshot
} = useCesiumGlobe({
  onStatusChange(status) {
    emit('statusChange', status);
  }
});

onMounted(async () => {
  await initViewer();
  emit('ready');
});

defineExpose({
  setActiveTool: (tool: GlobeInteractiveTool | 'browse') => setActiveTool(tool),
  setLayerVisible: (key: GlobeLayerKey, visible: boolean) => setLayerVisible(key, visible),
  flyToPreset,
  resetView,
  zoomIn,
  zoomOut,
  rotate,
  pitch,
  clearAnnotations,
  generateMark,
  startAnalysis,
  exportScreenshot
});
</script>

<template>
  <div ref="containerRef" class="globe-viewer"></div>
</template>

<style scoped>
.globe-viewer {
  height: 100%;
  width: 100%;
  background: #050810;
}

.globe-viewer :deep(.cesium-widget-credits),
.globe-viewer :deep(.cesium-viewer-bottom),
.globe-viewer :deep(.cesium-credit-logoContainer) {
  display: none !important;
}
</style>
