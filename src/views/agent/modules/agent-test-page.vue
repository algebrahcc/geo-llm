<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { agentTestRecords, runAgentTest } from '@/mock/agent';
import AgentSidebar from './agent-sidebar.vue';
import AgentTestPanel from './agent-test-panel.vue';
import { useAgentSelection } from './use-agent';

defineOptions({
  name: 'AgentTestPage'
});

const route = useRoute();
const router = useRouter();
const { agentKey, selectedAgent, updateAgentQuery } = useAgentSelection(route, router);

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
  <div class="agent-domain-page">
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
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.1), transparent 28%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(30, 41, 59, 0.84));
}

@media (max-width: 1199px) {
  .agent-grid {
    grid-template-columns: 1fr;
  }
}
</style>
