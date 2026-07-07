import { request } from '../request/real';
import { localStg } from '@/utils/storage';

// ==================== 日志管理 ====================

/** 日志分页列表 */
export function fetchLogPage(params: Api.Monitor.LogQuery) {
  return request<Api.Monitor.PageResult<Api.Monitor.LogItem>>({
    url: '/system/log',
    params
  });
}

/** 日志详情 */
export function fetchLogDetail(id: number) {
  return request<Api.Monitor.LogDetail>({
    url: `/system/log/${id}`
  });
}

// ==================== 在线用户 ====================

/** 在线用户分页列表 */
export function fetchOnlineUserPage(params: Api.Monitor.OnlineUserQuery) {
  return request<Api.Monitor.PageResult<Api.Monitor.OnlineUserItem>>({
    url: '/monitor/online',
    params
  });
}

/** 强退在线用户 */
export function fetchKickoutOnlineUser(token: string) {
  return request<void>({
    url: `/monitor/online/${token}`,
    method: 'delete'
  });
}

// ==================== 导出（二进制下载，单独用 fetch 携带 token） ====================

function getRealBaseURL(): string {
  // eslint-disable-next-line no-underscore-dangle
  const runtime = typeof window !== 'undefined' ? (window as any).__APP_CONFIG__ : undefined;
  return runtime?.VITE_SERVICE_REAL_BASE_URL || import.meta.env.VITE_SERVICE_REAL_BASE_URL || 'http://localhost:8000';
}

function buildLogParams(query?: Api.Monitor.LogQuery): string {
  const params = new URLSearchParams();
  if (query?.description) params.set('description', query.description);
  if (query?.module) params.set('module', query.module);
  if (query?.ip) params.set('ip', query.ip);
  if (query?.createUserString) params.set('createUserString', query.createUserString);
  if (query?.status !== undefined) params.set('status', String(query.status));
  return params.toString();
}

async function downloadBlob(url: string, filename: string) {
  const token = localStg.get('token');
  try {
    const resp = await fetch(`${getRealBaseURL()}${url}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) {
      window.$message?.error('导出失败');
      return;
    }
    const blob = await resp.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.$message?.error('导出失败');
  }
}

/** 导出登录日志 */
export async function exportLoginLog(query?: Api.Monitor.LogQuery) {
  await downloadBlob(`/system/log/export/login?${buildLogParams(query)}`, '登录日志.xlsx');
}

/** 导出操作日志 */
export async function exportOperationLog(query?: Api.Monitor.LogQuery) {
  await downloadBlob(`/system/log/export/operation?${buildLogParams(query)}`, '操作日志.xlsx');
}
