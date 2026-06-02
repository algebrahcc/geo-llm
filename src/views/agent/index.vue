<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useThemeStore } from '@/store/modules/theme';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { agentDefinitions, createAgentDefinition, createAgentRunTask, getTasksByAgentKey, type AgentCreateModel } from '@/mock/agent';
import AgentLogList from './modules/agent-log-list.vue';
import AgentSidebar from './modules/agent-sidebar.vue';
import AgentStageBoard from './modules/agent-stage-board.vue';
import AgentCreateForm from './modules/agent-create-form.vue';
import { useAgentSelection } from './modules/use-agent';

defineOptions({
  name: 'AgentWorkbenchPage'
});

const route = useRoute();
const router = useRouter();
const themeStore = useThemeStore();
const darkMode = computed(() => themeStore.darkMode);
const { agentKey, selectedAgent, updateAgentQuery } = useAgentSelection(route, router);

type PageMode = 'workbench' | 'create';
const pageMode = ref<PageMode>('workbench');

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
  // If in create mode, selecting an agent switches back to workbench
  if (pageMode.value === 'create') {
    pageMode.value = 'workbench';
  }
  updateAgentQuery(key);
  const nextAgent = agentDefinitions.find(item => item.key === key);
  if (!nextAgent) return;

  runForm.title = `${nextAgent.name}任务`;
  runForm.input = nextAgent.defaultInput;
}

function handleCreateClick() {
  pageMode.value = 'create';
}

function handleCreateCancel() {
  pageMode.value = 'workbench';
}

function handleCreateSubmit(payload: AgentCreateModel) {
  const agent = createAgentDefinition(payload);
  pageMode.value = 'workbench';
  updateAgentQuery(agent.key);
  window.$message?.success(`智能体「${agent.name}」创建成功`);
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
    <div class="agent-shell">
      <aside class="agent-sidebar">
        <AgentSidebar :active-key="agentKey" @select="handleAgentSelect" @create="handleCreateClick" />
      </aside>

      <!-- Workbench Mode -->
      <section v-if="pageMode === 'workbench'" class="agent-main">
        <!-- Hero Panel -->
        <div class="panel-surface">
          <div class="panel-head">
            <SvgIcon :icon="selectedAgent.icon" class="panel-head__icon" />
            <span class="panel-head__title">{{ selectedAgent.name }}</span>
            <div class="ml-auto flex gap-6px">
              <NButton secondary size="small" @click="navigateToSubPage('agent_config')">配置</NButton>
              <NButton secondary size="small" @click="navigateToSubPage('agent_test')">测试</NButton>
              <NButton type="primary" size="small" @click="handleRun">开始运行</NButton>
            </div>
          </div>
          <div class="panel-body">
            <div class="section-desc">{{ selectedAgent.description }}</div>
            <div class="mt-10px flex flex-wrap gap-4px">
              <NTag v-for="item in selectedAgent.capabilityTags" :key="item" size="small" round :bordered="false" class="capability-tag">
                {{ item }}
              </NTag>
            </div>
            <div class="mt-14px grid gap-10px md:grid-cols-3">
              <div class="metric-item">
                <span class="metric-label">默认模型</span>
                <span class="metric-value">{{ selectedAgent.model }}</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">置信度</span>
                <span class="metric-value">{{ selectedAgent.confidence }}%</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">平均耗时</span>
                <span class="metric-value">{{ selectedAgent.avgDuration }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="run-grid">
          <!-- Input Panel -->
          <div class="panel-surface">
            <div class="panel-head">
              <SvgIcon icon="mdi:play-circle-outline" class="panel-head__icon" />
              <span class="panel-head__title">运行输入</span>
            </div>
            <div class="panel-body">
              <NForm label-placement="top" :show-feedback="false">
                <NFormItem label="任务标题">
                  <NInput v-model:value="runForm.title" />
                </NFormItem>
                <NFormItem label="任务内容">
                  <NInput v-model:value="runForm.input" type="textarea" :autosize="{ minRows: 5, maxRows: 8 }" />
                </NFormItem>
              </NForm>
              <div class="flex flex-wrap gap-4px mt-8px">
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
            </div>
          </div>

          <!-- Config Summary Panel -->
          <div class="panel-surface">
            <div class="panel-head">
              <SvgIcon icon="mdi:clipboard-text-outline" class="panel-head__icon" />
              <span class="panel-head__title">配置摘要</span>
            </div>
            <div class="panel-body">
              <div class="flex flex-col gap-8px">
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
            </div>
          </div>
        </div>

        <AgentStageBoard :agent="selectedAgent" :task="latestTask" />
        <AgentLogList :tasks="currentTasks" @view="goTaskDetail" />
      </section>

      <!-- Create Mode -->
      <section v-else class="agent-main agent-main--create">
        <div class="panel-surface create-panel">
          <div class="panel-head">
            <SvgIcon icon="mdi:sparkles" class="panel-head__icon" />
            <span class="panel-head__title">新建智能体</span>
            <div class="ml-auto">
              <NButton quaternary size="small" @click="handleCreateCancel">
                <template #icon>
                  <SvgIcon icon="mdi:close" />
                </template>
                返回工作台
              </NButton>
            </div>
          </div>
          <div class="panel-body create-panel__body">
            <AgentCreateForm @submit="handleCreateSubmit" @cancel="handleCreateCancel" />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.agent-page {
  --page-bg:
    radial-gradient(circle at top, rgba(0, 153, 255, 0.14) 0%, rgba(0, 0, 0, 0) 36%),
    linear-gradient(180deg, #041528 0%, #041120 38%, #03101b 100%);
  --surface-bg: linear-gradient(180deg, rgba(3, 19, 41, 0.94) 0%, rgba(2, 15, 32, 0.96) 100%);
  --surface-border: rgba(43, 131, 255, 0.28);
  --line: rgba(25, 95, 176, 0.35);
  --accent: #29a3ff;
  --text-primary: #eaf5ff;
  --text-secondary: rgba(203, 227, 255, 0.72);
  --text-tertiary: rgba(147, 196, 255, 0.62);

  height: 100%;
  background: var(--page-bg);
  color: var(--text-primary);
  overflow: auto;
}

.agent-page--dark {
  color-scheme: dark;
}

.agent-shell {
  height: 100%;
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  gap: 10px;
  padding: 12px 14px;
  box-sizing: border-box;
}

.agent-sidebar,
.agent-main .panel-surface {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  box-shadow: 0 0 0 1px rgba(32, 111, 202, 0.22), 0 18px 40px rgba(1, 8, 18, 0.45);
  position: relative;
  border-radius: 4px;
}

/* Sidebar corner accents */
.agent-sidebar::before,
.agent-sidebar::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  pointer-events: none;
  z-index: 2;
  opacity: 0.35;
}

.agent-sidebar::before {
  top: -1px;
  left: -1px;
  border-top: 2px solid var(--accent);
  border-left: 2px solid var(--accent);
  border-radius: 4px 0 0 0;
}

.agent-sidebar::after {
  bottom: -1px;
  right: -1px;
  border-bottom: 2px solid var(--accent);
  border-right: 2px solid var(--accent);
  border-radius: 0 0 4px 0;
}

/* Panel corner accents */
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
  border-top: 2px solid var(--accent);
  border-left: 2px solid var(--accent);
  border-radius: 4px 0 0 0;
}

.panel-surface::after {
  bottom: -1px;
  right: -1px;
  border-bottom: 2px solid var(--accent);
  border-right: 2px solid var(--accent);
  border-radius: 0 0 4px 0;
}

.agent-sidebar {
  min-width: 0;
  overflow: hidden;
}

.agent-main {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.agent-main--create {
  overflow: auto;
}

.create-panel {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.create-panel__body {
  flex: 1;
  overflow: auto;
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 14px;
  border-bottom: 1px solid var(--line);
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
  background: linear-gradient(180deg, transparent, var(--accent), transparent);
  opacity: 0.5;
}

.panel-head__icon {
  font-size: 16px;
  color: var(--accent);
  filter: drop-shadow(0 0 4px rgba(41, 163, 255, 0.25));
}

.panel-head__title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-shadow: 0 0 8px rgba(41, 163, 255, 0.12);
}

.panel-body {
  padding: 14px;
}

.section-desc {
  font-size: 13px;
  color: var(--text-secondary);
}

.metric-item,
.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 4px;
  background: rgba(6, 20, 38, 0.5);
  border: 1px solid rgba(25, 95, 176, 0.18);
}

.metric-label,
.summary-label {
  font-size: 11px;
  color: var(--text-tertiary);
}

.metric-value,
.summary-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.capability-tag {
  background: rgba(41, 163, 255, 0.1);
  border: 1px solid rgba(41, 163, 255, 0.22);
  color: rgba(203, 227, 255, 0.82);
}

.prompt-tag {
  cursor: pointer;
  background: rgba(41, 163, 255, 0.1);
  border: 1px solid rgba(41, 163, 255, 0.22);
  color: rgba(203, 227, 255, 0.82);
}

.run-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1.2fr) minmax(240px, 0.8fr);
}

/* Scrollbar */
.agent-page::-webkit-scrollbar {
  width: 8px;
}

.agent-page::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(48, 127, 212, 0.45);
}

.agent-page::-webkit-scrollbar-track {
  background: transparent;
}

@media (max-width: 1199px) {
  .agent-shell {
    grid-template-columns: 1fr;
  }

  .agent-sidebar {
    max-height: 280px;
  }

  .run-grid {
    grid-template-columns: 1fr;
  }
}
</style>
