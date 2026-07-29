<script setup lang="ts">
import { computed } from 'vue';
import SvgIcon from '@/components/custom/svg-icon.vue';
import type { AgentRunTask } from './types';

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
  <div class="panel-surface">
    <div class="panel-head">
      <SvgIcon icon="mdi:format-list-bulleted" class="panel-head__icon" />
      <span class="panel-head__title">运行日志</span>
      <NTag size="small" round :bordered="false" class="ml-auto">{{ sortedTasks.length }} 条</NTag>
    </div>
    <div class="panel-body">
      <div class="section-desc">展示最近任务、状态、摘要和引用入口。</div>
      <div class="flex flex-col gap-8px mt-10px">
        <div v-for="task in sortedTasks" :key="task.id" class="task-item">
          <div class="flex flex-wrap items-start justify-between gap-8px">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-6px">
                <div class="task-title">{{ task.title }}</div>
                <NTag size="small" round :type="statusMeta[task.status].type" :bordered="false">
                  {{ statusMeta[task.status].label }}
                </NTag>
              </div>
              <div class="task-summary">{{ task.summary }}</div>
              <div class="task-meta">
                <span>{{ task.createdAt }}</span>
                <span>{{ task.metrics.duration }}</span>
                <span>{{ task.references.length }} 条引用</span>
              </div>
            </div>
            <NButton size="small" secondary @click="emit('view', task.id)">查看详情</NButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.task-item {
  padding: 12px 14px;
  border: 1px solid rgba(25, 95, 176, 0.2);
  border-radius: var(--agent-radius-sm);
  background: rgba(6, 20, 38, 0.5);
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.task-item:hover {
  background: rgba(33, 116, 212, 0.1);
  border-color: rgba(61, 166, 255, 0.3);
  box-shadow: 0 6px 20px rgba(2, 10, 22, 0.38);
  transform: translateY(-1px);
}

.task-title {
  font-size: 13px;
  font-weight: 600;
  color: #eaf5ff;
}

.task-summary {
  margin-top: 6px;
  font-size: 11px;
  line-height: 18px;
  color: rgba(203, 227, 255, 0.55);
}

.task-meta {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: rgba(147, 196, 255, 0.45);
}
</style>
