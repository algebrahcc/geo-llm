<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useThemeStore } from '@/store/modules/theme';
import SvgIcon from '@/components/custom/svg-icon.vue';
import type { KnowledgeRetrievalMatch, ModuleRef } from './modules/types';
import { fetchKbDatasets, fetchKbDocuments, searchKb } from '@/service/api/knowledge';
import { asList, extractPayload, getDatasetId, getDatasetName, mapKbSearchResults } from './modules/real';

defineOptions({
  name: 'KnowledgeRetrievalPage'
});

const themeStore = useThemeStore();
const darkMode = computed(() => themeStore.darkMode);

type SearchMode = 'keyword' | 'semantic' | 'hybrid';

const query = ref('台湾 港口 岸线');
const searchMode = ref<SearchMode>('keyword');
const loading = ref(false);
const searched = ref(false);
const results = ref<ReturnType<typeof mapKbSearchResults>>([]);
const documents = ref<Api.Knowledge.Document[]>([]);
const datasets = ref<Api.Knowledge.Dataset[]>([]);
const graphCount = ref(0);

const quickQueries = ['台湾 港口 岸线', '堤防 风险 保障', '术语 模板 提示词'];

const retrievalConfigText = computed(() => {
  const ds = datasets.value[0] as Record<string, unknown> | undefined;
  if (!ds) return '暂无数据集';
  const rm = (ds.retrieval_model_dict || ds.retrievalModelDict) as Record<string, unknown> | undefined;
  if (!rm) return '未配置（默认语义检索）';
  const methodMap: Record<string, string> = {
    semantic_search: '语义检索',
    full_text_search: '关键词检索',
    hybrid_search: '混合检索'
  };
  const method = methodMap[String(rm.search_method)] || String(rm.search_method) || '语义检索';
  const topK = rm.top_k ?? '-';
  const threshold = rm.score_threshold_enabled ? (rm.score_threshold ?? 0) : '关闭';
  return `${method} · TopK ${topK} · 阈值 ${threshold}`;
});

const resultCount = computed(() => results.value.reduce((total, item) => total + item.matches.length, 0));

const placeholderText = computed(() => {
  if (searchMode.value === 'semantic') return '请输入自然语言问题，例如：有哪些与渡河相关的水文保障资料？';
  if (searchMode.value === 'hybrid') return '输入关键词或自然语言问题…';
  return '请输入问题，例如：台湾方向有哪些港口岸线保障资料？';
});

const modeLabel = computed(() => {
  switch (searchMode.value) {
    case 'keyword':
      return '关键词检索';
    case 'semantic':
      return '语义检索';
    case 'hybrid':
      return '混合检索';
    default:
      return '关键词检索';
  }
});

async function loadBaseData() {
  try {
    const [docRes, dsRes] = await Promise.all([fetchKbDocuments(), fetchKbDatasets()]);
    if (docRes.error || dsRes.error) {
      const err = (docRes.error || dsRes.error) as { response?: { data?: { msg?: string } }; message?: string };
      window.$message?.error(`加载文档列表失败：${err?.response?.data?.msg || err?.message || '后端错误'}`);
      return;
    }
    documents.value = asList<Api.Knowledge.Document>(extractPayload(docRes));
    datasets.value = asList<Api.Knowledge.Dataset>(extractPayload(dsRes));
  } catch {
    documents.value = [];
    datasets.value = [];
  }
}

async function runSearch(text: string = query.value) {
  query.value = text;
  loading.value = true;
  try {
    if (!documents.value.length) {
      await loadBaseData();
    }
    // 前端检索模式映射到 Dify 检索方式（本地未启用 pgvector，全部走 Dify /retrieve）
    const difyMethod =
      searchMode.value === 'keyword'
        ? 'full_text_search'
        : searchMode.value === 'semantic'
          ? 'semantic_search'
          : 'hybrid_search';
    const res = await searchKb({
      query: text,
      topN: 12,
      searchMethod: difyMethod
    });
    if (res.error) {
      const err = res.error as { response?: { data?: { msg?: string } }; message?: string };
      window.$message?.error(`检索失败：${err?.response?.data?.msg || err?.message || '后端返回错误'}`);
      searched.value = true;
      return;
    }
    const payload = (extractPayload(res) || { hits: [], graph: [] }) as Api.Knowledge.SearchResp;
    searched.value = true;
    graphCount.value = Array.isArray(payload.graph) ? payload.graph.length : 0;
    results.value = mapKbSearchResults({
      query: text,
      response: {
        hits: Array.isArray(payload.hits) ? payload.hits : [],
        graph: Array.isArray(payload.graph) ? payload.graph : []
      },
      documents: documents.value,
      datasets: datasets.value,
      method: searchMode.value === 'keyword' ? 'bm25' : searchMode.value === 'semantic' ? 'vector' : 'hybrid'
    });
    if (results.value.length === 0) {
      window.$message?.info('未命中任何片段，可尝试更换关键词或检索方式');
    }
  } catch {
    searched.value = true;
    graphCount.value = 0;
    results.value = [];
    window.$message?.error('检索失败，请稍后重试');
  } finally {
    loading.value = false;
  }
}

function updateMode(mode: SearchMode) {
  searchMode.value = mode;
  if (searched.value) runSearch();
}

function getCollectionLabel(key: string) {
  const dataset = datasets.value.find(item => getDatasetId(item) === key);
  return dataset ? getDatasetName(dataset) : key;
}

function getSimilarityColor(sim: number): string {
  if (sim > 0.5) return '#5ee8a0';
  if (sim > 0.25) return '#f1c40f';
  return '#ff6b6b';
}

function getMethodMeta(method: KnowledgeRetrievalMatch['method']): {
  label: string;
  type: 'info' | 'default' | 'success';
} {
  switch (method) {
    case 'vector':
      return { label: '向量召回', type: 'info' };
    case 'bm25':
      return { label: 'BM25', type: 'default' };
    case 'hybrid':
      return { label: '混合', type: 'success' };
  }
}

const moduleMeta: Record<ModuleRef, { label: string; color: string; bg: string }> = {
  river: { label: '渡河', color: '#29a3ff', bg: 'rgba(41,163,255,0.12)' },
  planning: { label: '规划', color: '#62e4ff', bg: 'rgba(98,228,255,0.1)' },
  knowledge: { label: '知识', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  agent: { label: '智能体', color: '#f1c40f', bg: 'rgba(241,196,15,0.12)' }
};

function renderHighlightedSnippet(snippet: string, ranges: [number, number][]): string {
  if (!ranges.length) return snippet;
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  let result = '';
  let cursor = 0;
  for (const [start, end] of sorted) {
    if (start > cursor) result += snippet.slice(cursor, start);
    result += `<mark class="snippet-mark">${snippet.slice(start, end)}</mark>`;
    cursor = end;
  }
  if (cursor < snippet.length) result += snippet.slice(cursor);
  return result;
}

onMounted(async () => {
  await loadBaseData();
  await runSearch(query.value);
});
</script>

<template>
  <div class="retrieval-page" :class="{ 'retrieval-page--dark': darkMode }">
    <div class="retrieval-shell">
      <div class="panel-surface">
        <div class="panel-head">
          <SvgIcon icon="mdi:magnify" class="panel-head__icon" />
          <span class="panel-head__title">检索测试</span>
          <NTag size="small" round type="primary" :bordered="false" class="ml-auto">{{ modeLabel }}</NTag>
        </div>
        <div class="panel-body">
          <div class="section-title">测试召回视角</div>
          <div class="section-desc">
            检索策略在「集合管理」中按数据集配置：
            <b>{{ retrievalConfigText }}</b>
            。下方为本次预览视角，不会修改已配置策略。
          </div>

          <div class="mt-12px flex flex-wrap items-center gap-10px">
            <NRadioGroup :value="searchMode" @update:value="updateMode">
              <NRadio value="keyword">关键词检索</NRadio>
              <NRadio value="semantic">语义检索</NRadio>
              <NRadio value="hybrid">混合检索</NRadio>
            </NRadioGroup>
            <span v-if="searchMode === 'hybrid'" class="mode-hint">综合关键词与语义召回</span>
          </div>

          <div class="mt-14px flex flex-wrap items-center gap-8px">
            <NInput
              v-model:value="query"
              class="max-w-580px flex-1"
              :placeholder="placeholderText"
              @keydown.enter="runSearch()"
            />
            <NButton type="primary" :loading="loading" @click="runSearch()">开始检索</NButton>
          </div>

          <div class="mt-10px flex flex-wrap gap-6px">
            <NTag
              v-for="item in quickQueries"
              :key="item"
              size="small"
              round
              :bordered="false"
              class="query-tag"
              @click="runSearch(item)"
            >
              {{ item }}
            </NTag>
          </div>
        </div>
      </div>

      <div class="panel-surface">
        <div class="panel-head">
          <SvgIcon icon="mdi:format-list-text" class="panel-head__icon" />
          <span class="panel-head__title">召回结果</span>
          <NTag size="small" round type="primary" :bordered="false" class="ml-auto">
            {{ loading ? '检索中…' : searched ? '已检索' : '预置演示' }}
          </NTag>
        </div>
        <div class="panel-body">
          <div v-if="loading" class="result-skeleton">
            <div v-for="n in 3" :key="`sk-${n}`" class="result-item result-item--skeleton">
              <NSkeleton text :repeat="1" :sharp="false" style="max-width: 200px" />
              <div class="flex flex-col gap-8px mt-10px">
                <NSkeleton height="56px" :sharp="false" />
                <NSkeleton height="56px" :sharp="false" />
              </div>
            </div>
          </div>

          <template v-else>
            <div v-if="results.length" class="text-12px text-[rgba(147,196,255,0.5)] mb-10px">
              已命中 {{ results.length }} 篇文档，{{ resultCount }} 条分块结果，{{ graphCount }} 个图谱节点。
            </div>

            <div v-if="results.length" class="flex flex-col gap-10px">
              <div v-for="item in results" :key="item.document.id" class="result-item">
                <div class="flex flex-wrap items-start justify-between gap-10px">
                  <div class="flex flex-wrap items-center gap-6px">
                    <SvgIcon icon="mdi:file-document-outline" class="result-item__icon" />
                    <div class="card-title">{{ item.document.name }}</div>
                    <span
                      v-for="ref in item.document.moduleRefs"
                      :key="ref"
                      class="module-badge"
                      :style="{
                        color: moduleMeta[ref].color,
                        background: moduleMeta[ref].bg,
                        borderColor: moduleMeta[ref].color + '44'
                      }"
                    >
                      {{ moduleMeta[ref].label }}
                    </span>
                  </div>
                  <div class="text-11px text-[rgba(147,196,255,0.5)]">{{ item.document.updatedAt }}</div>
                </div>
                <div class="mt-4px flex flex-wrap gap-4px">
                  <NTag size="small" round :bordered="false">{{ getCollectionLabel(item.document.collection) }}</NTag>
                  <NTag size="small" round type="success" :bordered="false">{{ item.document.indexMode }}</NTag>
                </div>

                <div class="mt-10px flex flex-col gap-8px">
                  <div v-for="match in item.matches" :key="match.chunkId" class="match-card">
                    <div class="flex items-center justify-between gap-8px">
                      <div class="match-title">{{ match.chunkTitle }}</div>
                      <div class="flex items-center gap-6px">
                        <div class="similarity-bar">
                          <span
                            class="similarity-bar__fill"
                            :style="{
                              width: (match.similarity * 100).toFixed(0) + '%',
                              background: getSimilarityColor(match.similarity)
                            }"
                          ></span>
                        </div>
                        <span class="similarity-text" :style="{ color: getSimilarityColor(match.similarity) }">
                          {{ (match.similarity * 100).toFixed(0) }}%
                        </span>
                        <NTag
                          size="small"
                          round
                          :bordered="false"
                          :type="getMethodMeta(match.method).type"
                          class="method-tag"
                        >
                          {{ getMethodMeta(match.method).label }}
                        </NTag>
                      </div>
                    </div>
                    <div
                      class="match-snippet"
                      v-html="renderHighlightedSnippet(match.snippet, match.highlightRanges) + '…'"
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <NEmpty v-else-if="searched" description="未命中可用结果" class="py-20px">
              <template #extra>
                <span class="text-12px text-[rgba(147,196,255,0.45)]">尝试切换为语义检索以扩大召回范围</span>
              </template>
            </NEmpty>
            <NEmpty v-else description="输入关键词开始检索" class="py-20px" />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.retrieval-page {
  --page-bg:
    radial-gradient(circle at top, rgba(0, 153, 255, 0.14) 0%, rgba(0, 0, 0, 0) 36%),
    linear-gradient(180deg, #041528 0%, #041120 38%, #03101b 100%);
  --surface-bg: linear-gradient(180deg, rgba(3, 19, 41, 0.94) 0%, rgba(2, 15, 32, 0.96) 100%);
  --surface-border: rgba(43, 131, 255, 0.28);
  --line: rgba(25, 95, 176, 0.35);
  --accent: #29a3ff;
  --text-primary: #eaf5ff;
  --text-secondary: rgba(203, 227, 255, 0.72);
  --text-tertiary: rgba(147, 196, 255, 0.62);

  height: 100%;
  background: var(--page-bg);
  color: var(--text-primary);
  overflow: auto;
}

.retrieval-page--dark {
  color-scheme: dark;
}

.retrieval-shell {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Shared panel surface */
.panel-surface {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  box-shadow:
    0 0 0 1px rgba(32, 111, 202, 0.22),
    0 18px 40px rgba(1, 8, 18, 0.45);
  border-radius: 4px;
  position: relative;
}

.panel-surface::before,
.panel-surface::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  pointer-events: none;
  z-index: 2;
  opacity: 0.35;
}

.panel-surface::before {
  top: -1px;
  left: -1px;
  border-top: 2px solid var(--accent);
  border-left: 2px solid var(--accent);
  border-radius: 4px 0 0 0;
}

.panel-surface::after {
  bottom: -1px;
  right: -1px;
  border-bottom: 2px solid var(--accent);
  border-right: 2px solid var(--accent);
  border-radius: 0 0 4px 0;
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 14px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(10, 38, 72, 0.96) 0%, rgba(5, 25, 47, 0.96) 100%);
  position: relative;
}

.panel-head::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  bottom: 20%;
  width: 2px;
  border-radius: 1px;
  background: linear-gradient(180deg, transparent, var(--accent), transparent);
  opacity: 0.5;
}

.panel-head__icon {
  font-size: 16px;
  color: var(--accent);
  filter: drop-shadow(0 0 4px rgba(41, 163, 255, 0.25));
}

.panel-head__title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-shadow: 0 0 8px rgba(41, 163, 255, 0.12);
}

.panel-body {
  padding: 14px;
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.section-desc {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.query-tag {
  cursor: pointer;
  background: rgba(41, 163, 255, 0.1);
  border: 1px solid rgba(41, 163, 255, 0.22);
  color: rgba(203, 227, 255, 0.82);
}

.card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.result-item {
  padding: 12px 14px;
  border-radius: 4px;
  border: 1px solid rgba(25, 95, 176, 0.18);
  background: rgba(6, 20, 38, 0.5);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.result-item:not(.result-item--skeleton):hover {
  border-color: rgba(41, 163, 255, 0.45);
  box-shadow:
    0 0 0 1px rgba(41, 163, 255, 0.3),
    0 12px 28px rgba(1, 8, 18, 0.4);
  transform: translateY(-2px);
}

.result-item__icon {
  font-size: 15px;
  color: var(--accent);
  flex-shrink: 0;
}

.result-skeleton {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.match-card {
  padding: 10px 12px;
  border-radius: 4px;
  background: rgba(12, 38, 72, 0.4);
  border: 1px solid rgba(25, 95, 176, 0.12);
}

.match-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(41, 163, 255, 0.85);
}

.match-snippet {
  margin-top: 6px;
  font-size: 12px;
  line-height: 20px;
  color: var(--text-secondary);
}

/* ── 检索模式提示 ── */
.mode-hint {
  font-size: 11px;
  color: rgba(147, 196, 255, 0.45);
  font-style: italic;
}

/* ── 关联模块徽章 ── */
.module-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.3px;
  border: 1px solid;
}

/* ── 相似度进度条 ── */
.similarity-bar {
  width: 48px;
  height: 5px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}
.similarity-bar__fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  transition: width 0.35s ease;
  min-width: 2px;
}
.similarity-text {
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  min-width: 32px;
}

/* ── 召回方式徽章 ── */
.method-tag {
  font-size: 10px;
  opacity: 0.85;
}

/* ── Snippet 高亮 ── */
:deep(.snippet-mark) {
  background: rgba(41, 163, 255, 0.22);
  color: #eaf5ff;
  border-radius: 2px;
  padding: 0 1px;
}

/* Scrollbar */
.retrieval-page::-webkit-scrollbar {
  width: 8px;
}

.retrieval-page::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(48, 127, 212, 0.45);
}

.retrieval-page::-webkit-scrollbar-track {
  background: transparent;
}
</style>
