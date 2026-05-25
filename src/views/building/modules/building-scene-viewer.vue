<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useBuildingTileset } from './use-building-tileset';
import type {
  BuildingFloor,
  BuildingRoamPoint,
  BuildingRoom,
  BuildingTilesetLoadState,
  BuildingTilesetSource
} from './types';

defineOptions({
  name: 'BuildingSceneViewer'
});

interface Props {
  source: BuildingTilesetSource | null;
  floors: BuildingFloor[];
  rooms: BuildingRoom[];
  points: BuildingRoamPoint[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  roomPicked: [roomId: string];
  loadStateChange: [state: BuildingTilesetLoadState];
}>();

const { containerRef, loadState, initViewer, loadTileset, zoomToTileset, captureView, showRooms } = useBuildingTileset({
  onRoomPicked(roomId) {
    emit('roomPicked', roomId);
  }
});

const statusText = computed(() => {
  if (loadState.loading) return '正在加载真实 3D Tiles 模型...';
  if (loadState.error) return loadState.error;
  if (loadState.loaded) return `已加载：${loadState.sourceLabel}`;

  return '请选择可用的数据源以加载 3D Tiles。';
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
  value => {
    emit('loadStateChange', value);
  },
  { deep: true, immediate: true }
);

onMounted(async () => {
  await initViewer();

  if (props.source) {
    await loadTileset(props.source);
  }

  showRooms(props.rooms, props.floors, props.points);
});

defineExpose({
  zoomToTileset,
  captureView
});
</script>

<template>
  <div class="viewer-shell">
    <div ref="containerRef" class="viewer-container"></div>

    <div class="viewer-overlay">
      <div class="overlay-badge" :class="{ 'overlay-badge--error': !!loadState.error }">
        <SvgIcon :icon="loadState.loaded ? 'mdi:cube-scan' : 'mdi:cube-outline'" />
        <span>{{ statusText }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.viewer-shell {
  position: relative;
  height: 100%;
  min-height: 520px;
  overflow: hidden;
  border-radius: 16px;
  background: #050810;
}

.viewer-container {
  height: 100%;
  width: 100%;
}

.viewer-overlay {
  position: absolute;
  left: 16px;
  top: 16px;
  z-index: 10;
}

.overlay-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: min(560px, calc(100vw - 64px));
  border: 1px solid rgba(43, 107, 255, 0.28);
  border-radius: 999px;
  background: rgba(11, 18, 32, 0.88);
  padding: 8px 12px;
  color: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
}

.overlay-badge--error {
  border-color: rgba(251, 113, 133, 0.35);
  color: #fecdd3;
}

.viewer-shell :deep(.cesium-widget-credits),
.viewer-shell :deep(.cesium-viewer-bottom),
.viewer-shell :deep(.cesium-credit-logoContainer) {
  display: none !important;
}
</style>
