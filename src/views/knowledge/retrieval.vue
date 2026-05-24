<script setup lang="ts">
import { computed, ref } from 'vue';
import { knowledgeCategories, knowledgeCollections, runKnowledgeRetrieval } from '@/mock/knowledge';

defineOptions({
  name: 'KnowledgeRetrievalPage'
});

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
  <div class="retrieval-page">
    <NCard :bordered="false" class="search-card">
      <div class="text-18px font-700 text-[#f8fafc]">检索测试</div>
      <div class="mt-6px text-13px text-[#94a3b8]">输入问题或关键词，快速验证知识库目前能召回哪些文档和分块。</div>

      <div class="mt-16px flex flex-wrap items-center gap-10px">
        <NInput
          v-model:value="query"
          class="max-w-620px flex-1"
          placeholder="请输入问题，例如：台湾方向有哪些港口岸线保障资料？"
        />
        <NButton type="primary" @click="runSearch()">开始检索</NButton>
      </div>

      <div class="mt-12px flex flex-wrap gap-8px">
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
    </NCard>

    <NCard :bordered="false" class="result-card">
      <template #header>
        <div class="flex items-center justify-between gap-12px">
          <div>
            <div class="text-16px font-600 text-[#f8fafc]">召回结果</div>
            <div class="mt-4px text-12px text-[#94a3b8]">
              已命中 {{ results.length }} 篇文档，{{ resultCount }} 条分块结果。
            </div>
          </div>
          <NTag size="small" round type="primary" :bordered="false">{{ searched ? '已检索' : '预置演示' }}</NTag>
        </div>
      </template>

      <div v-if="results.length" class="flex flex-col gap-12px">
        <div v-for="item in results" :key="item.document.id" class="result-item">
          <div class="flex flex-wrap items-start justify-between gap-12px">
            <div>
              <div class="text-15px font-600 text-[#f8fafc]">{{ item.document.name }}</div>
              <div class="mt-6px flex flex-wrap gap-6px">
                <NTag size="small" round :bordered="false">{{ getCollectionLabel(item.document.collection) }}</NTag>
                <NTag size="small" round :bordered="false">{{ getCategoryLabel(item.document.category) }}</NTag>
                <NTag size="small" round type="success" :bordered="false">{{ item.document.indexMode }}</NTag>
              </div>
            </div>
            <div class="text-12px text-[#8ea3bd]">{{ item.document.updatedAt }}</div>
          </div>

          <div class="mt-12px flex flex-col gap-10px">
            <div v-for="match in item.matches" :key="match.chunkId" class="match-card">
              <div class="flex items-center justify-between gap-10px">
                <div class="text-13px font-600 text-[#dbeafe]">{{ match.chunkTitle }}</div>
                <NTag size="small" round type="warning" :bordered="false">匹配度 {{ match.score }}</NTag>
              </div>
              <div class="mt-8px text-13px leading-22px text-[#cbd5e1]">{{ match.snippet }}...</div>
            </div>
          </div>
        </div>
      </div>

      <NEmpty v-else description="未命中可用结果" class="py-24px" />
    </NCard>
  </div>
</template>

<style scoped>
.retrieval-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-card,
.result-card {
  border-radius: 20px;
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 30%),
    linear-gradient(135deg, rgba(15, 23, 42, 0.88), rgba(30, 41, 59, 0.82));
}

.query-tag {
  cursor: pointer;
  background: rgba(59, 130, 246, 0.14);
  color: #c9defd;
}

.result-item {
  padding: 16px 18px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(15, 23, 42, 0.34);
}

.match-card {
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(30, 41, 59, 0.74);
}
</style>
