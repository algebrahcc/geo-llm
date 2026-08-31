import { computed, nextTick, reactive, ref, watch, type Ref } from 'vue';
import type { UploadFileInfo } from 'naive-ui';
import {
  deleteDifyConversation,
  fetchDifyConversations,
  fetchDifyConversationMessages,
  fetchDifyFileUpload,
  fetchDifyParameters,
  fetchDifyStop,
  fetchDifySuggestedQuestions,
  fetchDifyWorkflowStop
} from '@/service/api/dify';
import { fetchDifyChatStream, fetchDifyWorkflowStream } from '@/service/api/dify-stream';
import type { AgentDefinition, AgentKey } from './types';
import {
  asList,
  buildInitialParameterValues,
  buildTestRecord,
  normalizeFileCapability,
  normalizeParameterFields,
  normalizeSuggestedQuestions,
  stringifyOutput
} from './real';

export type ChatMsg = {
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
  // 大小写不敏感：lower 与 raw 仅 ASCII/中文场景长度一致，索引可直接复用
  const lower = raw.toLowerCase();
  let pos = 0;
  while (true) {
    const start = lower.indexOf('<think>', pos);
    if (start === -1) {
      contentParts.push(raw.slice(pos));
      break;
    }
    contentParts.push(raw.slice(pos, start));
    const end = lower.indexOf('</think>', start + 7);
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

/**
 * 对话/runtime 内核（chat 内核 composable）：
 * 承载对话型与工作流型应用的测试运行全部状态与逻辑，页面只做装配。
 */
export function useAgentChat(opts: {
  agentKey: Ref<AgentKey>;
  selectedAgent: Ref<AgentDefinition>;
  currentAppId: Ref<string | undefined>;
  userId: Ref<string>;
}) {
  const { agentKey, selectedAgent, currentAppId, userId } = opts;

  // ---------- 运行状态 ----------
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

  // ---------- 对话状态 ----------
  const prompt = ref('');
  const parameterValues = reactive<Record<string, unknown>>({});
  const messages = ref<ChatMsg[]>([]);
  const messageArea = ref<HTMLElement | null>(null);
  /** 思考过程面板完成后是否默认折叠（对齐 Dify：进行中展开，完成后收起） */
  const reasoningPanelClosed = ref(true);
  const currentConversationId = ref('');
  /** 输入框聚焦态，用于视觉高亮 */
  const inputFocused = ref(false);

  // ---------- 计算属性 ----------
  const isWorkflow = computed(() => selectedAgent.value.appType === 3);
  const parameterFields = computed(() => normalizeParameterFields(parameters.value));
  const fileCapability = computed(() => normalizeFileCapability(parameters.value));
  const quickPrompts = computed(() => {
    const fromParameters = normalizeSuggestedQuestions({
      data: Array.isArray(parameters.value?.suggested_questions) ? parameters.value.suggested_questions : []
    });
    return fromParameters.length ? fromParameters : selectedAgent.value.recommendedPrompts;
  });

  // ---------- 消息操作 ----------
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

  // ---------- 参数操作 ----------
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

  // ---------- 事件流与文件 ----------
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

  // ---------- 会话列表 ----------
  /** 历史会话列表（仅对话型应用） */
  const conversationList = ref<Api.Dify.ConversationItem[]>([]);
  const conversationLoading = ref(false);

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

  /** 会话重命名成功回调：更新列表对应项标题 */
  function applyRenamed(conv: Api.Dify.ConversationItem, name: string) {
    const updated = { ...conv, name };
    conversationList.value = conversationList.value.map(c => (c.id === conv.id ? updated : c));
  }

  /** 切换到指定历史会话并加载其消息 */
  async function switchConversation(conversationId: string) {
    if (!currentAppId.value || !userId.value) return;
    // 中止在途流式任务，避免旧流继续写入已替换的对话气泡
    currentController?.abort();
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
    currentController?.abort();
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

  // 切换智能体：重置输入、参数与会话上下文
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

  // ---------- 运行控制 ----------
  async function handleStop() {
    if (!currentAppId.value || !userId.value) {
      return;
    }

    try {
      // 任务 id 尚未下发时跳过停止请求，但仍中止本地流，保证「停止」始终生效
      if (isWorkflow.value && currentTaskId.value) {
        await fetchDifyWorkflowStop({
          appId: currentAppId.value,
          taskId: currentTaskId.value,
          userId: userId.value
        });
      } else if (currentTaskId.value) {
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

  function clearChat() {
    currentController?.abort();
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
              // done 事件的 data 约定为 outputs JSON；异常时按原文兜底，避免整个运行被误判失败
              let output = '';
              try {
                output = stringifyOutput(JSON.parse(outputsJson));
              } catch {
                output = stringifyOutput(outputsJson);
              }
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
        // 透出具体错误（如文件上传失败、后端异常），便于排查
        const message = error instanceof Error ? error.message : '测试失败，请稍后重试';
        appendEvent('错误', message);
        window.$message?.error(message);
      }
    } finally {
      testing.value = false;
      if (botMsg) botMsg.streaming = false;
      currentController = null;
    }
  }

  return {
    // 运行态
    testing,
    latestRecord,
    parameters,
    uploadFiles,
    streamOutput,
    streamEvents,
    suggestedQuestions,
    currentTaskId,
    currentMessageId,
    // 对话态
    prompt,
    parameterValues,
    messages,
    messageArea,
    reasoningPanelClosed,
    currentConversationId,
    inputFocused,
    // 会话态
    conversationList,
    conversationLoading,
    // 计算
    isWorkflow,
    parameterFields,
    fileCapability,
    quickPrompts,
    // 方法
    pushMessage,
    copyMessage,
    scrollMessageArea,
    resetParameterValues,
    getFieldStringValue,
    getFieldNumberValue,
    getFieldSelectValue,
    getFieldSwitchValue,
    updateFieldValue,
    appendEvent,
    loadParameters,
    buildRuntimeInputs,
    collectRuntimeFiles,
    handleLocalFileChange,
    handleLocalFileRemove,
    loadConversations,
    mapMessages,
    removeConversation,
    applyRenamed,
    switchConversation,
    newConversation,
    loadHistory,
    handleStop,
    clearChat,
    handleRun
  };
}
