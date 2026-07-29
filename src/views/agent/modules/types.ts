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

export interface AgentRunStep {
  key: string;
  label: string;
  description: string;
  status: AgentStepStatus;
  duration: string;
  tool?: string;
}

export interface AgentRunTask {
  id: string;
  agentKey: AgentKey;
  mode?: 'chat' | 'workflow';
  conversationId?: string;
  messageId?: string;
  workflowRunId?: string;
  taskId?: string;
  title: string;
  status: AgentTaskStatus;
  createdAt: string;
  updatedAt: string;
  operator: string;
  input: string;
  rawInputs?: Record<string, unknown>;
  files?: Api.Dify.MessageFile[];
  summary: string;
  result: string;
  rawOutput?: Record<string, unknown> | null;
  references: string[];
  steps: AgentRunStep[];
  metrics: {
    duration: string;
    tokens: number;
    confidence: number;
  };
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
  description: string;
  baseUrl: string;
  apiKey: string;
  sort: number;
  status: Api.DifyApp.AppStatus;
}
