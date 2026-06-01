<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useThemeStore } from '@/store/modules/theme';
import SvgIcon from '@/components/custom/svg-icon.vue';
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
const darkMode = computed(() => themeStore.darkMode);
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
  <div class="agent-domain-page" :class="{ 'agent-domain-page--dark': darkMode }">
    <div class="agent-shell">
      <aside class="agent-sidebar">
        <AgentSidebar :active-key="agentKey" @select="handleSelect" />
      </aside>

      <section class="agent-main">
        <div class="panel-surface">
          <div class="panel-head">
            <SvgIcon :icon="selectedAgent.icon" class="panel-head__icon" />
            <span class="panel-head__title">{{ selectedAgent.name }}测试台</span>
          </div>
          <div class="panel-body">
            <div class="section-desc">面向 Prompt 调试与结果回看，快速验证智能体当前配置与输出风格。</div>
          </div>
        </div>

        <AgentTestPanel :agent="selectedAgent" :latest-record="latestRecord" @run="handleRun" />
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.agent-domain-page {
  --page-bg:
    radial-gradient(circle at top, rgba(0, 153, 255, 0.14) 0%, rgba(0, 0, 0, 0) 36%),
    linear-gradient(180deg, #041528 0%, #041120 38%, #03101b 100%);
  --surface-bg: linear-gradient(180deg, rgba(3, 19, 41, 0.94) 0%, rgba(2, 15, 32, 0.96) 100%);
  --surface-border: rgba(43, 131, 255, 0.28);
  --line: rgba(25, 95, 176, 0.35);
  --accent: #29a3ff;

  height: 100%;
  background: var(--page-bg);
  color: #eaf5ff;
  overflow: auto;
}

.agent-domain-page--dark {
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
.panel-surface {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  box-shadow: 0 0 0 1px rgba(32, 111, 202, 0.22), 0 18px 40px rgba(1, 8, 18, 0.45);
  position: relative;
  border-radius: 4px;
}

.agent-sidebar::before,
.agent-sidebar::after,
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

.agent-sidebar::before,
.panel-surface::before {
  top: -1px;
  left: -1px;
  border-top: 2px solid var(--accent);
  border-left: 2px solid var(--accent);
  border-radius: 4px 0 0 0;
}

.agent-sidebar::after,
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
  min-width: 0;
  flex-direction: column;
  gap: 10px;
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
  font-size: 12px;
  color: rgba(203, 227, 255, 0.65);
}

@media (max-width: 1199px) {
  .agent-shell {
    grid-template-columns: 1fr;
  }

  .agent-sidebar {
    max-height: 280px;
  }
}
</style>
