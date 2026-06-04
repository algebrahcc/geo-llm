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
import { calculateCoverage, type EnvironmentParameter } from '@/mock/knowledge-parameters';
import type { ModuleRef, KnowledgeReference } from '@/mock/knowledge';
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
const isImageDoc = computed(() => detail.value?.format === 'IMAGE');

const parameters = computed<EnvironmentParameter[]>(() => detail.value?.parameters || []);

const paramCoverage = computed(() => calculateCoverage(parameters.value));

const groupedParams = computed(() => {
  const groups: Record<string, EnvironmentParameter[]> = { 水文: [], 地形: [], 情报: [], 工程: [] };
  for (const p of parameters.value) {
    groups[p.category].push(p);
  }
  return groups;
});

const categoryLabelMap: Record<string, string> = { 水文: '水文', 地形: '地形', 情报: '情报', 工程: '工程' };

function paramConfColor(c: number): string {
  if (c >= 0.75) return '#5ee8a0';
  if (c >= 0.5) return '#f1c40f';
  return '#ff6b6b';
}

function paramConfBg(c: number): string {
  if (c >= 0.75) return 'rgba(46,204,113,0.12)';
  if (c >= 0.5) return 'rgba(241,196,15,0.12)';
  return 'rgba(255,107,107,0.12)';
}

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
</script>

<template>
  <div class="detail-page" :class="{ 'detail-page--dark': darkMode }">
    <div class="detail-shell">
      <template v-if="detail">
        <div class="panel-surface detail-hero">
          <div class="panel-head">
            <SvgIcon :icon="isImageDoc ? 'mdi:image-outline' : 'mdi:file-document-outline'" class="panel-head__icon" />
            <span class="panel-head__title">{{ isImageDoc ? '图片文档详情' : '文档详情' }}</span>
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
                  <span class="field__label">{{ isImageDoc ? '区域数量' : '分块数量' }}</span>
                  <span class="field__value">{{ isImageDoc ? (detail.regionCount ?? detail.chunkCount) : detail.chunkCount }}</span>
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

        <div v-if="parameters.length > 0" class="panel-surface">
          <div class="panel-head">
            <SvgIcon icon="mdi:chart-scatter-plot" class="panel-head__icon" />
            <span class="panel-head__title">结构化参数</span>
            <span class="param-coverage-badge">{{ paramCoverage.covered }}/{{ paramCoverage.total }} ({{ paramCoverage.rate }}%)</span>
          </div>
          <div class="panel-body">
            <template v-for="(items, cat) in groupedParams" :key="cat">
              <div v-if="items.length > 0" class="param-category">
                <div class="param-category__title">
                  <span class="param-category__dot" :class="`param-category__dot--${cat}`"></span>
                  {{ categoryLabelMap[cat as string] || cat }}
                  <span class="param-category__count">({{ items.length }} 项)</span>
                </div>
                <div class="param-table">
                  <div class="param-table__header">
                    <span class="param-table__col param-table__col--name">参数名</span>
                    <span class="param-table__col param-table__col--value">参数值</span>
                    <span class="param-table__col param-table__col--conf">置信度</span>
                    <span class="param-table__col param-table__col--source">来源</span>
                  </div>
                  <div
                    v-for="p in items"
                    :key="p.key"
                    class="param-table__row"
                    :class="{ 'param-table__row--low': p.confidence < 0.75 }"
                  >
                    <span class="param-table__col param-table__col--name">{{ p.label }}</span>
                    <span class="param-table__col param-table__col--value">
                      <span class="param-value">{{ p.value }}{{ p.value != null ? ' ' : '' }}{{ p.unit }}</span>
                    </span>
                    <span class="param-table__col param-table__col--conf">
                      <span class="param-conf" :style="{ '--conf-color': paramConfColor(p.confidence), '--conf-bg': paramConfBg(p.confidence), '--conf-w': (p.confidence * 100).toFixed(0) + '%' }">
                        {{ (p.confidence * 100).toFixed(0) }}%
                      </span>
                    </span>
                    <span class="param-table__col param-table__col--source">
                      <span :class="`param-source-tag param-source-tag--${p.source}`">
                        {{ p.source === 'image-extract' ? '图像提取' : '文本提取' }}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </template>
            <div v-if="parameters.length === 0" class="param-empty">
              暂无结构化参数数据
            </div>
          </div>
        </div>

        <div class="panel-surface">
          <div class="panel-head">
            <SvgIcon :icon="isImageDoc ? 'mdi:image-search-outline' : 'mdi:view-grid-outline'" class="panel-head__icon" />
            <span class="panel-head__title">{{ isImageDoc ? '区域要素预览' : 'Chunk 预览' }}</span>
          </div>
          <div class="panel-body">
            <div class="grid gap-10px lg:grid-cols-2">
              <div v-for="chunk in detail.chunks" :key="chunk.id" class="chunk-card">
                <div class="flex items-center justify-between gap-10px">
                  <div class="flex items-center gap-6px">
                    <NTag v-if="chunk.type === 'image-region'" size="small" round type="info" :bordered="false" class="region-tag">
                      区域 {{ chunk.regionIndex }}
                    </NTag>
                    <div class="card-title">{{ chunk.title }}</div>
                  </div>
                  <div class="flex items-center gap-6px">
                    <span v-if="chunk.confidence != null" class="confidence-tag" :class="`confidence-tag--${chunk.confidence >= 0.8 ? 'high' : chunk.confidence >= 0.5 ? 'mid' : 'low'}`">
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
                    <NTag v-if="chunk.type === 'image-region'" size="small" round :bordered="false" class="detail-tag detail-tag--image">
                      图片要素
                    </NTag>
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
            <span class="text-11px text-[rgba(147,196,255,0.4)] ml-auto">关联模块</span>
          </div>
          <div class="panel-body">
            <div class="grid gap-10px md:grid-cols-2">
              <div v-for="item in detail.references" :key="item.id" class="reference-card ref-card--enhanced">
                <div class="flex items-center gap-6px">
                  <div class="ref-module-icon" :style="{ color: getRefTypeColor(item) }">
                    <SvgIcon
                      :icon="item.module && moduleRefMeta[item.module] ? moduleRefMeta[item.module].icon : 'mdi:link-variant'"
                      class="ref-module-icon__svg"
                    />
                  </div>
                  <div>
                    <div class="flex items-center gap-6px">
                      <NTag size="small" round :bordered="false" :style="{ borderColor: getRefTypeColor(item) + '44', color: getRefTypeColor(item), background: getRefTypeColor(item) + '14' }">{{ item.type }}</NTag>
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
  mask-image: linear-gradient(135deg, rgba(0,0,0,0.12), rgba(0,0,0,0));
  -webkit-mask-image: linear-gradient(135deg, rgba(0,0,0,0.12), rgba(0,0,0,0));
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

/* ── Parameter Table ── */
.param-coverage-badge {
  margin-left: auto;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  background: rgba(41, 163, 255, 0.1);
  border: 1px solid rgba(41, 163, 255, 0.2);
}

.param-category {
  & + & { margin-top: 16px; }
}

.param-category__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.param-category__count {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-tertiary);
}

.param-category__dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;

  &--水文 { background: #29a3ff; box-shadow: 0 0 6px rgba(41, 163, 255, 0.4); }
  &--地形 { background: #5ee8a0; box-shadow: 0 0 6px rgba(94, 232, 160, 0.4); }
  &--情报 { background: #f1c40f; box-shadow: 0 0 6px rgba(241, 196, 15, 0.4); }
  &--工程 { background: #a78bfa; box-shadow: 0 0 6px rgba(167, 139, 250, 0.4); }
}

.param-empty {
  padding: 28px 0;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 13px;
}

.param-table {
  border: 1px solid rgba(25, 95, 176, 0.18);
  border-radius: 4px;
  overflow: hidden;
}

.param-table__header,
.param-table__row {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 10px;
}

.param-table__header {
  background: rgba(10, 38, 72, 0.7);
  border-bottom: 1px solid rgba(25, 95, 176, 0.25);
  font-size: 11px;
  color: var(--text-tertiary);
  letter-spacing: 0.2px;
}

.param-table__row {
  background: rgba(6, 20, 38, 0.3);
  border-bottom: 1px solid rgba(25, 95, 176, 0.08);
  font-size: 12px;
  transition: background 0.2s;

  &:last-child { border-bottom: none; }
  &:hover { background: rgba(10, 45, 80, 0.5); }

  &--low {
    background: rgba(241, 196, 15, 0.06);
    &:hover { background: rgba(241, 196, 15, 0.1); }
  }
}

.param-table__col {
  &--name { flex: 0 0 110px; color: var(--text-primary); }
  &--value { flex: 0 0 120px; }
  &--conf { flex: 0 0 100px; }
  &--source { flex: 1; display: flex; justify-content: flex-end; }
}

.param-value {
  color: var(--text-primary);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.param-conf {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--conf-color);
  background: var(--conf-bg);
  position: relative;

  &::before {
    content: '';
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: rgba(255,255,255,0.08);
    position: relative;
  }
  &::after {
    content: '';
    position: absolute;
    left: 10px;
    height: 4px;
    border-radius: 2px;
    width: var(--conf-w);
    max-width: calc(100% - 20px);
    background: var(--conf-color);
    opacity: 0.6;
  }
}

.param-source-tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;

  &--text-extract {
    color: #62c4ff;
    background: rgba(98, 196, 255, 0.1);
    border: 1px solid rgba(98, 196, 255, 0.2);
  }
  &--image-extract {
    color: #a78bfa;
    background: rgba(167, 139, 250, 0.1);
    border: 1px solid rgba(167, 139, 250, 0.2);
  }
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
