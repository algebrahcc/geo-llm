declare namespace Api {
  /**
   * namespace Auth
   *
   * backend api module: "auth"
   */
  namespace Auth {
    interface LoginReq {
      clientId: string;
      authType: 'ACCOUNT';
      username: string;
      password: string;
      captcha?: string;
      uuid?: string;
    }

    interface LoginToken {
      token: string;
      tenantId?: number;
    }

    interface CaptchaResp {
      uuid: string;
      img: string;
      expireTime?: number;
      isEnabled: boolean;
    }

    interface UserInfo {
      userId: string;
      userName: string;
      nickname: string;
      roles: string[];
      buttons: string[];
    }
  }
}
