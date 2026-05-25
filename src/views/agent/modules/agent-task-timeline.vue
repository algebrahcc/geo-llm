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
  <div class="flex flex-col gap-12px">
    <div v-for="step in task.steps" :key="step.key" class="step-item">
      <div class="flex flex-wrap items-start justify-between gap-10px">
        <div>
          <div class="flex items-center gap-8px">
            <span class="text-14px font-600 text-[#f8fafc]">{{ step.label }}</span>
            <NTag size="small" round :type="statusMeta[step.status].type" :bordered="false">
              {{ statusMeta[step.status].label }}
            </NTag>
          </div>
          <div class="mt-8px text-12px leading-20px text-[#94a3b8]">{{ step.description }}</div>
        </div>
        <div class="text-right text-12px text-[#7890ad]">
          <div>{{ step.duration }}</div>
          <div v-if="step.tool" class="mt-4px">{{ step.tool }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.step-item {
  padding: 14px 16px;
  border: 1px solid var(--agent-card-border, rgba(148, 163, 184, 0.12));
  border-radius: 18px;
  background: var(--agent-panel-bg, rgba(15, 23, 42, 0.42));
}

.step-item :deep(.text-\[\#f8fafc\]) {
  color: var(--agent-title, #0f172a) !important;
}

.step-item :deep(.text-\[\#94a3b8\]),
.step-item :deep(.text-\[\#7890ad\]) {
  color: var(--agent-subtitle, #64748b) !important;
}
</style>
