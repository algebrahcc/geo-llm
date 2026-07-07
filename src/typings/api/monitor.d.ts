declare namespace Api {
  namespace Monitor {
    /** 通用分页结果 */
    interface PageResult<T> {
      list: T[];
      total: number;
    }

    /** 日志状态（后端枚举：SUCCESS=成功 / FAIL=失败，可能为数字或对象） */
    type LogStatus = { code: number; description: string; msg?: string } | number | string;

    /** 日志列表项 */
    interface LogItem {
      id: number;
      description: string;
      module: string;
      timeTaken: number;
      ip: string;
      address: string;
      browser: string;
      os: string;
      status: LogStatus;
      errorMsg: string;
      createUserString: string;
      createTime: string;
    }

    /** 日志详情 */
    interface LogDetail extends LogItem {
      traceId: string;
      requestUrl: string;
      requestMethod: string;
      requestHeaders: string;
      requestBody: string;
      statusCode: number;
      responseHeaders: string;
      responseBody: string;
    }

    /** 日志查询参数 */
    interface LogQuery {
      page: number;
      size: number;
      description?: string;
      module?: string;
      ip?: string;
      createUserString?: string;
      status?: number;
    }

    /** 在线用户列表项 */
    interface OnlineUserItem {
      id: number;
      token: string;
      username: string;
      nickname: string;
      clientType: string;
      clientId: string;
      ip: string;
      address: string;
      browser: string;
      os: string;
      loginTime: string;
      lastActiveTime: string;
    }

    /** 在线用户查询参数 */
    interface OnlineUserQuery {
      page: number;
      size: number;
      nickname?: string;
      clientId?: string;
    }
  }
}
