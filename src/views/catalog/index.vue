<script setup lang="ts">
import { h, ref, computed } from 'vue';
import type { TreeSelectOption, DataTableColumns } from 'naive-ui';
import { NTag, NButton, NDropdown, NTree, NDataTable } from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { catalogCategories, catalogTypes, catalogData, getFilteredData, type CatalogItem } from '@/mock/catalog';

defineOptions({
  name: 'CatalogPage'
});

const activeTab = ref('总览');
const selectedCategory = ref<string | null>(null);
const searchKeyword = ref('');
const isLoading = ref(false);
const expandedKeys = ref<string[]>(['img', 'dem', 'oblique', 'hydro', 'pipe']);
const dataList = ref<CatalogItem[]>([...catalogData]);

const treeOptions: TreeSelectOption[] = catalogCategories.map(cat => ({
  label: cat.label,
  key: cat.key,
  children: cat.children?.map(child => ({
    label: child.label,
    key: child.key
  }))
}));

const filteredData = computed(() => {
  return getFilteredData(activeTab.value, selectedCategory.value, searchKeyword.value);
});

type RowData = CatalogItem;

const columns: DataTableColumns<RowData> = [
  {
    title: '数据名称',
    key: 'name',
    width: 280,
    render(row) {
      return h('div', { class: 'data-name-cell' }, [
        h('div', { class: 'data-icon-wrapper' }, [
          h(SvgIcon, { icon: getDataTypeIcon(row.type), class: 'data-type-icon' })
        ]),
        h('div', { class: 'data-info' }, [
          h('span', { class: 'data-name' }, row.name),
          h('span', { class: 'data-source' }, row.source)
        ])
      ]);
    }
  },
  {
    title: '入库时间',
    key: 'ingestTime',
    width: 120,
    render(row) {
      return h('span', { class: 'time-text' }, row.ingestTime);
    }
  },
  {
    title: '时相',
    key: 'timePhase',
    width: 100,
    render(row) {
      return h(
        NTag,
        { size: 'small', round: true, type: 'default', class: 'phase-tag' },
        { default: () => row.timePhase }
      );
    }
  },
  {
    title: '空间范围',
    key: 'range',
    width: 120,
    render(row) {
      return h('span', { class: 'range-text' }, row.range);
    }
  },
  {
    title: '数据类型',
    key: 'type',
    width: 110,
    render(row) {
      const typeColors: Record<string, string> = {
        影像: '#3b82f6',
        高程: '#10b981',
        倾斜摄影: '#8b5cf6',
        气象水文: '#06b6d4',
        矢量管网: '#f59e0b',
        专题数据: '#ec4899'
      };
      return h(
        NTag,
        {
          size: 'small',
          round: true,
          style: {
            backgroundColor: `${typeColors[row.type]}20`,
            color: typeColors[row.type],
            borderColor: `${typeColors[row.type]}40`
          },
          bordered: true
        },
        { default: () => row.type }
      );
    }
  },
  {
    title: '大小',
    key: 'size',
    width: 90,
    render(row) {
      return h('span', { class: 'size-text' }, row.size);
    }
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render(row) {
      const statusConfig: Record<string, { type: 'success' | 'warning' | 'default'; label: string; icon: string }> = {
        published: { type: 'success', label: '已发布', icon: 'mdi:check-circle' },
        draft: { type: 'warning', label: '草稿', icon: 'mdi:pencil-circle' },
        offline: { type: 'default', label: '已下线', icon: 'mdi:minus-circle' }
      };
      const config = statusConfig[row.status];
      return h('div', { class: 'status-cell' }, [
        h(SvgIcon, { icon: config.icon, class: `status-icon status-${row.status}` }),
        h(NTag, { size: 'small', type: config.type, round: true, bordered: false }, { default: () => config.label })
      ]);
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 160,
    fixed: 'right',
    render(row) {
      return h('div', { class: 'action-cell' }, [
        h(
          NButton,
          { size: 'tiny', quaternary: true, class: 'action-btn preview-btn' },
          { icon: () => h(SvgIcon, { icon: 'mdi:eye-outline', class: 'action-icon' }) }
        ),
        h(
          NButton,
          { size: 'tiny', quaternary: true, class: 'action-btn edit-btn' },
          { icon: () => h(SvgIcon, { icon: 'mdi:pencil-outline', class: 'action-icon' }) }
        ),
        h(
          NDropdown,
          {
            trigger: 'click',
            options: [
              {
                label: row.status === 'published' ? '下线' : '发布',
                key: 'toggle',
                icon: () => h(SvgIcon, { icon: row.status === 'published' ? 'mdi:eye-off-outline' : 'mdi:eye-outline' })
              },
              { type: 'divider', key: 'd1' },
              { label: '删除', key: 'delete', icon: () => h(SvgIcon, { icon: 'mdi:delete-outline' }) }
            ],
            onSelect: (key: string) => {
              if (key === 'toggle') togglePublish(row);
              if (key === 'delete') handleDelete(row);
            }
          },
          () =>
            h(
              NButton,
              { size: 'tiny', quaternary: true, class: 'action-btn more-btn' },
              { icon: () => h(SvgIcon, { icon: 'mdi:dots-vertical', class: 'action-icon' }) }
            )
        )
      ]);
    }
  }
];

function getDataTypeIcon(type: string): string {
  const iconMap: Record<string, string> = {
    影像: 'mdi:image-outline',
    倾斜摄影: 'mdi:rotate-3d-variant',
    高程: 'mdi:elevation-rise',
    气象水文: 'mdi:weather-partly-cloudy',
    矢量管网: 'mdi:pipe',
    专题数据: 'mdi:map-marker-question-outline'
  };
  return iconMap[type] || 'mdi:file-document-outline';
}

function handleTabChange(tab: string) {
  activeTab.value = tab;
  selectedCategory.value = null;
}

function handleCategorySelect(keys: string[]) {
  selectedCategory.value = keys.length > 0 ? keys[0] : null;
}

function togglePublish(item: CatalogItem) {
  const idx = dataList.value.findIndex(d => d.id === item.id);
  if (idx !== -1) {
    if (dataList.value[idx].status === 'published') {
      dataList.value[idx].status = 'offline';
      window.$message?.warning(`${item.name} 已下线`);
    } else {
      dataList.value[idx].status = 'published';
      window.$message?.success(`${item.name} 已发布`);
    }
  }
}

function handleDelete(item: CatalogItem) {
  window.$dialog?.warning({
    title: '确认删除',
    content: `确定要删除数据「${item.name}」吗？此操作不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => {
      const idx = dataList.value.findIndex(d => d.id === item.id);
      if (idx !== -1) {
        dataList.value.splice(idx, 1);
        window.$message?.success('删除成功');
      }
    }
  });
}

function showImport() {
  window.$message?.info('数据入库功能开发中...');
}
</script>

<template>
  <div class="catalog-page">
    <!-- 主内容区域 -->
    <div class="main-content">
      <!-- 左侧分类树 -->
      <div class="sidebar">
        <div class="section-header">
          <SvgIcon icon="mdi:folder-tree" class="section-icon" />
          <span class="section-title">数据分类</span>
          <span class="section-count">{{ filteredData.length }}</span>
        </div>

        <div class="tree-container">
          <NTree
            v-model:expanded-keys="expandedKeys"
            block-line
            :data="treeOptions"
            selectable
            expand-on-click
            @update:selected-keys="handleCategorySelect"
          />
        </div>
      </div>

      <!-- 右侧数据表格 -->
      <div class="content-area">
        <!-- 工具栏 -->
        <div class="toolbar">
          <div class="toolbar-left">
            <div class="tab-group">
              <button
                v-for="t in catalogTypes"
                :key="t"
                class="tab-btn"
                :class="[{ active: activeTab === t }]"
                @click="handleTabChange(t)"
              >
                {{ t }}
              </button>
            </div>
            <NTag v-if="selectedCategory" size="small" closable class="filter-tag" @close="selectedCategory = null">
              {{ selectedCategory }}
            </NTag>
          </div>

          <div class="toolbar-right">
            <div class="search-box">
              <SvgIcon icon="mdi:magnify" class="search-icon" />
              <input v-model="searchKeyword" type="text" placeholder="搜索数据..." class="search-input" />
            </div>
            <NButton type="primary" class="import-btn" @click="showImport">
              <template #icon>
                <SvgIcon icon="mdi:upload" class="btn-icon" />
              </template>
              导入数据
            </NButton>
          </div>
        </div>

        <!-- 数据表格 -->
        <div class="table-container">
          <NDataTable
            :columns="columns"
            :data="filteredData"
            :loading="isLoading"
            size="small"
            :scroll-x="1200"
            :pagination="{ pageSize: 10, showSizePicker: true, pageSizes: [10, 20, 50] }"
            :row-class-name="() => 'data-row'"
            :row-key="(row: CatalogItem) => row.id"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.catalog-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.6) 100%);
  overflow: hidden;
}

// 主内容区域
.main-content {
  flex: 1;
  display: flex;
  gap: 16px;
  min-height: 0;
  overflow: hidden;
}

// 侧边栏
.sidebar {
  width: 260px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.section-header {
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);

  .section-icon {
    font-size: 18px;
    color: rgb(var(--primary-400-color));
  }

  .section-title {
    font-size: 15px;
    font-weight: 600;
    color: #fff;
    flex: 1;
  }

  .section-count {
    font-size: 12px;
    padding: 2px 8px;
    background: rgba(var(--primary-500-color), 0.15);
    border-radius: 10px;
    color: rgb(var(--primary-400-color));
  }
}

.tree-container {
  flex: 1;
  padding: 12px;
  overflow-y: auto;

  :deep(.n-tree) {
    .n-tree-node {
      border-radius: 8px;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      &--selected {
        background: rgba(var(--primary-500-color), 0.15) !important;
      }
    }
  }
}

// 内容区域
.content-area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
}

// 工具栏
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tab-group {
  display: flex;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 4px;

  .tab-btn {
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.6);
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      color: rgba(255, 255, 255, 0.9);
    }

    &.active {
      color: #fff;
      background: rgba(var(--primary-500-color), 0.8);
      box-shadow: 0 2px 8px rgba(var(--primary-500-color), 0.3);
    }
  }
}

.filter-tag {
  animation: slideIn 0.2s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;

  .search-icon {
    position: absolute;
    left: 12px;
    font-size: 16px;
    color: rgba(255, 255, 255, 0.4);
    pointer-events: none;
    transition: color 0.2s ease;
  }

  .search-input {
    width: 240px;
    height: 36px;
    padding: 0 12px 0 36px;
    font-size: 13px;
    color: #fff;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    transition: all 0.2s ease;

    &::placeholder {
      color: rgba(255, 255, 255, 0.35);
    }

    &:hover {
      border-color: rgba(255, 255, 255, 0.15);
    }

    &:focus {
      outline: none;
      border-color: rgba(var(--primary-500-color), 0.5);
      background: rgba(0, 0, 0, 0.3);
      box-shadow: 0 0 0 3px rgba(var(--primary-500-color), 0.1);

      & + .search-icon {
        color: rgb(var(--primary-400-color));
      }
    }
  }
}

.import-btn {
  height: 36px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 500;
  background: linear-gradient(135deg, rgb(var(--primary-500-color)) 0%, rgb(var(--primary-600-color)) 100%);
  border: none;
  border-radius: 8px;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(var(--primary-500-color), 0.4);
  }

  .btn-icon {
    font-size: 16px;
  }
}

// 表格容器
.table-container {
  flex: 1;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  overflow: hidden;

  :deep(.n-data-table) {
    .n-data-table-wrapper {
      background: transparent;
    }

    .n-data-table-thead {
      background: rgba(255, 255, 255, 0.05);

      .n-data-table-th {
        font-weight: 600;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.7);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 14px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }
    }

    .n-data-table-tbody {
      .n-data-table-tr {
        transition: background 0.2s ease;

        &:hover {
          background: rgba(255, 255, 255, 0.04);
        }

        &.data-row {
          .n-data-table-td {
            padding: 14px 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          }
        }
      }
    }
  }
}

// 数据名称单元格
.data-name-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.data-icon-wrapper {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(
    135deg,
    rgba(var(--primary-500-color), 0.15) 0%,
    rgba(var(--primary-500-color), 0.05) 100%
  );
  border: 1px solid rgba(var(--primary-500-color), 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  &:hover {
    transform: scale(1.05);
    background: linear-gradient(
      135deg,
      rgba(var(--primary-500-color), 0.25) 0%,
      rgba(var(--primary-500-color), 0.1) 100%
    );
  }

  .data-type-icon {
    font-size: 20px;
    color: rgb(var(--primary-400-color));
  }
}

.data-info {
  display: flex;
  flex-direction: column;
  gap: 3px;

  .data-name {
    font-size: 14px;
    font-weight: 500;
    color: #fff;
    line-height: 1.4;
  }

  .data-source {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
  }
}

// 时间文本
.time-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  font-family: 'Inter', monospace;
}

// 范围文本
.range-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

// 大小文本
.size-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  font-family: 'Inter', monospace;
}

// 时相标签
.phase-tag {
  font-size: 12px;
  font-weight: 500;
}

// 状态单元格
.status-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-icon {
  font-size: 16px;

  &.status-published {
    color: #10b981;
  }

  &.status-draft {
    color: #f59e0b;
  }

  &.status-offline {
    color: rgba(255, 255, 255, 0.4);
  }
}

// 操作单元格
.action-cell {
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  &.preview-btn:hover {
    color: #3b82f6;
  }

  &.edit-btn:hover {
    color: #10b981;
  }

  &.more-btn:hover {
    color: #f59e0b;
  }

  .action-icon {
    font-size: 16px;
  }
}

// 响应式
@media (max-width: 1024px) {
  .main-content {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    max-height: 300px;
  }
}
</style>
