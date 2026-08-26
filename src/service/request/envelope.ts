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

/**
 * 从扁平请求结果（createFlatRequest 的 { data, error, response }）稳健提取最内层业务数据。
 *
 * 请求层 transform 已用 unwrapEnvelope 递归解包 mica 信封，正常情况下 result.data 即业务数据。
 * 此函数额外兼容两类历史残留形态：
 *  1) 旧实现只解一层时的折叠信封（仅含 data 无 code，如 result.data.data）；
 *  2) 请求失败时 data 为 null，退而读取原始响应体 result.response.data；
 *  3) 数组 / GeoJSON（FeatureCollection）等平铺业务数据直接返回，避免被误剥。
 */
export function unwrapResponseData<T = unknown>(payload: unknown): T | null {
  if (!payload || typeof payload !== 'object') return null;
  // 平铺业务数据直接返回
  if (Array.isArray(payload)) return payload as T;
  if ((payload as { type?: string }).type === 'FeatureCollection') return payload as T;

  const record = payload as Record<string, unknown>;
  if (record.data !== undefined && record.data !== null) {
    return unwrapResponseData(record.data);
  }
  const response = record.response as Record<string, unknown> | undefined;
  if (response?.data !== undefined && response.data !== null) {
    return unwrapResponseData(response.data);
  }
  return payload as T;
}
