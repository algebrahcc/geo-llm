declare namespace Api {
  /**
   * namespace DifyAgent
   *
   * Dify 1.16 原生 Agent（mode=agent）管理接口
   * 后端统一返回 R 信封，前端取 data 字段（见 src/service/request/real.ts 的 transform）。
   * 所有接口以本地应用 ID（appId）为入参，后端自动解析 agent_id（bound_agent_id）。
   */
  namespace DifyAgent {
    /** 原生 Agent 详情（GET /api/dify/agent/{appId}） */
    interface Detail {
      id?: string;
      name?: string;
      description?: string;
      role?: string;
      icon_type?: 'emoji' | 'icon' | 'file';
      icon?: string;
      icon_background?: string;
      icon_url?: string;
      use_icon_as_answer_icon?: boolean;
      max_active_requests?: number;
      version?: string;
      version_id?: string;
      model?: Record<string, unknown>;
      // site
      site?: Record<string, unknown>;
      [key: string]: unknown;
    }

    /** 更新原生 Agent 基本信息请求体 */
    interface UpdateReq {
      name?: string;
      description?: string;
      role?: string;
      icon_type?: 'emoji' | 'icon' | 'file';
      icon?: string;
      icon_background?: string;
      use_icon_as_answer_icon?: boolean;
      max_active_requests?: number;
      [key: string]: unknown;
    }

    /** 复制原生 Agent 请求体 */
    interface CopyReq {
      name?: string;
      description?: string;
      icon_type?: 'emoji' | 'icon' | 'file';
      icon?: string;
      icon_background?: string;
      [key: string]: unknown;
    }

    /** 原生 Agent API 访问状态（GET /api/dify/agent/{appId}/api-access） */
    interface ApiAccess {
      enable_api?: boolean;
      [key: string]: unknown;
    }

    /** 开启/关闭 API 访问请求体 */
    interface EnableApiReq {
      enable_api: boolean;
    }

    /** 原生 Agent API Key（GET/POST /api/dify/agent/{appId}/api-keys） */
    interface ApiKey {
      id?: string;
      type?: string;
      token?: string;
      created_at?: number;
      last_used_at?: number;
      last_used_ip?: string;
      [key: string]: unknown;
    }

    /** 原生 Agent 版本（GET /api/dify/agent/{appId}/versions） */
    interface Version {
      id?: string;
      version?: number;
      version_note?: string;
      config_snapshot?: Record<string, unknown>;
      status?: string;
      created_at?: number;
      created_by?: string;
      [key: string]: unknown;
    }

    /** 原生 Agent 日志列表项（GET /api/dify/agent/{appId}/logs） */
    interface Log {
      id?: string;
      conversation_id?: string;
      created_at?: number;
      created_by?: string;
      source?: string;
      status?: string;
      error?: string | null;
      active_config_snapshot?: {
        version?: number;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    }

    /** 原生 Agent 会话消息（GET /api/dify/agent/{appId}/logs/{conversationId}/messages） */
    interface LogMessage {
      id?: string;
      role?: string;
      content?: string;
      created_at?: number;
      tokens?: number;
      latency?: number;
      [key: string]: unknown;
    }

    /** 原生 Agent 日志源（GET /api/dify/agent/{appId}/log-sources） */
    interface LogSource {
      source?: string;
      [key: string]: unknown;
    }

    /** 原生 Agent 统计摘要（GET /api/dify/agent/{appId}/statistics/summary） */
    interface StatisticSummary {
      source?: string;
      avg_response_time?: number;
      total_messages?: number;
      total_tokens?: number;
      active_agent_count?: number;
      [key: string]: unknown;
    }
  }
}
