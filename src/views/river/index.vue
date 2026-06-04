<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { runKnowledgeRetrieval, type KnowledgeRetrievalResult } from '@/mock/knowledge';
import { getAgentByKey } from '@/mock/agent';
import {
  aiAnalysisStepTemplate,
  crossingPlanCards,
  defaultCrossingSettingForm,
  riverDefaultLayers,
  riverRightTools
} from '@/mock/river';
import RiverAiAssistantPanel from './modules/river-ai-assistant-panel.vue';
import RiverLayerPanel from './modules/river-layer-panel.vue';
import RiverResultBar from './modules/river-result-bar.vue';
import RiverSettingPanel from './modules/river-setting-panel.vue';
import RiverToolbar from './modules/river-toolbar.vue';
import RiverViewer from './modules/river-viewer.vue';
import { useDraggable } from './modules/use-draggable';
import type { LayerItem } from './modules/river-layer-panel.vue';
import type {
  AiAnalysisStep,
  CrossingPlanCard,
  CrossingSettingForm,
  KnowledgeHitDisplay,
  RiverToolKey
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
const resultDrag = useDraggable({ anchor: 'bottom', initialX: 200, initialY: 18 });
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

// ──── 智能体信息 ────
const agentInfo = getAgentByKey('river-support');

// ──── 图层状态 ────
const activeLayers = ref<LayerItem[]>(
  riverDefaultLayers.map(l => ({ ...l }))
);

function handleToggleLayer(key: string) {
  const layer = activeLayers.value.find(l => l.key === key);
  if (layer) {
    layer.visible = !layer.visible;
  }
}

// ──── 右侧工具栏 ────
const activeRightTool = ref<RiverToolKey | null>(null);

// ──── 表单更新 ────
function handleFormUpdate(form: CrossingSettingForm) {
  settingForm.value = form;
}

// ──── 核心流程：提交给AI智能分析 ────
async function handleSubmitAnalysis() {
  if (analysisRunning.value) return;
  analysisRunning.value = true;

  // 显示 AI 助手面板
  aiPanelVisible.value = true;
  aiCollapsed.value = false;

  // 初始化步骤
  analysisSteps.value = aiAnalysisStepTemplate.map(s => ({ ...s, status: 'waiting' as const }));
  knowledgeHits.value = [];
  references.value = [];
  planCards.value = [];
  confidence.value = 0;

  // 构建检索查询
  const query = `${settingForm.value.taskName} ${settingForm.value.location} ${settingForm.value.taskType} ${settingForm.value.forceScale} 渡河 水文`;

  // 步骤1：环境与水文条件分析
  await runStep(0, '分析河宽、水深、流速等环境参数');

  // 步骤2：知识库检索与匹配
  analysisSteps.value[1].status = 'running';
  await delay(600);

  const retrievalResults: KnowledgeRetrievalResult[] = runKnowledgeRetrieval(query);
  const totalHits = retrievalResults.reduce((sum, r) => sum + r.matches.length, 0);
  const hitDocCount = retrievalResults.length;

  // 构建知识库命中展示数据
  knowledgeHits.value = retrievalResults.map(r => ({
    documentName: r.document.name,
    documentCategory: r.document.category,
    documentFormat: r.document.format,
    matchCount: r.matches.length,
    topSnippets: r.matches.slice(0, 3).map(m => ({
      chunkTitle: m.chunkTitle,
      snippet: m.snippet,
      score: m.score
    }))
  }));

  const retrieveDesc = totalHits > 0
    ? `命中 ${hitDocCount} 篇文档、${totalHits} 条 chunk`
    : '未命中相关文档，使用默认知识模板';

  analysisSteps.value[1].status = 'success';
  analysisSteps.value[1].description = retrieveDesc;

  // 构建引用来源
  references.value = totalHits > 0
    ? [
        ...retrievalResults.slice(0, 3).map(r => r.document.name),
        '运行模板',
        '智能体默认配置'
      ]
    : ['无相关命中文档', '运行模板', '智能体默认配置'];

  // 步骤3：渡场点选择与路线分析
  await runStep(2, '基于知识库匹配结果选择最优渡场点与渡河路线');

  // 步骤4：风险评估与综合分析
  await runStep(3, '综合水文风险、装备适配性、时间约束进行评估');

  // 步骤5：首选方案推荐
  await runStep(4, '综合评分推荐最优方案');

  // 填充方案卡片
  planCards.value = [...crossingPlanCards];
  confidence.value = totalHits > 0 ? 89 : 80;

  // 显示底部结果面板
  resultVisible.value = true;
  resultCollapsed.value = false;

  // 加载地图标绘（通道线、集结区、路线、风险区、标记点）
  viewerRef.value?.initMapOverlays();

  analysisRunning.value = false;

  window.$message?.success('AI 智能分析完成，已生成渡河保障方案');
}

async function runStep(index: number, description: string) {
  analysisSteps.value[index].status = 'running';
  analysisSteps.value[index].description = description;
  await delay(700);
  analysisSteps.value[index].status = 'success';
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ──── 对话消息 ────
function handleSendMessage(msg: string) {
  // 简单模拟 AI 回复
  console.log('[AI助手] 收到用户消息:', msg);
}

// ──── 面板操作 ────
function handleSettingClose() {
  settingVisible.value = false;
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

// ──── 右侧工具栏 ────
function handleRightToolSelect(key: RiverToolKey) {
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
    default:
      activeRightTool.value = key;
      return;
  }
}

// ──── 返回主页 ────
function handleBackToMain() {
  void router.push({ name: 'screen' });
}

// ──── 切换设置面板 ────
function handleToggleSetting() {
  if (settingVisible.value) {
    settingCollapsed.value = !settingCollapsed.value;
  } else {
    settingVisible.value = true;
    settingCollapsed.value = false;
  }
}

// ──── 切换AI面板 ────
function handleToggleAiPanel() {
  if (aiPanelVisible.value) {
    aiCollapsed.value = !aiCollapsed.value;
  } else {
    aiPanelVisible.value = true;
    aiCollapsed.value = false;
  }
}

// ──── 切换结果面板 ────
function handleToggleResult() {
  if (resultVisible.value) {
    resultCollapsed.value = !resultCollapsed.value;
  } else {
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

      <!-- ══════ 左侧：设置面板（可拖拽/折叠/关闭） ══════ -->
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

      <!-- ══════ 右侧：图层面板（可拖拽/折叠/关闭） ══════ -->
      <Transition name="panel-slide-right">
        <div v-if="layerPanelVisible" class="side-panel layer-panel-wrapper" :style="layerDrag.style.value">
          <div class="panel-drag-handle" @mousedown="layerDrag.onDragStart">
            <span class="drag-dots">⋮⋮</span>
            <span>图层面板</span>
          </div>
          <RiverLayerPanel
            :collapsed="layerCollapsed"
            :layers="activeLayers"
            @toggle-layer="handleToggleLayer"
            @toggle-collapse="layerCollapsed = !layerCollapsed"
            @close="handleLayerClose"
          />
        </div>
      </Transition>

      <!-- ══════ 右侧：AI 助手面板（可拖拽/折叠/关闭） ══════ -->
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
            @send-message="handleSendMessage"
          />
        </div>
      </Transition>

      <!-- ══════ 底部：方案结果面板（可拖拽/折叠/关闭） ══════ -->
      <Transition name="panel-slide-up">
        <div v-if="resultVisible" class="bottom-panel" :style="resultDrag.style.value">
          <div class="panel-drag-handle horizontal" @mousedown="resultDrag.onDragStart">
            <span class="drag-dots">⋯</span>
            <span>方案结果</span>
          </div>
          <RiverResultBar
            :collapsed="resultCollapsed"
            :plans="planCards"
            :confidence="confidence"
            @toggle-collapse="resultCollapsed = !resultCollapsed"
            @close="handleResultClose"
          />
        </div>
      </Transition>

      <!-- ══════ 右侧工具栏 ══════ -->
      <div class="right-side">
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
.river-page { height: 100%; background: #0a101e; position: relative; }
.river-stage { position: relative; height: 100%; overflow: hidden; }

/* ──── 左侧按钮组 ──── */
.left-buttons {
  position: absolute; top: 18px; left: 18px; z-index: 25;
  display: flex; flex-direction: column; gap: 8px;
}
.side-btn {
  display: flex; height: 42px; width: 42px; align-items: center; justify-content: center;
  border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
  background: rgba(12,18,30,0.92); color: rgba(255,255,255,0.8);
  cursor: pointer; font-size: 17px;
  transition: border-color 0.15s, background 0.15s;
}
.side-btn:hover { border-color: rgba(94,164,255,0.3); background: rgba(20,30,50,0.95); }
.side-btn--active { border-color: rgba(94,164,255,0.5); background: rgba(59,130,246,0.1); }

/* ──── 右侧工具栏 ──── */
.right-side { position: absolute; top: 18px; right: 18px; z-index: 20; }

/* ──── 侧面板 ──── */
.side-panel {
  position: fixed; width: 380px; max-height: calc(100vh - 36px);
  display: flex; flex-direction: column;
  background: #0e1626; border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.45);
  overflow: hidden; z-index: 21;
}
.ai-panel-wrapper { width: 420px; }
.layer-panel-wrapper { width: 300px; }

/* ──── 底部面板 ──── */
.bottom-panel {
  position: fixed; width: calc(100vw - 480px); min-width: 600px;
  max-height: 70vh; display: flex; flex-direction: column;
  background: #0e1626; border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.45);
  overflow: hidden auto; z-index: 21;
  transition: max-height 0.25s ease;
}

/* ──── 拖拽手柄 ──── */
.panel-drag-handle {
  display: flex; align-items: center; justify-content: center;
  gap: 4px; height: 22px; font-size: 10px;
  color: rgba(255,255,255,0.25); background: rgba(255,255,255,0.02);
  cursor: grab; user-select: none; flex-shrink: 0; letter-spacing: 0.04em;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.panel-drag-handle:hover { color: rgba(255,255,255,0.45); background: rgba(255,255,255,0.03); }
.panel-drag-handle:active { cursor: grabbing; }
.drag-dots { font-size: 14px; line-height: 1; letter-spacing: 2px; }.panel-drag-handle.horizontal .drag-dots { letter-spacing: 4px; }

/* ──── 面板内组件去边 ──── */
.left-panel :deep(.setting-panel),
.layer-panel-wrapper :deep(.layer-panel),
.ai-panel-wrapper :deep(.ai-panel),
.bottom-panel :deep(.result-bar) {
  width: 100% !important; border: none !important;
  border-radius: 0 !important; box-shadow: none !important;
}

/* ──── 底部方案面板自适应内容高度 ──── */
.bottom-panel :deep(.bar-content) {
  flex: unset;
  overflow-y: visible;
}

/* 内容超屏时才滚动 */
@media (min-height: 900px) {
  .bottom-panel {
    max-height: 75vh;
  }
}

/* ──── 过渡 ──── */
.panel-slide-left-enter-active,
.panel-slide-right-enter-active,
.panel-slide-up-enter-active { transition: all 0.2s ease-out; }
.panel-slide-left-leave-active,
.panel-slide-right-leave-active,
.panel-slide-up-leave-active { transition: all 0.15s ease-in; }
.panel-slide-left-enter-from { transform: translateX(-24px); opacity: 0; }
.panel-slide-left-leave-to { transform: translateX(-16px); opacity: 0; }
.panel-slide-right-enter-from { transform: translateX(24px); opacity: 0; }
.panel-slide-right-leave-to { transform: translateX(16px); opacity: 0; }
.panel-slide-up-enter-from { transform: translateY(20px); opacity: 0; }
.panel-slide-up-leave-to { transform: translateY(12px); opacity: 0; }

@media (max-width: 1280px) {
  .side-panel { width: 340px; }
  .ai-panel-wrapper { width: 380px; }
}
</style>
