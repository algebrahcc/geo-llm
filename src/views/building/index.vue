<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import BuildingGlobeViewer from './modules/building-globe-viewer.vue';
import BuildingLayerStagePanel from './modules/building-layer-stage-panel.vue';
import BuildingStatusBar from './modules/building-status-bar.vue';
import BuildingTaskStagePanel from './modules/building-task-stage-panel.vue';
import BuildingToolbar from './modules/building-toolbar.vue';
import { useBuilding } from './modules/use-building';
import type { BuildingTilesetLoadState } from './modules/types';
import type {
  BuildingInteractiveTool,
  BuildingLayerItem,
  BuildingStageLayerKey,
  BuildingStageStatusInfo,
  BuildingStageToolKey,
  BuildingToolbarItem
} from './modules/types-stage';

defineOptions({
  name: 'BuildingPage'
});

interface BuildingViewerExposed {
  setActiveTool: (tool: BuildingInteractiveTool) => void;
  setLayerVisible: (key: BuildingStageLayerKey, visible: boolean) => void;
  flyToBuilding: () => void;
  zoomToTileset: () => void;
  resetView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  rotate: () => void;
  pitch: () => void;
  captureView: () => string;
  focusFloor: (floorId: string) => void;
  focusRoom: (roomId: string) => void;
}

const viewerRef = ref<BuildingViewerExposed | null>(null);
const router = useRouter();
const activeLeftTool = ref<BuildingStageToolKey | null>(null);
const activeRightTool = ref<BuildingStageToolKey | null>(null);
const taskPanelVisible = ref(true);
const taskPanelCollapsed = ref(false);
const layerPanelVisible = ref(true);
const layerPanelCollapsed = ref(false);
const status = ref<BuildingStageStatusInfo>({
  longitude: '--',
  latitude: '--',
  altitude: '--',
  cameraHeight: '--',
  activeTool: '浏览',
  sourceLabel: '--',
  loadStatus: '待命'
});

const tilesetLoadState = reactive<BuildingTilesetLoadState>({
  sourceKey: '',
  sourceLabel: '',
  loading: false,
  loaded: false,
  error: ''
});

const leftTools: readonly BuildingToolbarItem[] = [
  { key: 'task', label: '任务总控', icon: 'mdi:shield-outline' },
  { key: 'focus-building', label: '定位楼宇', icon: 'mdi:crosshairs-gps' }
];

const rightTools: readonly BuildingToolbarItem[] = [
  { key: 'layers', label: '图层结构', icon: 'mdi:layers-triple-outline' },
  { key: 'reset', label: '重置视角', icon: 'mdi:target-variant' },
  { key: 'zoom-in', label: '放大', icon: 'mdi:magnify-plus-outline' },
  { key: 'zoom-out', label: '缩小', icon: 'mdi:magnify-minus-outline' }
];

const layerItems = ref<BuildingLayerItem[]>([
  { key: 'imagery', label: '全球底图', description: '显示离线影像底图。', visible: true },
  { key: 'tileset', label: '楼宇模型', description: '显示目标建筑的 3D Tiles 模型。', visible: true },
  { key: 'rooms', label: '房间标注', description: '显示楼层与房间风险标注。', visible: true },
  { key: 'route-points', label: '路线点位', description: '显示当前路线的关键点位。', visible: true }
]);

const {
  buildingTask,
  buildingForceCards,
  buildingEnvironmentItems,
  buildingTilesetSources,
  buildingFloors,
  buildingMaterials,
  selectedSourceKey,
  selectedFloorId,
  selectedRoomId,
  activeSource,
  activeRoom,
  activeRoutePoints,
  roomsOfActiveFloor,
  roomMaterials,
  selectSource,
  selectFloor,
  selectRoom
} = useBuilding();

const headlineCards = computed(() => [
  {
    label: '目标建筑',
    value: buildingTask.buildingName,
    meta: `楼层 ${buildingTask.floorCount} / 风险 ${buildingTask.riskCount}`,
    accent: 'building'
  },
  {
    label: '当前房间',
    value: activeRoom.value?.name || '未选中',
    meta: activeRoom.value?.useType || '等待点选房间',
    accent: 'room'
  },
  {
    label: '数据状态',
    value: status.value.sourceLabel === '--' ? '等待加载' : status.value.sourceLabel,
    meta: `模型 ${status.value.loadStatus}`,
    accent: 'source'
  }
]);

function handleLeftToolSelect(key: BuildingStageToolKey) {
  switch (key) {
    case 'task':
      taskPanelVisible.value = !taskPanelVisible.value;
      if (taskPanelVisible.value) {
        taskPanelCollapsed.value = false;
        activeLeftTool.value = key;
      } else {
        activeLeftTool.value = null;
      }
      viewerRef.value?.setActiveTool('browse');
      return;
    case 'focus-building':
      viewerRef.value?.setActiveTool('focus-building');
      viewerRef.value?.flyToBuilding();
      activeLeftTool.value = key;
      return;
    default:
      return;
  }
}

function handleRightToolSelect(key: BuildingStageToolKey) {
  switch (key) {
    case 'layers':
      layerPanelVisible.value = !layerPanelVisible.value;
      if (layerPanelVisible.value) {
        layerPanelCollapsed.value = false;
        activeRightTool.value = key;
      } else {
        activeRightTool.value = null;
      }
      return;
    case 'reset':
      viewerRef.value?.setActiveTool('browse');
      viewerRef.value?.resetView();
      activeLeftTool.value = null;
      activeRightTool.value = key;
      return;
    case 'zoom-in':
      viewerRef.value?.zoomIn();
      activeRightTool.value = key;
      return;
    case 'zoom-out':
      viewerRef.value?.zoomOut();
      activeRightTool.value = key;
      return;
    default:
      return;
  }
}

function handleTaskPanelCollapse() {
  taskPanelCollapsed.value = !taskPanelCollapsed.value;
  taskPanelVisible.value = true;
  activeLeftTool.value = 'task';
}

function handleLayerPanelCollapse() {
  layerPanelCollapsed.value = !layerPanelCollapsed.value;
  layerPanelVisible.value = true;
  activeRightTool.value = 'layers';
}

function handleLayerChange(payload: { key: BuildingStageLayerKey; visible: boolean }) {
  const layer = layerItems.value.find(item => item.key === payload.key);

  if (layer) {
    layer.visible = payload.visible;
    viewerRef.value?.setLayerVisible(payload.key, payload.visible);
  }
}

function handleLoadStateChange(nextState: BuildingTilesetLoadState) {
  Object.assign(tilesetLoadState, nextState);
}

function handleStatusChange(nextStatus: BuildingStageStatusInfo) {
  status.value = nextStatus;
}

function handleSelectSource(key: string) {
  selectSource(key);
}

function handleSelectFloor(floorId: string) {
  selectFloor(floorId);
  viewerRef.value?.focusFloor(floorId);
}

function handleSelectRoom(roomId: string) {
  selectRoom(roomId);
  viewerRef.value?.setActiveTool('pick-room');
  viewerRef.value?.focusRoom(roomId);
}

function handleRoomPicked(roomId: string) {
  selectRoom(roomId);
}

function handleBackToMain() {
  void router.push({ name: 'screen' });
}
</script>

<template>
  <div class="building-page">
    <div class="building-stage">
      <BuildingGlobeViewer
        ref="viewerRef"
        :source="activeSource"
        :floors="buildingFloors"
        :rooms="roomsOfActiveFloor"
        :points="activeRoutePoints"
        @room-picked="handleRoomPicked"
        @load-state-change="handleLoadStateChange"
        @status-change="handleStatusChange"
      />

      <BuildingToolbar
        placement="left"
        :items="leftTools"
        :active-key="activeLeftTool"
        @select="handleLeftToolSelect"
      />
      <BuildingToolbar
        placement="right"
        :items="rightTools"
        :active-key="activeRightTool"
        @select="handleRightToolSelect"
      />

      <div class="stage-actions-wrap">
        <NTooltip placement="right">
          <template #trigger>
            <button type="button" class="stage-back-button" @click="handleBackToMain">
              <SvgIcon icon="mdi:arrow-left" class="stage-back-icon" />
            </button>
          </template>
          <span>返回主页</span>
        </NTooltip>
      </div>

      <div v-if="taskPanelVisible" class="task-panel-wrap">
        <BuildingTaskStagePanel
          :collapsed="taskPanelCollapsed"
          :task="buildingTask"
          :forces="buildingForceCards"
          :environments="buildingEnvironmentItems"
          @toggle-collapse="handleTaskPanelCollapse"
        />
      </div>

      <div v-if="layerPanelVisible" class="layer-panel-wrap">
        <BuildingLayerStagePanel
          :collapsed="layerPanelCollapsed"
          :layers="layerItems"
          :sources="buildingTilesetSources"
          :active-source-key="selectedSourceKey"
          :active-source="activeSource"
          :load-state="tilesetLoadState"
          :floors="buildingFloors"
          :active-floor-id="selectedFloorId"
          :rooms="roomsOfActiveFloor"
          :active-room-id="selectedRoomId"
          :active-room="activeRoom"
          @toggle-collapse="handleLayerPanelCollapse"
          @change-layer="handleLayerChange"
          @select-source="handleSelectSource"
          @select-floor="handleSelectFloor"
          @select-room="handleSelectRoom"
          @zoom-to-tileset="viewerRef?.zoomToTileset()"
        />
      </div>

      <div class="hero-strip">
        <div v-for="card in headlineCards" :key="card.label" class="hero-card" :class="[`hero-card--${card.accent}`]">
          <div class="hero-label">{{ card.label }}</div>
          <div class="hero-value">{{ card.value }}</div>
          <div class="hero-meta">{{ card.meta }}</div>
        </div>
      </div>

      <div class="quick-stats">
        <div class="quick-stat">
          <span class="quick-stat__label">房间材料</span>
          <span class="quick-stat__value">{{ roomMaterials.length }}</span>
        </div>
        <div class="quick-stat">
          <span class="quick-stat__label">总材料</span>
          <span class="quick-stat__value">{{ buildingMaterials.length }}</span>
        </div>
      </div>

      <div class="status-bar-wrap">
        <BuildingStatusBar :status="status" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.building-page {
  height: 100%;
  background: rgb(11, 18, 32);
}

.building-stage {
  position: relative;
  height: 100%;
  overflow: hidden;
}

.task-panel-wrap {
  position: absolute;
  left: 72px;
  top: 110px;
  z-index: 20;
}

.layer-panel-wrap {
  position: absolute;
  right: 72px;
  top: 110px;
  z-index: 20;
}

.hero-strip {
  position: absolute;
  top: 18px;
  left: 50%;
  z-index: 15;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  width: min(510px, calc(100% - 420px));
  transform: translateX(-50%);
}

.hero-card {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 9px 11px;
  background: rgba(10, 16, 30, 0.78);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.14);
  backdrop-filter: blur(12px);
}

.hero-card--building {
  border-color: rgba(94, 164, 255, 0.2);
}

.hero-card--room {
  border-color: rgba(58, 211, 167, 0.18);
}

.hero-card--source {
  border-color: rgba(255, 198, 92, 0.18);
}

.hero-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.54);
}

.hero-value {
  margin-top: 2px;
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.94);
}

.hero-meta {
  margin-top: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.56);
}

.quick-stats {
  position: absolute;
  right: 72px;
  bottom: 84px;
  z-index: 18;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quick-stat {
  display: flex;
  min-width: 112px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  background: rgba(10, 16, 30, 0.76);
  backdrop-filter: blur(12px);
}

.quick-stat__label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.54);
}

.quick-stat__value {
  font-size: 16px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.94);
}

.status-bar-wrap {
  position: absolute;
  left: 50%;
  bottom: 16px;
  z-index: 20;
  transform: translateX(-50%);
}

.stage-actions-wrap {
  position: absolute;
  top: 18px;
  left: 16px;
  z-index: 23;
}

.stage-back-button {
  display: flex;
  height: 44px;
  width: 44px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  background: rgba(9, 14, 28, 0.78);
  color: rgba(255, 255, 255, 0.88);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(14px);
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    transform 0.18s ease;
}

.stage-back-button:hover {
  border-color: rgba(43, 107, 255, 0.45);
  background: rgba(19, 31, 54, 0.88);
}

.stage-back-button:active {
  transform: translateY(-1px);
}

.stage-back-icon {
  font-size: 18px;
}

@media (max-width: 1280px) {
  .hero-strip {
    width: min(460px, calc(100% - 360px));
  }

  .task-panel-wrap,
  .layer-panel-wrap {
    top: 102px;
  }
}

@media (max-width: 1100px) {
  .hero-strip {
    grid-template-columns: 1fr;
    width: min(220px, calc(100% - 340px));
  }

  .quick-stats {
    right: 20px;
  }
}
</style>
