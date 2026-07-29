<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useThemeStore } from '@/store/modules/theme';
import SvgIcon from '@/components/custom/svg-icon.vue';
import type { KnowledgeCollectionFormModel } from './modules/types';
import { createKbDataset, deleteKbDataset, fetchKbDatasets, updateKbDataset } from '@/service/api/knowledge';
import { asList, extractPayload, getDatasetDescription, getDatasetId, getDatasetName } from './modules/real';

defineOptions({
  name: 'KnowledgeCollectionsPage'
});

const themeStore = useThemeStore();
const darkMode = computed(() => themeStore.darkMode);

const drawerVisible = ref(false);
const editingKey = ref('');
const loading = ref(false);
const datasets = ref<Api.Knowledge.Dataset[]>([]);

const form = reactive<KnowledgeCollectionFormModel>({
  label: '',
  description: '',
  group: '知识集合',
  searchMethod: 'semantic_search',
  topK: 5,
  scoreThresholdEnabled: false,
  scoreThreshold: 0
});

const collectionRows = computed(() =>
  datasets.value.map(item => ({
    key: getDatasetId(item),
    label: getDatasetName(item),
    description: getDatasetDescription(item) || '暂无集合说明',
    group: '知识集合',
    count: Number(item.document_count ?? item.documentCount ?? 0) || 0
  }))
);

async function loadDatasets() {
  loading.value = true;
  try {
    const res = await fetchKbDatasets();
    datasets.value = asList<Api.Knowledge.Dataset>(extractPayload(res));
  } catch {
    datasets.value = [];
    window.$message?.error('加载知识集合失败');
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  editingKey.value = '';
  form.label = '';
  form.description = '';
  form.group = '知识集合';
  form.searchMethod = 'semantic_search';
  form.topK = 5;
  form.scoreThresholdEnabled = false;
  form.scoreThreshold = 0;
}

function openCreate() {
  resetForm();
  drawerVisible.value = true;
}

function openEdit(key: string) {
  const target = collectionRows.value.find(item => item.key === key);
  if (!target) return;

  const raw = datasets.value.find(item => getDatasetId(item) === key) as Record<string, unknown> | undefined;
  const rm = (raw?.retrieval_model_dict || raw?.retrievalModelDict) as Record<string, unknown> | undefined;

  editingKey.value = key;
  form.label = target.label;
  form.description = target.description;
  form.group = target.group;
  form.searchMethod = (rm?.search_method as KnowledgeCollectionFormModel['searchMethod']) || 'semantic_search';
  form.topK = Number(rm?.top_k ?? 5);
  form.scoreThresholdEnabled = Boolean(rm?.score_threshold_enabled);
  form.scoreThreshold = Number(rm?.score_threshold ?? 0);
  drawerVisible.value = true;
}

async function handleSubmit() {
  if (!form.label.trim() || !form.description.trim()) {
    window.$message?.warning('请先填写集合名称和说明');
    return;
  }

  try {
    if (editingKey.value) {
      await updateKbDataset(editingKey.value, {
        name: form.label.trim(),
        description: form.description.trim(),
        retrievalModel: {
          search_method: form.searchMethod,
          top_k: form.topK,
          score_threshold_enabled: form.scoreThresholdEnabled,
          score_threshold: form.scoreThreshold
        }
      });
      window.$message?.success('集合信息已更新');
    } else {
      await createKbDataset(form.label.trim(), form.description.trim());
      window.$message?.success('已新建集合');
    }
    await loadDatasets();
    drawerVisible.value = false;
    resetForm();
  } catch {
    window.$message?.error(editingKey.value ? '更新集合失败，请稍后重试' : '新建集合失败，请稍后重试');
  }
}

function handleDelete(key: string, label: string) {
  window.$dialog?.warning({
    title: '删除集合',
    content: `确认删除"${label}"吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await deleteKbDataset(key);
        await loadDatasets();
        window.$message?.success('集合已删除');
      } catch {
        window.$message?.warning('删除集合失败，可能该集合下仍有关联文档或后端暂不可用');
      }
    }
  });
}

onMounted(loadDatasets);
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
              <div class="page-title">统一维护知识集合</div>
              <div class="page-desc">维护集合名称和说明，作为文档导入、总览筛选和检索测试的基础入口。</div>
            </div>
            <div class="flex items-center gap-8px">
              <NButton secondary :loading="loading" @click="loadDatasets">刷新</NButton>
              <NButton type="primary" @click="openCreate">新建集合</NButton>
            </div>
          </div>
        </div>
      </div>

      <!-- Collection grid -->
      <div class="collection-grid">
        <template v-if="loading">
          <div v-for="n in 4" :key="`sk-${n}`" class="panel-surface collection-card collection-card--skeleton">
            <NSkeleton text :repeat="2" :sharp="false" />
            <NSkeleton height="14px" class="mt-12px" :sharp="false" />
            <NSkeleton height="28px" class="mt-18px" :sharp="false" />
          </div>
        </template>

        <div v-else-if="!collectionRows.length" class="panel-surface collection-card collection-card--empty">
          <SvgIcon icon="mdi:folder-plus-outline" class="empty-icon" />
          <NEmpty description="暂无知识集合" />
          <NButton type="primary" ghost class="mt-12px" @click="openCreate">新建第一个集合</NButton>
        </div>

        <div v-for="item in collectionRows" :key="item.key" class="panel-surface collection-card">
          <div class="card-accent" />
          <div class="flex items-start justify-between gap-12px">
            <div class="min-w-0">
              <div class="card-title">
                <SvgIcon icon="mdi:folder-cog-outline" class="card-title__icon" />
                <span class="truncate">{{ item.label }}</span>
              </div>
              <div class="card-group">{{ item.group }}</div>
            </div>
            <NTag size="small" round type="primary" :bordered="false" class="card-count">{{ item.count }} 篇</NTag>
          </div>
          <div class="card-desc">{{ item.description }}</div>
          <div class="card-footer">
            <div class="card-meta">
              <SvgIcon icon="mdi:database-search-outline" class="card-meta__icon" />
              用于文档归档与检索
            </div>
            <div class="flex gap-6px">
              <NButton size="small" secondary @click="openEdit(item.key)">编辑</NButton>
              <NButton size="small" secondary type="error" @click="handleDelete(item.key, item.label)">删除</NButton>
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
          <NFormItem label="集合说明">
            <NInput v-model:value="form.description" type="textarea" :autosize="{ minRows: 4, maxRows: 6 }" />
          </NFormItem>
          <NFormItem label="检索方式">
            <NSelect
              v-model:value="form.searchMethod"
              :options="[
                { label: '语义检索', value: 'semantic_search' },
                { label: '关键词检索', value: 'full_text_search' },
                { label: '混合检索', value: 'hybrid_search' }
              ]"
            />
          </NFormItem>
          <NFormItem label="召回数量 TopK">
            <NInputNumber v-model:value="form.topK" :min="1" :max="50" />
          </NFormItem>
          <NFormItem label="相似度阈值">
            <div class="flex items-center gap-10px">
              <NSwitch v-model:checked="form.scoreThresholdEnabled" />
              <NInputNumber
                v-model:value="form.scoreThreshold"
                :min="0"
                :max="1"
                :step="0.05"
                :disabled="!form.scoreThresholdEnabled"
                class="flex-1"
              />
            </div>
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
  box-shadow:
    0 0 0 1px rgba(32, 111, 202, 0.22),
    0 18px 40px rgba(1, 8, 18, 0.45);
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
  overflow: hidden;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}

.collection-card:not(.collection-card--skeleton):not(.collection-card--empty):hover {
  transform: translateY(-3px);
  border-color: var(--accent);
  box-shadow:
    0 0 0 1px rgba(41, 163, 255, 0.4),
    0 22px 48px rgba(1, 8, 18, 0.55);
}

.card-accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: 4px 0 0 4px;
  background: linear-gradient(180deg, var(--accent), transparent);
  opacity: 0.55;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.card-title__icon {
  flex-shrink: 0;
  font-size: 16px;
  color: var(--accent);
}

.card-group {
  margin-top: 4px;
  padding-left: 23px;
  font-size: 11px;
  color: rgba(41, 163, 255, 0.7);
}

.card-count {
  flex-shrink: 0;
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
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-tertiary);
}

.card-meta__icon {
  font-size: 13px;
}

.collection-card--empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 14px;
}

.collection-card--empty .empty-icon {
  font-size: 40px;
  color: rgba(41, 163, 255, 0.55);
  margin-bottom: 10px;
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
