<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { UploadFileInfo } from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { useThemeStore } from '@/store/modules/theme';
import {
  createKnowledgeDocument,
  createImageKnowledgeDocument,
  getCollectionByCategory,
  knowledgeCategories,
  segmentModelOptions,
  extractModelOptions,
  type KnowledgeImportFormModel
} from '@/mock/knowledge';

defineOptions({ name: 'KnowledgeImportPage' });

const route = useRoute();
const router = useRouter();
const themeStore = useThemeStore();
const darkMode = computed(() => themeStore.darkMode);

const importType = ref<'document' | 'image'>(
  (route.query.type as string) === 'image' ? 'image' : 'document'
);

const form = reactive({
  name: '',
  category: '',
  source: '人工整理',
  tagsText: '',
  indexMode: '混合切分' as KnowledgeImportFormModel['indexMode'],
  note: '',
  segmentModel: 'SAM2',
  extractModel: 'InternVL',
  imageFiles: [] as { name: string; size: number }[]
});

const categoryOptions = computed(() =>
  knowledgeCategories
    .filter(item => item.key !== 'all')
    .map(item => ({ label: item.label, value: item.key }))
);

const indexModeOptions = [
  { label: '混合切分', value: '混合切分' },
  { label: '语义分段', value: '语义分段' },
  { label: '手动分块', value: '手动分块' }
];

// Init category
function initCategory() {
  if (!form.category) {
    form.category = categoryOptions.value[0]?.value || '';
  }
}
initCategory();

watch(importType, type => {
  if (type === 'image') {
    form.source = '图片上传';
    form.indexMode = '图片分割';
  } else {
    form.source = '人工整理';
    form.indexMode = '混合切分';
  }
});

function goBack() {
  router.push({ name: 'knowledge_overview' as never });
}

function handleFileChange(options: { fileList: UploadFileInfo[] }) {
  form.imageFiles = options.fileList
    .filter(f => f.file)
    .map(f => ({ name: f.name, size: f.file?.size || 0 }));
}

function handleFileRemove(options: { file: UploadFileInfo; fileList: UploadFileInfo[] }) {
  form.imageFiles = options.fileList
    .filter(f => f.file)
    .map(f => ({ name: f.name, size: f.file?.size || 0 }));
}

function handleSubmit() {
  if (!form.name || !form.category) {
    window.$message?.warning('请填写文档名称和分类');
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

  const tags = form.tagsText
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (importType.value === 'image') {
    const doc = createImageKnowledgeDocument({
      name: form.name,
      category: form.category,
      source: form.source || '图片上传',
      tags,
      summary: form.note || `${form.name} 图片导入，待分割与要素提取。`,
      segmentModel: form.segmentModel,
      extractModel: form.extractModel,
      imageFiles: form.imageFiles
    });
    window.$message?.success(`图片已提交导入：${doc.name}`);
  } else {
    const doc = createKnowledgeDocument({
      name: form.name,
      collection: getCollectionByCategory(form.category),
      category: form.category,
      source: form.source,
      reviewer: '当前用户',
      tags,
      summary: form.note || `${form.name} 已进入知识库处理队列。`,
      format: 'PDF',
      size: '1.2 MB',
      indexMode: form.indexMode
    });
    window.$message?.success(`文档已提交导入：${doc.name}`);
  }

  goBack();
}
</script>

<template>
  <div class="import-page" :class="{ 'import-page--dark': darkMode }">
    <!-- Header -->
    <div class="import-header">
      <button class="back-btn" @click="goBack">
        <SvgIcon icon="mdi:arrow-left" />
        <span>返回知识库</span>
      </button>
      <div class="import-header__title">
        <SvgIcon icon="mdi:upload-outline" class="import-header__icon" />
        <span>{{ importType === 'image' ? '导入图片' : '导入文档' }}</span>
      </div>
      <div class="import-header__badge">
        {{ importType === 'image' ? '分割 → 提取 → 入库' : '解析 → 分块 → 索引' }}
      </div>
    </div>

    <!-- Mode switch -->
    <div class="mode-tabs">
      <button
        class="mode-tab"
        :class="{ 'mode-tab--active': importType === 'document' }"
        @click="importType = 'document'"
      >
        <SvgIcon icon="mdi:file-document-outline" class="mode-tab__icon" />
        <div class="mode-tab__text">
          <div class="mode-tab__title">文档导入</div>
          <div class="mode-tab__desc">PDF / DOCX / MD / TXT</div>
        </div>
      </button>
      <button
        class="mode-tab"
        :class="{ 'mode-tab--active': importType === 'image' }"
        @click="importType = 'image'"
      >
        <SvgIcon icon="mdi:image-outline" class="mode-tab__icon" />
        <div class="mode-tab__text">
          <div class="mode-tab__title">图片导入</div>
          <div class="mode-tab__desc">PNG / JPG / TIFF / SAR</div>
        </div>
      </button>
    </div>

    <!-- Form body -->
    <div class="import-body">
      <!-- Left: upload / model area -->
      <div class="import-left">
        <!-- Document mode: file upload placeholder -->
        <template v-if="importType === 'document'">
          <div class="upload-zone">
            <div class="upload-zone__inner">
              <SvgIcon icon="mdi:cloud-upload-outline" class="upload-zone__icon" />
              <div class="upload-zone__title">拖拽文档到此处，或点击上传</div>
              <div class="upload-zone__hint">支持 PDF / DOCX / MD / TXT，单个文件最大 50MB</div>
              <div class="upload-zone__formats">
                <span class="format-tag">PDF</span>
                <span class="format-tag">DOCX</span>
                <span class="format-tag">MD</span>
                <span class="format-tag">TXT</span>
              </div>
            </div>
          </div>

          <!-- Index mode -->
          <div class="config-card">
            <div class="config-card__head">
              <SvgIcon icon="mdi:cog-outline" class="config-card__head-icon" />
              <span>处理配置</span>
            </div>
            <div class="config-card__body">
              <div class="config-row">
                <span class="config-row__label">索引方式</span>
                <NSelect
                  v-model:value="form.indexMode"
                  :options="indexModeOptions"
                  class="config-select"
                  size="small"
                />
              </div>
              <div class="config-row">
                <span class="config-row__label">来源</span>
                <NInput v-model:value="form.source" class="config-input" size="small" placeholder="例如：人工整理" />
              </div>
            </div>
          </div>
        </template>

        <!-- Image mode: upload area + model config -->
        <template v-if="importType === 'image'">
          <!-- Image upload -->
          <NUpload
            accept=".png,.jpg,.jpeg,.tiff,.tif,.sar"
            :max="10"
            :default-upload="false"
            multiple
            @change="handleFileChange"
            @remove="handleFileRemove"
          >
            <div class="upload-zone upload-zone--image">
              <div class="upload-zone__inner">
                <SvgIcon icon="mdi:image-plus-outline" class="upload-zone__icon upload-zone__icon--image" />
                <div class="upload-zone__title">点击或拖拽上传图片</div>
                <div class="upload-zone__hint">支持 PNG / JPG / TIFF / SAR，最多 10 张</div>
                <div class="upload-zone__formats">
                  <span class="format-tag format-tag--image">PNG</span>
                  <span class="format-tag format-tag--image">JPG</span>
                  <span class="format-tag format-tag--image">TIFF</span>
                  <span class="format-tag format-tag--image">SAR</span>
                </div>
              </div>
            </div>
          </NUpload>

          <!-- Model config -->
          <div class="config-card">
            <div class="config-card__head">
              <SvgIcon icon="mdi:brain" class="config-card__head-icon" />
              <span>模型配置</span>
            </div>
            <div class="config-card__body">
              <div class="config-row">
                <span class="config-row__label">分割模型</span>
                <NSelect
                  v-model:value="form.segmentModel"
                  :options="segmentModelOptions"
                  class="config-select"
                  size="small"
                />
              </div>
              <div class="config-row">
                <span class="config-row__label">提取模型</span>
                <NSelect
                  v-model:value="form.extractModel"
                  :options="extractModelOptions"
                  class="config-select"
                  size="small"
                />
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Right: metadata form -->
      <div class="import-right">
        <div class="form-card">
          <div class="form-card__head">
            <SvgIcon icon="mdi:information-outline" class="form-card__head-icon" />
            <span>{{ importType === 'image' ? '图片信息' : '文档信息' }}</span>
          </div>
          <div class="form-card__body">
            <NForm label-placement="top" :show-feedback="false">
              <NFormItem label="文档名称" required>
                <NInput v-model:value="form.name" placeholder="例如：台湾港口岸线专题资料" />
              </NFormItem>
              <NFormItem label="分类" required>
                <NSelect v-model:value="form.category" :options="categoryOptions" />
              </NFormItem>
              <NFormItem label="标签">
                <NInput v-model:value="form.tagsText" placeholder="多个标签用英文逗号分隔" />
              </NFormItem>
              <NFormItem label="补充说明">
                <NInput
                  v-model:value="form.note"
                  type="textarea"
                  :autosize="{ minRows: 4, maxRows: 6 }"
                  placeholder="补充文档背景、用途等说明信息"
                />
              </NFormItem>
            </NForm>

            <div class="form-actions">
              <NButton @click="goBack">取消</NButton>
              <NButton type="primary" @click="handleSubmit">
                <template #icon>
                  <SvgIcon icon="mdi:check" />
                </template>
                提交导入
              </NButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.import-page {
  --page-bg:
    radial-gradient(circle at top, rgba(0, 153, 255, 0.14) 0%, rgba(0, 0, 0, 0) 36%),
    linear-gradient(180deg, #041528 0%, #041120 38%, #03101b 100%);
  --surface-bg: linear-gradient(180deg, rgba(3, 19, 41, 0.94) 0%, rgba(2, 15, 32, 0.96) 100%);
  --surface-border: rgba(43, 131, 255, 0.28);
  --line: rgba(25, 95, 176, 0.35);
  --accent: #29a3ff;
  --accent-green: #46cc8e;
  --text-primary: #eaf5ff;
  --text-secondary: rgba(203, 227, 255, 0.72);
  --text-tertiary: rgba(147, 196, 255, 0.62);

  height: 100%;
  background: var(--page-bg);
  color: var(--text-primary);
  overflow: auto;
  padding: 20px 28px;
  box-sizing: border-box;
}

.import-page--dark { color-scheme: dark; }

/* ====== Header ====== */
.import-header {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-bottom: 24px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 6px;
  background: rgba(41, 163, 255, 0.06);
  border: 1px solid rgba(41, 163, 255, 0.15);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}
.back-btn:hover {
  background: rgba(41, 163, 255, 0.12);
  color: #fff;
  border-color: rgba(41, 163, 255, 0.3);
}

.import-header__title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-shadow: 0 0 12px rgba(41, 163, 255, 0.15);
}
.import-header__icon {
  font-size: 26px;
  color: var(--accent);
}

.import-header__badge {
  padding: 4px 14px;
  border-radius: 20px;
  background: rgba(41, 163, 255, 0.08);
  border: 1px solid rgba(41, 163, 255, 0.18);
  font-size: 12px;
  color: var(--text-tertiary);
  letter-spacing: 0.5px;
}

/* ====== Mode tabs ====== */
.mode-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 24px;
}

.mode-tab {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  border-radius: 8px;
  background: var(--surface-bg);
  border: 1px solid rgba(43, 131, 255, 0.16);
  cursor: pointer;
  transition: all 0.25s ease;
  font-family: inherit;
  text-align: left;
  color: var(--text-secondary);
}
.mode-tab:hover {
  border-color: rgba(43, 131, 255, 0.3);
  background: linear-gradient(180deg, rgba(8, 28, 55, 0.96) 0%, rgba(4, 18, 38, 0.96) 100%);
}
.mode-tab--active {
  border-color: var(--accent);
  background: linear-gradient(180deg, rgba(10, 46, 92, 0.94) 0%, rgba(5, 28, 58, 0.94) 100%);
  box-shadow: 0 0 0 1px rgba(41, 163, 255, 0.2), 0 8px 24px rgba(4, 79, 162, 0.2);
  color: #fff;
}

.mode-tab__icon {
  font-size: 32px;
  color: var(--accent);
  flex-shrink: 0;
}
.mode-tab--active .mode-tab__icon {
  filter: drop-shadow(0 0 8px rgba(41, 163, 255, 0.4));
}

.mode-tab__title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 3px;
}
.mode-tab__desc {
  font-size: 12px;
  color: var(--text-tertiary);
  letter-spacing: 0.3px;
}

/* ====== Body layout ====== */
.import-body {
  display: grid;
  grid-template-columns: 1fr 420px;
  gap: 16px;
  align-items: start;
}

.import-left {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.import-right {
  position: sticky;
  top: 20px;
}

/* ====== Upload zone ====== */
.upload-zone {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.25s;
}
.upload-zone:hover {
  border-color: rgba(58, 160, 255, 0.5);
  box-shadow: 0 0 20px rgba(41, 163, 255, 0.08);
}

.upload-zone__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 24px;
}

.upload-zone__icon {
  font-size: 48px;
  color: rgba(98, 196, 255, 0.55);
}
.upload-zone__icon--image {
  color: rgba(98, 228, 255, 0.55);
}

.upload-zone__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}
.upload-zone__hint {
  font-size: 13px;
  color: var(--text-tertiary);
}

.upload-zone__formats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 4px;
}

.format-tag {
  padding: 2px 10px;
  border-radius: 4px;
  background: rgba(41, 163, 255, 0.08);
  border: 1px solid rgba(41, 163, 255, 0.16);
  font-size: 11px;
  color: var(--text-secondary);
  letter-spacing: 0.3px;
}
.format-tag--image {
  background: rgba(98, 228, 255, 0.08);
  border-color: rgba(98, 228, 255, 0.16);
}

/* ====== Config card ====== */
.config-card {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  overflow: hidden;
}

.config-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 16px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(7, 27, 51, 0.94) 0%, rgba(4, 20, 40, 0.96) 100%);
  font-size: 13px;
  font-weight: 600;
}
.config-card__head-icon {
  font-size: 16px;
  color: var(--accent);
}

.config-card__body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.config-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.config-row__label {
  width: 72px;
  flex-shrink: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.config-select {
  flex: 1;
  min-width: 0;
}
.config-input {
  flex: 1;
  min-width: 0;
}

/* ====== Form card (right) ====== */
.form-card {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  overflow: hidden;
}

.form-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 16px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(7, 27, 51, 0.94) 0%, rgba(4, 20, 40, 0.96) 100%);
  font-size: 13px;
  font-weight: 600;
}
.form-card__head-icon {
  font-size: 16px;
  color: var(--accent);
}

.form-card__body {
  padding: 20px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}

/* ====== Scrollbar ====== */
.import-page::-webkit-scrollbar { width: 8px; }
.import-page::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(48, 127, 212, 0.45);
}
.import-page::-webkit-scrollbar-track { background: transparent; }

@media (max-width: 900px) {
  .import-body {
    grid-template-columns: 1fr;
  }
  .import-right {
    position: static;
  }
}
</style>
