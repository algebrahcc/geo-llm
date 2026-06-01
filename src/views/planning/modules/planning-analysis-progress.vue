<script setup lang="ts">
import { computed } from 'vue';
import type { PlanningAnalysisStep } from './types';

defineOptions({
  name: 'PlanningAnalysisProgress'
});

interface Props {
  steps: PlanningAnalysisStep[];
  progress: number;
  statusText: string;
  running: boolean;
  collapsed?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  collapsed: false
});

const emit = defineEmits<{
  toggleCollapse: [];
}>();

const completedCount = computed(() => props.steps.filter(s => s.status === 'completed').length);
const currentStep = computed(() => props.steps.find(s => s.status === 'running'));

function getStatusIcon(step: PlanningAnalysisStep) {
  if (step.status === 'completed') return 'mdi:check-circle';
  if (step.status === 'running') return step.icon;
  return 'mdi:clock-outline';
}
</script>

<template>
  <div class="analysis-progress" :class="{ 'analysis-progress--running': running, 'analysis-progress--collapsed': collapsed }">
    <!-- 标题栏 -->
    <div class="progress-header" @click="emit('toggleCollapse')">
      <SvgIcon icon="mdi:brain" class="progress-icon" />
      <span class="progress-title">智能分析进度</span>
      <button type="button" class="progress-collapse-btn">
        <SvgIcon :icon="collapsed ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
      </button>
    </div>

    <!-- 折叠时只显示标题 -->
    <template v-if="!collapsed">
      <div class="steps-row">
      <div
        v-for="(step, index) in steps"
        :key="step.id"
        class="step-item"
        :class="[
          `step-item--${step.status}`,
          { 'step-item--last': index === steps.length - 1 }
        ]"
      >
        <div class="step-connector" v-if="index > 0">
          <div class="step-connector__line" :class="{ 'step-connector__line--active': step.status === 'completed' || step.status === 'running' }"></div>
        </div>
        <div class="step-node">
          <div class="step-icon-wrap" :class="`step-icon-wrap--${step.status}`">
            <SvgIcon :icon="getStatusIcon(step)" class="step-icon" />
          </div>
          <div class="step-info">
            <span class="step-label">{{ index + 1 }}. {{ step.label }}</span>
            <span class="step-status">
              <template v-if="step.status === 'completed'">已完成</template>
              <template v-else-if="step.status === 'running'">进行中...</template>
              <template v-else>等待中</template>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 进度条 -->
    <div class="progress-bar-wrap">
      <div class="progress-bar">
        <div class="progress-bar__fill" :style="{ width: `${progress}%` }"></div>
      </div>
      <span class="progress-percent">{{ progress }}%</span>
    </div>

    <!-- 状态文字 -->
    <div v-if="statusText" class="progress-status">{{ statusText }}</div>
    </template>
  </div>
</template>

<style scoped>
.analysis-progress {
  border: 1px solid rgba(41, 163, 255, 0.15);
  border-radius: 8px;
  padding: 14px 16px;
  background: rgba(6, 29, 56, 0.88);
  backdrop-filter: blur(12px);
  transition: all 0.3s ease;
}

.analysis-progress--collapsed {
  padding: 10px 14px;
}

.progress-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  cursor: pointer;
}

.analysis-progress--collapsed .progress-header {
  margin-bottom: 0;
}

.progress-collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.56);
  cursor: pointer;
  font-size: 16px;
  margin-left: auto;
  transition: all 0.2s ease;
}

.progress-collapse-btn:hover {
  background: rgba(41, 163, 255, 0.15);
  color: #29b6ff;
}

.progress-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.progress-icon {
  font-size: 18px;
  color: #29b6ff;
}

.progress-title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
}

.steps-row {
  display: flex;
  align-items: flex-start;
  gap: 0;
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.step-connector {
  width: 100%;
  height: 2px;
  display: flex;
  align-items: center;
  padding: 0 4px;
  margin-bottom: 8px;
}

.step-connector__line {
  width: 100%;
  height: 2px;
  background: rgba(41, 163, 255, 0.15);
  border-radius: 1px;
  transition: background 0.3s ease;
}

.step-connector__line--active {
  background: linear-gradient(90deg, #29b6ff, #2b6bff);
}

.step-item--completed .step-connector__line {
  background: #29b6ff;
}

.step-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.step-icon-wrap {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.step-icon-wrap--completed {
  background: rgba(41, 163, 255, 0.2);
  color: #29b6ff;
}

.step-icon-wrap--running {
  background: rgba(41, 163, 255, 0.25);
  color: #29b6ff;
  animation: pulse 1.5s ease-in-out infinite;
}

.step-icon-wrap--pending {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.35);
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(41, 163, 255, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(41, 163, 255, 0); }
}

.step-icon {
  font-size: 16px;
}

.step-info {
  text-align: center;
  min-width: 70px;
}

.step-label {
  display: block;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.72);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.step-item--completed .step-label {
  color: rgba(255, 255, 255, 0.88);
}

.step-item--running .step-label {
  color: #29b6ff;
  font-weight: 500;
}

.step-status {
  display: block;
  font-size: 10px;
  margin-top: 2px;
}

.step-item--completed .step-status {
  color: #2ee59d;
}

.step-item--running .step-status {
  color: #29b6ff;
}

.step-item--pending .step-status {
  color: rgba(255, 255, 255, 0.35);
}

.progress-bar-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: rgba(41, 163, 255, 0.12);
  overflow: hidden;
}

.progress-bar__fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #29b6ff 0%, #2b6bff 100%);
  transition: width 0.5s ease;
}

.progress-percent {
  font-size: 13px;
  font-weight: 600;
  color: #29b6ff;
  min-width: 36px;
  text-align: right;
}

.progress-status {
  margin-top: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.56);
}

.analysis-progress--running .progress-status {
  color: #29b6ff;
}
</style>
