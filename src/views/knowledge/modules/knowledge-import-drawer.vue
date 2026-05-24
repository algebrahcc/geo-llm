<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import type { KnowledgeCategory, KnowledgeImportFormModel } from '@/mock/knowledge';

interface Props {
  visible: boolean;
  categories: KnowledgeCategory[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  submit: [form: KnowledgeImportFormModel];
}>();

const form = reactive({
  name: '',
  category: '',
  source: '',
  tagsText: '',
  indexMode: '混合切分' as KnowledgeImportFormModel['indexMode'],
  note: ''
});

const categoryOptions = computed(() =>
  props.categories.filter(item => item.key !== 'all').map(item => ({ label: item.label, value: item.key }))
);

const indexModeOptions = [
  { label: '混合切分', value: '混合切分' },
  { label: '语义分段', value: '语义分段' },
  { label: '手动分块', value: '手动分块' }
];

function resetForm() {
  form.name = '';
  form.category = categoryOptions.value[0]?.value || '';
  form.source = '';
  form.tagsText = '';
  form.indexMode = '混合切分';
  form.note = '';
}

watch(
  () => props.visible,
  visible => {
    if (visible && !form.category) {
      form.category = categoryOptions.value[0]?.value || '';
    }
    if (!visible) {
      resetForm();
    }
  }
);

function handleClose() {
  emit('update:visible', false);
}

function handleSubmit() {
  if (!form.name || !form.category || !form.source) {
    window.$message?.warning('请先补全名称、分类和来源');
    return;
  }

  emit('submit', {
    name: form.name,
    category: form.category,
    source: form.source,
    tags: form.tagsText
      .split(',')
      .map(item => item.trim())
      .filter(Boolean),
    indexMode: form.indexMode,
    note: form.note
  });
}
</script>

<template>
  <NDrawer :show="visible" :width="440" placement="right" @update:show="emit('update:visible', $event)">
    <NDrawerContent title="导入知识文档" closable>
      <NForm label-placement="top" :show-feedback="false">
        <NFormItem label="文档名称">
          <NInput v-model:value="form.name" placeholder="例如：台湾港口岸线专题资料" />
        </NFormItem>
        <NFormItem label="分类">
          <NSelect v-model:value="form.category" :options="categoryOptions" />
        </NFormItem>
        <NFormItem label="来源">
          <NInput v-model:value="form.source" placeholder="例如：人工整理 / 历史方案归档" />
        </NFormItem>
        <NFormItem label="标签">
          <NInput v-model:value="form.tagsText" placeholder="多个标签用英文逗号分隔" />
        </NFormItem>
        <NFormItem label="索引方式">
          <NSelect v-model:value="form.indexMode" :options="indexModeOptions" />
        </NFormItem>
        <NFormItem label="补充说明">
          <NInput v-model:value="form.note" type="textarea" :autosize="{ minRows: 4, maxRows: 6 }" />
        </NFormItem>
      </NForm>

      <template #footer>
        <div class="flex justify-end gap-8px">
          <NButton @click="handleClose">取消</NButton>
          <NButton type="primary" @click="handleSubmit">提交导入</NButton>
        </div>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>
