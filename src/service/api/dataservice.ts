import { request } from '../request/real';

/** 分页查询数据服务列表 */
export function fetchDataServicePage(params?: Api.DataService.DataServiceQuery) {
  return request<Api.DataService.PageResult<Api.DataService.DataServiceItem>>({
    url: '/system/dataservice',
    params
  });
}

/** 查询启用中的服务列表（status=1，按 sort 排序，供 Cesium 拉取） */
export function fetchEnabledDataServices() {
  return request<Api.DataService.DataServiceItem[]>({
    url: '/system/dataservice/list'
  });
}

/** 查询数据服务详情 */
export function fetchDataServiceDetail(id: string | number) {
  return request<Api.DataService.DataServiceItem>({
    url: `/system/dataservice/${id}`
  });
}

/** 新建数据服务 */
export function fetchDataServiceCreate(data: Api.DataService.DataServiceForm) {
  return request<Api.Vector.IdResp>({
    url: '/system/dataservice',
    method: 'post',
    data
  });
}

/** 编辑数据服务 */
export function fetchDataServiceUpdate(id: string | number, data: Api.DataService.DataServiceForm) {
  return request<void>({
    url: `/system/dataservice/${id}`,
    method: 'put',
    data
  });
}

/** 批量删除数据服务 */
export function fetchDataServiceDelete(ids: (string | number)[]) {
  return request<void>({
    url: '/system/dataservice',
    method: 'delete',
    data: { ids }
  });
}

/** 测试服务连接，返回 { reachable, httpStatus, latencyMs } */
export function fetchDataServiceConnect(id: string | number) {
  return request<Api.DataService.DataServiceConnectResult>({
    url: `/system/dataservice/connect/${id}`
  });
}
