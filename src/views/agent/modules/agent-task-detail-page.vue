<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useThemeStore } from '@/store/modules/theme';
import SvgIcon from '@/components/custom/svg-icon.vue';
import type { AgentRunTask } from './types';
import {
  fetchDifyChat,
  fetchDifyConversationMessages,
  fetchDifyConversations,
  fetchDifyFeedback,
  fetchDifySuggestedQuestions,
  fetchDifyWorkflowRun,
  fetchDifyWorkflowRunDetail,
  renameDifyConversation
} from '@/service/api/dify';
import { useAuthStore } from '@/store/modules/auth';
import AgentTaskTimeline from './agent-task-timeline.vue';
import { useDifyApps } from './use-dify-app';
import {
  buildConversationTask,
  buildWorkflowTaskFromDetail,
  normalizeSuggestedQuestions,
  stringifyOutput
} from './real';
import { asList, extractPayload } from '../../knowledge/modules/real';

defineOptions({
  name: 'AgentTaskDetailPage'
});

const route = useRoute();
const router = useRouter();
const themeStore = useThemeStore();
const darkMode = computed(() => themeStore.darkMode);
const authStore = useAuthStore();
const userId = computed(() => String(authStore.userInfo.userId ?? ''));
const { resolveAgent } = useDifyApps();

const taskId = computed(() => String(route.query.id || ''));
const agentKey = computed(() => String(route.query.agent || ''));
const detailKind = computed<'chat' | 'workflow'>(() => (route.query.kind === 'workflow' ? 'workflow' : 'chat'));
const detail = ref<AgentRunTask | null>(null);
const loading = ref(false);
const rerunning = ref(false);
const renaming = ref(false);
const feedbackLoading = ref<'like' | 'dislike' | ''>('');
const suggestedQuestions = ref<string[]>([]);
const renameValue = ref('');
const agent = computed(() => resolveAgent(agentKey.value));
const activeAgentKey = computed(() => agent.value.key || agentKey.value);
const currentAppId = computed(() => {
  const value = Number(activeAgentKey.value);
  return Number.isFinite(value) && value > 0 ? value : undefined;
});

function goBack() {
  router.push({
    name: 'agent_workbench' as never,
    query: {
      agent: activeAgentKey.value,
      input: detail.value?.input
    }
  });
}

async function loadSuggestedQuestions(messageId: string) {
  if (!currentAppId.value || !userId.value) {
    suggestedQuestions.value = [];
    return;
  }

  try {
    const res = await fetchDifySuggestedQuestions({
      appId: currentAppId.value,
      messageId,
      userId: userId.value
    });
    suggestedQuestions.value = normalizeSuggestedQuestions(
      (extractPayload<Api.Dify.SuggestedQuestionsResp>(res) as Api.Dify.SuggestedQuestionsResp | null) || undefined
    );
  } catch {
    suggestedQuestions.value = [];
  }
}

async function loadChatDetail() {
  if (!currentAppId.value || !taskId.value || !userId.value) {
    detail.value = null;
    return;
  }

  const [convRes, msgRes] = await Promise.all([
    fetchDifyConversations({
      appId: currentAppId.value,
      userId: userId.value,
      limit: 20
    }),
    fetchDifyConversationMessages({
      appId: currentAppId.value,
      userId: userId.value,
      conversationId: taskId.value,
      limit: 20
    })
  ]);

  const conversations = asList<Api.Dify.ConversationItem>(extractPayload(convRes));
  const messages = asList<Api.Dify.ConversationMessage>(extractPayload(msgRes));
  const conversation = conversations.find(item => item.id === taskId.value) || {
    id: taskId.value,
    name: `${agent.value.name}会话`,
    inputs: {},
    status: 'completed'
  };

  detail.value = buildConversationTask({
    agent: agent.value,
    conversation,
    messages
  });
  renameValue.value = conversation.name || detail.value.title;
  if (detail.value.messageId) {
    await loadSuggestedQuestions(detail.value.messageId);
  } else {
    suggestedQuestions.value = [];
  }
}

async function loadWorkflowDetail() {
  if (!currentAppId.value || !taskId.value) {
    detail.value = null;
    return;
  }

  const res = await fetchDifyWorkflowRunDetail({
    appId: currentAppId.value,
    workflowRunId: taskId.value
  });
  const payload = (extractPayload<Api.Dify.WorkflowRunDetail>(res) as Api.Dify.WorkflowRunDetail | null) || null;
  if (!payload) {
    detail.value = null;
    return;
  }

  detail.value = buildWorkflowTaskFromDetail({
    agent: agent.value,
    workflowRunId: taskId.value,
    detail: payload
  });
  renameValue.value = detail.value.title;
  suggestedQuestions.value = [];
}

async function loadDetail() {
  if (!taskId.value || !agentKey.value) {
    detail.value = null;
    return;
  }

  loading.value = true;
  try {
    if (detailKind.value === 'workflow') {
      await loadWorkflowDetail();
    } else {
      await loadChatDetail();
    }
  } catch {
    detail.value = null;
    window.$message?.error(detailKind.value === 'workflow' ? '加载工作流详情失败' : '加载会话详情失败');
  } finally {
    loading.value = false;
  }
}

async function handleRename() {
  if (detailKind.value !== 'chat' || !taskId.value || !currentAppId.value || !userId.value) {
    return;
  }

  try {
    renaming.value = true;
    await renameDifyConversation(taskId.value, {
      appId: currentAppId.value,
      userId: userId.value,
      name: renameValue.value
    });
    window.$message?.success('会话名称已更新');
    await loadDetail();
  } catch {
    window.$message?.error('会话重命名失败');
  } finally {
    renaming.value = false;
  }
}

async function handleFeedback(rating: 'like' | 'dislike') {
  if (detailKind.value !== 'chat' || !detail.value?.messageId || !currentAppId.value || !userId.value) {
    return;
  }

  try {
    feedbackLoading.value = rating;
    await fetchDifyFeedback({
      appId: currentAppId.value,
      messageId: detail.value.messageId,
      userId: userId.value,
      rating
    });
    window.$message?.success(rating === 'like' ? '已记录正向反馈' : '已记录问题反馈');
  } catch {
    window.$message?.error('反馈提交失败');
  } finally {
    feedbackLoading.value = '';
  }
}

async function handleRerun(nextInput?: string) {
  if (!detail.value || !currentAppId.value || !userId.value) return;

  try {
    rerunning.value = true;
    if (detailKind.value === 'workflow') {
      const res = await fetchDifyWorkflowRun({
        appId: currentAppId.value,
        userId: userId.value,
        inputs: detail.value.rawInputs || (nextInput ? { query: nextInput } : {})
      });
      const payload = extractPayload<Api.Dify.WorkflowRunResp>(res) as Api.Dify.WorkflowRunResp | null;
      const workflowRunId = String(
        payload?.workflow_run_id || payload?.data?.workflow_run_id || payload?.data?.id || ''
      );
      if (!workflowRunId) {
        window.$message?.warning('后端未返回新的工作流执行 ID');
        return;
      }
      router.replace({
        name: 'agent_task_detail' as never,
        query: {
          id: workflowRunId,
          agent: activeAgentKey.value,
          kind: 'workflow'
        }
      });
      return;
    }

    const res = await fetchDifyChat({
      appId: currentAppId.value,
      userId: userId.value,
      query: (nextInput || detail.value.input).trim(),
      inputs: detail.value.rawInputs || {},
      autoGenerateName: true
    });
    const payload = extractPayload<Api.Dify.ChatResp>(res) as Api.Dify.ChatResp | null;
    if (!payload?.conversationId) {
      window.$message?.warning('后端未返回新的会话 ID');
      return;
    }
    router.replace({
      name: 'agent_task_detail' as never,
      query: {
        id: payload.conversationId,
        agent: activeAgentKey.value,
        kind: 'chat'
      }
    });
  } catch {
    window.$message?.error('重新运行失败，请稍后重试');
  } finally {
    rerunning.value = false;
  }
}

watch([taskId, agentKey, detailKind], () => {
  loadDetail();
});

onMounted(loadDetail);
</script>

<template>
  <div class="task-detail-page" :class="{ 'task-detail-page--dark': darkMode }">
    <div class="detail-shell">
      <template v-if="detail">
        <div class="panel-surface detail-hero">
          <div class="panel-head">
            <SvgIcon icon="mdi:clipboard-text-clock-outline" class="panel-head__icon" />
            <span class="panel-head__title">{{ detailKind === 'workflow' ? '执行详情' : '会话详情' }}</span>
          </div>
          <div class="panel-body">
            <div class="flex flex-wrap items-start justify-between gap-14px">
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-8px">
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
                  <NTag size="small" round :bordered="false" type="info">
                    {{ detailKind === 'workflow' ? '工作流' : '对话' }}
                  </NTag>
                </div>
                <div class="doc-title">{{ detail.title }}</div>
                <div class="doc-meta">{{ detail.createdAt }} · {{ detail.operator }}</div>
                <div class="doc-summary">{{ detail.summary }}</div>

                <div v-if="detailKind === 'chat'" class="rename-row">
                  <NInput v-model:value="renameValue" placeholder="请输入会话名称" />
                  <NButton secondary :loading="renaming" @click="handleRename">保存名称</NButton>
                </div>
              </div>
              <div class="flex flex-wrap gap-6px">
                <NButton secondary @click="goBack">返回</NButton>
                <NButton
                  v-if="detailKind === 'chat'"
                  secondary
                  :loading="feedbackLoading === 'like'"
                  @click="handleFeedback('like')"
                >
                  赞同
                </NButton>
                <NButton
                  v-if="detailKind === 'chat'"
                  secondary
                  :loading="feedbackLoading === 'dislike'"
                  @click="handleFeedback('dislike')"
                >
                  反馈问题
                </NButton>
                <NButton type="primary" :loading="rerunning" @click="handleRerun()">重新运行</NButton>
              </div>
            </div>
          </div>
        </div>

        <div class="grid gap-10px xl:grid-cols-[1.1fr_0.9fr]">
          <div class="panel-surface">
            <div class="panel-head">
              <SvgIcon icon="mdi:format-list-checks" class="panel-head__icon" />
              <span class="panel-head__title">执行步骤</span>
            </div>
            <div class="panel-body">
              <AgentTaskTimeline :task="detail" />
            </div>
          </div>

          <div class="flex flex-col gap-10px">
            <div class="panel-surface">
              <div class="panel-head">
                <SvgIcon icon="mdi:text-box-outline" class="panel-head__icon" />
                <span class="panel-head__title">任务输入</span>
              </div>
              <div class="panel-body">
                <div class="text-block">{{ detail.input }}</div>
              </div>
            </div>

            <div class="panel-surface">
              <div class="panel-head">
                <SvgIcon icon="mdi:text-box-check-outline" class="panel-head__icon" />
                <span class="panel-head__title">结果输出</span>
              </div>
              <div class="panel-body">
                <div class="result-text">{{ detail.result }}</div>
              </div>
            </div>

            <div class="panel-surface">
              <div class="panel-head">
                <SvgIcon icon="mdi:chart-box-outline" class="panel-head__icon" />
                <span class="panel-head__title">运行指标</span>
              </div>
              <div class="panel-body">
                <div class="grid gap-8px">
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
              </div>
            </div>

            <div class="panel-surface">
              <div class="panel-head">
                <SvgIcon icon="mdi:link-variant" class="panel-head__icon" />
                <span class="panel-head__title">{{ detailKind === 'workflow' ? '输出结构' : '建议问题' }}</span>
              </div>
              <div class="panel-body">
                <template v-if="detailKind === 'workflow'">
                  <div class="result-json">{{ stringifyOutput(detail.rawOutput || {}) }}</div>
                </template>
                <template v-else>
                  <NEmpty v-if="!suggestedQuestions.length" description="当前会话暂无建议问题" />
                  <div v-else class="flex flex-wrap gap-4px">
                    <NTag
                      v-for="item in suggestedQuestions"
                      :key="item"
                      size="small"
                      round
                      :bordered="false"
                      class="question-tag"
                      @click="handleRerun(item)"
                    >
                      {{ item }}
                    </NTag>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div v-else-if="!loading" class="panel-surface">
        <div class="panel-body">
          <NEmpty description="记录不存在或已被清空">
            <template #extra>
              <NButton secondary @click="goBack">返回工作台</NButton>
            </template>
          </NEmpty>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.task-detail-page {
  height: 100%;
  background: var(--agent-page-bg);
  color: var(--agent-text);
  overflow: auto;
}

.task-detail-page--dark {
  color-scheme: dark;
}

.detail-shell {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.doc-title {
  margin-top: 14px;
  font-size: 20px;
  font-weight: 700;
  color: #eaf5ff;
}

.doc-meta {
  margin-top: 6px;
  font-size: 12px;
  color: rgba(147, 196, 255, 0.5);
}

.doc-summary {
  margin-top: 12px;
  max-width: 860px;
  font-size: 13px;
  line-height: 22px;
  color: rgba(203, 227, 255, 0.65);
}

.rename-row {
  display: flex;
  gap: 10px;
  margin-top: 14px;
  max-width: 520px;
}

.text-block {
  font-size: 12px;
  line-height: 20px;
  color: rgba(203, 227, 255, 0.65);
  white-space: pre-wrap;
}

.result-text,
.result-json {
  font-size: 12px;
  line-height: 20px;
  color: rgba(41, 163, 255, 0.85);
  white-space: pre-wrap;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 4px;
  background: rgba(6, 20, 38, 0.5);
  color: rgba(203, 227, 255, 0.65);
  font-size: 12px;
}

.question-tag {
  cursor: pointer;
  background: rgba(41, 163, 255, 0.1);
  border: 1px solid rgba(41, 163, 255, 0.22);
  color: rgba(203, 227, 255, 0.82);
}
</style>
