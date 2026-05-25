<script setup lang="ts">
import { computed } from 'vue';
import type { AgentRunTask } from '@/mock/agent';

const props = defineProps<{
  tasks: AgentRunTask[];
}>();

const emit = defineEmits<{
  view: [taskId: string];
}>();

const statusMeta = {
  running: { label: '运行中', type: 'warning' as const },
  success: { label: '已完成', type: 'success' as const },
  failed: { label: '失败', type: 'error' as const }
};

const sortedTasks = computed(() => [...props.tasks]);
</script>

<template>
  <NCard :bordered="false" class="log-card">
    <template #header>
      <div class="flex items-center justify-between gap-12px">
        <div>
          <div class="text-16px font-700 text-[#f8fafc]">运行日志</div>
          <div class="mt-4px text-12px text-[#8ea3bd]">展示最近任务、状态、摘要和引用入口。</div>
        </div>
        <NTag size="small" round :bordered="false">{{ sortedTasks.length }} 条</NTag>
      </div>
    </template>

    <div class="flex flex-col gap-10px">
      <div v-for="task in sortedTasks" :key="task.id" class="task-item">
        <div class="flex flex-wrap items-start justify-between gap-10px">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-8px">
              <div class="truncate text-14px font-600 text-[#f8fafc]">{{ task.title }}</div>
              <NTag size="small" round :type="statusMeta[task.status].type" :bordered="false">
                {{ statusMeta[task.status].label }}
              </NTag>
            </div>
            <div class="mt-8px text-12px leading-20px text-[#94a3b8]">{{ task.summary }}</div>
            <div class="mt-10px flex flex-wrap items-center gap-10px text-12px text-[#7890ad]">
              <span>{{ task.createdAt }}</span>
              <span>{{ task.metrics.duration }}</span>
              <span>{{ task.references.length }} 条引用</span>
            </div>
          </div>
          <NButton size="small" secondary @click="emit('view', task.id)">查看详情</NButton>
        </div>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
.log-card {
  border-radius: 20px;
  background: var(
    --agent-card-bg,
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 28%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.82))
  );
  border: 1px solid var(--agent-card-border, rgba(148, 163, 184, 0.12));
  box-shadow: var(--agent-card-shadow, none);
}

.task-item {
  padding: 14px 16px;
  border: 1px solid var(--agent-card-border, rgba(148, 163, 184, 0.12));
  border-radius: 18px;
  background: var(--agent-panel-bg, rgba(15, 23, 42, 0.42));
}

.log-card :deep(.text-\[\#f8fafc\]) {
  color: var(--agent-title, #0f172a) !important;
}

.log-card :deep(.text-\[\#8ea3bd\]),
.log-card :deep(.text-\[\#7890ad\]),
.log-card :deep(.text-\[\#94a3b8\]) {
  color: var(--agent-subtitle, #64748b) !important;
}
</style>
