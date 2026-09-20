import json5 from 'json5';

/**
 * Create service config by current env
 *
 * 部署后可直接修改 public/config.json，无需重新构建。
 * 运行时配置优先于构建时 env 变量。
 *
 * @param env The current env
 */
export function createServiceConfig(env: Env.ImportMeta) {
  const { VITE_SERVICE_BASE_URL, VITE_OTHER_SERVICE_BASE_URL } = env;

  // 优先读取运行时配置，不可用则回退 env
  // eslint-disable-next-line no-underscore-dangle
  const runtime = typeof window !== 'undefined' ? window.__APP_CONFIG__ : undefined;
  const serviceBaseUrl = runtime?.VITE_SERVICE_BASE_URL || VITE_SERVICE_BASE_URL;

  let other = {} as Record<App.Service.OtherBaseURLKey, string>;
  // 运行时配置的 OTHER_SERVICE 已是对象，env 中则是 json5 字符串
  if (runtime?.VITE_OTHER_SERVICE_BASE_URL) {
    other = runtime.VITE_OTHER_SERVICE_BASE_URL as Record<App.Service.OtherBaseURLKey, string>;
  } else {
    try {
      other = json5.parse(VITE_OTHER_SERVICE_BASE_URL);
    } catch {
      // eslint-disable-next-line no-console
      console.error('VITE_OTHER_SERVICE_BASE_URL is not a valid json5 string');
    }
  }

  const httpConfig: App.Service.SimpleServiceConfig = {
    baseURL: serviceBaseUrl,
    other
  };

  const otherHttpKeys = Object.keys(httpConfig.other) as App.Service.OtherBaseURLKey[];

  const otherConfig: App.Service.OtherServiceConfigItem[] = otherHttpKeys.map(key => {
    return {
      key,
      baseURL: httpConfig.other[key],
      proxyPattern: createProxyPattern(key)
    };
  });

  const config: App.Service.ServiceConfig = {
    baseURL: httpConfig.baseURL,
    proxyPattern: createProxyPattern(),
    other: otherConfig
  };

  return config;
}

/**
 * get backend service base url
 *
 * @param env - the current env
 * @param isProxy - if use proxy
 */
export function getServiceBaseURL(env: Env.ImportMeta, isProxy: boolean) {
  const { baseURL, other } = createServiceConfig(env);

  const otherBaseURL = {} as Record<App.Service.OtherBaseURLKey, string>;

  other.forEach(item => {
    otherBaseURL[item.key] = isProxy ? item.proxyPattern : item.baseURL;
  });

  return {
    baseURL: isProxy ? createProxyPattern() : baseURL,
    otherBaseURL
  };
}

/**
 * Get proxy pattern of backend service base url
 *
 * @param key If not set, will use the default key
 */
function createProxyPattern(key?: App.Service.OtherBaseURLKey) {
  if (!key) {
    return '/proxy-default';
  }

  return `/proxy-${key}`;
}

/**
 * 真实后端 Base URL（登录、系统管理、AI 流式、瓦片、导出等都用它）
 *
 * 读取顺序：运行时配置（dist/config.json → window.__APP_CONFIG__）> 构建时 .env > 内置默认值。
 * 换机器部署时只改 config.json 即可，无需重新打包。
 *
 * 注意：所有需要后端地址的地方都应从这里取。若某个模块只读 import.meta.env，
 * 它会被固定到打包机器上的地址（例如 http://localhost:8000），在新机器上必然失败。
 */
export function getRealServiceBaseURL() {
  // eslint-disable-next-line no-underscore-dangle
  const runtime = typeof window !== 'undefined' ? window.__APP_CONFIG__ : undefined;
  return runtime?.VITE_SERVICE_REAL_BASE_URL || import.meta.env.VITE_SERVICE_REAL_BASE_URL || 'http://localhost:8000';
}
