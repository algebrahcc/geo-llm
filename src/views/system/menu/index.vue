<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, watch } from 'vue';
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
import SvgIcon from '@/components/custom/svg-icon.vue';
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
const loadError = ref(false);
const treeData = ref<Api.System.MenuItem[]>([]);
const selectedKey = ref<number | null>(null);
const selectedNode = ref<Api.System.MenuItem | null>(null);
const expandedKeys = ref<number[]>([]);
const keyword = ref('');

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
  loadError.value = false;
  try {
    const { data, error } = await fetchMenuTree();
    if (error) {
      loadError.value = true;
      treeData.value = [];
      return;
    }
    if (data) {
      treeData.value = data;
    }
  } catch {
    loadError.value = true;
    treeData.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadData();
});

// ==================== 树工具 ====================
/** 收集所有节点 id（用于展开全部） */
function collectKeys(nodes: Api.System.MenuItem[], acc: number[] = []): number[] {
  nodes.forEach(node => {
    acc.push(node.id);
    if (node.children?.length) collectKeys(node.children, acc);
  });
  return acc;
}

/** 按关键字过滤：命中节点与其祖先链保留 */
function filterTree(nodes: Api.System.MenuItem[], kw: string): Api.System.MenuItem[] {
  const result: Api.System.MenuItem[] = [];
  nodes.forEach(node => {
    const children = node.children?.length ? filterTree(node.children, kw) : [];
    const hit =
      node.title.toLowerCase().includes(kw) ||
      (node.permission || '').toLowerCase().includes(kw) ||
      (node.name || '').toLowerCase().includes(kw);
    if (hit || children.length) {
      result.push({ ...node, children });
    }
  });
  return result;
}

/** 在原始树中按 id 找回节点（TreeOption 只携带 key/label，需要回查原始数据） */
function findNode(nodes: Api.System.MenuItem[], id: number): Api.System.MenuItem | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children?.length) {
      const hit = findNode(node.children, id);
      if (hit) return hit;
    }
  }
  return null;
}

const displayTree = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  return kw ? filterTree(treeData.value, kw) : treeData.value;
});

function handleExpandAll() {
  expandedKeys.value = collectKeys(displayTree.value);
}

function handleCollapseAll() {
  expandedKeys.value = [];
}

watch(keyword, () => {
  // 搜索时自动展开命中路径，清空时收起
  if (keyword.value.trim()) handleExpandAll();
  else expandedKeys.value = [];
});

// ==================== 树节点操作 ====================
function handleSelectedKeys(keys: Array<string | number>) {
  if (!keys.length) return;
  const id = Number(keys[0]);
  selectedKey.value = id;
  selectedNode.value = findNode(treeData.value, id);
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
  <div class="sys-page">
    <!-- 工具栏 -->
    <div class="sys-toolbar">
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
      <div class="sys-toolbar__right">
        <NInput v-model:value="keyword" class="sys-toolbar__search" placeholder="搜索菜单 / 权限标识" clearable>
          <template #prefix>
            <SvgIcon icon="mdi:magnify" />
          </template>
        </NInput>
        <NButton @click="handleExpandAll">展开全部</NButton>
        <NButton @click="handleCollapseAll">收起全部</NButton>
      </div>
    </div>

    <!-- 菜单树 -->
    <section class="sys-content-card">
      <div v-if="loadError" class="sys-error-bar">
        <SvgIcon icon="mdi:alert-circle-outline" class="sys-error-bar__icon" />
        <span class="sys-error-bar__text">菜单加载失败，请稍后重试</span>
        <NButton size="small" @click="loadData">重试</NButton>
      </div>
      <div class="tree-wrapper">
        <NTree
          v-model:expanded-keys="expandedKeys"
          :data="buildTree(displayTree)"
          :loading="loading"
          :selected-keys="selectedKey === null ? [] : [selectedKey]"
          block-line
          expand-on-click
          @update:selected-keys="handleSelectedKeys"
        >
          <template #empty>
            <EmptyState
              icon="mdi:file-tree-outline"
              :title="keyword ? '没有匹配的菜单' : '暂无菜单数据'"
              :description="keyword ? '试试更换关键字' : '可以通过「新增根菜单」开始配置'"
            />
          </template>
        </NTree>
      </div>
    </section>

    <!-- 新增/编辑弹窗 -->
    <NModal v-model:show="modalVisible" :title="modalTitle" preset="card" class="sys-modal" style="width: 520px">
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
      <template #footer>
        <NSpace justify="end">
          <NButton @click="modalVisible = false">取消</NButton>
          <NButton type="primary" @click="handleSubmit">确定</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
// 工具栏：左侧操作按钮 + 右侧搜索与展开控制
.sys-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;

  &__right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__search {
    width: 220px;
  }
}

// 树容器（外壳复用全局 .sys-content-card）
.tree-wrapper {
  flex: 1;
  min-height: 0;
  padding: 10px 12px;
  overflow: auto;
}

.tree-wrapper :deep(.n-tree) {
  --n-node-text-color: var(--ui-text-15);
  --n-node-text-color-active: #fff;
  --n-node-text-color-hover: #fff;
  --n-node-color-active: var(--ui-border-89);
  --n-arrow-color: var(--ui-text-90);
  --n-font-size: 15px;
  letter-spacing: 0.2px;
  background: transparent;
}
</style>
