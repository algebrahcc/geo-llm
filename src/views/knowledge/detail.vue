<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useThemeStore } from '@/store/modules/theme';
import SvgIcon from '@/components/custom/svg-icon.vue';
import {
  deleteKbDocument,
  fetchKbDatasets,
  fetchKbDocumentDetail,
  updateKbDocumentMetadata
} from '@/service/api/knowledge';
import { asList, extractPayload, mapKbDetailToKnowledgeDetail, getKnowledgeStatusMeta } from './modules/real';
import type { ModuleRef, KnowledgeReference, KnowledgeDocumentDetail, KnowledgeChunk } from './modules/types';
import KnowledgeSegmentEditor from './modules/knowledge-segment-editor.vue';
import KnowledgeMetadataEditor from './modules/knowledge-metadata-editor.vue';
import KnowledgeEditDrawer from './modules/knowledge-edit-drawer.vue';
import type { KnowledgeEditFormModel } from './modules/types';

defineOptions({
  name: 'KnowledgeDetailPage'
});

const route = useRoute();
const router = useRouter();
const themeStore = useThemeStore();
const darkMode = computed(() => themeStore.darkMode);
const loading = ref(false);
const detail = ref<KnowledgeDocumentDetail | null>(null);
const datasets = ref<Api.Knowledge.Dataset[]>([]);
const pollingTimer = ref<number | null>(null);

const documentId = computed(() => String(route.query.id || ''));
const datasetId = computed(() => String(route.query.datasetId || ''));
const isPolling = computed(() => detail.value?.status === 'indexing' || detail.value?.status === 'processing');
const statusMeta = computed(() => getKnowledgeStatusMeta(detail.value?.status || 'ready'));
const isImageDoc = computed(() => detail.value?.format === 'IMAGE');

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
    onPositiveClick: async () => {
      try {
        await deleteKbDocument(detail.value!.id, detail.value!.collection || datasetId.value);
        window.$message?.success('已删除文档');
        goBack();
      } catch {
        window.$message?.error('删除文档失败，请稍后重试');
      }
    }
  });
}

function stopPolling() {
  if (pollingTimer.value != null) {
    window.clearInterval(pollingTimer.value);
    pollingTimer.value = null;
  }
}

function ensurePolling() {
  stopPolling();
  if (!isPolling.value || !documentId.value || !datasetId.value) return;
  pollingTimer.value = window.setInterval(() => {
    loadDetail({ silent: true });
  }, 5000);
}

async function loadDetail(options?: { silent?: boolean }) {
  if (!documentId.value) {
    detail.value = null;
    stopPolling();
    return;
  }

  if (!datasetId.value) {
    detail.value = null;
    stopPolling();
    window.$message?.warning('缺少知识集合标识，无法加载文档详情');
    return;
  }

  if (!options?.silent) {
    loading.value = true;
  }
  try {
    const [docRes, dsRes] = await Promise.all([
      fetchKbDocumentDetail(documentId.value, datasetId.value),
      fetchKbDatasets()
    ]);
    datasets.value = asList<Api.Knowledge.Dataset>(extractPayload(dsRes));
    const payload = extractPayload<Api.Knowledge.DocumentDetail>(docRes) as Api.Knowledge.DocumentDetail | null;
    detail.value = payload ? mapKbDetailToKnowledgeDetail(payload, datasets.value) : null;
    ensurePolling();
  } catch {
    detail.value = null;
    stopPolling();
    window.$message?.error('加载文档详情失败');
  } finally {
    if (!options?.silent) {
      loading.value = false;
    }
  }
}

// ── 切片 / 元数据编辑 ──
const segmentEditorVisible = ref(false);
const editingSegment = ref<KnowledgeChunk | null>(null);
const metadataEditorVisible = ref(false);

function openSegmentEditor(chunk: KnowledgeChunk) {
  editingSegment.value = chunk;
  segmentEditorVisible.value = true;
}

function openMetadataEditor() {
  metadataEditorVisible.value = true;
}

function reloadAfterEdit() {
  loadDetail({ silent: true });
}

// ── 文档信息编辑（持久化到 Dify doc_metadata） ──
const editDocVisible = ref(false);
const editDocSnapshot = ref<KnowledgeEditFormModel | null>(null);

function openEditDoc() {
  if (!detail.value) return;
  const d = detail.value;
  editDocSnapshot.value = {
    id: d.id,
    name: d.name ?? '',
    source: d.source ?? '',
    reviewer: d.reviewer ?? '',
    tags: Array.isArray(d.tags) ? [...d.tags] : [],
    summary: d.summary ?? ''
  };
  editDocVisible.value = true;
}

async function handleDocEditSubmit(model: KnowledgeEditFormModel) {
  if (!datasetId.value || !documentId.value) return;
  const metadataList = [
    { name: 'name', value: model.name ?? '' },
    { name: 'source', value: model.source ?? '' },
    { name: 'reviewer', value: model.reviewer ?? '' },
    { name: 'summary', value: model.summary ?? '' },
    { name: 'tags', value: (model.tags || []).join(',') }
  ];
  try {
    await updateKbDocumentMetadata(datasetId.value, [
      { document_id: documentId.value, metadata_list: metadataList, partial_update: true }
    ]);
    window.$message?.success('文档信息已更新');
    editDocVisible.value = false;
    await loadDetail({ silent: true });
  } catch {
    window.$message?.error('更新失败，请稍后重试');
  }
}

// ── 模块关联 ──
const moduleRefMeta: Record<ModuleRef, { icon: string; label: string; color: string }> = {
  river: { icon: 'mdi:ferry', label: '渡河保障', color: '#29a3ff' },
  planning: { icon: 'mdi:map-marker-path', label: '机动规划', color: '#62e4ff' },
  knowledge: { icon: 'mdi:book-open-variant', label: '知识库', color: '#a78bfa' },
  agent: { icon: 'mdi:robot-outline', label: '智能体', color: '#f1c40f' }
};

function getRefTypeColor(reference: KnowledgeReference): string {
  if (reference.module && moduleRefMeta[reference.module]) return moduleRefMeta[reference.module].color;
  return '#29a3ff';
}

function navigateToRef(reference: KnowledgeReference) {
  if (!reference.route) return;
  try {
    router.push({ name: reference.route as never }).catch(() => {
      window.$message?.info(`模块 ${moduleRefMeta[reference.module!]?.label || reference.module} 暂未开放`);
    });
  } catch {
    window.$message?.info('路由跳转暂不可用');
  }
}

watch(documentId, () => {
  loadDetail();
});

watch(datasetId, () => {
  loadDetail();
});

watch(isPolling, () => {
  ensurePolling();
});

onMounted(loadDetail);
onUnmounted(() => {
  stopPolling();
});
</script>

<template>
  <div class="detail-page" :class="{ 'detail-page--dark': darkMode }">
    <div class="detail-shell">
      <div v-if="loading" class="panel-surface detail-loading">
        <NSkeleton text :repeat="2" :sharp="false" class="detail-loading__title" />
        <div class="detail-loading__grid">
          <NSkeleton height="120px" :sharp="false" />
          <NSkeleton height="120px" :sharp="false" />
        </div>
        <NSkeleton height="180px" :sharp="false" class="detail-loading__chunk" />
      </div>

      <template v-else-if="detail">
        <div class="panel-surface detail-hero">
          <div class="detail-hero__bg" />
          <div class="panel-head">
            <SvgIcon :icon="isImageDoc ? 'mdi:image-outline' : 'mdi:file-document-outline'" class="panel-head__icon" />
            <span class="panel-head__title">{{ isImageDoc ? '图片文档详情' : '文档详情' }}</span>
          </div>
          <div class="panel-body">
            <div class="flex flex-wrap items-start justify-between gap-14px">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-8px">
                  <NButton quaternary @click="goBack">返回知识库</NButton>
                  <NTag size="small" round :type="statusMeta.type" :bordered="false">
                    <template #icon>
                      <SvgIcon v-if="isPolling" icon="mdi:loading" class="is-spin" />
                    </template>
                    {{ statusMeta.label }}
                  </NTag>
                  <NTag v-if="isPolling" size="small" round type="warning" :bordered="false">
                    <template #icon><SvgIcon icon="mdi:radar" /></template>
                    实时轮询中
                  </NTag>
                </div>
                <div class="doc-title">{{ detail.name }}</div>
                <div class="doc-summary">{{ detail.summary }}</div>
              </div>
              <div class="flex flex-wrap gap-6px">
                <NButton secondary @click="handleCopy">复制名称</NButton>
                <NButton secondary @click="openEditDoc">编辑文档</NButton>
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
                  <span class="field__label">所属集合</span>
                  <span class="field__value">{{ detail.datasetName || '--' }}</span>
                </div>
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
                  <span class="field__value">
                    <NTag v-if="isImageDoc" size="small" round type="info" :bordered="false">图片</NTag>
                    <template v-else>{{ detail.format }}</template>
                  </span>
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
                <div v-if="detail.tags.length" class="field field--full">
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
                  <span class="field__label">{{ isImageDoc ? '区域数量' : '分块数量' }}</span>
                  <span class="field__value">
                    {{ isImageDoc ? (detail.regionCount ?? detail.chunkCount) : detail.chunkCount }}
                  </span>
                </div>
                <div v-if="detail.completedSegments != null && detail.completedSegments > 0" class="metric-row">
                  <span class="field__label">已完成切片</span>
                  <span class="field__value">{{ detail.completedSegments }}</span>
                </div>
                <div v-if="detail.wordCount != null" class="metric-row">
                  <span class="field__label">词数</span>
                  <span class="field__value">{{ detail.wordCount }}</span>
                </div>
                <div v-if="detail.tokenCount != null" class="metric-row">
                  <span class="field__label">Token 数</span>
                  <span class="field__value">{{ detail.tokenCount }}</span>
                </div>
                <div v-if="isImageDoc && detail.segmentModel" class="metric-row">
                  <span class="field__label">分割模型</span>
                  <span class="field__value">{{ detail.segmentModel }}</span>
                </div>
                <div v-if="isImageDoc && detail.extractModel" class="metric-row">
                  <span class="field__label">提取模型</span>
                  <span class="field__value">{{ detail.extractModel }}</span>
                </div>
                <div class="metric-row">
                  <span class="field__label">命中次数</span>
                  <span class="field__value">{{ detail.hits }}</span>
                </div>
                <div class="metric-row">
                  <span class="field__label">最近使用</span>
                  <span class="field__value">{{ detail.lastUsedAt }}</span>
                </div>
                <div v-if="detail.errorMessage" class="metric-row metric-row--danger">
                  <span class="field__label">错误信息</span>
                  <span class="field__value">{{ detail.errorMessage }}</span>
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
            <SvgIcon
              :icon="isImageDoc ? 'mdi:image-search-outline' : 'mdi:view-grid-outline'"
              class="panel-head__icon"
            />
            <span class="panel-head__title">{{ isImageDoc ? '区域要素预览' : 'Chunk 预览' }}</span>
          </div>
          <div class="panel-body">
            <NEmpty
              v-if="!detail.chunks.length"
              :description="
                detail.status === 'indexing' ? '文档仍在处理中，切片将在完成后自动刷新' : '当前暂无可展示切片'
              "
            />
            <div v-else class="grid gap-10px lg:grid-cols-2">
              <div v-for="chunk in detail.chunks" :key="chunk.id" class="chunk-card">
                <div class="flex items-center justify-between gap-10px">
                  <div class="flex items-center gap-6px">
                    <NTag
                      v-if="chunk.type === 'image-region'"
                      size="small"
                      round
                      type="info"
                      :bordered="false"
                      class="region-tag"
                    >
                      区域 {{ chunk.regionIndex }}
                    </NTag>
                    <div class="card-title">{{ chunk.title }}</div>
                  </div>
                  <div class="flex items-center gap-6px">
                    <span
                      v-if="chunk.confidence != null"
                      class="confidence-tag"
                      :class="`confidence-tag--${chunk.confidence >= 0.8 ? 'high' : chunk.confidence >= 0.5 ? 'mid' : 'low'}`"
                    >
                      {{ (chunk.confidence * 100).toFixed(0) }}%
                    </span>
                    <NTag size="small" round :bordered="false" :type="chunk.status === 'ready' ? 'success' : 'warning'">
                      {{ chunk.status === 'ready' ? '已审核' : '待复核' }}
                    </NTag>
                  </div>
                </div>
                <div class="card-desc">{{ chunk.content }}</div>
                <div class="mt-10px flex flex-wrap items-center justify-between gap-8px">
                  <div class="flex flex-wrap gap-4px">
                    <NTag
                      v-if="chunk.type === 'image-region'"
                      size="small"
                      round
                      :bordered="false"
                      class="detail-tag detail-tag--image"
                    >
                      图片要素
                    </NTag>
                    <NTag
                      v-for="tag in chunk.keywords"
                      :key="tag"
                      size="small"
                      round
                      :bordered="false"
                      class="detail-tag"
                    >
                      {{ tag }}
                    </NTag>
                  </div>
                  <div class="flex items-center gap-8px">
                    <NTag v-if="chunk.enabled === false" size="small" round :bordered="false" type="error">已停用</NTag>
                    <NButton size="tiny" tertiary @click="openSegmentEditor(chunk)">编辑</NButton>
                    <div class="text-11px text-[rgba(147,196,255,0.5)]">{{ chunk.length }} 字</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="panel-surface">
          <div class="panel-head">
            <SvgIcon icon="mdi:link-variant" class="panel-head__icon" />
            <span class="panel-head__title">关联信息</span>
            <span class="text-11px text-[rgba(147,196,255,0.4)] ml-auto">实时元数据</span>
          </div>
          <div class="panel-body">
            <NEmpty v-if="!detail.references.length" description="当前暂无关联信息" />
            <div v-else class="grid gap-10px md:grid-cols-2">
              <div v-for="item in detail.references" :key="item.id" class="reference-card ref-card--enhanced">
                <div class="flex items-center gap-6px">
                  <div class="ref-module-icon" :style="{ color: getRefTypeColor(item) }">
                    <SvgIcon
                      :icon="
                        item.module && moduleRefMeta[item.module] ? moduleRefMeta[item.module].icon : 'mdi:link-variant'
                      "
                      class="ref-module-icon__svg"
                    />
                  </div>
                  <div>
                    <div class="flex items-center gap-6px">
                      <NTag
                        size="small"
                        round
                        :bordered="false"
                        :style="{
                          borderColor: getRefTypeColor(item) + '44',
                          color: getRefTypeColor(item),
                          background: getRefTypeColor(item) + '14'
                        }"
                      >
                        {{ item.type }}
                      </NTag>
                      <div class="card-title">{{ item.name }}</div>
                    </div>
                    <div v-if="item.module" class="ref-module-label" :style="{ color: getRefTypeColor(item) }">
                      {{ moduleRefMeta[item.module]?.label || item.module }}
                    </div>
                  </div>
                </div>
                <div class="card-desc">{{ item.description }}</div>
                <div v-if="item.route" class="ref-link" @click="navigateToRef(item)">
                  查看详情
                  <SvgIcon icon="mdi:arrow-right" class="ref-link__arrow" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="panel-surface">
          <div class="panel-head">
            <SvgIcon icon="mdi:tag-multiple-outline" class="panel-head__icon" />
            <span class="panel-head__title">文档元数据</span>
            <NButton size="small" secondary class="ml-auto" @click="openMetadataEditor">编辑</NButton>
          </div>
          <div class="panel-body">
            <NEmpty v-if="!detail.metadata?.length" description="当前文档暂无元数据" />
            <div v-else class="metadata-list">
              <div v-for="meta in detail.metadata" :key="meta.id || meta.name" class="metadata-item">
                <span class="metadata-item__name">{{ meta.name }}</span>
                <span class="metadata-item__value">{{ meta.value || '—' }}</span>
              </div>
            </div>
          </div>
        </div>

        <KnowledgeSegmentEditor
          v-model:visible="segmentEditorVisible"
          :dataset-id="datasetId"
          :document-id="documentId"
          :segment="editingSegment"
          @saved="reloadAfterEdit"
        />
        <KnowledgeMetadataEditor
          v-model:visible="metadataEditorVisible"
          :dataset-id="datasetId"
          :document-id="documentId"
          :metadata="detail.metadata || []"
          @saved="reloadAfterEdit"
        />

        <KnowledgeEditDrawer
          :visible="editDocVisible"
          :model-value="editDocSnapshot"
          @update:visible="editDocVisible = $event"
          @submit="handleDocEditSubmit"
        />
      </template>

      <div v-else-if="!loading" class="panel-surface">
        <div class="panel-body">
          <NEmpty description="未找到对应文档详情">
            <template #extra>
              <NButton type="primary" @click="goBack">返回知识库</NButton>
            </template>
          </NEmpty>
        </div>
      </div>
    </div>
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

.detail-hero {
  overflow: hidden;
}

.detail-hero__bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 88% -10%, rgba(41, 163, 255, 0.18) 0%, rgba(0, 0, 0, 0) 42%),
    radial-gradient(circle at 0% 120%, rgba(98, 228, 255, 0.1) 0%, rgba(0, 0, 0, 0) 40%);
}

.detail-hero .panel-head,
.detail-hero .panel-body {
  position: relative;
  z-index: 1;
}

.detail-loading {
  padding: 14px;
}

.detail-loading__title {
  max-width: 320px;
}

.detail-loading__grid {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.detail-loading__chunk {
  margin-top: 10px;
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

.metric-row--danger {
  background: rgba(255, 107, 107, 0.08);
  border: 1px solid rgba(255, 107, 107, 0.16);
}

.detail-tag {
  background: rgba(41, 163, 255, 0.1);
  border: 1px solid rgba(41, 163, 255, 0.22);
  color: rgba(203, 227, 255, 0.82);
}

.detail-tag--image {
  background: rgba(98, 228, 255, 0.1);
  border: 1px solid rgba(98, 228, 255, 0.25);
  color: rgba(180, 236, 255, 0.9);
}

.region-tag {
  font-size: 11px;
}

.confidence-tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
}

.confidence-tag--high {
  background: rgba(46, 204, 113, 0.15);
  color: #5ee8a0;
}

.confidence-tag--mid {
  background: rgba(241, 196, 15, 0.15);
  color: #f1c40f;
}

.confidence-tag--low {
  background: rgba(255, 107, 107, 0.15);
  color: #ff6b6b;
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

/* ── 增强引用卡片 ── */
.ref-card--enhanced {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ref-module-icon {
  width: 34px;
  height: 34px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: currentColor;
  mask-image: linear-gradient(135deg, rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0));
  -webkit-mask-image: linear-gradient(135deg, rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0));
  filter: drop-shadow(0 0 6px currentColor);
}

.ref-module-icon__svg {
  font-size: 18px;
}

.ref-module-label {
  margin-top: 2px;
  font-size: 11px;
  font-weight: 500;
  opacity: 0.8;
}

.ref-link {
  margin-top: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--accent);
  cursor: pointer;
  transition: opacity 0.2s;
  user-select: none;
  align-self: flex-end;

  &:hover {
    opacity: 0.75;
    text-decoration: underline;
  }
}

.ref-link__arrow {
  font-size: 12px;
}

/* ── 元数据列表 ── */
.metadata-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metadata-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 4px;
  background: rgba(6, 20, 38, 0.5);
  border: 1px solid rgba(25, 95, 176, 0.18);
}

.metadata-item__name {
  font-size: 12px;
  color: var(--text-tertiary);
}

.metadata-item__value {
  font-size: 13px;
  color: var(--text-primary);
  text-align: right;
  word-break: break-all;
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
