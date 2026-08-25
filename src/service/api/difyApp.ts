import { request } from '../request/real';

/**
 * Dify 应用 CRUD（后端 /dify/app，ContiNew 标准 CRUD）
 *
 * 路径约定（与后端 @CrudRequestMapping 一致）：
 * - 分页：  POST   /dify/app/page
 * - 列表：  GET    /dify/app/list
 * - 详情：  GET    /dify/app/{id}
 * - 新增：  POST   /dify/app
 * - 编辑：  PUT    /dify/app/{id}
 * - 删除：  DELETE /dify/app  (body: { ids: number[] })
 */
export function fetchDifyAppPage(params: Api.DifyApp.PageQuery) {
  return request<Api.System.PageResult<Api.DifyApp.DifyAppResp>>({
    url: '/dify/app/page',
    method: 'post',
    params
  });
}

/** 应用列表（非分页，后端 GET /dify/app/list） */
export function fetchDifyAppList(params?: { name?: string }) {
  return request<Api.DifyApp.DifyAppResp[]>({
    url: '/dify/app/list',
    params
  });
}

/** 应用详情（后端 GET /dify/app/{id}） */
export function fetchDifyAppDetail(id: string | number) {
  return request<Api.DifyApp.DifyAppResp>({
    url: `/dify/app/${id}`
  });
}

/** 全局 Dify 根地址（后端 GET /dify/app/base-url，返回 { baseUrl }），用于拼接控制台编排页 URL */
export function fetchDifyAppBaseUrl() {
  return request<{ baseUrl?: string }>({
    url: '/dify/app/base-url',
    method: 'get'
  });
}

/** 新增应用（后端 POST /dify/app） */
export function fetchDifyAppCreate(data: Api.DifyApp.DifyAppReq) {
  return request<Api.System.IdResp>({
    url: '/dify/app',
    method: 'post',
    data
  });
}

/** 在 Dify 控制台真正创建应用并绑定回本地（后端 POST /dify/app/create-console） */
export function fetchDifyAppCreateFromConsole(data: { name: string; type: Api.DifyApp.AppType; description?: string }) {
  return request<Api.DifyApp.DifyAppCreateResp>({
    url: '/dify/app/create-console',
    method: 'post',
    data
  });
}

/** 编辑应用（后端 PUT /dify/app/{id}） */
export function fetchDifyAppUpdate(id: string | number, data: Api.DifyApp.DifyAppReq) {
  return request<void>({
    url: `/dify/app/${id}`,
    method: 'put',
    data
  });
}

/** 删除应用（批量，后端 DELETE /dify/app，body: { ids }） */
export function fetchDifyAppDelete(ids: Array<string | number>) {
  return request<void>({
    url: '/dify/app',
    method: 'delete',
    data: { ids }
  });
}

/** 智能体已绑定的知识库数据集（Dify /apps/{id}/datasets） */
export function fetchDifyAppDatasets(appId: string | number) {
  return request<Array<Record<string, unknown>>>({
    url: `/api/dify/apps/${appId}/datasets`,
    method: 'get'
  });
}

/** 绑定知识库数据集到智能体（Dify /apps/{id}/datasets，body: { dataset_ids, top_k, score_threshold, retrieval_model }，整体覆盖） */
export function bindDifyAppDatasets(
  appId: string | number,
  datasetIds: string[],
  retrieval?: { topK?: number; scoreThreshold?: number; retrievalModel?: string }
) {
  return request<unknown>({
    url: `/api/dify/apps/${appId}/datasets`,
    method: 'post',
    data: {
      dataset_ids: datasetIds,
      ...(retrieval?.topK != null ? { top_k: retrieval.topK } : {}),
      ...(retrieval?.scoreThreshold != null ? { score_threshold: retrieval.scoreThreshold } : {}),
      ...(retrieval?.retrievalModel ? { retrieval_model: retrieval.retrievalModel } : {})
    }
  });
}

/** 解绑单个知识库数据集（Dify /apps/{id}/datasets/{datasetId}） */
export function unbindDifyAppDataset(appId: string | number, datasetId: string) {
  return request<unknown>({
    url: `/api/dify/apps/${appId}/datasets/${datasetId}`,
    method: 'delete'
  });
}

/** 智能体已启用的工具（Dify /apps/{id}/tools） */
export function fetchDifyAppTools(appId: string | number) {
  return request<Array<Record<string, unknown>>>({
    url: `/api/dify/apps/${appId}/tools`,
    method: 'get'
  });
}

/** 可用工具列表（复用公共 API model-config agent_mode.tools; 不传 appId 返回空） */
export function fetchDifyTools(appId?: string | number) {
  return request<Array<Record<string, unknown>>>({
    url: '/api/dify/tools',
    method: 'get',
    ...(appId != null ? { params: { appId } } : {})
  });
}

/** MCP 服务列表（Dify /mcp） */
export function fetchDifyMcpServers() {
  return request<Array<Record<string, unknown>>>({
    url: '/api/dify/mcp',
    method: 'get'
  });
}

/** 新增 MCP 服务（body: { name, server_url, headers? }） */
export function createDifyMcpServer(body: { name: string; server_url: string; headers?: Record<string, string> }) {
  return request<Record<string, unknown>>({
    url: '/api/dify/mcp',
    method: 'post',
    data: body
  });
}

/** 删除 MCP 服务 */
export function deleteDifyMcpServer(providerId: string) {
  return request<Record<string, unknown>>({
    url: `/api/dify/mcp/${providerId}`,
    method: 'delete'
  });
}

/** 绑定工具到智能体（Dify /apps/{id}/tools，body: { tool_ids }，整体覆盖） */
export function bindDifyAppTools(appId: string | number, toolIds: string[]) {
  return request<unknown>({
    url: `/api/dify/apps/${appId}/tools`,
    method: 'post',
    data: { tool_ids: toolIds }
  });
}

/** 解绑单个工具（Dify /apps/{id}/tools/{toolId}） */
export function unbindDifyAppTool(appId: string | number, toolId: string) {
  return request<unknown>({
    url: `/api/dify/apps/${appId}/tools/${toolId}`,
    method: 'delete'
  });
}

/** 提示词编排配置（Dify /apps/{id}/model-config，含 prompt/orchestration） */
export function fetchDifyAppOrchestration(appId: string | number) {
  return request<Api.Dify.OrchestrationConfig>({
    url: `/api/dify/apps/${appId}/model-config`,
    method: 'get'
  });
}

/** 更新提示词编排配置（Dify /apps/{id}/model-config） */
export function updateDifyAppOrchestration(appId: string | number, body: Api.Dify.OrchestrationPayload) {
  return request<Api.Dify.OrchestrationConfig>({
    url: `/api/dify/apps/${appId}/model-config`,
    method: 'post',
    data: body
  });
}

/** 应用 API 访问密钥列表（Dify /apps/{id}/api-keys，控制台） */
export function fetchDifyAppApiKeys(appId: string | number) {
  return request<Api.Dify.DifyAppApiKey[]>({
    url: `/api/dify/apps/${appId}/api-keys`,
    method: 'get'
  });
}

/** 创建应用 API 访问密钥（Dify /apps/{id}/api-keys，控制台） */
export function createDifyAppApiKey(appId: string | number) {
  return request<Api.Dify.DifyAppApiKey>({
    url: `/api/dify/apps/${appId}/api-keys`,
    method: 'post'
  });
}
