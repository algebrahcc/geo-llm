<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useThemeStore } from '@/store/modules/theme';
import { getAgentByKey, getTaskById, rerunAgentTask } from '@/mock/agent';
import AgentTaskTimeline from './agent-task-timeline.vue';

defineOptions({
  name: 'AgentTaskDetailPage'
});

const route = useRoute();
const router = useRouter();
const themeStore = useThemeStore();
const darkMode = computed(() => themeStore.darkMode);

const taskId = computed(() => String(route.query.id || ''));
const detail = computed(() => getTaskById(taskId.value));
const agent = computed(() => getAgentByKey(detail.value?.agentKey));

function goBack() {
  router.push({
    name: 'agent_workbench' as never,
    query: {
      agent: detail.value?.agentKey || route.query.agent
    }
  });
}

function handleRerun() {
  if (!detail.value) return;

  const task = rerunAgentTask(detail.value.id);
  if (!task) return;

  window.$message?.success('已生成重跑任务');
  router.replace({
    name: 'agent_task_detail' as never,
    query: {
      id: task.id,
      agent: task.agentKey
    }
  });
}
</script>

<template>
  <div class="task-detail-page" :class="{ 'task-detail-page--dark': darkMode }">
    <template v-if="detail">
      <NCard :bordered="false" class="detail-hero">
        <div class="flex flex-wrap items-start justify-between gap-16px">
          <div>
            <div class="flex flex-wrap items-center gap-10px">
              <NButton quaternary @click="goBack">返回工作台</NButton>
              <NTag size="small" round :bordered="false">{{ agent.name }}</NTag>
              <NTag
                size="small"
                round
                :type="detail.status === 'success' ? 'success' : detail.status === 'running' ? 'warning' : 'error'"
                :bordered="false"
              >
                {{ detail.status === 'success' ? '已完成' : detail.status === 'running' ? '运行中' : '失败' }}
              </NTag>
            </div>
            <div class="mt-16px text-28px font-700 text-[#f8fafc]">{{ detail.title }}</div>
            <div class="mt-8px text-13px text-[#94a3b8]">{{ detail.createdAt }} · {{ detail.operator }}</div>
            <div class="mt-14px max-w-920px text-14px leading-24px text-[#cbd5e1]">{{ detail.summary }}</div>
          </div>
          <div class="flex gap-8px">
            <NButton secondary @click="goBack">返回</NButton>
            <NButton type="primary" @click="handleRerun">重新运行</NButton>
          </div>
        </div>
      </NCard>

      <div class="grid gap-16px xl:grid-cols-[1.1fr_0.9fr]">
        <NCard :bordered="false" class="detail-card" title="执行步骤">
          <AgentTaskTimeline :task="detail" />
        </NCard>

        <div class="flex flex-col gap-16px">
          <NCard :bordered="false" class="detail-card" title="任务输入">
            <div class="text-13px leading-24px text-[#cbd5e1]">{{ detail.input }}</div>
          </NCard>
          <NCard :bordered="false" class="detail-card" title="结果输出">
            <div class="text-13px leading-24px text-[#dbeafe]">{{ detail.result }}</div>
          </NCard>
          <NCard :bordered="false" class="detail-card" title="运行指标">
            <div class="grid gap-10px">
              <div class="metric-row">
                <span>耗时</span>
                <span>{{ detail.metrics.duration }}</span>
              </div>
              <div class="metric-row">
                <span>Tokens</span>
                <span>{{ detail.metrics.tokens }}</span>
              </div>
              <div class="metric-row">
                <span>置信度</span>
                <span>{{ detail.metrics.confidence }}%</span>
              </div>
            </div>
          </NCard>
          <NCard :bordered="false" class="detail-card" title="引用来源">
            <div class="flex flex-wrap gap-8px">
              <NTag v-for="item in detail.references" :key="item" size="small" round :bordered="false">{{ item }}</NTag>
            </div>
          </NCard>
        </div>
      </div>
    </template>

    <NCard v-else :bordered="false" class="detail-card">
      <NEmpty description="任务不存在或已被清空">
        <template #extra>
          <NButton secondary @click="goBack">返回工作台</NButton>
        </template>
      </NEmpty>
    </NCard>
  </div>
</template>

<style scoped>
.task-detail-page {
  --agent-card-bg:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 28%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.98));
  --agent-card-border: rgba(148, 163, 184, 0.14);
  --agent-card-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
  --agent-panel-bg: rgba(255, 255, 255, 0.78);
  --agent-title: #0f172a;
  --agent-subtitle: #64748b;
  --agent-body: #334155;
  --agent-interactive-bg: rgba(59, 130, 246, 0.08);
  --agent-interactive-border: rgba(59, 130, 246, 0.28);
  --agent-interactive-shadow: 0 10px 22px rgba(59, 130, 246, 0.08);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.task-detail-page--dark {
  --agent-card-bg:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 28%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(30, 41, 59, 0.84));
  --agent-card-border: rgba(148, 163, 184, 0.12);
  --agent-card-shadow: none;
  --agent-panel-bg: rgba(15, 23, 42, 0.42);
  --agent-title: #f8fafc;
  --agent-subtitle: #94a3b8;
  --agent-body: #cbd5e1;
  --agent-interactive-bg: rgba(30, 41, 59, 0.86);
  --agent-interactive-border: rgba(96, 165, 250, 0.38);
  --agent-interactive-shadow: none;
}

.detail-hero,
.detail-card {
  border-radius: 20px;
  background: var(--agent-card-bg);
  border: 1px solid var(--agent-card-border);
  box-shadow: var(--agent-card-shadow);
}

.metric-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--agent-panel-bg);
  color: var(--agent-body);
  font-size: 13px;
}

.task-detail-page :deep(.text-\[\#f8fafc\]) {
  color: var(--agent-title) !important;
}

.task-detail-page :deep(.text-\[\#94a3b8\]) {
  color: var(--agent-subtitle) !important;
}

.task-detail-page :deep(.text-\[\#cbd5e1\]),
.task-detail-page :deep(.text-\[\#dbeafe\]) {
  color: var(--agent-body) !important;
}
</style>
