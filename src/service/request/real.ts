import { BACKEND_ERROR_CODE, createFlatRequest, type AxiosResponse } from '@sa/axios';
import { useAuthStore } from '@/store/modules/auth';
import { getAuthorization, showErrorMsg } from './shared';
import type { RequestInstanceState } from './type';

/**
 * 真实后端请求实例
 *
 * - baseURL 读取顺序：config.json 运行时配置 > .env VITE_SERVICE_REAL_BASE_URL > 默认值 http://localhost:8000
 * - 不附加 ApifoxToken header（与 Mock 实例的区别）
 * - 成功码为 0（ContiNew 框架约定）
 * - Token 过期直接登出，不走 refreshToken 逻辑（Sa-Token 自动处理）
 */
// eslint-disable-next-line no-underscore-dangle
const runtimeConfig = typeof window !== 'undefined' ? window.__APP_CONFIG__ : undefined;
const realBaseURL = runtimeConfig?.VITE_SERVICE_REAL_BASE_URL || import.meta.env.VITE_SERVICE_REAL_BASE_URL || 'http://localhost:8000';

export const request = createFlatRequest(
  {
    baseURL: realBaseURL
  },
  {
    defaultState: {
      errMsgStack: [],
      refreshTokenPromise: null
    } as RequestInstanceState,
    transform(response: AxiosResponse<App.Service.Response<any>>) {
      const responseData = response.data;
      if (!responseData || typeof responseData !== 'object') {
        return null;
      }
      return responseData.data ?? null;
    },
    async onRequest(config) {
      const Authorization = getAuthorization();
      Object.assign(config.headers, { Authorization });

      return config;
    },
    isBackendSuccess(response) {
      // ContiNew 框架成功码为 0
      return String(response.data.code) === '0';
    },
    async onBackendFail(response) {
      const authStore = useAuthStore();
      const responseCode = String(response.data.code || '');

      // 登录过期 / 未授权：直接登出
      if (responseCode === '401') {
        authStore.resetStore();
        return null;
      }

      // 其他后端错误不特殊处理，交给 onError 统一显示
      return null;
    },
    onError(error) {
      let message = error.message;
      let backendErrorCode = '';

      // 有响应体时优先显示后端返回的错误消息
      if (error.code === BACKEND_ERROR_CODE) {
        message = error.response?.data?.msg || message;
        backendErrorCode = String(error.response?.data?.code || '');
      }

      // 401 已在 onBackendFail 中处理，这里不再重复
      if (backendErrorCode === '401') {
        return;
      }

      showErrorMsg(request.state, message);
    }
  }
);
