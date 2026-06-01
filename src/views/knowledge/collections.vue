<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useThemeStore } from '@/store/modules/theme';
import SvgIcon from '@/components/custom/svg-icon.vue';
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

const themeStore = useThemeStore();
const darkMode = computed(() => themeStore.darkMode);

const drawerVisible = ref(false);
const editingKey = ref('');

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
    content: `确认删除"${label}"吗？`,
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
    <div class="collections-shell">
      <!-- Header panel -->
      <div class="panel-surface header-panel">
        <div class="panel-head">
          <SvgIcon icon="mdi:folder-multiple-outline" class="panel-head__icon" />
          <span class="panel-head__title">集合管理</span>
        </div>
        <div class="panel-body">
          <div class="flex flex-wrap items-center justify-between gap-14px">
            <div>
              <div class="page-title">统一维护知识集合分组</div>
              <div class="page-desc">分组、说明和文档归属，是知识库总览与检索测试的基础入口。</div>
            </div>
            <NButton type="primary" @click="openCreate">新建集合</NButton>
          </div>
        </div>
      </div>

      <!-- Collection grid -->
      <div class="collection-grid">
        <div v-for="item in collectionRows" :key="item.key" class="panel-surface collection-card">
          <div class="flex items-start justify-between gap-12px">
            <div>
              <div class="card-title">{{ item.label }}</div>
              <div class="card-group">{{ item.group }}</div>
            </div>
            <NTag size="small" round type="primary" :bordered="false">{{ item.count }} 篇</NTag>
          </div>
          <div class="card-desc">{{ item.description }}</div>
          <div class="card-footer">
            <div class="card-meta">{{ item.key === 'all' ? '系统默认集合' : '可维护集合' }}</div>
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
        </div>
      </div>
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

<style scoped lang="scss">
.collections-page {
  --page-bg:
    radial-gradient(circle at top, rgba(0, 153, 255, 0.14) 0%, rgba(0, 0, 0, 0) 36%),
    linear-gradient(180deg, #041528 0%, #041120 38%, #03101b 100%);
  --surface-bg: linear-gradient(180deg, rgba(3, 19, 41, 0.94) 0%, rgba(2, 15, 32, 0.96) 100%);
  --surface-border: rgba(43, 131, 255, 0.28);
  --line: rgba(25, 95, 176, 0.35);
  --accent: #29a3ff;
  --text-primary: #eaf5ff;
  --text-secondary: rgba(203, 227, 255, 0.72);
  --text-tertiary: rgba(147, 196, 255, 0.62);

  height: 100%;
  background: var(--page-bg);
  color: var(--text-primary);
  overflow: auto;
}

.collections-page--dark {
  color-scheme: dark;
}

.collections-shell {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Shared panel surface */
.panel-surface {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  box-shadow: 0 0 0 1px rgba(32, 111, 202, 0.22), 0 18px 40px rgba(1, 8, 18, 0.45);
  border-radius: 4px;
  position: relative;
}

.panel-surface::before,
.panel-surface::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  pointer-events: none;
  z-index: 2;
  opacity: 0.35;
}

.panel-surface::before {
  top: -1px;
  left: -1px;
  border-top: 2px solid var(--accent);
  border-left: 2px solid var(--accent);
  border-radius: 4px 0 0 0;
}

.panel-surface::after {
  bottom: -1px;
  right: -1px;
  border-bottom: 2px solid var(--accent);
  border-right: 2px solid var(--accent);
  border-radius: 0 0 4px 0;
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 14px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(10, 38, 72, 0.96) 0%, rgba(5, 25, 47, 0.96) 100%);
  position: relative;
}

.panel-head::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  bottom: 20%;
  width: 2px;
  border-radius: 1px;
  background: linear-gradient(180deg, transparent, var(--accent), transparent);
  opacity: 0.5;
}

.panel-head__icon {
  font-size: 16px;
  color: var(--accent);
  filter: drop-shadow(0 0 4px rgba(41, 163, 255, 0.25));
}

.panel-head__title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-shadow: 0 0 8px rgba(41, 163, 255, 0.12);
}

.panel-body {
  padding: 14px;
}

.page-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.page-desc {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.collection-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

.collection-card {
  padding: 14px;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.card-group {
  margin-top: 4px;
  font-size: 11px;
  color: rgba(41, 163, 255, 0.7);
}

.card-desc {
  margin-top: 10px;
  font-size: 12px;
  line-height: 20px;
  color: var(--text-secondary);
}

.card-footer {
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.card-meta {
  font-size: 11px;
  color: var(--text-tertiary);
}

/* Scrollbar */
.collections-page::-webkit-scrollbar {
  width: 8px;
}

.collections-page::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(48, 127, 212, 0.45);
}

.collections-page::-webkit-scrollbar-track {
  background: transparent;
}
</style>
