import { request } from '../request/real';

/** 分页查询数据目录（后端 GET /service/catalog/page） */
export function fetchCatalogPage(params: Api.Catalog.CatalogQuery) {
  return request<Api.Catalog.PageResult<Api.Catalog.CatalogItem>>({
    url: '/service/catalog/page',
    method: 'get',
    params
  });
}

/** 生成上传会话（后端 POST /service/catalog/presign；返回 PUT/MPU/LOCAL） */
export function fetchCatalogPresign(data: Api.Catalog.PresignReq) {
  return request<Api.Catalog.UploadSession>({
    url: '/service/catalog/presign',
    method: 'post',
    data
  });
}

/** 生成分片直传 URL（后端 POST /service/catalog/upload-part-presign） */
export function fetchUploadPartPresign(objectKey: string, uploadId: string, partNumber: number) {
  return request<Api.Catalog.PartPresign>({
    url: '/service/catalog/upload-part-presign',
    method: 'post',
    params: { objectKey, uploadId, partNumber }
  });
}

/** 合并分片（后端 POST /service/catalog/complete-upload） */
export function completeCatalogUpload(objectKey: string, uploadId: string, parts: Api.Catalog.PartInfo[]) {
  return request<Api.Catalog.ObjectInfo>({
    url: '/service/catalog/complete-upload',
    method: 'post',
    params: { objectKey, uploadId },
    data: parts
  });
}

/**
 * 上传完成登记（后端 POST /service/catalog/register，multipart）
 *
 * @param metadata 元数据
 * @param file     可选文件（local 中转模式；minio 直传模式无需传）
 */
export function registerCatalog(metadata: Api.Catalog.RegisterReq, file?: File) {
  const fd = new FormData();
  // metadata 以字符串 part 传入，后端用 @RequestParam String 读取（不依赖 part Content-Type）
  fd.append('metadata', JSON.stringify(metadata));
  if (file) fd.append('file', file);
  return request<Api.Catalog.IdResp>({
    url: '/service/catalog/register',
    method: 'post',
    data: fd,
    headers: { 'Content-Type': 'multipart/form-data' }
  });
}

/** 发布/下线（后端 POST /service/catalog/{id}/publish） */
export function publishCatalog(id: string, status: number) {
  return request({
    url: `/service/catalog/${id}/publish`,
    method: 'post',
    params: { status }
  });
}

/** 删除数据（后端 POST /service/catalog/{id}/delete） */
export function deleteCatalog(id: string) {
  return request({
    url: `/service/catalog/${id}/delete`,
    method: 'post'
  });
}

/** 获取下载 URL（后端 GET /service/catalog/{id}/download-url） */
export function fetchCatalogDownloadUrl(id: string) {
  return request<string>({
    url: `/service/catalog/${id}/download-url`,
    method: 'get'
  });
}

/** 获取分类树（后端 GET /service/catalog/category/tree） */
export function fetchCategoryTree() {
  return request<Api.Catalog.CategoryNode[]>({
    url: '/service/catalog/category/tree',
    method: 'get'
  });
}

/** 新增分类节点（后端 POST /service/catalog/category） */
export function createCategory(data: Api.Catalog.CategoryForm) {
  return request<Api.Catalog.IdResp>({
    url: '/service/catalog/category',
    method: 'post',
    data
  });
}

/** 修改分类节点（后端 PUT /service/catalog/category/{id}） */
export function updateCategory(id: string, data: Api.Catalog.CategoryForm) {
  return request({
    url: `/service/catalog/category/${id}`,
    method: 'put',
    data
  });
}

/** 删除分类节点（后端 DELETE /service/catalog/category/{id}） */
export function deleteCategory(id: string) {
  return request({
    url: `/service/catalog/category/${id}`,
    method: 'delete'
  });
}
