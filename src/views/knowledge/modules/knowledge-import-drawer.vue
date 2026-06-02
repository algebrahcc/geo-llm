<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { UploadFileInfo } from 'naive-ui';
import type { KnowledgeCategory, KnowledgeImportFormModel } from '@/mock/knowledge';
import { segmentModelOptions, extractModelOptions } from '@/mock/knowledge';

interface Props {
  visible: boolean;
  categories: KnowledgeCategory[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  submit: [form: KnowledgeImportFormModel];
}>();

const importType = ref<'document' | 'image'>('document');

const form = reactive({
  name: '',
  category: '',
  source: '',
  tagsText: '',
  indexMode: '混合切分' as KnowledgeImportFormModel['indexMode'],
  note: '',
  segmentModel: 'SAM2',
  extractModel: 'InternVL',
  imageFiles: [] as { name: string; size: number }[]
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
  importType.value = 'document';
  form.name = '';
  form.category = categoryOptions.value[0]?.value || '';
  form.source = '';
  form.tagsText = '';
  form.indexMode = '混合切分';
  form.note = '';
  form.segmentModel = 'SAM2';
  form.extractModel = 'InternVL';
  form.imageFiles = [];
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

watch(importType, type => {
  if (type === 'image') {
    form.source = '图片上传';
    form.indexMode = '图片分割';
  } else {
    form.source = '';
    form.indexMode = '混合切分';
  }
});

function handleClose() {
  emit('update:visible', false);
}

function handleFileChange(options: { fileList: UploadFileInfo[] }) {
  form.imageFiles = options.fileList
    .filter(f => f.file)
    .map(f => ({
      name: f.name,
      size: f.file?.size || 0
    }));
}

function handleFileRemove(options: { file: UploadFileInfo; fileList: UploadFileInfo[] }) {
  form.imageFiles = options.fileList
    .filter(f => f.file)
    .map(f => ({
      name: f.name,
      size: f.file?.size || 0
    }));
}

function handleSubmit() {
  if (!form.name || !form.category) {
    window.$message?.warning('请先补全名称和分类');
    return;
  }

  if (importType.value === 'document' && !form.source) {
    window.$message?.warning('请填写来源');
    return;
  }

  if (importType.value === 'image' && form.imageFiles.length === 0) {
    window.$message?.warning('请上传至少一张图片');
    return;
  }

  emit('submit', {
    importType: importType.value,
    name: form.name,
    category: form.category,
    source: form.source,
    tags: form.tagsText
      .split(',')
      .map(item => item.trim())
      .filter(Boolean),
    indexMode: form.indexMode,
    note: form.note,
    segmentModel: form.segmentModel,
    extractModel: form.extractModel,
    imageFiles: form.imageFiles
  });
}
</script>

<template>
  <NDrawer :show="visible" :width="480" placement="right" @update:show="emit('update:visible', $event)">
    <NDrawerContent title="导入知识文档" closable>
      <!-- Mode switch -->
      <div class="mode-switch">
        <NRadioGroup v-model:value="importType" size="small">
          <NRadioButton value="document">文档导入</NRadioButton>
          <NRadioButton value="image">图片导入</NRadioButton>
        </NRadioGroup>
      </div>

      <NForm label-placement="top" :show-feedback="false" class="mt-12px">
        <!-- Image-specific: upload area -->
        <template v-if="importType === 'image'">
          <NFormItem label="图片上传">
            <NUpload
              accept=".png,.jpg,.jpeg,.tiff,.tif,.sar"
              :max="10"
              :default-upload="false"
              multiple
              @change="handleFileChange"
              @remove="handleFileRemove"
            >
              <div class="upload-trigger">
                <SvgIcon icon="mdi:cloud-upload-outline" class="upload-trigger__icon" />
                <div class="upload-trigger__text">点击或拖拽上传图片</div>
                <div class="upload-trigger__hint">支持 PNG / JPG / TIFF / SAR，最多 10 张</div>
              </div>
            </NUpload>
          </NFormItem>

          <!-- Model selection: two columns -->
          <div class="model-row">
            <NFormItem label="分割模型" class="model-row__item">
              <NSelect v-model:value="form.segmentModel" :options="segmentModelOptions" />
            </NFormItem>
            <NFormItem label="提取模型" class="model-row__item">
              <NSelect v-model:value="form.extractModel" :options="extractModelOptions" />
            </NFormItem>
          </div>
        </template>

        <!-- Common fields -->
        <NFormItem label="文档名称">
          <NInput v-model:value="form.name" placeholder="例如：台湾港口岸线专题资料" />
        </NFormItem>
        <NFormItem label="分类">
          <NSelect v-model:value="form.category" :options="categoryOptions" />
        </NFormItem>
        <NFormItem v-if="importType === 'document'" label="来源">
          <NInput v-model:value="form.source" placeholder="例如：人工整理 / 历史方案归档" />
        </NFormItem>
        <NFormItem label="标签">
          <NInput v-model:value="form.tagsText" placeholder="多个标签用英文逗号分隔" />
        </NFormItem>
        <NFormItem v-if="importType === 'document'" label="索引方式">
          <NSelect v-model:value="form.indexMode" :options="indexModeOptions" />
        </NFormItem>
        <NFormItem label="补充说明">
          <NInput v-model:value="form.note" type="textarea" :autosize="{ minRows: 3, maxRows: 5 }" />
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

<style scoped lang="scss">
.mode-switch {
  display: flex;
  justify-content: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(25, 95, 176, 0.35);
  margin-bottom: 4px;
}

.model-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.upload-trigger {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 16px;
  border: 1px dashed rgba(41, 163, 255, 0.35);
  border-radius: 6px;
  background: rgba(41, 163, 255, 0.04);
  cursor: pointer;
  transition: all 0.25s ease;
}

.upload-trigger:hover {
  background: rgba(41, 163, 255, 0.08);
  border-color: rgba(41, 163, 255, 0.55);
}

.upload-trigger__icon {
  font-size: 32px;
  color: rgba(98, 196, 255, 0.7);
}

.upload-trigger__text {
  font-size: 14px;
  color: rgba(203, 227, 255, 0.85);
  font-weight: 500;
}

.upload-trigger__hint {
  font-size: 12px;
  color: rgba(147, 196, 255, 0.5);
}
</style>
