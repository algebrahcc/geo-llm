<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  defaultEvaluateForm,
  defaultFilterForm,
  engineeringPlans,
  filterSteps as mockFilterSteps,
  portAssessments,
  portFilterResults,
  riverRightTools
} from '@/mock/river';
import RiverAssessResult from './modules/river-assess-result.vue';
import RiverEvaluatePanel from './modules/river-evaluate-panel.vue';
import RiverFilterPanel from './modules/river-filter-panel.vue';
import RiverFilterResult from './modules/river-filter-result.vue';
import RiverToolbar from './modules/river-toolbar.vue';
import RiverViewer from './modules/river-viewer.vue';
import type {
  EngineeringPlan,
  EvaluateForm,
  FilterForm,
  FilterStep,
  PortAssessment,
  PortFilterResult,
  RiverPageMode,
  RiverToolKey
} from './modules/types';

defineOptions({
  name: 'RiverPage'
});

// ──── Viewer 引用（用于右侧工具栏操作地图） ────
interface ViewerExpose {
  resetView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  rotate: () => void;
  pitch: () => void;
}

const viewerRef = ref<ViewerExpose | null>(null);

const router = useRouter();

// ──── 页面模式 ────
const pageMode = ref<RiverPageMode>('filter');

// ──── 面板可见 ────
const leftPanelVisible = ref(true);
const rightPanelVisible = ref(false);
const activeTaskButton = ref(false);
const activeRightTool = ref<RiverToolKey | null>(null);

// ──── 评估模式状态 ────
const evaluateForm = ref<EvaluateForm>({ ...defaultEvaluateForm });
const evaluateRunning = ref(false);
const evaluateCollapsed = ref(false);
const assessResultCollapsed = ref(false);
const assessedPorts = ref<PortAssessment[]>([]);

// ──── 筛选模式状态 ────
const filterForm = ref<FilterForm>({ ...defaultFilterForm });
const filterRunning = ref(false);
const filterCollapsed = ref(false);
const filterResultCollapsed = ref(false);
const filterStepList = ref<FilterStep[]>(mockFilterSteps.map(s => ({ ...s })));
const filteredPorts = ref<PortFilterResult[]>([]);
const filteredPlans = ref<EngineeringPlan[]>([]);

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
const rightPos = ref({ x: 0, y: 18 });

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

// ──── 任务按钮 ────
function handleTaskToggle() {
  leftPanelVisible.value = !leftPanelVisible.value;
  activeTaskButton.value = leftPanelVisible.value;
}

// ──── 右侧工具栏 ────
function handleRightToolSelect(key: RiverToolKey) {
  const viewer = viewerRef.value;
  switch (key) {
    case 'layers':
      rightPanelVisible.value = !rightPanelVisible.value;
      activeRightTool.value = rightPanelVisible.value ? key : null;
      return;
    case 'reset':
      viewer?.resetView();
      activeRightTool.value = null;
      return;
    case 'pitch':
      viewer?.pitch();
      return;
    case 'rotate':
      viewer?.rotate();
      return;
    case 'zoom-in':
      viewer?.zoomIn();
      return;
    case 'zoom-out':
      viewer?.zoomOut();
      return;
    default:
      activeRightTool.value = key;
      return;
  }
}

// ──── 返回主页 ────
function handleBackToMain() {
  void router.push({ name: 'screen' });
}

// ──── 评估模式逻辑 ────
async function handleEvaluate() {
  if (evaluateRunning.value) return;
  evaluateRunning.value = true;
  evaluateCollapsed.value = false;
  try {
    await new Promise(resolve => setTimeout(resolve, 2000));
    assessedPorts.value = [...portAssessments];
    rightPanelVisible.value = true;
    activeRightTool.value = 'layers';
    window.$message?.success('资源评估完成');
  } finally {
    evaluateRunning.value = false;
  }
}

function handleEvaluateFormUpdate(form: EvaluateForm) {
  evaluateForm.value = form;
}

function handleEvaluateCollapse() {
  evaluateCollapsed.value = !evaluateCollapsed.value;
}

function handleAssessResultCollapse() {
  assessResultCollapsed.value = !assessResultCollapsed.value;
}

// ──── 筛选模式逻辑 ────
async function handleFilter() {
  if (filterRunning.value) return;
  filterRunning.value = true;
  filterCollapsed.value = false;

  const steps = [...mockFilterSteps];
  for (let i = 0; i < steps.length; i++) {
    filterStepList.value = steps.map((s, idx) => ({
      ...s,
      status: idx < i ? 'success' : idx === i ? ('running' as const) : ('waiting' as const)
    }));
    await new Promise(resolve => setTimeout(resolve, 800));
  }
  filterStepList.value = steps.map(s => ({ ...s, status: 'success' as const }));
  filteredPorts.value = [...portFilterResults];
  filteredPlans.value = [...engineeringPlans];
  rightPanelVisible.value = true;
  activeRightTool.value = 'layers';
  filterRunning.value = false;
  window.$message?.success('智能筛选完成');
}

function handleFilterFormUpdate(form: FilterForm) {
  filterForm.value = form;
}

function handleFilterCollapse() {
  filterCollapsed.value = !filterCollapsed.value;
}

function handleFilterResultCollapse() {
  filterResultCollapsed.value = !filterResultCollapsed.value;
}

function handleCompare() {
  window.$message?.info('方案对比功能开发中');
}

function handleViewDetail(plan: EngineeringPlan) {
  window.$message?.info(`查看 ${plan.label} 详情`);
}
</script>

<template>
  <div class="river-page">
    <div class="river-stage">
      <RiverViewer ref="viewerRef" />

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
              :class="{ 'side-btn--active': activeTaskButton }"
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

          <div class="panel-tabs">
            <button
              type="button"
              class="panel-tab"
              :class="{ 'panel-tab--active': pageMode === 'filter' }"
              @click="pageMode = 'filter'"
            >
              <SvgIcon icon="mdi:filter-variant" class="tab-icon" />
              渡河工程方案
            </button>
            <button
              type="button"
              class="panel-tab"
              :class="{ 'panel-tab--active': pageMode === 'evaluate' }"
              @click="pageMode = 'evaluate'"
            >
              <SvgIcon icon="mdi:clipboard-text-search-outline" class="tab-icon" />
              渡河资源评估
            </button>
          </div>

          <div class="panel-body">
            <RiverEvaluatePanel
              v-if="pageMode === 'evaluate'"
              :collapsed="evaluateCollapsed"
              :form="evaluateForm"
              :running="evaluateRunning"
              @evaluate="handleEvaluate"
              @toggle-collapse="handleEvaluateCollapse"
              @update-form="handleEvaluateFormUpdate"
            />
            <RiverFilterPanel
              v-if="pageMode === 'filter'"
              :collapsed="filterCollapsed"
              :form="filterForm"
              :running="filterRunning"
              @filter="handleFilter"
              @toggle-collapse="handleFilterCollapse"
              @update-form="handleFilterFormUpdate"
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

            <RiverAssessResult
              v-if="pageMode === 'evaluate'"
              :collapsed="assessResultCollapsed"
              :ports="assessedPorts"
              :running="evaluateRunning"
              @toggle-collapse="handleAssessResultCollapse"
            />
            <RiverFilterResult
              v-if="pageMode === 'filter'"
              :collapsed="filterResultCollapsed"
              :ports="filteredPorts"
              :plans="filteredPlans"
              :steps="filterStepList"
              :running="filterRunning"
              @toggle-collapse="handleFilterResultCollapse"
              @compare="handleCompare"
              @view-detail="handleViewDetail"
            />
          </div>
        </Transition>

        <RiverToolbar
          placement="right"
          :items="riverRightTools"
          :active-key="activeRightTool"
          @select="handleRightToolSelect"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.river-page {
  height: 100%;
  background: rgb(11, 18, 32);
  position: relative;
}

.river-stage {
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

.right-side :deep(.river-toolbar) {
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
  /* position via inline style */
  order: 0;
}

.right-panel {
  /* position via inline style */
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

/* ──── 统一滚动条（覆盖子组件内部 .panel-content 滚动条） ──── */
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

/* .panel-body 自身滚动条后备 */
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
.left-panel :deep(.filter-panel),
.left-panel :deep(.evaluate-panel) {
  width: 100% !important;
  border: none !important;
  background: transparent !important;
  backdrop-filter: none !important;
  border-radius: 0 !important;
}

.left-panel :deep(.filter-panel--collapsed),
.left-panel :deep(.evaluate-panel--collapsed) {
  width: 100% !important;
}

.right-panel :deep(.filter-result),
.right-panel :deep(.assess-result) {
  width: 100% !important;
  border: none !important;
  background: transparent !important;
  backdrop-filter: none !important;
  border-radius: 0 !important;
}

.right-panel :deep(.filter-result--collapsed),
.right-panel :deep(.assess-result--collapsed) {
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

@media (max-width: 1280px) {
  .side-panel {
    width: 340px;
  }
}
</style>
