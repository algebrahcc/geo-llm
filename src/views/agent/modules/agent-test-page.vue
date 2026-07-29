<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { UploadFileInfo } from 'naive-ui';
import { useRoute, useRouter } from 'vue-router';
import { useThemeStore } from '@/store/modules/theme';
import SvgIcon from '@/components/custom/svg-icon.vue';
import {
  fetchDifyChatStream,
  fetchDifyFileUpload,
  fetchDifyParameters,
  fetchDifyStop,
  fetchDifySuggestedQuestions,
  fetchDifyWorkflowStop,
  fetchDifyWorkflowStream
} from '@/service/api/dify';
import AgentSidebar from './agent-sidebar.vue';
import { useAgentSelection } from './use-agent';
import { useDifyApps } from './use-dify-app';
import { useAuthStore } from '@/store/modules/auth';
import {
  buildInitialParameterValues,
  buildTestRecord,
  normalizeFileCapability,
  normalizeParameterFields,
  normalizeSuggestedQuestions,
  stringifyOutput
} from './real';
import { extractPayload } from '../../knowledge/modules/real';

defineOptions({
  name: 'AgentTestPage'
});

type EventLine = {
  id: string;
  label: string;
  detail: string;
};

const route = useRoute();
const router = useRouter();
const themeStore = useThemeStore();
const darkMode = computed(() => themeStore.darkMode);
const { resolveAgent, agentList, loading: agentLoading } = useDifyApps();
const { agentKey, selectedAgent, updateAgentQuery } = useAgentSelection(route, router, resolveAgent, agentList);
const authStore = useAuthStore();
const userId = computed(() => String(authStore.userInfo.userId ?? ''));
const activeAgentKey = computed(() => selectedAgent.value.key || agentKey.value);
const currentAppId = computed(() => {
  const value = Number(activeAgentKey.value);
  return Number.isFinite(value) && value > 0 ? value : undefined;
});

const testing = ref(false);
const latestRecord = ref<ReturnType<typeof buildTestRecord> | null>(null);
const parameters = ref<Api.Dify.AppParameters | null>(null);
const uploadFiles = ref<UploadFileInfo[]>([]);
const remoteFileUrls = ref('');
const streamOutput = ref('');
const streamEvents = ref<EventLine[]>([]);
const suggestedQuestions = ref<string[]>([]);
const currentTaskId = ref('');
const currentMessageId = ref('');
let currentController: AbortController | null = null;

const prompt = ref('');
const parameterValues = reactive<Record<string, unknown>>({});

const isWorkflow = computed(() => selectedAgent.value.appType === 3);
const parameterFields = computed(() => normalizeParameterFields(parameters.value));
const fileCapability = computed(() => normalizeFileCapability(parameters.value));
const quickPrompts = computed(() => {
  const fromParameters = normalizeSuggestedQuestions({
    data: Array.isArray(parameters.value?.suggested_questions) ? parameters.value.suggested_questions : []
  });
  return fromParameters.length ? fromParameters : selectedAgent.value.recommendedPrompts;
});

function resetParameterValues() {
  Object.keys(parameterValues).forEach(key => {
    // 清空旧参数键，避免切换智能体后残留上一份参数
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete parameterValues[key];
  });
  Object.assign(parameterValues, buildInitialParameterValues(parameterFields.value));
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

function appendEvent(label: string, detail: string) {
  streamEvents.value.unshift({
    id: `${Date.now()}-${Math.random()}`,
    label,
    detail
  });
  streamEvents.value = streamEvents.value.slice(0, 12);
}

function resolveUploadType(fileName: string) {
  const lowerName = fileName.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lowerName)) return 'image';
  if (/\.(mp3|wav|aac|flac|ogg|m4a)$/.test(lowerName)) return 'audio';
  if (/\.(mp4|mov|avi|mkv|webm)$/.test(lowerName)) return 'video';
  return 'document';
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

  if (isWorkflow.value && prompt.value.trim()) {
    const preferredField = parameterFields.value.find(field =>
      /^(query|prompt|input|content|instruction)$/i.test(field.name)
    );
    if (preferredField && !inputs[preferredField.name]) {
      inputs[preferredField.name] = prompt.value.trim();
    } else if (!parameterFields.value.length) {
      inputs.query = prompt.value.trim();
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

function handleSelect(key: typeof agentKey.value) {
  updateAgentQuery(key);
}

function handleLocalFileChange(options: { fileList: UploadFileInfo[] }) {
  uploadFiles.value = options.fileList.slice(0, fileCapability.value.limit);
}

function handleLocalFileRemove(options: { fileList: UploadFileInfo[] }) {
  uploadFiles.value = options.fileList;
}

async function loadParameters() {
  if (!currentAppId.value) {
    parameters.value = null;
    resetParameterValues();
    return;
  }
  try {
    const res = await fetchDifyParameters(currentAppId.value);
    parameters.value = (extractPayload<Api.Dify.AppParameters>(res) as Api.Dify.AppParameters | null) || null;
  } catch {
    parameters.value = null;
  } finally {
    resetParameterValues();
  }
}

watch(
  agentKey,
  async () => {
    prompt.value = selectedAgent.value.defaultInput;
    streamOutput.value = '';
    streamEvents.value = [];
    suggestedQuestions.value = [];
    currentTaskId.value = '';
    currentMessageId.value = '';
    uploadFiles.value = [];
    remoteFileUrls.value = '';
    await loadParameters();
  },
  { immediate: true }
);

async function handleStop() {
  if (!currentTaskId.value || !currentAppId.value || !userId.value) {
    return;
  }

  try {
    if (isWorkflow.value) {
      await fetchDifyWorkflowStop({
        appId: currentAppId.value,
        taskId: currentTaskId.value,
        userId: userId.value
      });
    } else {
      await fetchDifyStop({
        appId: currentAppId.value,
        taskId: currentTaskId.value,
        userId: userId.value
      });
    }
    currentController?.abort();
    appendEvent('已停止', '当前流式任务已终止');
    window.$message?.success('已停止当前生成');
  } catch {
    window.$message?.error('停止执行失败');
  } finally {
    testing.value = false;
  }
}

async function handleRun(targetPrompt?: string) {
  if (!currentAppId.value || !userId.value) {
    window.$message?.warning('请先选择智能体');
    return;
  }

  if (!isWorkflow.value && !(targetPrompt || prompt.value).trim()) {
    window.$message?.warning('请输入测试内容');
    return;
  }

  try {
    testing.value = true;
    streamOutput.value = '';
    streamEvents.value = [];
    suggestedQuestions.value = [];
    currentTaskId.value = '';
    currentMessageId.value = '';
    currentController?.abort();
    currentController = new AbortController();

    const runtimePrompt = (targetPrompt || prompt.value).trim();
    const inputs = buildRuntimeInputs();
    const files = await collectRuntimeFiles();
    appendEvent('请求发起', isWorkflow.value ? '已发送工作流流式请求' : '已发送会话流式请求');

    if (isWorkflow.value) {
      await fetchDifyWorkflowStream(
        {
          appId: currentAppId.value,
          userId: userId.value,
          inputs,
          files
        },
        {
          onEvent: (event, data) => {
            try {
              const parsed = JSON.parse(data) as Record<string, unknown>;
              currentTaskId.value = String(parsed.task_id || currentTaskId.value || '');
              appendEvent(event, stringifyOutput(parsed));
            } catch {
              appendEvent(event, data);
            }
          },
          onDone: outputsJson => {
            streamOutput.value = stringifyOutput(JSON.parse(outputsJson));
            latestRecord.value = buildTestRecord({
              agent: selectedAgent.value,
              prompt: runtimePrompt || '工作流运行',
              answer: streamOutput.value,
              taskId: currentTaskId.value,
              mode: 'workflow'
            });
          },
          onError: message => {
            appendEvent('错误', message);
            window.$message?.error(message);
          }
        },
        currentController.signal
      );
    } else {
      await fetchDifyChatStream(
        {
          appId: currentAppId.value,
          userId: userId.value,
          query: runtimePrompt,
          inputs,
          files,
          autoGenerateName: true
        },
        {
          onDelta: text => {
            streamOutput.value += text;
          },
          onThought: payload => {
            appendEvent('思考过程', stringifyOutput(payload));
          },
          onEvent: (event, payload) => {
            currentTaskId.value = String(payload.task_id || currentTaskId.value || '');
            currentMessageId.value = String(payload.message_id || currentMessageId.value || '');
            if (event !== 'message' && event !== 'agent_message' && event !== 'agent_thought') {
              appendEvent(event, stringifyOutput(payload));
            }
          },
          onDone: async payload => {
            const donePayload = typeof payload === 'string' ? { conversationId: payload } : payload;
            currentTaskId.value = donePayload.taskId || currentTaskId.value;
            currentMessageId.value = donePayload.messageId || currentMessageId.value;
            if (currentMessageId.value) {
              try {
                const res = await fetchDifySuggestedQuestions({
                  appId: currentAppId.value,
                  messageId: currentMessageId.value,
                  userId: userId.value
                });
                suggestedQuestions.value = normalizeSuggestedQuestions(
                  (extractPayload<Api.Dify.SuggestedQuestionsResp>(res) as Api.Dify.SuggestedQuestionsResp | null) ||
                    undefined
                );
              } catch {
                suggestedQuestions.value = [];
              }
            }
            latestRecord.value = buildTestRecord({
              agent: selectedAgent.value,
              prompt: runtimePrompt,
              answer: streamOutput.value,
              conversationId: donePayload.conversationId,
              messageId: donePayload.messageId,
              taskId: donePayload.taskId,
              mode: 'chat',
              suggestedQuestions: suggestedQuestions.value
            });
          },
          onError: message => {
            appendEvent('错误', message);
            window.$message?.error(message);
          }
        },
        currentController.signal
      );
    }
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      window.$message?.error('测试失败，请稍后重试');
    }
  } finally {
    testing.value = false;
    currentController = null;
  }
}
</script>

<template>
  <div class="agent-domain-page" :class="{ 'agent-domain-page--dark': darkMode }">
    <div class="agent-shell">
      <aside class="agent-sidebar panel-surface">
        <AgentSidebar :active-key="agentKey" :agents="agentList" :loading="agentLoading" @select="handleSelect" />
      </aside>

      <section class="agent-main">
        <div class="panel-surface">
          <div class="panel-head">
            <SvgIcon :icon="selectedAgent.icon" class="panel-head__icon" />
            <span class="panel-head__title">{{ selectedAgent.name }}测试台</span>
            <div class="ml-auto flex gap-8px">
              <NButton secondary :disabled="!testing" @click="handleStop">停止</NButton>
              <NButton type="primary" :loading="testing" @click="handleRun()">开始测试</NButton>
            </div>
          </div>
          <div class="panel-body">
            <div class="section-desc">直接以流式方式验证参数、附件、过程事件与最终输出。</div>
          </div>
        </div>

        <div class="grid gap-10px xl:grid-cols-[1.1fr_0.9fr]">
          <div class="panel-surface">
            <div class="panel-head">
              <SvgIcon icon="mdi:play-circle-outline" class="panel-head__icon" />
              <span class="panel-head__title">测试输入</span>
            </div>
            <div class="panel-body">
              <NForm label-placement="top" :show-feedback="false">
                <NFormItem :label="isWorkflow ? '执行说明' : '输入内容'">
                  <NInput v-model:value="prompt" type="textarea" :autosize="{ minRows: 4, maxRows: 8 }" />
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

              <div class="mt-10px flex flex-wrap gap-4px">
                <NTag
                  v-for="item in quickPrompts"
                  :key="item"
                  size="small"
                  round
                  :bordered="false"
                  class="quick-tag"
                  @click="handleRun(item)"
                >
                  {{ item }}
                </NTag>
              </div>
            </div>
          </div>

          <div class="panel-surface">
            <div class="panel-head">
              <SvgIcon icon="mdi:text-box-check-outline" class="panel-head__icon" />
              <span class="panel-head__title">实时输出</span>
            </div>
            <div class="panel-body">
              <div v-if="streamOutput" class="result-block">{{ streamOutput }}</div>
              <NEmpty v-else description="等待测试结果" class="py-20px" />
              <div v-if="suggestedQuestions.length" class="mt-12px flex flex-wrap gap-4px">
                <NTag
                  v-for="item in suggestedQuestions"
                  :key="item"
                  size="small"
                  round
                  :bordered="false"
                  class="quick-tag"
                >
                  {{ item }}
                </NTag>
              </div>
            </div>
          </div>
        </div>

        <div class="grid gap-10px xl:grid-cols-[0.9fr_1.1fr]">
          <div class="panel-surface">
            <div class="panel-head">
              <SvgIcon icon="mdi:timeline-text-outline" class="panel-head__icon" />
              <span class="panel-head__title">过程事件</span>
            </div>
            <div class="panel-body">
              <div v-if="streamEvents.length" class="flex flex-col gap-8px">
                <div v-for="item in streamEvents" :key="item.id" class="step-card">
                  <div class="step-label">{{ item.label }}</div>
                  <div class="step-detail">{{ item.detail }}</div>
                </div>
              </div>
              <NEmpty v-else description="暂无过程事件" class="py-20px" />
            </div>
          </div>

          <div class="panel-surface">
            <div class="panel-head">
              <SvgIcon icon="mdi:history" class="panel-head__icon" />
              <span class="panel-head__title">最近结果</span>
            </div>
            <div class="panel-body">
              <div v-if="latestRecord" class="flex flex-col gap-10px">
                <div class="result-block">{{ latestRecord.response }}</div>
                <div class="flex flex-col gap-6px">
                  <div v-for="step in latestRecord.steps" :key="step.label" class="step-card">
                    <div class="step-label">{{ step.label }}</div>
                    <div class="step-detail">{{ step.detail }}</div>
                  </div>
                </div>
              </div>
              <NEmpty v-else description="暂无测试结果" class="py-20px" />
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

.agent-sidebar {
  min-width: 0;
  overflow: visible;
}

.agent-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10px;
}

.section-desc {
  font-size: 12px;
  color: rgba(203, 227, 255, 0.65);
}

.runtime-section__title {
  margin: 4px 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(203, 227, 255, 0.82);
}

.quick-tag {
  cursor: pointer;
  background: rgba(41, 163, 255, 0.1);
  border: 1px solid rgba(41, 163, 255, 0.22);
  color: rgba(203, 227, 255, 0.82);
}

.result-block {
  padding: 10px 12px;
  border-radius: 4px;
  background: rgba(6, 20, 38, 0.5);
  border: 1px solid rgba(25, 95, 176, 0.18);
  color: rgba(41, 163, 255, 0.85);
  font-size: 13px;
  line-height: 22px;
  white-space: pre-wrap;
}

.step-card {
  padding: 10px 12px;
  border-radius: 4px;
  background: rgba(12, 38, 72, 0.4);
  border: 1px solid rgba(25, 95, 176, 0.12);
}

.step-label {
  font-size: 12px;
  font-weight: 600;
  color: #eaf5ff;
}

.step-detail {
  margin-top: 4px;
  font-size: 11px;
  line-height: 18px;
  color: rgba(203, 227, 255, 0.55);
  white-space: pre-wrap;
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
