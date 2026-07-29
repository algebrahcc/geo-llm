declare namespace Api {
  /**
   * namespace Dify
   *
   * Dify 对话 / 会话 / 文件 / Workflow 联调接口
   * 后端统一返回 R 信封，前端取 data 字段（见 src/service/request/real.ts 的 transform）
   */
  namespace Dify {
    type UploadTransferMethod = 'remote_url' | 'local_file';

    interface MessageFile {
      type?: string;
      transfer_method?: UploadTransferMethod;
      url?: string;
      upload_file_id?: string;
      belongs_to?: 'user' | 'assistant';
      [key: string]: unknown;
    }

    /** 发起对话请求体（阻塞 / 流式共用） */
    interface ChatReq {
      /** 应用 ID，不传则用默认应用 */
      appId?: number;
      /** Dify 用户标识（建议用当前登录 userId） */
      userId: string;
      /** 用户输入 */
      query: string;
      /** 会话 ID，不传则新建会话 */
      conversationId?: string;
      /** 动态表单输入 */
      inputs?: Record<string, unknown>;
      /** 消息文件 */
      files?: MessageFile[];
      /** 是否自动生成会话标题 */
      autoGenerateName?: boolean;
    }

    /** 阻塞对话响应（后端 Map<String,String>：{ answer, conversationId, messageId }） */
    interface ChatResp {
      answer: string;
      conversationId: string;
      messageId: string;
    }

    /** 应用元信息（Dify 原生 JSON） */
    type AppInfo = Record<string, unknown>;

    interface ParameterFormOption {
      label: string;
      value: string | number | boolean;
      [key: string]: unknown;
    }

    interface UserInputFieldSchema {
      label?: string;
      variable?: string;
      required?: boolean;
      default?: unknown;
      placeholder?: string;
      options?: Array<ParameterFormOption | string | number | boolean>;
      max_length?: number;
      [key: string]: unknown;
    }

    type UserInputFormItem = Record<string, UserInputFieldSchema>;

    interface FileUploadConfig {
      enabled?: boolean;
      allowed_file_extensions?: string[];
      allowed_file_types?: string[];
      allowed_file_upload_methods?: UploadTransferMethod[];
      number_limits?: number;
      image?: {
        enabled?: boolean;
        number_limits?: number;
        transfer_methods?: UploadTransferMethod[];
      };
      [key: string]: unknown;
    }

    /** 应用参数（Dify /parameters） */
    interface AppParameters {
      opening_statement?: string;
      user_input_form?: UserInputFormItem[];
      suggested_questions?: string[];
      suggested_questions_after_answer?: {
        enabled?: boolean;
        [key: string]: unknown;
      };
      file_upload?: FileUploadConfig;
      speech_to_text?: {
        enabled?: boolean;
        [key: string]: unknown;
      };
      text_to_speech?: {
        enabled?: boolean;
        autoPlay?: string;
        language?: string;
        voice?: string;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    }

    /** 应用 Meta 信息（Dify 原生 JSON） */
    type AppMeta = Record<string, unknown>;

    /** 模型配置中的 model 对象（Dify /model-config） */
    interface ModelConfigModel {
      provider?: string;
      name?: string;
      mode?: string;
      completion_params?: Record<string, unknown>;
      [key: string]: unknown;
    }

    /** 模型配置（Dify /model-config 返回，含编排字段） */
    interface ModelConfig {
      model?: ModelConfigModel;
      prompt_template?: string;
      pre_prompt?: string;
      opening_statement?: string;
      suggested_questions?: string[];
      features?: Record<string, unknown>;
      dataset_configs?: Record<string, unknown>;
      agent_mode?: AdvancedModelAgentMode;
      retriever_resource?: Record<string, unknown>;
      [key: string]: unknown;
    }

    /** 更新模型配置请求体 */
    interface ModelConfigPayload {
      model: {
        provider?: string;
        name?: string;
        mode?: string;
        completion_params?: Record<string, unknown>;
        [key: string]: unknown;
      };
    }

    /** Agent 策略中的 agent_mode 对象（Dify /advanced-model） */
    interface AdvancedModelAgentMode {
      enabled?: boolean;
      strategy?: 'function_call' | 'react';
      tools?: Array<Record<string, unknown>>;
      max_iteration?: number;
      summary_model?: Record<string, unknown>;
      [key: string]: unknown;
    }

    /** Agent 策略配置（Dify /advanced-model 返回） */
    interface AdvancedModel {
      agent_mode?: AdvancedModelAgentMode;
      [key: string]: unknown;
    }

    /** 更新 Agent 策略请求体 */
    interface AdvancedModelPayload {
      agent_mode: {
        enabled?: boolean;
        strategy?: 'function_call' | 'react';
        max_iteration?: number;
        [key: string]: unknown;
      };
    }

    /** 会话列表项 */
    interface ConversationItem {
      id: string;
      name: string;
      inputs: Record<string, unknown>;
      status: string;
      introduction?: string;
      created_at?: number;
      updated_at?: number;
      [key: string]: unknown;
    }

    /** 会话列表响应（Dify 原生） */
    interface ConversationList {
      data: ConversationItem[];
      total?: number;
      has_more?: boolean;
    }

    /** 会话消息项 */
    interface ConversationMessage {
      id: string;
      conversation_id: string;
      query: string;
      answer: string;
      inputs?: Record<string, unknown>;
      message_files?: MessageFile[];
      feedback?: {
        rating?: 'like' | 'dislike' | null;
        [key: string]: unknown;
      };
      retriever_resources?: Array<Record<string, unknown>>;
      agent_thoughts?: Array<Record<string, unknown>>;
      metadata?: Record<string, unknown>;
      status?: string;
      error?: string | null;
      created_at?: number;
      [key: string]: unknown;
    }

    /** 会话消息历史响应（Dify 原生） */
    interface ConversationMessages {
      data: ConversationMessage[];
      has_more?: boolean;
    }

    /** 文件上传响应（Dify 原生：{ id, name, size, ... }） */
    interface FileUploadResp extends Record<string, unknown> {
      id?: string;
      name?: string;
    }

    /** Workflow 阻塞运行响应（Dify 原生 outputs） */
    interface WorkflowRunReq {
      appId?: number;
      userId: string;
      inputs?: Record<string, unknown>;
      files?: MessageFile[];
    }

    /** Workflow 阻塞运行响应（Dify 原生 outputs） */
    interface WorkflowRunResp extends Record<string, unknown> {
      task_id?: string;
      workflow_run_id?: string;
      data?: Record<string, unknown>;
    }

    interface WorkflowRunDetail extends Record<string, unknown> {
      task_id?: string;
      workflow_run_id?: string;
      data?: Record<string, unknown>;
    }

    /** 消息反馈请求 */
    interface FeedbackReq {
      appId?: number;
      messageId: string;
      userId: string;
      rating: 'like' | 'dislike';
      content?: string;
    }

    interface ConversationRenameReq {
      appId?: number;
      userId: string;
      name?: string;
      autoGenerateName?: boolean;
    }

    interface SuggestedQuestionItem {
      question?: string;
      [key: string]: unknown;
    }

    interface SuggestedQuestionsResp {
      result?: string;
      data?: Array<SuggestedQuestionItem | string>;
      [key: string]: unknown;
    }

    interface WorkflowLogItem {
      id?: string;
      created_at?: number;
      created_by_role?: string;
      created_by_end_user?: Record<string, unknown>;
      workflow_run?: {
        id?: string;
        version?: string;
        status?: string;
        error?: string | null;
        elapsed_time?: number;
        total_tokens?: number;
        total_steps?: number;
        created_at?: number;
        finished_at?: number;
        outputs?: Record<string, unknown>;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    }

    interface WorkflowLogList {
      data?: WorkflowLogItem[];
      total?: number;
      page?: number;
      limit?: number;
      has_more?: boolean;
      [key: string]: unknown;
    }

    /** 提示词编排配置（Dify /apps/{id}/model-config 返回，含 prompt/orchestration） */
    interface OrchestrationConfig {
      model?: ModelConfigModel;
      prompt_template?: string;
      pre_prompt?: string;
      opening_statement?: string;
      suggested_questions?: string[];
      features?: Record<string, unknown>;
      dataset_configs?: Record<string, unknown>;
      agent_mode?: AdvancedModelAgentMode;
      retriever_resource?: Record<string, unknown>;
      [key: string]: unknown;
    }

    /** 更新提示词编排请求体 */
    interface OrchestrationPayload {
      model?: {
        provider?: string;
        name?: string;
        mode?: string;
        completion_params?: Record<string, unknown>;
        [key: string]: unknown;
      };
      prompt_template?: string;
      pre_prompt?: string;
      opening_statement?: string;
      suggested_questions?: string[];
      features?: Record<string, unknown>;
      [key: string]: unknown;
    }

    /** 智能体已绑定的知识库数据集项（Dify /apps/{id}/datasets） */
    interface DifyAppDataset {
      id?: string;
      name?: string;
      description?: string;
      document_count?: number;
      permission?: string;
      [key: string]: unknown;
    }

    /** 工具（Dify /tools、/apps/{id}/tools） */
    interface DifyTool {
      id?: string;
      name?: string;
      type?: 'builtin' | 'api' | 'workflow' | string;
      labels?: string[];
      is_own?: boolean;
      [key: string]: unknown;
    }

    /** MCP 服务（Dify /mcp） */
    interface DifyMcpServer {
      id?: string;
      name?: string;
      description?: string;
      tools?: Array<Record<string, unknown>>;
      [key: string]: unknown;
    }
  }
}
