<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useThemeStore } from '@/store/modules/theme';
import {
  createKnowledgeCollection,
  knowledgeCollections,
  knowledgeDocuments,
  removeKnowledgeCollection,
  updateKnowledgeCollection,
  type KnowledgeCollectionFormModel
} from '@/mock/knowledge';

defineOptions({
  name: 'KnowledgeCollectionsPage'
});

const drawerVisible = ref(false);
const editingKey = ref('');
const themeStore = useThemeStore();
const darkMode = computed(() => themeStore.darkMode);

const form = reactive<KnowledgeCollectionFormModel>({
  label: '',
  description: '',
  group: '区域知识'
});

const groupOptions = [
  { label: '区域知识', value: '区域知识' },
  { label: '通用能力', value: '通用能力' },
  { label: '总览', value: '总览' }
];

const collectionRows = computed(() =>
  knowledgeCollections.map(item => ({
    ...item,
    count:
      item.key === 'all'
        ? knowledgeDocuments.length
        : knowledgeDocuments.filter(doc => doc.collection === item.key).length
  }))
);

function resetForm() {
  editingKey.value = '';
  form.label = '';
  form.description = '';
  form.group = '区域知识';
}

function openCreate() {
  resetForm();
  drawerVisible.value = true;
}

function openEdit(key: string) {
  const target = knowledgeCollections.find(item => item.key === key);
  if (!target) return;

  editingKey.value = key;
  form.label = target.label;
  form.description = target.description;
  form.group = target.group;
  drawerVisible.value = true;
}

function handleSubmit() {
  if (!form.label.trim() || !form.description.trim()) {
    window.$message?.warning('请先填写集合名称和说明');
    return;
  }

  if (editingKey.value) {
    const updated = updateKnowledgeCollection({
      key: editingKey.value,
      label: form.label.trim(),
      description: form.description.trim(),
      group: form.group
    });

    if (updated) {
      window.$message?.success('集合信息已更新');
    }
  } else {
    createKnowledgeCollection({
      label: form.label.trim(),
      description: form.description.trim(),
      group: form.group
    });
    window.$message?.success('已新建集合');
  }

  drawerVisible.value = false;
  resetForm();
}

function handleDelete(key: string, label: string) {
  window.$dialog?.warning({
    title: '删除集合',
    content: `确认删除“${label}”吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => {
      const result = removeKnowledgeCollection(key);
      if (result.success) {
        window.$message?.success('集合已删除');
        return;
      }

      if (result.reason === 'has-documents') {
        window.$message?.warning('该集合下仍有文档，暂不能删除');
      }
    }
  });
}
</script>

<template>
  <div class="collections-page" :class="{ 'collections-page--dark': darkMode }">
    <NCard :bordered="false" class="hero-card">
      <div class="flex flex-wrap items-center justify-between gap-16px">
        <div>
          <div class="text-18px font-700 text-[#f8fafc]">集合管理</div>
          <div class="mt-6px text-13px text-[#94a3b8]">
            统一维护知识集合分组、说明和文档归属，是知识库总览与检索测试的基础入口。
          </div>
        </div>
        <NButton type="primary" @click="openCreate">新建集合</NButton>
      </div>
    </NCard>

    <div class="grid gap-16px md:grid-cols-2 xl:grid-cols-3">
      <NCard v-for="item in collectionRows" :key="item.key" :bordered="false" class="collection-card">
        <div class="flex items-start justify-between gap-12px">
          <div>
            <div class="text-16px font-600 text-[#f8fafc]">{{ item.label }}</div>
            <div class="mt-6px text-12px text-[#8ea3bd]">{{ item.group }}</div>
          </div>
          <NTag size="small" round type="primary" :bordered="false">{{ item.count }} 篇</NTag>
        </div>
        <div class="mt-12px text-13px leading-22px text-[#cbd5e1]">{{ item.description }}</div>
        <div class="mt-16px flex items-center justify-between gap-8px">
          <div class="text-12px text-[#7890ad]">{{ item.key === 'all' ? '系统默认集合' : '可维护集合' }}</div>
          <div class="flex gap-6px">
            <NButton size="small" secondary :disabled="item.key === 'all'" @click="openEdit(item.key)">编辑</NButton>
            <NButton
              size="small"
              secondary
              type="error"
              :disabled="item.key === 'all'"
              @click="handleDelete(item.key, item.label)"
            >
              删除
            </NButton>
          </div>
        </div>
      </NCard>
    </div>

    <NDrawer :show="drawerVisible" :width="440" placement="right" @update:show="drawerVisible = $event">
      <NDrawerContent :title="editingKey ? '编辑集合' : '新建集合'" closable>
        <NForm label-placement="top" :show-feedback="false">
          <NFormItem label="集合名称">
            <NInput v-model:value="form.label" placeholder="例如：两栖方向专题资料" />
          </NFormItem>
          <NFormItem label="所属分组">
            <NSelect v-model:value="form.group" :options="groupOptions" />
          </NFormItem>
          <NFormItem label="集合说明">
            <NInput v-model:value="form.description" type="textarea" :autosize="{ minRows: 4, maxRows: 6 }" />
          </NFormItem>
        </NForm>

        <template #footer>
          <div class="flex justify-end gap-8px">
            <NButton @click="drawerVisible = false">取消</NButton>
            <NButton type="primary" @click="handleSubmit">保存</NButton>
          </div>
        </template>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>

<style scoped>
.collections-page {
  --knowledge-block-bg:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 30%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.98));
  --knowledge-block-border: rgba(148, 163, 184, 0.14);
  --knowledge-block-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
  --knowledge-title: #0f172a;
  --knowledge-subtitle: #64748b;
  --knowledge-body: #334155;
  --knowledge-meta: #64748b;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.collections-page--dark {
  --knowledge-block-bg:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 30%),
    linear-gradient(135deg, rgba(15, 23, 42, 0.88), rgba(30, 41, 59, 0.82));
  --knowledge-block-border: rgba(148, 163, 184, 0.14);
  --knowledge-block-shadow: none;
  --knowledge-title: #f8fafc;
  --knowledge-subtitle: #94a3b8;
  --knowledge-body: #cbd5e1;
  --knowledge-meta: #7890ad;
}

.hero-card,
.collection-card {
  border-radius: 20px;
  background: var(--knowledge-block-bg);
  box-shadow: var(--knowledge-block-shadow);
}

.collection-card {
  border: 1px solid var(--knowledge-block-border);
}

.collections-page :deep(.text-\[\#f8fafc\]) {
  color: var(--knowledge-title) !important;
}

.collections-page :deep(.text-\[\#94a3b8\]),
.collections-page :deep(.text-\[\#8ea3bd\]) {
  color: var(--knowledge-subtitle) !important;
}

.collections-page :deep(.text-\[\#cbd5e1\]) {
  color: var(--knowledge-body) !important;
}

.collections-page :deep(.text-\[\#7890ad\]) {
  color: var(--knowledge-meta) !important;
}
</style>
