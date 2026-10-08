<script setup lang="ts">
/**
 * 城市街景场景容器
 *
 * 球面呈现：街景点 + 街景路线（按推导出的道路顺序连线）+ 当前点高亮与相机跟随；
 * 左侧面板列出可用城市并做互斥切换，底部提供「开始浏览 / 上一处 / 下一处 / 定位」。
 *
 * 全景浮窗由 service-loader 打开（点击球上点位或按「开始浏览」时），
 * 与球面共用同一份道路顺序，因此浮窗里的前进/后退与这里的按钮完全一致。
 */
import { onMounted } from 'vue';
import CoordinateIndicator from '@/components/cesium/coordinate-indicator.vue';
import { useDraggable } from '@/composables/use-draggable';
import { useCesiumStreetview } from './use-cesium-streetview';

defineOptions({
  name: 'StreetviewViewer'
});

// 面板可拖动：默认停在「返回主页」按钮下方，用户可拖到顺手的位置
const { style: panelStyle, dragging, onDragStart } = useDraggable({ anchor: 'left', initialX: 12, initialY: 68 });

const emit = defineEmits<{ ready: [] }>();

const {
  containerRef,
  cursorCoordinates,
  cities,
  activeCity,
  activeCityId,
  loading,
  errorText,
  canBrowse,
  initScene,
  selectCity,
  startBrowse,
  step,
  flyToActive
} = useCesiumStreetview();

onMounted(async () => {
  await initScene();
  emit('ready');
});
</script>

<template>
  <div class="sv-shell">
    <div ref="containerRef" class="sv-stage" />

    <aside class="sv-panel" :style="panelStyle">
      <!-- 标题栏（兼作拖动抓手） -->
      <header
        class="sv-header"
        :class="{ 'sv-header--grabbing': dragging }"
        title="按住拖动面板"
        @mousedown="onDragStart"
      >
        <span class="sv-header__title">城市街景</span>
        <span v-if="activeCity" class="sv-header__meta">
          {{ activeCity.pointCount === null ? '加载中…' : `${activeCity.pointCount} 个街景点` }}
        </span>
      </header>

      <div class="sv-body">
        <!-- ══ 数据源 ══ -->
        <section class="sv-section">
          <div class="sv-section__label">街景数据源</div>
          <ul class="sv-cities">
            <li v-for="city in cities" :key="city.id">
              <button
                type="button"
                class="sv-city"
                :class="{ 'sv-city--active': city.id === activeCityId }"
                @click="selectCity(city.id)"
              >
                <span class="sv-city__name">{{ city.name }}</span>
                <span class="sv-city__meta">
                  <span class="sv-city__tag">{{ city.sourceLabel }}</span>
                  <span v-if="city.pointCount !== null" class="sv-city__points">{{ city.pointCount }} 点</span>
                </span>
              </button>
            </li>
          </ul>
        </section>

        <!-- ══ 浏览控制 ══ -->
        <section class="sv-section">
          <div class="sv-section__label">浏览控制</div>
          <div class="sv-section__body">
            <p v-if="loading" class="sv-hint">正在读取街景服务…</p>
            <p v-else-if="errorText" class="sv-hint sv-hint--error">{{ errorText }}</p>
            <p v-else class="sv-hint">点击球上街景点，或按「开始浏览」进入全景</p>

            <div class="sv-actions">
              <button type="button" class="sv-btn sv-btn--primary" :disabled="!canBrowse" @click="startBrowse">
                开始浏览
              </button>
              <button type="button" class="sv-btn" :disabled="!canBrowse" @click="step(-1)">上一处</button>
              <button type="button" class="sv-btn" :disabled="!canBrowse" @click="step(1)">下一处</button>
              <button type="button" class="sv-btn" :disabled="!canBrowse" @click="flyToActive">定位</button>
            </div>
          </div>
        </section>

        <p class="sv-foot">球面连线为推导出的街景路线，前进/后退沿该路线步进；全景浮窗内也可用 ←/→ 切换。</p>
      </div>
    </aside>

    <CoordinateIndicator
      :longitude="cursorCoordinates.longitude"
      :latitude="cursorCoordinates.latitude"
      :altitude="cursorCoordinates.altitude"
      :camera-height="cursorCoordinates.cameraHeight"
    />
  </div>
</template>

<style scoped>
/*
 * 视觉与渡河场景的方案设置面板一致（river-setting-panel.vue）：
 * 面板底 #0e1626 + 10px 圆角 + 大投影；内容用「分区」（左侧 2px 蓝条）组织；
 * 文字用「白色 + 降不透明度」分档，字号走全局字号阶 --font-*（不再自定 px 字号）。
 */
.sv-shell {
  position: relative;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: #050810;
}

.sv-stage {
  height: 100%;
  width: 100%;
}

.sv-shell :deep(.cesium-widget-credits),
.sv-shell :deep(.cesium-viewer-bottom),
.sv-shell :deep(.cesium-credit-logoContainer) {
  display: none !important;
}

/* 位置由 useDraggable 的 inline style 给出，此处不写死 top/left */
.sv-panel {
  --sv-text-1: rgb(255 255 255 / 95%);
  --sv-text-2: rgb(255 255 255 / 84%);
  --sv-text-3: rgb(255 255 255 / 70%);
  --sv-text-4: rgb(255 255 255 / 56%);
  --sv-bar: rgb(93 140 200 / 45%);
  --sv-blue-bg: rgb(43 107 255 / 15%);

  position: absolute;
  z-index: 10;
  display: flex;
  flex-direction: column;
  width: 340px;
  max-height: calc(100% - 90px);
  overflow: hidden;
  color: var(--sv-text-2);
  font-size: var(--font-sm);
  background: #0e1626;
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgb(0 0 0 / 45%);
}

/* 标题栏（兼作拖动抓手） */
.sv-header {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid rgb(255 255 255 / 6%);
  cursor: grab;
  user-select: none;
}

.sv-header--grabbing {
  cursor: grabbing;
}

.sv-header__title {
  font-size: var(--font-xl);
  font-weight: 700;
  color: var(--sv-text-1);
}

.sv-header__meta {
  margin-left: auto;
  color: var(--sv-text-4);
  font-size: var(--font-xs);
}

.sv-body {
  flex: 1;
  min-height: 0;
  padding: 14px 16px 12px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgb(141 184 255 / 24%) transparent;
}

.sv-body::-webkit-scrollbar {
  width: 5px;
}

.sv-body::-webkit-scrollbar-thumb {
  background: rgb(141 184 255 / 24%);
  border-radius: 999px;
}

/* ── 分区（对齐 river 的 .form-section / .section-label）── */
.sv-section {
  margin-bottom: 12px;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 5%);
  border-radius: 10px;
}

.sv-section__label {
  padding: 9px 12px;
  color: var(--sv-text-3);
  font-size: var(--font-sm);
  font-weight: 600;
  letter-spacing: 0.02em;
  background: rgb(255 255 255 / 2%);
  border-left: 2px solid var(--sv-bar);
}

.sv-section__body {
  padding: 10px 12px 12px;
}

.sv-cities {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 208px;
  padding: 6px;
  margin: 0;
  overflow-y: auto;
  list-style: none;
}

.sv-city {
  position: relative;
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 38px;
  padding: 0 8px 0 10px;
  color: var(--sv-text-1);
  font-size: var(--font-sm);
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 7px;
}

.sv-city::before {
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 0;
  width: 2px;
  background: transparent;
  content: '';
}

.sv-city:hover {
  background: rgb(255 255 255 / 4%);
}

.sv-city--active {
  background: rgb(43 107 255 / 12%);
}

.sv-city--active::before {
  background: #3b82f6;
}

.sv-city__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sv-city__meta {
  display: flex;
  flex: none;
  gap: 8px;
  align-items: center;
}

.sv-city__tag {
  padding: 0 6px;
  color: var(--sv-text-4);
  font-size: var(--font-xs);
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 5px;
}

.sv-city__points {
  color: var(--sv-text-4);
  font-size: var(--font-xs);
}

.sv-hint {
  margin: 0 0 10px;
  color: var(--sv-text-4);
  font-size: var(--font-xs);
  line-height: var(--font-lh-body);
}

.sv-hint--error {
  color: rgb(255 160 155 / 90%);
}

.sv-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.sv-btn {
  padding: 9px 0;
  color: var(--sv-text-2);
  font-size: var(--font-sm);
  cursor: pointer;
  background: rgb(255 255 255 / 6%);
  border: 1px solid transparent;
  border-radius: 7px;
  transition:
    background 0.18s,
    color 0.18s,
    border-color 0.18s;
}

.sv-btn:hover:not(:disabled) {
  color: var(--sv-text-1);
  background: rgb(255 255 255 / 10%);
}

.sv-btn:disabled {
  color: var(--sv-text-4);
  cursor: not-allowed;
  background: rgb(255 255 255 / 3%);
}

.sv-btn--primary {
  color: var(--sv-text-1);
  background: rgb(43 107 255 / 30%);
  border-color: rgb(93 140 200 / 50%);
}

.sv-btn--primary:hover:not(:disabled) {
  background: rgb(43 107 255 / 42%);
}

.sv-foot {
  margin: 0;
  color: var(--sv-text-4);
  font-size: var(--font-xs);
  line-height: var(--font-lh-body);
}

@media (max-width: 640px) {
  .sv-panel {
    width: calc(100% - 16px);
    max-height: 60%;
  }
}
</style>
