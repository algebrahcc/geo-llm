import type {
  KnowledgeCollection,
  KnowledgeDocument,
  KnowledgeDocumentDetail,
  KnowledgeDocumentMetadata,
  KnowledgeDatasetMetadata,
  KnowledgeRetrievalMatch,
  KnowledgeDocumentStatus
} from './types';

type FlatResult<T = unknown> =
  | {
      data?: T | null;
      error?: unknown;
      response?: {
        data?: unknown;
      };
    }
  | null
  | undefined;

export function extractPayload<T = unknown>(result: FlatResult<T>): T | unknown | null {
  if (result?.data != null) return result.data;
  return result?.response?.data ?? null;
}

export function asList<T>(payload: unknown): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as T[];
  if (typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

export function parseMetaJson(metaJson?: string | null): Record<string, unknown> {
  if (!metaJson) return {};
  try {
    const parsed = JSON.parse(metaJson);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function getDatasetId(dataset: Api.Knowledge.Dataset): string {
  const value = dataset.id ?? dataset.dataset_id ?? dataset.datasetId ?? '';
  return String(value);
}

export function getDatasetName(dataset: Api.Knowledge.Dataset): string {
  const value = dataset.name ?? dataset.dataset_name ?? dataset.datasetName ?? '';
  return String(value || getDatasetId(dataset));
}

export function getDatasetDescription(dataset: Api.Knowledge.Dataset): string {
  const value = dataset.description ?? dataset.desc ?? '';
  return String(value);
}

export function getDatasetDocumentCount(dataset: Api.Knowledge.Dataset): number {
  const value = dataset.document_count ?? dataset.documentCount ?? dataset.documentsCount ?? 0;
  return Number(value) || 0;
}

export function buildDatasetCollections(
  datasets: Api.Knowledge.Dataset[],
  documents: KnowledgeDocument[]
): KnowledgeCollection[] {
  return [
    {
      key: 'all',
      label: '全部集合',
      description: '查看所有知识文档与条目',
      group: '总览'
    },
    ...datasets.map(dataset => {
      const key = getDatasetId(dataset);
      const count = getDatasetDocumentCount(dataset) || documents.filter(item => item.collection === key).length;
      const description = getDatasetDescription(dataset) || `已接入 ${count} 篇文档`;
      return {
        key,
        label: getDatasetName(dataset),
        description,
        group: '知识集合'
      };
    })
  ];
}

export function normalizeKnowledgeStatus(status?: string): KnowledgeDocument['status'] {
  const statusMap: Record<string, KnowledgeDocument['status']> = {
    indexing: 'indexing',
    queuing: 'indexing',
    enabled: 'ready',
    available: 'ready',
    success: 'ready',
    completed: 'ready',
    error: 'failed',
    failed: 'failed',
    disabled: 'draft',
    draft: 'draft',
    paused: 'draft'
  };

  return statusMap[(status || '').toLowerCase()] || 'ready';
}

export function inferKnowledgeFormat(name?: string): KnowledgeDocument['format'] {
  const lowerName = (name || '').toLowerCase();
  if (/\.(docx?|doc)$/.test(lowerName)) return 'DOCX';
  if (lowerName.endsWith('.md')) return 'MD';
  if (lowerName.endsWith('.txt')) return 'TXT';
  if (/\.(png|jpe?g|gif|webp|bmp|tiff?)$/.test(lowerName)) return 'IMAGE';
  return 'PDF';
}

export function mapKbDocToKnowledgeDocument(
  doc: Api.Knowledge.Document,
  datasets: Api.Knowledge.Dataset[] = []
): KnowledgeDocument {
  const meta = parseMetaJson(doc.metaJson);
  const dataset = datasets.find(item => getDatasetId(item) === String(doc.difyDatasetId));
  const documentId = String(doc.difyDocumentId || doc.id || '');

  // 取自 Dify doc_metadata：在线编辑回写的业务字段优先覆盖列表展示值
  const docMetaMap = new Map<string, string>();
  if (Array.isArray(doc.docMetadata)) {
    doc.docMetadata.forEach(item => {
      if (item.name != null) docMetaMap.set(String(item.name), item.value != null ? String(item.value) : '');
    });
  }
  const metaName = docMetaMap.get('name');
  const metaSource = docMetaMap.get('source');
  const metaReviewer = docMetaMap.get('reviewer');
  const metaSummary = docMetaMap.get('summary');
  const metaTags = docMetaMap.get('tags');

  const summary =
    metaSummary != null && metaSummary !== ''
      ? metaSummary
      : String(meta.summary ?? meta.description ?? meta.desc ?? '') ||
        `${doc.name || `文档-${doc.id}`} 已收录到知识库。`;
  const rawTags = meta.tags;
  const tags =
    metaTags != null && metaTags !== ''
      ? metaTags
          .split(',')
          .map(item => item.trim())
          .filter(Boolean)
      : Array.isArray(rawTags)
        ? rawTags.map(item => String(item)).filter(Boolean)
        : String(rawTags || '')
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);
  const reviewer =
    metaReviewer != null && metaReviewer !== '' ? metaReviewer : String(meta.reviewer ?? meta.auditUser ?? '');
  const size = String(meta.size ?? meta.fileSize ?? meta.sizeLabel ?? '--');
  const chunkCount = Number(meta.chunkCount ?? meta.segmentCount ?? meta.chunks ?? 0) || 0;
  const hits = Number(meta.hits ?? meta.hitCount ?? 0) || 0;
  const indexMode = String(meta.indexMode ?? meta.indexingMode ?? '混合切分') as KnowledgeDocument['indexMode'];

  return {
    id: documentId,
    name: metaName || doc.name || `文档-${doc.id}`,
    collection: String(doc.difyDatasetId || (dataset ? getDatasetId(dataset) : 'uncategorized')),
    source: metaSource != null && metaSource !== '' ? metaSource : doc.source || '未知',
    reviewer,
    tags,
    summary,
    format: inferKnowledgeFormat(doc.name),
    size,
    chunkCount,
    hits,
    indexedAt: doc.createTime || '',
    updatedAt: doc.updateTime || doc.createTime || '',
    lastUsedAt: String(meta.lastUsedAt ?? doc.updateTime ?? doc.createTime ?? ''),
    status: normalizeKnowledgeStatus(doc.status),
    indexMode:
      indexMode === '语义分段' || indexMode === '手动分块' || indexMode === '图片分割' ? indexMode : '混合切分',
    moduleRefs: []
  };
}

function normalizeChunkStatus(status?: string): 'ready' | 'reviewing' {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'ready' || normalized === 'completed' || normalized === 'enabled') {
    return 'ready';
  }
  return 'reviewing';
}

function normalizeIndexMode(mode?: string): KnowledgeDocument['indexMode'] {
  return mode === '语义分段' || mode === '手动分块' || mode === '图片分割' ? mode : '混合切分';
}

export function mapKbDetailToKnowledgeDetail(
  detail: Api.Knowledge.DocumentDetail,
  datasets: Api.Knowledge.Dataset[] = []
): KnowledgeDocumentDetail {
  const base = mapKbDocToKnowledgeDocument(detail, datasets);

  const docMetaMap = new Map<string, string>();
  if (Array.isArray(detail.docMetadata)) {
    detail.docMetadata.forEach(item => {
      if (item.name != null) docMetaMap.set(String(item.name), item.value != null ? String(item.value) : '');
    });
  }
  const metaName = docMetaMap.get('name');
  const metaSource = docMetaMap.get('source');
  const metaReviewer = docMetaMap.get('reviewer');
  const metaSummary = docMetaMap.get('summary');
  const metaTags = docMetaMap.get('tags');

  return {
    ...base,
    name: metaName || base.name,
    source: metaSource != null && metaSource !== '' ? metaSource : base.source,
    summary: metaSummary != null && metaSummary !== '' ? metaSummary : String(detail.summary || base.summary),
    reviewer: metaReviewer != null && metaReviewer !== '' ? metaReviewer : String(detail.reviewer || base.reviewer),
    tags:
      metaTags != null && metaTags !== ''
        ? metaTags
            .split(',')
            .map(item => item.trim())
            .filter(Boolean)
        : Array.isArray(detail.tags)
          ? detail.tags.map(item => String(item)).filter(Boolean)
          : base.tags,
    chunkCount: Number(detail.segmentCount ?? base.chunkCount ?? 0) || 0,
    lastUsedAt: String(detail.lastUsedAt || base.lastUsedAt || ''),
    indexMode: normalizeIndexMode(detail.indexMode),
    version: String(detail.version || 'v1.0'),
    language: String(detail.language || 'zh-CN'),
    createdAt: detail.createTime || '',
    notes: String(detail.notes || '当前页面展示知识库中的实时文档详情。'),
    processLogs: Array.isArray(detail.processLogs) ? detail.processLogs.map(item => String(item)) : [],
    chunks: Array.isArray(detail.segments)
      ? detail.segments.map(item => ({
          id: String(item.id),
          order: Number(item.order ?? 0),
          title: String(item.title || `片段 ${Number(item.order ?? 0) + 1}`),
          content: String(item.content || ''),
          keywords: Array.isArray(item.keywords) ? item.keywords.map(keyword => String(keyword)).filter(Boolean) : [],
          length: Number(item.length ?? String(item.content || '').length),
          status: normalizeChunkStatus(item.status),
          type: 'text',
          confidence: item.confidence == null ? undefined : Number(item.confidence),
          enabled: item.enabled == null ? undefined : Boolean(item.enabled)
        }))
      : [],
    references: Array.isArray(detail.references)
      ? detail.references.map(item => ({
          id: String(item.id),
          name: String(item.name || ''),
          type: String(item.type || '关联信息'),
          description: String(item.description || '')
        }))
      : [],
    datasetName: String(detail.datasetName || ''),
    completedSegments: Number(detail.completedSegments ?? 0) || 0,
    tokenCount: detail.tokenCount == null ? null : Number(detail.tokenCount),
    wordCount: detail.wordCount == null ? null : Number(detail.wordCount),
    polling: base.status === 'indexing',
    errorMessage: String(detail.errorMessage || ''),
    metadata: Array.isArray(detail.docMetadata)
      ? detail.docMetadata.map(
          (item): KnowledgeDocumentMetadata => ({
            id: item.id != null ? String(item.id) : undefined,
            name: item.name != null ? String(item.name) : undefined,
            type: item.type != null ? String(item.type) : undefined,
            value: item.value != null ? String(item.value) : ''
          })
        )
      : []
  };
}

/**
 * 将 Dify 元数据字段定义映射为前端模型
 */
export function mapKbDatasetMetadata(items: Api.Knowledge.DatasetMetadata[]): KnowledgeDatasetMetadata[] {
  if (!Array.isArray(items)) return [];
  return items.map(item => ({
    id: String(item.id),
    type: String(item.type || 'string'),
    name: String(item.name || item.id),
    useCount: item.useCount == null ? undefined : Number(item.useCount)
  }));
}

function buildHighlightRanges(snippet: string, query: string): [number, number][] {
  const keywords = query
    .split(/\s+/)
    .map(item => item.trim())
    .filter(Boolean);

  const ranges: [number, number][] = [];
  const lowerSnippet = snippet.toLowerCase();
  keywords.forEach(keyword => {
    const lowerKeyword = keyword.toLowerCase();
    const start = lowerSnippet.indexOf(lowerKeyword);
    if (start >= 0) {
      ranges.push([start, start + keyword.length]);
    }
  });

  return ranges.sort((a, b) => a[0] - b[0]);
}

export function mapKbSearchResults(params: {
  query: string;
  response: Api.Knowledge.SearchResp;
  documents: Api.Knowledge.Document[];
  datasets: Api.Knowledge.Dataset[];
  method: KnowledgeRetrievalMatch['method'];
}) {
  const { query, response, documents, datasets, method } = params;
  const docMap = new Map(documents.map(item => [String(item.id), item]));
  const grouped = new Map<
    string,
    {
      document: KnowledgeDocument;
      matches: KnowledgeRetrievalMatch[];
    }
  >();

  response.hits.forEach((hit, index) => {
    const doc = docMap.get(String(hit.docId));
    const mappedDocument = doc
      ? mapKbDocToKnowledgeDocument(doc, datasets)
      : {
          id: String(hit.docId),
          name: hit.docName || `文档-${hit.docId}`,
          collection: 'uncategorized',
          source: hit.source || '知识检索',
          reviewer: '',
          tags: [],
          summary: hit.content.slice(0, 120),
          format: 'TXT' as const,
          size: '--',
          chunkCount: 0,
          hits: 0,
          indexedAt: '',
          updatedAt: '',
          lastUsedAt: '',
          status: 'ready' as const,
          indexMode: '混合切分' as const,
          moduleRefs: []
        };

    const current = grouped.get(String(hit.docId)) || { document: mappedDocument, matches: [] };
    current.matches.push({
      documentId: String(hit.docId),
      chunkId: String(hit.chunkId),
      chunkTitle: `片段 ${index + 1}`,
      snippet: hit.content,
      score: hit.score,
      similarity: Math.max(0, Math.min(1, hit.score)),
      method,
      highlightRanges: buildHighlightRanges(hit.content, query)
    });
    grouped.set(String(hit.docId), current);
  });

  return Array.from(grouped.values()).sort((a, b) => {
    const scoreA = Math.max(...a.matches.map(item => item.score), 0);
    const scoreB = Math.max(...b.matches.map(item => item.score), 0);
    return scoreB - scoreA;
  });
}

const KNOWLEDGE_STATUS_META: Record<
  KnowledgeDocumentStatus,
  { label: string; type: 'warning' | 'success' | 'error' | 'default'; color: string }
> = {
  processing: { label: '处理中', type: 'warning', color: '#ffb84d' },
  indexing: { label: '处理中', type: 'warning', color: '#ffb84d' },
  ready: { label: '已就绪', type: 'success', color: '#3ddc84' },
  draft: { label: '草稿', type: 'default', color: '#8aa2c2' },
  failed: { label: '失败', type: 'error', color: '#ff8d8d' },
  disabled: { label: '已停用', type: 'default', color: '#8aa2c2' }
};

export function getKnowledgeStatusMeta(status: string): {
  label: string;
  type: 'warning' | 'success' | 'error' | 'default';
  color: string;
} {
  const key = (
    ['processing', 'indexing', 'ready', 'draft', 'failed', 'disabled'].includes(status) ? status : 'ready'
  ) as KnowledgeDocumentStatus;
  return KNOWLEDGE_STATUS_META[key];
}

export interface KnowledgeFilterParams {
  collection?: string;
  search?: string;
  source?: string;
  status?: string;
  sort?: 'recent' | 'hits' | 'chunks';
}

export function filterKnowledgeDocuments(
  params: KnowledgeFilterParams,
  source: KnowledgeDocument[] = []
): KnowledgeDocument[] {
  const normalizedSearch = (params.search || '').trim().toLowerCase();

  const filtered = source.filter(item => {
    const matchCollection = params.collection === 'all' || !params.collection || item.collection === params.collection;
    const matchSource = !params.source || params.source === 'all' || item.source === params.source;
    const matchStatus = !params.status || params.status === 'all' || item.status === params.status;
    const matchSearch =
      !normalizedSearch ||
      item.name.toLowerCase().includes(normalizedSearch) ||
      item.source.toLowerCase().includes(normalizedSearch) ||
      item.tags.some(tag => tag.toLowerCase().includes(normalizedSearch));

    return matchCollection && matchSource && matchStatus && matchSearch;
  });

  return filtered.sort((left, right) => {
    if (params.sort === 'hits') return (right.hits || 0) - (left.hits || 0);
    if (params.sort === 'chunks') return (right.chunkCount || 0) - (left.chunkCount || 0);
    return new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
  });
}
