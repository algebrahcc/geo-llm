<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import type { UploadFileInfo } from 'naive-ui';
import { useRoute, useRouter } from 'vue-router';
import { useThemeStore } from '@/store/modules/theme';
import SvgIcon from '@/components/custom/svg-icon.vue';
import {
  deleteDifyConversation,
  fetchDifyChatStream,
  fetchDifyConversations,
  fetchDifyConversationMessages,
  fetchDifyFileUpload,
  fetchDifyParameters,
  fetchDifyStop,
  fetchDifySuggestedQuestions,
  fetchDifyWorkflowStop,
  fetchDifyWorkflowStream,
  renameDifyConversation
} from '@/service/api/dify';
import AgentSidebar from './agent-sidebar.vue';
import { useAgentSelection } from './use-agent';
import { useDifyApps } from './use-dify-app';
import { useAuthStore } from '@/store/modules/auth';
import {
  asList,
  buildInitialParameterValues,
  buildTestRecord,
  normalizeFileCapability,
  normalizeParameterFields,
  normalizeSuggestedQuestions,
  stringifyOutput
} from './real';

defineOptions({
  name: 'AgentTestPage'
});

type EventLine = {
  id: string;
  label: string;
  detail: string;
  /** 事件类型：tool = 工具调用（高亮展示） */
  kind?: 'evt' | 'tool';
};

/** 把包含 <think>...</think> 的流式文本拆分为 reasoning（思考）与 content（正文） */
function splitThink(raw: string): { reasoning: string; content: string } {
  const reasoningParts: string[] = [];
  const contentParts: string[] = [];
  let pos = 0;
  while (true) {
    const start = raw.indexOf('<think>', pos);
    if (start === -1) {
      contentParts.push(raw.slice(pos));
      break;
    }
    contentParts.push(raw.slice(pos, start));
    const end = raw.indexOf('</think>', start);
    if (end === -1) {
      // 思考块尚未闭合（流式中），剩余部分视为思考内容
      reasoningParts.push(raw.slice(start));
      break;
    }
    reasoningParts.push(raw.slice(start + 7, end));
    pos = end + 8;
  }
  const reasoning = reasoningParts.join('').trim();
  const content = contentParts.join('').trim();
  return { reasoning, content };
}

const route = useRoute();
const router = useRouter();
const themeStore = useThemeStore();
const darkMode = computed(() => themeStore.darkMode);
const { resolveAgent, agentList, loading: agentLoading } = useDifyApps();
const { agentKey, selectedAgent, updateAgentQuery } = useAgentSelection(route, router, resolveAgent, agentList);
const authStore = useAuthStore();
const userId = computed(() => String(authStore.userInfo.userId ?? ''));
const activeAgentKey = computed(() => selectedAgent.value.key || agentKey.value);
/** 当前智能体的本地 dify_app 主键 id（雪花 Long 序列化为字符串，必须保留字符串避免精度丢失） */
const currentAppId = computed(() => activeAgentKey.value || undefined);

const testing = ref(false);
const latestRecord = ref<ReturnType<typeof buildTestRecord> | null>(null);
const parameters = ref<Api.Dify.AppParameters | null>(null);
const uploadFiles = ref<UploadFileInfo[]>([]);
const streamOutput = ref('');
const streamEvents = ref<EventLine[]>([]);
const suggestedQuestions = ref<string[]>([]);
const currentTaskId = ref('');
const currentMessageId = ref('');
let currentController: AbortController | null = null;

const prompt = ref('');
const parameterValues = reactive<Record<string, unknown>>({});

type ChatMsg = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** AI 思考过程（从 <think>...</think> 中拆出），供折叠展示 */
  reasoning?: string;
  /** 是否正在流式生成中（用于显示打字机光标 / 思考中状态） */
  streaming?: boolean;
  time: string;
  suggested?: string[];
};
const messages = ref<ChatMsg[]>([]);
const messageArea = ref<HTMLElement | null>(null);
/** 思考过程面板完成后是否默认折叠（对齐 Dify：进行中展开，完成后收起） */
const reasoningPanelClosed = ref(true);
const currentConversationId = ref('');
/** 输入框聚焦态，用于视觉高亮 */
const inputFocused = ref(false);

function pushMessage(role: ChatMsg['role'], content = '') {
  const msg: ChatMsg = {
    id: `${Date.now()}-${Math.random()}`,
    role,
    content,
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  };
  messages.value.push(msg);
  // 关键：返回数组里的响应式代理对象（而非原始对象）。
  // ref 数组 push 后，元素会被 Vue 代理；若返回原始对象，
  // 后续增量修改 msg.content 不会触发 UI 更新，导致流式回答不显示。
  return messages.value[messages.value.length - 1];
}

function copyMessage(msg: ChatMsg) {
  const text = msg.content || '';
  if (!text) return;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => window.$message?.success('已复制'));
  } else {
    window.$message?.info('当前环境不支持复制');
  }
}

function scrollMessageArea() {
  nextTick(() => {
    messageArea.value?.scrollTo({ top: messageArea.value.scrollHeight, behavior: 'smooth' });
  });
}

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

function appendEvent(label: string, detail: string, kind: EventLine['kind'] = 'evt') {
  streamEvents.value.unshift({
    id: `${Date.now()}-${Math.random()}`,
    label,
    detail,
    kind
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
    const payload = res.data as Api.Dify.FileUploadResp | null;
    const fileId = String(payload?.id || '');
    if (fileId) {
      files.push({
        type: resolveUploadType(file.name),
        transfer_method: 'local_file',
        upload_file_id: fileId
      });
    }
  }

  return files;
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
    parameters.value = (res.data as Api.Dify.AppParameters | null) || null;
  } catch {
    parameters.value = null;
  } finally {
    resetParameterValues();
  }
}

/** 历史会话列表（仅对话型应用） */
const conversationList = ref<Api.Dify.ConversationItem[]>([]);
const conversationLoading = ref(false);

/** 会话标题：name → introduction → 兜底文案 */
function convTitle(conv: Api.Dify.ConversationItem) {
  return conv.name || conv.introduction || '未命名会话';
}

/** 会话时间：updated_at → created_at（Dify 返回秒级时间戳） */
function convTime(conv: Api.Dify.ConversationItem) {
  const t = conv.updated_at || conv.created_at;
  if (!t) return '';
  return new Date(t * 1000).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function loadConversations() {
  if (isWorkflow.value || !currentAppId.value || !userId.value) {
    conversationList.value = [];
    return;
  }
  conversationLoading.value = true;
  try {
    const res = await fetchDifyConversations({ appId: currentAppId.value, userId: userId.value, limit: 50 });
    conversationList.value = asList<Api.Dify.ConversationItem>(res?.data);
  } catch {
    conversationList.value = [];
  } finally {
    conversationLoading.value = false;
  }
}

/**
 * 历史消息渲染：Dify 每条记录同时含用户提问与 AI 回答，
 * 拆成两条消息（user → query，assistant → answer），避免只显示提问。
 */
function mapMessages(msgs: Api.Dify.ConversationMessage[]): ChatMsg[] {
  const result: ChatMsg[] = [];
  for (const m of msgs) {
    if (m.query) {
      result.push({ id: `${m.id}-q`, role: 'user', content: m.query, time: '' });
    }
    if (m.answer) {
      // 与流式一致：从 answer 中拆出 <think>...</think>，思考内容走折叠面板渲染
      const split = splitThink(m.answer);
      result.push({
        id: `${m.id}-a`,
        role: 'assistant',
        content: split.content,
        reasoning: split.reasoning || undefined,
        time: ''
      });
    }
  }
  return result;
}

/** 删除会话：成功后从列表移除；若删除的是当前会话则回到空会话状态 */
async function removeConversation(conversationId: string) {
  if (!currentAppId.value || !userId.value) return;
  try {
    await deleteDifyConversation({ appId: currentAppId.value, userId: userId.value, conversationId });
  } catch {
    return;
  }
  conversationList.value = conversationList.value.filter(c => c.id !== conversationId);
  if (currentConversationId.value === conversationId) {
    currentConversationId.value = '';
    messages.value = [];
    streamOutput.value = '';
    streamEvents.value = [];
    suggestedQuestions.value = [];
    latestRecord.value = null;
  }
}

/** 会话重命名弹窗状态 */
const renameTarget = ref<Api.Dify.ConversationItem | null>(null);
const renameValue = ref('');
const renameLoading = ref(false);

/** 打开重命名弹窗（仅对话型应用） */
function openRenameDialog(conv: Api.Dify.ConversationItem) {
  renameTarget.value = conv;
  renameValue.value = conv.name || conv.introduction || '';
}

/** 提交重命名：成功后更新列表标题 */
async function submitRename() {
  const target = renameTarget.value;
  if (!target || !currentAppId.value || !userId.value) return;
  const name = renameValue.value.trim();
  if (!name) {
    window.$message?.warning('请输入会话名称');
    return;
  }
  renameLoading.value = true;
  try {
    await renameDifyConversation({
      appId: currentAppId.value,
      userId: userId.value,
      conversationId: target.id,
      name,
      autoGenerateName: false
    });
    const updated = { ...target, name };
    conversationList.value = conversationList.value.map(c => (c.id === target.id ? updated : c));
    renameTarget.value = null;
    window.$message?.success('会话已重命名');
  } catch {
    // 后端已提示错误
  } finally {
    renameLoading.value = false;
  }
}

/** 切换到指定历史会话并加载其消息 */
async function switchConversation(conversationId: string) {
  if (!currentAppId.value || !userId.value) return;
  currentConversationId.value = conversationId;
  streamOutput.value = '';
  streamEvents.value = [];
  suggestedQuestions.value = [];
  latestRecord.value = null;
  try {
    const msgRes = await fetchDifyConversationMessages({
      appId: currentAppId.value,
      userId: userId.value,
      conversationId
    });
    messages.value = mapMessages(asList<Api.Dify.ConversationMessage>(msgRes?.data));
  } catch {
    messages.value = [];
  }
  nextTick(() => messageArea.value?.scrollTo({ top: messageArea.value.scrollHeight }));
}

/** 新建对话：清空当前会话上下文，下次发送时 Dify 自动开新会话 */
function newConversation() {
  currentConversationId.value = '';
  messages.value = [];
  streamOutput.value = '';
  streamEvents.value = [];
  suggestedQuestions.value = [];
  latestRecord.value = null;
}

/** 加载会话列表并自动进入最近一次会话，便于进入测试页时延续上下文 */
async function loadHistory() {
  if (isWorkflow.value || !currentAppId.value || !userId.value) return;
  await loadConversations();
  const first = conversationList.value[0];
  if (!first) return;
  await switchConversation(first.id);
}

watch(
  agentKey,
  async () => {
    prompt.value = selectedAgent.value.defaultInput;
    messages.value = [];
    streamOutput.value = '';
    streamEvents.value = [];
    suggestedQuestions.value = [];
    currentTaskId.value = '';
    currentMessageId.value = '';
    currentConversationId.value = '';
    uploadFiles.value = [];
    await loadParameters();
    await loadHistory();
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

function handleSelect(key: typeof agentKey.value) {
  updateAgentQuery(key);
}

function clearChat() {
  messages.value = [];
  streamOutput.value = '';
  streamEvents.value = [];
  suggestedQuestions.value = [];
  latestRecord.value = null;
  currentConversationId.value = '';
}

async function handleRun(targetPrompt?: string) {
  if (!currentAppId.value) {
    window.$message?.warning('请先选择智能体');
    return;
  }
  if (!userId.value) {
    window.$message?.error('当前登录用户信息缺失，请刷新页面或重新登录后重试');
    return;
  }

  if (!isWorkflow.value && !(targetPrompt || prompt.value).trim()) {
    window.$message?.warning('请输入测试内容');
    return;
  }

  /** 当前助手消息，try 内创建，finally 中需要清理流式标记 */
  let botMsg: ChatMsg | null = null;

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

    // 把用户消息与待生成的助手消息推入对话气泡
    const userMsg = pushMessage('user', runtimePrompt);
    userMsg.suggested = undefined;
    prompt.value = '';
    botMsg = pushMessage('assistant');
    botMsg.streaming = true;
    const msg = botMsg;
    // 累积原始流，避免 <think> 标签被 SSE 块截断导致拆分错误
    let rawBuffer = '';
    /**
     * 追加流式增量：把 <think>...</think> 从正文中拆出，分别更新 reasoning / content。
     * 由于流式块可能把一个标签拆成多段，这里每次对「累积原始流」整体重新解析。
     */
    const appendBot = (text: string) => {
      rawBuffer += text;
      const split = splitThink(rawBuffer);
      msg.reasoning = split.reasoning;
      msg.content = split.content;
      scrollMessageArea();
    };
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
            msg.streaming = false;
            const output = stringifyOutput(JSON.parse(outputsJson));
            streamOutput.value = output;
            msg.content = output;
            scrollMessageArea();
            latestRecord.value = buildTestRecord({
              agent: selectedAgent.value,
              prompt: runtimePrompt || '工作流运行',
              answer: output,
              taskId: currentTaskId.value,
              mode: 'workflow'
            });
          },
          onError: message => {
            msg.streaming = false;
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
          autoGenerateName: true,
          conversationId: currentConversationId.value || undefined
        },
        {
          onDelta: text => {
            streamOutput.value += text;
            appendBot(text);
          },
          onThought: payload => {
            appendEvent('思考过程', stringifyOutput(payload));
          },
          onEvent: (event, payload) => {
            currentTaskId.value = String(payload.task_id || currentTaskId.value || '');
            currentMessageId.value = String(payload.message_id || currentMessageId.value || '');
            // 工具调用可视化：agent_thought 携带 tool/tool_input/observation（Agent 模式），
            // agent_message（Dify 1.16 新格式）携带 tool_calls[]
            if (event === 'agent_thought') {
              const tool = payload.tool as string | undefined;
              if (tool) {
                appendEvent(
                  `工具调用 · ${tool}`,
                  `输入：${stringifyOutput(payload.tool_input)}\n输出：${stringifyOutput(payload.observation)}`,
                  'tool'
                );
              }
            } else if (event === 'agent_message') {
              const toolCalls = payload.tool_calls as
                | Array<{ name?: string; arguments?: unknown; response?: unknown }>
                | undefined;
              if (Array.isArray(toolCalls) && toolCalls.length) {
                for (const call of toolCalls) {
                  appendEvent(
                    `工具调用 · ${call.name ?? 'unknown'}`,
                    `参数：${stringifyOutput(call.arguments)}\n输出：${stringifyOutput(call.response)}`,
                    'tool'
                  );
                }
              }
            } else if (event !== 'message') {
              appendEvent(event, stringifyOutput(payload));
            }
          },
          onDone: async payload => {
            msg.streaming = false;
            const donePayload = typeof payload === 'string' ? { conversationId: payload } : payload;
            currentTaskId.value = donePayload.taskId || currentTaskId.value;
            currentMessageId.value = donePayload.messageId || currentMessageId.value;
            if (donePayload.conversationId) {
              currentConversationId.value = donePayload.conversationId;
            }
            if (currentMessageId.value) {
              try {
                const res = await fetchDifySuggestedQuestions({
                  appId: currentAppId.value,
                  messageId: currentMessageId.value,
                  userId: userId.value
                });
                suggestedQuestions.value = normalizeSuggestedQuestions(
                  (res.data as Api.Dify.SuggestedQuestionsResp | null) || undefined
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
            msg.suggested = suggestedQuestions.value;
            scrollMessageArea();
            // 对话完成后刷新会话列表（新会话会出现在顶部）
            void loadConversations();
          },
          onError: message => {
            msg.streaming = false;
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
    if (botMsg) botMsg.streaming = false;
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
        <!-- 对话型主区：底部固定输入框 + 气泡流 -->
        <div v-if="!isWorkflow" class="chat-panel panel-surface">
          <div class="conversation-pane">
            <div class="conversation-pane__head">
              <NButton text size="small" class="conversation-pane__new" @click="newConversation">
                <template #icon>
                  <SvgIcon icon="mdi:plus" />
                </template>
                新对话
              </NButton>
            </div>
            <div v-if="conversationLoading" class="conversation-pane__loading">加载中…</div>
            <div v-else-if="!conversationList.length" class="conversation-pane__loading">暂无历史会话</div>
            <div v-else class="conversation-pane__list">
              <button
                v-for="conv in conversationList"
                :key="conv.id"
                type="button"
                class="conversation-item"
                :class="{ 'conversation-item--active': conv.id === currentConversationId }"
                @click="switchConversation(conv.id)"
              >
                <span class="conversation-item__title">{{ convTitle(conv) }}</span>
                <span v-if="convTime(conv)" class="conversation-item__time">{{ convTime(conv) }}</span>
                <span class="conversation-item__actions">
                  <span class="conversation-item__action" title="重命名会话" @click.stop="openRenameDialog(conv)">
                    <SvgIcon icon="mdi:pencil-outline" />
                  </span>
                  <span
                    class="conversation-item__action conversation-item__action--danger"
                    title="删除会话"
                    @click.stop="removeConversation(conv.id)"
                  >
                    <SvgIcon icon="mdi:trash-can-outline" />
                  </span>
                </span>
              </button>
            </div>
          </div>

          <div class="chat-body">
            <div class="panel-head">
              <SvgIcon :icon="selectedAgent.icon" class="panel-head__icon" />
              <span class="panel-head__title">{{ selectedAgent.name }}</span>
              <NTag size="small" round :bordered="false" class="mode-tag">对话</NTag>
              <div class="ml-auto flex gap-8px">
                <NButton text size="small" :disabled="!messages.length || testing" @click="clearChat">
                  <template #icon>
                    <SvgIcon icon="mdi:delete-sweep-outline" />
                  </template>
                  清空
                </NButton>
                <NButton secondary size="small" :disabled="!testing" @click="handleStop">
                  <template #icon>
                    <SvgIcon icon="mdi:stop" />
                  </template>
                  停止
                </NButton>
              </div>
            </div>

            <div ref="messageArea" class="chat-messages">
              <div v-if="!messages.length" class="chat-welcome">
                <SvgIcon icon="mdi:message-processing-outline" class="chat-welcome__icon" />
                <div class="chat-welcome__title">开始调试</div>
                <div class="chat-welcome__desc">在下方输入消息，模拟对话测试应用，流式返回结果。</div>
                <div v-if="quickPrompts.length" class="chat-welcome__prompts">
                  <button
                    v-for="item in quickPrompts"
                    :key="item"
                    type="button"
                    class="prompt-chip"
                    @click="handleRun(item)"
                  >
                    {{ item }}
                  </button>
                </div>
              </div>

              <div v-for="msg in messages" :key="msg.id" class="chat-row" :class="msg.role">
                <div class="chat-avatar" :class="msg.role">
                  <SvgIcon :icon="msg.role === 'user' ? 'mdi:account-outline' : selectedAgent.icon" />
                </div>
                <div class="chat-bubble" :class="msg.role">
                  <!-- 思考过程折叠面板（参考 Dify：进行中默认展开，结束后默认折叠） -->
                  <details v-if="msg.reasoning" class="think-panel" :open="msg.streaming || !reasoningPanelClosed">
                    <summary class="think-panel__summary">
                      <span class="think-panel__chevron">▸</span>
                      <span v-if="msg.streaming" class="think-panel__label think-panel__label--active">思考中…</span>
                      <span v-else class="think-panel__label">思考过程</span>
                    </summary>
                    <div class="think-panel__body">{{ msg.reasoning }}</div>
                  </details>
                  <div v-if="msg.content" class="chat-bubble__text">
                    {{ msg.content }}
                    <span v-if="msg.streaming" class="type-cursor">▍</span>
                  </div>
                  <div v-else-if="msg.streaming && !msg.reasoning" class="chat-bubble__loading">
                    <span class="dot" />
                    <span class="dot" />
                    <span class="dot" />
                  </div>
                  <div v-if="msg.content || !msg.streaming" class="chat-bubble__meta">
                    <span class="chat-bubble__time">{{ msg.time }}</span>
                    <button type="button" class="copy-btn" title="复制内容" @click="copyMessage(msg)">
                      <SvgIcon icon="mdi:content-copy" />
                    </button>
                  </div>
                  <div v-if="msg.suggested?.length" class="chat-bubble__suggested">
                    <button v-for="q in msg.suggested" :key="q" type="button" class="prompt-chip" @click="handleRun(q)">
                      {{ q }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="chat-input" :class="{ 'chat-input--focused': inputFocused }">
              <div class="chat-input__box">
                <NInput
                  v-model:value="prompt"
                  type="textarea"
                  :autosize="{ minRows: 1, maxRows: 5 }"
                  placeholder="输入消息，Enter 发送，Shift+Enter 换行"
                  :disabled="testing"
                  @focus="inputFocused = true"
                  @blur="inputFocused = false"
                  @keydown.enter.prevent="handleRun()"
                />
                <div class="chat-input__toolbar">
                  <div class="flex items-center gap-2px">
                    <NUpload
                      v-if="fileCapability.supportLocalFile"
                      multiple
                      :max="fileCapability.limit"
                      :file-list="uploadFiles"
                      :default-upload="false"
                      :accept="fileCapability.accept === '*' ? undefined : fileCapability.accept"
                      class="inline-block"
                      @change="handleLocalFileChange"
                      @remove="handleLocalFileRemove"
                    >
                      <button type="button" class="icon-btn" title="上传文件">
                        <SvgIcon icon="mdi:paperclip" />
                      </button>
                    </NUpload>
                    <span v-if="testing" class="chat-input__status">
                      <span class="pulse-dot" />
                      生成中…
                    </span>
                  </div>
                  <div class="flex items-center gap-6px">
                    <span v-if="prompt.trim() && !testing" class="chat-input__hint">Enter 发送</span>
                    <NButton
                      type="primary"
                      size="small"
                      :loading="testing"
                      :disabled="!prompt.trim()"
                      @click="handleRun()"
                    >
                      <template #icon>
                        <SvgIcon icon="mdi:send" />
                      </template>
                      发送
                    </NButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 工作流主区：单轮运行（输入表单 + 运行结果） -->
        <div v-else class="wf-panel panel-surface">
          <div class="panel-head">
            <SvgIcon :icon="selectedAgent.icon" class="panel-head__icon" />
            <span class="panel-head__title">{{ selectedAgent.name }}</span>
            <NTag size="small" round :bordered="false" class="mode-tag">工作流</NTag>
            <div class="ml-auto flex gap-8px">
              <NButton secondary size="small" :disabled="!testing" @click="handleStop">
                <template #icon>
                  <SvgIcon icon="mdi:stop" />
                </template>
                停止
              </NButton>
              <NButton type="primary" size="small" :loading="testing" :disabled="!prompt.trim()" @click="handleRun()">
                <template #icon>
                  <SvgIcon icon="mdi:play" />
                </template>
                运行
              </NButton>
            </div>
          </div>

          <div class="wf-panel__body">
            <div class="wf-run-form">
              <div class="wf-run-form__desc">
                填写运行参数，点击「运行」执行工作流，下方展示节点执行过程与最终输出。
              </div>

              <NFormItem label="执行说明">
                <NInput
                  v-model:value="prompt"
                  type="textarea"
                  placeholder="输入执行说明，作为工作流输入"
                  :autosize="{ minRows: 2, maxRows: 4 }"
                />
              </NFormItem>

              <template v-if="parameterFields.length">
                <div class="runtime-section__title">工作流变量</div>
                <div class="flex flex-col gap-6px">
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

              <div v-if="quickPrompts.length" class="wf-run-form__prompts">
                <button
                  v-for="item in quickPrompts"
                  :key="item"
                  type="button"
                  class="prompt-chip"
                  @click="handleRun(item)"
                >
                  {{ item }}
                </button>
              </div>
            </div>

            <div class="wf-run-result">
              <div class="wf-run-result__head">运行结果</div>
              <div v-if="streamOutput" class="wf-output">{{ streamOutput }}</div>
              <div v-else class="wf-run-result__empty">运行后在此查看输出</div>

              <div v-if="streamEvents.length" class="wf-run-result__logs">
                <div class="wf-run-result__logtitle">节点执行过程</div>
                <div class="flex flex-col gap-6px">
                  <div
                    v-for="item in streamEvents"
                    :key="item.id"
                    class="step-card"
                    :class="{ 'step-card--tool': item.kind === 'tool' }"
                  >
                    <div class="step-label">
                      <SvgIcon v-if="item.kind === 'tool'" icon="mdi:toolbox-outline" class="step-label__icon" />
                      {{ item.label }}
                    </div>
                    <div class="step-detail">{{ item.detail }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>

  <!-- 会话重命名弹窗 -->
  <NModal
    :show="!!renameTarget"
    preset="card"
    title="重命名会话"
    style="max-width: 420px"
    :bordered="false"
    @update:show="
      val => {
        if (!val) renameTarget = null;
      }
    "
  >
    <NInput
      v-model:value="renameValue"
      placeholder="请输入新的会话名称"
      maxlength="80"
      clearable
      autofocus
      @keyup.enter="submitRename"
    />
    <template #footer>
      <div class="flex justify-end gap-8px">
        <NButton size="small" @click="renameTarget = null">取消</NButton>
        <NButton type="primary" size="small" :loading="renameLoading" @click="submitRename">确定</NButton>
      </div>
    </template>
  </NModal>
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
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: 1fr;
  gap: 10px;
  min-height: 0;
  height: 100%;
}

/* 对话主区 */
.chat-panel {
  display: flex;
  flex-direction: row;
  min-height: 0;
  min-width: 0;
  height: 100%;
  /* clip 而非 hidden：保留圆角裁剪，但不建立滚动容器，使输入条 sticky 能响应外层滚动 */
  overflow: clip;
}

.chat-body {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 历史会话列 */
.conversation-pane {
  flex: 0 0 212px;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--agent-line);

  &__head {
    flex-shrink: 0;
    padding: 10px;
    border-bottom: 1px solid var(--agent-line);
  }

  &__new {
    color: rgba(41, 163, 255, 0.9);
  }

  &__loading {
    padding: 14px 12px;
    font-size: 12px;
    color: rgba(203, 227, 255, 0.45);
  }

  &__list {
    flex: 1;
    overflow-y: auto;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
}

.conversation-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgba(203, 227, 255, 0.72);
  text-align: left;
  cursor: pointer;
  font-family: inherit;

  &:hover {
    background: rgba(41, 163, 255, 0.1);
  }

  &--active {
    background: rgba(41, 163, 255, 0.16);
    color: #29a3ff;
  }

  &__title {
    width: 100%;
    padding-right: 22px;
    font-size: 12px;
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__time {
    font-size: 10px;
    color: rgba(203, 227, 255, 0.35);
  }

  &__actions {
    position: absolute;
    top: 6px;
    right: 6px;
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  &__action {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    color: rgba(203, 227, 255, 0.45);
    transition:
      background 0.2s ease,
      color 0.2s ease;

    &:hover {
      background: rgba(41, 163, 255, 0.18);
      color: #29a3ff;
    }

    &--danger:hover {
      background: rgba(255, 90, 120, 0.16);
      color: #ff7a95;
    }
  }

  &:hover &__actions,
  &--active &__actions {
    opacity: 1;
  }
}

/* 工作流主区 */
.wf-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  height: 100%;
  overflow: hidden;

  &__body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 14px 18px;
    overflow-y: auto;
    min-height: 0;
  }
}

.wf-run-form {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &__desc {
    font-size: 12px;
    color: rgba(203, 227, 255, 0.55);
    margin-bottom: 6px;
  }

  &__prompts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }
}

.wf-run-result {
  margin-top: 4px;

  &__head {
    font-size: 13px;
    font-weight: 700;
    color: #eaf5ff;
    margin-bottom: 8px;
  }

  &__empty {
    font-size: 12px;
    color: rgba(203, 227, 255, 0.4);
    padding: 16px 0;
    text-align: center;
    border: 1px dashed rgba(25, 95, 176, 0.25);
    border-radius: 6px;
  }

  &__logs {
    margin-top: 14px;
  }

  &__logtitle {
    font-size: 12px;
    font-weight: 600;
    color: rgba(203, 227, 255, 0.7);
    margin-bottom: 6px;
  }
}

.wf-output {
  padding: 12px 14px;
  border-radius: 6px;
  background: rgba(6, 20, 38, 0.5);
  border: 1px solid rgba(25, 95, 176, 0.18);
  color: rgba(41, 163, 255, 0.9);
  font-size: 13px;
  line-height: 22px;
  white-space: pre-wrap;
  word-break: break-word;
}

.mode-tag {
  background: rgba(41, 163, 255, 0.12);
  border: 1px solid rgba(41, 163, 255, 0.25);
  color: rgba(41, 163, 255, 0.95);
  margin-left: 8px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

.chat-welcome {
  margin: auto;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: rgba(203, 227, 255, 0.6);

  &__icon {
    font-size: 46px;
    color: rgba(41, 163, 255, 0.35);
  }

  &__title {
    font-size: 16px;
    font-weight: 700;
    color: #eaf5ff;
  }

  &__desc {
    font-size: 12px;
    max-width: 420px;
    line-height: 1.6;
  }

  &__prompts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
    max-width: 420px;
  }
}

.chat-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  animation: chat-in 0.25s ease;

  &.user {
    flex-direction: row-reverse;
  }
}

@keyframes chat-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.chat-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
  font-size: 16px;
  color: #fff;

  &.user {
    background: linear-gradient(135deg, #3b82f6, #60a5fa);
  }

  &.assistant {
    background: linear-gradient(135deg, #8b5cf6, #a78bfa);
    box-shadow: 0 0 10px rgba(139, 92, 246, 0.3);
  }
}

.chat-bubble {
  max-width: 76%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;

  &.user {
    background: linear-gradient(135deg, rgba(19, 95, 182, 0.55), rgba(9, 46, 92, 0.55));
    border: 1px solid rgba(61, 166, 255, 0.35);
    color: #fff;
    border-bottom-right-radius: 4px;
  }

  &.assistant {
    background: rgba(6, 20, 38, 0.5);
    border: 1px solid rgba(25, 95, 176, 0.22);
    color: #d6eaff;
    border-bottom-left-radius: 4px;
  }

  &__loading {
    display: inline-flex;
    gap: 4px;
    padding: 4px 0;

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: rgba(41, 163, 255, 0.6);
      animation: chat-blink 1.2s infinite;

      &:nth-child(2) {
        animation-delay: 0.2s;
      }

      &:nth-child(3) {
        animation-delay: 0.4s;
      }
    }
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  &:hover &__meta {
    opacity: 1;
  }

  &__time {
    font-size: 11px;
    color: rgba(203, 227, 255, 0.4);
  }

  &__suggested {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }
}

/* 思考过程折叠面板（对齐 Dify 折叠设计） */
.think-panel {
  margin-bottom: 8px;
  border: 1px solid rgba(25, 95, 176, 0.22);
  border-radius: 6px;
  background: rgba(12, 38, 72, 0.35);
  font-size: 12px;

  &__summary {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    cursor: pointer;
    list-style: none;
    user-select: none;
    color: rgba(147, 196, 255, 0.75);

    &::-webkit-details-marker {
      display: none;
    }
  }

  &__chevron {
    display: inline-block;
    font-size: 10px;
    transition: transform 0.25s ease;
    color: rgba(41, 163, 255, 0.85);
  }

  &[open] &__chevron {
    transform: rotate(90deg);
  }

  &__label {
    font-weight: 600;
    color: rgba(203, 227, 255, 0.75);

    &--active {
      color: rgba(41, 163, 255, 0.95);
    }
  }

  &__body {
    margin: 0 8px 8px 8px;
    padding: 8px 10px;
    border-left: 2px solid rgba(41, 163, 255, 0.4);
    background: rgba(6, 20, 38, 0.45);
    border-radius: 0 4px 4px 0;
    color: rgba(203, 227, 255, 0.62);
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }
}

/* 打字机光标 */
.type-cursor {
  display: inline-block;
  margin-left: 1px;
  color: rgba(41, 163, 255, 0.9);
  animation: type-cursor-blink 0.9s steps(1) infinite;
}

@keyframes type-cursor-blink {
  0%,
  60% {
    opacity: 1;
  }

  61%,
  100% {
    opacity: 0;
  }
}

.copy-btn {
  appearance: none;
  border: none;
  background: transparent;
  padding: 0;
  color: rgba(203, 227, 255, 0.45);
  cursor: pointer;
  font-size: 13px;
  display: inline-flex;
  align-items: center;

  &:hover {
    color: #29a3ff;
  }
}

@keyframes chat-blink {
  0%,
  80%,
  100% {
    opacity: 0.3;
  }

  40% {
    opacity: 1;
  }
}

.chat-input {
  position: sticky;
  bottom: 0;
  z-index: 5;
  /* 与 panel-surface 同底色，吸附时遮挡滚动内容 */
  background: var(--agent-surface-bg);
  border-radius: 0 0 var(--agent-radius) var(--agent-radius);
  padding: 10px 14px 12px;
  transition: box-shadow 0.2s ease;

  /* 浮动输入条：与消息区留出间距，聚焦时高亮描边 */
  &__box {
    background: rgba(12, 38, 72, 0.45);
    border: 1px solid rgba(25, 95, 176, 0.22);
    border-radius: 12px;
    padding: 8px 12px 6px;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  &--focused &__box {
    border-color: rgba(41, 163, 255, 0.55);
    box-shadow: 0 0 0 3px rgba(41, 163, 255, 0.08);
  }

  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
  }

  &__status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: rgba(41, 163, 255, 0.85);
  }

  &__hint {
    font-size: 11px;
    color: rgba(203, 227, 255, 0.4);
  }
}

.pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #29a3ff;
  animation: pulse-dot 1s infinite;
}

@keyframes pulse-dot {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(41, 163, 255, 0.5);
  }

  50% {
    box-shadow: 0 0 0 6px rgba(41, 163, 255, 0);
  }
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgba(203, 227, 255, 0.7);
  cursor: pointer;
  font-size: 17px;

  &:hover {
    background: rgba(41, 163, 255, 0.12);
    color: #29a3ff;
  }
}

.runtime-section__title {
  margin: 4px 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(203, 227, 255, 0.82);
}

.prompt-chip {
  font-size: 12px;
  padding: 5px 12px;
  border: 1px solid rgba(41, 163, 255, 0.25);
  border-radius: 999px;
  background: rgba(41, 163, 255, 0.08);
  color: rgba(203, 227, 255, 0.85);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: #29a3ff;
    background: rgba(41, 163, 255, 0.16);
    color: #29a3ff;
  }
}

.step-card {
  padding: 10px 12px;
  border-radius: 4px;
  background: rgba(12, 38, 72, 0.4);
  border: 1px solid rgba(25, 95, 176, 0.12);

  &--tool {
    background: rgba(52, 211, 153, 0.06);
    border-color: rgba(52, 211, 153, 0.28);
    border-left: 3px solid rgba(52, 211, 153, 0.7);
  }
}

.step-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #eaf5ff;

  &__icon {
    width: 13px;
    height: 13px;
    color: #34d399;
  }
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

  .agent-main {
    grid-template-columns: 1fr;
  }

  .agent-sidebar {
    max-height: 280px;
  }

  .conversation-pane {
    flex-basis: 168px;
  }

  .chat-bubble {
    max-width: 92%;
  }
}
</style>
