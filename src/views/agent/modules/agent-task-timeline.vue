<script setup lang="ts">
import type { AgentRunTask } from '@/mock/agent';

defineProps<{
  task: AgentRunTask;
}>();

const statusMeta = {
  waiting: { type: 'default' as const, label: '等待' },
  running: { type: 'warning' as const, label: '运行中' },
  success: { type: 'success' as const, label: '完成' },
  failed: { type: 'error' as const, label: '失败' }
};
</script>

<template>
  <div class="flex flex-col gap-8px">
    <div v-for="step in task.steps" :key="step.key" class="step-item">
      <div class="flex flex-wrap items-start justify-between gap-8px">
        <div>
          <div class="flex items-center gap-6px">
            <span class="step-label">{{ step.label }}</span>
            <NTag size="small" round :type="statusMeta[step.status].type" :bordered="false">
              {{ statusMeta[step.status].label }}
            </NTag>
          </div>
          <div class="step-desc">{{ step.description }}</div>
        </div>
        <div class="step-meta">
          <div>{{ step.duration }}</div>
          <div v-if="step.tool" class="mt-2px">{{ step.tool }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.step-item {
  padding: 10px 12px;
  border: 1px solid rgba(25, 95, 176, 0.18);
  border-radius: 4px;
  background: rgba(6, 20, 38, 0.5);
  transition: background 0.2s ease, border-color 0.2s ease;
}

.step-item:hover {
  background: rgba(33, 116, 212, 0.06);
  border-color: rgba(61, 166, 255, 0.2);
}

.step-label {
  font-size: 13px;
  font-weight: 600;
  color: #eaf5ff;
}

.step-desc {
  margin-top: 4px;
  font-size: 11px;
  line-height: 18px;
  color: rgba(203, 227, 255, 0.55);
}

.step-meta {
  text-align: right;
  font-size: 11px;
  color: rgba(147, 196, 255, 0.45);
}
</style>
