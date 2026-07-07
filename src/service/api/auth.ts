import { request } from '../request/real';
import { encryptByRsaPublicKey } from '@/utils/crypto';

/**
 * Get captcha image
 */
export function fetchCaptchaImage() {
  return request<Api.Auth.CaptchaResp>({ url: '/captcha/image' });
}

/**
 * Login
 *
 * @param username User name
 * @param password Password
 * @param captcha Captcha text
 * @param uuid Captcha uuid
 */
export function fetchLogin(username: string, password: string, captcha?: string, uuid?: string) {
  const encryptedPassword = encryptByRsaPublicKey(password);
  return request<Api.Auth.LoginToken>({
    url: '/auth/login',
    method: 'post',
    data: {
      clientId: 'ef51c9a3e9046c4f2ea45142c8a8344a',
      authType: 'ACCOUNT',
      username,
      password: encryptedPassword,
      captcha,
      uuid
    }
  });
}

/** Get user info */
export function fetchGetUserInfo() {
  return request<Api.Auth.UserInfo>({ url: '/auth/user/info' });
}

/** Logout */
export function fetchLogout() {
  return request({ url: '/auth/logout', method: 'post' });
}

/**
 * return custom backend error
 *
 * @param code error code
 * @param msg error message
 */
export function fetchCustomBackendError(code: string, msg: string) {
  return request({ url: '/auth/error', params: { code, msg } });
}
