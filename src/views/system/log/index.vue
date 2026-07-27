<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue';
import {
  NButton,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NDropdown,
  NInput,
  NModal,
  NPagination,
  NSelect,
  NTag,
  NTooltip,
  type DataTableColumns,
  type DropdownOption
} from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { fetchLogPage, fetchLogDetail, exportLoginLog, exportOperationLog } from '@/service/api/monitor';

defineOptions({ name: 'LogManage' });

// ==================== 状态 ====================
const loading = ref(false);
const tableData = ref<Api.Monitor.LogItem[]>([]);
const total = ref(0);
const query = reactive<Api.Monitor.LogQuery>({ page: 1, size: 10 });

// 详情弹窗
const detailVisible = ref(false);
const detailLoading = ref(false);
const detail = ref<Api.Monitor.LogDetail | null>(null);

// ==================== 工具 ====================
// 后端约定：status 数字 1=成功，0=失败（非 HTTP 状态码）
function renderStatusText(status: Api.Monitor.LogStatus): { text: string; type: 'success' | 'error' | 'default' } {
  // 对象形式：{ code, description }
  if (status && typeof status === 'object') {
    const code = status.code;
    const ok = code === 1 || status.description === '成功' || /success/i.test(status.description || '');
    return { text: status.description || (ok ? '成功' : '失败'), type: ok ? 'success' : 'error' };
  }
  // 数字形式：1=成功，其余（含 0）=失败
  if (typeof status === 'number') {
    const ok = status === 1;
    return { text: ok ? '成功' : '失败', type: ok ? 'success' : 'error' };
  }
  // 字符串形式
  if (typeof status === 'string') {
    const ok = /^(success|ok|1|成功)$/i.test(status.trim());
    return { text: status, type: ok ? 'success' : 'error' };
  }
  return { text: '未知', type: 'default' };
}

// ==================== 表格 ====================
const columns: DataTableColumns<Api.Monitor.LogItem> = [
  { title: '描述', key: 'description', width: 160, ellipsis: { tooltip: true } },
  { title: '模块', key: 'module', width: 120 },
  { title: '耗时(ms)', key: 'timeTaken', width: 90 },
  { title: 'IP', key: 'ip', width: 130 },
  { title: '地址', key: 'address', width: 130, ellipsis: { tooltip: true } },
  { title: '浏览器', key: 'browser', width: 110 },
  { title: '操作系统', key: 'os', width: 120 },
  {
    title: '状态',
    key: 'status',
    width: 90,
    align: 'center',
    render(row) {
      const s = renderStatusText(row.status);
      return h('span', { class: `sys-status-tag sys-status-tag--${s.type}` }, s.text);
    }
  },
  { title: '操作人', key: 'createUserString', width: 120 },
  { title: '操作时间', key: 'createTime', width: 170 },
  {
    title: '操作',
    key: 'actions',
    width: 90,
    align: 'center',
    fixed: 'right',
    render(row) {
      return h('div', { class: 'action-group', style: 'justify-content: center' }, [
        h(
          NTooltip,
          { placement: 'bottom' },
          {
            trigger: () =>
              h('button', { type: 'button', class: 'sys-action-btn', onClick: () => handleDetail(row.id) }, [
                h(SvgIcon, { icon: 'mdi:information-outline', class: 'sys-action-btn__svg' })
              ]),
            default: () => '详情'
          }
        )
      ]);
    }
  }
];

const rowKey = (row: Api.Monitor.LogItem) => row.id;

// ==================== 数据加载 ====================
async function loadData() {
  loading.value = true;
  try {
    const { data, error } = await fetchLogPage(query);
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

// ==================== 详情 ====================
async function handleDetail(id: number) {
  detailVisible.value = true;
  detailLoading.value = true;
  detail.value = null;
  try {
    const { data } = await fetchLogDetail(id);
    if (data) {
      detail.value = data;
    }
  } finally {
    detailLoading.value = false;
  }
}

// ==================== 搜索 ====================
function handleSearch() {
  query.page = 1;
  loadData();
}

function handleReset() {
  query.description = undefined;
  query.module = undefined;
  query.ip = undefined;
  query.status = undefined;
  handleSearch();
}

async function handleExportLogin() {
  await exportLoginLog(query);
}

async function handleExportOperation() {
  await exportOperationLog(query);
}

const exportOptions: DropdownOption[] = [
  { label: '导出登录日志', key: 'login', icon: () => h(SvgIcon, { icon: 'mdi:login' }) },
  { label: '导出操作日志', key: 'operation', icon: () => h(SvgIcon, { icon: 'mdi:clipboard-list' }) }
];

async function handleExportSelect(key: string) {
  if (key === 'login') {
    await handleExportLogin();
  } else if (key === 'operation') {
    await handleExportOperation();
  }
}

const statusOptions = [
  { label: '成功', value: 0 },
  { label: '失败', value: 1 }
];
</script>

<template>
  <div class="sys-page">
    <!-- 搜索卡片 -->
    <section class="sys-search-card">
      <div class="sys-search-fields">
        <NInput v-model:value="query.description" placeholder="描述" clearable @keyup.enter="handleSearch" />
        <NInput v-model:value="query.module" placeholder="模块" clearable @keyup.enter="handleSearch" />
        <NInput v-model:value="query.ip" placeholder="IP" clearable @keyup.enter="handleSearch" />
        <NSelect v-model:value="query.status" placeholder="状态" clearable :options="statusOptions" />
        <NButton type="primary" @click="handleSearch">
          <template #icon>
            <SvgIcon icon="mdi:magnify" />
          </template>
          搜索
        </NButton>
        <NButton @click="handleReset">重置</NButton>
      </div>
      <div class="sys-search-actions">
        <NDropdown trigger="click" :options="exportOptions" @select="handleExportSelect">
          <NButton>
            <template #icon>
              <SvgIcon icon="mdi:download" />
            </template>
            导出日志
          </NButton>
        </NDropdown>
      </div>
    </section>

    <!-- 内容卡片（表格） -->
    <section class="sys-content-card">
      <NDataTable
        :columns="columns"
        :data="tableData"
        :loading="loading"
        :row-key="rowKey"
        :pagination="false"
        :bordered="false"
        size="medium"
        style="flex: 1"
        flex-height
      />
      <!-- 独立翻页条：作为卡片正常子元素，不被表格滚动裁切 -->
      <div class="sys-table-footer">
        <span class="sys-table-footer__total">共 {{ total }} 条</span>
        <NPagination
          :page="query.page"
          :page-size="query.size"
          :item-count="total"
          :page-sizes="[10, 20, 50]"
          show-size-picker
          @update:page="onPageChange"
          @update:page-size="onPageSizeChange"
        />
      </div>
    </section>

    <!-- 详情弹窗 -->
    <NModal
      v-model:show="detailVisible"
      title="日志详情"
      preset="card"
      class="sys-modal"
      style="width: 760px"
      :loading="detailLoading"
    >
      <NDescriptions v-if="detail" label-placement="left" bordered :column="2">
        <NDescriptionsItem label="描述">{{ detail.description }}</NDescriptionsItem>
        <NDescriptionsItem label="模块">{{ detail.module }}</NDescriptionsItem>
        <NDescriptionsItem label="状态">
          <NTag :type="renderStatusText(detail.status).type" size="small">
            {{ renderStatusText(detail.status).text }}
          </NTag>
        </NDescriptionsItem>
        <NDescriptionsItem label="耗时">{{ detail.timeTaken }} ms</NDescriptionsItem>
        <NDescriptionsItem label="IP">{{ detail.ip }}</NDescriptionsItem>
        <NDescriptionsItem label="地址">{{ detail.address }}</NDescriptionsItem>
        <NDescriptionsItem label="浏览器">{{ detail.browser }}</NDescriptionsItem>
        <NDescriptionsItem label="操作系统">{{ detail.os }}</NDescriptionsItem>
        <NDescriptionsItem label="操作人">{{ detail.createUserString }}</NDescriptionsItem>
        <NDescriptionsItem label="操作时间">{{ detail.createTime }}</NDescriptionsItem>
        <NDescriptionsItem label="TraceId">{{ detail.traceId }}</NDescriptionsItem>
        <NDescriptionsItem label="请求地址">{{ detail.requestUrl }}</NDescriptionsItem>
        <NDescriptionsItem label="请求方法">{{ detail.requestMethod }}</NDescriptionsItem>
        <NDescriptionsItem label="状态码">{{ detail.statusCode }}</NDescriptionsItem>
        <NDescriptionsItem label="错误信息" :span="2">
          <p class="sys-code-block">{{ detail.errorMsg || '无' }}</p>
        </NDescriptionsItem>
        <NDescriptionsItem label="请求体" :span="2">
          <p class="sys-code-block">{{ detail.requestBody || '无' }}</p>
        </NDescriptionsItem>
        <NDescriptionsItem label="响应体" :span="2">
          <p class="sys-code-block">{{ detail.responseBody || '无' }}</p>
        </NDescriptionsItem>
      </NDescriptions>
    </NModal>
  </div>
</template>
