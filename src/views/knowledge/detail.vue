<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useThemeStore } from '@/store/modules/theme';
import SvgIcon from '@/components/custom/svg-icon.vue';
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
const themeStore = useThemeStore();
const darkMode = computed(() => themeStore.darkMode);
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
    content: `确认删除"${detail.value.name}"吗？`,
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
  <div class="detail-page" :class="{ 'detail-page--dark': darkMode }">
    <div class="detail-shell">
      <template v-if="detail">
        <div class="panel-surface detail-hero">
          <div class="panel-head">
            <SvgIcon icon="mdi:file-document-outline" class="panel-head__icon" />
            <span class="panel-head__title">文档详情</span>
          </div>
          <div class="panel-body">
            <div class="flex flex-wrap items-start justify-between gap-14px">
              <div>
                <div class="flex flex-wrap items-center gap-8px">
                  <NButton quaternary @click="goBack">返回知识库</NButton>
                  <NTag size="small" round :type="statusMeta.type" :bordered="false">{{ statusMeta.label }}</NTag>
                  <NTag size="small" round :bordered="false">{{ categoryLabel }}</NTag>
                </div>
                <div class="doc-title">{{ detail.name }}</div>
                <div class="doc-summary">{{ detail.summary }}</div>
              </div>
              <div class="flex flex-wrap gap-6px">
                <NButton secondary @click="handleCopy">复制名称</NButton>
                <NButton secondary @click="editVisible = true">编辑</NButton>
                <NButton type="error" secondary @click="handleDelete">删除</NButton>
              </div>
            </div>
          </div>
        </div>

        <div class="grid gap-10px xl:grid-cols-[2fr_1fr]">
          <div class="panel-surface">
            <div class="panel-head">
              <SvgIcon icon="mdi:information-outline" class="panel-head__icon" />
              <span class="panel-head__title">文档概览</span>
            </div>
            <div class="panel-body">
              <div class="info-grid">
                <div class="field">
                  <span class="field__label">来源</span>
                  <span class="field__value">{{ detail.source }}</span>
                </div>
                <div class="field">
                  <span class="field__label">审核人</span>
                  <span class="field__value">{{ detail.reviewer }}</span>
                </div>
                <div class="field">
                  <span class="field__label">文件格式</span>
                  <span class="field__value">{{ detail.format }}</span>
                </div>
                <div class="field">
                  <span class="field__label">文档大小</span>
                  <span class="field__value">{{ detail.size }}</span>
                </div>
                <div class="field">
                  <span class="field__label">创建时间</span>
                  <span class="field__value">{{ detail.createdAt }}</span>
                </div>
                <div class="field">
                  <span class="field__label">最近更新</span>
                  <span class="field__value">{{ detail.updatedAt }}</span>
                </div>
                <div class="field field--full">
                  <span class="field__label">标签</span>
                  <div class="mt-6px flex flex-wrap gap-4px">
                    <NTag v-for="tag in detail.tags" :key="tag" size="small" round :bordered="false" class="detail-tag">
                      {{ tag }}
                    </NTag>
                  </div>
                </div>
                <div class="field field--full">
                  <span class="field__label">说明</span>
                  <span class="field__value">{{ detail.notes }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="panel-surface">
            <div class="panel-head">
              <SvgIcon icon="mdi:cog-outline" class="panel-head__icon" />
              <span class="panel-head__title">处理信息</span>
            </div>
            <div class="panel-body">
              <div class="flex flex-col gap-8px">
                <div class="metric-row">
                  <span class="field__label">索引方式</span>
                  <span class="field__value">{{ detail.indexMode }}</span>
                </div>
                <div class="metric-row">
                  <span class="field__label">分块数量</span>
                  <span class="field__value">{{ detail.chunkCount }}</span>
                </div>
                <div class="metric-row">
                  <span class="field__label">命中次数</span>
                  <span class="field__value">{{ detail.hits }}</span>
                </div>
                <div class="metric-row">
                  <span class="field__label">最近使用</span>
                  <span class="field__value">{{ detail.lastUsedAt }}</span>
                </div>
                <div class="pt-4px">
                  <div class="field__label">处理记录</div>
                  <div class="mt-6px flex flex-col gap-6px">
                    <div v-for="item in detail.processLogs" :key="item" class="log-item">{{ item }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="panel-surface">
          <div class="panel-head">
            <SvgIcon icon="mdi:view-grid-outline" class="panel-head__icon" />
            <span class="panel-head__title">Chunk 预览</span>
          </div>
          <div class="panel-body">
            <div class="grid gap-10px lg:grid-cols-2">
              <div v-for="chunk in detail.chunks" :key="chunk.id" class="chunk-card">
                <div class="flex items-center justify-between gap-10px">
                  <div class="card-title">{{ chunk.title }}</div>
                  <NTag size="small" round :bordered="false" :type="chunk.status === 'ready' ? 'success' : 'warning'">
                    {{ chunk.status === 'ready' ? '已审核' : '待复核' }}
                  </NTag>
                </div>
                <div class="card-desc">{{ chunk.content }}</div>
                <div class="mt-10px flex flex-wrap items-center justify-between gap-8px">
                  <div class="flex flex-wrap gap-4px">
                    <NTag v-for="tag in chunk.keywords" :key="tag" size="small" round :bordered="false" class="detail-tag">
                      {{ tag }}
                    </NTag>
                  </div>
                  <div class="text-11px text-[rgba(147,196,255,0.5)]">{{ chunk.length }} 字</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="panel-surface">
          <div class="panel-head">
            <SvgIcon icon="mdi:link-variant" class="panel-head__icon" />
            <span class="panel-head__title">引用信息</span>
          </div>
          <div class="panel-body">
            <div class="grid gap-10px md:grid-cols-2">
              <div v-for="item in detail.references" :key="item.id" class="reference-card">
                <div class="flex items-center gap-6px">
                  <NTag size="small" round :bordered="false">{{ item.type }}</NTag>
                  <div class="card-title">{{ item.name }}</div>
                </div>
                <div class="card-desc">{{ item.description }}</div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div v-else class="panel-surface">
        <div class="panel-body">
          <NEmpty description="未找到对应文档详情">
            <template #extra>
              <NButton type="primary" @click="goBack">返回知识库</NButton>
            </template>
          </NEmpty>
        </div>
      </div>
    </div>

    <KnowledgeEditDrawer
      :visible="editVisible"
      :categories="knowledgeCategories"
      :model-value="editModel"
      @update:visible="editVisible = $event"
      @submit="handleEditSubmit"
    />
  </div>
</template>

<style scoped lang="scss">
.detail-page {
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

.detail-page--dark {
  color-scheme: dark;
}

.detail-shell {
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

.doc-title {
  margin-top: 14px;
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
}

.doc-summary {
  margin-top: 8px;
  max-width: 860px;
  font-size: 13px;
  line-height: 22px;
  color: var(--text-secondary);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px 24px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.field--full {
  grid-column: 1 / -1;
}

.field__label {
  font-size: 11px;
  color: var(--text-tertiary);
  letter-spacing: 0.2px;
}

.field__value {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.5;
  word-break: break-all;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 4px;
  background: rgba(6, 20, 38, 0.5);
}

.detail-tag {
  background: rgba(41, 163, 255, 0.1);
  border: 1px solid rgba(41, 163, 255, 0.22);
  color: rgba(203, 227, 255, 0.82);
}

.log-item {
  padding: 6px 10px;
  border-radius: 4px;
  background: rgba(6, 20, 38, 0.5);
  border: 1px solid rgba(25, 95, 176, 0.18);
  font-size: 12px;
  color: var(--text-secondary);
}

.card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.card-desc {
  margin-top: 8px;
  font-size: 12px;
  line-height: 20px;
  color: var(--text-secondary);
}

.chunk-card,
.reference-card {
  padding: 12px;
  border-radius: 4px;
  background: rgba(6, 20, 38, 0.5);
  border: 1px solid rgba(25, 95, 176, 0.18);
}

/* Scrollbar */
.detail-page::-webkit-scrollbar {
  width: 8px;
}

.detail-page::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(48, 127, 212, 0.45);
}

.detail-page::-webkit-scrollbar-track {
  background: transparent;
}
</style>
