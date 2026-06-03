import { computed, onBeforeUnmount, ref } from 'vue';
import {
  planningAnalysisSteps as mockAnalysisSteps,
  planningDefaultLayers,
  planningDefaultMissionForm,
  planningDefaultTaskForm,
  planningPlanResults,
  planningRouteSummaries
} from '@/mock/planning';
import { runKnowledgeRetrieval } from '@/mock/knowledge';
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

/**
 * 可取消的 sleep：返回 Promise 和取消函数
 * 组件卸载时调用 cancel() 可提前 resolve，防止异步回调修改已卸载组件的状态
 */
function makeCancellableSleep(ms: number) {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let resolveRef: (() => void) | null = null;
  const promise = new Promise<void>(resolve => {
    resolveRef = resolve;
    timerId = setTimeout(resolve, ms);
  });
  function cancel() {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
      resolveRef?.();
    }
  }
  return { promise, cancel };
}

export function usePlanning() {
  // 途经点 ID 计数器：放在函数体内，每次调用 usePlanning() 独立初始化，避免多实例共享
  let waypointIdCounter = 100;

  // 收集所有活动的 sleep 取消器，组件卸载时统一取消，防止异步回调修改已卸载组件的状态
  const sleepCancellers: Array<() => void> = [];

  function sleep(ms: number): Promise<void> {
    const { promise, cancel } = makeCancellableSleep(ms);
    sleepCancellers.push(cancel);
    return promise.then(() => {
      const idx = sleepCancellers.indexOf(cancel);
      if (idx !== -1) sleepCancellers.splice(idx, 1);
    });
  }
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
  const knowledgeHits = ref<{ docCount: number; chunkCount: number; docNames: string[] } | null>(null);

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

    // 调用知识库检索以增强规划上下文
    const routeQuery = `${taskForm.value.startName} ${taskForm.value.endName} ${taskForm.value.routePreference === 'safest' ? '风险安全' : taskForm.value.routePreference === 'shortest' ? '最短' : '快速'} 路线规划`;
    const retrievalResults = runKnowledgeRetrieval(routeQuery);
    const docCount = retrievalResults.length;
    const topDocNames = retrievalResults.slice(0, 3).map(r => r.document.name);
    knowledgeHits.value = { docCount, chunkCount: retrievalResults.reduce((s, r) => s + r.matches.length, 0), docNames: topDocNames };

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

    // 步骤0：实际调用知识库检索
    const missionQuery = `${missionForm.value.startName} ${missionForm.value.endName} 机动方案 ${missionForm.value.waypoints.map(w => w.name).join(' ')}`;
    const retrievalResults = runKnowledgeRetrieval(missionQuery);
    const totalChunks = retrievalResults.reduce((sum, r) => sum + r.matches.length, 0);
    const docCount = retrievalResults.length;
    const docNames = retrievalResults.slice(0, 3).map(r => r.document.name);
    knowledgeHits.value = { docCount, chunkCount: totalChunks, docNames };

    // 模拟7步分析过程（含知识库检索）
    const steps = [...mockAnalysisSteps];
    const totalSteps = steps.length;
    for (let i = 0; i < totalSteps; i++) {
      analysisSteps.value = steps.map((step, index) => ({
        ...step,
        status: index < i ? 'completed' : index === i ? 'running' : 'pending'
      }));
      analysisProgress.value = Math.min(95, Math.round(((i + 1) / totalSteps) * 100));

      // 知识库检索步骤显示实际命中结果
      if (steps[i].id === 'step-0' && knowledgeHits.value) {
        analysisStatusText.value = docCount > 0
          ? `正在检索知识库... 命中 ${docCount} 篇文档（${docNames.slice(0, 2).join('、')}），共 ${totalChunks} 条片段`
          : '正在检索知识库... 未命中相关文档，使用默认模板';
      } else {
        analysisStatusText.value = getStepStatusText(steps[i].label);
      }
      await sleep(800);
    }

    // 完成所有步骤
    analysisSteps.value = steps.map(step => ({ ...step, status: 'completed' }));
    analysisProgress.value = 100;
    analysisStatusText.value = docCount > 0
      ? `分析完成，已结合 ${docCount} 篇知识文档生成 3 条推荐方案`
      : '分析完成，已生成3条推荐方案';
    selectedPlan.value = 'plan-a';
    missionRunning.value = false;
  }

  function getStepStatusText(stepLabel: string): string {
    const textMap: Record<string, string> = {
      '知识库检索': '正在检索知识库，匹配相关文档...',
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
    knowledgeHits.value = null;
  }

  function updateStatus(nextStatus: PlanningStatusInfo) {
    status.value = nextStatus;
  }

  // 组件卸载时取消所有正在等待的 sleep，防止异步步骤动画继续修改已卸载组件的状态
  onBeforeUnmount(() => {
    sleepCancellers.forEach(cancel => cancel());
    sleepCancellers.length = 0;
    missionRunning.value = false;
  });

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
    knowledgeHits,
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
