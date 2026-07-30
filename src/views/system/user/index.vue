<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue';
import {
  NButton,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NPopconfirm,
  NSpace,
  NSelect,
  type DataTableColumns
} from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import {
  fetchUserPage,
  fetchUserCreate,
  fetchUserUpdate,
  fetchUserDelete,
  fetchUserDetail,
  fetchUserResetPassword
} from '@/service/api/system';

defineOptions({ name: 'UserManage' });

// ==================== 状态 ====================
const loading = ref(false);
const tableData = ref<Api.System.UserItem[]>([]);
const total = ref(0);
const query = reactive<Api.System.UserQuery>({ page: 1, size: 10 });

// 弹窗
const modalVisible = ref(false);
const modalTitle = ref('新增用户');
const formData = reactive<Api.System.UserForm>({
  username: '',
  nickname: '',
  gender: 0,
  status: 1,
  email: '',
  phone: '',
  description: '',
  deptId: undefined,
  roleIds: []
});
const editId = ref<number | null>(null);

// 重置密码弹窗
const passwordModalVisible = ref(false);
const passwordUserId = ref<number | null>(null);
const passwordValue = ref('');

// ==================== 单元格渲染 ====================
function renderUserCell(row: Api.System.UserItem) {
  return h('div', { class: 'sys-cell' }, [
    h(SvgIcon, { icon: 'mdi:account-circle', class: 'sys-cell__icon' }),
    h('div', { class: 'sys-cell__content' }, [
      h('div', { class: 'sys-cell__title' }, row.username),
      h('div', { class: 'sys-cell__sub' }, row.nickname || row.email || '—')
    ])
  ]);
}

function renderStatusTag(status: number) {
  const ok = status === 1;
  return h('span', { class: `sys-status-tag sys-status-tag--${ok ? 'success' : 'default'}` }, ok ? '启用' : '禁用');
}

function renderActions(row: Api.System.UserItem) {
  return h('div', { class: 'action-group' }, [
    h('div', { class: 'action-icon-btn', 'data-tooltip': '编辑', onClick: () => handleEdit(row) }, [
      h(SvgIcon, { icon: 'mdi:pencil-outline' })
    ]),
    h('div', { class: 'action-icon-btn', 'data-tooltip': '重置密码', onClick: () => handleResetPassword(row) }, [
      h(SvgIcon, { icon: 'mdi:key-variant' })
    ]),
    h(
      NPopconfirm,
      { onPositiveClick: () => handleDelete(row.id) },
      {
        trigger: () =>
          h('div', { class: 'action-icon-btn action-icon-btn--danger', 'data-tooltip': '删除' }, [
            h(SvgIcon, { icon: 'mdi:trash-can-outline' })
          ]),
        default: () => '确认删除该用户？'
      }
    )
  ]);
}

// ==================== 表格 ====================
const columns: DataTableColumns<Api.System.UserItem> = [
  { title: '用户名', key: 'username', width: 200, render: renderUserCell },
  { title: '邮箱', key: 'email', width: 180, ellipsis: { tooltip: true } },
  { title: '手机号', key: 'phone', width: 130 },
  { title: '部门', key: 'deptName', width: 120 },
  { title: '状态', key: 'status', width: 90, render: row => renderStatusTag(row.status) },
  { title: '创建时间', key: 'createTime', width: 170 },
  {
    title: '操作',
    key: 'actions',
    width: 130,
    align: 'center',
    render: renderActions
  }
];

const rowKey = (row: Api.System.UserItem) => row.id;

// ==================== 数据加载 ====================
async function loadData() {
  loading.value = true;
  try {
    const { data, error } = await fetchUserPage(query);
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

// ==================== 新增/编辑 ====================
function handleCreate() {
  editId.value = null;
  modalTitle.value = '新增用户';
  Object.assign(formData, {
    username: '',
    nickname: '',
    gender: 0,
    email: '',
    phone: '',
    description: '',
    status: 1,
    deptId: undefined,
    roleIds: []
  });
  modalVisible.value = true;
}

async function handleEdit(row: Api.System.UserItem) {
  editId.value = row.id;
  modalTitle.value = '编辑用户';
  const { data } = await fetchUserDetail(row.id);
  if (data) {
    Object.assign(formData, {
      username: data.username,
      nickname: data.nickname,
      gender: data.gender,
      email: data.email || '',
      phone: data.phone || '',
      description: data.description || '',
      status: data.status,
      deptId: data.deptId,
      roleIds: data.roleIds || []
    });
  }
  modalVisible.value = true;
}

async function handleSubmit() {
  const { error } = editId.value
    ? await fetchUserUpdate(editId.value, { ...formData })
    : await fetchUserCreate({ ...formData });
  if (!error) {
    modalVisible.value = false;
    window.$message?.success(editId.value ? '编辑成功' : '新增成功');
    loadData();
  }
}

// ==================== 删除 ====================
async function handleDelete(id: number) {
  const { error } = await fetchUserDelete([id]);
  if (!error) {
    window.$message?.success('删除成功');
    loadData();
  }
}

// ==================== 重置密码 ====================
function handleResetPassword(row: Api.System.UserItem) {
  passwordUserId.value = row.id;
  passwordValue.value = '';
  passwordModalVisible.value = true;
}

async function handlePasswordSubmit() {
  if (!passwordUserId.value || !passwordValue.value) return;
  const { error } = await fetchUserResetPassword(passwordUserId.value, passwordValue.value);
  if (!error) {
    passwordModalVisible.value = false;
    window.$message?.success('密码重置成功');
  }
}

// ==================== 搜索 ====================
function handleSearch() {
  query.page = 1;
  loadData();
}

const genderOptions = [
  { label: '未知', value: 0 },
  { label: '男', value: 1 },
  { label: '女', value: 2 }
];

const statusOptions = [
  { label: '启用', value: 1 },
  { label: '禁用', value: 0 }
];
</script>

<template>
  <div class="sys-page">
    <!-- 搜索卡片 -->
    <section class="sys-search-card">
      <div class="sys-search-fields">
        <NInput v-model:value="query.username" placeholder="用户名" clearable @keyup.enter="handleSearch" />
        <NInput v-model:value="query.nickname" placeholder="昵称" clearable @keyup.enter="handleSearch" />
        <NSelect v-model:value="query.status" placeholder="状态" clearable :options="statusOptions" />
        <NButton type="primary" @click="handleSearch">
          <template #icon>
            <SvgIcon icon="mdi:magnify" />
          </template>
          搜索
        </NButton>
        <NButton
          @click="
            query.username = '';
            query.nickname = '';
            query.status = undefined;
            handleSearch();
          "
        >
          重置
        </NButton>
      </div>
      <div class="sys-search-actions">
        <NButton type="primary" @click="handleCreate">
          <template #icon>
            <SvgIcon icon="mdi:account-plus" />
          </template>
          新增用户
        </NButton>
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

    <!-- 新增/编辑弹窗 -->
    <NModal
      v-model:show="modalVisible"
      :title="modalTitle"
      preset="card"
      class="sys-modal"
      style="width: 540px"
      :loading="false"
    >
      <NForm label-placement="left" label-width="80px" :model="formData">
        <NFormItem label="用户名" required>
          <NInput v-model:value="formData.username" :disabled="!!editId" placeholder="请输入用户名" />
        </NFormItem>
        <NFormItem label="昵称" required>
          <NInput v-model:value="formData.nickname" placeholder="请输入昵称" />
        </NFormItem>
        <NFormItem label="性别">
          <NSelect v-model:value="formData.gender" :options="genderOptions" placeholder="请选择性别" />
        </NFormItem>
        <NFormItem label="邮箱">
          <NInput v-model:value="formData.email" placeholder="请输入邮箱" />
        </NFormItem>
        <NFormItem label="手机号">
          <NInput v-model:value="formData.phone" placeholder="请输入手机号" />
        </NFormItem>
        <NFormItem label="描述">
          <NInput v-model:value="formData.description" type="textarea" placeholder="请输入描述" />
        </NFormItem>
        <NFormItem label="状态">
          <NSelect v-model:value="formData.status" :options="statusOptions" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="modalVisible = false">取消</NButton>
          <NButton type="primary" @click="handleSubmit">确定</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 重置密码弹窗 -->
    <NModal v-model:show="passwordModalVisible" title="重置密码" preset="card" class="sys-modal" style="width: 400px">
      <NForm label-placement="left" label-width="80px">
        <NFormItem label="新密码" required>
          <NInput v-model:value="passwordValue" type="password" placeholder="请输入新密码" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="passwordModalVisible = false">取消</NButton>
          <NButton type="primary" @click="handlePasswordSubmit">确定</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
.sys-page {
  --sys-bg:
    radial-gradient(circle at top, rgba(0, 153, 255, 0.14) 0%, transparent 36%),
    linear-gradient(180deg, #041528 0%, #041120 38%, #03101b 100%);
  --sys-surface: linear-gradient(180deg, rgba(3, 19, 41, 0.94) 0%, rgba(2, 15, 32, 0.96) 100%);
  --sys-border: rgba(43, 131, 255, 0.28);
  --sys-line: rgba(25, 95, 176, 0.35);
  --sys-text: #eaf5ff;
  --sys-text2: rgba(203, 227, 255, 0.72);
  --sys-text3: rgba(147, 196, 255, 0.62);
  --sys-accent: #29a3ff;
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
    0 0 0 1px rgba(32, 111, 202, 0.22),
    0 18px 40px rgba(1, 8, 18, 0.45);
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
    0 0 0 1px rgba(32, 111, 202, 0.22),
    0 18px 40px rgba(1, 8, 18, 0.45);
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
    background: rgba(34, 197, 94, 0.15);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: rgba(74, 222, 128, 0.9);
  }
  &--warning {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: rgba(251, 191, 36, 0.9);
  }
  &--default {
    background: rgba(148, 163, 184, 0.12);
    border: 1px solid rgba(148, 163, 184, 0.2);
    color: rgba(203, 213, 225, 0.7);
  }
}

.sys-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  &__icon {
    flex-shrink: 0;
    font-size: 22px;
    color: #62c4ff;
    filter: drop-shadow(0 0 4px rgba(98, 196, 255, 0.25));
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

// Table
.sys-table {
  --n-th-color: rgba(6, 29, 56, 0.94) !important;
  --n-td-color: transparent !important;
  --n-td-color-hover: rgba(33, 116, 212, 0.14) !important;
  --n-border-color: rgba(25, 95, 176, 0.35) !important;
  --n-th-text-color: rgba(203, 227, 255, 0.72) !important;
  --n-td-text-color: rgba(203, 227, 255, 0.72) !important;
  --n-th-font-weight: 600 !important;
  --n-font-size: 13px !important;
}
.sys-table :deep(.n-data-table-th) {
  background: linear-gradient(180deg, rgba(6, 29, 56, 0.94) 0%, rgba(4, 22, 43, 0.94) 100%) !important;
  font-size: 13px;
  padding: 14px 12px;
}
.sys-table :deep(.n-data-table-td) {
  padding: 14px 12px;
  border-bottom: 1px solid rgba(18, 73, 135, 0.32) !important;
}
.sys-table :deep(.n-data-table-table) {
  border-collapse: separate;
  border-spacing: 0;
}
.sys-table :deep(.n-data-table-tr:hover .n-data-table-td) {
  background: rgba(33, 116, 212, 0.14) !important;
}
.sys-table :deep(.n-data-table-base-table-body::-webkit-scrollbar) {
  width: 8px;
}
.sys-table :deep(.n-data-table-base-table-body::-webkit-scrollbar-thumb) {
  border-radius: 999px;
  background: rgba(76, 169, 255, 0.35);
}
.sys-table :deep(.n-data-table-base-table-body::-webkit-scrollbar-track) {
  background: transparent;
}
// Pagination
.sys-table :deep(.n-data-table__pagination) {
  border-top: 1px solid var(--sys-line);
  background: linear-gradient(180deg, rgba(4, 21, 41, 0.98) 0%, rgba(4, 18, 34, 0.98) 100%);
  min-height: 52px;
  padding: 8px 14px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.sys-table :deep(.n-pagination) {
  --n-item-text-color: rgba(203, 227, 255, 0.78) !important;
  --n-item-text-color-hover: #fff !important;
  --n-item-text-color-active: #fff !important;
  --n-item-color-active: linear-gradient(180deg, rgba(23, 115, 230, 0.72) 0%, rgba(10, 72, 148, 0.72) 100%) !important;
  --n-item-border-active: 1px solid rgba(92, 184, 255, 0.55) !important;
  --n-item-color: rgba(8, 28, 56, 0.85) !important;
  --n-item-border: 1px solid rgba(48, 115, 190, 0.36) !important;
  --n-item-border-hover: 1px solid rgba(76, 169, 255, 0.5) !important;
  --n-item-color-hover: rgba(14, 42, 88, 0.92) !important;
  --n-item-border-radius: 5px !important;
  --n-input-border: 1px solid rgba(48, 115, 190, 0.36) !important;
  --n-input-border-hover: 1px solid rgba(76, 169, 255, 0.5) !important;
  font-size: 13px;
}
.sys-table :deep(.n-pagination .n-pagination-item) {
  min-width: 30px;
  height: 30px;
  border-radius: 5px;
  font-size: 13px;
  transition: all 0.2s;
}
.sys-table :deep(.n-pagination .n-pagination-item:hover) {
  border-color: rgba(76, 169, 255, 0.5);
  color: #fff;
  background: rgba(14, 42, 88, 0.92);
  transform: translateY(-1px);
}
.sys-table :deep(.n-pagination .n-pagination-item--active) {
  box-shadow: 0 2px 10px rgba(41, 163, 255, 0.25);
  font-weight: 600;
}
.sys-table :deep(.n-pagination .n-pagination-item--disabled) {
  opacity: 0.45;
}
// Action buttons
.sys-table :deep(.action-group) {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
}
.sys-table :deep(.action-icon-btn) {
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
  font-size: 16px;
}
.sys-table :deep(.action-icon-btn:hover) {
  color: #fff;
  background: rgba(41, 163, 255, 0.18);
  border-color: rgba(41, 163, 255, 0.35);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(41, 163, 255, 0.2);
}
.sys-table :deep(.action-icon-btn::after) {
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
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  z-index: 10;
}
.sys-table :deep(.action-icon-btn:hover::after) {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
.sys-table :deep(.action-icon-btn--danger) {
  background: rgba(255, 107, 107, 0.05);
  border-color: rgba(255, 107, 107, 0.12);
  color: rgba(255, 141, 141, 0.7);
}
.sys-table :deep(.action-icon-btn--danger:hover) {
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.15);
  border-color: rgba(255, 107, 107, 0.35);
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.18);
}
// Inputs
.sys-search-card :deep(.n-input) {
  --n-border: 1px solid rgba(43, 118, 197, 0.38);
  --n-border-hover: 1px solid rgba(58, 160, 255, 0.5);
  --n-border-focus: 1px solid rgba(58, 160, 255, 0.65);
  --n-color: rgba(2, 16, 31, 0.98);
  --n-text-color: #eaf5ff;
  --n-placeholder-color: rgba(132, 177, 233, 0.45);
  --n-height: 36px;
  --n-border-radius: 8px;
  width: 150px;
}
.sys-search-card :deep(.n-input__border),
.sys-search-card :deep(.n-input__state-border) {
  display: none;
}
.sys-search-card :deep(.n-base-selection) {
  --n-border: 1px solid rgba(43, 118, 197, 0.38);
  --n-color: rgba(2, 16, 31, 0.98);
  height: 36px;
  border-radius: 8px;
}
.sys-search-card :deep(.n-base-selection-label) {
  color: var(--sys-text);
}
.sys-search-card :deep(.n-button--primary-type) {
  --n-color: linear-gradient(180deg, rgba(23, 131, 240, 0.96) 0%, rgba(8, 83, 171, 0.96) 100%);
  --n-color-hover: linear-gradient(180deg, rgba(43, 151, 255, 0.98) 0%, rgba(13, 93, 186, 0.98) 100%);
  --n-text-color: #e9f5ff;
  --n-text-color-hover: #fff;
  --n-border: 1px solid rgba(96, 191, 255, 0.32);
  --n-border-hover: 1px solid rgba(96, 191, 255, 0.5);
  --n-border-radius: 8px;
  --n-font-size: 13px;
  --n-height: 36px;
  font-weight: 600;
}
.sys-search-card :deep(.n-button--default-type) {
  --n-color: linear-gradient(180deg, rgba(9, 43, 82, 0.94) 0%, rgba(5, 23, 46, 0.96) 100%);
  --n-color-hover: linear-gradient(180deg, rgba(14, 53, 102, 0.96) 0%, rgba(8, 33, 66, 0.96) 100%);
  --n-text-color: rgba(203, 227, 255, 0.85);
  --n-text-color-hover: #e9f5ff;
  --n-border: 1px solid rgba(43, 118, 197, 0.35);
  --n-border-hover: 1px solid rgba(58, 160, 255, 0.5);
  --n-border-radius: 8px;
  --n-font-size: 13px;
  --n-height: 36px;
}
// Modal
:deep(.n-modal-mask) {
  background: rgba(2, 8, 18, 0.62);
  backdrop-filter: blur(2px);
}
:deep(.n-card) {
  --n-color: linear-gradient(180deg, rgba(4, 22, 46, 0.98) 0%, rgba(3, 16, 35, 0.99) 100%) !important;
  --n-border-color: rgba(43, 131, 255, 0.32) !important;
  --n-text-color: #eaf5ff !important;
  --n-title-text-color: #eaf5ff !important;
  --n-close-color: rgba(203, 227, 255, 0.72) !important;
  --n-close-color-hover: #29a3ff !important;
  --n-border-radius: 8px !important;
  overflow: hidden;
  box-shadow:
    0 0 0 1px rgba(32, 111, 202, 0.18),
    0 24px 64px rgba(1, 6, 16, 0.7),
    0 0 80px rgba(41, 163, 255, 0.06) !important;
}
:deep(.n-card-header) {
  padding: 20px 24px 16px !important;
  border-bottom: 1px solid rgba(25, 95, 176, 0.35);
  background: linear-gradient(180deg, rgba(8, 36, 68, 0.96) 0%, rgba(4, 22, 46, 0.96) 100%);
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
  background: linear-gradient(180deg, transparent, #29a3ff, transparent);
  opacity: 0.6;
}
:deep(.n-card-header__main) {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-shadow: 0 0 10px rgba(41, 163, 255, 0.12);
}
:deep(.n-card-header__close) {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid rgba(45, 111, 183, 0.28);
  background: rgba(6, 25, 50, 0.6);
  display: grid;
  place-items: center;
}
:deep(.n-card-header__close:hover) {
  border-color: rgba(70, 176, 255, 0.4);
  background: rgba(41, 163, 255, 0.08);
}
:deep(.n-card__content) {
  padding: 20px 24px 24px;
}
:deep(.n-card__content::-webkit-scrollbar) {
  width: 6px;
}
:deep(.n-card__content::-webkit-scrollbar-thumb) {
  border-radius: 999px;
  background: rgba(48, 127, 212, 0.45);
}
:deep(.n-card__content::-webkit-scrollbar-track) {
  background: transparent;
}
:deep(.n-card .n-input) {
  --n-border: 1px solid rgba(43, 118, 197, 0.38);
  --n-color: rgba(2, 16, 31, 0.98);
  --n-text-color: #eaf5ff;
}
:deep(.n-card .n-input__border),
:deep(.n-card .n-input__state-border) {
  display: none;
}
:deep(.n-card .n-base-selection) {
  --n-border: 1px solid rgba(43, 118, 197, 0.38);
  --n-color: rgba(2, 16, 31, 0.98);
}
:deep(.n-card .n-base-selection-label) {
  color: #eaf5ff;
}
:deep(.n-card .n-form-item-label) {
  color: rgba(203, 227, 255, 0.72);
}
:deep(.n-card .n-button--primary-type) {
  --n-color: linear-gradient(180deg, rgba(23, 131, 240, 0.96) 0%, rgba(8, 83, 171, 0.96) 100%);
  --n-color-hover: linear-gradient(180deg, rgba(43, 151, 255, 0.98) 0%, rgba(13, 93, 186, 0.98) 100%);
  --n-text-color: #e9f5ff;
  --n-text-color-hover: #fff;
  --n-border: 1px solid rgba(96, 191, 255, 0.32);
  --n-border-radius: 8px;
  --n-font-size: 13px;
  --n-height: 36px;
  font-weight: 600;
}
:deep(.n-card .n-button--default-type) {
  background: linear-gradient(180deg, rgba(9, 43, 82, 0.94) 0%, rgba(5, 23, 46, 0.96) 100%);
  --n-text-color: rgba(203, 227, 255, 0.85);
  --n-border: 1px solid rgba(43, 118, 197, 0.35);
  --n-border-radius: 8px;
  --n-font-size: 13px;
  --n-height: 36px;
}
</style>
