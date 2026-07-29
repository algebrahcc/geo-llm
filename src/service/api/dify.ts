import { request } from '../request/real';
import { getAuthorization } from '../request/shared';

/**
 * Dify 阻塞对话（一次性返回完整回复）
 */
export function fetchDifyChat(data: Api.Dify.ChatReq) {
  return request<Api.Dify.ChatResp>({
    url: '/api/dify/chat',
    method: 'post',
    data
  });
}

/**
 * Dify 应用元信息（名称/描述/输入表单等）
 */
export function fetchDifyInfo(appId?: number) {
  return request<Api.Dify.AppInfo>({
    url: '/api/dify/info',
    method: 'get',
    params: { appId }
  });
}

/**
 * Dify 应用参数
 */
export function fetchDifyParameters(appId?: number) {
  return request<Api.Dify.AppParameters>({
    url: '/api/dify/parameters',
    method: 'get',
    params: { appId }
  });
}

/**
 * Dify 应用元数据
 */
export function fetchDifyMeta(appId?: number) {
  return request<Api.Dify.AppMeta>({
    url: '/api/dify/meta',
    method: 'get',
    params: { appId }
  });
}

/**
 * Dify 模型配置（model/temperature 等），对应 GET /v1/model-config
 */
export function fetchDifyModelConfig(appId?: number) {
  return request<Api.Dify.ModelConfig>({
    url: '/api/dify/model-config',
    method: 'get',
    params: { appId }
  });
}

/**
 * 更新 Dify 模型配置，对应 POST /v1/model-config
 */
export function updateDifyModelConfig(appId: number, body: Api.Dify.ModelConfigPayload) {
  return request<Api.Dify.ModelConfig>({
    url: '/api/dify/model-config',
    method: 'post',
    params: { appId },
    data: body
  });
}

/**
 * Dify Agent 策略配置，对应 GET /v1/advanced-model
 */
export function fetchDifyAdvancedModel(appId?: number) {
  return request<Api.Dify.AdvancedModel>({
    url: '/api/dify/advanced-model',
    method: 'get',
    params: { appId }
  });
}

/**
 * 更新 Dify Agent 策略配置，对应 POST /v1/advanced-model
 */
export function updateDifyAdvancedModel(appId: number, body: Api.Dify.AdvancedModelPayload) {
  return request<Api.Dify.AdvancedModel>({
    url: '/api/dify/advanced-model',
    method: 'post',
    params: { appId },
    data: body
  });
}

/**
 * Dify 会话列表
 */
export function fetchDifyConversations(params: { appId?: number; userId: string; limit?: number; sortBy?: string }) {
  return request<Api.Dify.ConversationList>({
    url: '/api/dify/conversations',
    method: 'get',
    params
  });
}

/**
 * Dify 会话消息历史
 */
export function fetchDifyConversationMessages(params: {
  appId?: number;
  userId: string;
  conversationId: string;
  lastId?: string;
  limit?: number;
}) {
  return request<Api.Dify.ConversationMessages>({
    url: `/api/dify/conversations/${params.conversationId}/messages`,
    method: 'get',
    params: { appId: params.appId, userId: params.userId, lastId: params.lastId, limit: params.limit }
  });
}

/**
 * 获取建议问题
 */
export function fetchDifySuggestedQuestions(params: { appId?: number; messageId: string; userId: string }) {
  return request<Api.Dify.SuggestedQuestionsResp>({
    url: `/api/dify/messages/${params.messageId}/suggested`,
    method: 'get',
    params: { appId: params.appId, userId: params.userId }
  });
}

/**
 * Dify 删除会话
 */
export function deleteDifyConversation(params: { appId?: number; userId: string; conversationId: string }) {
  return request({
    url: `/api/dify/conversations/${params.conversationId}`,
    method: 'delete',
    params: { appId: params.appId, userId: params.userId }
  });
}

/**
 * 会话重命名
 */
export function renameDifyConversation(conversationId: string, data: Api.Dify.ConversationRenameReq) {
  return request<Record<string, unknown>>({
    url: `/api/dify/conversations/${conversationId}/name`,
    method: 'post',
    data
  });
}

/**
 * Dify 消息反馈（like / dislike）
 */
export function fetchDifyFeedback(params: Api.Dify.FeedbackReq) {
  return request({
    url: `/api/dify/messages/${params.messageId}/feedbacks`,
    method: 'post',
    params: { appId: params.appId, userId: params.userId, rating: params.rating, content: params.content }
  });
}

/**
 * Dify 停止流式生成
 */
export function fetchDifyStop(params: { appId?: number; taskId: string; userId: string }) {
  return request({
    url: `/api/dify/chat-messages/${params.taskId}/stop`,
    method: 'post',
    params: { appId: params.appId, userId: params.userId }
  });
}

/**
 * Dify 文件上传（multipart）
 */
export function fetchDifyFileUpload(appId: number | undefined, userId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('userId', userId);
  if (appId !== undefined) {
    formData.append('appId', String(appId));
  }
  return request<Api.Dify.FileUploadResp>({
    url: '/api/dify/files/upload',
    method: 'post',
    data: formData
  });
}

/**
 * Dify Workflow 阻塞运行（返回完整 outputs）
 */
export function fetchDifyWorkflowRun(params: Api.Dify.WorkflowRunReq) {
  return request<Api.Dify.WorkflowRunResp>({
    url: '/api/dify/workflow/run',
    method: 'post',
    data: params
  });
}

/** Dify 流式对话回调 */
export interface DifyChatStreamHandlers {
  /** 收到一段增量回复文本 */
  onDelta?: (text: string) => void;
  /** 对话结束，回传会话/消息/任务标识 */
  onDone?: (payload: { conversationId?: string; messageId?: string; taskId?: string } | string) => void;
  /** Agent 思考过程 */
  onThought?: (payload: Record<string, unknown>) => void;
  /** 命名事件透传 */
  onEvent?: (eventName: string, payload: Record<string, unknown>) => void;
  /** 出错 */
  onError?: (message: string) => void;
}

/**
 * Dify SSE 流式对话
 *
 * 后端 GET /api/dify/chat/stream 返回 text/event-stream，无法走统一 request 实例，这里用 fetch 直接消费。
 *
 * 后端 SSE 事件约定：
 * - 默认（无 event 名）的 data 行 = 增量回复文本
 * - event: done   的 data = conversationId
 * - event: error  的 data = 错误信息
 *
 * @param params 请求参数（appId / userId / query / conversationId）
 * @param handlers 流式事件回调
 * @param signal 可用于取消（AbortController）
 */
export async function fetchDifyChatStream(
  params: Api.Dify.ChatReq,
  handlers: DifyChatStreamHandlers,
  signal?: AbortSignal
) {
  const baseURL = import.meta.env.VITE_SERVICE_REAL_BASE_URL || 'http://localhost:8000';
  const url = new URL(`${baseURL}/api/dify/chat/stream`);

  const resp = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthorization() ?? ''
    },
    body: JSON.stringify(params),
    signal
  });

  if (!resp.ok || !resp.body) {
    throw new Error(`Dify stream failed: ${resp.status}`);
  }

  let hasAgentMessageDelta = false;
  consumeSse(resp.body, (eventName, data) => {
    if (eventName === 'error') {
      handlers.onError?.(data);
      return;
    }

    if (eventName === 'done') {
      try {
        handlers.onDone?.(JSON.parse(data) as { conversationId?: string; messageId?: string; taskId?: string });
      } catch {
        handlers.onDone?.(data);
      }
      return;
    }

    if (!data) return;

    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(data) as Record<string, unknown>;
    } catch {
      handlers.onDelta?.(data);
      return;
    }

    if (eventName === 'agent_message') {
      hasAgentMessageDelta = true;
      const text = String(payload.answer || '');
      if (text) handlers.onDelta?.(text);
    }

    if (eventName === 'message' && !hasAgentMessageDelta) {
      const text = String(payload.answer || '');
      if (text) handlers.onDelta?.(text);
    }

    if (eventName === 'agent_thought') {
      handlers.onThought?.(payload);
    }

    handlers.onEvent?.(eventName, payload);
  });
}

/** Dify Workflow 流式运行回调 */
export interface DifyWorkflowStreamHandlers {
  /** 收到一个命名事件（workflow_started / node_started / node_finished ...），data 为原始 JSON 字符串 */
  onEvent?: (event: string, data: string) => void;
  /** 工作流结束，data 为 outputs 的 JSON 字符串 */
  onDone?: (outputsJson: string) => void;
  /** 出错 */
  onError?: (message: string) => void;
}

/**
 * Dify Workflow SSE 流式运行（逐节点进度）
 *
 * 后端 POST /api/dify/workflow/stream 返回 text/event-stream。
 *
 * 后端 SSE 事件约定：
 * - event: done   的 data = outputs JSON 字符串
 * - event: error  的 data = 错误信息
 * - 其它命名事件（workflow_started / node_* / ...）原样透传
 *
 * @param data 请求体（appId / userId / inputs）
 * @param handlers 流式事件回调
 * @param signal 可用于取消
 */
export async function fetchDifyWorkflowStream(
  data: Api.Dify.WorkflowRunReq,
  handlers: DifyWorkflowStreamHandlers,
  signal?: AbortSignal
) {
  const baseURL = import.meta.env.VITE_SERVICE_REAL_BASE_URL || 'http://localhost:8000';
  const url = new URL(`${baseURL}/api/dify/workflow/stream`);

  const resp = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: getAuthorization() ?? '' },
    body: JSON.stringify(data),
    signal
  });

  if (!resp.ok || !resp.body) {
    throw new Error(`Dify workflow stream failed: ${resp.status}`);
  }

  consumeSse(resp.body, (eventName, dataStr) => {
    if (eventName === 'done') handlers.onDone?.(dataStr);
    else if (eventName === 'error') handlers.onError?.(dataStr);
    else if (eventName && dataStr) handlers.onEvent?.(eventName, dataStr);
  });
}

/**
 * Workflow 执行详情
 */
export function fetchDifyWorkflowRunDetail(params: { appId?: number; workflowRunId: string }) {
  return request<Api.Dify.WorkflowRunDetail>({
    url: `/api/dify/workflow/run/${params.workflowRunId}`,
    method: 'get',
    params: { appId: params.appId }
  });
}

/**
 * Workflow 运行日志
 */
export function fetchDifyWorkflowLogs(params: {
  appId?: number;
  keyword?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  return request<Api.Dify.WorkflowLogList>({
    url: '/api/dify/workflow/logs',
    method: 'get',
    params
  });
}

/**
 * 停止 Workflow 流式执行
 */
export function fetchDifyWorkflowStop(params: { appId?: number; taskId: string; userId: string }) {
  return request<void>({
    url: `/api/dify/workflow/tasks/${params.taskId}/stop`,
    method: 'post',
    params: { appId: params.appId, userId: params.userId }
  });
}

/**
 * 通用 SSE 解析：按空行切分事件，提取 event 名与 data 内容。
 *
 * @param body         ReadableStream<Uint8Array>
 * @param onEvent      (eventName, data) => void，eventName 为空表示默认事件
 */
async function consumeSse(body: ReadableStream<Uint8Array>, onEvent: (eventName: string, data: string) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = '';
  let dataLines: string[] = [];

  const dispatch = () => {
    const data = dataLines.join('\n');
    if (eventName === 'done') onEvent('done', data);
    else if (eventName === 'error') onEvent('error', data);
    else if (eventName) onEvent(eventName, data);
    else if (data) onEvent('', data);
    eventName = '';
    dataLines = [];
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '') {
        dispatch();
        continue;
      }
      if (trimmed.startsWith('event:')) {
        eventName = trimmed.slice(6).trim();
      } else if (trimmed.startsWith('data:')) {
        dataLines.push(trimmed.slice(5).trim());
      }
    }
  }
  dispatch();
}
