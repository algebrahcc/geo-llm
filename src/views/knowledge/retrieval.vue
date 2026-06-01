<script setup lang="ts">
import { computed, ref } from 'vue';
import { useThemeStore } from '@/store/modules/theme';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { knowledgeCategories, knowledgeCollections, runKnowledgeRetrieval } from '@/mock/knowledge';

defineOptions({
  name: 'KnowledgeRetrievalPage'
});

const themeStore = useThemeStore();
const darkMode = computed(() => themeStore.darkMode);

const query = ref('台湾 港口 岸线');
const searched = ref(false);
const results = ref(runKnowledgeRetrieval(query.value));

const quickQueries = ['台湾 港口 岸线', '堤防 风险 保障', '术语 模板 提示词'];

const resultCount = computed(() => results.value.reduce((total, item) => total + item.matches.length, 0));

function runSearch(text: string = query.value) {
  query.value = text;
  searched.value = true;
  results.value = runKnowledgeRetrieval(text);
}

function getCategoryLabel(key: string) {
  return knowledgeCategories.find(item => item.key === key)?.label || key;
}

function getCollectionLabel(key: string) {
  return knowledgeCollections.find(item => item.key === key)?.label || key;
}
</script>

<template>
  <div class="retrieval-page" :class="{ 'retrieval-page--dark': darkMode }">
    <div class="retrieval-shell">
      <div class="panel-surface">
        <div class="panel-head">
          <SvgIcon icon="mdi:magnify" class="panel-head__icon" />
          <span class="panel-head__title">检索测试</span>
        </div>
        <div class="panel-body">
          <div class="section-title">输入问题或关键词</div>
          <div class="section-desc">快速验证知识库目前能召回哪些文档和分块。</div>

          <div class="mt-14px flex flex-wrap items-center gap-8px">
            <NInput
              v-model:value="query"
              class="max-w-580px flex-1"
              placeholder="请输入问题，例如：台湾方向有哪些港口岸线保障资料？"
            />
            <NButton type="primary" @click="runSearch()">开始检索</NButton>
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
          <NTag size="small" round type="primary" :bordered="false" class="ml-auto">{{ searched ? '已检索' : '预置演示' }}</NTag>
        </div>
        <div class="panel-body">
          <div class="text-12px text-[rgba(147,196,255,0.5)] mb-10px">
            已命中 {{ results.length }} 篇文档，{{ resultCount }} 条分块结果。
          </div>

          <div v-if="results.length" class="flex flex-col gap-10px">
            <div v-for="item in results" :key="item.document.id" class="result-item">
              <div class="flex flex-wrap items-start justify-between gap-10px">
                <div>
                  <div class="card-title">{{ item.document.name }}</div>
                  <div class="mt-4px flex flex-wrap gap-4px">
                    <NTag size="small" round :bordered="false">{{ getCollectionLabel(item.document.collection) }}</NTag>
                    <NTag size="small" round :bordered="false">{{ getCategoryLabel(item.document.category) }}</NTag>
                    <NTag size="small" round type="success" :bordered="false">{{ item.document.indexMode }}</NTag>
                  </div>
                </div>
                <div class="text-11px text-[rgba(147,196,255,0.5)]">{{ item.document.updatedAt }}</div>
              </div>

              <div class="mt-10px flex flex-col gap-8px">
                <div v-for="match in item.matches" :key="match.chunkId" class="match-card">
                  <div class="flex items-center justify-between gap-8px">
                    <div class="match-title">{{ match.chunkTitle }}</div>
                    <NTag size="small" round type="warning" :bordered="false">匹配度 {{ match.score }}</NTag>
                  </div>
                  <div class="match-snippet">{{ match.snippet }}...</div>
                </div>
              </div>
            </div>
          </div>

          <NEmpty v-else description="未命中可用结果" class="py-20px" />
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
  box-shadow: 0 0 0 1px rgba(32, 111, 202, 0.22), 0 18px 40px rgba(1, 8, 18, 0.45);
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
