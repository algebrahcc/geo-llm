import { request } from '../request/real';

/**
 * Dify 1.16 原生 Agent（mode=agent）管理接口
 *
 * 路径约定（与后端 DifyAgentController 一致）：统一 /api/dify/agent/**，
 * 以本地应用 ID（appId）为路径参数，后端自动解析 agent_id（bound_agent_id）。
 */
const base = '/api/dify/agent';

/** 原生 Agent 详情（GET /api/dify/agent/{appId}） */
export function fetchDifyAgentDetail(appId: string | number) {
  return request<Api.DifyAgent.Detail>({
    url: `${base}/${appId}`,
    method: 'get'
  });
}

/** 更新原生 Agent 基本信息（POST /api/dify/agent/{appId}/update） */
export function updateDifyAgentDetail(appId: string | number, data: Api.DifyAgent.UpdateReq) {
  return request<Api.DifyAgent.Detail>({
    url: `${base}/${appId}/update`,
    method: 'post',
    data
  });
}

/** 删除原生 Agent（DELETE /api/dify/agent/{appId}） */
export function deleteDifyAgent(appId: string | number) {
  return request<void>({
    url: `${base}/${appId}`,
    method: 'delete'
  });
}

/** 复制原生 Agent（POST /api/dify/agent/{appId}/copy） */
export function copyDifyAgent(appId: string | number, data?: Api.DifyAgent.CopyReq) {
  return request<Api.DifyAgent.Detail>({
    url: `${base}/${appId}/copy`,
    method: 'post',
    data
  });
}

/** 刷新原生 Agent 调试会话（POST /api/dify/agent/{appId}/debug-conversation/refresh） */
export function refreshDifyAgentDebugConversation(appId: string | number) {
  return request<unknown>({
    url: `${base}/${appId}/debug-conversation/refresh`,
    method: 'post'
  });
}

/** 原生 Agent API 访问状态（GET /api/dify/agent/{appId}/api-access） */
export function fetchDifyAgentApiAccess(appId: string | number) {
  return request<Api.DifyAgent.ApiAccess>({
    url: `${base}/${appId}/api-access`,
    method: 'get'
  });
}

/** 开启/关闭原生 Agent API 访问（POST /api/dify/agent/{appId}/api-enable） */
export function enableDifyAgentApi(appId: string | number, enableApi: boolean) {
  return request<Api.DifyAgent.ApiAccess>({
    url: `${base}/${appId}/api-enable`,
    method: 'post',
    data: { enable_api: enableApi }
  });
}

/** 原生 Agent API Key 列表（GET /api/dify/agent/{appId}/api-keys） */
export function fetchDifyAgentApiKeys(appId: string | number) {
  return request<Api.DifyAgent.ApiKey[]>({
    url: `${base}/${appId}/api-keys`,
    method: 'get'
  });
}

/** 创建原生 Agent API Key（POST /api/dify/agent/{appId}/api-keys） */
export function createDifyAgentApiKey(appId: string | number) {
  return request<Api.DifyAgent.ApiKey>({
    url: `${base}/${appId}/api-keys`,
    method: 'post'
  });
}

/** 删除原生 Agent API Key（DELETE /api/dify/agent/{appId}/api-keys/{apiKeyId}） */
export function deleteDifyAgentApiKey(appId: string | number, apiKeyId: string) {
  return request<void>({
    url: `${base}/${appId}/api-keys/${apiKeyId}`,
    method: 'delete'
  });
}

/** 原生 Agent 版本列表（GET /api/dify/agent/{appId}/versions） */
export function fetchDifyAgentVersions(appId: string | number) {
  return request<Api.DifyAgent.Version[]>({
    url: `${base}/${appId}/versions`,
    method: 'get'
  });
}

/** 原生 Agent 版本详情（GET /api/dify/agent/{appId}/versions/{versionId}） */
export function fetchDifyAgentVersionDetail(appId: string | number, versionId: string) {
  return request<Api.DifyAgent.Version>({
    url: `${base}/${appId}/versions/${versionId}`,
    method: 'get'
  });
}

/** 回滚原生 Agent 到指定版本（POST /api/dify/agent/{appId}/versions/{versionId}/restore） */
export function restoreDifyAgentVersion(appId: string | number, versionId: string) {
  return request<unknown>({
    url: `${base}/${appId}/versions/${versionId}/restore`,
    method: 'post'
  });
}

/** 原生 Agent 日志列表（GET /api/dify/agent/{appId}/logs） */
export function fetchDifyAgentLogs(
  appId: string | number,
  params?: {
    page?: number;
    limit?: number;
    keyword?: string;
    statuses?: string;
    sources?: string;
    sort_by?: string;
    start?: string;
    end?: string;
  }
) {
  return request<Api.DifyAgent.Log[]>({
    url: `${base}/${appId}/logs`,
    method: 'get',
    params
  });
}

/** 原生 Agent 会话消息列表（GET /api/dify/agent/{appId}/logs/{conversationId}/messages） */
export function fetchDifyAgentLogMessages(
  appId: string | number,
  conversationId: string,
  params?: { page?: number; limit?: number }
) {
  return request<Api.DifyAgent.LogMessage[]>({
    url: `${base}/${appId}/logs/${conversationId}/messages`,
    method: 'get',
    params
  });
}

/** 原生 Agent 日志源列表（GET /api/dify/agent/{appId}/log-sources） */
export function fetchDifyAgentLogSources(appId: string | number) {
  return request<Api.DifyAgent.LogSource[]>({
    url: `${base}/${appId}/log-sources`,
    method: 'get'
  });
}

/** 原生 Agent 统计摘要（GET /api/dify/agent/{appId}/statistics/summary） */
export function fetchDifyAgentStatistics(
  appId: string | number,
  params?: { source?: string; start?: string; end?: string }
) {
  return request<Api.DifyAgent.StatisticSummary>({
    url: `${base}/${appId}/statistics/summary`,
    method: 'get',
    params
  });
}

/** 原生 Agent 邀请选项（GET /api/dify/agent/invite-options） */
export function fetchDifyAgentInviteOptions() {
  return request<Array<Record<string, unknown>>>({
    url: `${base}/invite-options`,
    method: 'get'
  });
}
