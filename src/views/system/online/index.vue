<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue';
import { NButton, NDataTable, NInput, NPopconfirm, NTooltip, type DataTableColumns } from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { fetchOnlineUserPage, fetchKickoutOnlineUser } from '@/service/api/monitor';

defineOptions({ name: 'OnlineManage' });

// ==================== 状态 ====================
const loading = ref(false);
const tableData = ref<Api.Monitor.OnlineUserItem[]>([]);
const total = ref(0);
const query = reactive<Api.Monitor.OnlineUserQuery>({ page: 1, size: 10 });

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

// ==================== 数据加载 ====================
async function loadData() {
  loading.value = true;
  try {
    const { data, error } = await fetchOnlineUserPage(query);
    if (!error && data) {
      tableData.value = data.list || [];
      total.value = data.total || 0;
    }
  } finally {
    loading.value = false;
  }
}

function onPageChange(page: number) {
  query.page = page;
  loadData();
}

function onPageSizeChange(size: number) {
  query.size = size;
  query.page = 1;
  loadData();
}

onMounted(() => {
  loadData();
});

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
