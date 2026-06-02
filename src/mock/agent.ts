import { reactive } from 'vue';
import { runKnowledgeRetrieval } from './knowledge';

export type AgentKey = string;
export type AgentRuntimeStatus = 'online' | 'busy' | 'draft';
export type AgentTaskStatus = 'running' | 'success' | 'failed';
export type AgentStepStatus = 'waiting' | 'running' | 'success' | 'failed';
export type AgentOutputFormat = 'markdown' | 'json' | 'report';

export interface AgentDefinition {
  key: AgentKey;
  name: string;
  slogan: string;
  description: string;
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
  defaultInput: string;
}

export interface AgentConfigModel {
  key: AgentKey;
  systemPrompt: string;
  model: string;
  temperature: number;
  timeout: number;
  retry: number;
  enabledTools: string[];
  outputFormat: AgentOutputFormat;
  publish: boolean;
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
  title: string;
  status: AgentTaskStatus;
  createdAt: string;
  updatedAt: string;
  operator: string;
  input: string;
  summary: string;
  result: string;
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
  prompt: string;
  response: string;
  references: string[];
  steps: Array<{
    label: string;
    detail: string;
  }>;
  createdAt: string;
}

export interface AgentRunFormModel {
  agentKey: AgentKey;
  title: string;
  input: string;
}

export const agentDefinitions = reactive<AgentDefinition[]>([
  {
    key: 'geo-analysis',
    name: '地理分析助手',
    slogan: '快速完成地形判读、态势提要和风险归因',
    description: '面向地形、岸线、障碍和态势判断场景，适合任务推演前的环境解读和分析摘要生成。',
    category: '地理环境',
    status: 'online',
    model: 'Qwen-3.6-Plus',
    version: 'v1.6',
    confidence: 96,
    avgDuration: '48s',
    icon: 'mdi:earth-box',
    capabilityTags: ['地形判读', '重点区域提取', '风险摘要'],
    tools: ['知识库检索', 'Web球定位', '截图导出'],
    recommendedPrompts: ['分析台湾方向岸线保障重点', '提取某区域地形与障碍结论', '生成战场环境三段式摘要'],
    defaultInput: '请结合台湾方向岸线保障资料，输出结论、依据要点和建议动作。'
  },
  {
    key: 'route-planning',
    name: '机动规划助手',
    slogan: '围绕起终点、约束和偏好给出候选路线结论',
    description: '联动路径偏好、禁行约束和地理条件，输出路线建议、关键障碍和风险解释。',
    category: '规划推演',
    status: 'online',
    model: 'Deepseek-V3.2',
    version: 'v1.4',
    confidence: 92,
    avgDuration: '63s',
    icon: 'mdi:routes',
    capabilityTags: ['多路线对比', '约束解释', '风险提示'],
    tools: ['路线规划结果', '知识库检索', 'Web球定位'],
    recommendedPrompts: ['根据起终点生成 3 条候选路线', '解释当前路线受阻原因', '输出路线对比结论'],
    defaultInput: '起点为 A 港，终点为 B 集结区，优先考虑风险最低与时效平衡。'
  },
  {
    key: 'river-support',
    name: '渡河保障助手',
    slogan: '把任务输入转成多方案分析与保障建议',
    description: '围绕渡河场景生成环境分析、保障要点、风险评估和建议动作，适合方案推演演示。',
    category: '方案生成',
    status: 'busy',
    model: 'Qwen3.6-Plus',
    version: 'v1.3',
    confidence: 89,
    avgDuration: '71s',
    icon: 'mdi:ferry',
    capabilityTags: ['方案摘要', '风险缓解', '资源建议'],
    tools: ['知识库检索', '方案材料导出', '地图标注'],
    recommendedPrompts: ['生成渡河保障方案摘要', '分析当前方案主要风险', '给出资源配置建议'],
    defaultInput: '任务时间窗口 6 小时，目标是尽快完成前出保障，请形成 3 段式方案摘要。'
  },
  {
    key: 'image-recognition',
    name: '影像识别助手',
    slogan: '从影像判读到对象提取形成可用结论',
    description: '适合影像发现、目标分类和专题提炼场景，结合结果说明和知识引用输出可读报告。',
    category: '影像智能',
    status: 'draft',
    model: 'InternVL',
    version: 'v0.9',
    confidence: 84,
    avgDuration: '58s',
    icon: 'mdi:image-search',
    capabilityTags: ['目标识别', '区域判读', '专题摘要'],
    tools: ['影像结果解析', '知识库检索', '截图对比'],
    recommendedPrompts: ['识别影像中的关键设施', '输出目标识别摘要', '结合知识库说明目标价值'],
    defaultInput: '请对上传影像做目标识别和价值判断，并输出结构化摘要。'
  }
]);

/** 可选图标列表 */
export const agentIconOptions = [
  { label: '地球', value: 'mdi:earth-box' },
  { label: '路线', value: 'mdi:routes' },
  { label: '渡轮', value: 'mdi:ferry' },
  { label: '图像搜索', value: 'mdi:image-search' },
  { label: '机器人', value: 'mdi:robot' },
  { label: '大脑', value: 'mdi:brain' },
  { label: '卫星', value: 'mdi:satellite-variant' },
  { label: '雷达', value: 'mdi:radar' },
  { label: '地图', value: 'mdi:map-marker-radius' },
  { label: '气象', value: 'mdi:weather-partly-cloudy' },
  { label: '指南针', value: 'mdi:compass' },
  { label: '图表', value: 'mdi:chart-areaspline' }
];

/** 可选分类 */
export const agentCategoryOptions = [
  { label: '地理环境', value: '地理环境' },
  { label: '规划推演', value: '规划推演' },
  { label: '方案生成', value: '方案生成' },
  { label: '影像智能', value: '影像智能' },
  { label: '其他', value: '其他' }
];

/** 可选模型 */
export const agentModelOptions = [
  { label: 'Qwen-3.6-Plus', value: 'Qwen-3.6-Plus' },
  { label: 'Deepseek-V3.2', value: 'Deepseek-V3.2' },
  { label: 'InternVL', value: 'InternVL' },
  { label: 'Qwen3.6-Plus', value: 'Qwen3.6-Plus' }
];

/** 可选工具 */
export const agentToolOptions = [
  '知识库检索',
  'Web球定位',
  '截图导出',
  '路线规划结果',
  '方案材料导出',
  '地图标注',
  '影像结果解析',
  '截图对比'
];

export const agentConfigStore = reactive<Record<AgentKey, AgentConfigModel>>({
  'geo-analysis': {
    key: 'geo-analysis',
    systemPrompt: '你是一名地理分析助手，需要以结论、依据要点、建议动作三段式返回结果。',
    model: 'Qwen-3.6-Plus',
    temperature: 0.2,
    timeout: 90,
    retry: 1,
    enabledTools: ['知识库检索', 'Web球定位', '截图导出'],
    outputFormat: 'markdown',
    publish: true
  },
  'route-planning': {
    key: 'route-planning',
    systemPrompt: '你是一名机动规划助手，需要优先给出可执行路线、风险点和替代建议。',
    model: 'Deepseek-V3.2',
    temperature: 0.3,
    timeout: 120,
    retry: 2,
    enabledTools: ['路线规划结果', '知识库检索', 'Web球定位'],
    outputFormat: 'report',
    publish: true
  },
  'river-support': {
    key: 'river-support',
    systemPrompt: '你是一名渡河保障助手，输出需要兼顾环境、资源、风险和建议动作。',
    model: 'Qwen3.6-Plus',
    temperature: 0.4,
    timeout: 120,
    retry: 2,
    enabledTools: ['知识库检索', '方案材料导出', '地图标注'],
    outputFormat: 'report',
    publish: true
  },
  'image-recognition': {
    key: 'image-recognition',
    systemPrompt: '你是一名影像识别助手，需要把识别结果转成可读结论并附引用。',
    model: 'InternVL',
    temperature: 0.1,
    timeout: 90,
    retry: 1,
    enabledTools: ['影像结果解析', '知识库检索', '截图对比'],
    outputFormat: 'json',
    publish: false
  }
});

export const agentRunTasks = reactive<AgentRunTask[]>([
  {
    id: 'task-geo-001',
    agentKey: 'geo-analysis',
    title: '台湾岸线保障重点分析',
    status: 'success',
    createdAt: '2026-05-24 09:20',
    updatedAt: '2026-05-24 09:21',
    operator: '演示账号',
    input: '请结合台湾方向岸线保障资料，输出结论、依据要点和建议动作。',
    summary: '已识别港口、岸滩和补给通道 3 类重点对象。',
    result:
      '结论：台湾方向岸线保障应优先关注港口装卸能力、滩头通行性和纵深补给联接。依据要点：港口节点集中、岸滩条件差异明显、内陆通道对补给效率影响显著。建议动作：优先完成重点港区保障评估，并在 Web球中联动查看关键节点。',
    references: ['台湾方向港口资料汇编', '东南沿海保障路线经验摘要', '岸滩通行性评估术语集'],
    steps: [
      { key: 'intent', label: '输入理解', description: '解析任务意图与时空范围', status: 'success', duration: '6s' },
      {
        key: 'retrieve',
        label: '知识检索',
        description: '召回知识库相关资料与 chunk',
        status: 'success',
        duration: '12s',
        tool: '知识库检索'
      },
      {
        key: 'analysis',
        label: '空间分析',
        description: '关联港口与岸线保障对象',
        status: 'success',
        duration: '18s',
        tool: 'Web球定位'
      },
      { key: 'output', label: '结果输出', description: '生成三段式分析摘要', status: 'success', duration: '12s' }
    ],
    metrics: {
      duration: '48s',
      tokens: 3218,
      confidence: 92
    }
  },
  {
    id: 'task-route-001',
    agentKey: 'route-planning',
    title: '前出路线候选比对',
    status: 'running',
    createdAt: '2026-05-24 10:08',
    updatedAt: '2026-05-24 10:09',
    operator: '演示账号',
    input: '起点为 A 港，终点为 B 集结区，优先考虑风险最低与时效平衡。',
    summary: '正在比对 3 条候选路线的时效与风险差异。',
    result: '候选路线正在生成中，当前已完成环境约束解析和风险节点聚合。',
    references: ['东南沿海机动路线资料', '典型约束模板'],
    steps: [
      { key: 'intent', label: '输入理解', description: '识别起终点、偏好与约束', status: 'success', duration: '7s' },
      {
        key: 'retrieve',
        label: '知识检索',
        description: '召回历史路线与约束模板',
        status: 'success',
        duration: '10s',
        tool: '知识库检索'
      },
      {
        key: 'analysis',
        label: '路径评估',
        description: '生成多路线并聚合风险',
        status: 'running',
        duration: '进行中',
        tool: '路线规划结果'
      },
      { key: 'output', label: '结果输出', description: '输出路线对比摘要', status: 'waiting', duration: '--' }
    ],
    metrics: {
      duration: '63s',
      tokens: 2870,
      confidence: 88
    }
  }
]);

export const agentTestRecords = reactive<AgentTestRecord[]>([
  {
    id: 'test-001',
    agentKey: 'geo-analysis',
    prompt: '分析台湾方向港口与岸线保障重点。',
    response: '已返回港口节点、岸线通行性和补给联接 3 类重点，建议优先联动 Web球查看关键港区与内陆通道。',
    references: ['台湾方向港口资料汇编', '岸滩通行性评估术语集'],
    steps: [
      { label: '知识召回', detail: '命中 6 篇文档、12 条 chunk' },
      { label: '空间联动', detail: '已定位 3 个港区和 2 条纵深通道' },
      { label: '结果压缩', detail: '输出三段式摘要' }
    ],
    createdAt: '2026-05-24 09:42'
  }
]);

export function getAgentByKey(key: string | null | undefined) {
  return agentDefinitions.find(item => item.key === key) || agentDefinitions[0];
}

export function getAgentConfigByKey(key: AgentKey) {
  return agentConfigStore[key];
}

export function updateAgentConfig(payload: AgentConfigModel) {
  agentConfigStore[payload.key] = {
    ...payload,
    enabledTools: [...payload.enabledTools]
  };

  return agentConfigStore[payload.key];
}

export function getTasksByAgentKey(key: AgentKey) {
  return agentRunTasks.filter(item => item.agentKey === key);
}

export function getTaskById(id: string) {
  return agentRunTasks.find(item => item.id === id) || null;
}

export function createAgentRunTask(payload: AgentRunFormModel) {
  const agent = getAgentByKey(payload.agentKey);
  const timestamp = Date.now();

  // 实际调用知识库检索
  const retrievalResults = runKnowledgeRetrieval(payload.input.trim());
  const totalHits = retrievalResults.reduce((sum, r) => sum + r.matches.length, 0);
  const hitDocCount = retrievalResults.length;
  const topDocNames = retrievalResults.slice(0, 3).map(r => r.document.name);
  const topSnippet = retrievalResults[0]?.matches[0]?.snippet || '';

  const retrieveDesc = totalHits > 0
    ? `命中 ${hitDocCount} 篇文档、${totalHits} 条 chunk（${topDocNames.slice(0, 2).join('、')}）`
    : '未命中相关文档，使用默认知识模板';

  const references = totalHits > 0
    ? [...topDocNames, '运行模板', '智能体默认配置']
    : ['无相关命中文档', '运行模板', '智能体默认配置'];

  const knowledgeSummary = totalHits > 0
    ? `已从 ${hitDocCount} 篇知识库文档中召回 ${totalHits} 条相关片段`
    : '未检索到匹配知识';
  const enrichedSnippet = topSnippet ? `（示例片段：${topSnippet.slice(0, 60)}...）` : '';

  const task: AgentRunTask = {
    id: `task-${payload.agentKey}-${timestamp}`,
    agentKey: payload.agentKey,
    title: payload.title.trim() || `${agent.name}新任务`,
    status: 'success',
    createdAt: '2026-05-24 21:20',
    updatedAt: '2026-05-24 21:21',
    operator: '演示账号',
    input: payload.input.trim(),
    summary: `已基于 ${agent.name} 完成一次前端模拟运行。${knowledgeSummary}。`,
    result: `结论：${agent.name} 已完成本次任务分析。${knowledgeSummary}${enrichedSnippet} 依据要点：已联动知识检索、能力链路和结果压缩模块。建议动作：进入任务详情查看步骤、日志和引用来源。`,
    references,
    steps: [
      { key: 'intent', label: '输入理解', description: '解析任务输入与约束', status: 'success', duration: '5s' },
      {
        key: 'retrieve',
        label: '知识检索',
        description: retrieveDesc,
        status: 'success',
        duration: '11s',
        tool: '知识库检索'
      },
      { key: 'reason', label: '智能推理', description: '形成结论与建议', status: 'success', duration: '16s' },
      { key: 'output', label: '结果输出', description: '输出结构化结果', status: 'success', duration: '8s' }
    ],
    metrics: {
      duration: '40s',
      tokens: 2680 + totalHits * 120,
      confidence: totalHits > 0 ? 90 : 80
    }
  };

  agentRunTasks.unshift(task);
  return task;
}

export function rerunAgentTask(taskId: string) {
  const task = getTaskById(taskId);
  if (!task) return null;

  return createAgentRunTask({
    agentKey: task.agentKey,
    title: `${task.title}-重跑`,
    input: task.input
  });
}

export function runAgentTest(agentKey: AgentKey, prompt: string) {
  const agent = getAgentByKey(agentKey);

  // 实际调用知识库检索
  const retrievalResults = runKnowledgeRetrieval(prompt);
  const totalHits = retrievalResults.reduce((sum, r) => sum + r.matches.length, 0);
  const hitDocCount = retrievalResults.length;
  const topDocNames = retrievalResults.slice(0, 3).map(r => r.document.name);

  const retrievalDetail = totalHits > 0
    ? `命中 ${hitDocCount} 篇文档、${totalHits} 条 chunk（${topDocNames[0] || ''}）`
    : '未命中相关文档';

  const references = totalHits > 0
    ? [...topDocNames, '配置模板']
    : ['配置模板'];

  const record: AgentTestRecord = {
    id: `test-${agentKey}-${Date.now()}`,
    agentKey,
    prompt: prompt.trim(),
    response: `${agent.name} 已完成测试响应，${totalHits > 0 ? `基于 ${hitDocCount} 篇知识文档和` : ''}能力链路输出结论、关键依据和建议动作三段结构，可用于工作台演示。`,
    references,
    steps: [
      { label: '知识召回', detail: retrievalDetail },
      { label: '工具调用', detail: `启用 ${getAgentConfigByKey(agentKey).enabledTools.join(' / ')}` },
      { label: '结果生成', detail: '返回结构化文本与引用来源' }
    ],
    createdAt: '2026-05-24 21:28'
  };

  agentTestRecords.unshift(record);
  return record;
}

/** 新建智能体表单数据 */
export interface AgentCreateModel {
  name: string;
  slogan: string;
  description: string;
  category: string;
  icon: string;
  model: string;
  temperature: number;
  timeout: number;
  retry: number;
  tools: string[];
  capabilityTags: string[];
  recommendedPrompts: string[];
  systemPrompt: string;
  defaultInput: string;
}

/** 创建新智能体：向 agentDefinitions 和 agentConfigStore 中添加记录 */
export function createAgentDefinition(payload: AgentCreateModel): AgentDefinition {
  const key = `custom-${Date.now()}`;
  const definition: AgentDefinition = {
    key,
    name: payload.name.trim(),
    slogan: payload.slogan.trim(),
    description: payload.description.trim(),
    category: payload.category,
    status: 'draft',
    model: payload.model,
    version: 'v0.1',
    confidence: 0,
    avgDuration: '--',
    icon: payload.icon,
    capabilityTags: [...payload.capabilityTags],
    tools: [...payload.tools],
    recommendedPrompts: [...payload.recommendedPrompts],
    defaultInput: payload.defaultInput.trim()
  };

  agentDefinitions.push(definition);

  agentConfigStore[key] = {
    key,
    systemPrompt: payload.systemPrompt.trim(),
    model: payload.model,
    temperature: payload.temperature,
    timeout: payload.timeout,
    retry: payload.retry,
    enabledTools: [...payload.tools],
    outputFormat: 'markdown',
    publish: false
  };

  return definition;
}
