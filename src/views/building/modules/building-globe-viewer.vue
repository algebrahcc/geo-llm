<script setup lang="ts">
import { onMounted, watch } from 'vue';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useBuildingTileset } from './use-building-tileset';
import type {
  BuildingFloor,
  BuildingRoamPoint,
  BuildingRoom,
  BuildingTilesetLoadState,
  BuildingTilesetSource
} from './types';
import type { BuildingInteractiveTool, BuildingStageLayerKey, BuildingStageStatusInfo } from './types-stage';

defineOptions({
  name: 'BuildingGlobeViewer'
});

interface Props {
  source: BuildingTilesetSource | null;
  floors: BuildingFloor[];
  rooms: BuildingRoom[];
  points: BuildingRoamPoint[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  ready: [];
  roomPicked: [roomId: string];
  loadStateChange: [state: BuildingTilesetLoadState];
  statusChange: [status: BuildingStageStatusInfo];
}>();

const {
  containerRef,
  loadState,
  initViewer,
  loadTileset,
  zoomToTileset,
  captureView,
  flyToBuilding,
  resetView,
  zoomIn,
  zoomOut,
  rotate,
  pitch,
  setActiveTool,
  setLayerVisible,
  focusFloor,
  focusRoom,
  showRooms
} = useBuildingTileset({
  onRoomPicked(roomId) {
    emit('roomPicked', roomId);
  },
  onStatusChange(nextStatus) {
    emit('statusChange', nextStatus);
  }
});

watch(
  () => props.source,
  async source => {
    if (!source) return;

    await loadTileset(source);
    showRooms(props.rooms, props.floors, props.points);
  },
  { immediate: false }
);

watch(
  () => [props.rooms, props.floors, props.points],
  () => {
    showRooms(props.rooms, props.floors, props.points);
  },
  { deep: true }
);

watch(
  () => ({ ...loadState }),
  nextState => {
    emit('loadStateChange', nextState);
  },
  { deep: true, immediate: true }
);

onMounted(async () => {
  await initViewer();

  if (props.source) {
    await loadTileset(props.source);
    flyToBuilding();
  }

  showRooms(props.rooms, props.floors, props.points);
  emit('ready');
});

defineExpose({
  setActiveTool: (tool: BuildingInteractiveTool) => setActiveTool(tool),
  setLayerVisible: (key: BuildingStageLayerKey, visible: boolean) => setLayerVisible(key, visible),
  flyToBuilding,
  zoomToTileset,
  resetView,
  zoomIn,
  zoomOut,
  rotate,
  pitch,
  captureView,
  focusFloor,
  focusRoom
});
</script>

<template>
  <div ref="containerRef" class="building-globe-viewer"></div>
</template>

<style scoped>
.building-globe-viewer {
  height: 100%;
  width: 100%;
  background: #050810;
}

.building-globe-viewer :deep(.cesium-widget-credits),
.building-globe-viewer :deep(.cesium-viewer-bottom),
.building-globe-viewer :deep(.cesium-credit-logoContainer) {
  display: none !important;
}
</style>
