<script setup lang="ts">
import { onMounted } from 'vue';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import CoordinateIndicator from '@/components/cesium/coordinate-indicator.vue';
import { useCesiumPlanning } from './use-cesium-planning';
import type {
  PlanningInteractiveTool,
  PlanningLayerKey,
  PlanningPickedPoint,
  PlanningRouteKey,
  PlanningStatusInfo,
  PlanningWaypoint
} from './types';

defineOptions({
  name: 'PlanningViewer'
});

const emit = defineEmits<{
  ready: [];
  statusChange: [status: PlanningStatusInfo];
  pointPicked: [payload: PlanningPickedPoint];
}>();

const {
  containerRef,
  cursorCoordinates,
  initViewer,
  setGlobeSurfaceTranslucent,
  setActiveTool,
  setLayerVisible,
  showRoute,
  revealRoutes,
  setExcludedRoutes,
  showWaypoints,
  setStartPoint,
  setEndPoint,
  resetView,
  zoomIn,
  zoomOut,
  rotate,
  pitch,
  exportScreenshot,
  is2dMode,
  toggleViewMode,
  loadVectorLayer,
  setVectorLayerVisible,
  removeVectorLayer,
  serviceHandles,
  loadService,
  removeService,
  toggleService,
  setServiceOpacity,
  switchImagery,
  reorderService,
  flyToLocation,
  drawAiMark,
  drawAiLine,
  drawAiPolygon,
  drawAiText,
  removeAiOverlay,
  clearAiOverlays
} = useCesiumPlanning({
  onStatusChange(status) {
    emit('statusChange', status);
  },
  onPointPicked(payload) {
    emit('pointPicked', payload);
  }
});

onMounted(async () => {
  await initViewer();
  emit('ready');
});

defineExpose({
  setGlobeSurfaceTranslucent: (enabled: boolean) => setGlobeSurfaceTranslucent(enabled),
  setActiveTool: (tool: PlanningInteractiveTool) => setActiveTool(tool),
  setLayerVisible: (key: PlanningLayerKey, visible: boolean) => setLayerVisible(key, visible),
  showRoute: (routeKey: PlanningRouteKey) => showRoute(routeKey),
  revealRoutes: (routeKey: PlanningRouteKey) => revealRoutes(routeKey),
  /** 事件排除：隐藏被排除的候选路线 */
  setExcludedRoutes: (excluded: PlanningRouteKey[], active?: PlanningRouteKey) => setExcludedRoutes(excluded, active),
  showWaypoints: (waypoints: PlanningWaypoint[]) => showWaypoints(waypoints),
  setStartPoint: (longitude: number | null, latitude: number | null, name?: string) =>
    setStartPoint(longitude, latitude, name),
  setEndPoint: (longitude: number | null, latitude: number | null, name?: string) =>
    setEndPoint(longitude, latitude, name),
  resetView,
  zoomIn,
  zoomOut,
  rotate,
  pitch,
  exportScreenshot,
  is2dMode,
  toggleViewMode,
  /** 加载矢量图层（通过 mvt-imagery-provider 渲染后端 MVT 瓦片，后续只切换 show） */
  loadVectorLayer: (vectorId: string, vectorName: string, sourceType?: string) =>
    loadVectorLayer(vectorId, vectorName, sourceType),
  setVectorLayerVisible: (vectorId: string, show: boolean) => setVectorLayerVisible(vectorId, show),
  removeVectorLayer: (vectorId: string) => removeVectorLayer(vectorId),
  /** 数据服务：激活服务图层句柄 + 管理方法 */
  serviceHandles,
  loadService,
  removeService,
  toggleService,
  setServiceOpacity,
  switchImagery,
  reorderService,
  /** 视角定位（智能体标绘 flyTo 指令用） */
  flyToLocation,
  /** 智能体标绘层：点/线/面/文字 + 单删/全清 */
  drawAiMark: (item: { id?: string; lon: number; lat: number; name?: string; color?: string }) => drawAiMark(item),
  drawAiLine: (item: { id?: string; name?: string; color?: string; positions: Array<[number, number]> }) =>
    drawAiLine(item),
  drawAiPolygon: (item: { id?: string; name?: string; color?: string; positions: Array<[number, number]> }) =>
    drawAiPolygon(item),
  drawAiText: (item: { id?: string; lon: number; lat: number; text: string; name?: string; color?: string }) =>
    drawAiText(item),
  removeAiOverlay: (id: string) => removeAiOverlay(id),
  clearAiOverlays: () => clearAiOverlays()
});
</script>

<template>
  <div class="planning-viewer-shell">
    <div ref="containerRef" class="planning-viewer"></div>
    <CoordinateIndicator
      :longitude="cursorCoordinates.longitude"
      :latitude="cursorCoordinates.latitude"
      :altitude="cursorCoordinates.altitude"
      :camera-height="cursorCoordinates.cameraHeight"
    />
  </div>
</template>

<style scoped>
.planning-viewer-shell {
  position: relative;
  height: 100%;
  width: 100%;
}

.planning-viewer {
  height: 100%;
  width: 100%;
  background: #050810;
}

.planning-viewer :deep(.cesium-widget-credits),
.planning-viewer :deep(.cesium-viewer-bottom),
.planning-viewer :deep(.cesium-credit-logoContainer) {
  display: none !important;
}
</style>
