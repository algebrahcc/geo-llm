<script setup lang="ts">
import { ref, watch } from 'vue';
import { NButton, NInput, NModal, NSpin, NTag, NText, useMessage } from 'naive-ui';
import { fetchKbDatasetMetadata, updateKbDocumentMetadata } from '@/service/api/knowledge';
import { extractPayload, mapKbDatasetMetadata } from './real';
import type { KnowledgeDatasetMetadata, KnowledgeDocumentMetadata } from './types';

defineOptions({
  name: 'KnowledgeMetadataEditor'
});

const props = defineProps<{
  visible: boolean;
  datasetId: string;
  documentId: string;
  metadata: KnowledgeDocumentMetadata[];
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  saved: [];
}>();

const message = useMessage();

const fields = ref<KnowledgeDatasetMetadata[]>([]);
const values = ref<Record<string, string>>({});
const loading = ref(false);
const saving = ref(false);

function buildValues(list: KnowledgeDatasetMetadata[]) {
  const map: Record<string, string> = {};
  for (const field of list) {
    const current = props.metadata.find(m => (m.id && m.id === field.id) || (!m.id && m.name === field.name));
    map[field.id] = current?.value ?? '';
  }
  return map;
}

async function loadFields() {
  loading.value = true;
  try {
    const res = await fetchKbDatasetMetadata(props.datasetId);
    const payload = extractPayload<Api.Knowledge.DatasetMetadata[]>(res);
    let list: KnowledgeDatasetMetadata[] = [];
    if (Array.isArray(payload)) {
      list = mapKbDatasetMetadata(payload);
    }
    if (!list.length) {
      // 接口未返回字段定义时，回退为当前已存在的元数据
      list = props.metadata.map(m => ({
        id: m.id || m.name || '',
        type: m.type || 'string',
        name: m.name || m.id || ''
      }));
    }
    fields.value = list;
    values.value = buildValues(list);
  } catch {
    fields.value = props.metadata.map(m => ({
      id: m.id || m.name || '',
      type: m.type || 'string',
      name: m.name || m.id || ''
    }));
    values.value = buildValues(fields.value);
    message.warning('元数据字段读取失败，已按当前值加载');
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.visible,
  val => {
    if (val && props.datasetId && props.documentId) {
      loadFields();
    }
  }
);

function close() {
  emit('update:visible', false);
}

async function handleSave() {
  if (!fields.value.length) {
    close();
    return;
  }
  saving.value = true;
  try {
    const metadataList = fields.value.map(field => ({
      id: field.id,
      name: field.name,
      value: values.value[field.id] ?? ''
    }));
    await updateKbDocumentMetadata(props.datasetId, [
      {
        document_id: props.documentId,
        metadata_list: metadataList,
        partial_update: true
      }
    ]);
    message.success('文档元数据已更新');
    emit('saved');
    close();
  } catch {
    message.error('更新元数据失败，请稍后重试');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <NModal
    :show="visible"
    preset="card"
    title="编辑文档元数据"
    class="metadata-editor-modal"
    style="width: 620px; max-width: 92vw"
    :mask-closable="false"
    @update:show="value => emit('update:visible', value)"
  >
    <NSpin :show="loading">
      <div v-if="fields.length" class="metadata-editor">
        <div v-for="field in fields" :key="field.id" class="metadata-row">
          <div class="metadata-row__head">
            <span class="metadata-row__name">{{ field.name }}</span>
            <NTag v-if="field.type === 'built-in'" size="small" round :bordered="false" type="warning">内置</NTag>
            <NText v-else depth="3" class="metadata-row__type">{{ field.type }}</NText>
          </div>
          <NInput v-model:value="values[field.id]" placeholder="请输入元数据值" />
        </div>
      </div>
      <NText v-else depth="3" class="metadata-empty">当前知识库未配置元数据字段</NText>
    </NSpin>

    <template #footer>
      <div class="editor-footer">
        <NButton quaternary @click="close">取消</NButton>
        <NButton type="primary" :loading="saving" @click="handleSave">保存</NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped lang="scss">
.metadata-editor {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.metadata-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.metadata-row__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.metadata-row__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #eaf5ff);
}

.metadata-row__type {
  font-size: 11px;
}

.metadata-empty {
  display: block;
  text-align: center;
  padding: 18px 0;
  font-size: 13px;
}

.editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
