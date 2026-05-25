<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  planningConstraintOptions,
  planningLeftTools,
  planningPreferenceOptions,
  planningRightTools,
  planningRouteOptions
} from '@/mock/planning';
import PlanningLayerPanel from './modules/planning-layer-panel.vue';
import PlanningResultPanel from './modules/planning-result-panel.vue';
import PlanningStatusBar from './modules/planning-status-bar.vue';
import PlanningTaskPanel from './modules/planning-task-panel.vue';
import PlanningToolbar from './modules/planning-toolbar.vue';
import PlanningViewer from './modules/planning-viewer.vue';
import { usePlanning } from './modules/use-planning';
import type {
  PlanningInteractiveTool,
  PlanningLayerKey,
  PlanningPickedPoint,
  PlanningRouteKey,
  PlanningStatusInfo,
  PlanningTaskForm,
  PlanningToolKey
} from './modules/types';

defineOptions({
  name: 'PlanningPage'
});

interface PlanningViewerExposed {
  setActiveTool: (tool: PlanningInteractiveTool) => void;
  setLayerVisible: (key: PlanningLayerKey, visible: boolean) => void;
  showRoute: (routeKey: PlanningRouteKey) => void;
  setStartPoint: (longitude: number | null, latitude: number | null, name?: string) => void;
  setEndPoint: (longitude: number | null, latitude: number | null, name?: string) => void;
  resetView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  exportScreenshot: () => void;
}

const viewerRef = ref<PlanningViewerExposed | null>(null);
const router = useRouter();
const activeLeftTool = ref<PlanningToolKey | null>('task');
const activeRightTool = ref<PlanningToolKey | null>('result');
const taskPanelVisible = ref(true);
const taskPanelCollapsed = ref(false);
const resultPanelVisible = ref(true);
const resultPanelCollapsed = ref(false);
const layerPanelVisible = ref(false);
const layerPanelCollapsed = ref(false);

const {
  taskForm,
  currentRoute,
  currentSummary,
  layerItems,
  planningState,
  status,
  updateForm,
  setPickedPoint,
  setLayerVisible,
  setCurrentRoute,
  setPlanningState,
  startPlanning,
  clearTask,
  updateStatus
} = usePlanning();

const running = computed(() => planningState.value === 'analyzing');
const pickModeLabel = computed(() => {
  if (planningState.value === 'picking-start') return '选取起点';
  if (planningState.value === 'picking-end') return '选取终点';
  if (planningState.value === 'done') return '已生成';
  return '待规划';
});
const heroMetrics = computed(() => [
  { label: '当前路线', value: currentSummary.value.label, desc: currentSummary.value.subtitle },
  { label: currentSummary.value.metrics[0].label, value: currentSummary.value.metrics[0].value, desc: '首选路线时效' },
  { label: currentSummary.value.metrics[2].label, value: currentSummary.value.metrics[2].value, desc: '空间风险判断' }
]);

function setInteractiveTool(tool: PlanningInteractiveTool, activeKey: PlanningToolKey | null) {
  viewerRef.value?.setActiveTool(tool);
  activeLeftTool.value = activeKey;
}

async function handlePlan() {
  if (running.value) return;

  if (taskForm.value.startLongitude == null || taskForm.value.endLongitude == null) {
    window.$message?.warning('请先设置起点和终点');
    return;
  }

  taskPanelVisible.value = true;
  taskPanelCollapsed.value = false;
  setPlanningState('analyzing');
  viewerRef.value?.setActiveTool('browse');

  try {
    await startPlanning();
    viewerRef.value?.showRoute(currentRoute.value);
    activeRightTool.value = resultPanelVisible.value ? 'result' : null;
    window.$message?.success('机动路线已生成');
  } catch {
    setPlanningState('idle');
    window.$message?.error('路线规划失败');
  }
}

function handleLeftToolSelect(key: PlanningToolKey) {
  switch (key) {
    case 'task':
      taskPanelVisible.value = !taskPanelVisible.value;

      if (taskPanelVisible.value) {
        taskPanelCollapsed.value = false;
      }

      setInteractiveTool('browse', taskPanelVisible.value ? key : null);
      return;
    case 'pick-start':
      setPlanningState('picking-start');
      setInteractiveTool('pick-start', key);
      window.$message?.info('请在球上点击选择起点');
      return;
    case 'pick-end':
      setPlanningState('picking-end');
      setInteractiveTool('pick-end', key);
      window.$message?.info('请在球上点击选择终点');
      return;
    case 'clear':
      clearTask();
      viewerRef.value?.setActiveTool('browse');
      viewerRef.value?.setStartPoint(
        taskForm.value.startLongitude,
        taskForm.value.startLatitude,
        taskForm.value.startName
      );
      viewerRef.value?.setEndPoint(taskForm.value.endLongitude, taskForm.value.endLatitude, taskForm.value.endName);
      viewerRef.value?.showRoute(currentRoute.value);
      viewerRef.value?.resetView();
      activeLeftTool.value = taskPanelVisible.value ? 'task' : null;
      return;
    default:
      return;
  }
}

function handleRightToolSelect(key: PlanningToolKey) {
  switch (key) {
    case 'layers':
      layerPanelVisible.value = !layerPanelVisible.value;

      if (layerPanelVisible.value) {
        layerPanelCollapsed.value = false;
      }

      activeRightTool.value = layerPanelVisible.value ? key : null;
      return;
    case 'result':
      resultPanelVisible.value = !resultPanelVisible.value;

      if (resultPanelVisible.value) {
        resultPanelCollapsed.value = false;
      }

      activeRightTool.value = resultPanelVisible.value ? key : null;
      return;
    case 'reset':
      viewerRef.value?.resetView();
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
    case 'shot':
      viewerRef.value?.exportScreenshot();
      activeRightTool.value = key;
      return;
    default:
      return;
  }
}

function handleLayerChange(payload: { key: PlanningLayerKey; visible: boolean }) {
  setLayerVisible(payload.key, payload.visible);
  viewerRef.value?.setLayerVisible(payload.key, payload.visible);
}

function handleRouteSelect(routeKey: PlanningRouteKey) {
  setCurrentRoute(routeKey);
  viewerRef.value?.showRoute(routeKey);
}

function handleTaskPanelCollapse() {
  taskPanelCollapsed.value = !taskPanelCollapsed.value;
  taskPanelVisible.value = true;
  activeLeftTool.value = 'task';
}

function handleResultPanelCollapse() {
  resultPanelCollapsed.value = !resultPanelCollapsed.value;
  resultPanelVisible.value = true;
  activeRightTool.value = 'result';
}

function handleLayerPanelCollapse() {
  layerPanelCollapsed.value = !layerPanelCollapsed.value;
  layerPanelVisible.value = true;
  activeRightTool.value = 'layers';
}

function handleTaskFormUpdate(nextForm: PlanningTaskForm) {
  updateForm(nextForm);
}

function handlePointPicked(payload: PlanningPickedPoint) {
  setPickedPoint(payload);

  if (payload.type === 'start') {
    viewerRef.value?.setStartPoint(payload.longitude, payload.latitude, '地图选定起点');
  } else {
    viewerRef.value?.setEndPoint(payload.longitude, payload.latitude, '地图选定终点');
  }

  viewerRef.value?.setActiveTool('browse');
  setPlanningState('idle');
  activeLeftTool.value = taskPanelVisible.value ? 'task' : null;
}

function handleStatusChange(nextStatus: PlanningStatusInfo) {
  updateStatus({
    ...nextStatus,
    currentRoute: currentSummary.value.label,
    planningState: status.value.planningState
  });
}

function handleViewerReady() {
  viewerRef.value?.showRoute(currentRoute.value);
  viewerRef.value?.setStartPoint(taskForm.value.startLongitude, taskForm.value.startLatitude, taskForm.value.startName);
  viewerRef.value?.setEndPoint(taskForm.value.endLongitude, taskForm.value.endLatitude, taskForm.value.endName);
}

function handleBackToMain() {
  void router.push({ name: 'screen' });
}
</script>

<template>
  <div class="planning-page">
    <div class="planning-stage">
      <PlanningViewer
        ref="viewerRef"
        @ready="handleViewerReady"
        @status-change="handleStatusChange"
        @point-picked="handlePointPicked"
      />

      <PlanningToolbar
        placement="left"
        :items="planningLeftTools"
        :active-key="activeLeftTool"
        @select="handleLeftToolSelect"
      />
      <PlanningToolbar
        placement="right"
        :items="planningRightTools"
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

      <div class="hero-strip">
        <div v-for="metric in heroMetrics" :key="metric.label" class="hero-card">
          <div class="hero-label">{{ metric.label }}</div>
          <div class="hero-value">{{ metric.value }}</div>
          <div class="hero-desc">{{ metric.desc }}</div>
        </div>
      </div>

      <div v-if="taskPanelVisible" class="task-panel-wrap">
        <PlanningTaskPanel
          :collapsed="taskPanelCollapsed"
          :form="taskForm"
          :running="running"
          :pick-mode-label="pickModeLabel"
          :preference-options="planningPreferenceOptions"
          :constraint-options="planningConstraintOptions"
          @plan="handlePlan"
          @pick-start="handleLeftToolSelect('pick-start')"
          @pick-end="handleLeftToolSelect('pick-end')"
          @toggle-collapse="handleTaskPanelCollapse"
          @update-form="handleTaskFormUpdate"
        />
      </div>

      <div v-if="resultPanelVisible" class="result-panel-wrap">
        <PlanningResultPanel
          :collapsed="resultPanelCollapsed"
          :current-route="currentRoute"
          :routes="planningRouteOptions"
          :summary="currentSummary"
          :running="running"
          @select-route="handleRouteSelect"
          @export-shot="handleRightToolSelect('shot')"
          @toggle-collapse="handleResultPanelCollapse"
        />
      </div>

      <div v-if="layerPanelVisible" class="layer-panel-wrap">
        <PlanningLayerPanel
          :collapsed="layerPanelCollapsed"
          :layers="layerItems"
          @change="handleLayerChange"
          @toggle-collapse="handleLayerPanelCollapse"
        />
      </div>

      <div class="status-bar-wrap">
        <PlanningStatusBar :status="status" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.planning-page {
  height: 100%;
  background: rgb(11, 18, 32);
}

.planning-stage {
  position: relative;
  height: 100%;
  overflow: hidden;
}

.task-panel-wrap {
  position: absolute;
  top: 18px;
  left: 78px;
  z-index: 20;
}

.result-panel-wrap {
  position: absolute;
  top: 18px;
  right: 78px;
  z-index: 20;
}

.layer-panel-wrap {
  position: absolute;
  top: 176px;
  right: 78px;
  z-index: 20;
}

.status-bar-wrap {
  position: absolute;
  left: 18px;
  bottom: 18px;
  z-index: 20;
}

.stage-actions-wrap {
  position: absolute;
  top: 18px;
  left: 18px;
  z-index: 23;
}

.stage-back-button {
  display: flex;
  height: 44px;
  width: 44px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.74);
  color: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    transform 0.18s ease;
}

.stage-back-button:hover {
  border-color: rgba(43, 107, 255, 0.48);
  background: rgba(19, 31, 54, 0.88);
}

.stage-back-button:active {
  transform: translateY(-1px);
}

.stage-back-icon {
  font-size: 18px;
}

.planning-stage :deep(.planning-toolbar--left) {
  top: 72px;
}

.hero-strip {
  position: absolute;
  top: 18px;
  left: 50%;
  z-index: 20;
  display: flex;
  gap: 12px;
  transform: translateX(-50%);
}

.hero-card {
  min-width: 164px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 10px 14px;
  background: rgba(9, 14, 28, 0.74);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(14px);
}

.hero-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.48);
}

.hero-value {
  margin-top: 4px;
  font-size: 18px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.96);
}

.hero-desc {
  margin-top: 2px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.56);
}

@media (max-width: 1280px) {
  .hero-strip {
    gap: 8px;
  }

  .hero-card {
    min-width: 144px;
    padding: 9px 12px;
  }
}
</style>
