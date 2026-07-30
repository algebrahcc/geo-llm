<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue';
import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NPopconfirm,
  NSpace,
  NTag,
  NTree,
  NSelect,
  NSwitch,
  NInputNumber,
  type TreeOption
} from 'naive-ui';
import {
  fetchMenuTree,
  fetchMenuCreate,
  fetchMenuUpdate,
  fetchMenuDelete,
  fetchMenuDetail
} from '@/service/api/system';

defineOptions({ name: 'MenuManage' });

// ==================== 状态 ====================
const loading = ref(false);
const treeData = ref<Api.System.MenuItem[]>([]);
const selectedKey = ref<number | null>(null);
const selectedNode = ref<Api.System.MenuItem | null>(null);

// 弹窗
const modalVisible = ref(false);
const modalTitle = ref('新增菜单');
const isChildMode = ref(false); // true: 新增子节点
const formData = reactive<Api.System.MenuForm>({
  parentId: 0,
  title: '',
  type: 2,
  path: '',
  name: '',
  component: '',
  redirect: '',
  icon: '',
  isExternal: false,
  isCache: false,
  isHidden: false,
  permission: '',
  sort: 999,
  status: 1
});
const editId = ref<number | null>(null);

// ==================== 数据加载 ====================
async function loadData() {
  loading.value = true;
  try {
    const { data } = await fetchMenuTree();
    if (data) {
      treeData.value = data;
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadData();
});

// ==================== 树节点操作 ====================
function handleSelect(keys: number[], option: any) {
  if (keys.length > 0) {
    selectedKey.value = keys[0];
    selectedNode.value = option as unknown as Api.System.MenuItem;
  }
}

async function handleAddRoot() {
  editId.value = null;
  isChildMode.value = false;
  modalTitle.value = '新增根菜单';
  Object.assign(formData, {
    parentId: 0,
    title: '',
    type: 2,
    path: '',
    name: '',
    component: '',
    redirect: '',
    icon: '',
    isExternal: false,
    isCache: false,
    isHidden: false,
    permission: '',
    sort: 999,
    status: 1
  });
  modalVisible.value = true;
}

async function handleAddChild() {
  if (!selectedNode.value) {
    window.$message?.warning('请先选择一个父节点');
    return;
  }
  editId.value = null;
  isChildMode.value = true;
  modalTitle.value = `新增子菜单 - ${selectedNode.value.title}`;
  Object.assign(formData, {
    parentId: selectedNode.value.id,
    title: '',
    type: 2,
    path: '',
    name: '',
    component: '',
    redirect: '',
    icon: '',
    isExternal: false,
    isCache: false,
    isHidden: false,
    permission: '',
    sort: 999,
    status: 1
  });
  modalVisible.value = true;
}

async function handleEdit() {
  if (!selectedNode.value) {
    window.$message?.warning('请先选择一个节点');
    return;
  }
  editId.value = selectedNode.value.id;
  modalTitle.value = `编辑菜单 - ${selectedNode.value.title}`;
  const { data } = await fetchMenuDetail(selectedNode.value.id);
  if (data) {
    Object.assign(formData, {
      parentId: data.parentId,
      title: data.title,
      type: data.type,
      path: data.path || '',
      name: data.name || '',
      component: data.component || '',
      redirect: data.redirect || '',
      icon: data.icon || '',
      isExternal: data.isExternal,
      isCache: data.isCache,
      isHidden: data.isHidden,
      permission: data.permission || '',
      sort: data.sort,
      status: data.status
    });
  }
  modalVisible.value = true;
}

async function handleDelete() {
  if (!selectedNode.value) {
    window.$message?.warning('请先选择一个节点');
    return;
  }
  const { error } = await fetchMenuDelete([selectedNode.value.id]);
  if (!error) {
    window.$message?.success('删除成功');
    selectedKey.value = null;
    selectedNode.value = null;
    loadData();
  }
}

async function handleSubmit() {
  const { error } = editId.value
    ? await fetchMenuUpdate(editId.value, { ...formData })
    : await fetchMenuCreate({ ...formData });
  if (!error) {
    modalVisible.value = false;
    window.$message?.success(editId.value ? '编辑成功' : '新增成功');
    loadData();
  }
}

// ==================== 树节点渲染 ====================
const typeOptions = [
  { label: '目录', value: 1 },
  { label: '菜单', value: 2 },
  { label: '按钮', value: 3 }
];

function getTypeTag(type: number) {
  const map: Record<number, { label: string; type: 'info' | 'success' | 'warning' }> = {
    1: { label: '目录', type: 'info' },
    2: { label: '菜单', type: 'success' },
    3: { label: '按钮', type: 'warning' }
  };
  const item = map[type] || { label: '未知', type: 'info' };
  return h(NTag, { type: item.type, size: 'tiny' }, { default: () => item.label });
}

function buildTree(nodes: Api.System.MenuItem[]): TreeOption[] {
  return nodes.map(node => ({
    key: node.id,
    label: node.title,
    children: node.children?.length ? buildTree(node.children) : undefined,
    prefix: () =>
      h(
        NSpace,
        { size: 4, align: 'center' },
        {
          default: () => [
            getTypeTag(node.type),
            node.permission ? h(NTag, { size: 'tiny', bordered: true }, { default: () => node.permission }) : null,
            node.status === 0 ? h(NTag, { size: 'tiny', type: 'default' }, { default: () => '禁用' }) : null
          ]
        }
      )
  }));
}

const statusOptions = [
  { label: '启用', value: 1 },
  { label: '禁用', value: 0 }
];
</script>

<template>
  <div class="system-page">
    <!-- 工具栏 -->
    <div class="toolbar">
      <NSpace>
        <NButton type="primary" @click="handleAddRoot">新增根菜单</NButton>
        <NButton :disabled="!selectedNode" @click="handleAddChild">新增子菜单</NButton>
        <NButton :disabled="!selectedNode" @click="handleEdit">编辑</NButton>
        <NPopconfirm @positive-click="handleDelete">
          <template #trigger>
            <NButton type="error" :disabled="!selectedNode">删除</NButton>
          </template>
          确认删除该菜单及其子菜单？
        </NPopconfirm>
      </NSpace>
    </div>

    <!-- 菜单树 -->
    <div class="tree-wrapper">
      <NTree
        :data="buildTree(treeData)"
        :loading="loading"
        :selected-keys="selectedKey ? [selectedKey] : []"
        block-line
        expand-on-click
        style="flex: 1; overflow: auto"
        @update:selected-keys="(keys: number[]) => keys.length && handleSelect(keys, undefined)"
      />
    </div>

    <!-- 新增/编辑弹窗 -->
    <NModal
      v-model:show="modalVisible"
      :title="modalTitle"
      preset="dialog"
      style="width: 520px"
      positive-text="确定"
      negative-text="取消"
      @positive-click="handleSubmit"
    >
      <NForm label-placement="left" label-width="80px" :model="formData">
        <NFormItem label="类型" required>
          <NSelect v-model:value="formData.type" :options="typeOptions" />
        </NFormItem>
        <NFormItem label="标题" required>
          <NInput v-model:value="formData.title" />
        </NFormItem>
        <NFormItem v-if="formData.type !== 3" label="路由路径">
          <NInput v-model:value="formData.path" />
        </NFormItem>
        <NFormItem v-if="formData.type === 2" label="组件路径">
          <NInput v-model:value="formData.component" />
        </NFormItem>
        <NFormItem v-if="formData.type !== 3" label="路由名称">
          <NInput v-model:value="formData.name" />
        </NFormItem>
        <NFormItem v-if="formData.type === 1" label="重定向">
          <NInput v-model:value="formData.redirect" />
        </NFormItem>
        <NFormItem v-if="formData.type !== 3" label="图标">
          <NInput v-model:value="formData.icon" />
        </NFormItem>
        <NFormItem label="权限标识">
          <NInput v-model:value="formData.permission" />
        </NFormItem>
        <NFormItem label="排序">
          <NInputNumber v-model:value="formData.sort" style="width: 100%" />
        </NFormItem>
        <NFormItem label="状态">
          <NSelect v-model:value="formData.status" :options="statusOptions" />
        </NFormItem>
        <NFormItem v-if="formData.type !== 3" label="外链">
          <NSwitch v-model:value="formData.isExternal" />
        </NFormItem>
        <NFormItem v-if="formData.type === 2" label="缓存">
          <NSwitch v-model:value="formData.isCache" />
        </NFormItem>
        <NFormItem v-if="formData.type !== 3" label="隐藏">
          <NSwitch v-model:value="formData.isHidden" />
        </NFormItem>
      </NForm>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
.system-page {
  --sys-surface: linear-gradient(180deg, rgba(3, 19, 41, 0.94) 0%, rgba(2, 15, 32, 0.96) 100%);
  --sys-border: rgba(43, 131, 255, 0.28);
  --sys-line: rgba(25, 95, 176, 0.35);
  --sys-text: #eaf5ff;
  --sys-text2: rgba(203, 227, 255, 0.72);
  --sys-text3: rgba(147, 196, 255, 0.62);
  --sys-accent: #29a3ff;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px 14px;
  gap: 10px;
  background:
    radial-gradient(circle at top, rgba(0, 153, 255, 0.14) 0%, transparent 36%),
    linear-gradient(180deg, #041528 0%, #041120 38%, #03101b 100%);
  color: var(--sys-text);
  box-sizing: border-box;
}
.toolbar {
  display: flex;
  align-items: center;
}
.tree-wrapper {
  flex: 1;
  overflow: auto;
  border: 1px solid var(--sys-border);
  border-radius: 4px;
  padding: 8px;
  background: var(--sys-surface);
  box-shadow:
    0 0 0 1px rgba(32, 111, 202, 0.22),
    0 18px 40px rgba(1, 8, 18, 0.45);
}

// Tree dark theme
.tree-wrapper :deep(.n-tree) {
  --n-node-text-color: rgba(203, 227, 255, 0.85);
  --n-node-text-color-active: #fff;
  --n-node-text-color-hover: #fff;
  --n-node-color-active: rgba(41, 163, 255, 0.14);
  --n-arrow-color: rgba(147, 196, 255, 0.6);
  background: transparent;
}

// Button
.toolbar :deep(.n-button--primary-type) {
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
:deep(.n-modal-mask) {
  background: rgba(2, 8, 18, 0.62);
  backdrop-filter: blur(2px);
}
</style>
