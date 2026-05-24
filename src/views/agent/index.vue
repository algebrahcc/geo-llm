<script setup lang="ts">
import { computed, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
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
const { agentKey, selectedAgent, updateAgentQuery } = useAgentSelection(route, router);

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
  <div class="agent-page">
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
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.1), transparent 30%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(30, 41, 59, 0.84));
}

.hero-icon {
  display: flex;
  width: 46px;
  height: 46px;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: rgba(59, 130, 246, 0.14);
  color: #dbeafe;
}

.metric-item,
.summary-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.42);
}

.metric-label,
.summary-label {
  font-size: 12px;
  color: #7890ad;
}

.metric-value,
.summary-value {
  font-size: 14px;
  font-weight: 600;
  color: #f8fafc;
}

.run-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
}

.prompt-tag {
  cursor: pointer;
  background: rgba(59, 130, 246, 0.14);
  color: #dbeafe;
}

@media (max-width: 1199px) {
  .agent-grid,
  .run-grid {
    grid-template-columns: 1fr;
  }
}
</style>
