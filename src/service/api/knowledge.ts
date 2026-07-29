import { request } from '../request/real';

/**
 * 知识库文档列表（后端 /api/kb/documents，GET，返回 List<KbDocumentResp>）
 *
 * @param params docType / status 均为可选查询条件
 */
export function fetchKbDocuments(params?: { docType?: string; status?: string; datasetId?: string }) {
  return request<Api.Knowledge.Document[]>({
    url: '/api/kb/documents',
    method: 'get',
    params
  });
}

/**
 * 知识库文档详情（后端 /api/kb/documents/{id}）
 */
export function fetchKbDocument(id: string | number, datasetId?: string) {
  return request<Api.Knowledge.Document>({
    url: `/api/kb/documents/${id}`,
    method: 'get',
    params: datasetId ? { datasetId } : undefined
  });
}

/**
 * 知识库文档详情扩展（后端 /api/kb/documents/{id}/detail）
 */
export function fetchKbDocumentDetail(id: string | number, datasetId: string) {
  return request<Api.Knowledge.DocumentDetail>({
    url: `/api/kb/documents/${id}/detail`,
    method: 'get',
    params: { datasetId }
  });
}

/**
 * 知识库文档上传（后端 /api/kb/documents，multipart）
 *
 * @param datasetId Dify 数据集 ID（必填，决定文档归属哪个知识库）
 * @param file      待上传文件
 * @param name      文档名称（可选，缺省用文件名）
 * @param docType   文档类型（默认 file）
 * @param source    来源说明（可选）
 */
export function uploadKbDocument(
  datasetId: string,
  file: File,
  name?: string,
  docType = 'file',
  source?: string,
  indexingTechnique?: string,
  processMode?: string
) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('datasetId', datasetId);
  if (name) formData.append('name', name);
  formData.append('docType', docType);
  if (source) formData.append('source', source);
  if (indexingTechnique) formData.append('indexingTechnique', indexingTechnique);
  if (processMode) formData.append('processMode', processMode);
  return request<Api.Knowledge.UploadResp>({
    url: '/api/kb/documents',
    method: 'post',
    data: formData
  });
}

/**
 * 删除知识库文档（后端 /api/kb/documents/{id}）
 */
export function deleteKbDocument(id: string | number, datasetId?: string) {
  return request({
    url: `/api/kb/documents/${id}`,
    method: 'delete',
    params: datasetId ? { datasetId } : undefined
  });
}

/**
 * 同步文档索引状态（后端 /api/kb/documents/{id}/sync）
 */
export function syncKbDocument(id: string | number) {
  return request({
    url: `/api/kb/documents/${id}/sync`,
    method: 'post'
  });
}

/**
 * 知识库检索（纯 Dify /retrieve 聚合，后端 /api/kb/search）
 */
export function searchKb(data: Api.Knowledge.SearchReq) {
  return request<Api.Knowledge.SearchResp>({
    url: '/api/kb/search',
    method: 'post',
    data
  });
}

/**
 * Dify 数据集列表（后端 GET /api/kb/documents/datasets，Dify 原生 JSON 包在 data 中）
 * 供新增文档时选择目标知识库
 */
export function fetchKbDatasets() {
  return request<Api.Knowledge.Dataset[]>({
    url: '/api/kb/documents/datasets',
    method: 'get'
  });
}

/**
 * Dify 数据集详情（后端 /api/kb/datasets/{id}）
 */
export function fetchKbDataset(id: string) {
  return request<Api.Knowledge.Dataset>({
    url: `/api/kb/datasets/${id}`,
    method: 'get'
  });
}

/**
 * 创建 Dify 数据集（知识库）（后端 /api/kb/datasets）
 */
export function createKbDataset(name: string, description?: string, permission = 'only_me') {
  return request<Api.Knowledge.Dataset>({
    url: '/api/kb/datasets',
    method: 'post',
    params: { name, description, permission }
  });
}

/**
 * 更新 Dify 数据集（知识库）（后端 PATCH /api/kb/datasets/{id}）
 */
export function updateKbDataset(
  id: string,
  data: {
    name?: string;
    description?: string;
    permission?: string;
    retrievalModel?: Record<string, unknown>;
  }
) {
  return request<Api.Knowledge.Dataset>({
    url: `/api/kb/datasets/${id}`,
    method: 'patch',
    data
  });
}

/**
 * 删除 Dify 数据集（知识库）（后端 /api/kb/datasets/{id}）
 */
export function deleteKbDataset(id: string) {
  return request({
    url: `/api/kb/datasets/${id}`,
    method: 'delete'
  });
}

/**
 * 查询文档切片列表（后端 GET /api/kb/datasets/{id}/documents/{documentId}/segments）
 */
export function fetchKbSegments(
  datasetId: string,
  documentId: string,
  params?: { page?: number; limit?: number; keyword?: string; status?: string }
) {
  return request<Api.Knowledge.SegmentList>({
    url: `/api/kb/datasets/${datasetId}/documents/${documentId}/segments`,
    method: 'get',
    params
  });
}

/**
 * 查询知识库元数据字段（后端 GET /api/kb/datasets/{id}/metadata，返回字段定义：id / type / name）
 */
export function fetchKbDatasetMetadata(datasetId: string) {
  return request<Api.Knowledge.DatasetMetadata[]>({
    url: `/api/kb/datasets/${datasetId}/metadata`,
    method: 'get'
  });
}

/**
 * 批量更新文档元数据（后端 POST /api/kb/datasets/{id}/documents/metadata）
 *
 * @param datasetId     知识库 ID
 * @param operationData 操作数组，每项含 document_id / metadata_list / partial_update
 */
export function updateKbDocumentMetadata(
  datasetId: string,
  operationData: Array<{
    document_id: string;
    metadata_list: Api.Knowledge.DocumentMetadata[];
    partial_update: boolean;
  }>
) {
  return request({
    url: `/api/kb/datasets/${datasetId}/documents/metadata`,
    method: 'post',
    data: operationData
  });
}

/**
 * 更新文档切片（后端 PUT /api/kb/datasets/{id}/documents/{documentId}/segments）
 *
 * @param datasetId  知识库 ID
 * @param documentId 文档 ID
 * @param segments   切片数组，每项含 id 与待更新字段（content / keywords / enabled 等）
 */
export function updateKbSegment(
  datasetId: string,
  documentId: string,
  segments: Array<{ id: string; content?: string; keywords?: string[]; enabled?: boolean; answer?: string }>
) {
  return request({
    url: `/api/kb/datasets/${datasetId}/documents/${documentId}/segments`,
    method: 'put',
    data: segments
  });
}
