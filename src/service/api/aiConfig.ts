import { request } from '../request/real';

export function fetchAiConfigOverview() {
  return request<Api.AiConfig.Overview>({
    url: '/api/ai-config/overview',
    method: 'get'
  });
}

export function testAiAppConfig(data: Api.AiConfig.AppTestReq) {
  return request<Api.AiConfig.ConnectivityResult>({
    url: '/api/ai-config/app/test',
    method: 'post',
    data
  });
}

export function testAiDatasetConfig(data: Api.AiConfig.DatasetTestReq) {
  return request<Api.AiConfig.ConnectivityResult>({
    url: '/api/ai-config/dataset/test',
    method: 'post',
    data
  });
}

export function importAiAppFromDify(data: Api.AiConfig.AppImportReq) {
  return request<Api.AiConfig.AppImportResult>({
    url: '/api/ai-config/apps/import',
    method: 'post',
    data
  });
}

export function fetchRemoteAiApps() {
  return request<Api.AiConfig.RemoteApp[]>({
    url: '/api/ai-config/apps/remote',
    method: 'get'
  });
}

export function syncRemoteAiApps() {
  return request<Api.AiConfig.AppSyncResult>({
    url: '/api/ai-config/apps/sync',
    method: 'post'
  });
}
