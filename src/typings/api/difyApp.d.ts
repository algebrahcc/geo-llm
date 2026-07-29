declare namespace Api {
  /**
   * namespace DifyApp
   *
   * Dify 应用（智能体 / 聊天助手 / 工作流）管理
   * 后端 /dify/app（ContiNew 标准 CRUD，统一返回 R 信封，前端取 data 字段）
   */
  namespace DifyApp {
    /** 应用类型：1 聊天助手 / 2 智能体 / 3 工作流 */
    type AppType = 1 | 2 | 3;

    /** 应用状态：1 启用 / 2 禁用 */
    type AppStatus = 1 | 2;

    /** 应用列表项 / 详情（对应后端 DifyAppResp） */
    interface DifyAppResp {
      id: number;
      difyAppId?: string;
      name: string;
      type: AppType;
      apiKey?: string;
      hasApiKey?: boolean;
      useGlobalApiKey?: boolean;
      baseUrl?: string;
      useGlobalBaseUrl?: boolean;
      description?: string;
      sort?: number;
      status: AppStatus;
      createTime?: string;
      updateTime?: string;
    }

    /** 新增 / 编辑应用请求（对应后端 DifyAppReq） */
    interface DifyAppReq {
      difyAppId?: string;
      name: string;
      type: AppType;
      apiKey?: string;
      clearApiKey?: boolean;
      baseUrl?: string;
      clearBaseUrl?: boolean;
      description?: string;
      sort?: number;
      status?: AppStatus;
    }

    /** 分页查询参数 */
    interface PageQuery {
      page?: number;
      size?: number;
      name?: string;
    }
  }
}
