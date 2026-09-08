<script setup lang="ts">
import { onMounted } from 'vue';
import { useCesiumRiver } from './use-cesium-river';
import type { RejectedRouteData, RiverInteractiveTool, RiverLayerKey, RiverPlanKey, RiverStatusInfo } from './types';

defineOptions({
  name: 'RiverViewer'
});

const emit = defineEmits<{
  ready: [];
  statusChange: [status: RiverStatusInfo];
}>();

const {
  containerRef,
  cursorCoordinates,
  initViewer,
  initMapOverlays,
  setGlobeSurfaceTranslucent,
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
  showRejectedRoutes,
  clearRejectedEntities,
  focusRejectedRoute,
  drawAiMark,
  drawAiLine,
  drawAiPolygon,
  drawAiText,
  removeAiOverlay,
  clearAiOverlays,
  is2dMode,
  toggleViewMode,
  loadVectorLayer,
  flyToVector,
  setVectorLayerVisible,
  removeVectorLayer,
  serviceHandles,
  loadService,
  removeService,
  toggleService,
  setServiceOpacity,
  switchImagery,
  reorderService
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
  setGlobeSurfaceTranslucent: (enabled: boolean) => setGlobeSurfaceTranslucent(enabled),
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
  showRejectedRoutes: (routes: RejectedRouteData[]) => showRejectedRoutes(routes),
  clearRejectedEntities: () => clearRejectedEntities(),
  focusRejectedRoute: (id: string) => focusRejectedRoute(id),
  /** 智能体标绘层：点/线/面/文字 + 单删/全清 */
  drawAiMark: (item: { id?: string; lon: number; lat: number; name?: string; color?: string }) => drawAiMark(item),
  drawAiLine: (item: { id?: string; name?: string; color?: string; positions: Array<[number, number]> }) =>
    drawAiLine(item),
  drawAiPolygon: (item: { id?: string; name?: string; color?: string; positions: Array<[number, number]> }) =>
    drawAiPolygon(item),
  drawAiText: (item: { id?: string; lon: number; lat: number; text: string; name?: string; color?: string }) =>
    drawAiText(item),
  removeAiOverlay: (id: string) => removeAiOverlay(id),
  clearAiOverlays: () => clearAiOverlays(),
  is2dMode,
  toggleViewMode,
  /** 加载矢量图层（通过 mvt-imagery-provider 渲染后端 MVT 瓦片，后续只切换 show） */
  loadVectorLayer: (vectorId: string, vectorName: string, sourceType?: string) =>
    loadVectorLayer(vectorId, vectorName, sourceType),
  flyToVector: (vectorId: string, vectorName?: string) => flyToVector(vectorId, vectorName),
  setVectorLayerVisible: (vectorId: string, show: boolean) => setVectorLayerVisible(vectorId, show),
  removeVectorLayer: (vectorId: string) => removeVectorLayer(vectorId),
  /** 数据服务（阶段二）：激活服务图层句柄 + 管理方法 */
  serviceHandles,
  loadService,
  removeService,
  toggleService,
  setServiceOpacity,
  switchImagery,
  reorderService
});
</script>

<template>
  <div class="river-viewer-shell">
    <div ref="containerRef" class="river-viewer-container" />
    <div class="coordinate-indicator" aria-live="polite">
      <span>经度 {{ cursorCoordinates.longitude }}</span>
      <span class="coordinate-indicator__divider" />
      <span>纬度 {{ cursorCoordinates.latitude }}</span>
      <span class="coordinate-indicator__divider" />
      <span>高程 {{ cursorCoordinates.altitude }}</span>
      <span class="coordinate-indicator__divider" />
      <span>视高 {{ cursorCoordinates.cameraHeight }}</span>
    </div>
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
.river-viewer-shell :deep(.cesium-widget-credits),
.river-viewer-shell :deep(.cesium-viewer-bottom),
.river-viewer-shell :deep(.cesium-credit-logoContainer) {
  display: none !important;
}
</style>
