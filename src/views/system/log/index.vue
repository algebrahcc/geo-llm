<script setup lang="ts">
import { computed, h, reactive, ref } from 'vue';
import {
  NButton,
  NDataTable,
  NDropdown,
  NInput,
  NModal,
  NPagination,
  NSelect,
  type DataTableBaseColumn,
  type DataTableSortState,
  type DropdownOption
} from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { fetchLogPage, fetchLogDetail, exportLoginLog, exportOperationLog } from '@/service/api/monitor';
import { usePagination } from '@/hooks/common/use-pagination';

defineOptions({ name: 'LogManage' });

const query = reactive<Api.Monitor.LogQuery>({ page: 1, size: 10, sort: 'createTime,desc' });
const { loading, loadError, tableData, total, loadData, onPageChange, onPageSizeChange } = usePagination({
  query,
  fetchPage: fetchLogPage
});

const detailVisible = ref(false);
const detailLoading = ref(false);
const detail = ref<Api.Monitor.LogDetail | null>(null);

function renderStatusText(status: Api.Monitor.LogStatus): { text: string; type: 'success' | 'error' | 'default' } {
  if (status && typeof status === 'object') {
    const code = status.code;
    const ok = code === 1 || status.description === '成功' || /success/i.test(status.description || '');
    return { text: status.description || (ok ? '成功' : '失败'), type: ok ? 'success' : 'error' };
  }
  if (typeof status === 'number') {
    const ok = status === 1;
    return { text: ok ? '成功' : '失败', type: ok ? 'success' : 'error' };
  }
  if (typeof status === 'string') {
    const ok = /^(success|ok|1|成功)$/i.test(status.trim());
    return { text: status, type: ok ? 'success' : 'error' };
  }
  return { text: '未知', type: 'default' };
}

/** 数值/时间/地址类字段统一等宽，避免字宽跳动 */
function renderMono(value?: string | number) {
  if (value === null || value === undefined || value === '') return h('span', { class: 'sys-muted-text' }, '—');
  return h('span', { class: 'sys-mono' }, String(value));
}

/** 点击复制（IP 等排查时高频使用） */
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

const columns: DataTableBaseColumn<Api.Monitor.LogItem>[] = [
  { title: '描述', key: 'description', width: 160, ellipsis: { tooltip: true } },
  { title: '模块', key: 'module', width: 120 },
  { title: '耗时(ms)', key: 'timeTaken', width: 100, sorter: true, render: row => renderMono(row.timeTaken) },
  { title: 'IP', key: 'ip', width: 130, render: row => renderCopyable(row.ip) },
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
  { title: '操作时间', key: 'createTime', width: 180, sorter: true, render: row => renderMono(row.createTime) },
  {
    title: '操作',
    key: 'actions',
    width: 90,
    align: 'center',
    fixed: 'right',
    render(row) {
      return h('div', { class: 'action-group', style: 'justify-content: center' }, [
        h(
          'button',
          {
            type: 'button',
            class: 'sys-action-btn',
            'data-tooltip': '详情',
            'aria-label': '查看详情',
            onClick: () => handleDetail(row.id)
          },
          [h(SvgIcon, { icon: 'mdi:information-outline', class: 'sys-action-btn__svg' })]
        )
      ]);
    }
  }
];

const rowKey = (row: Api.Monitor.LogItem) => row.id;

// ==================== 列显示控制 ====================
/** 默认收起的次要列（浏览器/系统信息可在详情弹窗中查看） */
const HIDDEN_BY_DEFAULT = ['browser', 'os'];

const columnChecks = ref<NaiveUI.TableColumnCheck[]>(
  columns.map(col => ({
    key: String(col.key),
    title: typeof col.title === 'string' ? col.title : '',
    checked: !HIDDEN_BY_DEFAULT.includes(String(col.key)),
    fixed: 'unFixed' as const,
    visible: true
  }))
);

const displayColumns = computed(() =>
  columns.filter(col => columnChecks.value.find(item => item.key === String(col.key))?.checked ?? true)
);

// ==================== 排序（服务端） ====================
function handleSorterChange(sorter: DataTableSortState | DataTableSortState[] | null) {
  const single = Array.isArray(sorter) ? sorter[0] : sorter;
  if (!single || !single.order) {
    query.sort = 'createTime,desc';
  } else {
    query.sort = `${String(single.columnKey)},${single.order === 'ascend' ? 'asc' : 'desc'}`;
  }
  query.page = 1;
  loadData();
}

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
  if (key === 'login') await handleExportLogin();
  else if (key === 'operation') await handleExportOperation();
}

const statusOptions = [
  { label: '成功', value: 0 },
  { label: '失败', value: 1 }
];
</script>

<template>
  <div class="sys-page">
    <!-- 筛选工具栏 -->
    <section class="sys-search-card">
      <div class="sys-search-fields">
        <NInput v-model:value="query.description" placeholder="描述" clearable @keyup.enter="handleSearch" />
        <NInput v-model:value="query.module" placeholder="模块" clearable @keyup.enter="handleSearch" />
        <NInput v-model:value="query.ip" placeholder="IP" clearable @keyup.enter="handleSearch" />
        <NSelect v-model:value="query.status" placeholder="状态" clearable :options="statusOptions" />
        <NButton type="primary" @click="handleSearch">
          <template #icon><SvgIcon icon="mdi:magnify" /></template>
          搜索
        </NButton>
        <NButton @click="handleReset">重置</NButton>
      </div>
      <div class="sys-search-actions">
        <TableColumnSetting v-model:columns="columnChecks" />
        <NDropdown trigger="click" :options="exportOptions" @select="handleExportSelect">
          <NButton>
            <template #icon><SvgIcon icon="mdi:download" /></template>
            导出日志
          </NButton>
        </NDropdown>
      </div>
    </section>

    <section class="sys-content-card">
      <div v-if="loadError" class="sys-error-bar">
        <SvgIcon icon="mdi:alert-circle-outline" class="sys-error-bar__icon" />
        <span class="sys-error-bar__text">数据加载失败，请稍后重试</span>
        <NButton size="small" @click="loadData">重试</NButton>
      </div>
      <NDataTable
        class="sys-table"
        :columns="displayColumns"
        :data="tableData"
        :loading="loading"
        :row-key="rowKey"
        :pagination="false"
        :bordered="false"
        size="medium"
        style="flex: 1"
        flex-height
        @update:sorter="handleSorterChange"
      >
        <template #empty>
          <EmptyState icon="mdi:inbox-outline" title="暂无日志" description="没有符合当前筛选条件的记录" />
        </template>
      </NDataTable>
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
    <NModal v-model:show="detailVisible" class="sys-detail-modal" :close-on-esc="true">
      <div v-if="detail" class="sys-detail-shell">
        <div class="sys-detail-header">
          <div class="sys-detail-header__left">
            <span class="sys-detail-header__icon"><SvgIcon icon="mdi:clipboard-text-outline" /></span>
            <div class="sys-detail-header__text">
              <h2 class="sys-detail-header__title">{{ detail.description }}</h2>
              <div class="sys-detail-header__badges">
                <span class="sys-status-tag" :class="`sys-status-tag--${renderStatusText(detail.status).type}`">
                  {{ renderStatusText(detail.status).text }}
                </span>
                <span class="sys-muted-text">{{ detail.module }}</span>
              </div>
            </div>
          </div>
          <button type="button" class="sys-detail-close-btn" aria-label="关闭" @click="detailVisible = false">
            <SvgIcon icon="mdi:close" />
          </button>
        </div>
        <div class="sys-detail-body">
          <section class="sys-detail-section">
            <div class="sys-detail-section__title">
              <SvgIcon icon="mdi:information-outline" class="sys-detail-section__icon" />
              基础信息
            </div>
            <div class="sys-detail-grid">
              <div class="sys-detail-field">
                <div class="sys-detail-field__label">描述</div>
                <div class="sys-detail-field__value">{{ detail.description }}</div>
              </div>
              <div class="sys-detail-field">
                <div class="sys-detail-field__label">模块</div>
                <div class="sys-detail-field__value">{{ detail.module }}</div>
              </div>
              <div class="sys-detail-field">
                <div class="sys-detail-field__label">耗时</div>
                <div class="sys-detail-field__value">{{ detail.timeTaken }} ms</div>
              </div>
              <div class="sys-detail-field">
                <div class="sys-detail-field__label">状态码</div>
                <div class="sys-detail-field__value">{{ detail.statusCode }}</div>
              </div>
              <div class="sys-detail-field">
                <div class="sys-detail-field__label">操作人</div>
                <div class="sys-detail-field__value">{{ detail.createUserString }}</div>
              </div>
              <div class="sys-detail-field">
                <div class="sys-detail-field__label">操作时间</div>
                <div class="sys-detail-field__value sys-detail-field__value--small">{{ detail.createTime }}</div>
              </div>
            </div>
          </section>
          <section class="sys-detail-section">
            <div class="sys-detail-section__title">
              <SvgIcon icon="mdi:earth" class="sys-detail-section__icon" />
              请求信息
            </div>
            <div class="sys-detail-grid">
              <div class="sys-detail-field">
                <div class="sys-detail-field__label">IP</div>
                <div class="sys-detail-field__value">{{ detail.ip }}</div>
              </div>
              <div class="sys-detail-field">
                <div class="sys-detail-field__label">地址</div>
                <div class="sys-detail-field__value">{{ detail.address }}</div>
              </div>
              <div class="sys-detail-field">
                <div class="sys-detail-field__label">浏览器</div>
                <div class="sys-detail-field__value">{{ detail.browser }}</div>
              </div>
              <div class="sys-detail-field">
                <div class="sys-detail-field__label">操作系统</div>
                <div class="sys-detail-field__value">{{ detail.os }}</div>
              </div>
              <div class="sys-detail-field">
                <div class="sys-detail-field__label">请求方法</div>
                <div class="sys-detail-field__value">{{ detail.requestMethod }}</div>
              </div>
              <div class="sys-detail-field">
                <div class="sys-detail-field__label">请求地址</div>
                <div class="sys-detail-field__value">{{ detail.requestUrl }}</div>
              </div>
              <div class="sys-detail-field sys-detail-field--full">
                <div class="sys-detail-field__label">TraceId</div>
                <div class="sys-detail-field__value sys-detail-field__value--mono">{{ detail.traceId }}</div>
              </div>
            </div>
          </section>
          <section class="sys-detail-section">
            <div class="sys-detail-section__title">
              <SvgIcon icon="mdi:code-braces" class="sys-detail-section__icon" />
              请求与响应
            </div>
            <div class="sys-detail-field">
              <div class="sys-detail-field__label">请求体</div>
              <p class="sys-code-block">{{ detail.requestBody || '无' }}</p>
            </div>
            <div class="sys-detail-field" style="margin-top: 10px">
              <div class="sys-detail-field__label">响应体</div>
              <p class="sys-code-block">{{ detail.responseBody || '无' }}</p>
            </div>
            <div class="sys-detail-field" style="margin-top: 10px">
              <div class="sys-detail-field__label">错误信息</div>
              <p class="sys-code-block">{{ detail.errorMsg || '无' }}</p>
            </div>
          </section>
        </div>
      </div>
    </NModal>
  </div>
</template>
