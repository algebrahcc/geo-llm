<script setup lang="ts">
import { computed, h, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { NDataTable, NPagination, NTag, type DataTableColumns } from 'naive-ui';
import { useThemeStore } from '@/store/modules/theme';
import SvgIcon from '@/components/custom/svg-icon.vue';
import {
  getKnowledgeStatusMeta,
  knowledgeCollections,
  knowledgeCategories,
  removeKnowledgeDocument,
  updateKnowledgeDocument,
  type KnowledgeDocument,
  type KnowledgeEditFormModel
} from '@/mock/knowledge';
import KnowledgeCategoryCard from './modules/knowledge-category-card.vue';
import KnowledgeCollectionNav from './modules/knowledge-collection-nav.vue';
import KnowledgeEditDrawer from './modules/knowledge-edit-drawer.vue';
import KnowledgeImportDrawer from './modules/knowledge-import-drawer.vue';
import KnowledgeToolbar from './modules/knowledge-toolbar.vue';
import { useKnowledge } from './modules/use-knowledge';

defineOptions({
  name: 'KnowledgePage'
});

const router = useRouter();
const themeStore = useThemeStore();
const darkMode = computed(() => themeStore.darkMode);

const {
  selectedCategory,
  selectedCollection,
  searchKeyword,
  sourceFilter,
  statusFilter,
  sortBy,
  importVisible,
  editVisible,
  editingDocument,
  sourceOptions,
  statusOptions,
  sortOptions,
  categorySummary,
  collectionGroups,
  filteredDocuments,
  openImport,
  openEdit,
  closeEdit,
  submitImport,
  resetFilters,
  buildEditForm
} = useKnowledge();

const activeCollectionLabel = computed(
  () => knowledgeCollections.find(item => item.key === selectedCollection.value)?.label || '全部集合'
);

function handleCollectionSelect(key: string) {
  selectedCollection.value = key;
  selectedCategory.value = 'all';
}

function goDetail(id: string) {
  router.push({
    name: 'knowledge_detail' as never,
    query: { id }
  });
}

function handleImportSubmit(form: Parameters<typeof submitImport>[0]) {
  const document = submitImport(form);
  window.$message?.success(`已提交导入：${document.name}`);
}

function handleEdit(document: KnowledgeDocument) {
  openEdit(document);
}

function handleEditSubmit(form: KnowledgeEditFormModel) {
  const updated = updateKnowledgeDocument(form);
  if (!updated) {
    window.$message?.error('文档不存在或已被删除');
    return;
  }

  closeEdit();
  window.$message?.success('文档信息已更新');
}

function handleDelete(document: KnowledgeDocument) {
  window.$dialog?.warning({
    title: '删除文档',
    content: `确认删除"${document.name}"吗？该操作仅影响当前前端演示数据。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => {
      const removed = removeKnowledgeDocument(document.id);
      if (removed) {
        window.$message?.success('已删除文档');
      }
    }
  });
}

// ====== Pagination ======
const currentPage = ref(1);
const pageSize = ref(10);

const totalPages = computed(() => Math.max(1, Math.ceil(filteredDocuments.value.length / pageSize.value)));

watch([filteredDocuments, pageSize], () => {
  if (currentPage.value > totalPages.value) {
    currentPage.value = totalPages.value;
  }
});

function getCategoryLabel(key: string) {
  return knowledgeCategories.find(item => item.key === key)?.label || key;
}

function getCollectionLabel(key: string) {
  return knowledgeCollections.find(item => item.key === key)?.label || key;
}

// ====== NDataTable columns ======
const columns = computed<DataTableColumns<KnowledgeDocument>>(() => [
  {
    title: '文档名称',
    key: 'name',
    width: 280,
    render(row) {
      return h('div', { class: 'doc-cell' }, [
        h(SvgIcon, { icon: 'mdi:file-document-outline', class: 'doc-cell__bullet' }),
        h('div', { class: 'doc-cell__content' }, [
          h('div', { class: 'doc-cell__title' }, row.name),
          h('div', { class: 'doc-cell__sub' }, row.summary),
          h('div', { class: 'doc-cell__meta' }, [
            h('span', row.format),
            h('span', { class: 'meta-dot' }),
            h('span', row.size),
            h('span', { class: 'meta-dot' }),
            h('span', `${row.chunkCount} 个分块`),
            h('span', { class: 'meta-dot' }),
            h('span', row.indexMode)
          ])
        ])
      ]);
    }
  },
  {
    title: '分类',
    key: 'category',
    width: 100,
    render(row) {
      return h('span', { class: 'row-text' }, getCategoryLabel(row.category));
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
      return h('span', { class: 'row-text row-text--muted' }, row.updatedAt);
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
            onClick: () => goDetail(row.id)
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
  thColor: 'rgba(6, 29, 56, 0.94)',
  thColorHover: 'rgba(10, 38, 72, 0.96)',
  tdColor: 'transparent',
  tdColorHover: 'rgba(33, 116, 212, 0.14)',
  borderColor: 'rgba(25, 95, 176, 0.35)',
  thTextColor: 'rgba(203, 227, 255, 0.72)',
  tdTextColor: 'rgba(203, 227, 255, 0.72)',
  borderRadius: '4px',
  fontSize: '12px',
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
              @import="openImport"
              @reset="resetFilters"
            />
          </div>
        </div>

        <!-- Category cards row -->
        <div class="category-strip">
          <KnowledgeCategoryCard
            v-for="item in categorySummary"
            :key="item.key"
            :title="item.label"
            :description="item.description"
            :count="item.count"
            :active="selectedCategory === item.key"
            @select="selectedCategory = item.key"
          />
        </div>

        <!-- Main table card -->
        <div class="knowledge-main__card">
          <div class="card-head">
            <div class="card-head__title">文档列表</div>
            <div class="card-head__meta">
              <span>当前集合：{{ activeCollectionLabel }}</span>
              <span>共 {{ filteredDocuments.length }} 条结果</span>
            </div>
          </div>

          <div class="table-wrap">
            <NDataTable
              :columns="columns"
              :data="filteredDocuments"
              :pagination="false"
              :row-key="(row: KnowledgeDocument) => row.id"
              :theme-overrides="dataTableThemeOverrides"
              :bordered="false"
              single-line
              flex-height
              class="knowledge-table"
            />

            <div class="table-footer">
              <div class="table-footer__summary">
                共 {{ filteredDocuments.length }} 条
                <span class="table-footer__divider" />
                已完成 {{ filteredDocuments.filter(d => d.status === 'completed').length }} 条
                <span class="table-footer__divider" />
                处理中 {{ filteredDocuments.filter(d => d.status === 'processing').length }} 条
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

    <KnowledgeImportDrawer
      :visible="importVisible"
      :categories="knowledgeCategories"
      @update:visible="importVisible = $event"
      @submit="handleImportSubmit"
    />

    <KnowledgeEditDrawer
      :visible="editVisible"
      :categories="knowledgeCategories"
      :model-value="editingDocument ? buildEditForm(editingDocument) : null"
      @update:visible="editVisible = $event"
      @submit="handleEditSubmit"
    />
  </div>
</template>

<style scoped lang="scss">
.knowledge-page {
  --knowledge-page-bg:
    radial-gradient(circle at top, rgba(0, 153, 255, 0.14) 0%, rgba(0, 0, 0, 0) 36%),
    linear-gradient(180deg, #041528 0%, #041120 38%, #03101b 100%);
  --knowledge-surface-bg: linear-gradient(180deg, rgba(3, 19, 41, 0.94) 0%, rgba(2, 15, 32, 0.96) 100%);
  --knowledge-surface-border: rgba(43, 131, 255, 0.28);
  --knowledge-strong-border: rgba(38, 142, 255, 0.4);
  --knowledge-line: rgba(25, 95, 176, 0.35);
  --knowledge-text-primary: #eaf5ff;
  --knowledge-text-secondary: rgba(203, 227, 255, 0.72);
  --knowledge-text-tertiary: rgba(147, 196, 255, 0.62);
  --knowledge-input-bg: rgba(2, 18, 36, 0.92);
  --knowledge-input-border: rgba(35, 111, 196, 0.4);
  --knowledge-glow: 0 0 0 1px rgba(32, 111, 202, 0.22), 0 18px 40px rgba(1, 8, 18, 0.45);
  --knowledge-accent: #29a3ff;
  --knowledge-danger: #ff6b6b;

  height: 100%;
  background: var(--knowledge-page-bg);
  color: var(--knowledge-text-primary);
  overflow: auto;
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

/* Category strip */
.category-strip {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
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
  background: linear-gradient(180deg, rgba(7, 27, 51, 0.94) 0%, rgba(4, 20, 40, 0.96) 100%);
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
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-shadow: 0 0 8px rgba(41, 163, 255, 0.1);
}

.card-head__meta {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  color: var(--knowledge-text-tertiary);
  font-size: 12px;
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
  --n-th-color: rgba(6, 29, 56, 0.94) !important;
  --n-td-color: transparent !important;
  --n-td-color-hover: rgba(33, 116, 212, 0.14) !important;
  --n-border-color: rgba(25, 95, 176, 0.35) !important;
  --n-th-text-color: rgba(203, 227, 255, 0.72) !important;
  --n-td-text-color: rgba(203, 227, 255, 0.72) !important;
  --n-th-font-weight: 600 !important;
  --n-font-size: 12px !important;
}

.knowledge-table :deep(.n-data-table-th) {
  background: linear-gradient(180deg, rgba(6, 29, 56, 0.94) 0%, rgba(4, 22, 43, 0.94) 100%) !important;
  font-size: 12px;
  padding: 10px 12px;
}

.knowledge-table :deep(.n-data-table-td) {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(18, 73, 135, 0.32) !important;
}

.knowledge-table :deep(.n-data-table-tr:hover .n-data-table-td) {
  background: rgba(33, 116, 212, 0.14) !important;
}

.knowledge-table :deep(.n-data-table-table) {
  border-collapse: separate;
  border-spacing: 0;
}

/* Document cell */
.doc-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.doc-cell__bullet {
  flex-shrink: 0;
  font-size: 18px;
  color: #62c4ff;
  filter: drop-shadow(0 0 4px rgba(98, 196, 255, 0.25));
}

.doc-cell__content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.doc-cell__title {
  color: var(--knowledge-text-primary);
  font-size: 13px;
  line-height: 1.4;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.doc-cell__sub {
  color: var(--knowledge-text-tertiary);
  font-size: 11px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.doc-cell__meta {
  display: flex;
  align-items: center;
  gap: 4px;
  color: rgba(135, 178, 230, 0.5);
  font-size: 10px;
}

.meta-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(36, 112, 196, 0.4);
  flex-shrink: 0;
}

.row-text {
  color: var(--knowledge-text-secondary);
  font-size: 12px;
}

.row-text--muted {
  color: rgba(160, 198, 241, 0.74);
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
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(41, 163, 255, 0.06);
  border: 1px solid rgba(41, 163, 255, 0.12);
  color: rgba(203, 227, 255, 0.65);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: inherit;
  outline: none;
}

.knowledge-table :deep(.action-icon-btn:hover) {
  color: #fff;
  background: rgba(41, 163, 255, 0.18);
  border-color: rgba(41, 163, 255, 0.35);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(41, 163, 255, 0.2);
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
  background: rgba(6, 29, 56, 0.95);
  border: 1px solid rgba(41, 163, 255, 0.25);
  color: rgba(203, 227, 255, 0.9);
  font-size: 11px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease, transform 0.2s ease;
  z-index: 10;
}

.knowledge-table :deep(.action-icon-btn:hover::after) {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.knowledge-table :deep(.action-icon-btn__svg) {
  font-size: 15px;
  transition: transform 0.25s ease;
}

.knowledge-table :deep(.action-icon-btn:hover .action-icon-btn__svg) {
  transform: scale(1.18);
}

/* Danger variant */
.knowledge-table :deep(.action-icon-btn--danger) {
  background: rgba(255, 107, 107, 0.05);
  border-color: rgba(255, 107, 107, 0.12);
  color: rgba(255, 141, 141, 0.7);
}

.knowledge-table :deep(.action-icon-btn--danger:hover) {
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.15);
  border-color: rgba(255, 107, 107, 0.35);
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.18);
}

.knowledge-table :deep(.action-icon-btn--danger:hover::after) {
  border-color: rgba(255, 107, 107, 0.25);
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
  background: linear-gradient(180deg, rgba(4, 21, 41, 0.98) 0%, rgba(4, 18, 34, 0.98) 100%);
}

.table-footer__summary {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--knowledge-text-secondary);
  font-size: 12px;
}

.table-footer__divider {
  width: 1px;
  height: 10px;
  background: linear-gradient(180deg, transparent, rgba(70, 122, 190, 0.45), transparent);
}

/* NPagination deep overrides */
.table-footer :deep(.n-pagination) {
  --n-item-text-color: rgba(203, 227, 255, 0.72) !important;
  --n-item-text-color-hover: #fff !important;
  --n-item-text-color-active: #fff !important;
  --n-item-color-active: linear-gradient(180deg, rgba(17, 100, 206, 0.64) 0%, rgba(8, 66, 138, 0.64) 100%) !important;
  --n-item-border-active: 1px solid rgba(70, 176, 255, 0.5) !important;
  --n-item-color: rgba(6, 25, 50, 0.82) !important;
  --n-item-border: 1px solid rgba(45, 111, 183, 0.34) !important;
  --n-item-border-hover: 1px solid rgba(70, 176, 255, 0.4) !important;
  --n-item-color-hover: rgba(10, 40, 80, 0.9) !important;
  --n-item-border-radius: 3px !important;
  font-size: 12px;
}

.table-footer :deep(.n-pagination .n-pagination-item) {
  min-width: 28px;
  height: 28px;
  border-radius: 3px;
}

.table-footer :deep(.n-pagination .n-pagination-item--active) {
  box-shadow: 0 0 6px rgba(41, 163, 255, 0.2);
}

.table-footer :deep(.n-pagination-size-picker .n-base-selection) {
  --n-border: 1px solid rgba(45, 111, 183, 0.34) !important;
  --n-border-hover: 1px solid rgba(70, 176, 255, 0.4) !important;
  --n-border-active: 1px solid rgba(70, 176, 255, 0.5) !important;
  --n-color: rgba(6, 25, 50, 0.82) !important;
  --n-color-active: rgba(6, 25, 50, 0.82) !important;
  --n-text-color: rgba(203, 227, 255, 0.72) !important;
  height: 28px;
  border-radius: 3px;
}

/* ====== Scrollbar ====== */
.knowledge-table :deep(.n-data-table-base-table-body::-webkit-scrollbar) {
  width: 8px;
  height: 8px;
}

.knowledge-table :deep(.n-data-table-base-table-body::-webkit-scrollbar-thumb) {
  border-radius: 999px;
  background: rgba(48, 127, 212, 0.58);
}

.knowledge-table :deep(.n-data-table-base-table-body::-webkit-scrollbar-track) {
  background: rgba(4, 20, 40, 0.45);
}

.knowledge-page::-webkit-scrollbar {
  width: 8px;
}

.knowledge-page::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(48, 127, 212, 0.45);
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
}
</style>
