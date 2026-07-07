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
  NTooltip,
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
          h('button', { type: 'button', class: 'sys-action-btn', onClick: () => handleResetPassword(row) }, [
            h(SvgIcon, { icon: 'mdi:key-variant', class: 'sys-action-btn__svg' })
          ]),
        default: () => '重置密码'
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
  { title: '状态', key: 'status', width: 90, render: (row) => renderStatusTag(row.status) },
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
  Object.assign(formData, { username: '', nickname: '', gender: 0, email: '', phone: '', description: '', status: 1, deptId: undefined, roleIds: [] });
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
        <NButton @click="query.username = ''; query.nickname = ''; query.status = undefined; handleSearch()">重置</NButton>
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
    <NModal v-model:show="modalVisible" :title="modalTitle" preset="card" class="sys-modal" style="width: 540px" :loading="false">
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

