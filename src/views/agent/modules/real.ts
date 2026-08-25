import type { AgentDefinition, AgentTestRecord } from './types';

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

export function asList<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  // 兼容 request 解包后残留的信封：{ data: [...] }
  if (value && typeof value === 'object' && Array.isArray((value as { data?: unknown }).data)) {
    return (value as { data: T[] }).data;
  }
  return [];
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

export function mapDifyAppToAgent(app: Api.DifyApp.DifyAppResp): AgentDefinition {
  const typeName = getTypeLabel(app.type);

  return {
    key: String(app.id),
    name: app.name,
    slogan: app.description || `${typeName}应用`,
    description: app.description || '',
    appType: app.type,
    difyAppId: app.difyAppId || '',
    baseUrl: app.baseUrl || '',
    category: typeName,
    status: app.status === 1 ? 'online' : 'draft',
    model: app.baseUrl ? '自定义服务' : '默认引擎',
    version: app.updateTime ? '已配置' : '待配置',
    confidence: 0,
    avgDuration: '--',
    icon: ICON_BY_TYPE[app.type] || 'mdi:robot',
    capabilityTags: [typeName, app.status === 1 ? '已启用' : '未启用'],
    tools: TOOL_BY_TYPE[app.type] || ['对话生成'],
    recommendedPrompts: [],
    // 应用有真实描述时生成有意义默认提示，否则留空让用户自行输入
    defaultInput: app.description ? `请使用「${app.name}」处理：${app.description}` : ''
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
