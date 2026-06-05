<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  planningDefaultRouteSettingsForm,
  planningDefaultSupportSettingsForm,
  planningRouteAnalysisSteps,
  planningRouteSummaries,
  planningSupportAnalysisSteps
} from '@/mock/planning';
import { runKnowledgeRetrieval } from '@/mock/knowledge';
import { sleep } from '@/utils/async';
import PlanningRouteAiPanel from './modules/planning-route-ai-panel.vue';
import PlanningRouteResultBar from './modules/planning-route-result-bar.vue';
import PlanningRouteSettingsPanel from './modules/planning-route-settings-panel.vue';
import PlanningSupportAiPanel from './modules/planning-support-ai-panel.vue';
import PlanningSupportResultBar from './modules/planning-support-result-bar.vue';
import PlanningSupportSettingsPanel from './modules/planning-support-settings-panel.vue';
import SceneToolbar from '@/components/common/scene-toolbar.vue';
import { useDraggable } from '@/composables/use-draggable';
import PlanningViewer from './modules/planning-viewer.vue';
import { usePlanning } from './modules/use-planning';
import type {
  PlanningAnalysisStep,
  PlanningInteractiveTool,
  PlanningLayerKey,
  PlanningPageMode,
  PlanningPickedPoint,
  PlanningPlanKey,
  PlanningRouteKey,
  PlanningRouteResultCard,
  PlanningRouteSettingsForm,
  PlanningSupportSettingsForm,
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
  rotate: () => void;
  pitch: () => void;
  toggleViewMode: () => void;
}

const viewerRef = ref<PlanningViewerExposed | null>(null);
const router = useRouter();

// ──── 页面模式（Tab切换） ────
const pageMode = ref<PlanningPageMode>('route');

// ──── routePreference 旧映射：新表单 → 旧 taskForm ────
function mapPreferenceToLegacy(pref: string): 'fastest' | 'shortest' | 'safest' {
  if (pref === 'time' || pref === 'space') return 'fastest';
  if (pref === 'distance') return 'shortest';
  if (pref === 'risk') return 'safest';
  return 'fastest';
}

// ──── 根据路线摘要动态生成结果卡片 ────
const routeResultCards = computed<PlanningRouteResultCard[]>(() => {
  const routeKeys: PlanningRouteKey[] = ['route-a', 'route-b', 'route-c'];
  const tagConfig: Record<PlanningRouteKey, { tag: string; tagType: 'success' | 'info' | 'warning' }> = {
    'route-a': { tag: '推荐', tagType: 'success' },
    'route-b': { tag: '最快', tagType: 'info' },
    'route-c': { tag: '最稳', tagType: 'warning' }
  };
  return routeKeys.map((key, i) => {
    const s = planningRouteSummaries[key];
    const dur = s.metrics.find(m => m.label === '行程时间')?.value ?? '--';
    const dist = s.metrics.find(m => m.label === '总里程')?.value ?? '--';
    const scoreVal = s.metrics.find(m => m.label === '通行评分')?.value ?? '0';
    const cfg = tagConfig[key];
    return {
      key: `route-card-${key}`,
      title: s.label,
      subtitle: s.subtitle,
      tag: cfg.tag,
      tagType: cfg.tagType,
      score: Number(scoreVal),
      duration: dur,
      distance: dist,
      highlights: [...s.highlights],
      mainPath: s.title,
      isRecommended: i === 0
    };
  });
});

// ──── 新表单数据 ────
const routeSettingsForm = ref<PlanningRouteSettingsForm>({ ...planningDefaultRouteSettingsForm });
const supportSettingsForm = ref<PlanningSupportSettingsForm>({ ...planningDefaultSupportSettingsForm });

// ──── 面板可见与折叠 ────
const leftPanelVisible = ref(true);
const rightPanelVisible = ref(false);
const bottomPanelVisible = ref(false);
const leftPanelCollapsed = ref(false);
const rightPanelCollapsed = ref(false);
const bottomPanelCollapsed = ref(false);

// ──── 分析步骤与进度 ────
const routeAnalysisSteps = ref<PlanningAnalysisStep[]>(
  planningRouteAnalysisSteps.map(s => ({ ...s }))
);
const supportAnalysisSteps = ref<PlanningAnalysisStep[]>(
  planningSupportAnalysisSteps.map(s => ({ ...s }))
);
const routeProgress = ref(0);
const supportProgress = ref(0);
const routeStatusText = ref('');
const supportStatusText = ref('');
const routeRunning = ref(false);
const supportRunning = ref(false);

// ──── 知识库命中结果 ────
const routeKnowledgeHits = ref<{ docCount: number; chunkCount: number; docNames: string[] } | null>(null);
const supportKnowledgeHits = ref<{ docCount: number; chunkCount: number; docNames: string[] } | null>(null);

// ──── 方案选择 ────
const selectedRouteCard = ref<string | null>(null);
const selectedSupportCard = ref<string | null>(null);

// ──── 拖拽状态 ────
const leftDrag = useDraggable({ anchor: 'left', initialX: 72, initialY: 72 });
const rightDrag = useDraggable({ anchor: 'right', initialX: 16, initialY: 72 });
const bottomDrag = useDraggable({ anchor: 'bottom', initialX: 0, initialY: 14 });

// ──── 业务逻辑（保留原有 composable） ────
const {
  taskForm,
  currentRoute,
  currentSummary,
  updateForm,
  setCurrentRoute,
  startPlanning,
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
  layerItems,
  planningState,
  setPickedPoint,
  setLayerVisible,
  setPlanningState
} = usePlanning();

// ──── Tab 切换 ────
function handleTabSwitch(mode: PlanningPageMode) {
  pageMode.value = mode;
}

// ──── 面板折叠 ────
function handleLeftPanelCollapse() {
  leftPanelCollapsed.value = !leftPanelCollapsed.value;
}

function handleRightPanelCollapse() {
  rightPanelCollapsed.value = !rightPanelCollapsed.value;
}

function handleBottomPanelCollapse() {
  bottomPanelCollapsed.value = !bottomPanelCollapsed.value;
}

// ──── 面板关闭/显示切换 ────
function toggleLeftPanel() {
  leftPanelVisible.value = !leftPanelVisible.value;
  if (leftPanelVisible.value) leftPanelCollapsed.value = false;
}

function toggleRightPanel() {
  rightPanelVisible.value = !rightPanelVisible.value;
  if (rightPanelVisible.value) rightPanelCollapsed.value = false;
}

function toggleBottomPanel() {
  bottomPanelVisible.value = !bottomPanelVisible.value;
  if (bottomPanelVisible.value) bottomPanelCollapsed.value = false;
}

// ──── 机动规划提交 ────
async function handleRoutePlan() {
  if (routeRunning.value) return;
  if (routeSettingsForm.value.startLongitude == null || routeSettingsForm.value.endLongitude == null) {
    window.$message?.warning('请先设置起点和终点');
    return;
  }
  routeRunning.value = true;
  // 打开右侧AI面板，但底部结果面板先不显示
  rightPanelVisible.value = true;
  rightPanelCollapsed.value = false;

  const steps = [...planningRouteAnalysisSteps];
  for (let i = 0; i < steps.length; i++) {
    routeAnalysisSteps.value = steps.map((step, index) => ({
      ...step,
      status: index < i ? 'completed' : index === i ? 'running' : 'pending'
    }));
    routeProgress.value = Math.min(95, Math.round(((i + 1) / steps.length) * 100));

    // 步骤0：实际调用知识库检索
    if (steps[i].label === '知识库检索') {
      const query = `${routeSettingsForm.value.startName} ${routeSettingsForm.value.endName} 机动路线规划`;
      const results = runKnowledgeRetrieval(query);
      const docCount = results.length;
      const topDocs = results.slice(0, 3).map(r => r.document.name);
      const chunkCount = results.reduce((s, r) => s + r.matches.length, 0);
      routeKnowledgeHits.value = { docCount, chunkCount, docNames: topDocs };
      routeStatusText.value = docCount > 0
        ? `正在检索知识库... 命中 ${docCount} 篇文档（${topDocs.slice(0, 2).join('、')}），共 ${chunkCount} 条片段`
        : '正在检索知识库... 未命中相关文档，使用默认模板';
    } else {
      routeStatusText.value = getRouteStepText(steps[i].label);
    }
    await sleep(700);
  }

  routeAnalysisSteps.value = steps.map(step => ({ ...step, status: 'completed' }));
  routeProgress.value = 100;

  // 同步 routeSettingsForm 到旧 taskForm，确保 startPlanning 使用最新数据
  const legacyPref = mapPreferenceToLegacy(routeSettingsForm.value.routePreference);
  updateForm({
    ...taskForm.value,
    taskName: '机动路线规划',
    startName: routeSettingsForm.value.startName,
    startLongitude: routeSettingsForm.value.startLongitude,
    startLatitude: routeSettingsForm.value.startLatitude,
    endName: routeSettingsForm.value.endName,
    endLongitude: routeSettingsForm.value.endLongitude,
    endLatitude: routeSettingsForm.value.endLatitude,
    routePreference: legacyPref,
    constraints: (routeSettingsForm.value.advanceAreas ?? []).length > 0
      ? (routeSettingsForm.value.advanceAreas ?? [])
      : taskForm.value.constraints
  });

  setPlanningState('analyzing');
  try {
    await startPlanning();
    // 根据 setCurrentRoute 的结果更新地图标绘
    viewerRef.value?.showRoute(currentRoute.value);
    viewerRef.value?.setStartPoint(routeSettingsForm.value.startLongitude, routeSettingsForm.value.startLatitude, routeSettingsForm.value.startName);
    viewerRef.value?.setEndPoint(routeSettingsForm.value.endLongitude, routeSettingsForm.value.endLatitude, routeSettingsForm.value.endName);
    setPlanningState('done');

    const matchedCard = routeResultCards.value.find(c => c.score >= 82)?.key;
    selectedRouteCard.value = matchedCard ?? 'route-card-route-a';
    routeStatusText.value = '分析完成，已生成3条推荐方案';
    window.$message?.success('机动路线规划完成');
  } catch {
    setPlanningState('idle');
    window.$message?.error('路线规划失败');
  }

  // 分析完成后再打开底部结果面板
  bottomPanelVisible.value = true;
  bottomPanelCollapsed.value = false;
  routeRunning.value = false;
}

function getRouteStepText(label: string): string {
  const map: Record<string, string> = {
    '路网数据解析': '正在解析路网数据...',
    '障碍识别分析': '正在识别障碍区域...',
    '交通状况评估': '正在评估交通状况...',
    '多路径规划': '正在规划多条候选路径...',
    '路线风险评估': '正在评估路线风险...',
    '方案优化排序': '正在优化排序方案...',
    '结果输出': '正在整理输出结果...'
  };
  return map[label] || '处理中...';
}

// ──── 机动保障提交 ────
async function handleSupportPlan() {
  if (supportRunning.value) return;
  supportRunning.value = true;
  // 打开右侧AI面板，但底部结果面板先不显示
  rightPanelVisible.value = true;
  rightPanelCollapsed.value = false;

  const steps = [...planningSupportAnalysisSteps];
  for (let i = 0; i < steps.length; i++) {
    supportAnalysisSteps.value = steps.map((step, index) => ({
      ...step,
      status: index < i ? 'completed' : index === i ? 'running' : 'pending'
    }));
    supportProgress.value = Math.min(95, Math.round(((i + 1) / steps.length) * 100));

    // 步骤0：实际调用知识库检索
    if (steps[i].label === '知识库检索') {
      const query = `${supportSettingsForm.value.missionName} 机动保障方案`;
      const results = runKnowledgeRetrieval(query);
      const docCount = results.length;
      const topDocs = results.slice(0, 3).map(r => r.document.name);
      const chunkCount = results.reduce((s, r) => s + r.matches.length, 0);
      supportKnowledgeHits.value = { docCount, chunkCount, docNames: topDocs };
      supportStatusText.value = docCount > 0
        ? `正在检索知识库... 命中 ${docCount} 篇文档（${topDocs.slice(0, 2).join('、')}），共 ${chunkCount} 条片段`
        : '正在检索知识库... 未命中相关文档，使用默认模板';
    } else {
      supportStatusText.value = getSupportStepText(steps[i].label);
    }
    await sleep(700);
  }

  supportAnalysisSteps.value = steps.map(step => ({ ...step, status: 'completed' }));
  supportProgress.value = 100;
  supportStatusText.value = '分析完成，已生成4条保障方案';
  selectedSupportCard.value = 'support-card-a';
  supportRunning.value = false;

  // 分析完成后再打开底部结果面板
  bottomPanelVisible.value = true;
  bottomPanelCollapsed.value = false;
  window.$message?.success('机动保障方案生成完成');
}

function getSupportStepText(label: string): string {
  const map: Record<string, string> = {
    '路网解析': '正在解析路网数据...',
    '障碍识别': '正在识别障碍区域...',
    '预案生成': '正在生成保障预案...',
    '兵力车量计算': '正在计算兵力与车辆配置...',
    '油料计算': '正在计算油料需求...',
    '保障布设': '正在规划保障站点布设...',
    '方案评估': '正在评估方案可行性...'
  };
  return map[label] || '处理中...';
}

// ──── 表单更新 ────
function handleRouteSettingsUpdate(form: PlanningRouteSettingsForm) {
  routeSettingsForm.value = form;
}

function handleSupportSettingsUpdate(form: PlanningSupportSettingsForm) {
  supportSettingsForm.value = form;
}

// ──── 点选起终点 ────
function handlePickStart() {
  setPlanningState('picking-start');
  viewerRef.value?.setActiveTool('pick-start');
}

function handlePickEnd() {
  setPlanningState('picking-end');
  viewerRef.value?.setActiveTool('pick-end');
}

// ──── 方案选择 ────
function handleRouteCardSelect(key: string) {
  selectedRouteCard.value = key;
  if (key === 'route-card-route-a') {
    setCurrentRoute('route-a');
    viewerRef.value?.showRoute('route-a');
  } else if (key === 'route-card-route-b') {
    setCurrentRoute('route-b');
    viewerRef.value?.showRoute('route-b');
  } else if (key === 'route-card-route-c') {
    setCurrentRoute('route-c');
    viewerRef.value?.showRoute('route-c');
  }
  window.$message?.info(`已切换到${key}`);
}

function handleSupportCardSelect(key: string) {
  selectedSupportCard.value = key;
  window.$message?.info(`已选择保障方案: ${key}`);
}

// ──── 右侧工具栏 ────
const activeRightTool = ref<string | null>(null);
const is2dMode = ref(false);

function handleRightToolSelect(key: string) {
  switch (key) {
    case 'reset':
      viewerRef.value?.resetView();
      break;
    case 'zoom-in':
      viewerRef.value?.zoomIn();
      break;
    case 'zoom-out':
      viewerRef.value?.zoomOut();
      break;
    case 'rotate':
      viewerRef.value?.rotate?.();
      break;
    case 'pitch':
      viewerRef.value?.pitch?.();
      break;
    case 'screenshot':
      viewerRef.value?.exportScreenshot?.();
      break;
    default:
      break;
  }
  activeRightTool.value = key;
}

function handleToggle2d3d() {
  viewerRef.value?.toggleViewMode?.();
  is2dMode.value = !is2dMode.value;
}

function handleLayerChange(payload: { key: PlanningLayerKey; visible: boolean }) {
  setLayerVisible(payload.key, payload.visible);
  viewerRef.value?.setLayerVisible(payload.key, payload.visible);
}

function handleViewerReady() {
  viewerRef.value?.showRoute(currentRoute.value);
  viewerRef.value?.setStartPoint(taskForm.value.startLongitude, taskForm.value.startLatitude, taskForm.value.startName);
  viewerRef.value?.setEndPoint(taskForm.value.endLongitude, taskForm.value.endLatitude, taskForm.value.endName);
}

function handleBackToMain() {
  void router.push({ name: 'screen' });
}

function handlePointPicked(payload: PlanningPickedPoint) {
  setPickedPoint(payload);
  if (payload.type === 'start') {
    viewerRef.value?.setStartPoint(payload.longitude, payload.latitude, '地图选定起点');
    routeSettingsForm.value = {
      ...routeSettingsForm.value,
      startName: '地图选定起点',
      startLongitude: payload.longitude,
      startLatitude: payload.latitude
    };
  } else {
    viewerRef.value?.setEndPoint(payload.longitude, payload.latitude, '地图选定终点');
    routeSettingsForm.value = {
      ...routeSettingsForm.value,
      endName: '地图选定终点',
      endLongitude: payload.longitude,
      endLatitude: payload.latitude
    };
  }
  viewerRef.value?.setActiveTool('browse');
  setPlanningState('idle');
}

// ──── AI 对话发送 ────
// 模拟智能体基于知识库的回复
function handleRouteAiSend(message: string) {
  if (routeKnowledgeHits.value && routeKnowledgeHits.value.docCount > 0) {
    const docRef = routeKnowledgeHits.value.docNames.slice(0, 2).join('、');
    window.$message?.success(`[智能体] 已结合"${docRef}"等知识库文档分析，规划方案已推送至地图与底部面板`);
  } else {
    window.$message?.info(`[智能体] 已收到: ${message}`);
  }
}

function handleSupportAiSend(message: string) {
  if (supportKnowledgeHits.value && supportKnowledgeHits.value.docCount > 0) {
    const docRef = supportKnowledgeHits.value.docNames.slice(0, 2).join('、');
    window.$message?.success(`[智能体] 已结合"${docRef}"等知识库文档分析，保障方案已推送至底部面板`);
  } else {
    window.$message?.info(`[智能体] 已收到: ${message}`);
  }
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

      <!-- ══════ 左上角：返回按钮 + 面板开关 ══════ -->
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
              class="side-btn"
              :class="{ 'side-btn--active': leftPanelVisible }"
              @click="toggleLeftPanel"
            >
              <SvgIcon icon="mdi:file-document-edit-outline" />
            </button>
          </template>
          <span>设置面板</span>
        </NTooltip>

        <NTooltip placement="right">
          <template #trigger>
            <button
              type="button"
              class="side-btn"
              :class="{ 'side-btn--active': rightPanelVisible }"
              @click="toggleRightPanel"
            >
              <SvgIcon icon="mdi:robot-outline" />
            </button>
          </template>
          <span>AI助手</span>
        </NTooltip>

        <NTooltip placement="right">
          <template #trigger>
            <button
              type="button"
              class="side-btn"
              :class="{ 'side-btn--active': bottomPanelVisible }"
              @click="toggleBottomPanel"
            >
              <SvgIcon icon="mdi:chart-box-outline" />
            </button>
          </template>
          <span>结果面板</span>
        </NTooltip>
      </div>

      <!-- ══════ 右侧：工具栏（公共：2D/3D切换、复位、缩放、截图） ══════ -->
      <div class="right-toolbar">
        <SceneToolbar
          placement="right"
          :is-2d-mode="is2dMode"
          :items="[
            { key: 'reset', label: '复位', icon: 'mdi:home-outline' },
            { key: 'zoom-in', label: '放大', icon: 'mdi:magnify-plus-outline' },
            { key: 'zoom-out', label: '缩小', icon: 'mdi:magnify-minus-outline' },
            { key: 'rotate', label: '旋转', icon: 'mdi:rotate-orbit' },
            { key: 'pitch', label: '俯仰', icon: 'mdi:axis-arrow' },
            { key: 'screenshot', label: '截图', icon: 'mdi:camera-outline' }
          ]"
          :active-key="activeRightTool"
          @select="handleRightToolSelect"
          @toggle-2d3d="handleToggle2d3d"
        />
      </div>

      <!-- ══════ 左侧设置面板（可拖拽/关闭） ══════ -->
      <Transition name="panel-slide-left">
        <div v-if="leftPanelVisible" class="floating-panel left-panel" :style="leftDrag.style.value">
          <!-- 拖拽手柄 -->
          <div class="panel-drag-handle" @mousedown="leftDrag.onDragStart">
            <span class="drag-dots">⋮⋮</span>
            <span class="drag-label">机动规划</span>
            <button type="button" class="panel-close-btn" @click.stop="leftPanelVisible = false">
              <SvgIcon icon="mdi:close" />
            </button>
          </div>

          <!-- Tab 切换 -->
          <div class="panel-tabs">
            <button
              type="button"
              class="panel-tab"
              :class="{ 'panel-tab--active': pageMode === 'route' }"
              @click="handleTabSwitch('route')"
            >
              <SvgIcon icon="mdi:routes" class="tab-icon" />
              机动规划
            </button>
            <button
              type="button"
              class="panel-tab"
              :class="{ 'panel-tab--active': pageMode === 'mission' }"
              @click="handleTabSwitch('mission')"
            >
              <SvgIcon icon="mdi:shield-check-outline" class="tab-icon" />
              机动保障
            </button>
          </div>

          <!-- 面板内容 -->
          <div class="panel-body">
            <PlanningRouteSettingsPanel
              v-if="pageMode === 'route'"
              :form="routeSettingsForm"
              :running="routeRunning"
              :collapsed="leftPanelCollapsed"
              :pick-mode-label="planningState === 'picking-start' ? '选取起点' : planningState === 'picking-end' ? '选取终点' : '待规划'"
              @plan="handleRoutePlan"
              @toggle-collapse="handleLeftPanelCollapse"
              @update-form="handleRouteSettingsUpdate"
              @pick-start="handlePickStart"
              @pick-end="handlePickEnd"
            />

            <PlanningSupportSettingsPanel
              v-if="pageMode === 'mission'"
              :form="supportSettingsForm"
              :running="supportRunning"
              :collapsed="leftPanelCollapsed"
              @plan="handleSupportPlan"
              @toggle-collapse="handleLeftPanelCollapse"
              @update-form="handleSupportSettingsUpdate"
            />
          </div>
        </div>
      </Transition>

      <!-- ══════ 右侧AI助手面板（可拖拽/关闭） ══════ -->
      <Transition name="panel-slide-right">
        <div v-if="rightPanelVisible" class="floating-panel right-panel" :style="rightDrag.style.value">
          <!-- 拖拽手柄 -->
          <div class="panel-drag-handle" @mousedown="rightDrag.onDragStart">
            <span class="drag-dots">⋮⋮</span>
            <span class="drag-label">AI助手</span>
            <button type="button" class="panel-close-btn" @click.stop="rightPanelVisible = false">
              <SvgIcon icon="mdi:close" />
            </button>
          </div>

          <!-- AI面板内容 -->
          <PlanningRouteAiPanel
            v-if="pageMode === 'route'"
            :collapsed="rightPanelCollapsed"
            :running="routeRunning"
            :steps="routeAnalysisSteps"
            :progress="routeProgress"
            :status-text="routeStatusText"
            :knowledge-hits="routeKnowledgeHits"
            @toggle-collapse="handleRightPanelCollapse"
            @send="handleRouteAiSend"
          />

          <PlanningSupportAiPanel
            v-if="pageMode === 'mission'"
            :collapsed="rightPanelCollapsed"
            :running="supportRunning"
            :steps="supportAnalysisSteps"
            :progress="supportProgress"
            :status-text="supportStatusText"
            :knowledge-hits="supportKnowledgeHits"
            @toggle-collapse="handleRightPanelCollapse"
            @send="handleSupportAiSend"
          />
        </div>
      </Transition>

      <!-- ══════ 底部结果面板（可拖拽/关闭） ══════ -->
      <Transition name="panel-slide-up">
        <div v-if="bottomPanelVisible" class="floating-panel bottom-panel" :style="bottomDrag.style.value">
          <!-- 拖拽手柄 -->
          <div class="panel-drag-handle bottom-drag-handle" @mousedown="bottomDrag.onDragStart">
            <span class="drag-dots">⋮⋮</span>
            <span class="drag-label">方案推荐</span>
            <button type="button" class="panel-close-btn" @click.stop="bottomPanelVisible = false">
              <SvgIcon icon="mdi:close" />
            </button>
          </div>

          <!-- 结果面板内容 -->
          <PlanningRouteResultBar
            v-if="pageMode === 'route'"
            :collapsed="bottomPanelCollapsed"
            :selected-key="selectedRouteCard"
            :cards="routeResultCards"
            @toggle-collapse="handleBottomPanelCollapse"
            @select="handleRouteCardSelect"
          />

          <PlanningSupportResultBar
            v-if="pageMode === 'mission'"
            :collapsed="bottomPanelCollapsed"
            :selected-key="selectedSupportCard"
            @toggle-collapse="handleBottomPanelCollapse"
            @select="handleSupportCardSelect"
          />
        </div>
      </Transition>
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

/* ──── 右侧工具栏 ──── */
.right-toolbar {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 25;
}

/* ──── 浮动面板通用 ──── */
.floating-panel {
  position: fixed;
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
  width: 380px;
  max-height: calc(100vh - 36px);
}

.right-panel {
  width: 420px;
  max-height: calc(100vh - 120px);
}

.bottom-panel {
  width: min(96vw, 1100px);
  max-height: 300px;
}

/* ──── 拖拽手柄 ──── */
.panel-drag-handle {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
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

.drag-label {
  font-size: 11px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.4);
}

.panel-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.35);
  cursor: pointer;
  font-size: 14px;
  margin-left: auto;
  transition: all 0.18s;
}

.panel-close-btn:hover {
  background: rgba(251, 113, 133, 0.15);
  color: #fb7185;
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

/* ──── 面板内嵌组件覆盖 ──── */
.left-panel :deep(.route-settings),
.left-panel :deep(.support-settings) {
  width: 100% !important;
  border: none !important;
  background: transparent !important;
  backdrop-filter: none !important;
  border-radius: 0 !important;
}

.right-panel :deep(.route-ai-panel),
.right-panel :deep(.support-ai-panel) {
  width: 100% !important;
  border: none !important;
  background: transparent !important;
  backdrop-filter: none !important;
  border-radius: 0 !important;
}

.bottom-panel :deep(.route-result-bar),
.bottom-panel :deep(.support-result-bar) {
  width: 100% !important;
  border: none !important;
  background: transparent !important;
  backdrop-filter: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
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

.panel-slide-up-enter-active,
.panel-slide-up-leave-active {
  transition:
    transform 0.28s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.28s ease;
}

.panel-slide-up-enter-from {
  transform: translateX(-50%) translateY(20px);
  opacity: 0;
}

.panel-slide-up-leave-to {
  transform: translateX(-50%) translateY(20px);
  opacity: 0;
}

/* ──── 响应式 ──── */
@media (max-width: 1280px) {
  .left-panel {
    width: 340px;
  }

  .right-panel {
    width: 380px;
  }

  .bottom-panel {
    width: min(96vw, 960px);
  }
}

@media (max-width: 768px) {
  .left-panel {
    width: calc(100vw - 72px);
    max-width: 380px;
  }

  .right-panel {
    width: calc(100vw - 72px);
    max-width: 420px;
  }

  .bottom-panel {
    width: calc(100vw - 36px);
  }
}
</style>
