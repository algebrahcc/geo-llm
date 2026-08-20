<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NButton, NInput, NTag, useMessage } from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { useDifyApps } from './use-dify-app';
import { useAgentSelection } from './use-agent';
import AgentSidebar from './agent-sidebar.vue';
import { fetchDifyConversations, fetchDifyWorkflowLogs } from '@/service/api/dify';
import { useAuthStore } from '@/store/modules/auth';

defineOptions({
  name: 'AgentMonitorPage'
});

const route = useRoute();
const router = useRouter();
const message = useMessage();
const authStore = useAuthStore();
const userId = computed(() => String(authStore.userInfo?.userId ?? ''));

const { resolveAgent, realApps, agentList, loading: agentLoading } = useDifyApps();
const { agentKey, selectedAgent, updateAgentQuery } = useAgentSelection(route, router, resolveAgent, realApps);

const isWorkflow = computed(() => selectedAgent.value?.appType === 3);
const loading = ref(false);
const keyword = ref('');

interface ConvRow {
  id: string;
  name: string;
  time: number;
  status: string;
}
const conversations = ref<ConvRow[]>([]);

interface RunRow {
  id: string;
  status: string;
  elapsed: number;
  tokens: number;
  steps: number;
  time: number;
  error?: string | null;
}
const runs = ref<RunRow[]>([]);

const typeLabel = computed(() =>
  isWorkflow.value ? '工作流' : selectedAgent.value?.appType === 2 ? 'Agent' : '聊天助手'
);
const typeColor = computed(() => {
  if (isWorkflow.value) return '#34d399';
  if (selectedAgent.value?.appType === 2) return '#8b5cf6';
  return '#38bdf8';
});

function fmtTime(ts?: number) {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  return `${d.toLocaleDateString('zh-CN')} ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
}

function statusText(s: string): string {
  const map: Record<string, string> = {
    succeeded: '成功',
    success: '成功',
    failed: '失败',
    stopped: '已停止',
    running: '运行中',
    normal: '正常'
  };
  return map[s] || s;
}

const filteredRuns = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return runs.value;
  return runs.value.filter(
    r =>
      String(r.status || '')
        .toLowerCase()
        .includes(kw) || (r.error || '').toLowerCase().includes(kw)
  );
});

const filteredConvs = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return conversations.value;
  return conversations.value.filter(c => c.name.toLowerCase().includes(kw));
});

async function loadData() {
  if (!selectedAgent.value?.difyAppId || !userId.value) return;
  loading.value = true;
  try {
    if (isWorkflow.value) {
      const res = await fetchDifyWorkflowLogs({ appId: selectedAgent.value.difyAppId });
      const list = (res as unknown as Api.Dify.WorkflowLogList)?.data ?? [];
      runs.value = list.map(item => {
        const wf = item.workflow_run ?? {};
        return {
          id: wf.id || item.id || '',
          status: wf.status || 'unknown',
          elapsed: wf.elapsed_time ?? 0,
          tokens: wf.total_tokens ?? 0,
          steps: wf.total_steps ?? 0,
          time: wf.created_at ?? item.created_at ?? 0,
          error: wf.error ?? null
        };
      });
    } else {
      const res = await fetchDifyConversations({ appId: selectedAgent.value.difyAppId, userId: userId.value });
      const list = (res as unknown as Api.Dify.ConversationList)?.data ?? [];
      conversations.value = list.map(item => ({
        id: item.id,
        name: item.name || item.introduction || '未命名会话',
        time: item.created_at ?? 0,
        status: item.status || 'normal'
      }));
    }
  } catch (error: any) {
    message.error(error?.message || '加载监控数据失败');
  } finally {
    loading.value = false;
  }
}

function openDetail(row: ConvRow | RunRow) {
  const id = (row as { id?: string | number }).id;
  if (!id) return;
  router.push({
    name: 'agent_task_detail',
    query: {
      id,
      agent: agentKey.value,
      kind: isWorkflow.value ? 'workflow' : 'chat',
      from: 'monitor'
    }
  });
}

function handleSelect(key: string) {
  updateAgentQuery(key);
}

watch(
  () => selectedAgent.value?.key,
  k => {
    if (k) {
      keyword.value = '';
      loadData();
    }
  },
  { immediate: true }
);

onMounted(loadData);
</script>

<template>
  <div class="agent-domain-page">
    <div class="agent-shell">
      <aside class="agent-sidebar panel-surface">
        <AgentSidebar :active-key="agentKey" :agents="agentList" :loading="agentLoading" @select="handleSelect" />
      </aside>

      <section class="agent-main">
        <div class="panel-surface">
          <div class="panel-head">
            <SvgIcon icon="mdi:chart-line" class="panel-head__icon" />
            <span class="panel-head__title">{{ selectedAgent.name }}</span>
            <NTag
              size="small"
              round
              :bordered="false"
              class="type-tag"
              :style="{ color: typeColor, borderColor: typeColor + '66', background: typeColor + '1a' }"
            >
              {{ typeLabel }}
            </NTag>
            <span class="section-desc" style="margin-left: 10px">
              {{ isWorkflow ? '运行记录' : '会话记录' }}
            </span>
            <div class="ml-auto flex gap-8px">
              <NButton secondary size="small" @click="loadData">
                <template #icon>
                  <SvgIcon icon="mdi:refresh" />
                </template>
                刷新
              </NButton>
            </div>
          </div>
          <div class="panel-body">
            <div v-if="isWorkflow ? runs.length : conversations.length" class="monitor-bar">
              <NInput
                v-model:value="keyword"
                :placeholder="isWorkflow ? '搜索状态 / 错误信息' : '搜索会话名称'"
                clearable
                size="small"
                class="monitor-bar__search"
              >
                <template #prefix>
                  <SvgIcon icon="mdi:magnify" />
                </template>
              </NInput>
              <div class="monitor-bar__count">共 {{ isWorkflow ? runs.length : conversations.length }} 条</div>
            </div>

            <div v-if="loading" class="monitor-skeleton">
              <div v-for="i in 6" :key="i" class="monitor-skeleton__row" />
            </div>

            <div v-else-if="(isWorkflow ? runs.length : conversations.length) === 0" class="agent-empty custom-empty">
              <div class="custom-empty__icon">
                <SvgIcon :icon="isWorkflow ? 'mdi:chart-timeline-variant' : 'mdi:chat-outline'" />
              </div>
              <div class="custom-empty__title">{{ isWorkflow ? '暂无运行记录' : '暂无会话记录' }}</div>
              <div class="custom-empty__desc">
                {{
                  isWorkflow ? '在工作流「测试」页运行后，记录会显示在这里' : '在「测试」页发起对话后，会话会显示在这里'
                }}
              </div>
            </div>

            <div v-else-if="isWorkflow && filteredRuns.length === 0" class="agent-empty custom-empty">
              <div class="custom-empty__icon">
                <SvgIcon icon="mdi:magnify-close" />
              </div>
              <div class="custom-empty__title">未找到匹配的运行记录</div>
            </div>

            <div v-else-if="isWorkflow" class="monitor-list">
              <div v-for="r in filteredRuns" :key="r.id" class="monitor-row" @click="openDetail(r)">
                <div class="monitor-row__main">
                  <div class="monitor-row__title">
                    <span class="status-badge" :class="r.status">{{ statusText(r.status) }}</span>
                    <span class="run-id">#{{ r.id }}</span>
                  </div>
                  <div class="monitor-row__meta">
                    <span>{{ fmtTime(r.time) }}</span>
                    <span>耗时 {{ r.elapsed }}s</span>
                    <span>Token {{ r.tokens }}</span>
                    <span>{{ r.steps }} 步</span>
                  </div>
                  <div v-if="r.error" class="monitor-row__error">{{ r.error }}</div>
                </div>
                <SvgIcon icon="mdi:chevron-right" class="monitor-row__arrow" />
              </div>
            </div>

            <div v-else-if="filteredConvs.length === 0" class="agent-empty custom-empty">
              <div class="custom-empty__icon">
                <SvgIcon icon="mdi:magnify-close" />
              </div>
              <div class="custom-empty__title">未找到匹配的会话</div>
            </div>

            <div v-else class="monitor-list">
              <div v-for="c in filteredConvs" :key="c.id" class="monitor-row" @click="openDetail(c)">
                <div class="monitor-row__main">
                  <div class="monitor-row__title">
                    <SvgIcon icon="mdi:chat-outline" class="conv-icon" />
                    <span class="conv-name">{{ c.name }}</span>
                  </div>
                  <div class="monitor-row__meta">
                    <span>创建于 {{ fmtTime(c.time) }}</span>
                    <span>状态 {{ c.status }}</span>
                  </div>
                </div>
                <SvgIcon icon="mdi:chevron-right" class="monitor-row__arrow" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.agent-domain-page {
  height: 100%;
  background: var(--agent-page-bg);
  color: #eaf5ff;
  overflow: auto;
}

.agent-shell {
  height: 100%;
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  gap: 10px;
  padding: 12px 14px;
  box-sizing: border-box;
}

.agent-sidebar {
  min-width: 0;
  overflow: visible;
}

.agent-main {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.type-tag {
  margin-left: 8px;
}

.monitor-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;

  &__search {
    width: 260px;
  }

  &__count {
    font-size: 12px;
    color: rgba(203, 227, 255, 0.5);
  }
}

.monitor-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.monitor-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid rgba(25, 95, 176, 0.3);
  border-radius: var(--agent-radius-sm);
  background: rgba(7, 28, 52, 0.5);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(61, 166, 255, 0.4);
    background: rgba(10, 32, 58, 0.6);
    box-shadow: 0 6px 20px rgba(2, 10, 22, 0.4);
    transform: translateY(-1px);

    .monitor-row__arrow {
      color: #29a3ff;
      transform: translateX(2px);
    }
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: #eaf5ff;
  }

  &__meta {
    display: flex;
    gap: 14px;
    margin-top: 4px;
    font-size: 12px;
    color: rgba(203, 227, 255, 0.5);
    flex-wrap: wrap;
  }

  &__error {
    margin-top: 4px;
    font-size: 12px;
    color: #ff7a7a;
  }

  &__arrow {
    font-size: 20px;
    color: rgba(203, 227, 255, 0.35);
    transition: all 0.2s ease;
  }
}

.conv-icon {
  font-size: 16px;
  color: rgba(56, 189, 248, 0.8);
}

.conv-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.run-id {
  font-family: monospace;
  font-size: 12px;
  color: rgba(203, 227, 255, 0.45);
}

.status-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid;
  flex-shrink: 0;

  &.succeeded,
  &.success,
  &.normal {
    color: #34d399;
    background: rgba(52, 211, 153, 0.1);
    border-color: rgba(52, 211, 153, 0.25);
  }

  &.failed {
    color: #ff7a7a;
    background: rgba(255, 122, 122, 0.1);
    border-color: rgba(255, 122, 122, 0.25);
  }

  &.running {
    color: #fbbf24;
    background: rgba(251, 191, 36, 0.1);
    border-color: rgba(251, 191, 36, 0.25);
  }

  &.stopped {
    color: rgba(203, 227, 255, 0.7);
    background: rgba(147, 196, 255, 0.08);
    border-color: rgba(147, 196, 255, 0.2);
  }
}

.monitor-skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__row {
    height: 64px;
    border-radius: var(--agent-radius-sm);
    background: linear-gradient(
      100deg,
      rgba(7, 28, 52, 0.4) 40%,
      rgba(41, 163, 255, 0.08) 50%,
      rgba(7, 28, 52, 0.4) 60%
    );
    background-size: 200% 100%;
    animation: monitor-skeleton-loading 1.4s infinite;
    border: 1px solid rgba(25, 95, 176, 0.12);
  }
}

@keyframes monitor-skeleton-loading {
  to {
    background-position: -200% 0;
  }
}

.custom-empty {
  padding: 60px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;

  &__icon {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    color: rgba(41, 163, 255, 0.35);
    border-radius: 18px;
    background: rgba(41, 163, 255, 0.06);
    border: 1px solid rgba(25, 95, 176, 0.18);
  }

  &__title {
    font-size: 15px;
    font-weight: 700;
    color: #eaf5ff;
  }

  &__desc {
    font-size: 12px;
    color: rgba(203, 227, 255, 0.5);
    max-width: 360px;
  }
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
