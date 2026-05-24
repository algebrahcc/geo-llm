<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import type { KnowledgeCategory, KnowledgeEditFormModel } from '@/mock/knowledge';

interface Props {
  visible: boolean;
  categories: KnowledgeCategory[];
  modelValue: KnowledgeEditFormModel | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  submit: [form: KnowledgeEditFormModel];
}>();

const form = reactive<KnowledgeEditFormModel>({
  id: '',
  name: '',
  category: '',
  source: '',
  reviewer: '',
  tags: [],
  summary: ''
});

const tagsText = computed({
  get: () => form.tags.join(', '),
  set: value => {
    form.tags = value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }
});

const categoryOptions = computed(() =>
  props.categories.filter(item => item.key !== 'all').map(item => ({ label: item.label, value: item.key }))
);

watch(
  () => props.modelValue,
  value => {
    if (!value) return;

    form.id = value.id;
    form.name = value.name;
    form.category = value.category;
    form.source = value.source;
    form.reviewer = value.reviewer;
    form.tags = [...value.tags];
    form.summary = value.summary;
  },
  { immediate: true }
);

function handleSubmit() {
  if (!form.id || !form.name || !form.category) {
    window.$message?.warning('请先补全关键信息');
    return;
  }

  emit('submit', {
    id: form.id,
    name: form.name,
    category: form.category,
    source: form.source,
    reviewer: form.reviewer,
    tags: [...form.tags],
    summary: form.summary
  });
}
</script>

<template>
  <NDrawer :show="visible" :width="440" placement="right" @update:show="emit('update:visible', $event)">
    <NDrawerContent title="编辑文档" closable>
      <NForm label-placement="top" :show-feedback="false">
        <NFormItem label="文档名称">
          <NInput v-model:value="form.name" />
        </NFormItem>
        <NFormItem label="分类">
          <NSelect v-model:value="form.category" :options="categoryOptions" />
        </NFormItem>
        <NFormItem label="来源">
          <NInput v-model:value="form.source" />
        </NFormItem>
        <NFormItem label="审核人">
          <NInput v-model:value="form.reviewer" />
        </NFormItem>
        <NFormItem label="标签">
          <NInput v-model:value="tagsText" placeholder="多个标签用英文逗号分隔" />
        </NFormItem>
        <NFormItem label="摘要">
          <NInput v-model:value="form.summary" type="textarea" :autosize="{ minRows: 4, maxRows: 6 }" />
        </NFormItem>
      </NForm>

      <template #footer>
        <div class="flex justify-end gap-8px">
          <NButton @click="emit('update:visible', false)">取消</NButton>
          <NButton type="primary" @click="handleSubmit">保存修改</NButton>
        </div>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>
