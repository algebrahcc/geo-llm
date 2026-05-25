<script setup lang="ts">
import { computed, h } from 'vue';
import { useRouter } from 'vue-router';
import type { DataTableColumns } from 'naive-ui';
import { NButton, NTag } from 'naive-ui';
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
    content: `确认删除“${document.name}”吗？该操作仅影响当前前端演示数据。`,
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

type RowData = KnowledgeDocument;

const columns: DataTableColumns<RowData> = [
  {
    title: '文档名称',
    key: 'name',
    minWidth: 280,
    render(row) {
      return h('div', { class: 'doc-entry' }, [
        h('div', { class: 'doc-icon-shell' }, [h(SvgIcon, { icon: 'mdi:file-document-outline', class: 'doc-icon' })]),
        h('div', { class: 'doc-cell' }, [
          h('div', { class: 'doc-title' }, row.name),
          h('div', { class: 'doc-subtitle' }, row.summary),
          h('div', { class: 'doc-meta-row' }, [
            h('span', { class: 'doc-meta-item' }, row.format),
            h('span', { class: 'doc-meta-dot' }, '•'),
            h('span', { class: 'doc-meta-item' }, row.size),
            h('span', { class: 'doc-meta-dot' }, '•'),
            h('span', { class: 'doc-meta-item' }, `${row.chunkCount} 个分块`),
            h('span', { class: 'doc-meta-dot' }, '•'),
            h('span', { class: 'doc-meta-item' }, row.indexMode)
          ])
        ])
      ]);
    }
  },
  {
    title: '分类',
    key: 'category',
    width: 120,
    render(row) {
      const mutedClass = darkMode.value ? 'muted-text muted-text--dark' : 'muted-text';
      const category = knowledgeCategories.find(item => item.key === row.category);
      return h('span', { class: mutedClass }, category?.label || row.category);
    }
  },
  {
    title: '集合',
    key: 'collection',
    width: 140,
    render(row) {
      const mutedClass = darkMode.value ? 'muted-text muted-text--dark' : 'muted-text';
      const collection = knowledgeCollections.find(item => item.key === row.collection);
      return h('span', { class: mutedClass }, collection?.label || row.collection);
    }
  },
  {
    title: '标签',
    key: 'tags',
    minWidth: 180,
    render(row) {
      return h(
        'div',
        { class: 'tag-group' },
        row.tags.map(tag =>
          h(
            NTag,
            {
              size: 'small',
              bordered: false,
              round: true,
              class: 'doc-tag'
            },
            { default: () => tag }
          )
        )
      );
    }
  },
  {
    title: '来源',
    key: 'source',
    width: 140
  },
  {
    title: '处理状态',
    key: 'status',
    width: 110,
    render(row) {
      const meta = getKnowledgeStatusMeta(row.status);
      return h(
        NTag,
        {
          size: 'small',
          round: true,
          type: meta.type,
          bordered: false
        },
        { default: () => meta.label }
      );
    }
  },
  {
    title: '更新时间',
    key: 'updatedAt',
    width: 160
  },
  {
    title: '审核人',
    key: 'reviewer',
    width: 100
  },
  {
    title: '操作',
    key: 'actions',
    width: 190,
    fixed: 'right',
    render(row) {
      return h('div', { class: 'action-group' }, [
        h(
          NButton,
          {
            size: 'small',
            quaternary: true,
            circle: true,
            title: '查看详情',
            onClick: () => goDetail(row.id)
          },
          {
            icon: () => h(SvgIcon, { icon: 'mdi:eye-outline', class: 'action-icon' })
          }
        ),
        h(
          NButton,
          {
            size: 'small',
            quaternary: true,
            circle: true,
            title: '编辑文档',
            onClick: () => handleEdit(row)
          },
          {
            icon: () => h(SvgIcon, { icon: 'mdi:pencil-outline', class: 'action-icon' })
          }
        ),
        h(
          NButton,
          {
            size: 'small',
            quaternary: true,
            type: 'error',
            circle: true,
            title: '删除文档',
            onClick: () => handleDelete(row)
          },
          {
            icon: () => h(SvgIcon, { icon: 'mdi:delete-outline', class: 'action-icon' })
          }
        )
      ]);
    }
  }
];
</script>

<template>
  <div class="knowledge-page" :class="{ 'knowledge-page--dark': darkMode }">
    <div class="content-layout">
      <KnowledgeCollectionNav
        class="collection-nav"
        :groups="collectionGroups"
        :active-key="selectedCollection"
        @select="handleCollectionSelect"
      />

      <div class="main-content">
        <div class="grid grid-cols-1 gap-16px xl:grid-cols-5">
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

        <NCard :bordered="false" class="table-card">
          <template #header>
            <div class="flex items-center justify-between gap-12px">
              <div>
                <div class="text-16px font-600 text-[#f8fafc]">文档列表</div>
                <div class="mt-4px text-12px text-[#94a3b8]">
                  当前集合：{{ activeCollectionLabel }}，支持继续按分类、来源、状态快速过滤。
                </div>
              </div>
              <NTag size="small" round type="primary" :bordered="false">共 {{ filteredDocuments.length }} 条</NTag>
            </div>
          </template>

          <NDataTable
            :columns="columns"
            :data="filteredDocuments"
            size="small"
            :single-line="false"
            :pagination="{ pageSize: 6 }"
            :scroll-x="1420"
            :row-class-name="() => 'knowledge-row'"
          />
        </NCard>
      </div>
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

<style scoped>
.knowledge-page {
  --knowledge-title: #0f172a;
  --knowledge-subtitle: #64748b;
  --knowledge-card-bg:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 28%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.98));
  --knowledge-card-border: rgba(148, 163, 184, 0.16);
  --knowledge-card-shadow: 0 14px 30px rgba(15, 23, 42, 0.08);
  --knowledge-head-bg: linear-gradient(180deg, rgba(59, 130, 246, 0.04), rgba(255, 255, 255, 0));
  --knowledge-table-head-bg: rgba(241, 245, 249, 0.92);
  --knowledge-table-head-text: #3b82f6;
  --knowledge-row-hover: rgba(59, 130, 246, 0.05);
  --knowledge-row-border: rgba(226, 232, 240, 0.95);
  --knowledge-page-bg: transparent;
  --knowledge-doc-icon-bg: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(96, 165, 250, 0.05));
  --knowledge-doc-icon-border: rgba(96, 165, 250, 0.18);
  --knowledge-doc-icon-color: #3b82f6;
  --knowledge-doc-title: #0f172a;
  --knowledge-doc-summary: #64748b;
  --knowledge-doc-meta: #64748b;
  --knowledge-muted-text: #334155;
  --knowledge-tag-bg: rgba(59, 130, 246, 0.1);
  --knowledge-tag-color: #2563eb;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: var(--knowledge-page-bg);
}

.knowledge-page--dark {
  --knowledge-title: #f8fafc;
  --knowledge-subtitle: #94a3b8;
  --knowledge-card-bg:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 28%),
    linear-gradient(135deg, rgba(15, 23, 42, 0.86), rgba(30, 41, 59, 0.8));
  --knowledge-card-border: rgba(148, 163, 184, 0.16);
  --knowledge-card-shadow: 0 14px 30px rgba(15, 23, 42, 0.18);
  --knowledge-head-bg: linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0));
  --knowledge-table-head-bg: rgba(15, 23, 42, 0.35);
  --knowledge-table-head-text: #8fb5ff;
  --knowledge-row-hover: rgba(59, 130, 246, 0.06);
  --knowledge-row-border: rgba(148, 163, 184, 0.08);
  --knowledge-doc-icon-bg: linear-gradient(135deg, rgba(59, 130, 246, 0.14), rgba(96, 165, 250, 0.05));
  --knowledge-doc-icon-border: rgba(96, 165, 250, 0.18);
  --knowledge-doc-icon-color: #8fb5ff;
  --knowledge-doc-title: #f8fafc;
  --knowledge-doc-summary: #8ea3bd;
  --knowledge-doc-meta: #7890ad;
  --knowledge-muted-text: #d5deea;
  --knowledge-tag-bg: rgba(59, 130, 246, 0.14);
  --knowledge-tag-color: #c9defd;
}

.content-layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.main-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.table-card {
  border-radius: 20px;
  background: var(--knowledge-card-bg);
  border: 1px solid var(--knowledge-card-border);
  box-shadow: var(--knowledge-card-shadow);
  overflow: hidden;
}

.table-card :deep(.n-card-header) {
  padding: 18px 20px 16px;
  border-bottom: 1px solid var(--knowledge-card-border);
  background: var(--knowledge-head-bg);
}

.table-card :deep(.n-card__content) {
  padding: 0;
}

.table-card :deep(.n-data-table) {
  .n-data-table-wrapper {
    background: transparent;
  }

  .n-data-table-thead {
    background: var(--knowledge-table-head-bg);

    .n-data-table-th {
      padding: 13px 16px;
      border-bottom: 1px solid var(--knowledge-card-border);
      color: var(--knowledge-table-head-text);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
    }

    .n-data-table-th__title {
      opacity: 0.92;
    }
  }

  .n-data-table-tbody {
    .n-data-table-tr {
      transition:
        background 0.2s ease,
        box-shadow 0.2s ease;

      &:hover {
        background: var(--knowledge-row-hover);
      }

      &.knowledge-row {
        .n-data-table-td {
          padding: 15px 16px;
          border-bottom: 1px solid var(--knowledge-row-border);
          background: transparent;
        }

        &:last-child {
          .n-data-table-td {
            border-bottom: none;
          }
        }
      }
    }
  }

  .n-pagination {
    padding: 14px 16px 16px;
    background: rgba(15, 23, 42, 0.22);
    border-top: 1px solid rgba(148, 163, 184, 0.08);
  }
}

.doc-entry {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.doc-icon-shell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.14), rgba(96, 165, 250, 0.05));
  border: 1px solid var(--knowledge-doc-icon-border);
  background: var(--knowledge-doc-icon-bg);
}

.doc-icon {
  font-size: 18px;
  color: var(--knowledge-doc-icon-color);
}

.doc-cell {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
}

.doc-title {
  color: var(--knowledge-doc-title);
  font-weight: 600;
  line-height: 1.45;
}

.doc-subtitle {
  color: var(--knowledge-doc-summary);
  font-size: 12px;
  line-height: 1.6;
}

.doc-meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  color: var(--knowledge-doc-meta);
  font-size: 12px;
  line-height: 1.4;
}

.doc-meta-item {
  white-space: nowrap;
}

.doc-meta-dot {
  color: rgba(148, 163, 184, 0.55);
}

.muted-text {
  color: var(--knowledge-muted-text);
}

.tag-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.doc-tag {
  background: var(--knowledge-tag-bg);
  color: var(--knowledge-tag-color);
}

.action-group {
  display: flex;
  gap: 4px;
}

.action-icon {
  font-size: 16px;
}

@media (max-width: 1200px) {
  .content-layout {
    grid-template-columns: 1fr;
  }
}
</style>
