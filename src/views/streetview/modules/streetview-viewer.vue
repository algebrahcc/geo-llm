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
import FpsIndicator from '@/components/cesium/fps-indicator.vue';
import { useCesiumStreetview } from './use-cesium-streetview';

defineOptions({
  name: 'StreetviewViewer'
});

const emit = defineEmits<{ ready: [] }>();

const {
  containerRef,
  viewerRef,
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

    <aside class="sv-panel">
      <header class="sv-panel__head">
        <span class="sv-panel__title">城市街景</span>
        <span v-if="activeCity" class="sv-panel__count">
          {{ activeCity.pointCount === null ? '加载中…' : `${activeCity.pointCount} 个街景点` }}
        </span>
      </header>

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

      <p v-if="loading" class="sv-panel__hint">正在读取街景服务…</p>
      <p v-else-if="errorText" class="sv-panel__error">{{ errorText }}</p>
      <p v-else class="sv-panel__hint">点击球上街景点，或按「开始浏览」进入全景</p>

      <div class="sv-actions">
        <button type="button" class="sv-btn sv-btn--primary" :disabled="!canBrowse" @click="startBrowse">
          开始浏览
        </button>
        <button type="button" class="sv-btn" :disabled="!canBrowse" @click="step(-1)">上一处</button>
        <button type="button" class="sv-btn" :disabled="!canBrowse" @click="step(1)">下一处</button>
        <button type="button" class="sv-btn" :disabled="!canBrowse" @click="flyToActive">定位</button>
      </div>

      <p class="sv-panel__tip">球面连线为推导出的街景路线，前进/后退沿该路线步进；全景浮窗内也可用 ←/→ 切换。</p>
    </aside>

    <CoordinateIndicator
      :longitude="cursorCoordinates.longitude"
      :latitude="cursorCoordinates.latitude"
      :altitude="cursorCoordinates.altitude"
      :camera-height="cursorCoordinates.cameraHeight"
    />
    <FpsIndicator :viewer="viewerRef" />
  </div>
</template>

<style scoped>
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

.sv-panel {
  position: absolute;
  top: 16px;
  left: 16px;
  width: 236px;
  padding: 12px 14px 14px;
  border: 1px solid rgba(43, 131, 255, 0.32);
  border-radius: 8px;
  background: rgba(4, 19, 40, 0.9);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.42);
  color: rgba(214, 237, 255, 0.92);
  backdrop-filter: blur(8px);
}

.sv-panel__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(92, 184, 255, 0.2);
}

.sv-panel__title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.sv-panel__count {
  font-family: 'DIN', Consolas, monospace;
  font-size: 11px;
  color: rgba(147, 196, 255, 0.75);
}

.sv-cities {
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 208px;
  overflow-y: auto;
}

.sv-city {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid rgba(45, 111, 183, 0.32);
  border-radius: 6px;
  background: rgba(6, 25, 50, 0.68);
  color: #cbe3ff;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: all 0.18s ease;
}

.sv-city:hover {
  border-color: rgba(70, 176, 255, 0.55);
  color: #eaf5ff;
}

.sv-city--active {
  border-color: #29a3ff;
  background: rgba(41, 163, 255, 0.16);
  box-shadow: 0 0 0 1px rgba(41, 163, 255, 0.45);
}

.sv-city__name {
  font-weight: 600;
}

.sv-city__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.sv-city__tag {
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(43, 131, 255, 0.16);
  color: #8db8ff;
  font-size: 10px;
}

.sv-city__points {
  font-family: 'DIN', Consolas, monospace;
  font-size: 11px;
  color: rgba(147, 196, 255, 0.75);
}

.sv-panel__hint,
.sv-panel__error,
.sv-panel__tip {
  margin: 10px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: rgba(147, 196, 255, 0.68);
}

.sv-panel__error {
  color: #ff8a95;
}

.sv-panel__tip {
  padding-top: 10px;
  border-top: 1px solid rgba(92, 184, 255, 0.18);
}

.sv-panel__credit {
  margin: 6px 0 0;
  font-size: 10px;
  line-height: 1.5;
  color: rgba(147, 196, 255, 0.45);
}

.sv-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.sv-btn {
  padding: 7px 10px;
  border: 1px solid rgba(45, 111, 183, 0.4);
  border-radius: 6px;
  background: rgba(6, 25, 50, 0.7);
  color: #cbe3ff;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.sv-btn:hover:not(:disabled) {
  color: #eaf5ff;
  border-color: rgba(70, 176, 255, 0.6);
}

.sv-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.sv-btn--primary {
  border-color: rgba(70, 176, 255, 0.55);
  background: rgba(41, 163, 255, 0.18);
  color: #8dc4ff;
}

@media (max-width: 640px) {
  .sv-panel {
    left: 8px;
    top: 8px;
    width: calc(100% - 16px);
    max-height: 46%;
    overflow-y: auto;
  }
}
</style>
