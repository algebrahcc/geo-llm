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
