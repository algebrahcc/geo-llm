<script setup lang="ts">
import { h, reactive } from 'vue';
import { NButton, NDataTable, NInput, NPopconfirm, NTooltip, type DataTableColumns } from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { fetchOnlineUserPage, fetchKickoutOnlineUser } from '@/service/api/monitor';
import { usePagination } from '@/hooks/common/use-pagination';

defineOptions({ name: 'OnlineManage' });

// ==================== 状态 ====================
const query = reactive<Api.Monitor.OnlineUserQuery>({ page: 1, size: 10 });
const { loading, tableData, total, loadData, onPageChange, onPageSizeChange } = usePagination({
  query,
  fetchPage: fetchOnlineUserPage
});

// ==================== 单元格渲染 ====================
function renderUserCell(row: Api.Monitor.OnlineUserItem) {
  return h('div', { class: 'sys-cell' }, [
    h(SvgIcon, { icon: 'mdi:account-circle', class: 'sys-cell__icon' }),
    h('div', { class: 'sys-cell__content' }, [
      h('div', { class: 'sys-cell__title' }, row.username),
      h('div', { class: 'sys-cell__sub' }, row.nickname || '—')
    ])
  ]);
}

// ==================== 表格 ====================
const columns: DataTableColumns<Api.Monitor.OnlineUserItem> = [
  { title: '用户名', key: 'username', width: 200, render: renderUserCell },
  {
    title: '客户端',
    key: 'clientType',
    width: 120,
    align: 'center',
    render(row) {
      return h('span', { class: 'sys-chip' }, row.clientType || '未知');
    }
  },
  { title: 'IP', key: 'ip', width: 140 },
  { title: '地址', key: 'address', width: 140, ellipsis: { tooltip: true } },
  { title: '浏览器', key: 'browser', width: 120 },
  { title: '操作系统', key: 'os', width: 120 },
  { title: '登录时间', key: 'loginTime', width: 170 },
  { title: '最后活跃', key: 'lastActiveTime', width: 170 },
  {
    title: '操作',
    key: 'actions',
    width: 90,
    align: 'center',
    fixed: 'right',
    render(row) {
      return h('div', { class: 'action-group', style: 'justify-content: center' }, [
        h(
          NPopconfirm,
          { onPositiveClick: () => handleKickout(row.token) },
          {
            trigger: () =>
              h(
                NTooltip,
                { placement: 'bottom' },
                {
                  trigger: () =>
                    h('button', { type: 'button', class: 'sys-action-btn sys-action-btn--danger' }, [
                      h(SvgIcon, { icon: 'mdi:logout', class: 'sys-action-btn__svg' })
                    ]),
                  default: () => '强退'
                }
              ),
            default: () => `确认强制退出用户「${row.username}」？`
          }
        )
      ]);
    }
  }
];

const rowKey = (row: Api.Monitor.OnlineUserItem) => row.token;

// ==================== 强退 ====================
async function handleKickout(token: string) {
  const { error } = await fetchKickoutOnlineUser(token);
  if (!error) {
    window.$message?.success('已强制退出');
    loadData();
  }
}

// ==================== 搜索 ====================
function handleSearch() {
  query.page = 1;
  loadData();
}

function handleReset() {
  query.nickname = undefined;
  query.clientId = undefined;
  handleSearch();
}
</script>

<template>
  <div class="sys-page">
    <!-- 搜索卡片 -->
    <section class="sys-search-card">
      <div class="sys-search-fields">
        <NInput v-model:value="query.nickname" placeholder="昵称" clearable @keyup.enter="handleSearch" />
        <NInput v-model:value="query.clientId" placeholder="客户端ID" clearable @keyup.enter="handleSearch" />
        <NButton type="primary" @click="handleSearch">
          <template #icon>
            <SvgIcon icon="mdi:magnify" />
          </template>
          搜索
        </NButton>
        <NButton @click="handleReset">重置</NButton>
      </div>
    </section>

    <!-- 内容卡片（表格） -->
    <section class="sys-content-card">
      <NDataTable
        class="sys-table"
        :columns="columns"
        :data="tableData"
        :loading="loading"
        :row-key="rowKey"
        :pagination="{
          page: query.page,
          pageSize: query.size,
          itemCount: total,
          showSizePicker: true,
          pageSizes: [10, 20, 50],
          onUpdatePage: onPageChange,
          onUpdatePageSize: onPageSizeChange
        }"
        :bordered="false"
        size="medium"
        style="flex: 1"
        flex-height
      />
    </section>
  </div>
</template>

<style scoped lang="scss">
.sys-page {
  --sys-bg:
    radial-gradient(circle at top, var(--ui-border-1) 0%, transparent 36%),
    linear-gradient(180deg, var(--ui-page-1) 0%, var(--ui-page-2) 38%, var(--ui-page-3) 100%);
  --sys-surface: linear-gradient(180deg, var(--ui-surface-1) 0%, var(--ui-surface-2) 100%);
  --sys-border: var(--ui-border-2);
  --sys-line: var(--ui-border-4);
  --sys-text: var(--ui-text-33);
  --sys-text2: var(--ui-text-42);
  --sys-text3: var(--ui-text-41);
  --sys-accent: var(--ui-accent-4);
  height: 100%;
  background: var(--sys-bg);
  color: var(--sys-text);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  box-sizing: border-box;
  overflow: hidden;
}
.sys-search-card {
  background: var(--sys-surface);
  border: 1px solid var(--sys-border);
  box-shadow:
    0 0 0 1px var(--ui-border-6),
    0 18px 40px var(--ui-shadow-1);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
}
.sys-search-fields {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
}
.sys-search-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.sys-content-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--sys-surface);
  border: 1px solid var(--sys-border);
  box-shadow:
    0 0 0 1px var(--ui-border-6),
    0 18px 40px var(--ui-shadow-1);
  border-radius: 4px;
  position: relative;
  overflow: hidden;
  &::before,
  &::after {
    content: '';
    position: absolute;
    width: 10px;
    height: 10px;
    pointer-events: none;
    z-index: 2;
    opacity: 0.35;
  }
  &::before {
    top: -1px;
    left: -1px;
    border-top: 2px solid var(--sys-accent);
    border-left: 2px solid var(--sys-accent);
    border-radius: 4px 0 0 0;
  }
  &::after {
    bottom: -1px;
    right: -1px;
    border-bottom: 2px solid var(--sys-accent);
    border-right: 2px solid var(--sys-accent);
    border-radius: 0 0 4px 0;
  }
}

.sys-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 74px;
  height: 24px;
  padding: 0 10px;
  border-radius: 4px;
  border: 1px solid transparent;
  font-size: 11px;
  line-height: 1;
  color: var(--ui-text-113);
  background: var(--ui-accent-160);
  border-color: var(--ui-accent-161);
}

.sys-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  &__icon {
    flex-shrink: 0;
    font-size: 22px;
    color: var(--ui-accent-46);
    filter: drop-shadow(0 0 4px var(--ui-accent-118));
  }
  &__content {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  &__title {
    color: var(--sys-text);
    font-size: 13px;
    font-weight: 600;
  }
  &__sub {
    color: var(--sys-text3);
    font-size: 11px;
  }
}

.sys-action-btn {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--ui-border-45);
  border: 1px solid var(--ui-border-7);
  color: var(--ui-text-85);
  cursor: pointer;
  transition: all 0.25s ease;
  font-family: inherit;
  outline: none;
  padding: 0;
  &:hover {
    color: #fff;
    background: var(--ui-border-37);
    border-color: var(--ui-border-38);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px var(--ui-border-39);
  }
  &--danger {
    background: var(--ui-accent-36);
    border-color: var(--ui-accent-37);
    color: var(--ui-text-31);
  }
  &--danger:hover {
    color: var(--ui-accent-5);
    background: var(--ui-accent-38);
    border-color: var(--ui-accent-39);
    box-shadow: 0 4px 12px var(--ui-accent-40);
  }
  &__svg {
    font-size: 16px;
  }
}

.sys-table {
  --n-th-color: var(--ui-surface-20) !important;
  --n-td-color: transparent !important;
  --n-td-color-hover: var(--ui-border-23) !important;
  --n-border-color: var(--ui-border-4) !important;
  --n-th-text-color: var(--ui-text-42) !important;
  --n-td-text-color: var(--ui-text-42) !important;
  --n-th-font-weight: 600 !important;
  --n-font-size: 13px !important;
}
.sys-table :deep(.n-data-table-th) {
  background: linear-gradient(180deg, var(--ui-surface-20) 0%, var(--ui-surface-21) 100%) !important;
  font-size: 13px;
  padding: 14px 12px;
}
.sys-table :deep(.n-data-table-td) {
  padding: 14px 12px;
  border-bottom: 1px solid var(--ui-border-24) !important;
}
.sys-table :deep(.n-data-table-table) {
  border-collapse: separate;
  border-spacing: 0;
}
.sys-content-card :deep(.n-pagination) {
  --n-item-text-color: var(--ui-text-111);
  --n-item-text-color-hover: #fff;
  --n-item-text-color-active: #fff;
  --n-item-color-active: linear-gradient(180deg, var(--ui-accent-93) 0%, var(--ui-accent-94) 100%);
  --n-item-border-active: 1px solid var(--ui-accent-95);
  --n-item-color: var(--ui-surface-56);
  --n-item-border: 1px solid var(--ui-border-99);
  --n-item-border-hover: 1px solid var(--ui-accent-96);
  --n-item-color-hover: var(--ui-accent-97);
  --n-item-border-radius: 5px;
  font-size: 13px;
}
.sys-content-card :deep(.n-pagination-item) {
  min-width: 30px;
  height: 30px;
  border-radius: 5px;
  font-size: 13px;
  transition: all 0.2s;
}
.sys-content-card :deep(.n-pagination-item:hover) {
  border-color: var(--ui-accent-96);
  color: #fff;
  transform: translateY(-1px);
}
.sys-content-card :deep(.n-pagination-item--active) {
  box-shadow: 0 2px 10px var(--ui-border-40);
  font-weight: 600;
}
.sys-search-card :deep(.n-input) {
  --n-border: 1px solid var(--ui-border-11);
  --n-border-hover: 1px solid var(--ui-accent-10);
  --n-border-focus: 1px solid var(--ui-accent-11);
  --n-color: var(--ui-surface-10);
  --n-text-color: var(--ui-text-33);
  --n-placeholder-color: var(--ui-accent-159);
  --n-height: 36px;
  --n-border-radius: 8px;
  width: 160px;
}
.sys-search-card :deep(.n-input__border),
.sys-search-card :deep(.n-input__state-border) {
  display: none;
}
.sys-search-card :deep(.n-base-selection) {
  --n-border: 1px solid var(--ui-border-11);
  --n-color: var(--ui-surface-10);
  height: 36px;
  border-radius: 8px;
}
.sys-search-card :deep(.n-base-selection-label) {
  color: var(--sys-text);
}
.sys-search-card :deep(.n-button--primary-type) {
  --n-color: linear-gradient(180deg, var(--ui-accent-18) 0%, var(--ui-accent-19) 100%);
  --n-color-hover: linear-gradient(180deg, var(--ui-accent-20) 0%, var(--ui-accent-21) 100%);
  --n-text-color: var(--ui-text-12);
  --n-text-color-hover: #fff;
  --n-border: 1px solid var(--ui-accent-3);
  --n-border-hover: 1px solid var(--ui-accent-23);
  --n-border-radius: 8px;
  --n-font-size: 13px;
  --n-height: 36px;
  font-weight: 600;
}
:deep(.n-modal-mask) {
  background: var(--ui-shadow-16);
  backdrop-filter: blur(2px);
}
:deep(.n-card) {
  --n-color: linear-gradient(180deg, var(--ui-surface-26) 0%, var(--ui-surface-27) 100%) !important;
  --n-border-color: var(--ui-border-43) !important;
  --n-text-color: var(--ui-text-33) !important;
  --n-title-text-color: var(--ui-text-33) !important;
  --n-close-color: var(--ui-text-42) !important;
  --n-close-color-hover: var(--ui-accent-4) !important;
  --n-border-radius: 8px !important;
  overflow: hidden;
  box-shadow:
    0 0 0 1px var(--ui-border-44),
    0 24px 64px var(--ui-shadow-7),
    0 0 80px var(--ui-border-45) !important;
}
:deep(.n-card-header) {
  padding: 20px 24px 16px !important;
  border-bottom: 1px solid var(--ui-border-4);
  background: linear-gradient(180deg, var(--ui-surface-28) 0%, var(--ui-surface-29) 100%);
  position: relative;
}
:deep(.n-card-header::after) {
  content: '';
  position: absolute;
  left: 0;
  top: 16%;
  bottom: 16%;
  width: 3px;
  border-radius: 2px;
  background: linear-gradient(180deg, transparent, var(--ui-accent-4), transparent);
  opacity: 0.6;
}
:deep(.n-card-header__main) {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-shadow: 0 0 10px var(--ui-border-7);
}
:deep(.n-card-header__close) {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid var(--ui-border-46);
  background: var(--ui-surface-30);
  display: grid;
  place-items: center;
}
:deep(.n-card-header__close:hover) {
  border-color: var(--ui-accent-45);
  background: var(--ui-border-36);
}
:deep(.n-card__content) {
  padding: 20px 24px 24px;
}
:deep(.n-card__content::-webkit-scrollbar) {
  width: 6px;
}
:deep(.n-card__content::-webkit-scrollbar-thumb) {
  border-radius: 999px;
  background: var(--ui-border-47);
}
:deep(.n-card__content::-webkit-scrollbar-track) {
  background: transparent;
}
:deep(.n-descriptions-table-header),
:deep(.n-descriptions-table-content) {
  --n-th-color: var(--ui-surface-85);
  --n-td-color: var(--ui-surface-86);
}
.sys-table :deep(.n-data-table__pagination) {
  border-top: 1px solid var(--ui-border-4);
  background: linear-gradient(180deg, var(--ui-surface-7) 0%, var(--ui-surface-23) 100%);
  min-height: 52px;
  padding: 8px 14px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.sys-table :deep(.n-pagination-item--disabled) {
  opacity: 0.45;
}
.sys-search-card :deep(.n-button--default-type) {
  --n-color: linear-gradient(180deg, var(--ui-surface-12) 0%, var(--ui-surface-13) 100%);
  --n-color-hover: linear-gradient(180deg, var(--ui-accent-25) 0%, var(--ui-surface-14) 100%);
  --n-text-color: var(--ui-text-15);
  --n-text-color-hover: var(--ui-text-12);
  --n-border: 1px solid var(--ui-border-20);
  --n-border-hover: 1px solid var(--ui-accent-10);
  --n-border-radius: 8px;
  --n-font-size: 13px;
  --n-height: 36px;
}
</style>
