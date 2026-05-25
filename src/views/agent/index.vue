<script setup lang="ts">
import { computed, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useThemeStore } from '@/store/modules/theme';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { agentDefinitions, createAgentRunTask, getTasksByAgentKey } from '@/mock/agent';
import AgentLogList from './modules/agent-log-list.vue';
import AgentSidebar from './modules/agent-sidebar.vue';
import AgentStageBoard from './modules/agent-stage-board.vue';
import { useAgentSelection } from './modules/use-agent';

defineOptions({
  name: 'AgentWorkbenchPage'
});

const route = useRoute();
const router = useRouter();
const themeStore = useThemeStore();
const { agentKey, selectedAgent, updateAgentQuery } = useAgentSelection(route, router);
const darkMode = computed(() => themeStore.darkMode);

const runForm = reactive({
  title: '',
  input: ''
});

const currentTasks = computed(() => getTasksByAgentKey(agentKey.value));
const latestTask = computed(() => currentTasks.value[0] || null);

function syncInputWithAgent() {
  runForm.title = `${selectedAgent.value.name}任务`;
  runForm.input = selectedAgent.value.defaultInput;
}

syncInputWithAgent();

function handleAgentSelect(key: typeof agentKey.value) {
  updateAgentQuery(key);
  const nextAgent = agentDefinitions.find(item => item.key === key);
  if (!nextAgent) return;

  runForm.title = `${nextAgent.name}任务`;
  runForm.input = nextAgent.defaultInput;
}

function navigateToSubPage(name: 'agent_config' | 'agent_test') {
  router.push({
    name: name as never,
    query: {
      ...route.query,
      agent: agentKey.value
    }
  });
}

function handleRun() {
  if (!runForm.input.trim()) {
    window.$message?.warning('请先输入任务内容');
    return;
  }

  const task = createAgentRunTask({
    agentKey: agentKey.value,
    title: runForm.title,
    input: runForm.input
  });

  window.$message?.success('已生成一次智能体运行记录');
  router.push({
    name: 'agent_task_detail' as never,
    query: {
      id: task.id,
      agent: agentKey.value
    }
  });
}

function goTaskDetail(taskId: string) {
  router.push({
    name: 'agent_task_detail' as never,
    query: {
      id: taskId,
      agent: agentKey.value
    }
  });
}
</script>

<template>
  <div class="agent-page" :class="{ 'agent-page--dark': darkMode }">
    <div class="agent-grid">
      <div class="agent-left">
        <AgentSidebar :active-key="agentKey" @select="handleAgentSelect" />
      </div>

      <div class="agent-main">
        <NCard :bordered="false" class="hero-card">
          <div class="flex flex-wrap items-start justify-between gap-18px">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-10px">
                <div class="hero-icon">
                  <SvgIcon :icon="selectedAgent.icon" />
                </div>
                <div>
                  <div class="text-22px font-700 text-[#f8fafc]">{{ selectedAgent.name }}</div>
                  <div class="mt-6px text-13px text-[#94a3b8]">{{ selectedAgent.description }}</div>
                </div>
              </div>

              <div class="mt-16px flex flex-wrap gap-8px">
                <NTag v-for="item in selectedAgent.capabilityTags" :key="item" size="small" round :bordered="false">
                  {{ item }}
                </NTag>
              </div>

              <div class="mt-18px grid gap-12px md:grid-cols-3">
                <div class="metric-item">
                  <span class="metric-label">默认模型</span>
                  <span class="metric-value">{{ selectedAgent.model }}</span>
                </div>
                <div class="metric-item">
                  <span class="metric-label">成功率</span>
                  <span class="metric-value">{{ selectedAgent.successRate }}%</span>
                </div>
                <div class="metric-item">
                  <span class="metric-label">平均耗时</span>
                  <span class="metric-value">{{ selectedAgent.avgDuration }}</span>
                </div>
              </div>
            </div>

            <div class="flex flex-wrap gap-8px">
              <NButton secondary @click="navigateToSubPage('agent_config')">配置</NButton>
              <NButton secondary @click="navigateToSubPage('agent_test')">测试</NButton>
              <NButton type="primary" @click="handleRun">开始运行</NButton>
            </div>
          </div>
        </NCard>

        <div class="run-grid">
          <NCard :bordered="false" class="input-card">
            <template #header>
              <div>
                <div class="text-16px font-700 text-[#f8fafc]">运行输入</div>
                <div class="mt-4px text-12px text-[#8ea3bd]">
                  填写任务描述、上下文和目标，让智能体发起一次完整运行。
                </div>
              </div>
            </template>

            <NForm label-placement="top" :show-feedback="false">
              <NFormItem label="任务标题">
                <NInput v-model:value="runForm.title" />
              </NFormItem>
              <NFormItem label="任务内容">
                <NInput v-model:value="runForm.input" type="textarea" :autosize="{ minRows: 7, maxRows: 10 }" />
              </NFormItem>
            </NForm>

            <div class="flex flex-wrap gap-8px">
              <NTag
                v-for="item in selectedAgent.recommendedPrompts"
                :key="item"
                size="small"
                round
                :bordered="false"
                class="prompt-tag"
                @click="runForm.input = item"
              >
                {{ item }}
              </NTag>
            </div>
          </NCard>

          <NCard :bordered="false" class="context-card">
            <template #header>
              <div>
                <div class="text-16px font-700 text-[#f8fafc]">当前配置摘要</div>
                <div class="mt-4px text-12px text-[#8ea3bd]">帮助你快速确认工具链、版本与最近状态。</div>
              </div>
            </template>

            <div class="flex flex-col gap-12px">
              <div class="summary-item">
                <span class="summary-label">版本</span>
                <span class="summary-value">{{ selectedAgent.version }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">分类</span>
                <span class="summary-value">{{ selectedAgent.category }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">工具链</span>
                <span class="summary-value">{{ selectedAgent.tools.join(' / ') }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">最近任务</span>
                <span class="summary-value">{{ latestTask?.title || '暂无任务' }}</span>
              </div>
            </div>
          </NCard>
        </div>

        <AgentStageBoard :agent="selectedAgent" :task="latestTask" />
        <AgentLogList :tasks="currentTasks" @view="goTaskDetail" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.agent-page {
  --agent-card-bg:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 30%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.98));
  --agent-panel-bg: rgba(255, 255, 255, 0.78);
  --agent-card-border: rgba(148, 163, 184, 0.14);
  --agent-card-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
  --agent-title: #0f172a;
  --agent-subtitle: #64748b;
  --agent-meta: #64748b;
  --agent-strong: #0f172a;
  --agent-tag-bg: rgba(59, 130, 246, 0.1);
  --agent-tag-color: #1d4ed8;
  --agent-interactive-bg: rgba(59, 130, 246, 0.08);
  --agent-interactive-border: rgba(59, 130, 246, 0.28);
  --agent-interactive-shadow: 0 10px 22px rgba(59, 130, 246, 0.08);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.agent-page--dark {
  --agent-card-bg:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.1), transparent 30%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(30, 41, 59, 0.84));
  --agent-panel-bg: rgba(15, 23, 42, 0.42);
  --agent-card-border: rgba(148, 163, 184, 0.12);
  --agent-card-shadow: none;
  --agent-title: #f8fafc;
  --agent-subtitle: #94a3b8;
  --agent-meta: #7890ad;
  --agent-strong: #f8fafc;
  --agent-tag-bg: rgba(59, 130, 246, 0.14);
  --agent-tag-color: #dbeafe;
  --agent-interactive-bg: rgba(30, 41, 59, 0.86);
  --agent-interactive-border: rgba(96, 165, 250, 0.38);
  --agent-interactive-shadow: none;
}

.agent-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: 300px minmax(0, 1fr);
}

.agent-left,
.agent-main {
  min-width: 0;
}

.agent-main {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hero-card,
.input-card,
.context-card {
  border-radius: 20px;
  background: var(--agent-card-bg);
  border: 1px solid var(--agent-card-border);
  box-shadow: var(--agent-card-shadow);
}

.hero-icon {
  display: flex;
  width: 46px;
  height: 46px;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: var(--agent-tag-bg);
  color: var(--agent-tag-color);
}

.metric-item,
.summary-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border: 1px solid var(--agent-card-border);
  border-radius: 16px;
  background: var(--agent-panel-bg);
}

.metric-label,
.summary-label {
  font-size: 12px;
  color: var(--agent-meta);
}

.metric-value,
.summary-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--agent-strong);
}

.run-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
}

.prompt-tag {
  cursor: pointer;
  background: var(--agent-tag-bg);
  color: var(--agent-tag-color);
}

.agent-page :deep(.text-\[\#f8fafc\]) {
  color: var(--agent-title) !important;
}

.agent-page :deep(.text-\[\#94a3b8\]),
.agent-page :deep(.text-\[\#8ea3bd\]) {
  color: var(--agent-subtitle) !important;
}

@media (max-width: 1199px) {
  .agent-grid,
  .run-grid {
    grid-template-columns: 1fr;
  }
}
</style>
