<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  riverDefaultLayers,
  riverDefaultTaskForm,
  riverFlowTemplate,
  riverLeftTools,
  riverPlanOptions,
  riverPlanSummaries,
  riverRightTools,
  riverTaskTypeOptions
} from '@/mock/river';
import RiverFlowStrip from './modules/river-flow-strip.vue';
import RiverLayerPanel from './modules/river-layer-panel.vue';
import RiverResultPanel from './modules/river-result-panel.vue';
import RiverStatusBar from './modules/river-status-bar.vue';
import RiverTaskPanel from './modules/river-task-panel.vue';
import RiverToolbar from './modules/river-toolbar.vue';
import RiverViewer from './modules/river-viewer.vue';
import type {
  RiverFlowStep,
  RiverInteractiveTool,
  RiverLayerItem,
  RiverLayerKey,
  RiverPlanKey,
  RiverStatusInfo,
  RiverTaskForm,
  RiverToolKey
} from './modules/types';

defineOptions({
  name: 'RiverPage'
});

interface RiverViewerExposed {
  setActiveTool: (tool: RiverInteractiveTool | 'browse') => void;
  setLayerVisible: (key: RiverLayerKey, visible: boolean) => void;
  flyToPreset: () => void;
  flyToLocation: (longitude: number, latitude: number, height?: number) => void;
  resetView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  rotate: () => void;
  pitch: () => void;
  clearAnnotations: () => void;
  generateMark: () => void;
  startAnalysis: (planKey: RiverPlanKey, onStep?: (index: number) => void) => Promise<void>;
  exportScreenshot: () => void;
  showPlan: (planKey: RiverPlanKey) => void;
}

const viewerRef = ref<RiverViewerExposed | null>(null);
const router = useRouter();
const activeLeftTool = ref<RiverToolKey | null>('task');
const activeRightTool = ref<RiverToolKey | null>('layers');
const taskPanelVisible = ref(true);
const taskPanelCollapsed = ref(false);
const resultPanelCollapsed = ref(false);
const layerPanelVisible = ref(true);
const layerPanelCollapsed = ref(false);
const analysisRunning = ref(false);

const taskForm = ref<RiverTaskForm>({
  ...riverDefaultTaskForm
});

const currentPlan = ref<RiverPlanKey>('plan-a');
const layerItems = ref<RiverLayerItem[]>(riverDefaultLayers.map(item => ({ ...item })));
const flowSteps = ref<RiverFlowStep[]>(
  riverFlowTemplate.map(step => ({
    ...step,
    status: 'waiting'
  }))
);
const status = ref<RiverStatusInfo>({
  longitude: '--',
  latitude: '--',
  altitude: '--',
  cameraHeight: '--',
  activeTool: '浏览',
  currentPlan: riverPlanSummaries[currentPlan.value].label
});

const currentSummary = computed(() => riverPlanSummaries[currentPlan.value]);

function resetFlowSteps() {
  flowSteps.value = riverFlowTemplate.map(step => ({
    ...step,
    status: 'waiting'
  }));
}

function markFlowStep(index: number) {
  flowSteps.value = flowSteps.value.map((step, stepIndex) => ({
    ...step,
    status: stepIndex < index ? 'success' : stepIndex === index ? 'running' : 'waiting'
  }));
}

function completeFlowSteps() {
  flowSteps.value = flowSteps.value.map(step => ({
    ...step,
    status: 'success'
  }));
}

function setInteractiveTool(tool: RiverInteractiveTool | 'browse', activeKey: RiverToolKey | null) {
  viewerRef.value?.setActiveTool(tool);
  activeLeftTool.value = activeKey;
}

async function handleAnalyze() {
  if (analysisRunning.value || !viewerRef.value) return;

  analysisRunning.value = true;
  activeLeftTool.value = 'analysis';
  taskPanelVisible.value = true;
  taskPanelCollapsed.value = false;
  resetFlowSteps();

  try {
    await viewerRef.value.startAnalysis(currentPlan.value, markFlowStep);
    completeFlowSteps();
    window.$message?.success('渡河保障方案已生成');
  } finally {
    analysisRunning.value = false;
    activeLeftTool.value = taskPanelVisible.value ? 'task' : null;
  }
}

function handleLeftToolSelect(key: RiverToolKey) {
  switch (key) {
    case 'task':
      taskPanelVisible.value = !taskPanelVisible.value;

      if (taskPanelVisible.value) {
        taskPanelCollapsed.value = false;
      }

      setInteractiveTool('browse', taskPanelVisible.value ? key : null);
      return;
    case 'analysis':
      void handleAnalyze();
      return;
    case 'annotate':
      if (activeLeftTool.value === 'annotate') {
        setInteractiveTool('browse', taskPanelVisible.value ? 'task' : null);
      } else {
        setInteractiveTool('annotate', key);
        window.$message?.info('请在地图上点击添加保障标注');
      }

      return;
    case 'locate':
      viewerRef.value?.flyToPreset();
      setInteractiveTool('browse', taskPanelVisible.value ? 'task' : null);
      return;
    default:
      return;
  }
}

function handleRightToolSelect(key: RiverToolKey) {
  switch (key) {
    case 'layers':
      layerPanelVisible.value = !layerPanelVisible.value;

      if (layerPanelVisible.value) {
        layerPanelCollapsed.value = false;
      }

      activeRightTool.value = layerPanelVisible.value ? key : null;
      return;
    case 'reset':
      viewerRef.value?.resetView();
      activeRightTool.value = null;
      return;
    case 'pitch':
      viewerRef.value?.pitch();
      activeRightTool.value = key;
      return;
    case 'rotate':
      viewerRef.value?.rotate();
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

function handleLayerChange(payload: { key: RiverLayerKey; visible: boolean }) {
  const layer = layerItems.value.find(item => item.key === payload.key);

  if (!layer) return;

  layer.visible = payload.visible;
  viewerRef.value?.setLayerVisible(payload.key, payload.visible);
}

function handlePlanSelect(planKey: RiverPlanKey) {
  currentPlan.value = planKey;
  viewerRef.value?.showPlan(planKey);
}

function handleTaskPanelCollapse() {
  taskPanelCollapsed.value = !taskPanelCollapsed.value;
  taskPanelVisible.value = true;
  activeLeftTool.value = 'task';
}

function handleTaskFormUpdate(nextForm: RiverTaskForm) {
  taskForm.value = nextForm;
}

function handleResultPanelCollapse() {
  resultPanelCollapsed.value = !resultPanelCollapsed.value;
}

function handleLayerPanelCollapse() {
  layerPanelCollapsed.value = !layerPanelCollapsed.value;
  layerPanelVisible.value = true;
  activeRightTool.value = 'layers';
}

function handleStatusChange(nextStatus: RiverStatusInfo) {
  status.value = nextStatus;

  if (nextStatus.activeTool === '浏览' && activeLeftTool.value === 'annotate') {
    activeLeftTool.value = taskPanelVisible.value ? 'task' : null;
  }
}

function handleViewerReady() {
  viewerRef.value?.showPlan(currentPlan.value);
}

function handleGenerateMark() {
  viewerRef.value?.generateMark();
}

function handleExportShot() {
  viewerRef.value?.exportScreenshot();
}

function handleBackToMain() {
  void router.push({ name: 'screen' });
}
</script>

<template>
  <div class="river-page">
    <div class="river-stage">
      <RiverViewer ref="viewerRef" @ready="handleViewerReady" @status-change="handleStatusChange" />

      <RiverToolbar
        placement="left"
        :items="riverLeftTools"
        :active-key="activeLeftTool"
        @select="handleLeftToolSelect"
      />
      <RiverToolbar
        placement="right"
        :items="riverRightTools"
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
        <RiverTaskPanel
          :collapsed="taskPanelCollapsed"
          :form="taskForm"
          :running="analysisRunning"
          :task-type-options="riverTaskTypeOptions"
          @analyze="handleAnalyze"
          @toggle-collapse="handleTaskPanelCollapse"
          @update-form="handleTaskFormUpdate"
        />
      </div>

      <div class="result-panel-wrap">
        <RiverResultPanel
          :collapsed="resultPanelCollapsed"
          :current-plan="currentPlan"
          :plans="riverPlanOptions"
          :summary="currentSummary"
          :running="analysisRunning"
          @export-shot="handleExportShot"
          @generate-mark="handleGenerateMark"
          @select-plan="handlePlanSelect"
          @toggle-collapse="handleResultPanelCollapse"
        />
      </div>

      <div v-if="layerPanelVisible" class="layer-panel-wrap">
        <RiverLayerPanel
          :collapsed="layerPanelCollapsed"
          :layers="layerItems"
          @change="handleLayerChange"
          @toggle-collapse="handleLayerPanelCollapse"
        />
      </div>

      <div class="status-bar-wrap">
        <RiverStatusBar :status="status" />
      </div>

      <div class="flow-strip-wrap">
        <RiverFlowStrip :steps="flowSteps" :running="analysisRunning" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.river-page {
  height: 100%;
  background: rgb(11, 18, 32);
}

.river-stage {
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
  top: 166px;
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
  border-color: rgba(255, 255, 255, 0.12);
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

.river-stage :deep(.river-toolbar--left) {
  top: 72px;
}

.flow-strip-wrap {
  position: absolute;
  right: 18px;
  bottom: 18px;
  width: min(760px, calc(100% - 560px));
  z-index: 20;
}

@media (max-width: 1280px) {
  .task-panel-wrap,
  .result-panel-wrap {
    top: 16px;
  }

  .layer-panel-wrap {
    top: 160px;
  }

  .flow-strip-wrap {
    width: min(640px, calc(100% - 460px));
  }
}
</style>
