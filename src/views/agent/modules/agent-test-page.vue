<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useThemeStore } from '@/store/modules/theme';
import { agentTestRecords, runAgentTest } from '@/mock/agent';
import AgentSidebar from './agent-sidebar.vue';
import AgentTestPanel from './agent-test-panel.vue';
import { useAgentSelection } from './use-agent';

defineOptions({
  name: 'AgentTestPage'
});

const route = useRoute();
const router = useRouter();
const themeStore = useThemeStore();
const { agentKey, selectedAgent, updateAgentQuery } = useAgentSelection(route, router);
const darkMode = computed(() => themeStore.darkMode);

const latestRecord = computed(() => agentTestRecords.find(item => item.agentKey === agentKey.value) || null);

function handleSelect(key: typeof agentKey.value) {
  updateAgentQuery(key);
}

function handleRun(prompt: string) {
  if (!prompt.trim()) {
    window.$message?.warning('请输入测试内容');
    return;
  }

  runAgentTest(agentKey.value, prompt);
  window.$message?.success('测试结果已更新');
}
</script>

<template>
  <div class="agent-domain-page" :class="{ 'agent-domain-page--dark': darkMode }">
    <div class="agent-grid">
      <div class="agent-left">
        <AgentSidebar :active-key="agentKey" @select="handleSelect" />
      </div>

      <div class="agent-main">
        <NCard :bordered="false" class="page-hero">
          <div class="text-22px font-700 text-[#f8fafc]">{{ selectedAgent.name }}测试台</div>
          <div class="mt-8px text-13px text-[#94a3b8]">
            面向 Prompt 调试与结果回看，快速验证智能体当前配置与输出风格。
          </div>
        </NCard>

        <AgentTestPanel :agent="selectedAgent" :latest-record="latestRecord" @run="handleRun" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.agent-domain-page {
  --agent-card-bg:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 28%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.98));
  --agent-card-border: rgba(148, 163, 184, 0.14);
  --agent-card-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
  --agent-title: #0f172a;
  --agent-subtitle: #64748b;
  --agent-panel-bg: rgba(255, 255, 255, 0.78);
  --agent-tag-bg: rgba(59, 130, 246, 0.1);
  --agent-tag-color: #1d4ed8;
  --agent-interactive-bg: rgba(59, 130, 246, 0.08);
  --agent-interactive-border: rgba(59, 130, 246, 0.28);
  --agent-interactive-shadow: 0 10px 22px rgba(59, 130, 246, 0.08);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.agent-domain-page--dark {
  --agent-card-bg:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.1), transparent 28%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(30, 41, 59, 0.84));
  --agent-card-border: rgba(148, 163, 184, 0.12);
  --agent-card-shadow: none;
  --agent-title: #f8fafc;
  --agent-subtitle: #94a3b8;
  --agent-panel-bg: rgba(15, 23, 42, 0.42);
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

.agent-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 16px;
}

.page-hero {
  border-radius: 20px;
  background: var(--agent-card-bg);
  border: 1px solid var(--agent-card-border);
  box-shadow: var(--agent-card-shadow);
}

.agent-domain-page :deep(.text-\[\#f8fafc\]) {
  color: var(--agent-title) !important;
}

.agent-domain-page :deep(.text-\[\#94a3b8\]) {
  color: var(--agent-subtitle) !important;
}

@media (max-width: 1199px) {
  .agent-grid {
    grid-template-columns: 1fr;
  }
}
</style>
