<script setup lang="ts">
import { computed, h, reactive, ref, watch } from 'vue';
import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NPopconfirm,
  NSelect,
  NSpin,
  NTag,
  NTree,
  type TreeOption
} from 'naive-ui';
import { createCategory, deleteCategory, fetchCategoryTree, updateCategory } from '@/service/api/catalog';

defineOptions({ name: 'CatalogCategoryManage' });

const props = defineProps<{ show: boolean }>();
const emit = defineEmits<{ 'update:show': [v: boolean]; refresh: [] }>();

// ==================== 状态 ====================
const loading = ref(false);
const treeData = ref<Api.Catalog.CategoryNode[]>([]);
const selectedKey = ref<string | null>(null);
const selectedNode = ref<Api.Catalog.CategoryNode | null>(null);

// 弹窗
const modalVisible = ref(false);
const modalTitle = ref('新增分类');
const editId = ref<string | null>(null);
const saving = ref(false);

// 雪花 ID 为字符串，避免 JS Number 精度丢失；'' 表示无父级（一级分类）
const formData = reactive<Api.Catalog.CategoryForm>({
  code: '',
  name: '',
  parentId: '',
  sort: 0
});

// ==================== 数据加载 ====================
async function loadTree() {
  loading.value = true;
  try {
    const { data } = await fetchCategoryTree();
    treeData.value = data ?? [];
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.show,
  v => {
    if (v) loadTree();
  }
);

// ==================== 树节点操作 ====================
function handleSelect(keys: Array<string | number>) {
  if (keys.length > 0) {
    const id = String(keys[0]);
    selectedKey.value = id;
    selectedNode.value = findNode(treeData.value, id) ?? null;
  } else {
    selectedKey.value = null;
    selectedNode.value = null;
  }
}

function findNode(nodes: Api.Catalog.CategoryNode[], id: string): Api.Catalog.CategoryNode | null {
  for (const n of nodes) {
    if (String(n.id) === id) return n;
    if (n.children?.length) {
      const r = findNode(n.children, id);
      if (r) return r;
    }
  }
  return null;
}

function openCreate(parentId: string) {
  editId.value = null;
  modalTitle.value = parentId === '' ? '新增一级分类' : '新增子分类';
  Object.assign(formData, { code: '', name: '', parentId, sort: 0 });
  modalVisible.value = true;
}

function handleAddRoot() {
  openCreate('');
}

function handleAddChild() {
  if (!selectedNode.value) {
    window.$message?.warning('请先选择父分类');
    return;
  }
  openCreate(String(selectedNode.value.id));
}

function handleEdit() {
  if (!selectedNode.value) {
    window.$message?.warning('请先选择要编辑的分类');
    return;
  }
  editId.value = String(selectedNode.value.id);
  modalTitle.value = '编辑分类';
  Object.assign(formData, {
    code: selectedNode.value.code,
    name: selectedNode.value.name,
    parentId: selectedNode.value.parentId != null ? String(selectedNode.value.parentId) : '',
    sort: selectedNode.value.sort != null ? Number(selectedNode.value.sort) : 0
  });
  modalVisible.value = true;
}

async function handleDelete() {
  if (!selectedNode.value) {
    window.$message?.warning('请先选择要删除的分类');
    return;
  }
  const { error } = await deleteCategory(String(selectedNode.value.id));
  if (!error) {
    window.$message?.success('删除成功');
    selectedKey.value = null;
    selectedNode.value = null;
    loadTree();
    emit('refresh');
  } else {
    window.$message?.error('删除失败（可能存在子分类或已关联数据）');
  }
}

async function handleSubmit() {
  if (!formData.name.trim()) {
    window.$message?.warning('请输入分类名称');
    return;
  }
  if (!formData.code.trim()) {
    window.$message?.warning('请输入分类编码');
    return;
  }
  saving.value = true;
  try {
    const payload: Api.Catalog.CategoryForm = {
      code: formData.code.trim(),
      name: formData.name.trim(),
      parentId: formData.parentId === '' ? null : (formData.parentId ?? null),
      sort: formData.sort ?? 0
    };
    const { error } = editId.value ? await updateCategory(editId.value, payload) : await createCategory(payload);
    if (!error) {
      modalVisible.value = false;
      window.$message?.success(editId.value ? '编辑成功' : '新增成功');
      loadTree();
      emit('refresh');
    }
  } finally {
    saving.value = false;
  }
}

// ==================== 树渲染 ====================
const parentOptions = computed(() => {
  const opts: Array<{ label: string; value: string }> = [{ label: '（作为一级分类）', value: '' }];
  const walk = (nodes: Api.Catalog.CategoryNode[], depth: number) => {
    for (const n of nodes) {
      opts.push({ label: `${'　'.repeat(depth)}${n.name}`, value: String(n.id) });
      if (n.children?.length) walk(n.children, depth + 1);
    }
  };
  walk(treeData.value, 0);
  return opts;
});

function buildTree(nodes: Api.Catalog.CategoryNode[]): TreeOption[] {
  return nodes.map(node => ({
    key: String(node.id),
    label: node.name,
    children: node.children?.length ? buildTree(node.children) : undefined,
    prefix: () =>
      h('span', { class: 'cat-node-meta' }, [
        h(NTag, { size: 'tiny', bordered: true, style: 'font-family: monospace' }, { default: () => node.code }),
        node.parentId == null
          ? h(NTag, { size: 'tiny', type: 'info', bordered: true }, { default: () => '大类' })
          : null,
        Number(node.count) > 0
          ? h(NTag, { size: 'tiny', type: 'success', bordered: true }, { default: () => `${node.count} 条` })
          : null
      ])
  }));
}
</script>

<template>
  <!-- 外层分类管理弹窗：系统深色科技风 -->
  <NModal
    :show="props.show"
    :mask-closable="true"
    :show-mask="true"
    style="--n-body-text-color: var(--ui-text-48)"
    @update:show="v => emit('update:show', v)"
  >
    <div class="cat-manage-panel">
      <!-- 头部 -->
      <div class="cat-manage-panel__header">
        <div class="cat-manage-panel__titles">
          <span class="cat-manage-panel__title">分类管理</span>
          <span class="cat-manage-panel__subtitle">维护数据目录分类树 · 一级节点即大类</span>
        </div>
        <button class="cat-manage-panel__close" @click="emit('update:show', false)">✕</button>
      </div>

      <!-- 工具栏 -->
      <div class="cat-manage-panel__toolbar">
        <NButton type="primary" size="small" @click="handleAddRoot">新增一级分类</NButton>
        <NButton size="small" :disabled="!selectedNode" @click="handleAddChild">新增子分类</NButton>
        <NButton size="small" :disabled="!selectedNode" @click="handleEdit">编辑</NButton>
        <NPopconfirm to="body" positive-text="删除" negative-text="取消" @positive-click="handleDelete">
          <template #trigger>
            <NButton type="error" size="small" :disabled="!selectedNode">删除</NButton>
          </template>
          确定删除该分类？有子分类或已关联数据时将无法删除。
        </NPopconfirm>
      </div>

      <!-- 分类树 -->
      <div class="cat-manage-panel__tree">
        <NSpin :show="loading">
          <NTree
            :data="buildTree(treeData)"
            :selected-keys="selectedKey ? [selectedKey] : []"
            block-line
            expand-on-click
            @update:selected-keys="handleSelect"
          />
        </NSpin>
      </div>

      <!-- 底部提示 -->
      <div class="cat-manage-panel__footer">提示：删除分类前请确保其下无子分类且未关联数据</div>
    </div>
  </NModal>

  <!-- 新增/编辑表单弹窗 -->
  <NModal v-model:show="modalVisible" :mask-closable="false" style="--n-body-text-color: #cbe3ff">
    <div class="cat-form-panel">
      <div class="cat-form-panel__header">
        <span class="cat-form-panel__title">{{ modalTitle }}</span>
        <button class="cat-form-panel__close" @click="modalVisible = false">✕</button>
      </div>
      <NForm label-placement="top" :model="formData" class="cat-form">
        <NFormItem label="分类名称" required>
          <NInput v-model:value="formData.name" placeholder="如：遥感影像" />
        </NFormItem>
        <NFormItem label="分类编码" required>
          <NInput v-model:value="formData.code" placeholder="如：img / img-optical" />
        </NFormItem>
        <NFormItem label="父分类">
          <NSelect v-model:value="formData.parentId" :options="parentOptions" placeholder="作为一级分类" />
        </NFormItem>
        <NFormItem label="排序">
          <NInputNumber v-model:value="formData.sort" :min="0" style="width: 100%" />
        </NFormItem>
      </NForm>
      <div class="cat-form-panel__actions">
        <NButton size="small" @click="modalVisible = false">取消</NButton>
        <NButton type="primary" size="small" :loading="saving" @click="handleSubmit">保存</NButton>
      </div>
    </div>
  </NModal>
</template>

<style scoped lang="scss">
/* ==================== 深色科技风弹窗 ==================== */
.cat-manage-panel {
  --sys-surface: linear-gradient(180deg, var(--ui-surface-47) 0%, var(--ui-surface-48) 100%);
  --sys-border: var(--ui-border-91);
  --sys-accent: var(--ui-accent-4);
  position: relative;
  width: 860px;
  max-width: 92vw;
  border-radius: 10px;
  background: var(--sys-surface);
  border: 1px solid var(--sys-border);
  box-shadow:
    inset 0 0 0 1px var(--ui-accent-78),
    0 24px 60px var(--ui-shadow-13);
  overflow: visible;
  padding: 0 20px 16px;
}
.cat-manage-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0 12px;
  border-bottom: 1px solid var(--ui-border-92);
  margin-bottom: 14px;
}
.cat-manage-panel__titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cat-manage-panel__title {
  font-size: 17px;
  font-weight: 600;
  color: var(--ui-text-49);
}
.cat-manage-panel__subtitle {
  font-size: 13px;
  color: var(--ui-text-50);
}
.cat-manage-panel__close {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: var(--ui-text-51);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}
.cat-manage-panel__close:hover {
  color: #fff;
  border-color: var(--ui-border-75);
  background: var(--ui-border-12);
}

/* 工具栏 */
.cat-manage-panel__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}
/* NButton 深色适配（对齐 system/menu） */
.cat-manage-panel__toolbar :deep(.n-button--primary-type),
.cat-form-panel__actions :deep(.n-button--primary-type) {
  --n-color: linear-gradient(180deg, var(--ui-accent-18) 0%, var(--ui-accent-19) 100%);
  --n-color-hover: linear-gradient(180deg, var(--ui-accent-20) 0%, var(--ui-accent-21) 100%);
  --n-text-color: var(--ui-text-12);
  --n-text-color-hover: #fff;
  --n-border: 1px solid var(--ui-accent-3);
  --n-border-hover: 1px solid var(--ui-accent-23);
  --n-border-radius: 8px;
  --n-font-size: 14px;
  --n-height: 34px;
  font-weight: 600;
}

/* 工具栏 / 表单按钮统一加大字号与点击区 */
.cat-manage-panel__toolbar :deep(.n-button),
.cat-form-panel__actions :deep(.n-button) {
  --n-font-size: 14px;
  --n-height: 34px;
  --n-padding: 0 16px;
}

/* 树容器 */
.cat-manage-panel__tree {
  height: 540px;
  overflow: auto;
  border: 1px solid var(--ui-border-93);
  border-radius: 8px;
  background: var(--ui-surface-49);
  padding: 10px 8px;
}
.cat-manage-panel__tree :deep(.n-tree) {
  --n-node-text-color: var(--ui-text-44);
  --n-node-text-color-active: #fff;
  --n-node-text-color-hover: #fff;
  --n-node-color-active: var(--ui-border-62);
  --n-node-color-hover: var(--ui-border-36);
  --n-arrow-color: var(--ui-text-52);
  --n-node-border-radius: 6px;
  --n-font-size: 15px;
  background: transparent;
}
.cat-manage-panel__tree :deep(.n-tree-node) {
  padding: 3px 0;
}
.cat-manage-panel__tree :deep(.n-tree-node-content) {
  border-radius: 6px;
}

/* 节点元信息（NTag 编码/大类/计数） */
.cat-node-meta {
  margin-left: 6px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.cat-manage-panel__tree :deep(.n-tag) {
  --n-font-size: 12px;
  --n-border-radius: 4px;
  --n-height: 22px;
  --n-padding: 0 7px;
}
.cat-manage-panel__tree :deep(.n-tag__content) {
  font-family: inherit;
}

/* 底部 */
.cat-manage-panel__footer {
  margin-top: 12px;
  font-size: 13px;
  color: var(--ui-text-53);
  text-align: right;
}

/* ==================== 表单弹窗 ==================== */
.cat-form-panel {
  position: relative;
  width: 440px;
  max-width: 90vw;
  border-radius: 10px;
  background: linear-gradient(180deg, var(--ui-surface-50), var(--ui-surface-51));
  border: 1px solid var(--ui-border-91);
  box-shadow:
    inset 0 0 0 1px var(--ui-accent-78),
    0 24px 60px var(--ui-shadow-13);
  overflow: hidden;
  padding: 0 20px 20px;
}
.cat-form-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0 12px;
  border-bottom: 1px solid var(--ui-border-92);
  margin-bottom: 16px;
}
.cat-form-panel__title {
  font-size: 17px;
  font-weight: 600;
  color: var(--ui-text-49);
}
.cat-form-panel__close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--ui-text-51);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.cat-form-panel__close:hover {
  color: #fff;
  background: var(--ui-border-7);
}

/* 表单深色适配 */
.cat-form :deep(.n-form-item-label) {
  color: var(--ui-text-44);
  font-size: 14px;
}
.cat-form :deep(.n-form-item-label__text) {
  color: var(--ui-text-44);
}
.cat-form :deep(.n-input) {
  --n-color: var(--ui-surface-52);
  --n-color-focus: var(--ui-surface-53);
  --n-border: 1px solid var(--ui-border-2);
  --n-border-hover: 1px solid var(--ui-border-88);
  --n-text-color: var(--ui-text-1);
  --n-placeholder-color: var(--ui-text-54);
  --n-border-radius: 6px;
  --n-font-size: 14px;
  --n-height: 36px;
}
.cat-form :deep(.n-base-selection) {
  --n-border: 1px solid var(--ui-border-2);
  --n-color: var(--ui-surface-52);
  --n-text-color: var(--ui-text-1);
  --n-placeholder-color: var(--ui-text-54);
  --n-font-size: 14px;
  --n-height: 36px;
}
.cat-form :deep(.n-input-number) {
  --n-color: var(--ui-surface-52);
  --n-border: 1px solid var(--ui-border-2);
  --n-font-size: 14px;
  --n-height: 36px;
}

.cat-form-panel__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 6px;
}

/* ==================== 细滚动条 ==================== */
.cat-manage-panel,
.cat-manage-panel__tree,
.cat-form-panel {
  scrollbar-width: thin;
  scrollbar-color: var(--ui-accent-79) transparent;
}
.cat-manage-panel__tree::-webkit-scrollbar,
.cat-manage-panel ::-webkit-scrollbar,
.cat-form-panel ::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.cat-manage-panel__tree::-webkit-scrollbar-thumb,
.cat-manage-panel ::-webkit-scrollbar-thumb,
.cat-form-panel ::-webkit-scrollbar-thumb {
  background: var(--ui-accent-80);
  border-radius: 4px;
}
.cat-manage-panel__tree::-webkit-scrollbar-thumb:hover,
.cat-manage-panel ::-webkit-scrollbar-thumb:hover,
.cat-form-panel ::-webkit-scrollbar-thumb:hover {
  background: var(--ui-accent-81);
}
.cat-manage-panel__tree::-webkit-scrollbar-track,
.cat-manage-panel ::-webkit-scrollbar-track,
.cat-form-panel ::-webkit-scrollbar-track {
  background: transparent;
}
</style>

<!-- 统一全局 NPopconfirm 深色科技风样式（popover teleport 到 body，scoped 作用不到，需全局非 scoped） -->
<style lang="scss">
/* popconfirm 的外层 popover 容器（naive 中 popconfirm 的 popover 无独立类，用 :has 定位或统一 popover） */
.n-popover {
  background-color: var(--ui-surface-54) !important;
  border: 1px solid var(--ui-border-91) !important;
  border-radius: 8px !important;
  box-shadow: 0 16px 48px var(--ui-shadow-14) !important;
  backdrop-filter: blur(8px);
  --n-color: var(--ui-surface-54) !important;
  --n-color-opacity: 0.98 !important;
  --n-text-color: var(--ui-text-44) !important;
  --n-box-shadow: 0 16px 48px var(--ui-shadow-14) !important;
  --n-border-radius: 8px !important;
  --n-border-color: var(--ui-border-91) !important;
  --n-arrow-background-color: var(--ui-surface-54) !important;
}
/* 确认面板与文案 */
.n-popconfirm {
  color: var(--ui-text-44) !important;
  --n-text-color: var(--ui-text-44) !important;
}
.n-popconfirm__body {
  color: var(--ui-text-44) !important;
  font-size: 14px !important;
}
.n-popconfirm__body span {
  color: var(--ui-text-44) !important;
}
/* 操作区 */
.n-popconfirm__action {
  justify-content: flex-end;
  gap: 6px;
}
.n-popconfirm__action .n-button--primary-type {
  --n-color: linear-gradient(180deg, var(--ui-accent-18), var(--ui-accent-19)) !important;
  --n-color-hover: linear-gradient(180deg, var(--ui-accent-20), var(--ui-accent-21)) !important;
  --n-text-color: var(--ui-text-12) !important;
  --n-border: 1px solid var(--ui-accent-3) !important;
  --n-border-radius: 6px !important;
}
.n-popconfirm__action .n-button:not(.n-button--primary-type) {
  --n-text-color: var(--ui-text-15) !important;
  --n-border: 1px solid var(--ui-border-91) !important;
  --n-color: var(--ui-accent-82) !important;
  --n-color-hover: var(--ui-accent-83) !important;
}
</style>
