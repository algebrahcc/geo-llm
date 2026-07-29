<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { UploadFileInfo } from 'naive-ui';
import { useRoute, useRouter } from 'vue-router';
import { useThemeStore } from '@/store/modules/theme';
import SvgIcon from '@/components/custom/svg-icon.vue';
import type { AgentCreateModel, AgentRunTask } from './modules/types';
import { fetchDifyAppCreate } from '@/service/api/difyApp';
import {
  fetchDifyChat,
  fetchDifyChatStream,
  fetchDifyConversationMessages,
  fetchDifyConversations,
  fetchDifyFileUpload,
  fetchDifyMeta,
  fetchDifyParameters,
  fetchDifyWorkflowLogs,
  fetchDifyWorkflowRun
} from '@/service/api/dify';
import AgentLogList from './modules/agent-log-list.vue';
import AgentSidebar from './modules/agent-sidebar.vue';
import AgentStageBoard from './modules/agent-stage-board.vue';
import AgentCreateForm from './modules/agent-create-form.vue';
import { useAgentSelection } from './modules/use-agent';
import { useDifyApps } from './modules/use-dify-app';
import { useAuthStore } from '@/store/modules/auth';
import {
  buildConversationTask,
  buildInitialParameterValues,
  buildWorkflowTaskFromDetail,
  buildWorkflowTaskFromLog,
  normalizeFileCapability,
  normalizeParameterFields,
  normalizeSuggestedQuestions
} from './modules/real';
import { asList, extractPayload } from '../knowledge/modules/real';

defineOptions({
  name: 'AgentWorkbenchPage'
});

const route = useRoute();
const router = useRouter();
const themeStore = useThemeStore();
const darkMode = computed(() => themeStore.darkMode);
const { agentList, resolveAgent, loading: agentLoading, loadRealApps, deleteAgent } = useDifyApps();
const { agentKey, selectedAgent, updateAgentQuery } = useAgentSelection(route, router, resolveAgent, agentList);
const authStore = useAuthStore();
const userId = computed(() => String(authStore.userInfo.userId ?? ''));
const activeAgentKey = computed(() => selectedAgent.value.key || agentKey.value);
const currentAppId = computed(() => {
  const value = Number(activeAgentKey.value);
  return Number.isFinite(value) && value > 0 ? value : undefined;
});

type PageMode = 'workbench' | 'create';
const pageMode = ref<PageMode>('workbench');
const runtimeLoading = ref(false);
const capabilityLoading = ref(false);
const running = ref(false);
const currentTasks = ref<AgentRunTask[]>([]);
const agentParameters = ref<Api.Dify.AppParameters | null>(null);
const agentMeta = ref<Api.Dify.AppMeta | null>(null);
const uploadFiles = ref<UploadFileInfo[]>([]);
const remoteFileUrls = ref('');

const runForm = reactive({
  title: '',
  input: ''
});

const parameterValues = reactive<Record<string, unknown>>({});

const latestTask = computed(() => currentTasks.value[0] || null);
const isWorkflow = computed(() => selectedAgent.value.appType === 3);
const isAgentApp = computed(() => selectedAgent.value.appType === 2);
const parameterFields = computed(() => normalizeParameterFields(agentParameters.value));
const fileCapability = computed(() => normalizeFileCapability(agentParameters.value));
const promptSuggestions = computed(() => {
  const fromParameters = normalizeSuggestedQuestions({
    data: asList<string>(agentParameters.value?.suggested_questions)
  });
  return fromParameters.length ? fromParameters : selectedAgent.value.recommendedPrompts;
});
const capabilityTags = computed(() => {
  const tags = new Set<string>(selectedAgent.value.capabilityTags || []);
  if (fileCapability.value.enabled) tags.add('支持附件');
  if (agentParameters.value?.suggested_questions_after_answer?.enabled) tags.add('建议追问');
  return Array.from(tags).filter(Boolean);
});
const runtimeLabel = computed(() => {
  if (runtimeLoading.value) return '同步记录中';
  if (isWorkflow.value) return '工作流应用';
  if (isAgentApp.value) return 'Agent 应用';
  return '对话应用';
});
const introText = computed(() => {
  return String(
    agentParameters.value?.opening_statement || selectedAgent.value.description || '请选择输入内容后开始运行。'
  );
});
const toolsSummary = computed(() => selectedAgent.value.tools.join(' / ') || '标准执行链路');

function syncInputWithAgent() {
  runForm.title = `${selectedAgent.value.name}任务`;
  runForm.input = typeof route.query.input === 'string' ? route.query.input : selectedAgent.value.defaultInput;
}

function resetParameterValues() {
  Object.keys(parameterValues).forEach(key => {
    // 清空旧参数键，避免切换智能体后残留上一份参数
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete parameterValues[key];
  });
  Object.assign(parameterValues, buildInitialParameterValues(parameterFields.value));
}

function resolveUploadType(fileName: string) {
  const lowerName = fileName.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lowerName)) return 'image';
  if (/\.(mp3|wav|aac|flac|ogg|m4a)$/.test(lowerName)) return 'audio';
  if (/\.(mp4|mov|avi|mkv|webm)$/.test(lowerName)) return 'video';
  return 'document';
}

function handleLocalFileChange(options: { fileList: UploadFileInfo[] }) {
  uploadFiles.value = options.fileList.slice(0, fileCapability.value.limit);
}

function handleLocalFileRemove(options: { fileList: UploadFileInfo[] }) {
  uploadFiles.value = options.fileList;
}

function getFieldStringValue(name: string) {
  const value = parameterValues[name];
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}

function getFieldNumberValue(name: string) {
  const value = parameterValues[name];
  return typeof value === 'number' ? value : null;
}

function getFieldSelectValue(name: string) {
  const value = parameterValues[name];
  if (typeof value === 'string' || typeof value === 'number') return value;
  return value == null ? null : String(value);
}

function getFieldSwitchValue(name: string) {
  return Boolean(parameterValues[name]);
}

function updateFieldValue(name: string, value: unknown) {
  parameterValues[name] = value;
}

function buildRuntimeInputs() {
  const inputs: Record<string, unknown> = {};

  parameterFields.value.forEach(field => {
    const value = parameterValues[field.name];
    if (field.kind === 'switch') {
      if (value === true || field.required) {
        inputs[field.name] = Boolean(value);
      }
      return;
    }

    if (value == null) return;
    if (typeof value === 'string' && !value.trim()) return;
    inputs[field.name] = value;
  });

  if (isWorkflow.value && runForm.input.trim()) {
    const preferredField = parameterFields.value.find(field =>
      /^(query|prompt|input|content|instruction)$/i.test(field.name)
    );
    if (preferredField && !inputs[preferredField.name]) {
      inputs[preferredField.name] = runForm.input.trim();
    } else if (!parameterFields.value.length) {
      inputs.query = runForm.input.trim();
    }
  }

  return inputs;
}

async function collectRuntimeFiles() {
  const files: Api.Dify.MessageFile[] = [];

  const localFiles = uploadFiles.value.map(item => item.file).filter((file): file is File => Boolean(file));

  for (const file of localFiles) {
    const res = await fetchDifyFileUpload(currentAppId.value, userId.value, file);
    const payload = extractPayload<Api.Dify.FileUploadResp>(res) as Api.Dify.FileUploadResp | null;
    const fileId = String(payload?.id || '');
    if (fileId) {
      files.push({
        type: resolveUploadType(file.name),
        transfer_method: 'local_file',
        upload_file_id: fileId
      });
    }
  }

  if (fileCapability.value.supportRemoteUrl && remoteFileUrls.value.trim()) {
    remoteFileUrls.value
      .split(/\r?\n|,/)
      .map(item => item.trim())
      .filter(Boolean)
      .forEach(url => {
        files.push({
          type: 'document',
          transfer_method: 'remote_url',
          url
        });
      });
  }

  return files;
}

async function loadCapabilities() {
  if (!currentAppId.value) {
    agentParameters.value = null;
    agentMeta.value = null;
    resetParameterValues();
    return;
  }

  capabilityLoading.value = true;
  try {
    const [parameterRes, metaRes] = await Promise.all([
      fetchDifyParameters(currentAppId.value),
      fetchDifyMeta(currentAppId.value)
    ]);
    agentParameters.value =
      (extractPayload<Api.Dify.AppParameters>(parameterRes) as Api.Dify.AppParameters | null) || null;
    agentMeta.value = (extractPayload<Api.Dify.AppMeta>(metaRes) as Api.Dify.AppMeta | null) || null;
  } catch {
    agentParameters.value = null;
    agentMeta.value = null;
  } finally {
    resetParameterValues();
    capabilityLoading.value = false;
  }
}

async function loadTasks() {
  if (!agentKey.value || !userId.value || !currentAppId.value) {
    currentTasks.value = [];
    return;
  }

  runtimeLoading.value = true;
  try {
    if (isWorkflow.value) {
      const res = await fetchDifyWorkflowLogs({
        appId: currentAppId.value,
        page: 1,
        limit: 10
      });
      const logs = asList<Api.Dify.WorkflowLogItem>(extractPayload(res));
      currentTasks.value = logs.map(log =>
        buildWorkflowTaskFromLog({
          agent: selectedAgent.value,
          log
        })
      );
    } else {
      const res = await fetchDifyConversations({
        appId: currentAppId.value,
        userId: userId.value,
        limit: 10
      });
      const conversations = asList<Api.Dify.ConversationItem>(extractPayload(res));
      const tasks = await Promise.all(
        conversations.map(async conversation => {
          const msgRes = await fetchDifyConversationMessages({
            appId: currentAppId.value,
            userId: userId.value,
            conversationId: conversation.id,
            limit: 20
          });
          const messages = asList<Api.Dify.ConversationMessage>(extractPayload(msgRes));
          return buildConversationTask({ agent: selectedAgent.value, conversation, messages });
        })
      );
      currentTasks.value = tasks;
    }
  } catch {
    currentTasks.value = [];
  } finally {
    runtimeLoading.value = false;
  }
}

watch(
  agentKey,
  async () => {
    syncInputWithAgent();
    uploadFiles.value = [];
    remoteFileUrls.value = '';
    await Promise.all([loadCapabilities(), loadTasks()]);
  },
  { immediate: true }
);

function handleAgentSelect(key: typeof agentKey.value) {
  if (pageMode.value === 'create') {
    pageMode.value = 'workbench';
  }
  updateAgentQuery(key);
}

function handleCreateClick() {
  pageMode.value = 'create';
}

function handleCreateCancel() {
  pageMode.value = 'workbench';
}

async function handleCreateSubmit(payload: AgentCreateModel) {
  try {
    const res = await fetchDifyAppCreate({
      name: payload.name,
      type: payload.type,
      description: payload.description || undefined,
      baseUrl: payload.baseUrl || undefined,
      apiKey: payload.apiKey || undefined,
      sort: payload.sort,
      status: payload.status
    });
    await loadRealApps();
    const createdId = res.data?.id ? String(res.data.id) : '';
    if (createdId) {
      updateAgentQuery(createdId);
    }
    pageMode.value = 'workbench';
    window.$message?.success(`应用「${payload.name}」创建成功`);
  } catch {
    window.$message?.error('创建应用失败，请稍后重试');
  }
}

function navigateToSubPage(name: 'agent_config' | 'agent_test' | 'agent_tools') {
  router.push({
    name: name as never,
    query: {
      ...route.query,
      agent: activeAgentKey.value
    }
  });
}

async function handleDelete() {
  const target = selectedAgent.value;
  const appId = Number(target.key);
  if (!appId || Number.isNaN(appId)) return;
  window.$dialog?.warning({
    title: '删除智能体',
    content: `确定要删除「${target.name}」吗？删除后无法恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const ok = await deleteAgent(appId);
      if (ok && activeAgentKey.value === target.key) {
        updateAgentQuery('');
      }
    }
  });
}

async function handleRun() {
  if (!agentKey.value || !currentAppId.value || !userId.value) {
    window.$message?.warning('请先选择智能体');
    return;
  }

  if (!isWorkflow.value && !runForm.input.trim()) {
    window.$message?.warning('请先输入任务内容');
    return;
  }

  try {
    running.value = true;
    const inputs = buildRuntimeInputs();
    const files = await collectRuntimeFiles();

    if (isWorkflow.value) {
      const res = await fetchDifyWorkflowRun({
        appId: currentAppId.value,
        userId: userId.value,
        inputs,
        files
      });
      const payload = extractPayload<Api.Dify.WorkflowRunResp>(res) as Api.Dify.WorkflowRunResp | null;
      const workflowRunId = String(
        payload?.workflow_run_id || payload?.data?.workflow_run_id || payload?.data?.id || ''
      );

      if (!workflowRunId) {
        window.$message?.warning('后端未返回工作流执行 ID，无法打开详情');
        return;
      }

      await loadTasks();
      router.push({
        name: 'agent_task_detail' as never,
        query: {
          id: workflowRunId,
          agent: activeAgentKey.value,
          kind: 'workflow'
        }
      });

      const currentDetail = payload
        ? buildWorkflowTaskFromDetail({
            agent: selectedAgent.value,
            workflowRunId,
            detail: payload,
            inputs
          })
        : null;
      if (currentDetail) {
        currentTasks.value = [currentDetail, ...currentTasks.value.filter(item => item.id !== currentDetail.id)];
      }

      window.$message?.success('工作流已执行完成');
      return;
    }

    if (isAgentApp.value) {
      type AgentStreamResult = { conversationId?: string; messageId?: string; taskId?: string };
      let streamResult: AgentStreamResult = {};
      await fetchDifyChatStream(
        {
          appId: currentAppId.value,
          userId: userId.value,
          query: runForm.input.trim(),
          inputs,
          files,
          autoGenerateName: true
        },
        {
          onEvent: (_event, payload) => {
            streamResult = {
              conversationId: String(
                payload.conversation_id || payload.conversationId || streamResult?.conversationId || ''
              ),
              messageId: String(payload.message_id || payload.messageId || streamResult?.messageId || ''),
              taskId: String(payload.task_id || payload.taskId || streamResult?.taskId || '')
            };
          },
          onDone: payload => {
            streamResult =
              typeof payload === 'string'
                ? { conversationId: payload }
                : {
                    conversationId: payload.conversationId || streamResult?.conversationId,
                    messageId: payload.messageId || streamResult?.messageId,
                    taskId: payload.taskId || streamResult?.taskId
                  };
          }
        }
      );
      const conversationId = streamResult.conversationId;
      if (!conversationId) {
        window.$message?.warning('流式运行结束，但未返回会话 ID，暂无法打开详情');
        return;
      }
      await loadTasks();
      window.$message?.success('Agent 会话已生成');
      router.push({
        name: 'agent_task_detail' as never,
        query: {
          id: conversationId,
          agent: activeAgentKey.value,
          kind: 'chat'
        }
      });
      return;
    }

    const res = await fetchDifyChat({
      appId: currentAppId.value,
      userId: userId.value,
      query: runForm.input.trim(),
      inputs,
      files,
      autoGenerateName: true
    });
    const payload = extractPayload<Api.Dify.ChatResp>(res) as Api.Dify.ChatResp | null;
    if (!payload?.conversationId) {
      window.$message?.warning('后端未返回会话 ID，无法打开详情');
      return;
    }
    await loadTasks();
    window.$message?.success('已生成新的会话记录');
    router.push({
      name: 'agent_task_detail' as never,
      query: {
        id: payload.conversationId,
        agent: activeAgentKey.value,
        kind: 'chat'
      }
    });
  } catch {
    window.$message?.error(isWorkflow.value ? '工作流运行失败，请稍后重试' : '智能体运行失败，请稍后重试');
  } finally {
    running.value = false;
  }
}

function goTaskDetail(taskId: string) {
  const target = currentTasks.value.find(item => item.id === taskId);
  router.push({
    name: 'agent_task_detail' as never,
    query: {
      id: taskId,
      agent: activeAgentKey.value,
      kind: target?.mode || (isWorkflow.value ? 'workflow' : 'chat')
    }
  });
}
</script>

<template>
  <div class="agent-page" :class="{ 'agent-page--dark': darkMode }">
    <div class="agent-shell">
      <aside class="agent-sidebar panel-surface">
        <AgentSidebar
          :active-key="agentKey"
          :agents="agentList"
          :loading="agentLoading"
          @select="handleAgentSelect"
          @create="handleCreateClick"
          @refresh="loadRealApps"
        />
      </aside>

      <section v-if="pageMode === 'workbench'" class="agent-main">
        <div class="panel-surface">
          <div class="panel-head">
            <SvgIcon :icon="selectedAgent.icon" class="panel-head__icon" />
            <span class="panel-head__title">{{ selectedAgent.name }}</span>
            <NTag size="small" round :bordered="false" type="info">
              {{ runtimeLabel }}
            </NTag>
            <div class="ml-auto flex gap-6px">
              <NButton secondary size="small" @click="navigateToSubPage('agent_config')">配置</NButton>
              <NButton secondary size="small" @click="navigateToSubPage('agent_test')">测试</NButton>
              <NButton secondary size="small" @click="navigateToSubPage('agent_tools')">工具</NButton>
              <NButton secondary size="small" type="error" @click="handleDelete">删除</NButton>
              <NButton type="primary" size="small" :loading="running" @click="handleRun">开始运行</NButton>
            </div>
          </div>
          <div class="panel-body">
            <div class="section-desc">{{ introText }}</div>
            <div class="mt-10px flex flex-wrap gap-4px">
              <NTag
                v-for="item in capabilityTags"
                :key="item"
                size="small"
                round
                :bordered="false"
                class="capability-tag"
              >
                {{ item }}
              </NTag>
            </div>
            <div class="mt-14px grid gap-10px md:grid-cols-3">
              <div class="metric-item">
                <span class="metric-label">应用类型</span>
                <span class="metric-value">{{ selectedAgent.category }}</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">能力摘要</span>
                <span class="metric-value">{{ toolsSummary }}</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">配置状态</span>
                <span class="metric-value">{{ selectedAgent.version }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="run-grid">
          <div class="panel-surface">
            <div class="panel-head">
              <SvgIcon icon="mdi:play-circle-outline" class="panel-head__icon" />
              <span class="panel-head__title">运行输入</span>
            </div>
            <div class="panel-body">
              <NAlert v-if="capabilityLoading" type="info" :show-icon="false" class="mb-12px">
                正在加载应用参数与附件能力...
              </NAlert>
              <NForm label-placement="top" :show-feedback="false">
                <NFormItem label="任务标题">
                  <NInput v-model:value="runForm.title" />
                </NFormItem>
                <NFormItem :label="isWorkflow ? '执行说明' : '任务内容'">
                  <NInput v-model:value="runForm.input" type="textarea" :autosize="{ minRows: 4, maxRows: 8 }" />
                </NFormItem>

                <template v-if="parameterFields.length">
                  <div class="runtime-section__title">动态参数</div>
                  <div class="grid gap-10px md:grid-cols-2">
                    <NFormItem
                      v-for="field in parameterFields"
                      :key="field.name"
                      :label="field.label"
                      :required="field.required"
                    >
                      <NInput
                        v-if="field.kind === 'text'"
                        :value="getFieldStringValue(field.name)"
                        :placeholder="field.placeholder"
                        @update:value="value => updateFieldValue(field.name, value)"
                      />
                      <NInput
                        v-else-if="field.kind === 'textarea'"
                        :value="getFieldStringValue(field.name)"
                        type="textarea"
                        :placeholder="field.placeholder"
                        :autosize="{ minRows: 3, maxRows: 6 }"
                        @update:value="value => updateFieldValue(field.name, value)"
                      />
                      <NInputNumber
                        v-else-if="field.kind === 'number'"
                        class="w-full"
                        :value="getFieldNumberValue(field.name)"
                        @update:value="value => updateFieldValue(field.name, value)"
                      />
                      <NSelect
                        v-else-if="field.kind === 'select'"
                        :value="getFieldSelectValue(field.name)"
                        :options="field.options || []"
                        clearable
                        @update:value="value => updateFieldValue(field.name, value)"
                      />
                      <NSwitch
                        v-else
                        :value="getFieldSwitchValue(field.name)"
                        @update:value="value => updateFieldValue(field.name, value)"
                      />
                    </NFormItem>
                  </div>
                </template>

                <template v-if="fileCapability.enabled">
                  <div class="runtime-section__title">附件输入</div>
                  <NFormItem v-if="fileCapability.supportLocalFile" label="本地文件">
                    <NUpload
                      multiple
                      :max="fileCapability.limit"
                      :file-list="uploadFiles"
                      :default-upload="false"
                      :accept="fileCapability.accept === '*' ? undefined : fileCapability.accept"
                      @change="handleLocalFileChange"
                      @remove="handleLocalFileRemove"
                    >
                      <NButton secondary>
                        <template #icon>
                          <SvgIcon icon="mdi:paperclip" />
                        </template>
                        选择文件
                      </NButton>
                    </NUpload>
                  </NFormItem>
                  <NFormItem v-if="fileCapability.supportRemoteUrl" label="远程文件 URL">
                    <NInput
                      v-model:value="remoteFileUrls"
                      type="textarea"
                      placeholder="每行一个 URL，可直接引用远程文件"
                      :autosize="{ minRows: 2, maxRows: 4 }"
                    />
                  </NFormItem>
                </template>
              </NForm>
              <div class="flex flex-wrap gap-4px mt-8px">
                <NTag
                  v-for="item in promptSuggestions"
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

          <div class="panel-surface">
            <div class="panel-head">
              <SvgIcon icon="mdi:clipboard-text-outline" class="panel-head__icon" />
              <span class="panel-head__title">配置摘要</span>
            </div>
            <div class="panel-body">
              <div class="flex flex-col gap-8px">
                <div class="summary-item">
                  <span class="summary-label">应用类型</span>
                  <span class="summary-value">{{ selectedAgent.category }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">附件能力</span>
                  <span class="summary-value">{{ fileCapability.enabled ? '已启用' : '未启用' }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">建议追问</span>
                  <span class="summary-value">
                    {{ agentParameters?.suggested_questions_after_answer?.enabled ? '已启用' : '未启用' }}
                  </span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">最近记录</span>
                  <span class="summary-value">{{ latestTask?.title || '暂无记录' }}</span>
                </div>
                <div v-if="agentMeta" class="summary-item">
                  <span class="summary-label">元数据</span>
                  <span class="summary-value">{{ Object.keys(agentMeta).length }} 项已同步</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <AgentStageBoard :agent="selectedAgent" :task="latestTask" />
        <AgentLogList :tasks="currentTasks" @view="goTaskDetail" />
      </section>

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
  --text-primary: #eaf5ff;
  --text-secondary: rgba(203, 227, 255, 0.72);
  --text-tertiary: rgba(147, 196, 255, 0.62);

  height: 100%;
  background: var(--agent-page-bg);
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

.agent-sidebar {
  min-width: 0;
  overflow: visible;
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

.section-desc {
  font-size: 13px;
  color: var(--text-secondary);
}

.runtime-section__title {
  margin: 4px 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(203, 227, 255, 0.82);
}

.metric-item,
.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: var(--agent-radius-sm);
  background: rgba(6, 20, 38, 0.5);
  border: 1px solid rgba(25, 95, 176, 0.18);
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.metric-item:hover,
.summary-item:hover {
  border-color: rgba(61, 166, 255, 0.3);
  background: rgba(10, 32, 58, 0.6);
  box-shadow: 0 4px 16px rgba(2, 10, 22, 0.35);
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
