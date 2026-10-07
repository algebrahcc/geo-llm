<script setup lang="ts">
/**
 * 地图角落帧率角标（渡河 / 规划 / 大屏 / 城市街景共用）
 *
 * 为什么做成角标而不是面板：帧率是「随时能看一眼」的验收数据，常态展开会挡住地图。
 * 因此默认只显示一个细描边小字读数（与坐标浮窗同一套视觉），低于阈值（默认 30FPS）
 * 转警示色并轻微呼吸；点击才展开测试会话面板，可开始/结束/重置一次采样。
 *
 * 面板里刻意写明「测试会话会连续渲染」：场景平时是按需渲染的，
 * 不说明的话，验收方会以为读数是被"做"出来的。
 */
import { computed, ref } from 'vue';
import type { Viewer } from 'cesium';
import { useFpsMonitor } from '@/composables/cesium/use-fps-monitor';

interface Props {
  /** 目标 Viewer（异步创建，允许为 null） */
  viewer: Viewer | null;
  /** 判「不达标」的阈值（默认 30，对齐考核指标） */
  threshold?: number;
  /** 距底部的间距（默认错开坐标浮窗一行） */
  bottom?: number;
}

const props = withDefaults(defineProps<Props>(), { threshold: 30, bottom: 50 });

defineOptions({ name: 'FpsIndicator' });

const viewerSource = computed(() => props.viewer ?? null);
// 阈值判定留在组件：同一次采样可能被用在「球面角标」（30FPS 口径）与其它读数场景
const { stats, recording, elapsedMs, start, stop, reset } = useFpsMonitor(viewerSource);

const expanded = ref(false);

const low = computed(() => stats.value.current > 0 && stats.value.current < props.threshold);
const currentText = computed(() => formatFps(stats.value.current));
const averageText = computed(() => formatFps(stats.value.average));
const minText = computed(() => formatFps(stats.value.min));
const elapsedText = computed(() => `${(elapsedMs.value / 1000).toFixed(1)} s`);

function formatFps(value: number): string {
  return value > 0 ? String(Math.round(value)) : '--';
}

function toggle(): void {
  expanded.value = !expanded.value;
}

function toggleSession(): void {
  if (recording.value) stop();
  else start();
}
</script>

<template>
  <div class="fps-indicator" :class="{ 'fps-indicator--low': low }" :style="{ bottom: `${bottom}px` }">
    <button
      type="button"
      class="fps-chip"
      :title="recording ? '帧率测试会话进行中：点击展开读数' : '点击展开帧率读数与测试会话'"
      @click="toggle"
    >
      <span class="fps-chip__label">FPS</span>
      <span class="fps-chip__value">{{ currentText }}</span>
      <span class="fps-chip__min">最低 {{ minText }}</span>
    </button>

    <Transition name="fps-panel">
      <div v-if="expanded" class="fps-panel">
        <div class="fps-panel__row">
          <span>实时帧率</span>
          <strong>{{ currentText }} FPS</strong>
        </div>
        <div class="fps-panel__row">
          <span>平均帧率</span>
          <strong>{{ averageText }} FPS</strong>
        </div>
        <div class="fps-panel__row">
          <span>最低帧率</span>
          <strong>{{ minText }} FPS</strong>
        </div>
        <div class="fps-panel__row">
          <span>采样时长</span>
          <strong>{{ elapsedText }}</strong>
        </div>
        <p class="fps-panel__hint">
          {{
            recording
              ? '会话进行中：已临时关闭按需渲染，读数反映真实渲染能力'
              : '开始会话会连续渲染，读数可截图作为验收证据'
          }}
        </p>
        <div class="fps-panel__actions">
          <button type="button" class="fps-btn" :class="{ 'fps-btn--active': recording }" @click="toggleSession">
            {{ recording ? '结束会话' : '开始会话' }}
          </button>
          <button type="button" class="fps-btn" @click="reset">重置</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fps-indicator {
  position: absolute;
  right: 16px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.fps-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 9px;
  border: 1px solid rgba(92, 184, 255, 0.32);
  border-radius: 4px;
  background: rgba(4, 19, 40, 0.84);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.28);
  color: rgba(214, 237, 255, 0.9);
  font-family: 'DIN', Consolas, monospace;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  backdrop-filter: blur(6px);
  transition:
    color 0.2s ease,
    border-color 0.2s ease;
}

.fps-chip:hover {
  color: #eaf5ff;
  border-color: rgba(70, 176, 255, 0.55);
}

.fps-chip__label {
  font-size: 10px;
  letter-spacing: 0.08em;
  color: rgba(147, 196, 255, 0.75);
}

.fps-chip__value {
  font-size: 13px;
  font-weight: 700;
}

.fps-chip__min {
  color: rgba(147, 196, 255, 0.7);
}

/* 不达标时转警示色并轻微呼吸：静态截图也能看出状态 */
.fps-indicator--low .fps-chip {
  color: #ffb04d;
  border-color: rgba(255, 176, 77, 0.5);
}

.fps-indicator--low .fps-chip__value {
  animation: fps-breathe 1.6s ease-in-out infinite;
}

.fps-panel {
  width: 208px;
  padding: 10px 12px;
  border: 1px solid rgba(92, 184, 255, 0.32);
  border-radius: 6px;
  background: rgba(4, 19, 40, 0.94);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.42);
  color: rgba(214, 237, 255, 0.9);
  font-family: 'DIN', Consolas, monospace;
  font-size: 12px;
  backdrop-filter: blur(8px);
}

.fps-panel__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 3px 0;
}

.fps-panel__row span {
  color: rgba(147, 196, 255, 0.75);
}

.fps-panel__row strong {
  font-weight: 700;
  color: #eaf5ff;
}

.fps-panel__hint {
  margin: 8px 0 0;
  padding-top: 8px;
  border-top: 1px solid rgba(92, 184, 255, 0.18);
  color: rgba(147, 196, 255, 0.6);
  font-size: 11px;
  line-height: 1.5;
}

.fps-panel__actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.fps-btn {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid rgba(92, 184, 255, 0.32);
  border-radius: 4px;
  background: rgba(6, 25, 50, 0.7);
  color: #cbe3ff;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease;
}

.fps-btn:hover {
  color: #29a3ff;
  border-color: rgba(70, 176, 255, 0.55);
}

.fps-btn--active {
  color: #29a3ff;
  border-color: rgba(70, 176, 255, 0.6);
  background: rgba(41, 163, 255, 0.16);
}

.fps-panel-enter-active,
.fps-panel-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.fps-panel-enter-from,
.fps-panel-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

/* 小屏只留实时帧率：窄屏下塞三列读数会把角标撑得比地图还抢眼 */
@media (max-width: 640px) {
  .fps-chip__min {
    display: none;
  }
}

@keyframes fps-breathe {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.62;
  }
}
</style>
