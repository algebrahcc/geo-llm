<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
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
const loadError = ref(false);
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
          h(
            'button',
            {
              type: 'button',
              class: 'sys-action-btn',
              'aria-label': '编辑',
              onClick: () => handleEdit(row)
            },
            [h(SvgIcon, { icon: 'mdi:pencil-outline', class: 'sys-action-btn__svg' })]
          ),
        default: () => '编辑'
      }
    ),
    h(
      NTooltip,
      { placement: 'bottom' },
      {
        trigger: () =>
          h(
            'button',
            {
              type: 'button',
              class: 'sys-action-btn',
              'aria-label': '分配权限',
              onClick: () => handleAssignPermission(row)
            },
            [h(SvgIcon, { icon: 'mdi:key-chain', class: 'sys-action-btn__svg' })]
          ),
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
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'sys-action-btn sys-action-btn--danger',
                    'aria-label': '删除'
                  },
                  [h(SvgIcon, { icon: 'mdi:trash-can-outline', class: 'sys-action-btn__svg' })]
                ),
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
  {
    title: '排序',
    key: 'sort',
    width: 90,
    align: 'center',
    sorter: (a, b) => (a.sort ?? 0) - (b.sort ?? 0),
    render: row => h('span', { class: 'sys-mono' }, String(row.sort ?? '—'))
  },
  {
    title: '状态',
    key: 'status',
    width: 90,
    align: 'center',
    render: row => renderStatusTag(row.status)
  },
  {
    title: '创建时间',
    key: 'createTime',
    width: 180,
    sorter: (a, b) => new Date(a.createTime || 0).getTime() - new Date(b.createTime || 0).getTime(),
    render: row => h('span', { class: 'sys-mono' }, row.createTime || '—')
  },
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
  loadError.value = false;
  try {
    const { data, error } = await fetchRoleList();
    if (error) {
      loadError.value = true;
      tableData.value = [];
      return;
    }
    if (data) {
      tableData.value = data;
    }
  } catch {
    loadError.value = true;
    tableData.value = [];
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

// ==================== 搜索（角色列表一次性加载，前端即时过滤） ====================
const searchQuery = reactive({ name: '', code: '' });

const filteredTableData = computed(() => {
  const name = searchQuery.name.trim();
  const code = searchQuery.code.trim();
  if (!name && !code) return tableData.value;
  return tableData.value.filter(
    row => (!name || row.name.includes(name)) && (!code || (row.code || '').includes(code))
  );
});

function handleReset() {
  searchQuery.name = '';
  searchQuery.code = '';
}

const statusOptions = [
  { label: '启用', value: 1 },
  { label: '禁用', value: 0 }
];
</script>

<template>
  <div class="sys-page">
    <!-- 筛选工具栏 -->
    <section class="sys-search-card">
      <div class="sys-search-fields">
        <NInput v-model:value="searchQuery.name" placeholder="角色名称" clearable />
        <NInput v-model:value="searchQuery.code" placeholder="角色编码" clearable />
        <NButton @click="handleReset">重置</NButton>
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
      <div v-if="loadError" class="sys-error-bar">
        <SvgIcon icon="mdi:alert-circle-outline" class="sys-error-bar__icon" />
        <span class="sys-error-bar__text">数据加载失败，请稍后重试</span>
        <NButton size="small" @click="loadData">重试</NButton>
      </div>
      <NDataTable
        class="sys-table"
        :columns="columns"
        :data="filteredTableData"
        :loading="loading"
        :row-key="rowKey"
        :bordered="false"
        size="medium"
        style="flex: 1"
        flex-height
      >
        <template #empty>
          <EmptyState icon="mdi:account-star-outline" title="暂无角色" description="没有找到符合条件的角色" />
        </template>
      </NDataTable>
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
