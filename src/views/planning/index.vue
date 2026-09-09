<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  planningDefaultRouteSettingsForm,
  planningRouteAnalysisSteps,
  planningRouteSummaries,
  planningRouteTraffic
} from '@/mock/planning';
import { runKnowledgeRetrieval } from '@/mock/knowledge';
import { runAnalysis, type StepDefinition, type StepState } from '@/utils/analysis-runner';
import { fetchVectorPage } from '@/service/api/vector';
import type { ServiceLayerHandle } from '@/composables/cesium/service-loader';
import PlanningRouteAiPanel from './modules/planning-route-ai-panel.vue';
import PlanningRouteResultBar from './modules/planning-route-result-bar.vue';
import PlanningRouteSettingsPanel from './modules/planning-route-settings-panel.vue';
import SceneToolbar from '@/components/common/scene-toolbar.vue';
import AgentChatPanel from '@/components/agent/agent-chat-panel.vue';
import type { PlotInstruction } from '@/components/agent/plot-instruction';
import { useDraggable } from '@/composables/use-draggable';
import { usePanelResize } from '@/composables/use-panel-resize';
import PlanningViewer from './modules/planning-viewer.vue';
import { usePlanning } from './modules/use-planning';
import type { RouteSituationPlot } from './modules/route-situation-engine';
import MapLayerPanel from '@/components/cesium/map-layer-panel.vue';
import type { VectorLayerItem } from '@/typings/cesium';
import type {
  PlanningAnalysisStep,
  PlanningInteractiveTool,
  PlanningLayerKey,
  PlanningPickedPoint,
  PlanningRouteKey,
  PlanningRouteResultCard,
  PlanningRouteSettingsForm,
  PlanningWaypoint
} from './modules/types';

defineOptions({
  name: 'PlanningPage'
});

interface PlanningViewerExposed {
  setGlobeSurfaceTranslucent: (enabled: boolean) => void;
  setActiveTool: (tool: PlanningInteractiveTool) => void;
  setLayerVisible: (key: PlanningLayerKey, visible: boolean) => void;
  showRoute: (routeKey: PlanningRouteKey) => void;
  revealRoutes: (routeKey: PlanningRouteKey) => void;
  /** 事件排除：在地图上隐藏被排除的候选路线 */
  setExcludedRoutes: (excluded: PlanningRouteKey[], active?: PlanningRouteKey) => void;
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
  /** 视角定位（智能体标绘 flyTo 指令） */
  flyToLocation: (lon: number, lat: number, height?: number, duration?: number) => void;
  /** 智能体标绘层 */
  drawAiMark: (item: { id?: string; lon: number; lat: number; name?: string; color?: string }) => string;
  drawAiLine: (item: { id?: string; name?: string; color?: string; positions: Array<[number, number]> }) => string;
  drawAiPolygon: (item: { id?: string; name?: string; color?: string; positions: Array<[number, number]> }) => string;
  drawAiText: (item: { id?: string; lon: number; lat: number; text: string; name?: string; color?: string }) => string;
  removeAiOverlay: (id: string) => boolean;
  clearAiOverlays: () => void;
  /** 矢量图层（与渡河保障一致的图层管理） */
  loadVectorLayer: (id: string, name: string, sourceType?: string) => Promise<void>;
  setVectorLayerVisible: (id: string, show: boolean) => void;
  /** 数据服务：激活服务图层句柄 + 管理方法 */
  serviceHandles: ServiceLayerHandle[];
  toggleService: (id: number, visible: boolean) => void;
  removeService: (id: number) => void;
  reorderService: (fromIndex: number, toIndex: number) => void;
}

const viewerRef = ref<PlanningViewerExposed | null>(null);
const router = useRouter();

// ──── 页面模式（Tab切换） ────

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
      traffic: planningRouteTraffic[key],
      isRecommended: i === 0
    };
  });
});

// ──── 新表单数据 ────
const routeSettingsForm = ref<PlanningRouteSettingsForm>({ ...planningDefaultRouteSettingsForm });

// ──── 面板可见与折叠 ────
const leftPanelVisible = ref(true);
const rightPanelVisible = ref(false);
const agentPanelVisible = ref(false);
const bottomPanelVisible = ref(false);
const leftPanelCollapsed = ref(false);
const rightPanelCollapsed = ref(false);
const agentCollapsed = ref(false);
const bottomPanelCollapsed = ref(false);
const layerPanelVisible = ref(false);
const layerCollapsed = ref(false);

// ──── 分析步骤与进度 ────
const routeAnalysisSteps = ref<PlanningAnalysisStep[]>(planningRouteAnalysisSteps.map(s => ({ ...s })));
const routeProgress = ref(0);
const routeStatusText = ref('');
const routeRunning = ref(false);

// ──── 知识库命中结果 ────
const routeKnowledgeHits = ref<{ docCount: number; chunkCount: number; docNames: string[] } | null>(null);

// ──── 方案选择 ────
const selectedRouteCard = ref<string | null>(null);

// ──── 事件排除：事件注入时记录受影响路线，待"重新规划路线"后过滤方案与地图 ────
const excludedRouteKeys = ref<PlanningRouteKey[]>([]);

/** 当前推荐方案（默认路线一），重新规划后随事件排除更新 */
const recommendedRouteCard = ref('route-card-route-a');

/** 排除事件影响路线后的可见方案卡（重新规划后仅展示剩余候选），推荐方案标记"推荐" */
const visibleRouteCards = computed(() =>
  routeResultCards.value
    .filter(c => !excludedRouteKeys.value.includes(c.key.replace('route-card-', '') as PlanningRouteKey))
    .map(c =>
      c.key === recommendedRouteCard.value ? { ...c, isRecommended: true, tag: '推荐', tagType: 'success' as const } : c
    )
);

// ──── 场景智能体（AgentChatPanel） ────
// Dify 应用 id：规划场景参谋应用（在系统管理-应用管理录入 Dify 控制台创建的 Agent 应用后，
// 把该记录的本地主键 id 填到这里）；未配置时组件拉取已发布 Agent 列表默认选第一个
const agentAppId = ref<string | number | undefined>(undefined);
const agentNotice = ref<string | null>(null);
// 场景上下文（机动规划表单快照）
const agentContext = computed(() => {
  return {
    page: 'planning',
    mode: 'route',
    taskName: routeSettingsForm.value.taskName,
    startName: routeSettingsForm.value.startName,
    endName: routeSettingsForm.value.endName,
    routePreference: routeSettingsForm.value.routePreference,
    advancePriority: routeSettingsForm.value.advancePriority ?? 'time',
    forceScale: routeSettingsForm.value.forceScale,
    roadGrades: (routeSettingsForm.value.roadGrades ?? []).join('、'),
    selectedRoute: selectedRouteCard.value
  };
});

// ──── 路线方案展示名（结果卡片 key → 中文标签） ────
const ROUTE_LABELS: Record<string, string> = {
  'route-card-route-a': '路线一',
  'route-card-route-b': '路线二',
  'route-card-route-c': '路线三'
};

// ──── 拖拽状态 ────
const leftDrag = useDraggable({ anchor: 'left', initialX: 62, initialY: 10 });
const rightDrag = useDraggable({ anchor: 'right', initialX: 16, initialY: 72 });
const agentDrag = useDraggable({ anchor: 'right', initialX: 16, initialY: 120 });
// 智能体面板宽高（默认 520×660，右下角可拖拽缩放）
const agentResize = usePanelResize({ width: 520, height: 660 });
const agentPanelStyle = computed(() => ({
  ...agentDrag.style.value,
  width: `${agentResize.size.value.width}px`,
  height: `${agentResize.size.value.height}px`
}));
const bottomDrag = useDraggable({ anchor: 'right', initialX: 700, initialY: 72 });
const layerDrag = useDraggable({ anchor: 'right', initialX: 72, initialY: 18 });

// ──── 业务逻辑（保留原有 composable） ────
const {
  taskForm,
  currentRoute,
  updateForm,
  setCurrentRoute,
  startPlanning,
  planningState,
  setPickedPoint,
  setPlanningState
} = usePlanning();

// ──── 面板折叠 ────
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
  if (rightPanelVisible.value) {
    rightPanelCollapsed.value = false;
    // 互斥：打开 AI 面板时关闭场景智能体面板
    agentPanelVisible.value = false;
  }
}

function toggleAgentPanel() {
  agentPanelVisible.value = !agentPanelVisible.value;
  if (agentPanelVisible.value) {
    agentCollapsed.value = false;
    // 互斥：打开场景智能体面板时关闭 AI 面板
    rightPanelVisible.value = false;
  }
}

function handleAgentClose() {
  agentPanelVisible.value = false;
}

/** 智能体标绘指令分发到 Cesium */
function handlePlotInstruction(instruction: PlotInstruction) {
  const viewer = viewerRef.value;
  if (!viewer) return;
  try {
    switch (instruction.action) {
      case 'addMark': {
        viewer.drawAiMark({
          id: instruction.id,
          lon: instruction.lon!,
          lat: instruction.lat!,
          name: instruction.name,
          color: instruction.color
        });
        viewer.flyToLocation(instruction.lon!, instruction.lat!, 5000, 1.2);
        break;
      }
      case 'addText':
        viewer.drawAiText({
          id: instruction.id,
          lon: instruction.lon!,
          lat: instruction.lat!,
          text: instruction.text || instruction.name || '注记',
          name: instruction.name,
          color: instruction.color
        });
        break;
      case 'addLine':
        viewer.drawAiLine({
          id: instruction.id,
          name: instruction.name,
          color: instruction.color,
          positions: instruction.positions!
        });
        break;
      case 'addPolygon':
        viewer.drawAiPolygon({
          id: instruction.id,
          name: instruction.name,
          color: instruction.color,
          positions: instruction.positions!
        });
        break;
      case 'remove':
        viewer.removeAiOverlay(instruction.id!);
        break;
      case 'clear':
        viewer.clearAiOverlays();
        break;
      case 'flyTo':
        viewer.flyToLocation(instruction.lon!, instruction.lat!, instruction.height ?? 6000, 1.2);
        break;
    }
  } catch (e) {
    console.error('[planning] 标绘指令执行失败：', instruction, e);
    window.$message?.error(`标绘指令执行失败（${instruction.action}），请查看控制台`);
  }
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

  const stepDefs: StepDefinition[] = planningRouteAnalysisSteps.map(step => ({
    key: step.id,
    label: step.label,
    run: async ({ wait }) => {
      // 步骤0：实际调用知识库检索
      if (step.label === '知识库检索') {
        const query = `${routeSettingsForm.value.startName} ${routeSettingsForm.value.endName} 机动路线规划`;
        const results = runKnowledgeRetrieval(query);
        const docCount = results.length;
        const topDocs = results.slice(0, 3).map(r => r.document.name);
        const chunkCount = results.reduce((s, r) => s + r.matches.length, 0);
        routeKnowledgeHits.value = { docCount, chunkCount, docNames: topDocs };
        routeStatusText.value =
          docCount > 0
            ? `正在检索知识库... 命中 ${docCount} 篇文档（${topDocs.slice(0, 2).join('、')}），共 ${chunkCount} 条片段`
            : '正在检索知识库... 未命中相关文档，使用默认模板';
      } else {
        routeStatusText.value = getRouteStepText(step.label);
      }
      await wait(700);
    }
  }));

  await runAnalysis({
    steps: stepDefs,
    onChange: snapshot => {
      routeAnalysisSteps.value = snapshot.map(toPlanningStep);
      routeProgress.value = calcRouteProgress(snapshot);
    }
  });

  routeAnalysisSteps.value = planningRouteAnalysisSteps.map(step => ({ ...step, status: 'completed' }));
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
    constraints:
      (routeSettingsForm.value.advanceAreas ?? []).length > 0
        ? (routeSettingsForm.value.advanceAreas ?? [])
        : taskForm.value.constraints
  });

  setPlanningState('analyzing');
  try {
    await startPlanning();
    setPlanningState('done');
  } catch (e) {
    // 规划计算失败：方案结果不可用，按失败处理
    console.error('[planning] 路线规划计算失败：', e);
    setPlanningState('idle');
    window.$message?.error('路线规划失败');
  }

  // 地图呈现（独立处理）：绘图方法缺失/异常不应让整个规划流程报失败，
  // 方案卡片与推荐结果照常产出
  try {
    viewerRef.value?.revealRoutes(currentRoute.value);
    viewerRef.value?.setStartPoint(
      routeSettingsForm.value.startLongitude,
      routeSettingsForm.value.startLatitude,
      routeSettingsForm.value.startName
    );
    viewerRef.value?.setEndPoint(
      routeSettingsForm.value.endLongitude,
      routeSettingsForm.value.endLatitude,
      routeSettingsForm.value.endName
    );

    // 事件排除后的重新规划：只保留未受影响的路线，推荐优先级 路线一→路线二→路线三
    const remaining = (['route-a', 'route-b', 'route-c'] as PlanningRouteKey[]).filter(
      k => !excludedRouteKeys.value.includes(k)
    );
    const recommendedRoute = remaining[0] ?? 'route-a';
    setCurrentRoute(recommendedRoute);
    viewerRef.value?.setExcludedRoutes(excludedRouteKeys.value, recommendedRoute);
    viewerRef.value?.showRoute(recommendedRoute);
    selectedRouteCard.value = `route-card-${recommendedRoute}`;
    recommendedRouteCard.value = `route-card-${recommendedRoute}`;
  } catch (e) {
    console.warn('[planning] 地图呈现异常（方案结果不受影响）：', e);
  }

  routeStatusText.value =
    excludedRouteKeys.value.length > 0
      ? `分析完成，已排除 ${excludedRouteKeys.value.map(k => ROUTE_LABELS[`route-card-${k}`]).join('、')}，推荐剩余路线`
      : '分析完成，已生成3条推荐方案';
  window.$message?.success('机动路线规划完成');

  // 分析完成后再打开底部结果面板
  bottomPanelVisible.value = true;
  bottomPanelCollapsed.value = false;
  routeRunning.value = false;
  // 衔接智能体面板：注入系统消息
  agentNotice.value = `已完成机动规划分析，生成候选路线方案，可打开"场景智能体"向我提问（如"路线一为什么推荐"）。`;
}

function getRouteStepText(label: string): string {
  const map: Record<string, string> = {
    路网数据解析: '正在解析路网数据...',
    障碍识别分析: '正在识别障碍区域...',
    交通状况评估: '正在评估交通状况...',
    多路径规划: '正在规划多条候选路径...',
    路线风险评估: '正在评估路线风险...',
    方案优化排序: '正在优化排序方案...',
    结果输出: '正在整理输出结果...'
  };
  return map[label] || '处理中...';
}

/** 编排器步骤状态 → 路线规划 UI 步骤模型（对齐状态枚举并保留 icon） */
function toPlanningStep(s: StepState): PlanningAnalysisStep {
  const src = planningRouteAnalysisSteps.find(p => p.id === s.key);
  return {
    id: s.key,
    label: src?.label ?? s.label,
    icon: src?.icon ?? 'mdi:circle-outline',
    status: s.status === 'success' ? 'completed' : s.status === 'running' ? 'running' : 'pending'
  };
}

/** 与原实现一致：按「当前进行到的步序」计算进度，上限 95%（100% 留到全部收尾后再置） */
function calcRouteProgress(snapshot: StepState[]): number {
  const runningIdx = snapshot.findIndex(s => s.status === 'running');
  const done = snapshot.filter(s => s.status === 'success').length;
  const current = runningIdx >= 0 ? runningIdx + 1 : done;
  return Math.min(95, Math.round((current / snapshot.length) * 100));
}

// ──── 表单更新 ────
function handleRouteSettingsUpdate(form: PlanningRouteSettingsForm) {
  routeSettingsForm.value = form;
}

// ──── 图层管理（与渡河保障一致：矢量图层 + 数据服务） ────
const vectorLayers = ref<VectorLayerItem[]>([]);
const vectorLoading = ref(false);

async function loadVectorLayerList() {
  vectorLoading.value = true;
  try {
    const { data } = await fetchVectorPage({ page: 1, size: 200 });
    const list = data?.list ?? [];
    vectorLayers.value = list.map((item: any) => ({
      key: `vector-${item.id}`,
      id: String(item.id),
      label: item.vectorName || '未命名图层',
      sourceType: item.sourceType || 'GeoJSON',
      featureCount: Number(item.featureCount) || 0,
      visible: false
    }));
  } catch {
    vectorLayers.value = [];
  } finally {
    vectorLoading.value = false;
  }
}

onMounted(() => {
  loadVectorLayerList();
});

const serviceHandles = computed<ServiceLayerHandle[]>(() => viewerRef.value?.serviceHandles ?? []);

function handleToggleVector(layerId: string) {
  const layer = vectorLayers.value.find(l => l.id === layerId);
  if (!layer) return;
  layer.visible = !layer.visible;
  const viewer = viewerRef.value;
  if (layer.visible) {
    viewer?.loadVectorLayer(layerId, layer.label, layer.sourceType);
  } else {
    viewer?.setVectorLayerVisible(layerId, false);
  }
}

function handleToggleService(id: number, visible: boolean) {
  viewerRef.value?.toggleService(id, visible);
}

function handleRemoveService(id: number) {
  viewerRef.value?.removeService(id);
}

function handleReorderService(fromIndex: number, toIndex: number) {
  viewerRef.value?.reorderService(fromIndex, toIndex);
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
  const routeKey = key.replace('route-card-', '') as PlanningRouteKey;
  setCurrentRoute(routeKey);
  viewerRef.value?.showRoute(routeKey);
  window.$message?.info(`已切换到${ROUTE_LABELS[key] ?? key}`);
}

// ──── 环境变化注入 / 重新规划 / 标绘 ────
/**
 * 事件注入：记录受影响路线（去重），不立即改动方案卡片与地图标绘。
 * 统一等用户发出"重新规划路线"指令后，在 handleRoutePlan 收尾阶段一次性过滤方案并隐藏路线。
 */
function handleRoutesExcluded(excluded: PlanningRouteKey[]) {
  excludedRouteKeys.value = Array.from(new Set([...excludedRouteKeys.value, ...excluded])) as PlanningRouteKey[];
  window.$message?.warning('情况已记录，重新规划时将避开受影响的路线');
}

/** AI 助手"重新规划路线"指令 -> 重新执行规划并应用事件排除 */
function handleGenerateRoute() {
  if (routeRunning.value) {
    window.$message?.warning('正在规划中，请稍候');
    return;
  }
  void handleRoutePlan();
}

/** 事件/点名标绘 -> 地图标绘并定位（AI 标绘层，同 id 重复标绘自动覆盖） */
function handleRouteSituationPlot(plot: RouteSituationPlot) {
  const viewer = viewerRef.value;
  if (!viewer) return;
  viewer.drawAiMark({ id: plot.id, lon: plot.lon, lat: plot.lat, name: plot.label, color: plot.color });
  viewer.flyToLocation(plot.lon, plot.lat, 5000, 1.2);
}

// ──── 右侧工具栏 ────
const activeRightTool = ref<string | null>(null);
const is2dMode = ref(false);

function handleLayerClose() {
  layerPanelVisible.value = false;
  activeRightTool.value = null;
}

function handleToggleLayerPanel() {
  if (layerPanelVisible.value) {
    layerCollapsed.value = !layerCollapsed.value;
  } else {
    layerPanelVisible.value = true;
    layerCollapsed.value = false;
  }
}

function handleRightToolSelect(key: string) {
  switch (key) {
    case 'layers':
      handleToggleLayerPanel();
      activeRightTool.value = layerPanelVisible.value ? key : null;
      return;
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

// AI 助手面板的提问由面板自身流式应答（知识命中亦在面板内展示），父页面不再弹 toast
</script>

<template>
  <div class="planning-page">
    <div class="planning-stage">
      <PlanningViewer ref="viewerRef" @ready="handleViewerReady" @point-picked="handlePointPicked" />

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
              :class="{ 'side-btn--active': agentPanelVisible }"
              @click="toggleAgentPanel"
            >
              <SvgIcon icon="mdi:robot" />
            </button>
          </template>
          <span>场景智能体</span>
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
            { key: 'layers', label: '图层管理', icon: 'mdi:layers-outline' },
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
        <ScenePanel v-if="leftPanelVisible" class="floating-panel left-panel" :style="leftDrag.style.value">
          <template #header>
            <div class="panel-drag-handle" @mousedown="leftDrag.onDragStart">
              <span class="drag-dots">⋮⋮</span>
              <span class="drag-label">机动规划</span>
              <button type="button" class="panel-close-btn" @click.stop="leftPanelVisible = false">
                <SvgIcon icon="mdi:close" />
              </button>
            </div>
          </template>

          <!-- 面板内容 -->
          <div class="panel-body">
            <PlanningRouteSettingsPanel
              :form="routeSettingsForm"
              :running="routeRunning"
              :pick-mode-label="
                planningState === 'picking-start' ? '选取起点' : planningState === 'picking-end' ? '选取终点' : '待规划'
              "
              @plan="handleRoutePlan"
              @update-form="handleRouteSettingsUpdate"
              @pick-start="handlePickStart"
              @pick-end="handlePickEnd"
            />
          </div>
        </ScenePanel>
      </Transition>

      <!-- ══════ 右侧AI助手面板（可拖拽/关闭） ══════ -->
      <Transition name="panel-slide-right">
        <ScenePanel v-if="rightPanelVisible" class="floating-panel right-panel" :style="rightDrag.style.value">
          <template #header>
            <div class="panel-drag-handle" @mousedown="rightDrag.onDragStart">
              <span class="drag-dots">⋮⋮</span>
              <span class="drag-label">AI助手</span>
              <button type="button" class="panel-close-btn" @click.stop="rightPanelVisible = false">
                <SvgIcon icon="mdi:close" />
              </button>
            </div>
          </template>

          <!-- AI面板内容 -->
          <PlanningRouteAiPanel
            :collapsed="rightPanelCollapsed"
            :running="routeRunning"
            :steps="routeAnalysisSteps"
            :progress="routeProgress"
            :status-text="routeStatusText"
            :knowledge-hits="routeKnowledgeHits"
            :form="routeSettingsForm"
            @toggle-collapse="handleRightPanelCollapse"
            @routes-excluded="handleRoutesExcluded"
            @generate-route="handleGenerateRoute"
            @plot="handleRouteSituationPlot"
          />
        </ScenePanel>
      </Transition>

      <!-- ══════ 右侧：场景智能体面板 ══════ -->
      <Transition name="panel-slide-right">
        <ScenePanel
          v-if="agentPanelVisible"
          class="floating-panel right-panel agent-panel-wrapper"
          :style="agentPanelStyle"
        >
          <template #header>
            <div class="panel-drag-handle" @mousedown="agentDrag.onDragStart">
              <span class="drag-dots">⋮⋮</span>
              <span class="drag-label">场景智能体</span>
              <button type="button" class="panel-close-btn" @click.stop="handleAgentClose">
                <SvgIcon icon="mdi:close" />
              </button>
            </div>
          </template>
          <AgentChatPanel
            :collapsed="agentCollapsed"
            title="场景智能体"
            :app-id="agentAppId"
            :context="agentContext"
            :notice="agentNotice"
            welcome-text="您好，我是机动规划场景的智能参谋。可以结合当前任务回答专业问题；也可以用自然语言下达标绘指令，例如「关渡大桥拥堵了，标出来」。"
            :capabilities="['知识库问答', '路线标绘', '方案解读']"
            @toggle-collapse="agentCollapsed = !agentCollapsed"
            @close="handleAgentClose"
            @plot-instruction="handlePlotInstruction"
          />
          <button type="button" class="resize-handle" title="拖拽调整大小" @mousedown="agentResize.onResizeStart" />
        </ScenePanel>
      </Transition>

      <!-- ══════ 图层面板（与渡河保障一致的图层管理） ══════ -->
      <Transition name="panel-slide-right">
        <ScenePanel v-if="layerPanelVisible" class="floating-panel layer-panel-wrapper" :style="layerDrag.style.value">
          <template #header>
            <div class="panel-drag-handle" @mousedown="layerDrag.onDragStart">
              <span class="drag-dots">⋮⋮</span>
              <span class="drag-label">图层面板</span>
              <button type="button" class="panel-close-btn" @click.stop="handleLayerClose">
                <SvgIcon icon="mdi:close" />
              </button>
            </div>
          </template>
          <MapLayerPanel
            :collapsed="layerCollapsed"
            :vector-layers="vectorLayers"
            :vector-loading="vectorLoading"
            :service-handles="serviceHandles"
            @toggle-vector="handleToggleVector"
            @toggle-service="handleToggleService"
            @remove-service="handleRemoveService"
            @reorder-service="handleReorderService"
            @toggle-collapse="layerCollapsed = !layerCollapsed"
            @close="handleLayerClose"
          />
        </ScenePanel>
      </Transition>

      <!-- ══════ 中间结果面板（可拖拽/关闭） ══════ -->
      <Transition name="panel-slide-center">
        <ScenePanel v-if="bottomPanelVisible" class="floating-panel bottom-panel" :style="bottomDrag.style.value">
          <template #header>
            <div class="panel-drag-handle bottom-drag-handle" @mousedown="bottomDrag.onDragStart">
              <span class="drag-dots">⋮⋮</span>
              <span class="drag-label">方案推荐</span>
              <button type="button" class="panel-close-btn" @click.stop="bottomPanelVisible = false">
                <SvgIcon icon="mdi:close" />
              </button>
            </div>
          </template>

          <!-- 结果面板内容 -->
          <PlanningRouteResultBar
            :collapsed="bottomPanelCollapsed"
            :selected-key="selectedRouteCard"
            :cards="visibleRouteCards"
            @toggle-collapse="handleBottomPanelCollapse"
            @select="handleRouteCardSelect"
          />
        </ScenePanel>
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
  width: 380px;
  max-height: calc(100vh - 144px);
}

.layer-panel-wrapper {
  width: 360px;
  max-height: calc(100vh - 36px);
}

/* ──── 拖拽手柄 ──── */
.panel-drag-handle {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  font-size: 12px;
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
  font-size: 12px;
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

/* ──── 面板内容 ──── */
.panel-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
.left-panel :deep(.route-settings) {
  width: 100% !important;
  border: none !important;
  background: transparent !important;
  backdrop-filter: none !important;
  border-radius: 0 !important;
}

.right-panel :deep(.route-ai-panel) {
  width: 100% !important;
  border: none !important;
  background: transparent !important;
  backdrop-filter: none !important;
  border-radius: 0 !important;
}

.right-panel :deep(.agent-chat-panel) {
  flex: 1;
  min-height: 0;
  border: none !important;
  border-radius: 0 !important;
}

.resize-handle {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  border: none;
  background: transparent;
  z-index: 5;
}

.resize-handle::after {
  content: '';
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 9px;
  height: 9px;
  border-right: 2px solid rgba(255, 255, 255, 0.4);
  border-bottom: 2px solid rgba(255, 255, 255, 0.4);
  border-bottom-right-radius: 2px;
}

.bottom-panel :deep(.route-result-bar) {
  width: 100% !important;
  border: none !important;
  background: transparent !important;
  backdrop-filter: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}

.layer-panel-wrapper :deep(.layer-panel) {
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

.panel-slide-center-enter-active,
.panel-slide-center-leave-active {
  transition:
    transform 0.28s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.28s ease;
}

.panel-slide-center-enter-from {
  transform: scale(0.92);
  opacity: 0;
}

.panel-slide-center-leave-to {
  transform: scale(0.92);
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
    width: 340px;
  }

  .layer-panel-wrapper {
    width: 320px;
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
    width: calc(100vw - 72px);
    max-width: 380px;
  }

  .layer-panel-wrapper {
    width: calc(100vw - 72px);
    max-width: 360px;
  }
}
</style>
