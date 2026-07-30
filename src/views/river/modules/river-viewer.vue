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
  toggleViewMode,
  loadVectorLayer,
  setVectorLayerVisible,
  removeVectorLayer
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
  toggleViewMode,
  /** 加载矢量图层（首次加载时请求 GeoJSON，后续只切换 show） */
  loadVectorLayer: (vectorId: string, vectorName: string) => loadVectorLayer(vectorId, vectorName),
  setVectorLayerVisible: (vectorId: string, show: boolean) => setVectorLayerVisible(vectorId, show),
  removeVectorLayer: (vectorId: string) => removeVectorLayer(vectorId)
});
</script>

<template>
  <div class="river-viewer-shell">
    <div ref="containerRef" class="river-viewer-container" />
  </div>
</template>

<style scoped>
.river-viewer-shell {
  position: relative;
  height: 100%;
  min-height: 520px;
  overflow: hidden;
  border-radius: 0;
  background: #050810;
}
.river-viewer-container {
  height: 100%;
  width: 100%;
}
.river-viewer-shell :deep(.cesium-widget-credits),
.river-viewer-shell :deep(.cesium-viewer-bottom),
.river-viewer-shell :deep(.cesium-credit-logoContainer) {
  display: none !important;
}
</style>
