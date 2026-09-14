<script setup lang="ts">
import { h, reactive, ref } from 'vue';
import {
  NButton,
  NDataTable,
  NDropdown,
  NInput,
  NModal,
  NPagination,
  NSelect,
  type DataTableColumns,
  type DropdownOption
} from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { fetchLogPage, fetchLogDetail, exportLoginLog, exportOperationLog } from '@/service/api/monitor';
import { usePagination } from '@/hooks/common/use-pagination';

defineOptions({ name: 'LogManage' });

const query = reactive<Api.Monitor.LogQuery>({ page: 1, size: 10, sort: 'createTime,desc' });
const { loading, tableData, total, loadData, onPageChange, onPageSizeChange } = usePagination({
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
        h('div', { class: 'action-icon-btn', 'data-tooltip': '详情', onClick: () => handleDetail(row.id) }, [
          h(SvgIcon, { icon: 'mdi:information-outline' })
        ])
      ]);
    }
  }
];

const rowKey = (row: Api.Monitor.LogItem) => row.id;

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
        <NDropdown trigger="click" :options="exportOptions" @select="handleExportSelect">
          <NButton>
            <template #icon><SvgIcon icon="mdi:download" /></template>
            导出日志
          </NButton>
        </NDropdown>
      </div>
    </section>

    <section class="sys-content-card">
      <NDataTable
        class="sys-table"
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

    <!-- 详情弹窗 — matching vector design -->
    <NModal v-model:show="detailVisible" class="sys-detail-modal" :close-on-esc="true">
      <div v-if="detail" class="sys-detail-card">
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
          <button class="sys-detail-close-btn" @click="detailVisible = false">
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

.sys-status-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 52px;
  height: 22px;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 1;
  font-weight: 500;
  &--success {
    background: var(--ui-border-25);
    border: 1px solid var(--ui-border-26);
    color: var(--ui-accent-27);
  }
  &--error {
    background: var(--ui-accent-38);
    border: 1px solid var(--ui-accent-70);
    color: var(--ui-text-69);
  }
  &--default {
    background: var(--ui-accent-156);
    border: 1px solid var(--ui-accent-157);
    color: var(--ui-text-110);
  }
}

.sys-muted-text {
  font-size: 12px;
  color: var(--sys-text3);
}

.sys-table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--sys-line);
  background: linear-gradient(180deg, var(--ui-surface-7) 0%, var(--ui-surface-23) 100%);
  min-height: 48px;
  padding: 8px 14px;
  gap: 12px;
  &__total {
    font-size: 13px;
    color: var(--sys-text2);
  }
}

.sys-code-block {
  margin: 0;
  padding: 8px 10px;
  border-radius: 4px;
  background: var(--ui-surface-31);
  border: 1px solid var(--ui-border-49);
  color: var(--sys-text2);
  font-size: 12px;
  font-family: Consolas, DIN, monospace;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 180px;
  overflow-y: auto;
}

// Table
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
.sys-table :deep(.n-data-table-tr:hover .n-data-table-td) {
  background: var(--ui-border-23) !important;
}
.sys-table :deep(.n-data-table-base-table-body::-webkit-scrollbar) {
  width: 8px;
}
.sys-table :deep(.n-data-table-base-table-body::-webkit-scrollbar-thumb) {
  border-radius: 999px;
  background: var(--ui-accent-158);
}
.sys-table :deep(.n-data-table-base-table-body::-webkit-scrollbar-track) {
  background: transparent;
}
.sys-table :deep(.action-icon-btn) {
  position: relative;
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
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: inherit;
  outline: none;
  font-size: 16px;
}
.sys-table :deep(.action-icon-btn:hover) {
  color: #fff;
  background: var(--ui-border-37);
  border-color: var(--ui-border-38);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--ui-border-39);
}
.sys-table :deep(.action-icon-btn::after) {
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
  font-size: 11px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  z-index: 10;
}
.sys-table :deep(.action-icon-btn:hover::after) {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.sys-table-footer :deep(.n-pagination) {
  --n-item-text-color: var(--ui-text-111) !important;
  --n-item-text-color-hover: #fff !important;
  --n-item-text-color-active: #fff !important;
  --n-item-color-active: linear-gradient(180deg, var(--ui-accent-93) 0%, var(--ui-accent-94) 100%) !important;
  --n-item-border-active: 1px solid var(--ui-accent-95) !important;
  --n-item-color: var(--ui-surface-56) !important;
  --n-item-border: 1px solid var(--ui-border-99) !important;
  --n-item-border-hover: 1px solid var(--ui-accent-96) !important;
  --n-item-color-hover: var(--ui-accent-97) !important;
  --n-item-border-radius: 5px !important;
  font-size: 13px;
}
.sys-table-footer :deep(.n-pagination-item) {
  min-width: 30px;
  height: 30px;
  border-radius: 5px;
  font-size: 13px;
  transition: all 0.2s;
}
.sys-table-footer :deep(.n-pagination-item:hover) {
  border-color: var(--ui-accent-96);
  color: #fff;
  transform: translateY(-1px);
}
.sys-table-footer :deep(.n-pagination-item--active) {
  box-shadow: 0 2px 10px var(--ui-border-40);
  font-weight: 600;
}
.sys-table-footer :deep(.n-pagination-item--disabled) {
  opacity: 0.45;
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
  width: 150px;
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

// Modal
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
  --n-padding-top: 0 !important;
  --n-padding-bottom: 0 !important;
  --n-padding-left: 0 !important;
  --n-padding-right: 0 !important;
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

// Detail card inside modal
.sys-detail-modal {
  --n-border-radius: 8px;
}
.sys-detail-card {
  width: 900px;
  max-width: 95vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
  background: linear-gradient(180deg, var(--ui-surface-26) 0%, var(--ui-surface-27) 100%);
  border: 1px solid var(--ui-border-43);
  box-shadow:
    0 0 0 1px var(--ui-border-44),
    0 24px 64px var(--ui-shadow-7),
    0 0 80px var(--ui-border-45);
}
.sys-detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--sys-line);
  background: linear-gradient(180deg, var(--ui-surface-28) 0%, var(--ui-surface-29) 100%);
  position: relative;
}
.sys-detail-header::after {
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
.sys-detail-header__left {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-width: 0;
}
.sys-detail-header__icon {
  flex-shrink: 0;
  font-size: 28px;
  color: var(--ui-accent-46);
  filter: drop-shadow(0 0 8px var(--ui-accent-47));
  margin-top: 2px;
}
.sys-detail-header__text {
  min-width: 0;
}
.sys-detail-header__title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.3px;
  color: var(--sys-text);
  line-height: 1.4;
  text-shadow: 0 0 10px var(--ui-border-7);
}
.sys-detail-header__badges {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.sys-detail-close-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 1px solid var(--ui-border-46);
  border-radius: 6px;
  background: var(--ui-surface-30);
  color: var(--sys-text2);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 18px;
  font-family: inherit;
}
.sys-detail-close-btn:hover {
  color: var(--ui-accent-4);
  border-color: var(--ui-accent-45);
  background: var(--ui-border-36);
}

.sys-detail-body {
  flex: 1;
  min-height: 0;
  padding: 20px 24px 24px;
  overflow-y: auto;
}
.sys-detail-body::-webkit-scrollbar {
  width: 6px;
}
.sys-detail-body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: var(--ui-border-47);
}
.sys-detail-body::-webkit-scrollbar-track {
  background: transparent;
}

.sys-detail-section {
  margin-bottom: 20px;
}
.sys-detail-section:last-child {
  margin-bottom: 0;
}
.sys-detail-section__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--sys-accent);
  letter-spacing: 0.3px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--ui-border-48);
}
.sys-detail-section__icon {
  font-size: 16px;
  opacity: 0.85;
}

.sys-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px 24px;
}
.sys-detail-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.sys-detail-field--full {
  grid-column: 1 / -1;
}
.sys-detail-field__label {
  font-size: 11px;
  color: var(--sys-text3);
  letter-spacing: 0.2px;
}
.sys-detail-field__value {
  font-size: 13px;
  color: var(--sys-text);
  line-height: 1.5;
  word-break: break-all;
}
.sys-detail-field__value--small {
  font-size: 12px;
}
.sys-detail-field__value--mono {
  font-family: DIN, Consolas, monospace;
  font-size: 12px;
  color: var(--ui-text-112);
  letter-spacing: 0.4px;
}
</style>
