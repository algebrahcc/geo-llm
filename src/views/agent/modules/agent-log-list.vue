<script setup lang="ts">
import { computed } from 'vue';
import SvgIcon from '@/components/custom/svg-icon.vue';
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
.panel-surface {
  background: linear-gradient(180deg, rgba(3, 19, 41, 0.94) 0%, rgba(2, 15, 32, 0.96) 100%);
  border: 1px solid rgba(43, 131, 255, 0.28);
  box-shadow: 0 0 0 1px rgba(32, 111, 202, 0.22), 0 18px 40px rgba(1, 8, 18, 0.45);
  border-radius: 4px;
  position: relative;
}

.panel-surface::before,
.panel-surface::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  pointer-events: none;
  z-index: 2;
  opacity: 0.35;
}

.panel-surface::before {
  top: -1px;
  left: -1px;
  border-top: 2px solid #29a3ff;
  border-left: 2px solid #29a3ff;
  border-radius: 4px 0 0 0;
}

.panel-surface::after {
  bottom: -1px;
  right: -1px;
  border-bottom: 2px solid #29a3ff;
  border-right: 2px solid #29a3ff;
  border-radius: 0 0 4px 0;
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 14px;
  border-bottom: 1px solid rgba(25, 95, 176, 0.35);
  background: linear-gradient(180deg, rgba(10, 38, 72, 0.96) 0%, rgba(5, 25, 47, 0.96) 100%);
  position: relative;
}

.panel-head::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  bottom: 20%;
  width: 2px;
  border-radius: 1px;
  background: linear-gradient(180deg, transparent, #29a3ff, transparent);
  opacity: 0.5;
}

.panel-head__icon {
  font-size: 16px;
  color: #29a3ff;
  filter: drop-shadow(0 0 4px rgba(41, 163, 255, 0.25));
}

.panel-head__title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: #eaf5ff;
  text-shadow: 0 0 8px rgba(41, 163, 255, 0.12);
}

.panel-body {
  padding: 14px;
}

.section-desc {
  font-size: 11px;
  color: rgba(147, 196, 255, 0.5);
}

.task-item {
  padding: 12px 14px;
  border: 1px solid rgba(25, 95, 176, 0.18);
  border-radius: 4px;
  background: rgba(6, 20, 38, 0.5);
  transition: background 0.2s ease, border-color 0.2s ease;
}

.task-item:hover {
  background: rgba(33, 116, 212, 0.08);
  border-color: rgba(61, 166, 255, 0.25);
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
