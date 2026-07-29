import { request } from '../request/real';

export function fetchKbDatasetConfigList() {
  return request<Api.KbDatasetConfig.Item[]>({
    url: '/kb/dataset/list'
  });
}

export function fetchKbDatasetConfigDetail(id: number) {
  return request<Api.KbDatasetConfig.Item>({
    url: `/kb/dataset/${id}`
  });
}

export function createKbDatasetConfig(data: Api.KbDatasetConfig.Req) {
  return request<Api.System.IdResp>({
    url: '/kb/dataset',
    method: 'post',
    data
  });
}

export function updateKbDatasetConfig(id: number, data: Api.KbDatasetConfig.Req) {
  return request<void>({
    url: `/kb/dataset/${id}`,
    method: 'put',
    data
  });
}

export function deleteKbDatasetConfig(ids: number[]) {
  return request<void>({
    url: '/kb/dataset',
    method: 'delete',
    data: { ids }
  });
}

export function fetchRemoteKbDatasets(id?: number) {
  return request<Record<string, unknown>>({
    url: '/kb/dataset/dify-list',
    params: id ? { id } : undefined
  });
}
