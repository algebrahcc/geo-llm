<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NModal, NSpin, useDialog, useMessage } from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { useDifyApps } from './modules/use-dify-app';
import type { AgentDefinition } from './modules/types';
import AgentCard from './modules/agent-card.vue';
import AgentCreateForm from './modules/agent-create-form.vue';
import { fetchDifyAppCreateFromConsole, fetchDifyAppUpdate } from '@/service/api/difyApp';

const router = useRouter();
const message = useMessage();
const dialog = useDialog();

const { realApps, loading, loadRealApps, deleteAgent, buildConsoleUrl } = useDifyApps();

const filterType = ref<'all' | 'chat' | 'agent-chat' | 'workflow'>('all');

const typeValueMap: Record<string, number> = { chat: 1, 'agent-chat': 2, workflow: 3 };

const filteredApps = computed(() => {
  if (filterType.value === 'all') return realApps.value;
  const target = typeValueMap[filterType.value];
  return realApps.value.filter(a => a.appType === target);
});

const filterOptions = [
  { value: 'all', label: '全部', icon: 'mdi:apps' },
  { value: 'chat', label: '聊天助手', icon: 'mdi:chat-outline' },
  { value: 'agent-chat', label: '智能体', icon: 'mdi:robot-outline' },
  { value: 'workflow', label: '工作流', icon: 'mdi:workflow' }
] as const;

const showCreate = ref(false);
const editing = ref<AgentDefinition | null>(null);

function openRun(app: AgentDefinition) {
  router.push({ name: 'agent_test', query: { agent: app.key } });
}

function openConfig(app: AgentDefinition) {
  router.push({ name: 'agent_config', query: { agent: app.key } });
}

function openOrchestrate(app: AgentDefinition) {
  if (app.difyAppId) {
    window.open(buildConsoleUrl(app), '_blank');
  } else {
    message.warning('该应用尚未绑定远端应用，无法跳转编排');
  }
}

function editApp(app: AgentDefinition) {
  editing.value = app;
  showCreate.value = true;
}

function removeAppConfirm(app: AgentDefinition) {
  dialog.warning({
    title: '删除应用',
    content: `确定删除「${app.name}」？此操作不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const ok = await deleteAgent(String(app.key));
      if (ok) message.success('已删除');
    }
  });
}

async function handleSubmit(model: {
  name: string;
  description?: string;
  type: 1 | 2 | 3;
  icon?: string;
  icon_background?: string;
}) {
  try {
    if (editing.value) {
      await fetchDifyAppUpdate(editing.value.key, {
        name: model.name,
        description: model.description,
        type: model.type
      });
      message.success('已保存');
    } else {
      // 在编排控制台真正创建应用并绑定回本地
      await fetchDifyAppCreateFromConsole({
        name: model.name,
        description: model.description,
        type: model.type
      });
      message.success('已创建「' + model.name + '」，可进入编排');
    }
    showCreate.value = false;
    editing.value = null;
    await loadRealApps();
  } catch (error: any) {
    message.error(error?.message || '创建失败，请检查后端编排控制台配置');
  }
}
</script>

<template>
  <div class="agent-page agent-fade-in">
    <div class="agent-shell">
      <section class="agent-main">
        <div class="panel-surface">
          <div class="panel-head">
            <SvgIcon icon="mdi:robot-outline" class="panel-head__icon" />
            <span class="panel-head__title">智能体应用</span>
            <span class="section-desc" style="margin-left: 10px">管理你的智能体应用</span>
            <div class="panel-head__extra">
              <button type="button" class="head-btn" :disabled="loading" title="刷新" @click="loadRealApps">
                <SvgIcon icon="mdi:refresh" :class="{ 'is-spin': loading }" />
              </button>
              <NButton type="primary" size="small" @click="((showCreate = true), (editing = null))">
                <template #icon>
                  <SvgIcon icon="mdi:plus" />
                </template>
                创建应用
              </NButton>
            </div>
          </div>
          <div class="panel-body">
            <nav class="filter-bar">
              <button
                v-for="opt in filterOptions"
                :key="String(opt.value)"
                type="button"
                class="filter-chip"
                :class="{ 'filter-chip--active': filterType === opt.value }"
                @click="filterType = opt.value"
              >
                <SvgIcon :icon="opt.icon" />
                <span>{{ opt.label }}</span>
                <span v-if="opt.value === 'all'" class="filter-chip__count">{{ realApps.length }}</span>
                <span v-else class="filter-chip__count">
                  {{ realApps.filter(a => a.appType === typeValueMap[opt.value]).length }}
                </span>
              </button>
            </nav>

            <NSpin :show="loading">
              <div v-if="filteredApps.length" class="grid-inner">
                <AgentCard
                  v-for="app in filteredApps"
                  :key="app.key"
                  :app="app"
                  @open="openRun"
                  @config="openConfig"
                  @edit="editApp"
                  @orchestrate="openOrchestrate"
                  @remove="removeAppConfirm"
                />
              </div>
              <div v-else class="agent-empty">
                <SvgIcon icon="mdi:robot-confused-outline" class="agent-empty__icon" />
                <div class="agent-empty__hint">暂无应用，点击右上角「创建应用」</div>
              </div>
            </NSpin>
          </div>
        </div>
      </section>
    </div>

    <NModal v-model:show="showCreate" preset="card" :title="editing ? '编辑应用' : '创建应用'" style="width: 520px">
      <AgentCreateForm :initial="editing" @submit="handleSubmit" @cancel="showCreate = false" />
    </NModal>
  </div>
</template>

<style scoped lang="scss">
.agent-page {
  height: 100%;
  background: var(--agent-page-bg);
  color: var(--agent-text);
  overflow: auto;
}

.agent-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  box-sizing: border-box;
}

.agent-main {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.head-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid var(--agent-surface-border);
  background: var(--agent-accent-soft);
  color: var(--agent-text-dim);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--agent-accent);
    background: rgba(52, 168, 255, 0.2);
    color: var(--agent-accent);
    box-shadow: 0 0 10px rgba(52, 168, 255, 0.2);
  }
}

.is-spin {
  animation: agent-spin 0.8s linear infinite;
}

@keyframes agent-spin {
  to {
    transform: rotate(360deg);
  }
}

.filter-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid rgba(25, 95, 176, 0.22);
  border-radius: 999px;
  background: rgba(6, 20, 38, 0.5);
  color: var(--agent-text-dim);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(61, 166, 255, 0.45);
    background: rgba(10, 32, 58, 0.6);
    color: var(--agent-text);
  }

  &--active {
    background: linear-gradient(90deg, rgba(19, 95, 182, 0.5) 0%, rgba(9, 46, 92, 0.4) 100%);
    border-color: rgba(61, 166, 255, 0.5);
    color: #fff;
    box-shadow: inset 0 0 12px rgba(52, 168, 255, 0.18);
  }

  &__count {
    font-size: 12px;
    opacity: 0.7;
  }
}

.grid-inner {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(264px, 1fr));
  gap: 14px;
}
</style>
