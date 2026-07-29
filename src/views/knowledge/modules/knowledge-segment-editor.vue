<script setup lang="ts">
import { ref, watch } from 'vue';
import { NButton, NDynamicTags, NInput, NModal, NSwitch, NTag, NText, useMessage } from 'naive-ui';
import { updateKbSegment } from '@/service/api/knowledge';
import type { KnowledgeChunk } from './types';

defineOptions({
  name: 'KnowledgeSegmentEditor'
});

const props = defineProps<{
  visible: boolean;
  datasetId: string;
  documentId: string;
  segment: KnowledgeChunk | null;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  saved: [];
}>();

const message = useMessage();

const content = ref('');
const keywords = ref<string[]>([]);
const enabled = ref(true);
const saving = ref(false);

watch(
  () => props.visible,
  val => {
    if (val && props.segment) {
      content.value = props.segment.content || '';
      keywords.value = [...(props.segment.keywords || [])];
      enabled.value = props.segment.enabled !== false;
    }
  }
);

function close() {
  emit('update:visible', false);
}

async function handleSave() {
  if (!props.segment) return;
  saving.value = true;
  try {
    await updateKbSegment(props.datasetId, props.documentId, [
      {
        id: props.segment.id,
        content: content.value,
        keywords: keywords.value,
        enabled: enabled.value
      }
    ]);
    message.success('切片已更新');
    emit('saved');
    close();
  } catch {
    message.error('更新切片失败，请稍后重试');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <NModal
    :show="visible"
    preset="card"
    title="编辑切片"
    class="segment-editor-modal"
    style="width: 640px; max-width: 92vw"
    :mask-closable="false"
    @update:show="value => emit('update:visible', value)"
  >
    <div v-if="segment" class="segment-editor">
      <div class="editor-meta">
        <NTag size="small" round :bordered="false" type="info">{{ segment.title }}</NTag>
        <NText depth="3" class="editor-meta__len">{{ segment.length }} 字</NText>
      </div>

      <div class="editor-field">
        <div class="editor-field__label">切片内容</div>
        <NInput
          v-model:value="content"
          type="textarea"
          :autosize="{ minRows: 6, maxRows: 16 }"
          placeholder="请输入切片正文内容"
        />
      </div>

      <div class="editor-field">
        <div class="editor-field__label">关键词</div>
        <NDynamicTags v-model:value="keywords" />
      </div>

      <div class="editor-field editor-field--row">
        <div class="editor-field__label">是否启用</div>
        <NSwitch v-model:value="enabled">
          <template #checked>启用</template>
          <template #unchecked>停用</template>
        </NSwitch>
      </div>
    </div>

    <template #footer>
      <div class="editor-footer">
        <NButton quaternary @click="close">取消</NButton>
        <NButton type="primary" :loading="saving" @click="handleSave">保存</NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped lang="scss">
.segment-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.editor-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.editor-meta__len {
  font-size: 12px;
}

.editor-field {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &--row {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.editor-field__label {
  font-size: 12px;
  color: var(--text-tertiary, #8aa3c0);
}

.editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
