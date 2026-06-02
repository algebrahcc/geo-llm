<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  planningConstraintOptions,
  planningPreferenceOptions,
  planningRightTools,
  planningRouteOptions
} from '@/mock/planning';
import PlanningAnalysisProgress from './modules/planning-analysis-progress.vue';
import PlanningLayerPanel from './modules/planning-layer-panel.vue';
import PlanningMissionPanel from './modules/planning-mission-panel.vue';
import PlanningMissionResult from './modules/planning-mission-result.vue';
import PlanningResultPanel from './modules/planning-result-panel.vue';
import PlanningTaskPanel from './modules/planning-task-panel.vue';
import PlanningToolbar from './modules/planning-toolbar.vue';
import PlanningViewer from './modules/planning-viewer.vue';
import { usePlanning } from './modules/use-planning';
import type {
  PlanningInteractiveTool,
  PlanningLayerKey,
  PlanningMissionForm,
  PlanningPageMode,
  PlanningPickedPoint,
  PlanningPlanKey,
  PlanningRouteKey,
  PlanningTaskForm,
  PlanningToolKey,
  PlanningWaypoint
} from './modules/types';

defineOptions({
  name: 'PlanningPage'
});

interface PlanningViewerExposed {
  setActiveTool: (tool: PlanningInteractiveTool) => void;
  setLayerVisible: (key: PlanningLayerKey, visible: boolean) => void;
  showRoute: (routeKey: PlanningRouteKey) => void;
  showWaypoints: (waypoints: PlanningWaypoint[]) => void;
  setStartPoint: (longitude: number | null, latitude: number | null, name?: string) => void;
  setEndPoint: (longitude: number | null, latitude: number | null, name?: string) => void;
  resetView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  exportScreenshot: () => void;
}

const viewerRef = ref<PlanningViewerExposed | null>(null);
const router = useRouter();

// ──── 页面模式 ────
const pageMode = ref<PlanningPageMode>('route');

// ──── 面板可见与折叠 ────
const leftPanelVisible = ref(true);
const rightPanelVisible = ref(false);
const activeRightTool = ref<PlanningToolKey | null>(null);
const leftPanelCollapsed = ref(false);
const rightPanelCollapsed = ref(false);
const missionResultCollapsed = ref(false);
const analysisCollapsed = ref(false);

// ──── 拖拽 ────
interface DragState {
  panel: 'left' | 'right' | null;
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
  startRight: number;
  startTopR: number;
}

const leftPos = ref({ x: 72, y: 72 });
const rightPos = ref({ x: 0, y: 72 });

const drag = ref<DragState>({
  panel: null,
  startX: 0,
  startY: 0,
  startLeft: 0,
  startTop: 0,
  startRight: 0,
  startTopR: 0
});

const leftPanelStyle = computed(() => ({
  left: `${leftPos.value.x}px`,
  top: `${leftPos.value.y}px`
}));

const rightPanelStyle = computed(() => ({
  right: `${rightPos.value.x}px`,
  top: `${rightPos.value.y}px`
}));

function onMouseDown(e: MouseEvent, panel: 'left' | 'right') {
  e.preventDefault();
  drag.value = {
    panel,
    startX: e.clientX,
    startY: e.clientY,
    startLeft: leftPos.value.x,
    startTop: leftPos.value.y,
    startRight: rightPos.value.x,
    startTopR: rightPos.value.y
  };
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function onMouseMove(e: MouseEvent) {
  const dx = e.clientX - drag.value.startX;
  const dy = e.clientY - drag.value.startY;
  if (drag.value.panel === 'left') {
    leftPos.value = {
      x: Math.max(72, drag.value.startLeft + dx),
      y: Math.max(0, drag.value.startTop + dy)
    };
  } else if (drag.value.panel === 'right') {
    rightPos.value = {
      x: Math.max(0, drag.value.startRight - dx),
      y: Math.max(0, drag.value.startTopR + dy)
    };
  }
}

function onMouseUp() {
  drag.value.panel = null;
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
});

// ──── 业务逻辑 ────
const {
  // 模式
  pageMode: _pageMode,
  // 路线规划
  taskForm,
  currentRoute,
  currentSummary,
  updateForm,
  setCurrentRoute,
  startPlanning,
  clearTask,
  // 机动方案
  missionForm,
  selectedPlan,
  missionResultSummary,
  planResults,
  missionRunning,
  analysisSteps,
  analysisProgress,
  analysisStatusText,
  updateMissionForm,
  addWaypoint: addWaypointToForm,
  removeWaypoint: removeWaypointFromForm,
  reorderWaypoints: reorderWaypointsInForm,
  selectPlan,
  startMissionPlanning,
  resetMission,
  // 通用
  layerItems,
  planningState,
  setPickedPoint,
  setLayerVisible,
  setPlanningState
} = usePlanning();

const running = computed(() => planningState.value === 'analyzing');

// ──── 任务按钮切换 ────
function handleTaskToggle() {
  leftPanelVisible.value = !leftPanelVisible.value;
  if (leftPanelVisible.value) {
    leftPanelCollapsed.value = false;
  }
}

// ──── 左侧面板折叠 ────
function handleLeftPanelCollapse() {
  leftPanelCollapsed.value = !leftPanelCollapsed.value;
  leftPanelVisible.value = true;
}

// ──── 右侧面板折叠 ────
function handleRightPanelCollapse() {
  rightPanelCollapsed.value = !rightPanelCollapsed.value;
  rightPanelVisible.value = true;
}

function handleMissionResultCollapse() {
  missionResultCollapsed.value = !missionResultCollapsed.value;
}

function handleAnalysisCollapse() {
  analysisCollapsed.value = !analysisCollapsed.value;
}

// ──── 路线规划模式 ────
async function handlePlan() {
  if (running.value) return;
  if (taskForm.value.startLongitude == null || taskForm.value.endLongitude == null) {
    window.$message?.warning('请先设置起点和终点');
    return;
  }
  leftPanelVisible.value = true;
  leftPanelCollapsed.value = false;
  setPlanningState('analyzing');
  viewerRef.value?.setActiveTool('browse');
  try {
    await startPlanning();
    viewerRef.value?.showRoute(currentRoute.value);
    rightPanelVisible.value = true;
    activeRightTool.value = 'result';
    window.$message?.success('机动路线已生成');
  } catch {
    setPlanningState('idle');
    window.$message?.error('路线规划失败');
  }
}

// ──── 机动方案模式 ────
async function handleMissionPlan() {
  if (missionRunning.value) return;
  if (missionForm.value.startLongitude == null || missionForm.value.endLongitude == null) {
    window.$message?.warning('请先设置起点和终点');
    return;
  }
  rightPanelVisible.value = true;
  try {
    await startMissionPlanning();
    viewerRef.value?.showWaypoints(missionForm.value.waypoints);
    viewerRef.value?.setStartPoint(missionForm.value.startLongitude, missionForm.value.startLatitude, missionForm.value.startName);
    viewerRef.value?.setEndPoint(missionForm.value.endLongitude, missionForm.value.endLatitude, missionForm.value.endName);
    window.$message?.success('智能规划完成，已生成3条推荐方案');
  } catch {
    window.$message?.error('方案规划失败');
  }
}

function handleMissionPlanUpdate(form: PlanningMissionForm) {
  updateMissionForm(form);
  viewerRef.value?.showWaypoints(form.waypoints);
}

function handleAddWaypoint() {
  addWaypointToForm('新途经点');
  setTimeout(() => {
    viewerRef.value?.showWaypoints(missionForm.value.waypoints);
  }, 0);
}

function handleRemoveWaypoint(id: string) {
  removeWaypointFromForm(id);
  setTimeout(() => {
    viewerRef.value?.showWaypoints(missionForm.value.waypoints);
  }, 0);
}

function handleReorderWaypoints(from: number, to: number) {
  reorderWaypointsInForm(from, to);
  setTimeout(() => {
    viewerRef.value?.showWaypoints(missionForm.value.waypoints);
  }, 0);
}

// ──── 右侧工具栏 ────
function handleRightToolSelect(key: PlanningToolKey) {
  switch (key) {
    case 'layers':
      rightPanelVisible.value = !rightPanelVisible.value;
      if (rightPanelVisible.value) rightPanelCollapsed.value = false;
      activeRightTool.value = rightPanelVisible.value ? key : null;
      return;
    case 'result':
      rightPanelVisible.value = !rightPanelVisible.value;
      if (rightPanelVisible.value) rightPanelCollapsed.value = false;
      activeRightTool.value = rightPanelVisible.value ? key : null;
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

function handleViewerReady() {
  viewerRef.value?.showRoute(currentRoute.value);
  viewerRef.value?.showWaypoints(missionForm.value.waypoints);
  viewerRef.value?.setStartPoint(taskForm.value.startLongitude, taskForm.value.startLatitude, taskForm.value.startName);
  viewerRef.value?.setEndPoint(taskForm.value.endLongitude, taskForm.value.endLatitude, taskForm.value.endName);
}

function handleBackToMain() {
  void router.push({ name: 'screen' });
}

function handleViewDetail(_planKey: PlanningPlanKey) {
  window.$message?.info('方案详情功能开发中');
}

function handleSetAsExecute(planKey: PlanningPlanKey) {
  selectPlan(planKey);
  window.$message?.success('已设为执行方案');
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
}
</script>

<template>
  <div class="planning-page">
    <div class="planning-stage">
      <PlanningViewer
        ref="viewerRef"
        @ready="handleViewerReady"
        @point-picked="handlePointPicked"
      />

      <!-- ══════ 左侧：返回按钮 + 任务按钮 ══════ -->
      <div class="left-buttons">
        <NTooltip placement="right">
          <template #trigger>
            <button type="button" class="side-btn back-btn" @click="handleBackToMain">
              <SvgIcon icon="mdi:arrow-left" />
            </button>
          </template>
          <span>返回主页</span>
        </NTooltip>

        <NTooltip placement="right">
          <template #trigger>
            <button
              type="button"
              class="side-btn task-btn"
              :class="{ 'side-btn--active': leftPanelVisible }"
              @click="handleTaskToggle"
            >
              <SvgIcon icon="mdi:file-document-edit-outline" />
            </button>
          </template>
          <span>任务</span>
        </NTooltip>
      </div>

      <!-- ══════ 左侧面板（可拖拽） ══════ -->
      <Transition name="panel-slide-left">
        <div v-if="leftPanelVisible" class="side-panel left-panel" :style="leftPanelStyle">
          <!-- 拖拽手柄 -->
          <div class="panel-drag-handle" @mousedown="onMouseDown($event, 'left')">
            <span class="drag-dots">⋮⋮</span>
            <span>面板</span>
          </div>

          <!-- Tab 切换 -->
          <div class="panel-tabs">
            <button
              type="button"
              class="panel-tab"
              :class="{ 'panel-tab--active': pageMode === 'route' }"
              @click="pageMode = 'route'"
            >
              <SvgIcon icon="mdi:routes" class="tab-icon" />
              路线规划
            </button>
            <button
              type="button"
              class="panel-tab"
              :class="{ 'panel-tab--active': pageMode === 'mission' }"
              @click="pageMode = 'mission'"
            >
              <SvgIcon icon="mdi:map-marker-radius-outline" class="tab-icon" />
              机动方案
            </button>
          </div>

          <!-- 面板内容 -->
          <div class="panel-body">
            <!-- 路线规划面板 -->
            <PlanningTaskPanel
              v-if="pageMode === 'route'"
              :collapsed="leftPanelCollapsed"
              :form="taskForm"
              :running="running"
              :pick-mode-label="planningState === 'picking-start' ? '选取起点' : planningState === 'picking-end' ? '选取终点' : planningState === 'done' ? '已生成' : '待规划'"
              :preference-options="planningPreferenceOptions"
              :constraint-options="planningConstraintOptions"
              @plan="handlePlan"
              @pick-start="setPlanningState('picking-start'); viewerRef?.setActiveTool('pick-start')"
              @pick-end="setPlanningState('picking-end'); viewerRef?.setActiveTool('pick-end')"
              @toggle-collapse="handleLeftPanelCollapse"
              @update-form="updateForm"
            />

            <!-- 机动方案面板 -->
            <PlanningMissionPanel
              v-if="pageMode === 'mission'"
              :form="missionForm"
              :running="missionRunning"
              :collapsed="leftPanelCollapsed"
              @plan="handleMissionPlan"
              @update-form="handleMissionPlanUpdate"
              @add-waypoint="handleAddWaypoint"
              @remove-waypoint="handleRemoveWaypoint"
              @reorder-waypoints="handleReorderWaypoints"
              @toggle-collapse="handleLeftPanelCollapse"
            />
          </div>
        </div>
      </Transition>

      <!-- ══════ 右侧：工具栏 + 面板 ══════ -->
      <div class="right-side">
        <Transition name="panel-slide-right">
          <div v-if="rightPanelVisible" class="side-panel right-panel" :style="rightPanelStyle">
            <!-- 拖拽手柄 -->
            <div class="panel-drag-handle" @mousedown="onMouseDown($event, 'right')">
              <span class="drag-dots">⋮⋮</span>
              <span>面板</span>
            </div>

            <!-- 图层面板 -->
            <PlanningLayerPanel
              v-if="activeRightTool === 'layers'"
              :collapsed="rightPanelCollapsed"
              :layers="layerItems"
              @change="handleLayerChange"
              @toggle-collapse="handleRightPanelCollapse"
            />

            <!-- 路线规划结果 -->
            <PlanningResultPanel
              v-if="pageMode === 'route' && activeRightTool === 'result'"
              :collapsed="rightPanelCollapsed"
              :current-route="currentRoute"
              :routes="planningRouteOptions"
              :summary="currentSummary"
              :running="running"
              @select-route="handleRouteSelect"
              @export-shot="handleRightToolSelect('shot')"
              @toggle-collapse="handleRightPanelCollapse"
            />

            <!-- 机动方案结果 -->
            <template v-if="pageMode === 'mission'">
              <div class="right-panel-section">
                <PlanningMissionResult
                  :collapsed="missionResultCollapsed"
                  :plans="planResults"
                  :selected-plan="selectedPlan"
                  :summary="missionResultSummary"
                  :running="missionRunning"
                  @select-plan="selectPlan"
                  @view-detail="handleViewDetail"
                  @set-as-execute="handleSetAsExecute"
                  @toggle-collapse="handleMissionResultCollapse"
                />
              </div>
            </template>
          </div>
        </Transition>

        <PlanningToolbar
          placement="right"
          :items="planningRightTools"
          :active-key="activeRightTool"
          @select="handleRightToolSelect"
        />
      </div>

      <!-- 左下角：智能分析进度面板 -->
      <div class="analysis-progress-wrap">
        <PlanningAnalysisProgress
          :collapsed="analysisCollapsed"
          :steps="analysisSteps"
          :progress="analysisProgress"
          :status-text="analysisStatusText"
          :running="missionRunning || running"
          @toggle-collapse="handleAnalysisCollapse"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.planning-page {
  height: 100%;
  background: rgb(11, 18, 32);
  position: relative;
}

.planning-stage {
  position: relative;
  height: 100%;
  overflow: hidden;
}

/* ──── 左侧按钮组 ──── */
.left-buttons {
  position: absolute;
  top: 18px;
  left: 18px;
  z-index: 25;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.side-btn {
  display: flex;
  height: 44px;
  width: 44px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.74);
  color: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  cursor: pointer;
  font-size: 18px;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease;
}

.side-btn:hover {
  border-color: rgba(43, 107, 255, 0.48);
  background: rgba(19, 31, 54, 0.88);
}

.side-btn--active {
  border-color: rgba(43, 107, 255, 0.78);
  background: rgba(43, 107, 255, 0.18);
}

/* ──── 右侧工具栏容器 ──── */
.right-side {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 20;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.right-side :deep(.planning-toolbar) {
  order: 2;
}

/* ──── 侧面板 ──── */
.side-panel {
  position: fixed;
  width: 380px;
  max-height: calc(100vh - 36px);
  display: flex;
  flex-direction: column;
  background: rgba(15, 23, 42, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  backdrop-filter: blur(14px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  z-index: 21;
}

.left-panel {
  order: 0;
}

.right-panel {
  order: 1;
}

/* ──── 拖拽手柄 ──── */
.panel-drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 20px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.36);
  background: rgba(255, 255, 255, 0.03);
  cursor: move;
  user-select: none;
  flex-shrink: 0;
  letter-spacing: 0.04em;
}

.panel-drag-handle:hover {
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.06);
}

.drag-dots {
  font-size: 14px;
  line-height: 1;
  letter-spacing: 2px;
}

/* ──── Tab 栏 ──── */
.panel-tabs {
  display: flex;
  gap: 0;
  padding: 0;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.panel-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.42);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  position: relative;
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}

.panel-tab::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 20%;
  right: 20%;
  height: 2px;
  background: transparent;
  border-radius: 1px;
  transition: background-color 0.18s ease;
}

.panel-tab:hover {
  color: rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.03);
}

.panel-tab--active {
  color: #8db8ff;
  background: rgba(43, 107, 255, 0.08);
}

.panel-tab--active::after {
  background: #2b6bff;
  left: 10%;
  right: 10%;
}

.tab-icon {
  font-size: 14px;
}

/* ──── 面板内容 ──── */
.panel-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.right-panel-section {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

/* ──── 统一滚动条 ──── */
.panel-body :deep(.panel-content) {
  scrollbar-width: thin;
  scrollbar-color: rgba(141, 184, 255, 0.24) transparent;
}

.panel-body :deep(.panel-content::-webkit-scrollbar) {
  width: 5px;
}

.panel-body :deep(.panel-content::-webkit-scrollbar-track) {
  border-radius: 999px;
  background: transparent;
}

.panel-body :deep(.panel-content::-webkit-scrollbar-thumb) {
  border-radius: 999px;
  background: rgba(141, 184, 255, 0.24);
  transition: background 0.25s ease;
}

.panel-body :deep(.panel-content::-webkit-scrollbar-thumb:hover) {
  background: rgba(141, 184, 255, 0.48);
}

.panel-body :deep(.panel-content::-webkit-scrollbar-thumb:active) {
  background: rgba(141, 184, 255, 0.6);
}

.panel-body {
  scrollbar-width: thin;
  scrollbar-color: rgba(141, 184, 255, 0.24) transparent;
}

.panel-body::-webkit-scrollbar {
  width: 5px;
}

.panel-body::-webkit-scrollbar-track {
  border-radius: 999px;
  background: transparent;
}

.panel-body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(141, 184, 255, 0.24);
  transition: background 0.25s ease;
}

.panel-body::-webkit-scrollbar-thumb:hover {
  background: rgba(141, 184, 255, 0.48);
}

.panel-body::-webkit-scrollbar-thumb:active {
  background: rgba(141, 184, 255, 0.6);
}

/* ──── 面板内嵌组件覆盖 ──── */
.left-panel :deep(.task-panel),
.left-panel :deep(.mission-panel) {
  width: 100% !important;
  border: none !important;
  background: transparent !important;
  backdrop-filter: none !important;
  border-radius: 0 !important;
}

.left-panel :deep(.task-panel--collapsed),
.left-panel :deep(.mission-panel--collapsed) {
  width: 100% !important;
}

.right-panel :deep(.result-panel),
.right-panel :deep(.mission-result),
.right-panel :deep(.analysis-progress),
.right-panel :deep(.layer-panel) {
  width: 100% !important;
  border: none !important;
  background: transparent !important;
  backdrop-filter: none !important;
  border-radius: 0 !important;
}

.right-panel :deep(.result-panel--collapsed),
.right-panel :deep(.mission-result--collapsed),
.right-panel :deep(.analysis-progress--collapsed),
.right-panel :deep(.layer-panel--collapsed) {
  width: 100% !important;
}

/* ──── 动画 ──── */
.panel-slide-left-enter-active,
.panel-slide-left-leave-active {
  transition:
    transform 0.28s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.28s ease;
}

.panel-slide-left-enter-from {
  transform: translateX(-20px);
  opacity: 0;
}

.panel-slide-left-leave-to {
  transform: translateX(-20px);
  opacity: 0;
}

.panel-slide-right-enter-active,
.panel-slide-right-leave-active {
  transition:
    transform 0.28s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.28s ease;
}

.panel-slide-right-enter-from {
  transform: translateX(20px);
  opacity: 0;
}

.panel-slide-right-leave-to {
  transform: translateX(20px);
  opacity: 0;
}

/* ──── 智能分析进度面板 ──── */
.analysis-progress-wrap {
  position: absolute;
  left: 18px;
  bottom: 18px;
  z-index: 20;
  width: 680px;
  max-width: calc(100% - 36px);
}

@media (max-width: 1280px) {
  .side-panel {
    width: 340px;
  }

  .analysis-progress-wrap {
    width: 580px;
  }
}

@media (max-width: 768px) {
  .analysis-progress-wrap {
    width: calc(100% - 36px);
  }
}
</style>