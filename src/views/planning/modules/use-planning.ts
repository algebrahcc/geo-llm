import { computed, ref } from 'vue';
import {
  planningAnalysisSteps as mockAnalysisSteps,
  planningDefaultLayers,
  planningDefaultMissionForm,
  planningDefaultTaskForm,
  planningPlanResults,
  planningRouteSummaries
} from '@/mock/planning';
import type {
  PlanningAnalysisStep,
  PlanningLayerItem,
  PlanningLayerKey,
  PlanningMissionForm,
  PlanningPageMode,
  PlanningPlanKey,
  PlanningPlanResult,
  PlanningPickedPoint,
  PlanningPlanResult as PlanningPlanResultType,
  PlanningRouteKey,
  PlanningStatusInfo,
  PlanningTaskForm,
  PlanningWaypoint
} from './types';

type PlanningState = 'idle' | 'picking-start' | 'picking-end' | 'analyzing' | 'done';

function sleep(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

let waypointIdCounter = 100;

export function usePlanning() {
  // ──── 页面模式 ────
  const pageMode = ref<PlanningPageMode>('mission');

  // ──── 路线规划模式状态 ────
  const taskForm = ref<PlanningTaskForm>({ ...planningDefaultTaskForm });
  const currentRoute = ref<PlanningRouteKey>('route-a');

  // ──── 机动方案模式状态 ────
  const missionForm = ref<PlanningMissionForm>({
    ...planningDefaultMissionForm,
    waypoints: planningDefaultMissionForm.waypoints.map(wp => ({ ...wp }))
  });
  const selectedPlan = ref<PlanningPlanKey>('plan-a');
  const missionRunning = ref(false);
  const analysisSteps = ref<PlanningAnalysisStep[]>(
    mockAnalysisSteps.map(step => ({ ...step }))
  );
  const analysisProgress = ref(58);
  const analysisStatusText = ref('正在分析路况与障碍情况，请稍候...');

  // ──── 通用状态 ────
  const layerItems = ref<PlanningLayerItem[]>(planningDefaultLayers.map(item => ({ ...item })));
  const planningState = ref<PlanningState>('idle');
  const status = ref<PlanningStatusInfo>({
    longitude: '--',
    latitude: '--',
    altitude: '--',
    cameraHeight: '--',
    activeTool: '浏览',
    currentRoute: planningRouteSummaries[currentRoute.value].label,
    planningState: '待规划'
  });

  // ──── 计算属性 ────
  const currentSummary = computed(() => planningRouteSummaries[currentRoute.value]);
  const currentPlanResult = computed(() => planningPlanResults.find(p => p.key === selectedPlan.value));
  const missionResultSummary = computed(() => ({
    totalPlans: planningPlanResults.length,
    bestPlan: '方案一',
    bestScore: 92.3
  }));

  // ──── 路线规划模式方法 ────
  function updateForm(nextForm: PlanningTaskForm) {
    taskForm.value = nextForm;
  }

  function setCurrentRoute(routeKey: PlanningRouteKey) {
    currentRoute.value = routeKey;
    status.value = {
      ...status.value,
      currentRoute: planningRouteSummaries[routeKey].label
    };
  }

  async function startPlanning() {
    setPlanningState('analyzing');
    await sleep(960);
    setCurrentRoute(
      taskForm.value.routePreference === 'safest'
        ? 'route-c'
        : taskForm.value.routePreference === 'shortest'
          ? 'route-b'
          : 'route-a'
    );
    setPlanningState('done');
  }

  // ──── 机动方案模式方法 ────
  function updateMissionForm(nextForm: PlanningMissionForm) {
    missionForm.value = nextForm;
  }

  function addWaypoint(name: string, longitude: number | null = null, latitude: number | null = null) {
    const id = `wp-${++waypointIdCounter}`;
    const order = missionForm.value.waypoints.length + 1;
    missionForm.value = {
      ...missionForm.value,
      waypoints: [...missionForm.value.waypoints, { id, name, longitude, latitude, order }]
    };
  }

  function removeWaypoint(id: string) {
    const newWaypoints = missionForm.value.waypoints.filter(wp => wp.id !== id);
    // 重新排序
    const reordered = newWaypoints.map((wp, index) => ({ ...wp, order: index + 1 }));
    missionForm.value = { ...missionForm.value, waypoints: reordered };
  }

  function updateWaypoint(id: string, updates: Partial<PlanningWaypoint>) {
    const newWaypoints = missionForm.value.waypoints.map(wp =>
      wp.id === id ? { ...wp, ...updates } : wp
    );
    missionForm.value = { ...missionForm.value, waypoints: newWaypoints };
  }

  function reorderWaypoints(fromIndex: number, toIndex: number) {
    const waypoints = [...missionForm.value.waypoints];
    const [moved] = waypoints.splice(fromIndex, 1);
    waypoints.splice(toIndex, 0, moved);
    const reordered = waypoints.map((wp, index) => ({ ...wp, order: index + 1 }));
    missionForm.value = { ...missionForm.value, waypoints: reordered };
  }

  function selectPlan(planKey: PlanningPlanKey) {
    selectedPlan.value = planKey;
  }

  async function startMissionPlanning() {
    if (missionRunning.value) return;

    missionRunning.value = true;

    // 模拟6步分析过程
    const steps = [...mockAnalysisSteps];
    for (let i = 0; i < steps.length; i++) {
      analysisSteps.value = steps.map((step, index) => ({
        ...step,
        status: index < i ? 'completed' : index === i ? 'running' : 'pending'
      }));
      analysisProgress.value = Math.min(95, Math.round(((i + 1) / steps.length) * 100));
      analysisStatusText.value = getStepStatusText(steps[i].label);
      await sleep(800);
    }

    // 完成所有步骤
    analysisSteps.value = steps.map(step => ({ ...step, status: 'completed' }));
    analysisProgress.value = 100;
    analysisStatusText.value = '分析完成，已生成3条推荐方案';
    selectedPlan.value = 'plan-a';
    missionRunning.value = false;
  }

  function getStepStatusText(stepLabel: string): string {
    const textMap: Record<string, string> = {
      '路网数据加载': '正在加载全国路网数据...',
      '路线可行性分析': '正在分析路线可行性...',
      '路况与障碍分析': '正在分析路况与障碍情况，请稍候...',
      '风险评估分析': '正在评估沿途风险因素...',
      '方案生成与优化': '正在生成优化方案...',
      '结果输出': '正在整理输出结果...'
    };
    return textMap[stepLabel] || '处理中...';
  }

  // ──── 通用方法 ────
  function setPickedPoint(payload: PlanningPickedPoint) {
    const longitude = Number(payload.longitude.toFixed(6));
    const latitude = Number(payload.latitude.toFixed(6));
    const label = payload.type === 'start' ? '地图选定起点' : '地图选定终点';

    taskForm.value = {
      ...taskForm.value,
      ...(payload.type === 'start'
        ? { startName: label, startLongitude: longitude, startLatitude: latitude }
        : { endName: label, endLongitude: longitude, endLatitude: latitude })
    };
  }

  function setLayerVisible(key: PlanningLayerKey, visible: boolean) {
    const target = layerItems.value.find(item => item.key === key);
    if (target) {
      target.visible = visible;
    }
  }

  function setPlanningState(state: PlanningState) {
    planningState.value = state;
    const planningStateLabelMap: Record<PlanningState, string> = {
      idle: '待规划',
      'picking-start': '选取起点',
      'picking-end': '选取终点',
      analyzing: '规划中',
      done: '已生成'
    };
    status.value = {
      ...status.value,
      planningState: planningStateLabelMap[state]
    };
  }

  function clearTask() {
    taskForm.value = { ...planningDefaultTaskForm };
    currentRoute.value = 'route-a';
    setPlanningState('idle');
    status.value = { ...status.value, currentRoute: planningRouteSummaries['route-a'].label };
  }

  function resetMission() {
    missionForm.value = {
      ...planningDefaultMissionForm,
      waypoints: planningDefaultMissionForm.waypoints.map(wp => ({ ...wp }))
    };
    selectedPlan.value = 'plan-a';
    missionRunning.value = false;
    analysisSteps.value = mockAnalysisSteps.map(step => ({ ...step }));
    analysisProgress.value = 0;
    analysisStatusText.value = '';
  }

  function updateStatus(nextStatus: PlanningStatusInfo) {
    status.value = nextStatus;
  }

  return {
    // 模式
    pageMode,
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
    currentPlanResult,
    missionRunning,
    analysisSteps,
    analysisProgress,
    analysisStatusText,
    missionResultSummary,
    planResults: planningPlanResults,
    updateMissionForm,
    addWaypoint,
    removeWaypoint,
    updateWaypoint,
    reorderWaypoints,
    selectPlan,
    startMissionPlanning,
    resetMission,
    // 通用
    layerItems,
    planningState,
    status,
    updateStatus,
    setPickedPoint,
    setLayerVisible,
    setPlanningState
  };
}
