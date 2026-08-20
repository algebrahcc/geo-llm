/**
 * 递归解包后端 mica 响应信封
 *
 * 真实后端返回嵌套信封 { code, data: { code, data: 业务 } }。请求层 transform
 * 此前只解一层，视图被迫各自补第二层（catalog/extractData、knowledge/extractPayload）。
 * 此处统一递归解到最内层业务数据，让请求实例的 data 直接可用。
 *
 * @param payload 响应体（或任何对象）
 */
export function unwrapEnvelope<T = unknown>(payload: unknown): T | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const data = (payload as { data?: unknown }).data;
  if (data == null) {
    return null;
  }
  // mica 嵌套信封：data 仍是 { code, msg, data }，继续下钻
  if (typeof data === 'object' && data !== null && 'data' in (data as object) && 'code' in (data as object)) {
    return unwrapEnvelope<T>(data);
  }
  return data as T;
}
