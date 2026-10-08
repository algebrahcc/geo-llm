<script setup lang="ts">
/**
 * 地下空间三维展示场景。
 *
 * 定位：**数据展示与剖切浏览**页。回答三个问题——
 *   1) 系统里有哪些地下三维模型数据（模型清单来自「数据服务」中 threed 分类的记录）；
 *   2) 这些模型在球上什么位置、标高范围多大（模型卡片 + 标高刻度）；
 *   3) 楼板/结构被剖开后内部是什么样子（剖切控制 + 标准视图）。
 *
 * 刻意不放量测、第一人称漫游等能力：先把「数据能进来、能剖开看」这条主链打通。
 */
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useThemeStore } from '@/store/modules/theme';
import CoordinateIndicator from '@/components/cesium/coordinate-indicator.vue';
import UndergroundPanel from './modules/underground-panel.vue';
import { useCesiumUnderground, type ViewPreset } from './modules/use-cesium-underground';

defineOptions({ name: 'UndergroundPage' });

// 本页是整屏深色三维界面，浮层（NaiveUI 弹层/下拉）需与深色底一致
const themeStore = useThemeStore();
themeStore.setDarkModeForced(true);
onActivated(() => themeStore.setDarkModeForced(true));
onDeactivated(() => themeStore.setDarkModeForced(false));
onBeforeUnmount(() => themeStore.setDarkModeForced(false));

const {
  containerRef,
  cursorCoordinates,
  initViewer,
  models,
  activeId,
  activeModel,
  loading,
  loadModels,
  selectModel,
  toggleVisible,
  retryModel,
  clipping,
  elevationRange,
  currentElevation,
  currentFloorLabel,
  applyClipping,
  flyToModel,
  flyPreset
} = useCesiumUnderground();

const router = useRouter();

/** 未配置摆放位置时禁用剖切与标准视图（面板据此给出引导） */
const hasAnchor = computed(() => Boolean(activeModel.value?.anchor));

/** 返回主界面（与渡河 / 规划场景一致：回统计大屏） */
function handleBackToMain(): void {
  void router.push({ name: 'screen' });
}

/** 定位到指定模型：先切换选中，再飞行过去 */
function handleFly(id: number): void {
  selectModel(id);
  flyToModel();
}

function handlePreset(preset: ViewPreset): void {
  flyPreset(preset);
}

onMounted(async () => {
  await initViewer();
  await loadModels();
});
</script>

<template>
  <div class="ug-page">
    <div class="ug-page__body">
      <div ref="containerRef" class="ug-page__cesium" />

      <!-- 左上角按钮组（与渡河 / 规划场景位置与样式一致） -->
      <div class="ug-side-buttons">
        <NTooltip placement="right">
          <template #trigger>
            <button type="button" class="ug-side-btn" @click="handleBackToMain">
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
      <UndergroundPanel
        :models="models"
        :active-id="activeId"
        :clipping="clipping"
        :elevation-range="elevationRange"
        :current-elevation="currentElevation"
        :current-floor-label="currentFloorLabel"
        :loading="loading"
        :has-anchor="hasAnchor"
        @select="selectModel"
        @toggle="toggleVisible"
        @fly="handleFly"
        @retry="retryModel"
        @refresh="loadModels"
        @clip-change="applyClipping"
        @fly-preset="handlePreset"
      />

      <div v-if="models.length === 0" class="ug-setup-hint">
        <p class="ug-setup-hint__title">还没有可展示的地下模型数据</p>
        <p class="ug-setup-hint__body">
          在「数据管理 → 数据服务」新增一条记录，分类选
          <b>三维模型</b>
          、类型选
          <b>3dtiles</b>
          或
          <b>glb</b>
          ，
          <br />
          来源选「内部服务」，地址填
          <code>data/underground/...</code>
          ，连接参数里配置
          <code>position</code>
          （经纬高）与
          <code>elevation</code>
          （标高范围）。
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ug-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 560px;
  background: #050810;
}

.ug-page__body {
  position: relative;
  flex: 1;
  overflow: hidden;
}

.ug-page__cesium {
  width: 100%;
  height: 100%;
}

.ug-page__cesium :deep(.cesium-widget-credits),
.ug-page__cesium :deep(.cesium-viewer-bottom),
.ug-page__cesium :deep(.cesium-credit-logoContainer) {
  display: none !important;
}

/* 左上角按钮组：与 river / planning 场景的 side-btn 同一套尺寸与配色 */
.ug-side-buttons {
  position: absolute;
  top: 18px;
  left: 18px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ug-side-btn {
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

.ug-side-btn:hover {
  background: rgb(20 30 50 / 95%);
  border-color: rgb(94 164 255 / 30%);
}

/* 与渡河场景面板同一套外观：深蓝底 + 10px 圆角 + 大投影 + 白色分档文字 */
.ug-setup-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 8;
  max-width: 520px;
  padding: 16px 18px;
  background: rgb(14 22 38 / 95%);
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgb(0 0 0 / 45%);
  transform: translate(-50%, -50%);
}

.ug-setup-hint__title {
  margin-bottom: 10px;
  color: rgb(255 255 255 / 95%);
  font-size: var(--font-lg);
  font-weight: 700;
}

.ug-setup-hint__body {
  color: rgb(255 255 255 / 56%);
  font-size: var(--font-sm);
  line-height: var(--font-lh-body);
}

.ug-setup-hint__body b {
  color: rgb(255 255 255 / 84%);
}

.ug-setup-hint__body code {
  padding: 0 5px;
  color: rgb(255 208 130 / 90%);
  font-family: ui-monospace, consolas, monospace;
  font-size: var(--font-xs);
  background: rgb(255 255 255 / 6%);
  border-radius: 5px;
}
</style>
