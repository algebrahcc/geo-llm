import { reactive } from 'vue';

export type KnowledgeDocumentStatus = 'ready' | 'indexing' | 'draft' | 'failed';

export interface KnowledgeCategory {
  key: string;
  label: string;
  description: string;
}

export interface KnowledgeCollection {
  key: string;
  label: string;
  description: string;
  group: string;
}

export interface KnowledgeCollectionFormModel {
  key?: string;
  label: string;
  description: string;
  group: string;
}

export interface KnowledgeDocument {
  id: string;
  name: string;
  collection: string;
  category: string;
  source: string;
  reviewer: string;
  tags: string[];
  summary: string;
  format: 'PDF' | 'DOCX' | 'MD' | 'TXT' | 'IMAGE';
  size: string;
  chunkCount: number;
  hits: number;
  indexedAt: string;
  updatedAt: string;
  lastUsedAt: string;
  status: KnowledgeDocumentStatus;
  indexMode: '混合切分' | '语义分段' | '手动分块' | '图片分割';
}

export interface KnowledgeChunk {
  id: string;
  order: number;
  title: string;
  content: string;
  keywords: string[];
  length: number;
  status: 'ready' | 'reviewing';
  type: 'text' | 'image-region';
  regionIndex?: number;
  confidence?: number;
}

export interface KnowledgeReference {
  id: string;
  name: string;
  type: '任务' | '专题' | '分析模板';
  description: string;
}

export interface KnowledgeDocumentDetail extends KnowledgeDocument {
  version: string;
  language: string;
  createdAt: string;
  notes: string;
  processLogs: string[];
  chunks: KnowledgeChunk[];
  references: KnowledgeReference[];
  imageSource?: string;
  segmentModel?: string;
  extractModel?: string;
  regionCount?: number;
}

export interface KnowledgeImportFormModel {
  importType: 'document' | 'image';
  name: string;
  category: string;
  source: string;
  tags: string[];
  indexMode: KnowledgeDocument['indexMode'];
  note: string;
  segmentModel: string;
  extractModel: string;
  imageFiles: { name: string; size: number }[];
}

export interface KnowledgeEditFormModel {
  id: string;
  name: string;
  category: string;
  source: string;
  reviewer: string;
  tags: string[];
  summary: string;
}

export interface KnowledgeFilterParams {
  collection: string;
  category: string;
  search: string;
  source: string;
  status: '' | KnowledgeDocumentStatus;
  sort: 'recent' | 'hits' | 'chunks';
}

export interface KnowledgeRetrievalMatch {
  documentId: string;
  chunkId: string;
  chunkTitle: string;
  snippet: string;
  score: number;
}

export interface KnowledgeRetrievalResult {
  document: KnowledgeDocument;
  matches: KnowledgeRetrievalMatch[];
}

export const segmentModelOptions = [
  { label: 'SAM2 (Segment Anything 2)', value: 'SAM2' },
  { label: 'InternVL-Seg', value: 'InternVL-Seg' },
  { label: 'YOLO-World', value: 'YOLO-World' }
];

export const extractModelOptions = [
  { label: 'InternVL', value: 'InternVL' },
  { label: 'Qwen-VL-Max', value: 'Qwen-VL-Max' },
  { label: 'GPT-4V', value: 'GPT-4V' }
];

const imageRegionTemplates = [
  { title: '水域区域', content: '检测到水域区域，面积约 3.2km²，流向东南，水面宽度约 280m，水深平均 4.5m。该区域与周边支流形成汇水网络，丰水期水位上涨显著。' },
  { title: '植被覆盖区', content: '检测到大面积植被覆盖区域，面积约 5.8km²，以阔叶林为主，覆盖密度约 78%。区域内分布有农田与林地过渡带，地形坡度 5°-15°。' },
  { title: '建设用地', content: '检测到建设用地集中区域，面积约 1.4km²，包含居民点、道路和工业设施。建筑密度中等，主要交通干道呈南北走向，排水系统完善度约 65%。' },
  { title: '裸地与沙洲', content: '检测到裸地与沙洲区域，面积约 0.9km²，位于河道转弯处东侧，地表覆盖度低于 15%。汛期可能被淹没，枯水期出露面积增大。' },
  { title: '丘陵地貌', content: '检测到丘陵地貌区域，面积约 4.1km²，高程差约 120m，坡度 10°-25°。山脊线呈东北-西南走向，沟谷发育充分，汇水面积较大。' }
];

export const knowledgeCollections = reactive<KnowledgeCollection[]>([
  {
    key: 'all',
    label: '全部集合',
    description: '查看所有知识文档与条目',
    group: '总览'
  },
  {
    key: 'basin-core',
    label: '流域基础资料',
    description: '流域环境、水系、地形和历史资料',
    group: '区域知识'
  },
  {
    key: 'coast-theater',
    label: '方向专题资料',
    description: '面向重点方向的岸线、港口与交通专题',
    group: '区域知识'
  },
  {
    key: 'joint-rules',
    label: '联合规则中心',
    description: '跨任务术语、模板和标准资料',
    group: '通用能力'
  },
  {
    key: 'event-briefing',
    label: '事件与纪要',
    description: '会议纪要、经验事件和复盘记录',
    group: '通用能力'
  }
]);

export const knowledgeCategories: KnowledgeCategory[] = [
  {
    key: 'all',
    label: '全部知识',
    description: '统一查看各专题文档、条目与处理状态'
  },
  {
    key: 'yangtze',
    label: '长江流域',
    description: '流域背景、地形、水系与历史方案资料'
  },
  {
    key: 'yellow',
    label: '黄河流域',
    description: '河道演变、堤防风险与保障文档'
  },
  {
    key: 'taiwan',
    label: '台湾方向',
    description: '区域环境、港口岸线与专题分析文档'
  },
  {
    key: 'joint',
    label: '联合专题',
    description: '跨任务共用的术语、模板和规则资料'
  }
];

export const knowledgeDocuments = reactive<KnowledgeDocument[]>([
  {
    id: 'doc-001',
    name: '长江流域地形地貌综合判读手册',
    collection: 'basin-core',
    category: 'yangtze',
    source: '人工整理',
    reviewer: '指挥中心',
    tags: ['地形', '流域', '判读'],
    summary: '汇总长江中下游地形、河网与岸线地貌特征，适合快速检索区域背景信息。',
    format: 'PDF',
    size: '12.6 MB',
    chunkCount: 18,
    hits: 36,
    indexedAt: '2026-05-22 10:10',
    updatedAt: '2026-05-23 16:40',
    lastUsedAt: '2026-05-24 09:12',
    status: 'ready',
    indexMode: '混合切分'
  },
  {
    id: 'doc-002',
    name: '黄河下游堤防风险评估摘要',
    collection: 'basin-core',
    category: 'yellow',
    source: '历史方案归档',
    reviewer: '研判组',
    tags: ['堤防', '风险', '黄河'],
    summary: '提炼黄河下游重点堤防风险点、典型险段和抢险资源配置原则。',
    format: 'DOCX',
    size: '4.3 MB',
    chunkCount: 9,
    hits: 24,
    indexedAt: '2026-05-20 14:26',
    updatedAt: '2026-05-22 11:05',
    lastUsedAt: '2026-05-24 08:40',
    status: 'ready',
    indexMode: '语义分段'
  },
  {
    id: 'doc-003',
    name: '台湾东部岸线港口保障专题',
    collection: 'coast-theater',
    category: 'taiwan',
    source: '外部专题录入',
    reviewer: '海上方向组',
    tags: ['岸线', '港口', '台湾'],
    summary: '聚焦台湾东部港口节点、岸线条件和物资转运保障要点。',
    format: 'PDF',
    size: '8.1 MB',
    chunkCount: 13,
    hits: 42,
    indexedAt: '2026-05-24 07:30',
    updatedAt: '2026-05-24 07:30',
    lastUsedAt: '2026-05-24 10:02',
    status: 'indexing',
    indexMode: '混合切分'
  },
  {
    id: 'doc-004',
    name: '联合术语词表与提示模板',
    collection: 'joint-rules',
    category: 'joint',
    source: '系统维护',
    reviewer: '管理员',
    tags: ['术语', '模板', '提示词'],
    summary: '沉淀跨模块复用的术语、提示模板和标准问答片段。',
    format: 'MD',
    size: '980 KB',
    chunkCount: 21,
    hits: 65,
    indexedAt: '2026-05-18 09:00',
    updatedAt: '2026-05-24 09:35',
    lastUsedAt: '2026-05-24 10:15',
    status: 'ready',
    indexMode: '手动分块'
  },
  {
    id: 'doc-005',
    name: '跨流域水文事件比对记录',
    collection: 'event-briefing',
    category: 'joint',
    source: '会议纪要整理',
    reviewer: '数据组',
    tags: ['水文', '事件', '对比'],
    summary: '记录典型水文事件的触发条件、演变规律和经验判断要点。',
    format: 'TXT',
    size: '640 KB',
    chunkCount: 7,
    hits: 11,
    indexedAt: '2026-05-19 18:20',
    updatedAt: '2026-05-20 09:18',
    lastUsedAt: '2026-05-23 16:10',
    status: 'draft',
    indexMode: '语义分段'
  },
  {
    id: 'doc-006',
    name: '台湾西岸地面交通节点汇编',
    collection: 'coast-theater',
    category: 'taiwan',
    source: '外部专题录入',
    reviewer: '交通组',
    tags: ['节点', '道路', '交通'],
    summary: '整理台湾西岸骨干道路、港口连接线和关键交通节点说明。',
    format: 'DOCX',
    size: '6.7 MB',
    chunkCount: 11,
    hits: 19,
    indexedAt: '2026-05-21 13:48',
    updatedAt: '2026-05-24 08:12',
    lastUsedAt: '2026-05-24 09:56',
    status: 'failed',
    indexMode: '混合切分'
  }
]);

const detailRecords = knowledgeDocuments.reduce<Record<string, KnowledgeDocumentDetail>>((acc, document) => {
  const chunks: KnowledgeChunk[] = Array.from({ length: Math.min(document.chunkCount, 4) }).map((_, index) => ({
    id: `${document.id}-chunk-${index + 1}`,
    order: index + 1,
    title: `Chunk ${index + 1}`,
    content: `${document.summary} 第 ${index + 1} 段重点整理了与 ${document.tags[0]}、${document.tags[1]} 相关的关键描述，便于在问答与方案生成时快速召回。`,
    keywords: [document.tags[0], document.tags[1], document.category],
    length: 360 + index * 42,
    status: index === 0 ? 'ready' : 'reviewing',
    type: 'text' as const
  }));

  acc[document.id] = {
    ...document,
    version: 'v1.0',
    language: '中文',
    createdAt: document.indexedAt,
    notes: '当前为前端演示数据，用于模拟文档详情、分块与引用关系。',
    processLogs: [
      '已完成基础元数据抽取',
      `采用${document.indexMode}生成分块`,
      document.status === 'failed' ? '最近一次索引执行中断，等待重试' : '索引任务已同步到知识工作台'
    ],
    chunks,
    references: [
      {
        id: `${document.id}-ref-1`,
        name: '渡河保障方案研判任务',
        type: '任务',
        description: '在智能分析阶段引用该文档作为背景资料。'
      },
      {
        id: `${document.id}-ref-2`,
        name: '区域专题问答模板',
        type: '分析模板',
        description: '用于生成专题问答时的上下文补充。'
      }
    ]
  };

  return acc;
}, {});

export const knowledgeDocumentDetails = reactive<Record<string, KnowledgeDocumentDetail>>(detailRecords);

export function getCollectionByCategory(category: string) {
  if (category === 'yangtze' || category === 'yellow') return 'basin-core';
  if (category === 'taiwan') return 'coast-theater';
  return 'joint-rules';
}

export function getKnowledgeCollectionByKey(key: string) {
  return knowledgeCollections.find(item => item.key === key) || null;
}

export function getKnowledgeStatusMeta(status: KnowledgeDocumentStatus) {
  switch (status) {
    case 'ready':
      return { label: '可用', type: 'success' as const };
    case 'indexing':
      return { label: '处理中', type: 'warning' as const };
    case 'draft':
      return { label: '草稿', type: 'default' as const };
    case 'failed':
      return { label: '异常', type: 'error' as const };
    default:
      return { label: '未知', type: 'default' as const };
  }
}

export function filterKnowledgeDocuments(params: KnowledgeFilterParams) {
  const normalizedSearch = params.search.trim().toLowerCase();

  const filtered = knowledgeDocuments.filter(item => {
    const matchCollection = params.collection === 'all' || item.collection === params.collection;
    const matchCategory = params.category === 'all' || item.category === params.category;
    const matchSource = !params.source || item.source === params.source;
    const matchStatus = !params.status || item.status === params.status;
    const matchSearch =
      !normalizedSearch ||
      item.name.toLowerCase().includes(normalizedSearch) ||
      item.source.toLowerCase().includes(normalizedSearch) ||
      item.tags.some(tag => tag.toLowerCase().includes(normalizedSearch));

    return matchCollection && matchCategory && matchSource && matchStatus && matchSearch;
  });

  return filtered.sort((left, right) => {
    if (params.sort === 'hits') return right.hits - left.hits;
    if (params.sort === 'chunks') return right.chunkCount - left.chunkCount;
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

export function getKnowledgeDocumentDetailById(id: string) {
  return knowledgeDocumentDetails[id] || null;
}

function createChunks(document: KnowledgeDocument) {
  return Array.from({ length: Math.min(document.chunkCount, 4) }).map((_, index) => ({
    id: `${document.id}-chunk-${index + 1}`,
    order: index + 1,
    title: `Chunk ${index + 1}`,
    content: `${document.summary} 第 ${index + 1} 段重点整理了与 ${document.tags[0] || '专题'}、${document.tags[1] || '资料'} 相关的关键描述，便于在问答与方案生成时快速召回。`,
    keywords: [document.tags[0] || '专题', document.tags[1] || '资料', document.category],
    length: 360 + index * 42,
    status: index === 0 ? 'ready' : 'reviewing',
    type: 'text' as const
  })) as KnowledgeChunk[];
}

function createDetailRecord(document: KnowledgeDocument): KnowledgeDocumentDetail {
  return {
    ...document,
    version: 'v1.0',
    language: '中文',
    createdAt: document.indexedAt,
    notes: '当前为前端演示数据，用于模拟文档详情、分块与引用关系。',
    processLogs: [
      '已完成基础元数据抽取',
      `采用${document.indexMode}生成分块`,
      document.status === 'failed' ? '最近一次索引执行中断，等待重试' : '索引任务已同步到知识工作台'
    ],
    chunks: createChunks(document),
    references: [
      {
        id: `${document.id}-ref-1`,
        name: '渡河保障方案研判任务',
        type: '任务',
        description: '在智能分析阶段引用该文档作为背景资料。'
      },
      {
        id: `${document.id}-ref-2`,
        name: '区域专题问答模板',
        type: '分析模板',
        description: '用于生成专题问答时的上下文补充。'
      }
    ]
  };
}

export function createKnowledgeDocument(
  payload: Omit<KnowledgeDocument, 'id' | 'chunkCount' | 'hits' | 'indexedAt' | 'updatedAt' | 'lastUsedAt' | 'status'>
) {
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const document: KnowledgeDocument = {
    id: `doc-${Date.now()}`,
    chunkCount: 6,
    hits: 0,
    indexedAt: now,
    updatedAt: now,
    lastUsedAt: now,
    status: 'indexing',
    ...payload
  };

  knowledgeDocuments.unshift(document);
  knowledgeDocumentDetails[document.id] = createDetailRecord(document);

  return document;
}

export function createImageKnowledgeDocument(
  payload: {
    name: string;
    category: string;
    source: string;
    tags: string[];
    summary: string;
    segmentModel: string;
    extractModel: string;
    imageFiles: { name: string; size: number }[];
  }
) {
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const regionCount = 3 + Math.floor(Math.random() * 3); // 3-5 regions
  const totalSize = payload.imageFiles.reduce((sum, f) => sum + f.size, 0);
  const sizeMB = (totalSize / (1024 * 1024)).toFixed(1);

  const document: KnowledgeDocument = {
    id: `doc-${Date.now()}`,
    name: payload.name,
    collection: getCollectionByCategory(payload.category),
    category: payload.category,
    source: payload.source || '图片上传',
    reviewer: '当前用户',
    tags: [...payload.tags],
    summary: payload.summary,
    format: 'IMAGE',
    size: `${sizeMB} MB`,
    chunkCount: regionCount,
    hits: 0,
    indexedAt: now,
    updatedAt: now,
    lastUsedAt: now,
    status: 'indexing',
    indexMode: '图片分割'
  };

  // Generate image-region chunks
  const shuffledTemplates = [...imageRegionTemplates].sort(() => Math.random() - 0.5);
  const chunks: KnowledgeChunk[] = Array.from({ length: regionCount }).map((_, index) => {
    const template = shuffledTemplates[index % shuffledTemplates.length];
    const confidence = +(0.6 + Math.random() * 0.35).toFixed(2);
    return {
      id: `${document.id}-chunk-${index + 1}`,
      order: index + 1,
      title: template.title,
      content: template.content,
      keywords: [payload.tags[0] || '图片要素', payload.tags[1] || template.title, payload.category],
      length: template.content.length,
      status: confidence > 0.8 ? 'ready' : 'reviewing',
      type: 'image-region' as const,
      regionIndex: index + 1,
      confidence
    };
  });

  const detail: KnowledgeDocumentDetail = {
    ...document,
    version: 'v1.0',
    language: '中文',
    createdAt: now,
    notes: `图片导入，共 ${payload.imageFiles.length} 张图片，分割模型 ${payload.segmentModel}，提取模型 ${payload.extractModel}。`,
    processLogs: [
      '已完成图片文件接收',
      `采用${payload.segmentModel}执行区域分割，检测到 ${regionCount} 个区域`,
      `采用${payload.extractModel}提取区域要素描述`,
      '索引任务已同步到知识工作台'
    ],
    chunks,
    references: [],
    imageSource: payload.imageFiles.map(f => f.name).join(', '),
    segmentModel: payload.segmentModel,
    extractModel: payload.extractModel,
    regionCount
  };

  knowledgeDocuments.unshift(document);
  knowledgeDocumentDetails[document.id] = detail;

  return document;
}

export function updateKnowledgeDocument(payload: KnowledgeEditFormModel) {
  const target = knowledgeDocuments.find(item => item.id === payload.id);
  const detail = knowledgeDocumentDetails[payload.id];

  if (!target || !detail) return null;

  target.name = payload.name;
  target.collection = getCollectionByCategory(payload.category);
  target.category = payload.category;
  target.source = payload.source;
  target.reviewer = payload.reviewer;
  target.tags = [...payload.tags];
  target.summary = payload.summary;
  target.updatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');

  Object.assign(detail, target, {
    summary: payload.summary,
    tags: [...payload.tags],
    processLogs: ['已更新文档元数据', ...detail.processLogs.slice(0, 2)],
    chunks: createChunks(target)
  });

  return target;
}

export function removeKnowledgeDocument(id: string) {
  const index = knowledgeDocuments.findIndex(item => item.id === id);
  if (index === -1) return false;

  knowledgeDocuments.splice(index, 1);
  delete knowledgeDocumentDetails[id];

  return true;
}

export function createKnowledgeCollection(payload: KnowledgeCollectionFormModel) {
  const key = payload.key || `collection-${Date.now()}`;
  const collection: KnowledgeCollection = {
    key,
    label: payload.label,
    description: payload.description,
    group: payload.group
  };

  knowledgeCollections.push(collection);
  return collection;
}

export function updateKnowledgeCollection(payload: Required<KnowledgeCollectionFormModel>) {
  const target = knowledgeCollections.find(item => item.key === payload.key);
  if (!target || target.key === 'all') return null;

  target.label = payload.label;
  target.description = payload.description;
  target.group = payload.group;

  return target;
}

export function removeKnowledgeCollection(key: string) {
  if (key === 'all') return { success: false, reason: 'default' as const };

  const hasDocuments = knowledgeDocuments.some(item => item.collection === key);
  if (hasDocuments) return { success: false, reason: 'has-documents' as const };

  const index = knowledgeCollections.findIndex(item => item.key === key);
  if (index === -1) return { success: false, reason: 'missing' as const };

  knowledgeCollections.splice(index, 1);
  return { success: true as const };
}

export function runKnowledgeRetrieval(query: string): KnowledgeRetrievalResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const tokens = normalized.split(/\s+/).filter(Boolean);

  return knowledgeDocuments
    .map(document => {
      const detail = knowledgeDocumentDetails[document.id];
      if (!detail) return null;

      const matches = detail.chunks
        .map(chunk => {
          const haystack =
            `${document.name} ${document.summary} ${chunk.content} ${chunk.keywords.join(' ')}`.toLowerCase();
          const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
          if (!score) return null;

          const snippetStart = Math.max(chunk.content.toLowerCase().indexOf(tokens[0]) - 12, 0);
          const snippet = chunk.content.slice(snippetStart, snippetStart + 88);

          return {
            documentId: document.id,
            chunkId: chunk.id,
            chunkTitle: chunk.title,
            snippet,
            score
          } satisfies KnowledgeRetrievalMatch;
        })
        .filter((item): item is KnowledgeRetrievalMatch => Boolean(item))
        .sort((left, right) => right.score - left.score);

      if (!matches.length) return null;

      return {
        document,
        matches: matches.slice(0, 3)
      } satisfies KnowledgeRetrievalResult;
    })
    .filter((item): item is KnowledgeRetrievalResult => Boolean(item))
    .sort((left, right) => right.matches[0].score - left.matches[0].score);
}
