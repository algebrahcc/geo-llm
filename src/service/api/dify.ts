import { request } from '../request/real';

/**
 * Dify REST API（阻塞接口）。
 *
 * SSE 流式接口（fetchDifyChatStream / fetchDifyWorkflowStream）已拆至 dify-stream.ts。
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
export function fetchDifyInfo(appId?: string | number) {
  return request<Api.Dify.AppInfo>({
    url: '/api/dify/info',
    method: 'get',
    params: { appId }
  });
}

/**
 * Dify 应用参数
 */
export function fetchDifyParameters(appId?: string | number) {
  return request<Api.Dify.AppParameters>({
    url: '/api/dify/parameters',
    method: 'get',
    params: { appId }
  });
}

/**
 * Dify 应用元数据
 */
export function fetchDifyMeta(appId?: string | number) {
  return request<Api.Dify.AppMeta>({
    url: '/api/dify/meta',
    method: 'get',
    params: { appId }
  });
}

/**
 * Dify 模型配置（model/temperature 等），对应 GET /v1/model-config
 */
export function fetchDifyModelConfig(appId?: string | number) {
  return request<Api.Dify.ModelConfig>({
    url: '/api/dify/model-config',
    method: 'get',
    params: { appId }
  });
}

/**
 * 更新 Dify 模型配置，对应 POST /v1/model-config
 */
export function updateDifyModelConfig(appId: string | number, body: Api.Dify.ModelConfigPayload) {
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
export function fetchDifyAdvancedModel(appId?: string | number) {
  return request<Api.Dify.AdvancedModel>({
    url: '/api/dify/advanced-model',
    method: 'get',
    params: { appId }
  });
}

/**
 * 更新 Dify Agent 策略配置，对应 POST /v1/advanced-model
 */
export function updateDifyAdvancedModel(appId: string | number, body: Api.Dify.AdvancedModelPayload) {
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
export function fetchDifyConversations(params: {
  appId?: string | number;
  userId: string;
  limit?: number;
  sortBy?: string;
}) {
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
  appId?: string | number;
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
export function fetchDifySuggestedQuestions(params: { appId?: string | number; messageId: string; userId: string }) {
  return request<Api.Dify.SuggestedQuestionsResp>({
    url: `/api/dify/messages/${params.messageId}/suggested`,
    method: 'get',
    params: { appId: params.appId, userId: params.userId }
  });
}

/**
 * 删除会话
 */
export function deleteDifyConversation(params: { appId?: string | number; userId: string; conversationId: string }) {
  return request<Record<string, unknown>>({
    url: `/api/dify/conversations/${params.conversationId}`,
    method: 'delete',
    params: { appId: params.appId, userId: params.userId }
  });
}

/**
 * 会话重命名
 */
export function renameDifyConversation(params: {
  appId?: string | number;
  userId: string;
  conversationId: string;
  name: string;
  autoGenerateName?: boolean;
}) {
  return request<Api.Dify.ConversationItem>({
    url: `/api/dify/conversations/${params.conversationId}/name`,
    method: 'post',
    params: { appId: params.appId },
    data: {
      userId: params.userId,
      name: params.name,
      autoGenerateName: params.autoGenerateName
    }
  });
}

/**
 * Dify 停止流式生成
 */
export function fetchDifyStop(params: { appId?: string | number; taskId: string; userId: string }) {
  return request({
    url: `/api/dify/chat-messages/${params.taskId}/stop`,
    method: 'post',
    params: { appId: params.appId, userId: params.userId }
  });
}

/**
 * Dify 文件上传（multipart）
 */
export function fetchDifyFileUpload(appId: string | number | undefined, userId: string, file: File) {
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
 * Workflow 运行日志
 */
export function fetchDifyWorkflowLogs(params: {
  appId?: string | number;
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
export function fetchDifyWorkflowStop(params: { appId?: string | number; taskId: string; userId: string }) {
  return request<void>({
    url: `/api/dify/workflow/tasks/${params.taskId}/stop`,
    method: 'post',
    params: { appId: params.appId, userId: params.userId }
  });
}
