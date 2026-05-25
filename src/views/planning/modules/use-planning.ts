import { computed, ref } from 'vue';
import { planningDefaultLayers, planningDefaultTaskForm, planningRouteSummaries } from '@/mock/planning';
import type {
  PlanningLayerItem,
  PlanningLayerKey,
  PlanningPickedPoint,
  PlanningRouteKey,
  PlanningStatusInfo,
  PlanningTaskForm
} from './types';

type PlanningState = 'idle' | 'picking-start' | 'picking-end' | 'analyzing' | 'done';

function sleep(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

export function usePlanning() {
  const taskForm = ref<PlanningTaskForm>({
    ...planningDefaultTaskForm
  });

  const currentRoute = ref<PlanningRouteKey>('route-a');
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

  const currentSummary = computed(() => planningRouteSummaries[currentRoute.value]);

  function updateForm(nextForm: PlanningTaskForm) {
    taskForm.value = nextForm;
  }

  function updateField<K extends keyof PlanningTaskForm>(key: K, value: PlanningTaskForm[K]) {
    taskForm.value = {
      ...taskForm.value,
      [key]: value
    };
  }

  function setPickedPoint(payload: PlanningPickedPoint) {
    const longitude = Number(payload.longitude.toFixed(6));
    const latitude = Number(payload.latitude.toFixed(6));
    const label = payload.type === 'start' ? '地图选定起点' : '地图选定终点';

    taskForm.value = {
      ...taskForm.value,
      ...(payload.type === 'start'
        ? {
            startName: label,
            startLongitude: longitude,
            startLatitude: latitude
          }
        : {
            endName: label,
            endLongitude: longitude,
            endLatitude: latitude
          })
    };
  }

  function setLayerVisible(key: PlanningLayerKey, visible: boolean) {
    const target = layerItems.value.find(item => item.key === key);

    if (target) {
      target.visible = visible;
    }
  }

  function setCurrentRoute(routeKey: PlanningRouteKey) {
    currentRoute.value = routeKey;
    status.value = {
      ...status.value,
      currentRoute: planningRouteSummaries[routeKey].label
    };
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

  function clearTask() {
    taskForm.value = {
      ...planningDefaultTaskForm
    };
    currentRoute.value = 'route-a';
    setPlanningState('idle');
    status.value = {
      ...status.value,
      currentRoute: planningRouteSummaries['route-a'].label
    };
  }

  function updateStatus(nextStatus: PlanningStatusInfo) {
    status.value = nextStatus;
  }

  return {
    taskForm,
    currentRoute,
    currentSummary,
    layerItems,
    planningState,
    status,
    updateForm,
    updateField,
    setPickedPoint,
    setLayerVisible,
    setCurrentRoute,
    setPlanningState,
    startPlanning,
    clearTask,
    updateStatus
  };
}
