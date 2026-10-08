<script setup lang="ts">
/**
 * 环境研判工作台（本期指标 7 的主界面）。
 *
 * 定位：**圈定区域 → 算出结论 → 归纳质疑 → 复核归档**的工作台，回答四个问题——
 *   1) 这片区域里有什么（选区 + 要素统计）；
 *   2) 对某型车辆，哪些路口/桥梁/道路/街区能过、哪些不能（通过性判定，规则算）；
 *   3) 路网哪里会断、堵、卡，哪里适合临机开设通路（图论 + 地形代理量）；
 *   4) 结论有没有依据、能不能复核（质效读数 + 决策日志 + 报告）。
 *
 * 大模型是可选通道：只做归纳与质疑（见 situation-prompt 的契约），不参与数值结论。
 */
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Cartesian3 } from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useThemeStore } from '@/store/modules/theme';
import CoordinateIndicator from '@/components/cesium/coordinate-indicator.vue';
import SituationPanel from './modules/situation-panel.vue';
import { useSituation } from './modules/use-situation';

defineOptions({ name: 'SituationPage' });

// 整屏深色三维界面：浮层需与深色底一致
const themeStore = useThemeStore();
themeStore.setDarkModeForced(true);
onActivated(() => themeStore.setDarkModeForced(true));
onDeactivated(() => themeStore.setDarkModeForced(false));
onBeforeUnmount(() => themeStore.setDarkModeForced(false));

const {
  containerRef,
  viewerRef,
  cursorCoordinates,
  initViewer,
  loadLayers,
  startSelect,
  clearSelect,
  selection,
  selectDrawing,
  hasSelection,
  vehicle,
  vehicleLabel,
  items,
  modelItems,
  narrative,
  running,
  modelRunning,
  notice,
  metrics,
  log,
  citationText,
  agreementText,
  runRules,
  runModel,
  review,
  exportReport,
  exportLog
} = useSituation();

const router = useRouter();

const ruleMs = computed(() => metrics.value?.ruleMs ?? null);
const llmMs = computed(() => metrics.value?.llmMs ?? null);

function handleBackToMain(): void {
  void router.push({ name: 'screen' });
}

/** 点击依据 → 定位该要素（结论可溯源要能落到图上，否则"依据"只是个字符串） */
function focusEvidence(evidenceId: string): void {
  const viewer = viewerRef.value;
  const evidence = selection.value?.evidences.find(item => item.id === evidenceId);
  if (!viewer || !evidence) return;
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(evidence.lon, evidence.lat, 3000),
    duration: 0.8
  });
}

onMounted(async () => {
  await initViewer();
  await loadLayers();
});
</script>

<template>
  <div class="st-page">
    <div class="st-page__body">
      <div ref="containerRef" class="st-page__cesium" />

      <div class="st-side-buttons">
        <NTooltip placement="right">
          <template #trigger>
            <button type="button" class="st-side-btn" @click="handleBackToMain">
              <SvgIcon icon="mdi:arrow-left" />
            </button>
          </template>
          <span>返回主页</span>
        </NTooltip>
      </div>

      <CoordinateIndicator
        :longitude="cursorCoordinates.longitude"
        :latitude="cursorCoordinates.latitude"
        :altitude="cursorCoordinates.altitude"
        :camera-height="cursorCoordinates.cameraHeight"
      />

      <SituationPanel
        :selection="selection"
        :selecting="selectDrawing"
        :vehicle="vehicle"
        :vehicle-label="vehicleLabel"
        :items="items"
        :model-items="modelItems"
        :narrative="narrative"
        :running="running"
        :model-running="modelRunning"
        :notice="notice"
        :rule-ms="ruleMs"
        :llm-ms="llmMs"
        :citation-text="citationText"
        :agreement-text="agreementText"
        :log="log"
        @start-select="startSelect"
        @clear-select="clearSelect"
        @update:vehicle="value => (vehicle = value)"
        @run="runRules"
        @run-model="runModel"
        @review="review"
        @export-report="exportReport"
        @export-log="exportLog"
        @focus="focusEvidence"
      />

      <div v-if="!hasSelection && !selectDrawing" class="st-guide">
        <p class="st-guide__title">框选一片区域开始研判</p>
        <p class="st-guide__body">
          ① 点右侧「框选区域」 → ② 在地图上
          <b>按住鼠标左键拖出矩形</b>
          → ③ 松手即出选区
          <br />
          系统会收集范围内的路网与目标要素，按所选车辆类型算出通过性、关键节点、
          <br />
          断堵卡风险与临机开设通路适宜等级。
        </p>
      </div>

      <div v-if="selectDrawing" class="st-drawing-tip">
        <SvgIcon icon="mdi:gesture-swipe" />
        按住左键拖出矩形，松开完成（滚轮可缩放）
      </div>
    </div>
  </div>
</template>

<style scoped>
.st-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 560px;
  background: #050810;
}

.st-page__body {
  position: relative;
  flex: 1;
  overflow: hidden;
}

.st-page__cesium {
  width: 100%;
  height: 100%;
}

.st-page__cesium :deep(.cesium-widget-credits),
.st-page__cesium :deep(.cesium-viewer-bottom),
.st-page__cesium :deep(.cesium-credit-logoContainer) {
  display: none !important;
}

/* 左上角按钮组：与渡河 / 规划 / 地下空间场景同一套尺寸与配色 */
.st-side-buttons {
  position: absolute;
  top: 18px;
  left: 18px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.st-side-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  color: rgb(255 255 255 / 80%);
  font-size: 17px;
  cursor: pointer;
  background: rgb(12 18 30 / 92%);
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 8px;
  transition:
    border-color 0.15s,
    background 0.15s;
}

.st-side-btn:hover {
  background: rgb(20 30 50 / 95%);
  border-color: rgb(94 164 255 / 30%);
}

/* 引导卡：仅在未框选时出现，避免长期遮挡地图 */
.st-guide {
  position: absolute;
  bottom: 28px;
  left: 50%;
  z-index: 8;
  max-width: 560px;
  padding: 12px 16px;
  text-align: center;
  background: rgb(14 22 38 / 92%);
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgb(0 0 0 / 45%);
  transform: translateX(-50%);
}

.st-guide__title {
  margin-bottom: 6px;
  color: rgb(255 255 255 / 95%);
  font-size: var(--font-lg);
  font-weight: 700;
}

.st-guide__body {
  color: rgb(255 255 255 / 56%);
  font-size: var(--font-sm);
  line-height: var(--font-lh-body);
}

/* 框选模式提示：跟随光标区域顶部，避免用户不知道现在该做什么 */
.st-drawing-tip {
  position: absolute;
  top: 18px;
  left: 50%;
  z-index: 9;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  color: #b8f1ff;
  font-size: 12px;
  background: rgb(4 30 44 / 92%);
  border: 1px solid rgb(34 211 238 / 45%);
  border-radius: 6px;
  box-shadow: 0 6px 22px rgb(0 0 0 / 40%);
  transform: translateX(-50%);
  pointer-events: none;
}
</style>
