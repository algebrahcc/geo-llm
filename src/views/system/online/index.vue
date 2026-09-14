<script setup lang="ts">
import { h, reactive } from 'vue';
import { NButton, NDataTable, NInput, NPopconfirm, NTooltip, type DataTableColumns } from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { fetchOnlineUserPage, fetchKickoutOnlineUser } from '@/service/api/monitor';
import { usePagination } from '@/hooks/common/use-pagination';

defineOptions({ name: 'OnlineManage' });

// ==================== 状态 ====================
const query = reactive<Api.Monitor.OnlineUserQuery>({ page: 1, size: 10 });
const { loading, loadError, tableData, total, loadData, onPageChange, onPageSizeChange } = usePagination({
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

function renderMono(value?: string) {
  return h('span', { class: 'sys-mono' }, value || '—');
}

/** 点击复制（IP 等） */
async function copyText(text?: string) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    window.$message?.success('已复制');
  } catch {
    window.$message?.error('复制失败');
  }
}

function renderCopyable(value?: string) {
  if (!value) return h('span', { class: 'sys-muted-text' }, '—');
  return h('span', { class: 'sys-copyable', title: '点击复制', onClick: () => copyText(value) }, [
    h('span', { class: 'sys-mono' }, value)
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
  { title: 'IP', key: 'ip', width: 140, render: row => renderCopyable(row.ip) },
  { title: '地址', key: 'address', width: 140, ellipsis: { tooltip: true } },
  { title: '浏览器', key: 'browser', width: 120 },
  { title: '操作系统', key: 'os', width: 120 },
  { title: '登录时间', key: 'loginTime', width: 180, render: row => renderMono(row.loginTime) },
  { title: '最后活跃', key: 'lastActiveTime', width: 180, render: row => renderMono(row.lastActiveTime) },
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
                    h(
                      'button',
                      {
                        type: 'button',
                        class: 'sys-action-btn sys-action-btn--danger',
                        'aria-label': '强制退出'
                      },
                      [h(SvgIcon, { icon: 'mdi:logout', class: 'sys-action-btn__svg' })]
                    ),
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
    <!-- 筛选工具栏 -->
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
      <div v-if="loadError" class="sys-error-bar">
        <SvgIcon icon="mdi:alert-circle-outline" class="sys-error-bar__icon" />
        <span class="sys-error-bar__text">数据加载失败，请稍后重试</span>
        <NButton size="small" @click="loadData">重试</NButton>
      </div>
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
      >
        <template #empty>
          <EmptyState icon="mdi:account-off-outline" title="暂无在线用户" description="当前没有符合条件的在线会话" />
        </template>
      </NDataTable>
    </section>
  </div>
</template>
