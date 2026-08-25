export type AgentKey = string;
export type AgentRuntimeStatus = 'online' | 'busy' | 'draft';
export type AgentTaskStatus = 'running' | 'success' | 'failed';
export type AgentStepStatus = 'waiting' | 'running' | 'success' | 'failed';

export interface AgentDefinition {
  key: AgentKey;
  name: string;
  slogan: string;
  description: string;
  appType?: Api.DifyApp.AppType;
  /** 远端应用 ID（UUID），用于拼接编排控制台编排页 URL */
  difyAppId?: string;
  /** 应用单独配置的 Dify 服务地址；为空则回退全局 dify.url */
  baseUrl?: string;
  category: string;
  status: AgentRuntimeStatus;
  model: string;
  version: string;
  confidence: number;
  avgDuration: string;
  icon: string;
  capabilityTags: string[];
  tools: string[];
  recommendedPrompts: string[];
  openingStatement?: string;
  supportsFiles?: boolean;
  defaultInput: string;
}

export interface AgentTestRecord {
  id: string;
  agentKey: AgentKey;
  mode?: 'chat' | 'workflow';
  messageId?: string;
  taskId?: string;
  prompt: string;
  response: string;
  references: string[];
  suggestedQuestions?: string[];
  steps: Array<{
    label: string;
    detail: string;
  }>;
  createdAt: string;
}

export interface AgentCreateModel {
  name: string;
  type: Api.DifyApp.AppType;
  description?: string;
}
