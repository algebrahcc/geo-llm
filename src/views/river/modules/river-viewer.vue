<script setup lang="ts">
import { onMounted } from 'vue';
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
  showPlan,
  is2dMode,
  toggleViewMode
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
  showPlan,
  is2dMode,
  toggleViewMode
});
</script>

<template>
  <div class="cesium-viewer-shell">
    <div ref="containerRef" class="cesium-viewer-container" />
  </div>
</template>
