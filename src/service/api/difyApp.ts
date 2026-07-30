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
export function fetchDifyAppDetail(id: number) {
  return request<Api.DifyApp.DifyAppResp>({
    url: `/dify/app/${id}`
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

/** 编辑应用（后端 PUT /dify/app/{id}） */
export function fetchDifyAppUpdate(id: number, data: Api.DifyApp.DifyAppReq) {
  return request<void>({
    url: `/dify/app/${id}`,
    method: 'put',
    data
  });
}

/** 删除应用（批量，后端 DELETE /dify/app，body: { ids }） */
export function fetchDifyAppDelete(ids: number[]) {
  return request<void>({
    url: '/dify/app',
    method: 'delete',
    data: { ids }
  });
}

/** 智能体已绑定的知识库数据集（Dify /apps/{id}/datasets） */
export function fetchDifyAppDatasets(appId: number) {
  return request<Array<Record<string, unknown>>>({
    url: `/api/dify/apps/${appId}/datasets`,
    method: 'get'
  });
}

/** 绑定知识库数据集到智能体（Dify /apps/{id}/datasets，body: { dataset_ids }，整体覆盖） */
export function bindDifyAppDatasets(appId: number, datasetIds: string[]) {
  return request<unknown>({
    url: `/api/dify/apps/${appId}/datasets`,
    method: 'post',
    data: { dataset_ids: datasetIds }
  });
}

/** 解绑单个知识库数据集（Dify /apps/{id}/datasets/{datasetId}） */
export function unbindDifyAppDataset(appId: number, datasetId: string) {
  return request<unknown>({
    url: `/api/dify/apps/${appId}/datasets/${datasetId}`,
    method: 'delete'
  });
}

/** 智能体已启用的工具（Dify /apps/{id}/tools） */
export function fetchDifyAppTools(appId: number) {
  return request<Array<Record<string, unknown>>>({
    url: `/api/dify/apps/${appId}/tools`,
    method: 'get'
  });
}

/** 可用工具列表（复用公共 API model-config agent_mode.tools; 不传 appId 返回空） */
export function fetchDifyTools(appId?: number) {
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

/** 绑定工具到智能体（Dify /apps/{id}/tools，body: { tool_ids }，整体覆盖） */
export function bindDifyAppTools(appId: number, toolIds: string[]) {
  return request<unknown>({
    url: `/api/dify/apps/${appId}/tools`,
    method: 'post',
    data: { tool_ids: toolIds }
  });
}

/** 解绑单个工具（Dify /apps/{id}/tools/{toolId}） */
export function unbindDifyAppTool(appId: number, toolId: string) {
  return request<unknown>({
    url: `/api/dify/apps/${appId}/tools/${toolId}`,
    method: 'delete'
  });
}

/** 提示词编排配置（Dify /apps/{id}/model-config，含 prompt/orchestration） */
export function fetchDifyAppOrchestration(appId: number) {
  return request<Api.Dify.OrchestrationConfig>({
    url: `/api/dify/apps/${appId}/model-config`,
    method: 'get'
  });
}

/** 更新提示词编排配置（Dify /apps/{id}/model-config） */
export function updateDifyAppOrchestration(appId: number, body: Api.Dify.OrchestrationPayload) {
  return request<Api.Dify.OrchestrationConfig>({
    url: `/api/dify/apps/${appId}/model-config`,
    method: 'post',
    data: body
  });
}
