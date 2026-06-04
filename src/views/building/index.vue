<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import BuildingSceneViewer from './modules/building-scene-viewer.vue';
import BuildingToolbar from './modules/building-toolbar.vue';
import BuildingTaskStagePanel from './modules/building-task-stage-panel.vue';
import BuildingInfoPanel from './modules/building-info-panel.vue';
import BuildingAiAssistantPanel from './modules/building-ai-assistant-panel.vue';
import BuildingRoamBar from './modules/building-roam-bar.vue';
import { useBuilding } from './modules/use-building';
import { useDraggable } from './modules/use-draggable';
import type { BuildingModelLoadState, BuildingRoamPoint } from './modules/types';
import type {
  BuildingStageToolKey,
  BuildingStageStatusInfo
} from './modules/types-stage';

defineOptions({
  name: 'BuildingPage'
});

interface ViewerExposed {
  initViewer: () => Promise<void>;
  loadModel: (source: any) => void;
  zoomToModel: () => void;
  resetView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  rotate: () => void;
  pitch: () => void;
  setActiveTool: (tool: any) => void;
  setLayerVisible: (key: any, visible: boolean) => void;
  flyToBuilding: () => void;
  focusFloor: (floorId: string) => void;
  showRooms: (rooms: any[], floors: any[], points: any[]) => void;
  addRoamPoints: (points: Array<{ id: string; title: string; longitude: number; latitude: number }>) => void;
}

const viewerRef = ref<ViewerExposed | null>(null);
const router = useRouter();

// ──── 面板状态 ────
const taskPanelVisible = ref(true);
const taskPanelCollapsed = ref(false);
const infoPanelVisible = ref(true);
const infoPanelCollapsed = ref(false);
const aiPanelVisible = ref(true);
const aiPanelCollapsed = ref(false);

// ──── 状态 ────
const status = ref<BuildingStageStatusInfo>({
  longitude: '--',
  latitude: '--',
  altitude: '--',
  cameraHeight: '--',
  activeTool: '浏览',
  sourceLabel: '--',
  loadStatus: '待命'
});
const modelLoadState = reactive<BuildingModelLoadState>({
  sourceKey: '',
  sourceLabel: '',
  loading: false,
  loaded: false,
  error: ''
});
const aiRunning = ref(false);
const primaryEntranceId = ref<string>('entrance-main');

// ──── 面板拖拽 ────
const taskDrag = useDraggable({ anchor: 'left', initialX: 72, initialY: 72 });
const infoDrag = useDraggable({ anchor: 'right', initialX: 18, initialY: 72 });
const aiDrag = useDraggable({ anchor: 'bottom', initialX: 420, initialY: 24 });

// ──── 业务数据 ────
const {
  buildingTask,
  buildingForceCards,
  buildingEnvironmentItems,
  buildingModelSources,
  buildingDetail,
  buildingBIMFloors,
  buildingEntrances,
  buildingRoamPoints,
  buildingFloors,
  buildingRooms,
  roomsOfActiveFloor,
  selectedSourceKey,
  activeSource
} = useBuilding();

// ──── 工具栏配置 ────
const leftTools: readonly { key: BuildingStageToolKey; label: string; icon: string }[] = [
  { key: 'task', label: '任务信息', icon: 'mdi:clipboard-text-outline' },
  { key: 'focus-building', label: '定位楼宇', icon: 'mdi:crosshairs-gps' }
];

// ──── 事件处理 ────
function handleLeftToolSelect(key: BuildingStageToolKey) {
  switch (key) {
    case 'task':
      taskPanelVisible.value = !taskPanelVisible.value;
      if (taskPanelVisible.value) taskPanelCollapsed.value = false;
      viewerRef.value?.setActiveTool('browse');
      return;
    case 'focus-building':
      viewerRef.value?.setActiveTool('focus-building');
      viewerRef.value?.flyToBuilding();
      return;
    default:
      return;
  }
}

function handleTaskToggle() { taskPanelCollapsed.value = !taskPanelCollapsed.value; taskPanelVisible.value = true; }
function handleInfoToggle() { infoPanelCollapsed.value = !infoPanelCollapsed.value; infoPanelVisible.value = true; }
function handleAiToggle() { aiPanelCollapsed.value = !aiPanelCollapsed.value; aiPanelVisible.value = true; }

function handleLoadStateChange(next: BuildingModelLoadState) { Object.assign(modelLoadState, next); }
function handleStatusChange(next: BuildingStageStatusInfo) { status.value = next; }

function handleSetPrimaryEntrance(id: string) { primaryEntranceId.value = id; }

function handleAiSend(message: string) {
  aiRunning.value = true;
  // 模拟 AI 响应
  setTimeout(() => { aiRunning.value = false; }, 3000);
}

function handleRoamPointSelect(point: BuildingRoamPoint) {
  // 飞到街景点位
  console.log('Selected roam point:', point.title, point.longitude, point.latitude);
}

function handleBackToMain() { void router.push({ name: 'screen' }); }

// 模型加载完成后添加街景点位
watch(() => modelLoadState.loaded, loaded => {
  if (loaded && viewerRef.value) {
    const points = buildingRoamPoints.value.map(p => ({
      id: p.id, title: p.title, longitude: p.longitude, latitude: p.latitude
    }));
    viewerRef.value.addRoamPoints(points);
  }
}, { once: true });
</script>

<template>
  <div class="building-page">
    <div class="building-stage">
      <!-- ═══ Cesium 场景查看器 ═══ -->
      <BuildingSceneViewer
        ref="viewerRef"
        :source="activeSource"
        :floors="buildingFloors"
        :rooms="buildingRooms"
        :points="buildingRoamPoints"
        @load-state-change="handleLoadStateChange"
        @status-change="handleStatusChange"
      />

      <!-- ═══ 左侧工具栏 ═══ -->
      <BuildingToolbar placement="left" :items="leftTools" @select="handleLeftToolSelect" />

      <!-- ═══ 右侧 AI 机器人按钮 ═══ -->
      <div class="ai-float-btn-wrap">
        <NTooltip placement="left">
          <template #trigger>
            <button
              type="button"
              class="ai-float-btn"
              :class="{ 'ai-float-btn--active': aiPanelVisible }"
              @click="aiPanelVisible = !aiPanelVisible; if (aiPanelVisible) aiPanelCollapsed = false"
            >
              <SvgIcon icon="mdi:robot-outline" class="ai-float-icon" />
            </button>
          </template>
          <span>{{ aiPanelVisible ? '关闭 AI 对话' : '打开 AI 对话' }}</span>
        </NTooltip>
      </div>

      <!-- ═══ 返回按钮 ═══ -->
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

      <!-- ═══ 左侧：任务面板（可拖拽） ═══ -->
      <Transition name="panel-slide">
        <div v-if="taskPanelVisible" class="side-panel left-panel" :style="taskDrag.style.value">
          <div class="panel-drag-handle" @mousedown="taskDrag.onDragStart">
            <span class="drag-dots">⋮⋮</span>
            <span>任务面板</span>
          </div>
          <BuildingTaskStagePanel
            :collapsed="taskPanelCollapsed"
            :task="buildingTask"
            :environments="buildingEnvironmentItems"
            @toggle-collapse="handleTaskToggle"
          />
        </div>
      </Transition>

      <!-- ═══ 右侧：建筑信息面板（可拖拽） ═══ -->
      <Transition name="panel-slide">
        <div v-if="infoPanelVisible" class="side-panel right-panel" :style="infoDrag.style.value">
          <div class="panel-drag-handle" @mousedown="infoDrag.onDragStart">
            <span class="drag-dots">⋮⋮</span>
            <span>建筑信息</span>
          </div>
          <BuildingInfoPanel
            :collapsed="infoPanelCollapsed"
            :detail="buildingDetail"
            :bim-floors="buildingBIMFloors"
            :entrances="buildingEntrances"
            :primary-entrance-id="primaryEntranceId"
            @toggle-collapse="handleInfoToggle"
            @set-primary-entrance="handleSetPrimaryEntrance"
          />
        </div>
      </Transition>

      <!-- ═══ 底部：AI 对话（可拖拽） ═══ -->
      <Transition name="panel-slide">
        <div v-if="aiPanelVisible" class="side-panel bottom-panel" :style="aiDrag.style.value">
          <div class="panel-drag-handle horizontal" @mousedown="aiDrag.onDragStart">
            <span class="drag-dots">⋯</span>
            <span>AI 对手</span>
          </div>
          <BuildingAiAssistantPanel
            :collapsed="aiPanelCollapsed"
            :running="aiRunning"
            @toggle-collapse="handleAiToggle"
            @send="handleAiSend"
          />
        </div>
      </Transition>

      <!-- ═══ 底部：街景漫游点 ═══ -->
      <BuildingRoamBar :points="buildingRoamPoints" @select-point="handleRoamPointSelect" />

    </div>
  </div>
</template>

<style scoped>
.building-page { height: 100%; background: rgb(11,18,32); }
.building-stage { position: relative; height: 100%; overflow: hidden; }

/* ─── 返回按钮 ─── */
.stage-actions-wrap {
  position: absolute; top: 18px; left: 16px; z-index: 23;
}
.stage-back-button {
  display: flex; height: 44px; width: 44px; align-items: center; justify-content: center;
  border: 1px solid rgba(255,255,255,0.12); border-radius: 14px;
  background: rgba(9,14,28,0.78); color: rgba(255,255,255,0.88);
  box-shadow: 0 10px 24px rgba(0,0,0,0.18); backdrop-filter: blur(14px);
  transition: all 0.18s ease;
}
.stage-back-button:hover {
  border-color: rgba(43,107,255,0.45); background: rgba(19,31,54,0.88);
}
.stage-back-button:active { transform: translateY(-1px); }
.stage-back-icon { font-size: 18px; }

/* ─── 右侧 AI 机器人按钮 ─── */
.ai-float-btn-wrap {
  position: absolute; right: 16px; top: 18px; z-index: 23;
}
.ai-float-btn {
  display: flex; height: 44px; width: 44px; align-items: center; justify-content: center;
  border: 1px solid rgba(255,255,255,0.12); border-radius: 14px;
  background: rgba(9,14,28,0.78); color: rgba(255,255,255,0.88);
  box-shadow: 0 10px 24px rgba(0,0,0,0.18); backdrop-filter: blur(14px);
  cursor: pointer; transition: all 0.18s ease;
}
.ai-float-btn:hover { border-color: rgba(43,107,255,0.45); background: rgba(19,31,54,0.88); }
.ai-float-btn--active { border-color: rgba(43,107,255,0.55); background: rgba(43,107,255,0.15); }
.ai-float-icon { font-size: 20px; }

/* ──── 可拖拽面板通用 ──── */
.side-panel {
  position: fixed;
  display: flex;
  flex-direction: column;
  z-index: 21;
  box-shadow: 0 18px 40px rgba(0,0,0,0.28);
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.1);
}
.left-panel {
  width: 340px;
  max-height: calc(100vh - 120px);
}
.right-panel {
  width: 310px;
  max-height: calc(100vh - 120px);
}
.bottom-panel {
  width: 420px;
  max-height: 360px;
}

/* ──── 拖拽手柄 ──── */
.panel-drag-handle {
  display: flex; align-items: center; justify-content: center;
  gap: 4px; height: 24px;
  background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
  color: rgba(255,255,255,0.28); font-size: 11px; font-weight: 500;
  cursor: grab; user-select: none; flex-shrink: 0; letter-spacing: 0.04em;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  transition: all 0.18s ease;
}
.panel-drag-handle:hover { color: rgba(255,255,255,0.55); background: linear-gradient(180deg, rgba(99,102,241,0.06), rgba(99,102,241,0.02)); }
.panel-drag-handle:active { cursor: grabbing; }
.drag-dots { font-size: 14px; line-height: 1; letter-spacing: 2px; }
.panel-drag-handle.horizontal .drag-dots { letter-spacing: 4px; }

/* ──── 过渡动画 ──── */
.panel-slide-enter-active { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.panel-slide-leave-active { transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1); }
.panel-slide-enter-from { opacity: 0; transform: scale(0.93) translateY(4px); }
.panel-slide-leave-to { opacity: 0; transform: scale(0.95) translateY(2px); }

/* ──── 浮动按钮升级 ──── */
.stage-back-button, .ai-float-btn {
  transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
.stage-back-button:hover, .ai-float-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 28px rgba(0,0,0,0.25);
}

/* ──── 面板内组件覆盖 ──── */
.left-panel :deep(.task-panel),
.right-panel :deep(.info-panel),
.bottom-panel :deep(.ai-panel) {
  width: 100% !important;
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}

@media (max-width: 900px) {
  .left-panel { width: 300px; }
  .right-panel { width: 280px; }
  .bottom-panel { width: 380px; }
}
</style>
