<script setup lang="ts">
import { onMounted, watch } from 'vue';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useBuildingModel } from './use-building-model';
import type {
  BuildingFloor,
  BuildingRoamPoint,
  BuildingRoom,
  BuildingModelLoadState,
  BuildingModelSource
} from './types';

defineOptions({
  name: 'BuildingSceneViewer'
});

interface Props {
  source: BuildingModelSource | null;
  floors: BuildingFloor[];
  rooms: BuildingRoom[];
  points: BuildingRoamPoint[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  roomPicked: [roomId: string];
  loadStateChange: [state: BuildingModelLoadState];
  statusChange: [status: any];
  ready: [];
}>();

const {
  containerRef,
  loadState,
  status,
  initViewer,
  loadModel,
  unloadModel,
  showRooms,
  addRoamPoints,
  clearRoamPoints,
  zoomToModel,
  exportScreenshot,
  flyToBuilding,
  resetView,
  zoomIn,
  zoomOut,
  rotate,
  pitch,
  setActiveTool,
  setLayerVisible,
  focusFloor,
  is2dMode,
  toggleViewMode
} = useBuildingModel({
  onRoomPicked(roomId) { emit('roomPicked', roomId); },
  onStatusChange(s) { emit('statusChange', s); }
});

// 监听数据源变化，自动加载模型
watch(
  () => props.source,
  async source => {
    if (!source) return;
    await loadModel(source);
    showRooms(props.rooms, props.floors, props.points);
    addRoamPoints(props.points);
  }
);

// 监听房间/楼层变化
watch(
  () => [props.rooms, props.floors, props.points],
  () => { showRooms(props.rooms, props.floors, props.points); },
  { deep: true }
);

// 状态变化上报
watch(
  () => ({ ...loadState }),
  value => { emit('loadStateChange', value); },
  { deep: true, immediate: true }
);

onMounted(async () => {
  await initViewer();
  emit('ready');

  if (props.source) {
    await loadModel(props.source);
    addRoamPoints(props.points);
  }

  showRooms(props.rooms, props.floors, props.points);
});

defineExpose({
  initViewer,
  loadModel,
  unloadModel,
  zoomToModel,
  flyToBuilding,
  resetView,
  zoomIn,
  zoomOut,
  rotate,
  pitch,
  setActiveTool,
  setLayerVisible,
  focusFloor,
  showRooms,
  addRoamPoints,
  clearRoamPoints,
  exportScreenshot,
  is2dMode,
  toggleViewMode
});
</script>

<template>
  <div class="viewer-shell">
    <div ref="containerRef" class="viewer-container"></div>
  </div>
</template>

<style scoped>
.viewer-shell {
  position: relative; height: 100%; min-height: 520px;
  overflow: hidden; border-radius: 0; background: #050810;
}
.viewer-container { height: 100%; width: 100%; }

.viewer-shell :deep(.cesium-widget-credits),
.viewer-shell :deep(.cesium-viewer-bottom),
.viewer-shell :deep(.cesium-credit-logoContainer) {
  display: none !important;
}
</style>
