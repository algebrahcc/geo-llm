<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue';
import {
  NButton,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NPopconfirm,
  NTooltip,
  NSpace,
  NTree,
  NSelect,
  type DataTableColumns,
  type TreeOption
} from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import {
  fetchRoleList,
  fetchRoleCreate,
  fetchRoleUpdate,
  fetchRoleDelete,
  fetchRoleDetail,
  fetchPermissionTree,
  fetchRoleUpdatePermission
} from '@/service/api/system';

defineOptions({ name: 'RoleManage' });

// ==================== 状态 ====================
const loading = ref(false);
const tableData = ref<Api.System.RoleItem[]>([]);

// 弹窗
const modalVisible = ref(false);
const modalTitle = ref('新增角色');
const formData = reactive<Api.System.RoleForm>({ name: '', code: '', description: '', status: 1, sort: 999 });
const editId = ref<number | null>(null);

// 权限分配弹窗
const permModalVisible = ref(false);
const permRoleId = ref<number | null>(null);
const permRoleName = ref('');
const permTree = ref<Api.System.PermissionTreeNode[]>([]);
const checkedKeys = ref<number[]>([]);

// ==================== 单元格渲染 ====================
function renderRoleCell(row: Api.System.RoleItem) {
  return h('div', { class: 'sys-cell' }, [
    h(SvgIcon, { icon: 'mdi:account-star', class: 'sys-cell__icon' }),
    h('div', { class: 'sys-cell__content' }, [
      h('div', { class: 'sys-cell__title' }, row.name),
      h('div', { class: 'sys-cell__sub' }, row.code || '—')
    ])
  ]);
}

function renderStatusTag(status: number) {
  const ok = status === 1;
  return h('span', { class: `sys-status-tag sys-status-tag--${ok ? 'success' : 'default'}` }, ok ? '启用' : '禁用');
}

function renderActions(row: Api.System.RoleItem) {
  return h('div', { class: 'action-group' }, [
    h(
      NTooltip,
      { placement: 'bottom' },
      {
        trigger: () =>
          h('button', { type: 'button', class: 'sys-action-btn', onClick: () => handleEdit(row) }, [
            h(SvgIcon, { icon: 'mdi:pencil-outline', class: 'sys-action-btn__svg' })
          ]),
        default: () => '编辑'
      }
    ),
    h(
      NTooltip,
      { placement: 'bottom' },
      {
        trigger: () =>
          h('button', { type: 'button', class: 'sys-action-btn', onClick: () => handleAssignPermission(row) }, [
            h(SvgIcon, { icon: 'mdi:key-chain', class: 'sys-action-btn__svg' })
          ]),
        default: () => '分配权限'
      }
    ),
    h(
      NPopconfirm,
      { onPositiveClick: () => handleDelete(row.id) },
      {
        trigger: () =>
          h(
            NTooltip,
            { placement: 'bottom' },
            {
              trigger: () =>
                h('button', { type: 'button', class: 'sys-action-btn sys-action-btn--danger' }, [
                  h(SvgIcon, { icon: 'mdi:trash-can-outline', class: 'sys-action-btn__svg' })
                ]),
              default: () => '删除'
            }
          ),
        default: () => '确认删除该角色？'
      }
    )
  ]);
}

// ==================== 表格 ====================
const columns: DataTableColumns<Api.System.RoleItem> = [
  { title: '名称', key: 'name', width: 200, render: renderRoleCell },
  { title: '描述', key: 'description', width: 200, ellipsis: { tooltip: true } },
  { title: '排序', key: 'sort', width: 70, align: 'center' },
  {
    title: '状态',
    key: 'status',
    width: 90,
    align: 'center',
    render: row => renderStatusTag(row.status)
  },
  { title: '创建时间', key: 'createTime', width: 170 },
  {
    title: '操作',
    key: 'actions',
    width: 130,
    align: 'center',
    render: renderActions
  }
];

const rowKey = (row: Api.System.RoleItem) => row.id;

// ==================== 数据加载 ====================
async function loadData() {
  loading.value = true;
  try {
    const { data } = await fetchRoleList();
    if (data) {
      tableData.value = data;
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadData();
});

// ==================== 新增/编辑 ====================
function handleCreate() {
  editId.value = null;
  modalTitle.value = '新增角色';
  Object.assign(formData, { name: '', code: '', description: '', status: 1, sort: 999 });
  modalVisible.value = true;
}

async function handleEdit(row: Api.System.RoleItem) {
  editId.value = row.id;
  modalTitle.value = '编辑角色';
  const { data } = await fetchRoleDetail(row.id);
  if (data) {
    Object.assign(formData, {
      name: data.name,
      code: data.code,
      description: data.description || '',
      status: data.status,
      sort: data.sort
    });
  }
  modalVisible.value = true;
}

async function handleSubmit() {
  const { error } = editId.value
    ? await fetchRoleUpdate(editId.value, { ...formData })
    : await fetchRoleCreate({ ...formData });
  if (!error) {
    modalVisible.value = false;
    window.$message?.success(editId.value ? '编辑成功' : '新增成功');
    loadData();
  }
}

// ==================== 删除 ====================
async function handleDelete(id: number) {
  const { error } = await fetchRoleDelete([id]);
  if (!error) {
    window.$message?.success('删除成功');
    loadData();
  }
}

// ==================== 权限分配 ====================
async function handleAssignPermission(row: Api.System.RoleItem) {
  permRoleId.value = row.id;
  permRoleName.value = row.name;

  // 加载权限树
  const { data: treeData } = await fetchPermissionTree();
  if (treeData) {
    permTree.value = treeData;
  }

  // 加载已选中的菜单 ID
  const { data: detail } = await fetchRoleDetail(row.id);
  checkedKeys.value = detail?.menuIds || [];

  permModalVisible.value = true;
}

async function handlePermSubmit() {
  if (permRoleId.value === null) return;
  const { error } = await fetchRoleUpdatePermission(permRoleId.value, checkedKeys.value);
  if (!error) {
    permModalVisible.value = false;
    window.$message?.success('权限分配成功');
  }
}

function getTreeOptions(nodes: Api.System.PermissionTreeNode[]): TreeOption[] {
  return nodes.map(node => ({
    key: node.id,
    label: `${node.title} ${node.permission ? `(${node.permission})` : ''}`,
    children: node.children?.length ? getTreeOptions(node.children) : undefined
  }));
}

// ==================== 搜索 ====================
const searchQuery = reactive({ name: '', code: '' });
// 角色列表一次性加载，前端过滤

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
        <NInput v-model:value="searchQuery.name" placeholder="角色名称" clearable />
        <NInput v-model:value="searchQuery.code" placeholder="角色编码" clearable />
        <NButton type="primary" @click="loadData">
          <template #icon>
            <SvgIcon icon="mdi:magnify" />
          </template>
          搜索
        </NButton>
      </div>
      <div class="sys-search-actions">
        <NButton type="primary" @click="handleCreate">
          <template #icon>
            <SvgIcon icon="mdi:account-star" />
          </template>
          新增角色
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
        :bordered="false"
        size="medium"
        style="flex: 1"
        flex-height
      />
    </section>

    <!-- 新增/编辑弹窗 -->
    <NModal v-model:show="modalVisible" :title="modalTitle" preset="card" class="sys-modal" style="width: 500px">
      <NForm label-placement="left" label-width="80px" :model="formData">
        <NFormItem label="名称" required>
          <NInput v-model:value="formData.name" placeholder="请输入角色名称" />
        </NFormItem>
        <NFormItem label="编码" required>
          <NInput v-model:value="formData.code" :disabled="!!editId" placeholder="请输入角色编码" />
        </NFormItem>
        <NFormItem label="描述">
          <NInput v-model:value="formData.description" type="textarea" placeholder="请输入描述" />
        </NFormItem>
        <NFormItem label="排序">
          <NInputNumber v-model:value="formData.sort" :min="0" style="width: 100%" />
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

    <!-- 权限分配弹窗 -->
    <NModal
      v-model:show="permModalVisible"
      :title="`分配权限 - ${permRoleName}`"
      preset="card"
      class="sys-modal"
      style="width: 560px"
    >
      <div class="sys-detail-card" style="max-height: 420px; overflow-y: auto">
        <NTree
          v-model:checked-keys="checkedKeys"
          :data="getTreeOptions(permTree)"
          checkable
          cascade-check
          :default-expand-all="false"
          block-line
        />
      </div>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="permModalVisible = false">取消</NButton>
          <NButton type="primary" @click="handlePermSubmit">确定</NButton>
        </NSpace>
      </template>
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
  min-width: 56px;
  height: 24px;
  padding: 0 11px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1;
  font-weight: 500;
  &--success {
    background: var(--ui-border-25);
    border: 1px solid var(--ui-border-26);
    color: var(--ui-accent-27);
  }
  &--warning {
    background: var(--ui-border-27);
    border: 1px solid var(--ui-border-28);
    color: var(--ui-accent-28);
  }
  &--default {
    background: var(--ui-accent-156);
    border: 1px solid var(--ui-accent-157);
    color: var(--ui-text-110);
  }
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
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.2px;
  }
  &__sub {
    color: var(--sys-text3);
    font-size: 13px;
  }
}

.sys-action-btn {
  width: 34px;
  height: 34px;
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
    font-size: 18px;
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
  --n-font-size: 14px !important;
}
.sys-table :deep(.n-data-table-th) {
  background: linear-gradient(180deg, var(--ui-surface-20) 0%, var(--ui-surface-21) 100%) !important;
  font-size: 14px;
  letter-spacing: 0.2px;
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
  --n-font-size: 14px;
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
  --n-font-size: 14px;
  --n-height: 36px;
}
</style>
