/**
 * 通用异步工具函数
 */

/** 延迟指定毫秒数 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}
