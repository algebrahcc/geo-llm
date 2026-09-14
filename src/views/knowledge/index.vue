<script setup lang="ts">
import { computed, h, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { NDataTable, NPagination, NTag, type DataTableColumns } from 'naive-ui';
import { useThemeStore } from '@/store/modules/theme';
import SvgIcon from '@/components/custom/svg-icon.vue';
import EmptyState from '@/components/common/empty-state.vue';
import { getKnowledgeStatusMeta } from './modules/real';
import type { KnowledgeDocument } from './modules/types';
import { deleteKbDocument, syncKbDocument } from '@/service/api/knowledge';
import KnowledgeCollectionNav from './modules/knowledge-collection-nav.vue';
import KnowledgeToolbar from './modules/knowledge-toolbar.vue';
import { useKnowledge } from './modules/use-knowledge';

defineOptions({
  name: 'KnowledgePage'
});

const router = useRouter();
const themeStore = useThemeStore();
const darkMode = computed(() => themeStore.darkMode);

const {
  selectedCollection,
  searchKeyword,
  sourceFilter,
  statusFilter,
  sortBy,
  sourceOptions,
  statusOptions,
  sortOptions,
  collectionGroups,
  allDocuments,
  filteredDocuments,
  kbLoading,
  kbFailed,
  loadRealDocuments,
  getCollectionLabel,
  resetFilters
} = useKnowledge();

const activeCollectionLabel = computed(() => getCollectionLabel(selectedCollection.value) || '全部集合');

function handleCollectionSelect(key: string) {
  selectedCollection.value = key;
}

function goDetail(id: string, datasetId?: string) {
  router.push({
    name: 'knowledge_detail' as never,
    query: { id, datasetId }
  });
}

function handleImportDoc() {
  router.push({ name: 'knowledge_import' as never, query: { type: 'document' } });
}

function handleImportImage() {
  router.push({ name: 'knowledge_import' as never, query: { type: 'image' } });
}

function handleEdit(document: KnowledgeDocument) {
  goDetail(document.id, document.collection);
}

function handleDelete(document: KnowledgeDocument) {
  window.$dialog?.warning({
    title: '删除文档',
    content: `确认从知识库删除"${document.name}"吗？该操作不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await deleteKbDocument(document.id, document.collection);
        await loadRealDocuments();
        window.$message?.success('已删除文档');
      } catch {
        window.$message?.error('删除文档失败，请稍后重试');
      }
    }
  });
}

// ====== 统计卡片 ======
const statTotal = computed(() => allDocuments.value.length);
const statChunks = computed(() => allDocuments.value.reduce((sum, d) => sum + (Number(d.chunkCount) || 0), 0));
const statReady = computed(() => allDocuments.value.filter(d => d.status === 'ready').length);
const statIndexing = computed(() => allDocuments.value.filter(d => d.status === 'indexing').length);
const statImages = computed(() => allDocuments.value.filter(d => d.format === 'IMAGE').length);

const stats = computed(() => [
  {
    key: 'total',
    label: '文档总数',
    value: statTotal.value,
    icon: 'mdi:file-document-multiple-outline',
    accent: 'var(--ui-sem-blue)'
  },
  {
    key: 'chunks',
    label: '分块总数',
    value: statChunks.value,
    icon: 'mdi:view-grid-outline',
    accent: 'var(--ui-sem-cyan)'
  },
  {
    key: 'ready',
    label: '已完成',
    value: statReady.value,
    icon: 'mdi:check-circle-outline',
    accent: 'var(--ui-sem-green)'
  },
  {
    key: 'indexing',
    label: '处理中',
    value: statIndexing.value,
    icon: 'mdi:loading',
    accent: 'var(--ui-sem-amber)',
    spin: true
  },
  {
    key: 'images',
    label: '图片文档',
    value: statImages.value,
    icon: 'mdi:image-outline',
    accent: 'var(--ui-sem-violet)'
  }
]);

// ====== 批量操作 ======
const checkedRowKeys = ref<Array<string | number>>([]);

const checkedDocuments = computed(() => filteredDocuments.value.filter(d => checkedRowKeys.value.includes(d.id)));

function handleCheckedChange(keys: Array<string | number>) {
  checkedRowKeys.value = keys;
}

/** 批量同步索引 */
async function handleBatchSync() {
  const docs = checkedDocuments.value;
  if (!docs.length) {
    window.$message?.warning('请先勾选要同步的文档');
    return;
  }
  let ok = 0;
  let fail = 0;
  for (const doc of docs) {
    try {
      await syncKbDocument(doc.id);
      ok += 1;
    } catch {
      fail += 1;
    }
  }
  if (ok > 0) window.$message?.success(`已提交 ${ok} 个文档的同步`);
  if (fail > 0) window.$message?.error(`${fail} 个文档同步失败`);
  checkedRowKeys.value = [];
}

/** 批量删除 */
function handleBatchDelete() {
  const docs = checkedDocuments.value;
  if (!docs.length) {
    window.$message?.warning('请先勾选要删除的文档');
    return;
  }
  window.$dialog?.warning({
    title: '批量删除',
    content: `确认删除选中的 ${docs.length} 个文档吗？该操作不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      let ok = 0;
      let fail = 0;
      for (const doc of docs) {
        try {
          await deleteKbDocument(doc.id, doc.collection);
          ok += 1;
        } catch {
          fail += 1;
        }
      }
      if (ok > 0) window.$message?.success(`已删除 ${ok} 个文档`);
      if (fail > 0) window.$message?.error(`${fail} 个文档删除失败`);
      checkedRowKeys.value = [];
      await loadRealDocuments();
    }
  });
}

// ====== Pagination ======
const currentPage = ref(1);
const pageSize = ref(10);

const totalPages = computed(() => Math.max(1, Math.ceil(filteredDocuments.value.length / pageSize.value)));

// 当前页数据切片：分页按钮真正生效，且表格仅渲染当前页，避免文档较多时渲染过慢
const pagedDocuments = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredDocuments.value.slice(start, start + pageSize.value);
});

// 过滤条件/集合变化时回到第一页
watch([filteredDocuments, pageSize], () => {
  if (currentPage.value > totalPages.value) {
    currentPage.value = totalPages.value;
  }
});
watch([searchKeyword, sourceFilter, statusFilter, sortBy, selectedCollection], () => {
  currentPage.value = 1;
});

// ====== NDataTable columns ======
const columns = computed<DataTableColumns<KnowledgeDocument>>(() => [
  {
    type: 'selection',
    width: 40,
    fixed: 'left'
  },
  {
    title: '文档名称',
    key: 'name',
    width: 280,
    ellipsis: { tooltip: true },
    render(row) {
      return h('span', { class: 'doc-cell__title' }, row.name);
    }
  },
  {
    title: '集合',
    key: 'collection',
    width: 100,
    render(row) {
      return h('span', { class: 'row-text' }, getCollectionLabel(row.collection));
    }
  },
  {
    title: '来源',
    key: 'source',
    width: 100,
    render(row) {
      return h('span', { class: 'row-text' }, row.source);
    }
  },
  {
    title: '处理状态',
    key: 'status',
    width: 100,
    render(row) {
      const meta = getKnowledgeStatusMeta(row.status);
      return h(NTag, { size: 'small', round: true, type: meta.type, bordered: false }, () => meta.label);
    }
  },
  {
    title: '更新时间',
    key: 'updatedAt',
    width: 140,
    render(row) {
      return h('span', { class: 'row-text row-text--muted row-text--mono' }, row.updatedAt);
    }
  },
  {
    title: '审核人',
    key: 'reviewer',
    width: 80,
    render(row) {
      return h('span', { class: 'row-text' }, row.reviewer);
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    fixed: 'right',
    render(row) {
      return h('div', { class: 'action-group' }, [
        h(
          'button',
          {
            type: 'button',
            class: 'action-icon-btn',
            'data-tooltip': '详情',
            onClick: () => goDetail(row.id, row.collection)
          },
          [h(SvgIcon, { icon: 'mdi:eye-outline', class: 'action-icon-btn__svg' })]
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'action-icon-btn',
            'data-tooltip': '编辑',
            onClick: () => handleEdit(row)
          },
          [h(SvgIcon, { icon: 'mdi:pencil-outline', class: 'action-icon-btn__svg' })]
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'action-icon-btn action-icon-btn--danger',
            'data-tooltip': '删除',
            onClick: () => handleDelete(row)
          },
          [h(SvgIcon, { icon: 'mdi:delete-outline', class: 'action-icon-btn__svg' })]
        )
      ]);
    }
  }
]);

// ====== NDataTable theme overrides ======
const dataTableThemeOverrides = {
  // 颜色走 ui-palette 变量，浅色模式下表格自动跟随
  thColor: 'var(--ui-surface-20)',
  thColorHover: 'var(--ui-surface-4)',
  tdColor: 'transparent',
  tdColorHover: 'var(--ui-border-23)',
  borderColor: 'var(--ui-border-4)',
  thTextColor: 'var(--ui-text-42)',
  tdTextColor: 'var(--ui-text-42)',
  borderRadius: '4px',
  fontSize: '14px',
  thFontWeight: '600'
};
</script>

<template>
  <div class="knowledge-page" :class="{ 'knowledge-page--dark': darkMode }">
    <div class="knowledge-shell">
      <aside class="knowledge-sidebar">
        <KnowledgeCollectionNav
          :groups="collectionGroups"
          :active-key="selectedCollection"
          @select="handleCollectionSelect"
        />
      </aside>

      <section class="knowledge-main">
        <div class="knowledge-topbar">
          <div class="knowledge-topbar__left">
            <KnowledgeToolbar
              :keyword="searchKeyword"
              :source="sourceFilter"
              :status="statusFilter"
              :sort="sortBy"
              :source-options="sourceOptions"
              :status-options="statusOptions"
              :sort-options="sortOptions"
              @update:keyword="searchKeyword = $event"
              @update:source="sourceFilter = $event"
              @update:status="statusFilter = $event as typeof statusFilter"
              @update:sort="sortBy = $event as typeof sortBy"
              @import-doc="handleImportDoc"
              @import-image="handleImportImage"
              @reset="resetFilters"
            />
          </div>
        </div>

        <!-- 统计卡片 -->
        <div class="stat-row">
          <div v-for="s in stats" :key="s.key" class="stat-card">
            <SvgIcon
              :icon="s.icon"
              class="stat-card__icon"
              :class="[{ 'is-spin': s.spin }]"
              :style="{ color: s.accent }"
            />
            <div class="stat-card__body">
              <div class="stat-card__value">{{ s.value }}</div>
              <div class="stat-card__label">{{ s.label }}</div>
            </div>
          </div>
        </div>

        <!-- Main table card -->
        <div class="knowledge-main__card">
          <div class="card-head">
            <div class="card-head__title">
              <SvgIcon icon="mdi:file-document-multiple-outline" class="card-head__title-icon" />
              文档列表
            </div>
            <div class="card-head__meta">
              <span>当前集合：{{ activeCollectionLabel }}</span>
              <span>共 {{ filteredDocuments.length }} 条结果</span>
              <span v-if="kbFailed" class="meta-status meta-status--error">
                <SvgIcon icon="mdi:alert-circle-outline" />
                数据加载失败
              </span>
              <span v-else-if="kbLoading" class="meta-status meta-status--loading">
                <SvgIcon icon="mdi:loading" class="is-spin" />
                加载中…
              </span>
              <button
                type="button"
                class="meta-refresh"
                title="刷新列表"
                :disabled="kbLoading"
                @click="loadRealDocuments"
              >
                <SvgIcon icon="mdi:refresh" :class="{ 'is-spin': kbLoading }" />
              </button>
            </div>
          </div>

          <div class="table-wrap">
            <EmptyState
              v-if="kbFailed && !filteredDocuments.length"
              icon="mdi:cloud-off-outline"
              title="数据加载失败，请检查网络或后端服务"
            >
              <template #action>
                <NButton size="small" secondary @click="loadRealDocuments">重新加载</NButton>
              </template>
            </EmptyState>

            <template v-else>
              <!-- 批量操作栏 -->
              <div v-if="checkedRowKeys.length" class="batch-bar">
                <span class="batch-bar__count">已选 {{ checkedRowKeys.length }} 个文档</span>
                <div class="batch-bar__actions">
                  <NButton size="small" secondary type="primary" @click="handleBatchSync">
                    <template #icon>
                      <SvgIcon icon="mdi:sync" />
                    </template>
                    同步索引
                  </NButton>
                  <NButton size="small" secondary type="error" @click="handleBatchDelete">
                    <template #icon>
                      <SvgIcon icon="mdi:delete-outline" />
                    </template>
                    批量删除
                  </NButton>
                  <NButton size="small" quaternary @click="checkedRowKeys = []">取消选择</NButton>
                </div>
              </div>

              <NDataTable
                :columns="columns"
                :data="pagedDocuments"
                :pagination="false"
                :row-key="(row: KnowledgeDocument) => row.id"
                :checked-row-keys="checkedRowKeys"
                :theme-overrides="dataTableThemeOverrides"
                :bordered="false"
                single-line
                flex-height
                class="knowledge-table"
                @update:checked-row-keys="handleCheckedChange"
              />
            </template>

            <div class="table-footer">
              <div class="table-footer__summary">
                共 {{ filteredDocuments.length }} 条
                <span class="table-footer__divider" />
                已完成 {{ filteredDocuments.filter(d => d.status === 'ready').length }} 条
                <span class="table-footer__divider" />
                处理中 {{ filteredDocuments.filter(d => d.status === 'indexing').length }} 条
              </div>

              <NPagination
                v-model:page="currentPage"
                v-model:page-size="pageSize"
                :item-count="filteredDocuments.length"
                :page-sizes="[10, 20, 50]"
                show-size-picker
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.knowledge-page {
  --knowledge-page-bg:
    radial-gradient(circle at top, var(--ui-border-1) 0%, rgba(0, 0, 0, 0) 36%),
    linear-gradient(180deg, var(--ui-page-1) 0%, var(--ui-page-2) 38%, var(--ui-page-3) 100%);
  --knowledge-surface-bg: linear-gradient(180deg, var(--ui-surface-1) 0%, var(--ui-surface-2) 100%);
  --knowledge-surface-border: var(--ui-border-2);
  --knowledge-strong-border: var(--ui-border-3);
  --knowledge-line: var(--ui-border-4);
  --knowledge-text-primary: var(--ui-text-33);
  --knowledge-text-secondary: var(--ui-text-42);
  --knowledge-text-tertiary: var(--ui-text-41);
  --knowledge-input-bg: var(--ui-surface-3);
  --knowledge-input-border: var(--ui-border-5);
  --knowledge-glow: 0 0 0 1px var(--ui-border-6), 0 18px 40px var(--ui-shadow-1);
  --knowledge-accent: var(--ui-accent-4);
  --knowledge-danger: var(--ui-accent-5);

  height: 100%;
  background: var(--knowledge-page-bg);
  color: var(--knowledge-text-primary);
  overflow: auto;
  font-family: 'Microsoft YaHei', 'PingFang SC', 'HarmonyOS Sans SC', 'Segoe UI', sans-serif;
  letter-spacing: 0.2px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.knowledge-page--dark {
  color-scheme: dark;
}

.knowledge-shell {
  height: 100%;
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  gap: 10px;
  padding: 12px 14px;
  box-sizing: border-box;
}

.knowledge-sidebar,
.knowledge-main__card,
.knowledge-topbar {
  background: var(--knowledge-surface-bg);
  border: 1px solid var(--knowledge-surface-border);
  box-shadow: var(--knowledge-glow);
  position: relative;
}

/* Sidebar corner accents */
.knowledge-sidebar::before,
.knowledge-sidebar::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  pointer-events: none;
  z-index: 2;
  opacity: 0.35;
}
.knowledge-sidebar::before {
  top: -1px;
  left: -1px;
  border-top: 2px solid var(--knowledge-accent);
  border-left: 2px solid var(--knowledge-accent);
  border-radius: 4px 0 0 0;
}
.knowledge-sidebar::after {
  bottom: -1px;
  right: -1px;
  border-bottom: 2px solid var(--knowledge-accent);
  border-right: 2px solid var(--knowledge-accent);
  border-radius: 0 0 4px 0;
}

/* Main card corner accents */
.knowledge-main__card::before,
.knowledge-main__card::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  pointer-events: none;
  z-index: 2;
  opacity: 0.35;
}
.knowledge-main__card::before {
  top: -1px;
  left: -1px;
  border-top: 2px solid var(--knowledge-accent);
  border-left: 2px solid var(--knowledge-accent);
  border-radius: 4px 0 0 0;
}
.knowledge-main__card::after {
  bottom: -1px;
  right: -1px;
  border-bottom: 2px solid var(--knowledge-accent);
  border-right: 2px solid var(--knowledge-accent);
  border-radius: 0 0 4px 0;
}

.knowledge-sidebar {
  min-width: 0;
  border-radius: 4px;
  overflow: hidden;
}

.knowledge-main {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.knowledge-topbar {
  border-radius: 4px;
  padding: 0;
  overflow: hidden;
}

.knowledge-topbar__left {
  width: 100%;
}

/* ====== 统计卡片 ====== */
.stat-row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 4px;
  background: var(--knowledge-surface-bg);
  border: 1px solid var(--knowledge-surface-border);
  box-shadow: var(--knowledge-glow);
  position: relative;
  min-width: 0;
}

.stat-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 18%;
  bottom: 18%;
  width: 2px;
  border-radius: 1px;
  background: linear-gradient(180deg, transparent, var(--knowledge-accent), transparent);
  opacity: 0.4;
}

.stat-card__icon {
  flex-shrink: 0;
  font-size: 22px;
  filter: drop-shadow(0 0 6px var(--ui-border-40));
}

.stat-card__icon.is-spin {
  animation: meta-spin 0.8s linear infinite;
}

.stat-card__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.stat-card__value {
  font-family: 'DIN', 'Consolas', monospace;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.4px;
  color: var(--knowledge-text-primary);
  text-shadow: 0 0 10px var(--ui-border-7);
  white-space: nowrap;
}

.stat-card__label {
  font-size: 13px;
  letter-spacing: 0.2px;
  color: var(--knowledge-text-tertiary);
  white-space: nowrap;
}

/* ====== 批量操作栏 ====== */
.batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--ui-border-38);
  border-radius: 4px;
  background: linear-gradient(180deg, var(--ui-surface-73) 0%, var(--ui-surface-74) 100%);
  box-shadow: 0 0 12px var(--ui-border-7);
  margin-bottom: 10px;
}

.batch-bar__count {
  font-size: 14px;
  letter-spacing: 0.2px;
  color: var(--ui-text-78);
}

.batch-bar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Main card */
.knowledge-main__card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 4px;
  overflow: hidden;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--knowledge-line);
  background: linear-gradient(180deg, var(--ui-surface-18) 0%, var(--ui-surface-19) 100%);
  position: relative;
}

/* Card head left accent bar */
.card-head::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  bottom: 20%;
  width: 2px;
  border-radius: 1px;
  background: linear-gradient(180deg, transparent, var(--knowledge-accent), transparent);
  opacity: 0.5;
}

.card-head__title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-shadow: 0 0 8px var(--ui-border-12);
}

.card-head__title-icon {
  font-size: 19px;
  color: var(--knowledge-accent);
}

.card-head__meta {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  color: var(--knowledge-text-tertiary);
  font-size: 14px;
}

.card-head__meta .meta-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 9px;
  border-radius: 3px;
  font-size: 12px;
}

.card-head__meta .meta-status .is-spin {
  animation: meta-spin 0.8s linear infinite;
}

@keyframes meta-spin {
  to {
    transform: rotate(360deg);
  }
}

.meta-status--error {
  background: var(--ui-accent-37);
  border: 1px solid var(--ui-accent-70);
  color: var(--ui-text-83);
}

.meta-status--loading {
  background: var(--ui-border-12);
  border: 1px solid var(--ui-border-40);
  color: var(--ui-text-78);
}

.meta-refresh {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid var(--ui-border-40);
  background: var(--ui-border-36);
  color: var(--ui-text-78);
  cursor: pointer;
  transition: all 0.2s ease;
}

.meta-refresh:hover:not(:disabled) {
  background: var(--ui-border-51);
  color: var(--ui-accent-4);
}

.meta-refresh:disabled {
  opacity: 0.6;
  cursor: default;
}

.meta-refresh .is-spin {
  animation: meta-spin 0.8s linear infinite;
}

.table-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ====== NDataTable deep overrides ====== */
.knowledge-table {
  flex: 1;
  --n-th-color: var(--ui-surface-20) !important;
  --n-td-color: transparent !important;
  --n-td-color-hover: var(--ui-border-23) !important;
  --n-border-color: var(--ui-border-4) !important;
  --n-th-text-color: var(--ui-text-42) !important;
  --n-td-text-color: var(--ui-text-42) !important;
  --n-th-font-weight: 600 !important;
  --n-font-size: 14px !important;
}

.knowledge-table :deep(.n-data-table-th) {
  background: linear-gradient(180deg, var(--ui-surface-20) 0%, var(--ui-surface-21) 100%) !important;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.3px;
  padding: 12px 14px;
}

.knowledge-table :deep(.n-data-table-td) {
  padding: 12px 14px;
  border-bottom: 1px solid var(--ui-border-24) !important;
}

.knowledge-table :deep(.n-data-table-tr:hover .n-data-table-td) {
  background: var(--ui-border-23) !important;
}

.knowledge-table :deep(.n-data-table-table) {
  border-collapse: separate;
  border-spacing: 0;
}

/* Document cell：名称列仅展示名称文本 */
.doc-cell__title {
  color: var(--knowledge-text-primary);
  font-size: 15px;
  line-height: 1.4;
  font-weight: 600;
  letter-spacing: 0.2px;
}

.row-text {
  color: var(--knowledge-text-secondary);
  font-size: 14px;
  letter-spacing: 0.2px;
}

.row-text--muted {
  color: var(--ui-text-84);
}

.row-text--mono {
  font-family: 'DIN', 'Consolas', monospace;
  letter-spacing: 0.4px;
}

/* Actions — icon-only circle buttons (inside NDataTable, use :deep) */
.knowledge-table :deep(.action-group) {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
}

.knowledge-table :deep(.action-icon-btn) {
  position: relative;
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--ui-border-45);
  border: 1px solid var(--ui-border-7);
  color: var(--ui-text-85);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: inherit;
  outline: none;
}

.knowledge-table :deep(.action-icon-btn:hover) {
  color: var(--ui-text-1);
  background: var(--ui-border-37);
  border-color: var(--ui-border-38);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--ui-border-39);
}

/* tooltip on hover */
.knowledge-table :deep(.action-icon-btn::after) {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--ui-surface-22);
  border: 1px solid var(--ui-border-40);
  color: var(--ui-text-86);
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  z-index: 10;
}

.knowledge-table :deep(.action-icon-btn:hover::after) {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.knowledge-table :deep(.action-icon-btn__svg) {
  font-size: 17px;
  transition: transform 0.25s ease;
}

.knowledge-table :deep(.action-icon-btn:hover .action-icon-btn__svg) {
  transform: scale(1.18);
}

/* Danger variant */
.knowledge-table :deep(.action-icon-btn--danger) {
  background: var(--ui-accent-36);
  border-color: var(--ui-accent-37);
  color: var(--ui-text-31);
}

.knowledge-table :deep(.action-icon-btn--danger:hover) {
  color: var(--ui-accent-5);
  background: var(--ui-accent-38);
  border-color: var(--ui-accent-39);
  box-shadow: 0 4px 12px var(--ui-accent-40);
}

.knowledge-table :deep(.action-icon-btn--danger:hover::after) {
  border-color: var(--ui-accent-41);
}

/* ====== Table Footer ====== */
.table-footer {
  min-height: 48px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid var(--knowledge-line);
  background: linear-gradient(180deg, var(--ui-surface-7) 0%, var(--ui-surface-23) 100%);
}

.table-footer__summary {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--knowledge-text-secondary);
  font-size: 14px;
  letter-spacing: 0.2px;
}

.table-footer__divider {
  width: 1px;
  height: 10px;
  background: linear-gradient(180deg, transparent, var(--ui-border-41), transparent);
}

/* NPagination deep overrides */
.table-footer :deep(.n-pagination) {
  --n-item-text-color: var(--ui-text-42) !important;
  --n-item-text-color-hover: var(--ui-text-1) !important;
  --n-item-text-color-active: var(--ui-text-1) !important;
  --n-item-color-active: linear-gradient(180deg, var(--ui-accent-42) 0%, var(--ui-accent-43) 100%) !important;
  --n-item-border-active: 1px solid var(--ui-accent-44) !important;
  --n-item-color: var(--ui-surface-24) !important;
  --n-item-border: 1px solid var(--ui-border-42) !important;
  --n-item-border-hover: 1px solid var(--ui-accent-45) !important;
  --n-item-color-hover: var(--ui-surface-25) !important;
  --n-item-border-radius: 3px !important;
  font-size: 14px;
}

.table-footer :deep(.n-pagination .n-pagination-item) {
  min-width: 32px;
  height: 32px;
  border-radius: 3px;
}

.table-footer :deep(.n-pagination .n-pagination-item--active) {
  box-shadow: 0 0 6px var(--ui-border-39);
}

.table-footer :deep(.n-pagination-size-picker .n-base-selection) {
  --n-border: 1px solid var(--ui-border-42) !important;
  --n-border-hover: 1px solid var(--ui-accent-45) !important;
  --n-border-active: 1px solid var(--ui-accent-44) !important;
  --n-color: var(--ui-surface-24) !important;
  --n-color-active: var(--ui-surface-24) !important;
  --n-text-color: var(--ui-text-42) !important;
  height: 32px;
  border-radius: 3px;
}

/* ====== Scrollbar ====== */
.knowledge-table :deep(.n-data-table-base-table-body::-webkit-scrollbar) {
  width: 8px;
  height: 8px;
}

.knowledge-table :deep(.n-data-table-base-table-body::-webkit-scrollbar-thumb) {
  border-radius: 999px;
  background: var(--ui-accent-68);
}

.knowledge-table :deep(.n-data-table-base-table-body::-webkit-scrollbar-track) {
  background: var(--ui-surface-35);
}

.knowledge-page::-webkit-scrollbar {
  width: 8px;
}

.knowledge-page::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: var(--ui-border-47);
}

.knowledge-page::-webkit-scrollbar-track {
  background: transparent;
}

@media (max-width: 1200px) {
  .knowledge-shell {
    grid-template-columns: 1fr;
  }

  .knowledge-sidebar {
    max-height: 280px;
  }

  .stat-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
