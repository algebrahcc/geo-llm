<script setup lang="ts">
import type { RiverFlowStep } from './types';

defineOptions({
  name: 'RiverFlowStrip'
});

defineProps<{
  steps: RiverFlowStep[];
  running: boolean;
}>();
</script>

<template>
  <div class="flow-strip">
    <div class="flow-title">
      <SvgIcon icon="mdi:vector-polyline" class="flow-icon" />
      <span>分析流程</span>
    </div>

    <div class="flow-list">
      <div v-for="(step, index) in steps" :key="step.key" class="flow-item" :class="[`flow-item--${step.status}`]">
        <div class="flow-order">{{ index + 1 }}</div>
        <div class="flow-body">
          <div class="flow-label">{{ step.label }}</div>
          <div class="flow-desc">{{ step.description }}</div>
        </div>
      </div>
    </div>

    <div class="flow-state" :class="[{ 'flow-state--running': running }]">
      {{ running ? '推演进行中' : '等待重新推演' }}
    </div>
  </div>
</template>

<style scoped>
.flow-strip {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 8px 10px;
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(14px);
}

.flow-title {
  display: flex;
  min-width: 74px;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
}

.flow-icon {
  font-size: 14px;
  color: #2b6bff;
}

.flow-list {
  display: flex;
  min-width: 0;
  flex: 1;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.flow-item {
  display: flex;
  min-width: 148px;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.03);
}

.flow-item--running {
  border-color: rgba(43, 107, 255, 0.52);
  background: rgba(43, 107, 255, 0.12);
}

.flow-item--success {
  border-color: rgba(46, 229, 157, 0.32);
  background: rgba(46, 229, 157, 0.1);
}

.flow-order {
  display: flex;
  height: 20px;
  width: 20px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  font-size: 11px;
  color: rgba(255, 255, 255, 0.88);
}

.flow-body {
  min-width: 0;
}

.flow-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.9);
}

.flow-desc {
  margin-top: 2px;
  font-size: 10px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.54);
}

.flow-state {
  white-space: nowrap;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.52);
}

.flow-state--running {
  color: #8db8ff;
}

.flow-list::-webkit-scrollbar {
  height: 6px;
}

.flow-list::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(141, 184, 255, 0.38);
}

.flow-list::-webkit-scrollbar-track {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
}
</style>
