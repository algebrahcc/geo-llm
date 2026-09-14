<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NButton, NInput, NTag, useMessage } from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import EmptyState from '@/components/common/empty-state.vue';
import { useDifyApps } from './use-dify-app';
import { useAgentSelection } from './use-agent';
import AgentSidebar from './agent-sidebar.vue';
import { fetchDifyConversations, fetchDifyWorkflowLogs } from '@/service/api/dify';
import { useAuthStore } from '@/store/modules/auth';
import { asList } from './real';

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
/** 时间范围筛选：'' 全部 / today 今天 / 7d 近7天 / 30d 近30天 */
const timeRange = ref('');
/** 排序：'' 默认 / time 时间 / elapsed 耗时 / tokens token 消耗 */
const sortBy = ref('time');

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
  if (isWorkflow.value) return 'var(--ui-sem-green)';
  if (selectedAgent.value?.appType === 2) return 'var(--ui-sem-indigo)';
  return 'var(--ui-sem-sky)';
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

/** 时间范围下限（秒），0 表示不限制 */
function rangeStartTs(): number {
  const now = Date.now() / 1000;
  switch (timeRange.value) {
    case 'today': {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.getTime() / 1000;
    }
    case '7d':
      return now - 7 * 24 * 3600;
    case '30d':
      return now - 30 * 24 * 3600;
    default:
      return 0;
  }
}

const filteredRuns = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  const start = rangeStartTs();
  let list = runs.value.filter(r => {
    if (start && (r.time ?? 0) < start) return false;
    if (!kw) return true;
    return (
      String(r.status || '')
        .toLowerCase()
        .includes(kw) || (r.error || '').toLowerCase().includes(kw)
    );
  });
  if (sortBy.value === 'elapsed') list = [...list].sort((a, b) => (b.elapsed ?? 0) - (a.elapsed ?? 0));
  else if (sortBy.value === 'tokens') list = [...list].sort((a, b) => (b.tokens ?? 0) - (a.tokens ?? 0));
  else list = [...list].sort((a, b) => (b.time ?? 0) - (a.time ?? 0));
  return list;
});

const filteredConvs = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  const start = rangeStartTs();
  let list = conversations.value.filter(c => {
    if (start && (c.time ?? 0) < start) return false;
    if (!kw) return true;
    return c.name.toLowerCase().includes(kw);
  });
  list = [...list].sort((a, b) => (b.time ?? 0) - (a.time ?? 0));
  return list;
});

async function loadData() {
  if (!selectedAgent.value?.key || !userId.value) return;
  loading.value = true;
  try {
    if (isWorkflow.value) {
      const res = await fetchDifyWorkflowLogs({ appId: selectedAgent.value.key });
      const list = asList<Api.Dify.WorkflowLogItem>(res?.data);
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
      const res = await fetchDifyConversations({ appId: selectedAgent.value.key, userId: userId.value });
      const list = asList<Api.Dify.ConversationItem>(res?.data);
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
              <NSelect
                v-model:value="timeRange"
                size="small"
                class="monitor-bar__range"
                :options="[
                  { label: '全部时间', value: '' },
                  { label: '今天', value: 'today' },
                  { label: '近 7 天', value: '7d' },
                  { label: '近 30 天', value: '30d' }
                ]"
              />
              <NSelect
                v-model:value="sortBy"
                size="small"
                class="monitor-bar__range"
                :options="[
                  { label: '按时间排序', value: 'time' },
                  ...(isWorkflow
                    ? [
                        { label: '按耗时排序', value: 'elapsed' },
                        { label: '按 Token 排序', value: 'tokens' }
                      ]
                    : [])
                ]"
              />
              <div class="monitor-bar__count">共 {{ isWorkflow ? filteredRuns.length : filteredConvs.length }} 条</div>
            </div>

            <div v-if="loading" class="monitor-skeleton">
              <div v-for="i in 6" :key="i" class="monitor-skeleton__row" />
            </div>

            <EmptyState
              v-else-if="(isWorkflow ? runs.length : conversations.length) === 0"
              :icon="isWorkflow ? 'mdi:chart-timeline-variant' : 'mdi:chat-outline'"
              :title="isWorkflow ? '暂无运行记录' : '暂无会话记录'"
              :description="
                isWorkflow ? '在工作流「测试」页运行后，记录会显示在这里' : '在「测试」页发起对话后，会话会显示在这里'
              "
            />

            <EmptyState
              v-else-if="isWorkflow && filteredRuns.length === 0"
              icon="mdi:magnify-close"
              title="未找到匹配的运行记录"
            />

            <div v-else-if="isWorkflow" class="monitor-list">
              <div v-for="r in filteredRuns" :key="r.id" class="monitor-row">
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

            <EmptyState v-else-if="filteredConvs.length === 0" icon="mdi:magnify-close" title="未找到匹配的会话" />

            <div v-else class="monitor-list">
              <div v-for="c in filteredConvs" :key="c.id" class="monitor-row">
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
  color: var(--ui-text-33);
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
    width: 220px;
  }

  &__range {
    width: 130px;
  }

  &__count {
    margin-left: auto;
    font-size: 12px;
    color: var(--ui-text-80);
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
  border: 1px solid var(--ui-border-85);
  border-radius: var(--agent-radius-sm);
  background: var(--ui-surface-80);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--ui-accent-140);
    background: var(--ui-surface-77);
    box-shadow: 0 6px 20px var(--ui-shadow-22);
    transform: translateY(-1px);

    .monitor-row__arrow {
      color: var(--ui-accent-4);
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
    color: var(--ui-text-33);
  }

  &__meta {
    display: flex;
    gap: 14px;
    margin-top: 4px;
    font-size: 12px;
    color: var(--ui-text-80);
    flex-wrap: wrap;
  }

  &__error {
    margin-top: 4px;
    font-size: 12px;
    color: var(--ui-text-82);
  }

  &__arrow {
    font-size: 20px;
    color: var(--ui-text-97);
    transition: all 0.2s ease;
  }
}

.conv-icon {
  font-size: 16px;
  color: var(--ui-accent-141);
}

.conv-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.run-id {
  font-family: monospace;
  font-size: 12px;
  color: var(--ui-text-96);
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
    color: var(--ui-accent-50);
    background: var(--ui-border-121);
    border-color: var(--ui-border-122);
  }

  &.failed {
    color: var(--ui-text-82);
    background: var(--ui-text-101);
    border-color: var(--ui-text-102);
  }

  &.running {
    color: var(--ui-accent-52);
    background: var(--ui-border-55);
    border-color: var(--ui-border-56);
  }

  &.stopped {
    color: var(--ui-text-89);
    background: var(--ui-text-91);
    border-color: var(--ui-text-103);
  }
}

.monitor-skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__row {
    height: 64px;
    border-radius: var(--agent-radius-sm);
    background: linear-gradient(100deg, var(--ui-surface-71) 40%, var(--ui-border-36) 50%, var(--ui-surface-71) 60%);
    background-size: 200% 100%;
    animation: monitor-skeleton-loading 1.4s infinite;
    border: 1px solid var(--ui-border-116);
  }
}

@keyframes monitor-skeleton-loading {
  to {
    background-position: -200% 0;
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
