<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { UploadFileInfo } from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { useThemeStore } from '@/store/modules/theme';
import { fetchKbDatasets, uploadKbDocument } from '@/service/api/knowledge';
import { asList, getDatasetId, getDatasetName } from './modules/real';

defineOptions({ name: 'KnowledgeImportPage' });

const router = useRouter();
const themeStore = useThemeStore();
const darkMode = computed(() => themeStore.darkMode);
const submitting = ref(false);
const datasetLoading = ref(false);
const datasets = ref<Api.Knowledge.Dataset[]>([]);
const uploadFiles = ref<UploadFileInfo[]>([]);

const datasetId = ref('');
const segmentMode = ref<'automatic' | 'custom'>('automatic');
/** 拖拽悬停态，用于上传区高亮反馈 */
const dragActive = ref(false);

/** 三步向导：1 选择数据源 → 2 文本分段与清洗 → 3 处理并完成（对齐 Dify 添加知识） */
const currentStep = ref(1);
const steps = [
  { key: 1, title: '选择数据源', desc: '上传文件' },
  { key: 2, title: '文本分段与清洗', desc: '分段规则与知识库' },
  { key: 3, title: '处理并完成', desc: '确认并开始处理' }
];
function nextStep() {
  if (currentStep.value < 3) currentStep.value += 1;
}
function prevStep() {
  if (currentStep.value > 1) currentStep.value -= 1;
}

const datasetOptions = computed(() =>
  datasets.value.map(item => ({
    label: getDatasetName(item),
    value: getDatasetId(item)
  }))
);

/** 支持的上传格式（对齐 Dify 文档上传） */
const ACCEPT_FORMATS = '.pdf,.docx,.md,.markdown,.txt,.csv,.xlsx,.xls,.html,.htm';
const ACCEPT_HINT = 'PDF · Word · Markdown · TXT · CSV · Excel · HTML';

/** 将分段方式映射为 Dify 的索引模式与切片规则 */
function mapSegmentMode(mode: string): { indexingTechnique: string; processMode: string } {
  if (mode === 'custom') {
    return { indexingTechnique: 'high_quality', processMode: 'custom' };
  }
  return { indexingTechnique: 'high_quality', processMode: 'automatic' };
}

/** 根据集合 id 取集合名称（Step 3 确认展示） */
function getDatasetLabel(id: string): string {
  const ds = datasets.value.find(item => getDatasetId(item) === id);
  return ds ? getDatasetName(ds) : id || '—';
}

async function loadDatasets() {
  datasetLoading.value = true;
  try {
    const res = await fetchKbDatasets();
    datasets.value = asList<Api.Knowledge.Dataset>(res.data);
    if (!datasetId.value) {
      datasetId.value = datasetOptions.value[0]?.value || '';
    }
  } catch {
    datasets.value = [];
    window.$message?.error('加载知识库集合失败，请检查后端服务');
  } finally {
    datasetLoading.value = false;
  }
}

onMounted(loadDatasets);

function goBack() {
  router.push({ name: 'knowledge_overview' as never });
}

function handleFileChange(options: { fileList: UploadFileInfo[] }) {
  uploadFiles.value = options.fileList;
}

function handleFileRemove(options: { file: UploadFileInfo; fileList: UploadFileInfo[] }) {
  uploadFiles.value = options.fileList;
}

function formatSize(bytes: number): string {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function fileName(f: UploadFileInfo): string {
  return f.name || f.file?.name || '';
}

/** 按扩展名返回对应的文件类型图标（提升文件辨识度） */
function fileIcon(f: UploadFileInfo): string {
  const name = fileName(f).toLowerCase();
  if (name.endsWith('.pdf')) return 'mdi:file-pdf-box';
  if (name.endsWith('.docx') || name.endsWith('.doc')) return 'mdi:file-word-outline';
  if (name.endsWith('.md') || name.endsWith('.markdown')) return 'mdi:file-code-outline';
  if (name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls')) return 'mdi:file-excel-outline';
  if (name.endsWith('.html') || name.endsWith('.htm')) return 'mdi:file-code-outline';
  return 'mdi:file-document-outline';
}

/** 按扩展名返回文件类型的主题色 */
function fileColor(f: UploadFileInfo): string {
  const name = fileName(f).toLowerCase();
  if (name.endsWith('.pdf')) return '#ff6b6b';
  if (name.endsWith('.docx') || name.endsWith('.doc')) return '#4d9fff';
  if (name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.html') || name.endsWith('.htm'))
    return '#9d8cff';
  if (name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls')) return '#46cc8e';
  return '#29a3ff';
}

/** 对齐 Dify：一次可上传多个文件，逐个提交到知识库，文档名取自文件名 */
async function handleSubmit() {
  if (!uploadFiles.value.length) {
    window.$message?.warning('请至少上传一个文档');
    return;
  }
  if (!datasetId.value) {
    window.$message?.warning('请选择所属知识集合');
    return;
  }

  const files = uploadFiles.value.map(item => item.file).filter((file): file is File => Boolean(file));
  if (!files.length) {
    window.$message?.warning('未检测到可上传的文件');
    return;
  }

  const { indexingTechnique, processMode } = mapSegmentMode(segmentMode.value);
  const total = files.length;
  let okCount = 0;

  try {
    submitting.value = true;
    for (const [index, file] of files.entries()) {
      await uploadKbDocument(datasetId.value, file, undefined, 'file', undefined, indexingTechnique, processMode);
      okCount += 1;
      if (total > 1) {
        window.$message?.success(`已上传 ${index + 1}/${total}`);
      }
    }
    window.$message?.success(`成功上传 ${okCount} 个文档到知识库`);
    goBack();
  } catch {
    if (okCount > 0) {
      window.$message?.warning(`已上传 ${okCount}/${total} 个文档，后续文件失败`);
    } else {
      window.$message?.error('上传失败，请稍后重试');
    }
  } finally {
    submitting.value = false;
  }
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
        <span>导入文档</span>
      </div>
    </div>

    <!-- Step indicator (对齐 Dify 添加知识三步) -->
    <div class="step-indicator">
      <div
        v-for="(s, i) in steps"
        :key="s.key"
        class="step"
        :class="{ 'step--active': currentStep === s.key, 'step--done': currentStep > s.key }"
      >
        <div class="step__badge">
          <SvgIcon v-if="currentStep > s.key" icon="mdi:check" />
          <span v-else>{{ i + 1 }}</span>
        </div>
        <div class="step__text">
          <div class="step__title">{{ s.title }}</div>
          <div class="step__desc">{{ s.desc }}</div>
        </div>
      </div>
    </div>

    <!-- Step 1: 选择数据源 -->
    <div v-if="currentStep === 1" class="source-step">
      <div class="source-step__head">
        <div class="source-step__title">选择数据源</div>
        <div class="source-step__desc">选择要导入知识库的文件类型，支持一次上传多个文档</div>
      </div>
      <div class="source-tabs">
        <button type="button" class="source-card source-card--active" @click="nextStep">
          <div class="source-card__icon">
            <SvgIcon icon="mdi:file-upload-outline" />
          </div>
          <div class="source-card__text">
            <div class="source-card__title">上传文件</div>
            <div class="source-card__desc">PDF · Word · Markdown · TXT · CSV · Excel · HTML</div>
          </div>
          <SvgIcon icon="mdi:chevron-right" class="source-card__arrow" />
        </button>
      </div>
    </div>

    <!-- Step 2: 文本分段与清洗 -->
    <div v-if="currentStep === 2" class="import-body">
      <div class="settings-card">
        <div class="settings-card__title">
          <SvgIcon icon="mdi:upload-multiple-outline" class="settings-card__title-icon" />
          上传文件
        </div>
        <NUpload
          multiple
          class="upload-zone"
          :max="20"
          :default-upload="false"
          :accept="ACCEPT_FORMATS"
          :file-list="uploadFiles"
          @change="handleFileChange"
          @remove="handleFileRemove"
          @dragover.prevent="dragActive = true"
          @dragleave.prevent="dragActive = false"
        >
          <div class="upload-drop" :class="{ 'upload-drop--active': dragActive }">
            <div class="upload-drop__icon">
              <SvgIcon icon="mdi:cloud-upload-outline" />
            </div>
            <div class="upload-drop__title">{{ dragActive ? '松开鼠标上传文件' : '点击选择或拖拽文件到此处' }}</div>
            <div class="upload-drop__hint">支持 {{ ACCEPT_HINT }}，最多 20 个文件</div>
          </div>
        </NUpload>

        <Transition name="file-fade">
          <div v-if="uploadFiles.length" class="upload-list">
            <div v-for="f in uploadFiles" :key="f.id" class="upload-item">
              <div class="upload-item__icon" :style="{ color: fileColor(f) }">
                <SvgIcon :icon="fileIcon(f)" />
              </div>
              <div class="upload-item__main">
                <div class="upload-item__name">{{ fileName(f) }}</div>
                <div class="upload-item__size">{{ formatSize(f.file?.size || 0) }}</div>
              </div>
              <button
                type="button"
                class="upload-item__remove"
                title="移除"
                @click="handleFileRemove({ file: f, fileList: uploadFiles.filter(x => x.id !== f.id) })"
              >
                <SvgIcon icon="mdi:close" />
              </button>
            </div>
          </div>
        </Transition>
      </div>

      <div class="settings-card">
        <div class="settings-card__title">
          <SvgIcon icon="mdi:card-text-outline" class="settings-card__title-icon" />
          分段与归属
        </div>

        <div class="setting-row">
          <span class="setting-row__label">所属知识集合</span>
          <NSelect
            v-model:value="datasetId"
            :options="datasetOptions"
            :loading="datasetLoading"
            class="setting-row__control"
            placeholder="请选择知识集合"
          />
        </div>

        <div class="setting-row">
          <span class="setting-row__label">分段方式</span>
          <div class="setting-row__control">
            <div class="segment-tabs">
              <button
                type="button"
                class="segment-tab"
                :class="{ 'segment-tab--active': segmentMode === 'automatic' }"
                @click="segmentMode = 'automatic'"
              >
                自动分段
              </button>
              <button
                type="button"
                class="segment-tab"
                :class="{ 'segment-tab--active': segmentMode === 'custom' }"
                @click="segmentMode = 'custom'"
              >
                自定义分块
              </button>
            </div>
            <div v-if="segmentMode === 'custom'" class="setting-hint">
              自定义分块规则需知识库已配置 embedding 模型，暂以高质量模式处理
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Step 3: 处理并完成 -->
    <div v-if="currentStep === 3" class="import-body">
      <div class="confirm-card">
        <div class="confirm-card__title">
          <SvgIcon icon="mdi:clipboard-check-outline" class="confirm-card__title-icon" />
          确认信息
        </div>
        <div class="confirm-row">
          <span class="confirm-row__label">上传文件</span>
          <span class="confirm-row__value">{{ uploadFiles.length }} 个文档</span>
        </div>
        <div class="confirm-row">
          <span class="confirm-row__label">所属知识集合</span>
          <span class="confirm-row__value">{{ getDatasetLabel(datasetId) }}</span>
        </div>
        <div class="confirm-row">
          <span class="confirm-row__label">分段方式</span>
          <span class="confirm-row__value">{{ segmentMode === 'custom' ? '自定义分块' : '自动分段' }}</span>
        </div>
        <div class="confirm-files">
          <div v-for="f in uploadFiles" :key="f.id" class="confirm-file">
            <SvgIcon icon="mdi:file-document-outline" class="confirm-file__icon" />
            <span class="confirm-file__name">{{ fileName(f) }}</span>
            <span class="confirm-file__size">{{ formatSize(f.file?.size || 0) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部导航 -->
    <div class="step-nav">
      <NButton secondary @click="goBack">取消</NButton>
      <div class="flex-1" />
      <NButton v-if="currentStep > 1" secondary @click="prevStep">
        <SvgIcon icon="mdi:arrow-left" />
        上一步
      </NButton>
      <NButton
        v-if="currentStep === 1 || currentStep === 2"
        type="primary"
        :disabled="currentStep === 2 && !uploadFiles.length"
        @click="nextStep"
      >
        下一步
        <SvgIcon icon="mdi:arrow-right" />
      </NButton>
      <NButton
        v-else
        type="primary"
        :loading="submitting"
        :disabled="!uploadFiles.length || !datasetId"
        @click="handleSubmit"
      >
        <template #icon>
          <SvgIcon icon="mdi:check" />
        </template>
        保存并处理
      </NButton>
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

.import-page--dark {
  color-scheme: dark;
}

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

.import-header__sub {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-left: 4px;
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

/* ====== Step indicator ====== */
.step-indicator {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.step {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 16px;
  flex: 1;
  border-radius: 8px;
  background: rgba(3, 19, 41, 0.5);
  border: 1px solid rgba(43, 131, 255, 0.12);
  transition: all 0.25s ease;

  &__badge {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-secondary);
    background: rgba(41, 163, 255, 0.1);
    border: 1px solid rgba(41, 163, 255, 0.25);
    flex-shrink: 0;
  }

  &__title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  &__desc {
    font-size: 11px;
    color: var(--text-tertiary);
    margin-top: 2px;
  }

  &--active {
    border-color: var(--accent);
    background: linear-gradient(180deg, rgba(10, 46, 92, 0.94) 0%, rgba(5, 28, 58, 0.94) 100%);
    box-shadow: 0 0 0 1px rgba(41, 163, 255, 0.18);

    .step__badge {
      color: #fff;
      background: var(--accent);
      border-color: var(--accent);
      box-shadow: 0 0 10px rgba(41, 163, 255, 0.4);
    }

    .step__title {
      color: #fff;
    }
  }

  &--done {
    .step__badge {
      color: var(--accent-green);
      background: rgba(70, 204, 142, 0.12);
      border-color: rgba(70, 204, 142, 0.3);
    }
  }
}

/* ====== Step nav ====== */
.step-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
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
  box-shadow:
    0 0 0 1px rgba(41, 163, 255, 0.2),
    0 8px 24px rgba(4, 79, 162, 0.2);
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
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 860px;
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

/* ====== Upload card ====== */
.upload-card {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  overflow: hidden;
}

.upload-drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 44px 20px;
  cursor: pointer;
  transition: all 0.2s;

  &__icon {
    font-size: 46px;
    color: rgba(41, 163, 255, 0.5);
    transition: transform 0.25s ease;
  }

  &__title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
  }

  &__hint {
    font-size: 12px;
    color: var(--text-tertiary);
  }

  &:hover {
    background: rgba(41, 163, 255, 0.05);

    .upload-drop__icon {
      transform: translateY(-4px);
      color: var(--accent);
    }
  }

  &--active {
    background: rgba(41, 163, 255, 0.1);
    border: 2px dashed var(--accent);
    border-radius: 8px;

    .upload-drop__icon {
      transform: translateY(-4px);
      color: var(--accent);
    }
  }
}

.upload-zone {
  :deep(.n-upload-trigger) {
    width: 100%;
  }
}

.upload-list {
  border-top: 1px solid var(--line);
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.upload-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid rgba(25, 95, 176, 0.25);
  border-radius: 8px;
  background: rgba(7, 28, 52, 0.4);

  &__icon {
    font-size: 20px;
    color: var(--accent);
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__size {
    font-size: 11px;
    color: var(--text-tertiary);
    margin-top: 2px;
  }

  &__remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-tertiary);
    cursor: pointer;
    font-size: 16px;

    &:hover {
      background: rgba(255, 122, 122, 0.12);
      color: #ff7a7a;
    }
  }
}

/* ====== Settings card ====== */
.settings-card {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  &__title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
  }

  &__title-icon {
    color: var(--accent);
  }
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 14px;

  &__label {
    width: 104px;
    font-size: 13px;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  &__control {
    flex: 1;
  }
}

.segment-tabs {
  display: inline-flex;
  gap: 4px;
  padding: 3px;
  border-radius: 8px;
  background: rgba(6, 20, 38, 0.6);
  border: 1px solid rgba(25, 95, 176, 0.2);
}

.segment-tab {
  appearance: none;
  border: none;
  background: transparent;
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    color: var(--text-primary);
  }

  &--active {
    background: rgba(41, 163, 255, 0.18);
    color: var(--accent);
    box-shadow: inset 0 0 0 1px rgba(41, 163, 255, 0.35);
  }
}

.setting-hint {
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-tertiary);
}

/* ====== Upload actions ====== */
.upload-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 4px;
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

/* ====== Selected file list ====== */
.file-list {
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(41, 163, 255, 0.16);
  border-radius: 8px;
  background: rgba(41, 163, 255, 0.04);
}

.file-list__head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--primary-color));
  margin-bottom: 8px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  transition: background 0.15s ease;
}

.file-item:hover {
  background: rgba(41, 163, 255, 0.08);
}

.file-item__icon {
  flex-shrink: 0;
  font-size: 16px;
  color: var(--text-tertiary);
}

.file-item__name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-item__size {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-tertiary);
}

.file-fade-enter-active,
.file-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.file-fade-enter-from,
.file-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
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
.import-page::-webkit-scrollbar {
  width: 8px;
}
.import-page::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(48, 127, 212, 0.45);
}
.import-page::-webkit-scrollbar-track {
  background: transparent;
}

@media (max-width: 900px) {
  .import-body {
    grid-template-columns: 1fr;
  }
  .import-right {
    position: static;
  }
}

/* ====== Step indicator ====== */
.step-indicator {
  display: flex;
  gap: 12px;
  margin: 4px 0 24px;
}

.step {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  flex: 1;
  border-radius: 10px;
  background: rgba(3, 19, 41, 0.5);
  border: 1px solid rgba(43, 131, 255, 0.12);
  transition: all 0.25s ease;

  &__badge {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-secondary);
    background: rgba(41, 163, 255, 0.1);
    border: 1px solid rgba(41, 163, 255, 0.25);
    flex-shrink: 0;
  }

  &__title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  &__desc {
    font-size: 11px;
    color: var(--text-tertiary);
    margin-top: 2px;
  }

  &--active {
    border-color: var(--accent);
    background: linear-gradient(180deg, rgba(10, 46, 92, 0.94) 0%, rgba(5, 28, 58, 0.94) 100%);
    box-shadow: 0 0 0 1px rgba(41, 163, 255, 0.18);

    .step__badge {
      color: #fff;
      background: var(--accent);
      border-color: var(--accent);
      box-shadow: 0 0 10px rgba(41, 163, 255, 0.4);
    }

    .step__title {
      color: #fff;
    }
  }

  &--done {
    .step__badge {
      color: var(--accent-green, #46cc8e);
      background: rgba(70, 204, 142, 0.12);
      border-color: rgba(70, 204, 142, 0.3);
    }
  }
}

/* ====== Source (Step 1) ====== */
.source-step {
  max-width: 860px;

  &__head {
    margin-bottom: 16px;
  }

  &__title {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
  }

  &__desc {
    margin-top: 4px;
    font-size: 13px;
    color: var(--text-tertiary);
  }
}

.source-tabs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
  max-width: 860px;
}

.source-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 22px 18px;
  border: 1px solid rgba(41, 163, 255, 0.3);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(10, 46, 92, 0.94), rgba(5, 28, 58, 0.94));
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(2, 10, 22, 0.5);
    border-color: var(--accent);

    .source-card__arrow {
      transform: translateX(3px);
      color: var(--accent);
    }
  }

  &__icon {
    font-size: 30px;
    color: var(--accent);
  }

  &__text {
    flex: 1;
  }

  &__title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
  }

  &__desc {
    font-size: 12px;
    color: var(--text-tertiary);
    margin-top: 3px;
  }

  &__arrow {
    color: var(--text-tertiary);
    font-size: 20px;
  }
}

/* ====== Confirm (Step 3) ====== */
.confirm-card {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  padding: 18px 20px;

  &__title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 16px;
  }

  &__title-icon {
    color: var(--accent);
  }
}

.confirm-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 0;
  border-bottom: 1px dashed rgba(25, 95, 176, 0.15);

  &__label {
    width: 104px;
    font-size: 13px;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  &__value {
    font-size: 13px;
    color: var(--text-primary);
  }
}

.confirm-files {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.confirm-file {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(7, 28, 52, 0.4);

  &__icon {
    color: var(--accent);
    font-size: 18px;
  }

  &__name {
    flex: 1;
    font-size: 13px;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__size {
    font-size: 12px;
    color: var(--text-tertiary);
  }
}

/* ====== Step nav ====== */
.step-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 24px;
  max-width: 860px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}

/* ====== Step content transition ====== */
.step-indicator {
  .step {
    position: relative;

    &:not(:last-child)::after {
      content: '';
      position: absolute;
      top: 50%;
      right: -12px;
      width: 12px;
      height: 1px;
      background: rgba(41, 163, 255, 0.25);
    }
  }
}

.import-body,
.source-tabs,
.confirm-card {
  animation: step-fade-in 0.3s ease;
}

@keyframes step-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
