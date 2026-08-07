import { reactive } from 'vue';

import type {
  KnowledgeDocument,
  KnowledgeChunk,
  KnowledgeDocumentDetail,
  KnowledgeRetrievalMatch
} from '@/views/knowledge/modules/types';

export interface KnowledgeRetrievalResult {
  document: KnowledgeDocument;
  matches: KnowledgeRetrievalMatch[];
}

export const knowledgeDocuments = reactive<KnowledgeDocument[]>([
  {
    id: 'doc-001',
    name: '长江流域地形地貌综合判读手册',
    collection: 'basin-core',
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
    indexMode: '混合切分',
    moduleRefs: ['planning']
  },
  {
    id: 'doc-002',
    name: '黄河下游堤防风险评估摘要',
    collection: 'basin-core',
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
    indexMode: '语义分段',
    moduleRefs: ['river']
  },
  {
    id: 'doc-003',
    name: '台湾东部岸线港口保障专题',
    collection: 'coast-theater',
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
    indexMode: '混合切分',
    moduleRefs: ['river', 'planning']
  },
  {
    id: 'doc-004',
    name: '联合术语词表与提示模板',
    collection: 'joint-rules',
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
    indexMode: '手动分块',
    moduleRefs: ['knowledge', 'agent']
  },
  {
    id: 'doc-005',
    name: '跨流域水文事件比对记录',
    collection: 'event-briefing',
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
    indexMode: '语义分段',
    moduleRefs: ['river']
  },
  {
    id: 'doc-006',
    name: '台湾西岸地面交通节点汇编',
    collection: 'coast-theater',
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
    indexMode: '混合切分',
    moduleRefs: ['planning']
  }
]);

const detailRecords = knowledgeDocuments.reduce<Record<string, KnowledgeDocumentDetail>>((acc, document) => {
  const chunks: KnowledgeChunk[] = Array.from({ length: Math.min(document.chunkCount, 4) }).map((_, index) => ({
    id: `${document.id}-chunk-${index + 1}`,
    order: index + 1,
    title: `Chunk ${index + 1}`,
    content: `${document.summary} 第 ${index + 1} 段重点整理了与 ${document.tags[0]}、${document.tags[1]} 相关的关键描述，便于在问答与方案生成时快速召回。`,
    keywords: [document.tags[0], document.tags[1]],
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
        description: '在智能分析阶段引用该文档作为背景资料进行河床、堤防等要素判读。',
        module: 'river' as const,
        route: 'river_overview'
      },
      {
        id: `${document.id}-ref-2`,
        name: '区域专题问答模板',
        type: '分析模板',
        description: '用于生成专题问答时的上下文补充与术语对齐。',
        module: 'knowledge' as const,
        route: 'knowledge_index'
      },
      {
        id: `${document.id}-ref-3`,
        name: '机动规划路线比选',
        type: '专题',
        description: '参考该文档的地形、交通节点信息进行路线可行性评估。',
        module: 'planning' as const,
        route: 'planning_index'
      }
    ]
  };

  return acc;
}, {});

export const knowledgeDocumentDetails = reactive<Record<string, KnowledgeDocumentDetail>>(detailRecords);

// ── 语义簇映射：用于模拟向量语义检索 ──
const semanticClusters: Record<string, string[]> = {
  水深: ['渡河', '水文', '河宽', '流速', '河道', '堤防', '水位'],
  岸线: ['港口', '海岸', '滩涂', '登陆', '沙滩', '礁石', '潮汐'],
  港口: ['岸线', '码头', '泊位', '装卸', '物资', '运输', '航道'],
  渡河: ['水深', '流速', '河床', '堤防', '架桥', '保障', '水文', '抢滩'],
  地形: ['地貌', '高程', '坡度', '山脊', '沟谷', '丘陵', '判读'],
  交通: ['道路', '节点', '桥梁', '公路', '铁路', '枢纽', '路线'],
  堤防: ['防洪', '风险', '险段', '加固', '抢险', '溃堤', '巡查'],
  水文: ['流量', '水位', '汛期', '降雨', '径流', '洪水', '水量'],
  保障: ['物资', '装备', '后勤', '供应', '储运', '调度', '支援'],
  模板: ['术语', '提示词', '标准', '规则', '联合', '模板', '问答'],
  风险: ['隐患', '预警', '评估', '脆弱性', '威胁', '安全', '排查'],
  道路: ['公路', '铁路', '交通', '桥梁', '隧道', '路口', '干线'],
  台湾: ['港口', '岸线', '东部', '西部', '海峡', '岛屿', '方向'],
  黄河: ['堤防', '风险', '河道', '险段', '抢险', '泥沙'],
  长江: ['流域', '地形', '河网', '岸线', '水系', '中下游']
};

function expandQueryWithSemanticClusters(queryTokens: string[]): string[] {
  const expanded = [...queryTokens];
  for (const token of queryTokens) {
    const cluster = semanticClusters[token];
    if (cluster) {
      for (const related of cluster) {
        if (!expanded.includes(related)) expanded.push(related);
      }
    }
  }
  return expanded;
}

function normalizeScore(rawScore: number, maxTokens: number): number {
  if (maxTokens <= 0) return 0;
  // 归一化到 0-1，加入随机扰动模拟真实效果
  return Math.min(0.99, +(rawScore / maxTokens + Math.random() * 0.15).toFixed(4));
}

function computeHighlightRanges(snippet: string, searchTokens: string[]): [number, number][] {
  const lowerSnippet = snippet.toLowerCase();
  const ranges: [number, number][] = [];
  for (const token of searchTokens) {
    if (!token) continue;
    let idx = 0;
    while (idx < lowerSnippet.length) {
      const pos = lowerSnippet.indexOf(token, idx);
      if (pos === -1) break;
      // 合并重叠/相邻区间
      const end = pos + token.length;
      let merged = false;
      for (let i = 0; i < ranges.length; i++) {
        const [s, e] = ranges[i];
        if (pos <= e + 2 && end >= s - 2) {
          ranges[i] = [Math.min(s, pos), Math.max(e, end)];
          merged = true;
          break;
        }
      }
      if (!merged) ranges.push([pos, end]);
      idx = end;
    }
  }
  // 按起始位置排序
  return ranges.sort((a, b) => a[0] - b[0]);
}

export function runKnowledgeRetrieval(
  query: string,
  method: 'keyword' | 'semantic' | 'hybrid' = 'keyword'
): KnowledgeRetrievalResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const tokens = normalized.split(/\s+/).filter(Boolean);
  const maxTokens = tokens.length;

  // ── 语义检索：扩展查询词 ──
  const semanticTokens = method !== 'keyword' ? expandQueryWithSemanticClusters(tokens) : tokens;
  const allSearchTokens =
    method === 'hybrid'
      ? [...new Set([...tokens, ...semanticTokens])]
      : method === 'semantic'
        ? semanticTokens
        : tokens;

  return knowledgeDocuments
    .map(document => {
      const detail = knowledgeDocumentDetails[document.id];
      if (!detail) return null;

      const matches: KnowledgeRetrievalMatch[] = [];

      detail.chunks.forEach(chunk => {
        const haystack =
          `${document.name} ${document.summary} ${chunk.content} ${chunk.keywords.join(' ')} ${document.tags.join(' ')}`.toLowerCase();

        // 关键词/BM25 匹配
        let bm25Raw = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
        const bm25Sim = normalizeScore(bm25Raw, maxTokens);

        // 语义匹配：基于扩展词和 tags/keywords 的语义重叠
        let semanticRaw = 0;
        if (method !== 'keyword') {
          for (const token of semanticTokens) {
            if (haystack.includes(token)) semanticRaw += 0.7;
            if (document.tags.some(t => t.includes(token) || token.includes(t))) semanticRaw += 0.4;
            if (document.summary.toLowerCase().includes(token)) semanticRaw += 0.3;
          }
        }
        const semanticSim = method !== 'keyword' ? normalizeScore(semanticRaw, semanticTokens.length * 1.4) : 0;

        // 综合相似度
        let similarity: number;
        let retrievalMethod: 'vector' | 'bm25' | 'hybrid';

        if (method === 'keyword') {
          similarity = bm25Sim;
          retrievalMethod = 'bm25';
          if (similarity <= 0) return;
        } else if (method === 'semantic') {
          similarity = semanticSim;
          retrievalMethod = 'vector';
          if (similarity <= 0) return;
        } else {
          // hybrid: BM25 40% + vector 60%
          if (bm25Sim <= 0 && semanticSim <= 0) return;
          similarity = +(bm25Sim * 0.4 + semanticSim * 0.6).toFixed(4);
          retrievalMethod = 'hybrid';
        }

        // 生成 snippet
        const snippetStart = Math.max(
          chunk.content.toLowerCase().indexOf(allSearchTokens.find(t => haystack.includes(t)) || tokens[0] || '') - 8,
          0
        );
        const snippet = chunk.content.slice(snippetStart, snippetStart + 82);

        // 高亮区间
        const highlightRanges = computeHighlightRanges(snippet, allSearchTokens);

        matches.push({
          documentId: document.id,
          chunkId: chunk.id,
          chunkTitle: chunk.title,
          snippet,
          score: Math.round(similarity * 10),
          similarity,
          method: retrievalMethod,
          highlightRanges
        });
      });

      if (!matches.length) return null;

      matches.sort((a, b) => b.similarity - a.similarity);

      return {
        document,
        matches: matches.slice(0, 3)
      } satisfies KnowledgeRetrievalResult;
    })
    .filter((item): item is KnowledgeRetrievalResult => Boolean(item))
    .sort((left, right) => right.matches[0].similarity - left.matches[0].similarity);
}
