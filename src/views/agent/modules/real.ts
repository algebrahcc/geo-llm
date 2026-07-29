import type { AgentDefinition, AgentRunStep, AgentRunTask, AgentTestRecord } from './types';

export interface AgentParameterField {
  kind: 'text' | 'textarea' | 'number' | 'select' | 'switch';
  name: string;
  label: string;
  required: boolean;
  placeholder?: string;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string | number }>;
}

export interface AgentFileCapability {
  enabled: boolean;
  limit: number;
  accept: string;
  supportLocalFile: boolean;
  supportRemoteUrl: boolean;
}

const ICON_BY_TYPE: Record<number, string> = {
  1: 'mdi:chat',
  2: 'mdi:robot',
  3: 'mdi:workflow'
};

const TOOL_BY_TYPE: Record<number, string[]> = {
  1: ['会话记录', '参数输入', '建议问题'],
  2: ['会话记录', '建议问题', '思考过程'],
  3: ['工作流执行', '运行日志', '结果输出']
};

function getTypeLabel(type: Api.DifyApp.AppType): string {
  return type === 1 ? '聊天助手' : type === 2 ? '智能体' : '工作流';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asList<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function pickNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return 0;
}

function previewText(value: unknown, fallback = '暂无内容'): string {
  if (typeof value === 'string') {
    return value.trim() || fallback;
  }
  if (value == null) return fallback;
  if (Array.isArray(value)) {
    return (
      value
        .map(item => previewText(item, ''))
        .filter(Boolean)
        .join('\n') || fallback
    );
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return fallback;
    }
  }
  return String(value);
}

function normalizeStatus(status?: string): AgentRunTask['status'] {
  const value = (status || '').toLowerCase();
  if (['running', 'processing'].includes(value)) return 'running';
  if (['failed', 'error', 'stopped'].includes(value)) return 'failed';
  return 'success';
}

function normalizeWorkflowStatus(status?: string): AgentRunTask['status'] {
  const value = (status || '').toLowerCase();
  if (['running', 'processing', 'pending'].includes(value)) return 'running';
  if (['failed', 'stopped', 'error'].includes(value)) return 'failed';
  return 'success';
}

function formatDuration(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds)) return '--';
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  return `${seconds.toFixed(seconds >= 10 ? 0 : 1)}s`;
}

export function formatUnixTimestamp(value?: number): string {
  if (!value) return '--';
  const date = new Date(value * 1000);
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function stringifyOutput(value: unknown) {
  return previewText(value, '暂无输出内容');
}

export function normalizeSuggestedQuestions(payload?: Api.Dify.SuggestedQuestionsResp | null) {
  const values = asList<Api.Dify.SuggestedQuestionItem | string>(payload?.data);
  return values
    .map(item => {
      if (typeof item === 'string') return item.trim();
      return String(item.question || '').trim();
    })
    .filter(Boolean);
}

export function normalizeParameterFields(parameters?: Api.Dify.AppParameters | null): AgentParameterField[] {
  return asList<Api.Dify.UserInputFormItem>(parameters?.user_input_form)
    .map((item, index) => {
      const record = asRecord(item);
      const [kind, rawSchema] = Object.entries(record)[0] || [];
      const schema = asRecord(rawSchema);
      const name = pickString(schema, ['variable', 'name', 'field']) || `field_${index + 1}`;
      const label = pickString(schema, ['label', 'title']) || name;
      const rawOptions = asList<Api.Dify.ParameterFormOption | string | number | boolean>(schema.options);
      const options = rawOptions.map(option => {
        if (typeof option === 'object') {
          const current = asRecord(option);
          const rawValue = (current.value as string | number | boolean | undefined) ?? String(current.label || '');
          const value = typeof rawValue === 'boolean' ? String(rawValue) : rawValue;
          return { label: String(current.label || value), value };
        }
        return { label: String(option), value: typeof option === 'boolean' ? String(option) : option };
      });

      const normalizedKind: AgentParameterField['kind'] = kind?.includes('paragraph')
        ? 'textarea'
        : kind?.includes('select')
          ? 'select'
          : kind?.includes('number')
            ? 'number'
            : kind?.includes('switch') || kind?.includes('bool')
              ? 'switch'
              : 'text';

      return {
        kind: normalizedKind,
        name,
        label,
        required: Boolean(schema.required),
        placeholder: pickString(schema, ['placeholder', 'hint', 'description']),
        defaultValue: schema.default,
        options: options.length ? options : undefined
      };
    })
    .filter(item => item.name);
}

export function buildInitialParameterValues(fields: AgentParameterField[]) {
  return fields.reduce<Record<string, unknown>>((acc, field) => {
    acc[field.name] = field.defaultValue ?? (field.kind === 'switch' ? false : '');
    return acc;
  }, {});
}

export function normalizeFileCapability(parameters?: Api.Dify.AppParameters | null): AgentFileCapability {
  const upload = asRecord(parameters?.file_upload);
  const methods = asList<Api.Dify.UploadTransferMethod>(
    upload.allowed_file_upload_methods || asRecord(upload.image).transfer_methods
  );
  const extensions = asList<string>(upload.allowed_file_extensions);
  const accept = extensions.length ? extensions.map(item => (item.startsWith('.') ? item : `.${item}`)).join(',') : '*';

  return {
    enabled: Boolean(upload.enabled),
    limit: pickNumber(upload, ['number_limits']) || 5,
    accept,
    supportLocalFile: methods.length ? methods.includes('local_file') : true,
    supportRemoteUrl: methods.includes('remote_url')
  };
}

function extractConversationReferences(messages: Api.Dify.ConversationMessage[]) {
  const refs = new Set<string>();
  messages.forEach(message => {
    asList<Record<string, unknown>>(message.retriever_resources).forEach(resource => {
      const current = asRecord(resource);
      const label =
        pickString(current, ['document_name', 'segment_name', 'dataset_name', 'title', 'name']) ||
        pickString(asRecord(current.metadata), ['title', 'name']);
      if (label) refs.add(label);
    });
  });
  return Array.from(refs);
}

function extractConversationSteps(messages: Api.Dify.ConversationMessage[], answer: string): AgentRunStep[] {
  const thoughts = messages.flatMap(message => asList<Record<string, unknown>>(message.agent_thoughts));
  if (thoughts.length) {
    const steps = thoughts.map((thought, index) => {
      const current = asRecord(thought);
      const tool = pickString(current, ['tool', 'tool_name']);
      const description =
        pickString(current, ['thought', 'observation']) ||
        (tool ? `已执行 ${tool} 并返回处理结果` : `已完成第 ${index + 1} 步推理`);
      return {
        key: `thought_${index + 1}`,
        label: tool || `步骤 ${index + 1}`,
        description,
        status: 'success' as const,
        duration: '--',
        tool: tool || undefined
      };
    });
    steps.push({
      key: 'output',
      label: '结果输出',
      description: answer ? `已生成 ${answer.length} 字回复内容` : '已返回本轮结果',
      status: 'success',
      duration: '--',
      tool: undefined
    });
    return steps;
  }

  return [
    {
      key: 'intent',
      label: '输入理解',
      description: '已解析用户输入并完成本轮意图识别',
      status: 'success',
      duration: '--',
      tool: undefined
    },
    {
      key: 'generate',
      label: '内容生成',
      description: answer ? `已生成 ${answer.length} 字回复内容` : '已完成回复生成',
      status: 'success',
      duration: '--',
      tool: 'Dify'
    },
    {
      key: 'output',
      label: '结果输出',
      description: '结果已写入会话历史',
      status: 'success',
      duration: '--',
      tool: undefined
    }
  ];
}

export function mapDifyAppToAgent(app: Api.DifyApp.DifyAppResp): AgentDefinition {
  const typeName = getTypeLabel(app.type);

  return {
    key: String(app.id),
    name: app.name,
    slogan: app.description || `${typeName}应用`,
    description: app.description || '',
    appType: app.type,
    category: typeName,
    status: app.status === 1 ? 'online' : 'draft',
    model: app.baseUrl ? 'Dify 自定义地址' : 'Dify',
    version: app.updateTime ? '已配置' : '待配置',
    confidence: 0,
    avgDuration: '--',
    icon: ICON_BY_TYPE[app.type] || 'mdi:robot',
    capabilityTags: [typeName, app.status === 1 ? '已启用' : '未启用'],
    tools: TOOL_BY_TYPE[app.type] || ['对话生成'],
    recommendedPrompts: [],
    defaultInput: `请使用「${app.name}」处理：${app.description || '请结合当前业务场景给出结果。'}`
  };
}

export function buildConversationTask(params: {
  agent: AgentDefinition;
  conversation: Api.Dify.ConversationItem;
  messages: Api.Dify.ConversationMessage[];
}): AgentRunTask {
  const { agent, conversation } = params;
  const messages = [...params.messages].sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
  const latestMessage = messages[messages.length - 1];
  const answer = latestMessage?.answer || '';
  const query = latestMessage?.query || messages[0]?.query || '';
  const refs = extractConversationReferences(messages);
  const tokenUsage = pickNumber(asRecord(latestMessage?.metadata).usage as Record<string, unknown>, ['total_tokens']);
  const createdAt = formatUnixTimestamp(conversation.created_at || latestMessage?.created_at);

  return {
    id: conversation.id,
    agentKey: agent.key,
    mode: 'chat',
    conversationId: conversation.id,
    messageId: latestMessage?.id,
    title: conversation.name || `${agent.name}会话`,
    status: normalizeStatus(conversation.status || latestMessage?.status),
    createdAt,
    updatedAt: formatUnixTimestamp(conversation.updated_at || latestMessage?.created_at || conversation.created_at),
    operator: '当前用户',
    input: query,
    rawInputs: conversation.inputs || latestMessage?.inputs || {},
    summary: answer ? answer.slice(0, 80) : '暂无回复内容',
    result: answer || '暂无回复内容',
    rawOutput: latestMessage ? asRecord(latestMessage.metadata) : null,
    references: refs,
    steps: extractConversationSteps(messages, answer),
    metrics: {
      duration: '--',
      tokens: tokenUsage || answer.length + query.length,
      confidence: 0
    }
  };
}

function extractWorkflowRun(log: Record<string, unknown>) {
  const workflowRun = asRecord(log.workflow_run);
  if (Object.keys(workflowRun).length) return workflowRun;
  return asRecord(log.data);
}

function buildWorkflowSteps(run: Record<string, unknown>): AgentRunStep[] {
  return [
    {
      key: 'input',
      label: '输入装载',
      description: '已装载工作流运行所需变量',
      status: 'success',
      duration: '--'
    },
    {
      key: 'workflow',
      label: '流程执行',
      description: pickString(run, ['status']) || '已执行工作流编排',
      status: normalizeWorkflowStatus(pickString(run, ['status'])),
      duration: formatDuration(pickNumber(run, ['elapsed_time']))
    },
    {
      key: 'output',
      label: '结果输出',
      description: '已整理工作流输出结果',
      status: normalizeWorkflowStatus(pickString(run, ['status'])),
      duration: '--'
    }
  ];
}

export function buildWorkflowTaskFromLog(params: {
  agent: AgentDefinition;
  log: Api.Dify.WorkflowLogItem;
}): AgentRunTask {
  const { agent, log } = params;
  const run = extractWorkflowRun(asRecord(log));
  const outputs = asRecord(run.outputs);
  const outputText = stringifyOutput(Object.keys(outputs).length ? outputs : run);
  const createdAt = formatUnixTimestamp((run.created_at as number | undefined) || log.created_at);

  return {
    id: String(run.id || log.id || ''),
    agentKey: agent.key,
    mode: 'workflow',
    workflowRunId: String(run.id || ''),
    taskId: pickString(run, ['task_id']) || pickString(asRecord(log), ['task_id']),
    title: `${agent.name}执行记录`,
    status: normalizeWorkflowStatus(pickString(run, ['status'])),
    createdAt,
    updatedAt: formatUnixTimestamp(
      (run.finished_at as number | undefined) || (run.created_at as number | undefined) || log.created_at
    ),
    operator: '当前用户',
    input: previewText(asRecord(log).inputs, '按参数表单发起执行'),
    rawInputs: asRecord(asRecord(log).inputs),
    summary: outputText.slice(0, 80),
    result: outputText,
    rawOutput: outputs,
    references: [],
    steps: buildWorkflowSteps(run),
    metrics: {
      duration: formatDuration(pickNumber(run, ['elapsed_time'])),
      tokens: pickNumber(run, ['total_tokens']),
      confidence: 0
    }
  };
}

export function buildWorkflowTaskFromDetail(params: {
  agent: AgentDefinition;
  workflowRunId: string;
  detail: Api.Dify.WorkflowRunDetail;
  inputs?: Record<string, unknown>;
}): AgentRunTask {
  const { agent, workflowRunId, detail, inputs } = params;
  const root = asRecord(detail);
  const run = asRecord(detail.data);
  const outputs = asRecord(run.outputs);
  const status = pickString(run, ['status']) || pickString(root, ['status']);
  const outputText = stringifyOutput(Object.keys(outputs).length ? outputs : run);
  const createdAt = formatUnixTimestamp(
    (run.created_at as number | undefined) || (root.created_at as number | undefined)
  );

  return {
    id: workflowRunId,
    agentKey: agent.key,
    mode: 'workflow',
    workflowRunId,
    taskId: pickString(root, ['task_id']) || pickString(run, ['task_id']),
    title: `${agent.name}执行详情`,
    status: normalizeWorkflowStatus(status),
    createdAt,
    updatedAt: formatUnixTimestamp((run.finished_at as number | undefined) || (run.created_at as number | undefined)),
    operator: '当前用户',
    input: previewText(inputs || root.inputs || run.inputs, '按参数表单发起执行'),
    rawInputs: inputs || asRecord(root.inputs) || asRecord(run.inputs),
    summary: outputText.slice(0, 80),
    result: outputText,
    rawOutput: outputs,
    references: [],
    steps: buildWorkflowSteps(run),
    metrics: {
      duration: formatDuration(pickNumber(run, ['elapsed_time'])),
      tokens: pickNumber(run, ['total_tokens']),
      confidence: 0
    }
  };
}

export function buildTestRecord(params: {
  agent: AgentDefinition;
  prompt: string;
  answer: string;
  conversationId?: string;
  messageId?: string;
  taskId?: string;
  mode?: 'chat' | 'workflow';
  suggestedQuestions?: string[];
}): AgentTestRecord {
  const { agent, prompt, answer, conversationId, messageId, taskId, mode = 'chat', suggestedQuestions = [] } = params;

  return {
    id: conversationId || taskId || `${agent.key}-${Date.now()}`,
    agentKey: agent.key,
    mode,
    messageId,
    taskId,
    prompt,
    response: answer,
    references: [],
    suggestedQuestions,
    steps: [
      { label: '请求路由', detail: mode === 'workflow' ? '已发起工作流执行请求' : '已发起会话请求' },
      { label: '结果生成', detail: `返回 ${answer.length} 字响应内容` },
      { label: '运行标识', detail: conversationId || taskId || messageId || '已生成运行记录' }
    ],
    createdAt: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
  };
}
