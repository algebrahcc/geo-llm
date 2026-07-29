/**
 * 知识库模块类型定义
 *
 * 所有类型统一在此文件维护。
 * src/mock/knowledge.ts 会从这里 re-export，以保持现有导入路径的向后兼容。
 */

export type KnowledgeDocumentStatus = 'processing' | 'indexing' | 'ready' | 'draft' | 'failed' | 'disabled';

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
  /** 检索策略（Dify dataset.retrieval_model），在集合管理页配置 */
  searchMethod: 'semantic_search' | 'full_text_search' | 'hybrid_search';
  topK: number;
  scoreThresholdEnabled: boolean;
  scoreThreshold: number;
}

/** 模块引用标识 */
export type ModuleRef = 'river' | 'planning' | 'knowledge' | 'agent';

export interface KnowledgeDocument {
  id: string;
  name: string;
  collection: string;
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
  /** 被哪些模块引用 */
  moduleRefs?: ModuleRef[];
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
  /** 是否启用（Dify segment.enabled） */
  enabled?: boolean;
}

export interface KnowledgeReference {
  id: string;
  name: string;
  type: string;
  description: string;
  /** 引用模块：river=渡河, planning=规划, knowledge=知识库, agent=智能体 */
  module?: 'river' | 'planning' | 'knowledge' | 'agent';
  /** 可跳转的路由名称 */
  route?: string;
}

/** Dify 文档元数据项（来自 doc_metadata） */
export interface KnowledgeDocumentMetadata {
  id?: string;
  name?: string;
  type?: string;
  value?: string;
}

/** 知识库元数据字段定义（来自 Dify GET /datasets/{id}/metadata） */
export interface KnowledgeDatasetMetadata {
  id: string;
  type: string;
  name: string;
  useCount?: number;
}

export interface KnowledgeDocumentDetail extends KnowledgeDocument {
  version: string;
  language: string;
  createdAt: string;
  notes: string;
  processLogs: string[];
  chunks: KnowledgeChunk[];
  references: KnowledgeReference[];
  /** 预留字段：Dify 文档详情不含结构化参数，仅 mock 数据可能携带，前端不渲染 */
  parameters?: unknown[];
  imageSource?: string;
  segmentModel?: string;
  extractModel?: string;
  regionCount?: number;
  datasetName?: string;
  completedSegments?: number;
  tokenCount?: number | null;
  wordCount?: number | null;
  polling?: boolean;
  errorMessage?: string;
  /** 文档元数据（来自 Dify doc_metadata） */
  metadata?: KnowledgeDocumentMetadata[];
}

export interface KnowledgeImportFormModel {
  importType: 'document' | 'image';
  name: string;
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
  source: string;
  reviewer: string;
  tags: string[];
  summary: string;
}

export interface KnowledgeFilterParams {
  collection: string;
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
  /** 0-1 浮点相似度 */
  similarity: number;
  /** 检索方法 */
  method: 'vector' | 'bm25' | 'hybrid';
  /** snippet 中命中关键词的起止区间 */
  highlightRanges: [number, number][];
}
