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
