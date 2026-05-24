<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { globeDefaultLayers, globeLeftTools, globeRightTools } from '@/mock/globe';
import GlobeAnalysisPanel from './modules/globe-analysis-panel.vue';
import GlobeLayerPanel from './modules/globe-layer-panel.vue';
import GlobeStatusBar from './modules/globe-status-bar.vue';
import GlobeToolbar from './modules/globe-toolbar.vue';
import GlobeViewer from './modules/globe-viewer.vue';
import type {
  GlobeInteractiveTool,
  GlobeLayerItem,
  GlobeLayerKey,
  GlobeLogEntry,
  GlobeStatusInfo,
  GlobeToolKey
} from './modules/types';

defineOptions({
  name: 'GlobePage'
});

interface GlobeViewerExposed {
  setActiveTool: (tool: GlobeInteractiveTool | 'browse') => void;
  setLayerVisible: (key: GlobeLayerKey, visible: boolean) => void;
  flyToPreset: (preset?: 'default' | 'task') => void;
  flyToLocation: (longitude: number, latitude: number, height?: number) => void;
  resetView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  rotate: () => void;
  pitch: () => void;
  clearAnnotations: () => void;
  generateMark: () => void;
  startAnalysis: (onStep: (text: string) => void) => Promise<void>;
  exportScreenshot: () => void;
}

const route = useRoute();
const viewerRef = ref<GlobeViewerExposed | null>(null);
const activeLeftTool = ref<GlobeToolKey | null>(null);
const activeRightTool = ref<GlobeToolKey | null>(null);
const layerPanelVisible = ref(true);
const layerPanelCollapsed = ref(false);
const analysisPanelVisible = ref(true);
const analysisPanelCollapsed = ref(false);
const analysisToolsVisible = ref(false);
const analysisRunning = ref(false);
const viewerReady = ref(false);
const analysisLogs = ref<GlobeLogEntry[]>([]);
const layerItems = ref<GlobeLayerItem[]>(globeDefaultLayers.map(item => ({ ...item })));
const status = ref<GlobeStatusInfo>({
  longitude: '--',
  latitude: '--',
  altitude: '--',
  cameraHeight: '--',
  activeTool: '浏览'
});

let logId = 0;

const analysisShortcutItems = [
  { key: 'analyze', label: '开始分析', icon: 'mdi:play-circle-outline' },
  { key: 'mark', label: '生成标注', icon: 'mdi:map-marker-plus-outline' },
  { key: 'export', label: '导出截图', icon: 'mdi:image-outline' }
] as const;

const analysisEntryActive = computed(() => analysisToolsVisible.value || analysisPanelVisible.value);

function getTimeText() {
  return new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function setInteractiveTool(tool: GlobeInteractiveTool | 'browse', activeKey: GlobeToolKey | null) {
  viewerRef.value?.setActiveTool(tool);
  activeLeftTool.value = activeKey;
}

function syncAnalysisToolState() {
  if (analysisEntryActive.value) {
    activeLeftTool.value = 'analysis';
  } else if (activeLeftTool.value === 'analysis') {
    activeLeftTool.value = null;
  }
}

function openAnalysisPanel() {
  analysisPanelVisible.value = true;
  analysisPanelCollapsed.value = false;
  syncAnalysisToolState();
}

function handleLeftToolSelect(key: GlobeToolKey) {
  switch (key) {
    case 'analysis':
      analysisToolsVisible.value = !analysisToolsVisible.value;
      setInteractiveTool('browse', analysisEntryActive.value ? 'analysis' : null);
      syncAnalysisToolState();
      return;
    case 'locate':
      viewerRef.value?.flyToPreset('task');
      analysisToolsVisible.value = false;
      activeLeftTool.value = null;
      setInteractiveTool('browse', null);
      return;
    case 'measure-distance':
      analysisToolsVisible.value = false;
      setInteractiveTool('measure-distance', key);
      window.$message?.info('请在地球上依次点击两个点');
      return;
    case 'measure-area':
      analysisToolsVisible.value = false;
      setInteractiveTool('measure-area', key);
      window.$message?.info('请在地球上依次点击三个点');
      return;
    case 'annotate':
      analysisToolsVisible.value = false;
      setInteractiveTool('annotate', key);
      window.$message?.info('请在地球上点击添加标注');
      return;
    case 'clear':
      analysisToolsVisible.value = false;
      viewerRef.value?.clearAnnotations();
      activeLeftTool.value = null;
      setInteractiveTool('browse', null);
      return;
    default:
      return;
  }
}

function handleAnalysisShortcut(action: (typeof analysisShortcutItems)[number]['key']) {
  openAnalysisPanel();

  if (action === 'analyze') {
    void handleAnalyze();
  }

  if (action === 'mark') {
    handleGenerateMark();
  }

  if (action === 'export') {
    handleExportShot();
  }
}

function handleRightToolSelect(key: GlobeToolKey) {
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
      activeLeftTool.value = null;
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

function handleLayerPanelCollapse() {
  layerPanelCollapsed.value = !layerPanelCollapsed.value;
  layerPanelVisible.value = true;
  activeRightTool.value = 'layers';
}

function handleLayerChange(payload: { key: GlobeLayerKey; visible: boolean }) {
  const layer = layerItems.value.find(item => item.key === payload.key);

  if (layer) {
    layer.visible = payload.visible;
    viewerRef.value?.setLayerVisible(payload.key, payload.visible);
  }
}

function appendAnalysisStep(text: string) {
  const lastLog = analysisLogs.value.at(-1);

  if (lastLog && lastLog.status === 'running') {
    lastLog.status = 'success';
  }

  analysisLogs.value.push({
    id: ++logId,
    text,
    status: 'running',
    time: getTimeText()
  });
}

async function handleAnalyze() {
  if (analysisRunning.value || !viewerRef.value) return;

  analysisRunning.value = true;
  analysisLogs.value = [];
  openAnalysisPanel();
  analysisToolsVisible.value = false;

  try {
    await viewerRef.value.startAnalysis(appendAnalysisStep);

    const lastLog = analysisLogs.value.at(-1);

    if (lastLog) lastLog.status = 'success';

    analysisLogs.value.push({
      id: ++logId,
      text: '分析完成，已加载推荐路线与标注',
      status: 'success',
      time: getTimeText()
    });

    window.$message?.success('分析完成');
  } finally {
    analysisRunning.value = false;
  }
}

function handleGenerateMark() {
  viewerRef.value?.generateMark();
}

function handleExportShot() {
  viewerRef.value?.exportScreenshot();
}

function handleStatusChange(nextStatus: GlobeStatusInfo) {
  status.value = nextStatus;

  if (nextStatus.activeTool === '浏览' && activeLeftTool.value && activeLeftTool.value !== 'analysis') {
    activeLeftTool.value = null;
  }
}

function handleAnalysisPanelCollapse() {
  analysisPanelCollapsed.value = !analysisPanelCollapsed.value;
  analysisPanelVisible.value = true;
  syncAnalysisToolState();
}

function parseQueryNumber(value: unknown) {
  if (typeof value !== 'string') return undefined;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function applyRouteFocus() {
  if (!viewerReady.value || !viewerRef.value) return;

  const preset = route.query.preset;
  const longitude = parseQueryNumber(route.query.longitude ?? route.query.lng);
  const latitude = parseQueryNumber(route.query.latitude ?? route.query.lat);
  const height = parseQueryNumber(route.query.height);
  const panel = route.query.panel;

  if (typeof preset === 'string' && (preset === 'default' || preset === 'task')) {
    viewerRef.value.flyToPreset(preset);
  } else if (longitude !== undefined && latitude !== undefined) {
    viewerRef.value.flyToLocation(longitude, latitude, height);
  }

  if (panel === 'analysis') {
    openAnalysisPanel();
  }
}

function handleViewerReady() {
  viewerReady.value = true;
  applyRouteFocus();
}

watch(
  () => route.fullPath,
  () => {
    applyRouteFocus();
  }
);
</script>

<template>
  <div class="globe-page">
    <div class="globe-stage">
      <GlobeViewer ref="viewerRef" @ready="handleViewerReady" @status-change="handleStatusChange" />

      <GlobeToolbar
        placement="left"
        :items="globeLeftTools"
        :active-key="activeLeftTool"
        @select="handleLeftToolSelect"
      />
      <GlobeToolbar
        placement="right"
        :items="globeRightTools"
        :active-key="activeRightTool"
        @select="handleRightToolSelect"
      />

      <div v-if="analysisToolsVisible" class="analysis-tools-wrap">
        <div class="analysis-tools-panel">
          <button
            v-for="item in analysisShortcutItems"
            :key="item.key"
            type="button"
            class="analysis-tools-button"
            @click="handleAnalysisShortcut(item.key)"
          >
            <SvgIcon :icon="item.icon" class="analysis-tools-icon" />
            <span>{{ item.label }}</span>
          </button>
        </div>
      </div>

      <div v-if="layerPanelVisible" class="layer-panel-wrap">
        <GlobeLayerPanel
          :collapsed="layerPanelCollapsed"
          :layers="layerItems"
          @change="handleLayerChange"
          @toggle-collapse="handleLayerPanelCollapse"
        />
      </div>

      <div v-if="analysisPanelVisible" class="analysis-panel-wrap">
        <GlobeAnalysisPanel
          :collapsed="analysisPanelCollapsed"
          :logs="analysisLogs"
          :running="analysisRunning"
          @analyze="handleAnalyze"
          @generate-mark="handleGenerateMark"
          @export-shot="handleExportShot"
          @toggle-collapse="handleAnalysisPanelCollapse"
        />
      </div>

      <div class="status-bar-wrap">
        <GlobeStatusBar :status="status" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.globe-page {
  height: 100%;
  padding: 16px;
  background: rgb(11, 18, 32);
}

.globe-stage {
  position: relative;
  height: 100%;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
}

.layer-panel-wrap {
  position: absolute;
  right: 144px;
  top: 16px;
  z-index: 20;
}

.analysis-tools-wrap {
  position: absolute;
  left: 144px;
  top: 16px;
  z-index: 20;
}

.analysis-tools-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 8px;
  background: rgba(15, 23, 42, 0.84);
  backdrop-filter: blur(10px);
}

.analysis-tools-button {
  display: flex;
  min-width: 116px;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.88);
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease;
}

.analysis-tools-button:hover {
  border-color: rgba(43, 107, 255, 0.48);
  background: rgba(43, 107, 255, 0.12);
}

.analysis-tools-icon {
  font-size: 15px;
}

.analysis-panel-wrap {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 20;
}

.status-bar-wrap {
  position: absolute;
  left: 16px;
  bottom: 16px;
  z-index: 20;
}
</style>
