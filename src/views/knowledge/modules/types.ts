/**
 * 知识库模块类型定义
 *
 * 所有类型统一在此文件维护。
 * src/mock/knowledge.ts 会从这里 re-export，以保持现有导入路径的向后兼容。
 */

import type { EnvironmentParameter } from '@/mock/knowledge-parameters';

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

/** 模块引用标识 */
export type ModuleRef = 'river' | 'planning' | 'knowledge' | 'agent';

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
}

export interface KnowledgeReference {
  id: string;
  name: string;
  type: '任务' | '专题' | '分析模板';
  description: string;
  /** 引用模块：river=渡河, planning=规划, knowledge=知识库, agent=智能体 */
  module?: 'river' | 'planning' | 'knowledge' | 'agent';
  /** 可跳转的路由名称 */
  route?: string;
}

export interface KnowledgeDocumentDetail extends KnowledgeDocument {
  version: string;
  language: string;
  createdAt: string;
  notes: string;
  processLogs: string[];
  chunks: KnowledgeChunk[];
  references: KnowledgeReference[];
  parameters?: EnvironmentParameter[];
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
  /** 0-1 浮点相似度 */
  similarity: number;
  /** 检索方法 */
  method: 'vector' | 'bm25' | 'hybrid';
  /** snippet 中命中关键词的起止区间 */
  highlightRanges: [number, number][];
}
