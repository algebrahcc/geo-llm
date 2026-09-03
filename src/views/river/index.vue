<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { calculateConfidence, calculateCrossingPlans } from '@/utils/crossing-engineer';
import { runKnowledgeRetrieval, type KnowledgeRetrievalResult } from '@/mock/knowledge';
import { aiAnalysisStepTemplate, crossingPlanCards, defaultCrossingSettingForm } from '@/mock/river';
import { fetchVectorPage } from '@/service/api/vector';
import type { ServiceLayerHandle } from '@/composables/cesium/service-loader';
import RiverAiAssistantPanel from './modules/river-ai-assistant-panel.vue';
import RiverResultBar from './modules/river-result-bar.vue';
import RiverSettingPanel from './modules/river-setting-panel.vue';
import SceneToolbar from '@/components/common/scene-toolbar.vue';
import type { SceneToolbarItem } from '@/components/common/scene-toolbar.vue';
import RiverViewer from './modules/river-viewer.vue';
import { useDraggable } from '@/composables/use-draggable';
import MapLayerPanel, { type VectorLayerItem } from '@/components/cesium/map-layer-panel.vue';
import type {
  AiAnalysisStep,
  CrossingPlanCard,
  CrossingSettingForm,
  KnowledgeHitDisplay,
  RejectedRouteData,
  RiverPlanKey
} from './modules/types';

defineOptions({
  name: 'RiverPage'
});

// ──── Viewer 引用 ────
interface ViewerExpose {
  initMapOverlays: () => void;
  resetView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  rotate: () => void;
  pitch: () => void;
  exportScreenshot: () => void;
  toggleViewMode: () => void;
  loadVectorLayer: (id: string, name: string, sourceType?: string) => Promise<void>;
  flyToVector: (id: string, name?: string) => Promise<void>;
  setVectorLayerVisible: (id: string, show: boolean) => void;
  showPlan: (planKey: RiverPlanKey) => void;
  /** 淘汰方式路线（常驻弱化显示 / 聚焦查看） */
  showRejectedRoutes: (routes: RejectedRouteData[]) => void;
  clearRejectedEntities: () => void;
  focusRejectedRoute: (id: string) => void;
  /** 数据服务（阶段二） */
  serviceHandles: ServiceLayerHandle[];
  toggleService: (id: number, visible: boolean) => void;
  removeService: (id: number) => void;
  setServiceOpacity: (id: number, opacity: number) => void;
  reorderService: (fromIndex: number, toIndex: number) => void;
}

const viewerRef = ref<ViewerExpose | null>(null);
const router = useRouter();

// ──── 面板可见性 ────
const settingVisible = ref(true);
const aiPanelVisible = ref(false);
const resultVisible = ref(false);
const layerPanelVisible = ref(false);

// ──── 面板折叠 ────
const settingCollapsed = ref(false);
const aiCollapsed = ref(false);
const resultCollapsed = ref(false);
const layerCollapsed = ref(false);

// ──── 面板拖拽 ────
const settingDrag = useDraggable({ anchor: 'left', initialX: 72, initialY: 72 });
const aiDrag = useDraggable({ anchor: 'right', initialX: 18, initialY: 18 });
// 结果面板：中间偏右竖向浮动面板（参考路线规划页）
const resultDrag = useDraggable({ anchor: 'right', initialX: 460, initialY: 72 });
const layerDrag = useDraggable({ anchor: 'right', initialX: 72, initialY: 18 });

// ──── 表单数据 ────
const settingForm = ref<CrossingSettingForm>({ ...defaultCrossingSettingForm });

// ──── AI 分析状态 ────
const analysisRunning = ref(false);
const analysisSteps = ref<AiAnalysisStep[]>([]);
const knowledgeHits = ref<KnowledgeHitDisplay[]>([]);
const references = ref<string[]>([]);
const planCards = ref<CrossingPlanCard[]>([]);
const confidence = ref(0);
const rejectedWays = ref<RejectedRouteData[]>([]);
const activeRejectedId = ref<string | null>(null);

// ──── 当前标绘方案 ────
const activePlanKey = ref<RiverPlanKey>('plan-a');

// ──── 智能体信息 ────
const agentInfo = { status: 'online' as const };

// ──── 矢量图层（真实数据） ────
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

// ──── 图层切换 ────
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

// ──── 数据服务（阶段二） ────
const serviceHandles = computed<ServiceLayerHandle[]>(() => viewerRef.value?.serviceHandles ?? []);

function handleToggleService(id: number, visible: boolean) {
  viewerRef.value?.toggleService(id, visible);
}

function handleRemoveService(id: number) {
  viewerRef.value?.removeService(id);
}

function handleOpacityService(id: number, opacity: number) {
  viewerRef.value?.setServiceOpacity(id, opacity);
}

function handleReorderService(fromIndex: number, toIndex: number) {
  viewerRef.value?.reorderService(fromIndex, toIndex);
}

// ──── 图层双击定位 ────
function handleFlyService(id: number) {
  serviceHandles.value.find(h => h.id === id)?.flyTo?.();
}

function handleFlyVector(layerId: string) {
  const layer = vectorLayers.value.find(l => l.id === layerId);
  void viewerRef.value?.flyToVector(layerId, layer?.label);
}

// ──── 右侧工具栏 ────
const activeRightTool = ref<string | null>(null);
const is2dMode = ref(false);
const rightTools: readonly SceneToolbarItem[] = [
  { key: 'layers', label: '图层管理', icon: 'mdi:layers-outline' },
  { key: 'reset', label: '复位', icon: 'mdi:home-outline' },
  { key: 'pitch', label: '俯仰', icon: 'mdi:axis-arrow' },
  { key: 'rotate', label: '旋转', icon: 'mdi:rotate-orbit' },
  { key: 'zoom-in', label: '放大', icon: 'mdi:magnify-plus-outline' },
  { key: 'zoom-out', label: '缩小', icon: 'mdi:magnify-minus-outline' },
  { key: 'screenshot', label: '截图', icon: 'mdi:camera-outline' }
];

// ──── 表单更新 ────
function handleFormUpdate(form: CrossingSettingForm) {
  settingForm.value = form;
}

// ──── 核心流程：提交给AI智能分析 ────
async function handleSubmitAnalysis() {
  if (analysisRunning.value) return;
  analysisRunning.value = true;

  aiPanelVisible.value = true;
  aiCollapsed.value = false;

  analysisSteps.value = aiAnalysisStepTemplate.map(s => ({ ...s, status: 'waiting' as const }));
  knowledgeHits.value = [];
  references.value = [];
  planCards.value = [];
  confidence.value = 0;

  const form = settingForm.value;

  // ── 阶段 1：环境参数解析（约 6s） ──
  await runStep(0, '解析河宽、水深、流速、地形等环境参数', 2000);

  // ── 阶段 2：知识库检索（约 8s） ──
  analysisSteps.value[1].status = 'running';
  analysisSteps.value[1].description = '构建检索关键词并匹配历史案例';
  const step2Start = Date.now();
  await delay(1500);
  analysisSteps.value[1].description = '执行混合检索（BM25 + 向量召回）';
  await delay(800);

  const query = `${form.taskType} ${form.riverWidth}m ${form.flowVelocity} ${form.waterDepthRange} ${form.riverbedTerrain} ${form.availableResources.join(' ')}`;
  const retrievalResults: KnowledgeRetrievalResult[] = runKnowledgeRetrieval(query);
  const totalHits = retrievalResults.reduce((sum, r) => sum + r.matches.length, 0);
  const hitDocCount = retrievalResults.length;

  knowledgeHits.value = retrievalResults.map(r => ({
    documentName: r.document.name,
    documentCategory: '',
    documentFormat: r.document.format,
    matchCount: r.matches.length,
    topSnippets: r.matches.slice(0, 3).map(m => ({
      chunkTitle: m.chunkTitle,
      snippet: m.snippet,
      score: m.score
    }))
  }));

  const retrieveDesc =
    totalHits > 0 ? `命中 ${hitDocCount} 篇文档、${totalHits} 条 chunk` : '未命中相关文档，使用默认知识模板';

  await delay(700);
  analysisSteps.value[1].status = 'success';
  analysisSteps.value[1].description = retrieveDesc;
  analysisSteps.value[1].duration = `${((Date.now() - step2Start) / 1000).toFixed(1)}s`;

  references.value =
    totalHits > 0
      ? [...retrievalResults.slice(0, 3).map(r => r.document.name), '运行模板', '智能体默认配置']
      : ['无相关命中文档', '运行模板', '智能体默认配置'];

  // ── 阶段 3：渡场点与路线分析（约 7s） ──
  await runStep(2, '基于知识库匹配结果选择最优渡场点，规划进出路线', 2500);

  // ── 阶段 4：方案计算与评估（约 9s） ──
  analysisSteps.value[3].status = 'running';
  analysisSteps.value[3].description = '计算各渡河方式的可行性与耗时';
  const step4Start = Date.now();
  await delay(600);
  analysisSteps.value[3].description = '校验水文约束与资源适配性';
  await delay(1700);

  // 数据完整度用于置信度计算；方案固定使用三套预设方案，不做淘汰
  const { dataCompleteness } = calculateCrossingPlans(form);
  analysisSteps.value[3].description = `生成 ${crossingPlanCards.length} 项可行方案`;
  await delay(1200);
  analysisSteps.value[3].status = 'success';
  analysisSteps.value[3].duration = `${((Date.now() - step4Start) / 1000).toFixed(1)}s`;

  // ── 阶段 5：综合评分推荐（约 5s） ──
  analysisSteps.value[4].status = 'running';
  analysisSteps.value[4].description = '综合时效性、安全性、资源消耗加权评分';
  const step5Start = Date.now();
  await delay(1000);

  const conf = calculateConfidence(dataCompleteness, totalHits, 85);
  confidence.value = conf;
  planCards.value = [...crossingPlanCards];

  analysisSteps.value[4].status = 'success';
  analysisSteps.value[4].description = `推荐方案一，置信度 ${conf}%`;
  analysisSteps.value[4].duration = `${((Date.now() - step5Start) / 1000).toFixed(1)}s`;

  resultVisible.value = true;
  resultCollapsed.value = false;

  viewerRef.value?.initMapOverlays();
  const recommended = crossingPlanCards.find(p => p.isRecommended) ?? crossingPlanCards[0];
  if (recommended) {
    activePlanKey.value = recommended.key;
    viewerRef.value?.showPlan(recommended.key);
  }

  analysisRunning.value = false;
  window.$message?.success('AI 智能分析完成，已生成渡河保障方案');
}

async function runStep(index: number, description: string, durationMs: number = 800) {
  analysisSteps.value[index].status = 'running';
  analysisSteps.value[index].description = description;
  const start = Date.now();
  await delay(durationMs);
  analysisSteps.value[index].status = 'success';
  analysisSteps.value[index].duration = `${((Date.now() - start) / 1000).toFixed(1)}s`;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function handleSettingClose() {
  settingVisible.value = false;
}

// ──── 方案切换：重绘标绘路线（淘汰路线保持常驻） ────
function handlePlanSelect(planKey: RiverPlanKey) {
  if (planKey === activePlanKey.value && !activeRejectedId.value) return;
  activeRejectedId.value = null;
  activePlanKey.value = planKey;
  viewerRef.value?.showPlan(planKey);
}

// ──── 淘汰方式点击：聚焦查看其路线（可行方案路线保留） ────
function handleRejectedSelect(id: string) {
  if (activeRejectedId.value === id) {
    activeRejectedId.value = null;
    return;
  }
  activeRejectedId.value = id;
  viewerRef.value?.focusRejectedRoute(id);
}
function handleAiClose() {
  aiPanelVisible.value = false;
}
function handleResultClose() {
  resultVisible.value = false;
}

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
  const viewer = viewerRef.value;
  switch (key) {
    case 'layers':
      handleToggleLayerPanel();
      activeRightTool.value = layerPanelVisible.value ? key : null;
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
    case 'screenshot':
      viewer?.exportScreenshot?.();
      return;
    default:
      activeRightTool.value = key;
      return;
  }
}

function handleToggle2d3d() {
  viewerRef.value?.toggleViewMode?.();
  is2dMode.value = !is2dMode.value;
}

function handleBackToMain() {
  void router.push({ name: 'screen' });
}

function handleToggleSetting() {
  if (settingVisible.value) settingCollapsed.value = !settingCollapsed.value;
  else {
    settingVisible.value = true;
    settingCollapsed.value = false;
  }
}

function handleToggleAiPanel() {
  if (aiPanelVisible.value) aiCollapsed.value = !aiCollapsed.value;
  else {
    aiPanelVisible.value = true;
    aiCollapsed.value = false;
  }
}

function handleToggleResult() {
  if (resultVisible.value) resultCollapsed.value = !resultCollapsed.value;
  else {
    resultVisible.value = true;
    resultCollapsed.value = false;
  }
}
</script>

<template>
  <div class="river-page">
    <div class="river-stage">
      <RiverViewer ref="viewerRef" />

      <!-- ══════ 左侧按钮组 ══════ -->
      <div class="left-buttons">
        <NTooltip placement="right">
          <template #trigger>
            <button type="button" class="side-btn" @click="handleBackToMain">
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
              :class="{ 'side-btn--active': settingVisible && !settingCollapsed }"
              @click="handleToggleSetting"
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
              :class="{ 'side-btn--active': aiPanelVisible && !aiCollapsed }"
              @click="handleToggleAiPanel"
            >
              <SvgIcon icon="mdi:robot" />
            </button>
          </template>
          <span>AI 助手</span>
        </NTooltip>

        <NTooltip placement="right">
          <template #trigger>
            <button
              type="button"
              class="side-btn"
              :class="{ 'side-btn--active': resultVisible && !resultCollapsed }"
              @click="handleToggleResult"
            >
              <SvgIcon icon="mdi:trophy-outline" />
            </button>
          </template>
          <span>方案结果</span>
        </NTooltip>
      </div>

      <!-- ══════ 左侧：设置面板 ══════ -->
      <Transition name="panel-slide-left">
        <div v-if="settingVisible" class="side-panel left-panel" :style="settingDrag.style.value">
          <div class="panel-drag-handle" @mousedown="settingDrag.onDragStart">
            <span class="drag-dots">⋮⋮</span>
            <span>设置面板</span>
          </div>
          <RiverSettingPanel
            :form="settingForm"
            :collapsed="settingCollapsed"
            :running="analysisRunning"
            @update-form="handleFormUpdate"
            @submit="handleSubmitAnalysis"
            @toggle-collapse="settingCollapsed = !settingCollapsed"
            @close="handleSettingClose"
          />
        </div>
      </Transition>

      <!-- ══════ 右侧：图层面板 ══════ -->
      <Transition name="panel-slide-right">
        <div v-if="layerPanelVisible" class="side-panel layer-panel-wrapper" :style="layerDrag.style.value">
          <div class="panel-drag-handle" @mousedown="layerDrag.onDragStart">
            <span class="drag-dots">⋮⋮</span>
            <span>图层面板</span>
          </div>
          <MapLayerPanel
            :collapsed="layerCollapsed"
            :vector-layers="vectorLayers"
            :vector-loading="vectorLoading"
            :service-handles="serviceHandles"
            @toggle-vector="handleToggleVector"
            @toggle-service="handleToggleService"
            @remove-service="handleRemoveService"
            @opacity-service="handleOpacityService"
            @reorder-service="handleReorderService"
            @fly-service="handleFlyService"
            @fly-vector="handleFlyVector"
            @toggle-collapse="layerCollapsed = !layerCollapsed"
            @close="handleLayerClose"
          />
        </div>
      </Transition>

      <!-- ══════ 右侧：AI 助手面板 ══════ -->
      <Transition name="panel-slide-right">
        <div v-if="aiPanelVisible" class="side-panel ai-panel-wrapper" :style="aiDrag.style.value">
          <div class="panel-drag-handle" @mousedown="aiDrag.onDragStart">
            <span class="drag-dots">⋮⋮</span>
            <span>AI 助手</span>
          </div>
          <RiverAiAssistantPanel
            :form="settingForm"
            :collapsed="aiCollapsed"
            :running="analysisRunning"
            :steps="analysisSteps"
            :knowledge-hits="knowledgeHits"
            :references="references"
            :agent-online="agentInfo.status === 'online' || agentInfo.status === 'busy'"
            @toggle-collapse="aiCollapsed = !aiCollapsed"
            @close="handleAiClose"
            @setting-close="handleSettingClose"
          />
        </div>
      </Transition>

      <!-- ══════ 中部：方案结果面板（竖向浮动） ══════ -->
      <Transition name="panel-slide-right">
        <div v-if="resultVisible" class="result-panel" :style="resultDrag.style.value">
          <div class="panel-drag-handle" @mousedown="resultDrag.onDragStart">
            <span class="drag-dots">⠿</span>
            <span>方案结果</span>
          </div>
          <RiverResultBar
            :collapsed="resultCollapsed"
            :plans="planCards"
            :confidence="confidence"
            :active-key="activePlanKey"
            :rejected="rejectedWays"
            :active-rejected-id="activeRejectedId"
            @select="handlePlanSelect"
            @select-rejected="handleRejectedSelect"
            @toggle-collapse="resultCollapsed = !resultCollapsed"
            @close="handleResultClose"
          />
        </div>
      </Transition>

      <!-- ══════ 右侧工具栏 ══════ -->
      <div class="right-side">
        <SceneToolbar
          placement="right"
          :items="rightTools"
          :is-2d-mode="is2dMode"
          :active-key="activeRightTool"
          @select="handleRightToolSelect"
          @toggle-2d3d="handleToggle2d3d"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.river-page {
  height: 100%;
  background: #0a101e;
  position: relative;
}
.river-stage {
  position: relative;
  height: 100%;
  overflow: hidden;
}

.left-buttons {
  position: absolute;
  top: 18px;
  left: 18px;
  z-index: 25;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.side-btn {
  display: flex;
  height: 42px;
  width: 42px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(12, 18, 30, 0.92);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  font-size: 17px;
  transition:
    border-color 0.15s,
    background 0.15s;
}
.side-btn:hover {
  border-color: rgba(94, 164, 255, 0.3);
  background: rgba(20, 30, 50, 0.95);
}
.side-btn--active {
  border-color: rgba(94, 164, 255, 0.5);
  background: rgba(59, 130, 246, 0.1);
}

.right-side {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 20;
}

.side-panel {
  position: fixed;
  width: 380px;
  max-height: calc(100vh - 36px);
  display: flex;
  flex-direction: column;
  background: #0e1626;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  z-index: 21;
}
.ai-panel-wrapper {
  width: 420px;
}
.layer-panel-wrapper {
  width: 360px;
}

.result-panel {
  position: fixed;
  width: 380px;
  max-width: 420px;
  max-height: 76vh;
  display: flex;
  flex-direction: column;
  background: #0e1626;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  z-index: 21;
  transition: max-height 0.25s;
}

.panel-drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 22px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.02);
  cursor: grab;
  user-select: none;
  flex-shrink: 0;
  letter-spacing: 0.04em;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.panel-drag-handle:hover {
  color: rgba(255, 255, 255, 0.45);
  background: rgba(255, 255, 255, 0.03);
}
.panel-drag-handle:active {
  cursor: grabbing;
}
.drag-dots {
  font-size: 14px;
  line-height: 1;
  letter-spacing: 2px;
}

.left-panel :deep(.setting-panel),
.layer-panel-wrapper :deep(.layer-panel),
.ai-panel-wrapper :deep(.ai-panel),
.result-panel :deep(.result-bar) {
  width: 100% !important;
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}
.result-panel :deep(.result-bar) {
  height: 100%;
}
.result-panel :deep(.bar-content) {
  flex: 1 1 auto;
  min-height: 0;
}
@media (min-height: 900px) {
  .result-panel {
    max-height: 76vh;
  }
}

.panel-slide-left-enter-active,
.panel-slide-right-enter-active,
.panel-slide-up-enter-active {
  transition: all 0.2s ease-out;
}
.panel-slide-left-leave-active,
.panel-slide-right-leave-active,
.panel-slide-up-leave-active {
  transition: all 0.15s ease-in;
}
.panel-slide-left-enter-from {
  transform: translateX(-24px);
  opacity: 0;
}
.panel-slide-left-leave-to {
  transform: translateX(-16px);
  opacity: 0;
}
.panel-slide-right-enter-from {
  transform: translateX(24px);
  opacity: 0;
}
.panel-slide-right-leave-to {
  transform: translateX(16px);
  opacity: 0;
}
.panel-slide-up-enter-from {
  transform: translateY(20px);
  opacity: 0;
}
.panel-slide-up-leave-to {
  transform: translateY(12px);
  opacity: 0;
}

@media (max-width: 1280px) {
  .side-panel {
    width: 340px;
  }
  .ai-panel-wrapper {
    width: 380px;
  }
  .layer-panel-wrapper {
    width: 320px;
  }
}
</style>
