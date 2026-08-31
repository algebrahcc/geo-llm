import { getAuthorization } from '../request/shared';

/**
 * Dify SSE 流式接口。
 *
 * 后端流式端点（/api/dify/chat/stream、/api/dify/workflow/stream）返回 text/event-stream，
 * 无法走统一 request 实例，这里直接用 fetch 消费。两个流共用通用 SSE 解析器 consumeSse。
 */

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
 * 后端 GET /api/dify/chat/stream 返回 text/event-stream。
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
        const payload = JSON.parse(data);
        if (typeof payload === 'string') {
          // 与 message 分支同理：后端 SseEmitter 可能把 String data 再序列化一次，
          // 若不做二次解析，conversationId 会被整体污染成 JSON 字符串导致后续请求失败
          handlers.onDone?.(JSON.parse(payload) as { conversationId?: string; messageId?: string; taskId?: string });
        } else {
          handlers.onDone?.(payload as { conversationId?: string; messageId?: string; taskId?: string });
        }
      } catch {
        handlers.onDone?.(data);
      }
      return;
    }

    if (!data) return;

    let payload: unknown = {};
    try {
      payload = JSON.parse(data);
    } catch {
      handlers.onDelta?.(data);
      return;
    }

    // 后端 SseEmitter 会把 String 类型的 data 再序列化一次，导致多包一层引号，
    // JSON.parse 得到的是字符串而非对象，需要二次解析才能拿到真正的消息对象。
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        handlers.onDelta?.(data);
        return;
      }
    }
    if (!payload || typeof payload !== 'object') {
      handlers.onDelta?.(data);
      return;
    }
    const eventPayload = payload as Record<string, unknown>;

    if (eventName === 'agent_message') {
      hasAgentMessageDelta = true;
      const text = String(eventPayload.answer || '');
      if (text) handlers.onDelta?.(text);
    }

    if (eventName === 'message' && !hasAgentMessageDelta) {
      const text = String(eventPayload.answer || '');
      if (text) handlers.onDelta?.(text);
    }

    if (eventName === 'agent_thought') {
      handlers.onThought?.(eventPayload);
    }

    handlers.onEvent?.(eventName, eventPayload);
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
 * 通用 SSE 解析：按空行切分事件，提取 event 名与 data 内容。
 *
 * @param body    ReadableStream<Uint8Array>
 * @param onEvent (eventName, data) => void，eventName 为空表示默认事件
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
