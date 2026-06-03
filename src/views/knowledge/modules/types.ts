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
}
