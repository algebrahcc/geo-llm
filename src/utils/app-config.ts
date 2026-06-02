import type { AppRuntimeConfig } from '@/typings/global';

/**
 * 获取运行时配置项
 *
 * 优先读取 window.__APP_CONFIG__（由 index.html 从 /config.json 注入），
 * 如果不可用则回退到构建时的 import.meta.env。
 */
export function getAppConfig<K extends keyof AppRuntimeConfig>(key: K): AppRuntimeConfig[K] {
  const runtimeValue = window.__APP_CONFIG__?.[key];
  if (runtimeValue !== undefined && runtimeValue !== null && runtimeValue !== '') {
    return runtimeValue;
  }
  // 回退到构建时环境变量
  return (import.meta.env as Record<string, string>)[key] || '';
}
