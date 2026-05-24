<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  getKnowledgeDocumentDetailById,
  getKnowledgeStatusMeta,
  knowledgeCategories,
  removeKnowledgeDocument,
  updateKnowledgeDocument,
  type KnowledgeEditFormModel
} from '@/mock/knowledge';
import KnowledgeEditDrawer from './modules/knowledge-edit-drawer.vue';

defineOptions({
  name: 'KnowledgeDetailPage'
});

const route = useRoute();
const router = useRouter();
const editVisible = ref(false);

const documentId = computed(() => String(route.query.id || ''));
const detail = computed(() => getKnowledgeDocumentDetailById(documentId.value));
const categoryLabel = computed(
  () => knowledgeCategories.find(item => item.key === detail.value?.category)?.label || '--'
);
const statusMeta = computed(() => getKnowledgeStatusMeta(detail.value?.status || 'draft'));

const editModel = computed<KnowledgeEditFormModel | null>(() => {
  if (!detail.value) return null;

  return {
    id: detail.value.id,
    name: detail.value.name,
    category: detail.value.category,
    source: detail.value.source,
    reviewer: detail.value.reviewer,
    tags: [...detail.value.tags],
    summary: detail.value.summary
  };
});

function goBack() {
  router.push({ name: 'knowledge_overview' as never });
}

function handleCopy() {
  if (!detail.value) return;

  navigator.clipboard
    ?.writeText(detail.value.name)
    .then(() => window.$message?.success('文档名称已复制'))
    .catch(() => window.$message?.warning('当前环境不支持复制'));
}

function handleDelete() {
  if (!detail.value) return;

  window.$dialog?.warning({
    title: '删除文档',
    content: `确认删除“${detail.value.name}”吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => {
      const removed = removeKnowledgeDocument(detail.value!.id);
      if (removed) {
        window.$message?.success('已删除文档');
        goBack();
      }
    }
  });
}

function handleEditSubmit(form: KnowledgeEditFormModel) {
  const updated = updateKnowledgeDocument(form);
  if (!updated) {
    window.$message?.error('文档不存在或已被删除');
    return;
  }

  editVisible.value = false;
  window.$message?.success('文档信息已更新');
}
</script>

<template>
  <div class="knowledge-detail-page">
    <template v-if="detail">
      <NCard :bordered="false" class="detail-hero">
        <div class="flex flex-wrap items-start justify-between gap-16px">
          <div>
            <div class="flex flex-wrap items-center gap-10px">
              <NButton quaternary @click="goBack">返回知识库</NButton>
              <NTag size="small" round :type="statusMeta.type" :bordered="false">{{ statusMeta.label }}</NTag>
              <NTag size="small" round :bordered="false">{{ categoryLabel }}</NTag>
            </div>
            <div class="mt-16px text-28px font-700 text-[#f8fafc]">{{ detail.name }}</div>
            <div class="mt-10px max-w-860px text-14px leading-24px text-[#94a3b8]">{{ detail.summary }}</div>
          </div>
          <div class="flex flex-wrap gap-8px">
            <NButton secondary @click="handleCopy">复制名称</NButton>
            <NButton secondary @click="editVisible = true">编辑</NButton>
            <NButton type="error" secondary @click="handleDelete">删除</NButton>
          </div>
        </div>
      </NCard>

      <div class="grid gap-16px xl:grid-cols-[2fr_1fr]">
        <NCard :bordered="false" class="detail-card" title="文档概览">
          <div class="grid gap-14px md:grid-cols-2">
            <div class="meta-item">
              <span class="meta-label">来源</span>
              <span class="meta-value">{{ detail.source }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">审核人</span>
              <span class="meta-value">{{ detail.reviewer }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">文件格式</span>
              <span class="meta-value">{{ detail.format }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">文档大小</span>
              <span class="meta-value">{{ detail.size }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">创建时间</span>
              <span class="meta-value">{{ detail.createdAt }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">最近更新</span>
              <span class="meta-value">{{ detail.updatedAt }}</span>
            </div>
            <div class="meta-item md:col-span-2">
              <span class="meta-label">标签</span>
              <div class="mt-8px flex flex-wrap gap-6px">
                <NTag v-for="tag in detail.tags" :key="tag" size="small" round :bordered="false" class="detail-tag">
                  {{ tag }}
                </NTag>
              </div>
            </div>
            <div class="meta-item md:col-span-2">
              <span class="meta-label">说明</span>
              <span class="meta-value">{{ detail.notes }}</span>
            </div>
          </div>
        </NCard>

        <NCard :bordered="false" class="detail-card" title="处理信息">
          <div class="flex flex-col gap-12px">
            <div class="metric-row">
              <span class="meta-label">索引方式</span>
              <span class="meta-value">{{ detail.indexMode }}</span>
            </div>
            <div class="metric-row">
              <span class="meta-label">分块数量</span>
              <span class="meta-value">{{ detail.chunkCount }}</span>
            </div>
            <div class="metric-row">
              <span class="meta-label">命中次数</span>
              <span class="meta-value">{{ detail.hits }}</span>
            </div>
            <div class="metric-row">
              <span class="meta-label">最近使用</span>
              <span class="meta-value">{{ detail.lastUsedAt }}</span>
            </div>
            <div class="pt-6px">
              <div class="meta-label">处理记录</div>
              <div class="mt-10px flex flex-col gap-10px">
                <div v-for="item in detail.processLogs" :key="item" class="log-item">{{ item }}</div>
              </div>
            </div>
          </div>
        </NCard>
      </div>

      <NCard :bordered="false" class="detail-card" title="Chunk 预览">
        <div class="grid gap-12px lg:grid-cols-2">
          <div v-for="chunk in detail.chunks" :key="chunk.id" class="chunk-card">
            <div class="flex items-center justify-between gap-12px">
              <div class="text-15px font-600 text-[#f8fafc]">{{ chunk.title }}</div>
              <NTag size="small" round :bordered="false" :type="chunk.status === 'ready' ? 'success' : 'warning'">
                {{ chunk.status === 'ready' ? '已审核' : '待复核' }}
              </NTag>
            </div>
            <div class="mt-10px text-13px leading-22px text-[#cbd5e1]">{{ chunk.content }}</div>
            <div class="mt-12px flex flex-wrap items-center justify-between gap-10px">
              <div class="flex flex-wrap gap-6px">
                <NTag v-for="tag in chunk.keywords" :key="tag" size="small" round :bordered="false" class="detail-tag">
                  {{ tag }}
                </NTag>
              </div>
              <div class="text-12px text-[#94a3b8]">{{ chunk.length }} 字</div>
            </div>
          </div>
        </div>
      </NCard>

      <NCard :bordered="false" class="detail-card" title="引用信息">
        <div class="grid gap-12px md:grid-cols-2">
          <div v-for="item in detail.references" :key="item.id" class="reference-card">
            <div class="flex items-center gap-8px">
              <NTag size="small" round :bordered="false">{{ item.type }}</NTag>
              <div class="text-14px font-600 text-[#f8fafc]">{{ item.name }}</div>
            </div>
            <div class="mt-10px text-13px leading-22px text-[#94a3b8]">{{ item.description }}</div>
          </div>
        </div>
      </NCard>
    </template>

    <NCard v-else :bordered="false" class="detail-empty">
      <NEmpty description="未找到对应文档详情">
        <template #extra>
          <NButton type="primary" @click="goBack">返回知识库</NButton>
        </template>
      </NEmpty>
    </NCard>

    <KnowledgeEditDrawer
      :visible="editVisible"
      :categories="knowledgeCategories"
      :model-value="editModel"
      @update:visible="editVisible = $event"
      @submit="handleEditSubmit"
    />
  </div>
</template>

<style scoped>
.knowledge-detail-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-hero,
.detail-card,
.detail-empty {
  border-radius: 22px;
  background: rgba(15, 23, 42, 0.82);
}

.detail-hero {
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.18), transparent 38%),
    linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.92));
}

.meta-item,
.metric-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.metric-row {
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(30, 41, 59, 0.72);
}

.meta-label {
  color: #94a3b8;
  font-size: 12px;
}

.meta-value {
  color: #e2e8f0;
  line-height: 1.7;
}

.detail-tag {
  background: rgba(59, 130, 246, 0.12);
  color: #bfdbfe;
}

.log-item,
.reference-card,
.chunk-card {
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(30, 41, 59, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.16);
}
</style>
