<script setup lang="ts">
import { onMounted } from 'vue';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useCesiumRiver } from './use-cesium-river';
import type { RiverInteractiveTool, RiverLayerKey, RiverPlanKey, RiverStatusInfo } from './types';

defineOptions({
  name: 'RiverViewer'
});

const emit = defineEmits<{
  ready: [];
  statusChange: [status: RiverStatusInfo];
}>();

const {
  containerRef,
  initViewer,
  initMapOverlays,
  setActiveTool,
  setLayerVisible,
  flyToPreset,
  flyToLocation,
  resetView,
  zoomIn,
  zoomOut,
  rotate,
  pitch,
  clearAnnotations,
  generateMark,
  startAnalysis,
  exportScreenshot,
  showPlan
} = useCesiumRiver({
  onStatusChange(status) {
    emit('statusChange', status);
  }
});

onMounted(async () => {
  await initViewer();
  emit('ready');
});

defineExpose({
  initMapOverlays,
  setActiveTool: (tool: RiverInteractiveTool | 'browse') => setActiveTool(tool),
  setLayerVisible: (key: RiverLayerKey, visible: boolean) => setLayerVisible(key, visible),
  flyToPreset,
  flyToLocation,
  resetView,
  zoomIn,
  zoomOut,
  rotate,
  pitch,
  clearAnnotations,
  generateMark,
  startAnalysis: (planKey: RiverPlanKey, onStep?: (index: number) => void) => startAnalysis(planKey, onStep),
  exportScreenshot,
  showPlan
});
</script>

<template>
  <div ref="containerRef" class="river-viewer"></div>
</template>

<style scoped>
.river-viewer {
  height: 100%;
  width: 100%;
  background: #050810;
}

.river-viewer :deep(.cesium-widget-credits),
.river-viewer :deep(.cesium-viewer-bottom),
.river-viewer :deep(.cesium-credit-logoContainer) {
  display: none !important;
}
</style>
