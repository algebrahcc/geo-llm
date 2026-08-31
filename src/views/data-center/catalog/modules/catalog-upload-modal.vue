<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { NButton, NInput, NModal, NSpin, NTreeSelect, type TreeSelectOption } from 'naive-ui';
import {
  completeCatalogUpload,
  fetchCatalogPresign,
  fetchCategoryTree,
  fetchUploadPartPresign,
  registerCatalog
} from '@/service/api/catalog';

defineOptions({ name: 'CatalogUploadModal' });

const props = defineProps<{ show: boolean }>();
const emit = defineEmits<{ 'update:show': [v: boolean]; success: [] }>();

// ==================== 状态 ====================
const submitting = ref(false);
/** 整体进度 0-100 */
const progress = ref(0);
const stage = ref<'ready' | 'uploading' | 'done'>('ready');

/** 待上传文件清单 */
interface UploadFileEntry {
  file: File;
  /** 是否上传成功（batch 结果） */
  ok?: boolean;
  /** 失败原因 */
  error?: string;
}
const fileList = ref<UploadFileEntry[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);
const folderInputRef = ref<HTMLInputElement | null>(null);

/** 文件夹选择 input 的自定义属性（webkitdirectory 非标准，绕过 TS 类型检查） */
const folderInputAttrs: Record<string, unknown> = { webkitdirectory: '' };

// 批量统计
const batchTotal = ref(0);
const batchSuccess = ref(0);
const batchFailed = ref(0);

// 元数据表单（批量时统一应用到所有文件；name 不填则用各自文件名）
const form = reactive<{
  categoryId: string | null;
  name: string;
  source: string;
  crs: string;
  bbox: string;
  resolution: string;
  description: string;
}>({
  categoryId: null,
  name: '',
  source: '',
  crs: '',
  bbox: '',
  resolution: '',
  description: ''
});

// 分类树（用于分类选择 + 格式提示）
const categoryTree = ref<Api.Catalog.CategoryNode[]>([]);
const categoryLoading = ref(false);

/** 递归构建分类树选项（NTreeSelect 需完整层级 + key） */
function buildCategoryOptions(nodes: Api.Catalog.CategoryNode[]): TreeSelectOption[] {
  return nodes.map(n => ({
    label: n.name,
    value: String(n.id),
    key: String(n.id),
    children: n.children?.length ? buildCategoryOptions(n.children) : undefined
  }));
}

const categoryOptions = computed(() => buildCategoryOptions(categoryTree.value));

/** 当前选择分类节点（用于格式提示） */
const selectedCategoryNode = computed(() => {
  if (!form.categoryId) return null;
  const walk = (nodes: Api.Catalog.CategoryNode[]): Api.Catalog.CategoryNode | null => {
    for (const n of nodes) {
      if (String(n.id) === form.categoryId) return n;
      if (n.children?.length) {
        const r = walk(n.children);
        if (r) return r;
      }
    }
    return null;
  };
  return walk(categoryTree.value);
});

/** 按分类推导允许的格式（影像/DEM/矢量/文档/三维） */
const allowedFormats = computed(() => {
  const parent = selectedCategoryNode.value;
  const roots = [
    {
      key: ['img', 'oblique', 'corpus-image', 'corpus-media'],
      formats: ['tif', 'img', 'geotiff', 'grst', 'jpg', 'png', '3dtiles', 'obj', 'glb', 'mp4']
    },
    { key: ['dem'], formats: ['tif', 'egc', 'grst', 'asc', 'bin'] },
    {
      key: ['vec', 'pipe', 'hydro', 'poi', 'battlefield', 'obstacle'],
      formats: ['shp', 'geojson', 'json', 'gml', 'kml', 'gpkg']
    },
    { key: ['corpus-text', 'plan'], formats: ['txt', 'md', 'pdf', 'doc', 'docx'] },
    { key: ['hydro-station', 'bf-climate'], formats: ['csv', 'xlsx', 'json'] }
  ];
  for (const r of roots) {
    if (parent && r.key.includes(parent.code)) return r.formats;
  }
  return ['tif', 'img', 'shp', 'geojson', 'json', 'pdf', 'txt'];
});

/** 文件清单是否全部格式合法 */
const filesFormatValid = computed(() => {
  if (!fileList.value.length) return true;
  return fileList.value.every(e => {
    const ext = e.file.name.split('.').pop()?.toLowerCase() ?? '';
    return allowedFormats.value.includes(ext) || allowedFormats.value.length === 0;
  });
});

/** 不合法格式的文件列表（用于提示） */
const invalidFiles = computed(() => {
  if (!allowedFormats.value.length) return [];
  return fileList.value.filter(e => {
    const ext = e.file.name.split('.').pop()?.toLowerCase() ?? '';
    return !allowedFormats.value.includes(ext);
  });
});

/** 已选文件总大小 */
const totalSize = computed(() => fileList.value.reduce((sum, e) => sum + e.file.size, 0));

// ==================== 分类树加载 ====================
async function loadCategoryTree() {
  categoryLoading.value = true;
  try {
    const { data } = await fetchCategoryTree();
    categoryTree.value = data ?? [];
  } finally {
    categoryLoading.value = false;
  }
}

watch(
  () => props.show,
  v => {
    if (v) {
      reset();
      loadCategoryTree();
    }
  }
);

function reset() {
  fileList.value = [];
  Object.assign(form, { categoryId: null, name: '', source: '', crs: '', bbox: '', resolution: '', description: '' });
  progress.value = 0;
  stage.value = 'ready';
  submitting.value = false;
  batchTotal.value = 0;
  batchSuccess.value = 0;
  batchFailed.value = 0;
}

// ==================== 文件选择（多选 / 文件夹） ====================
function openFilePicker() {
  fileInputRef.value?.click();
}

function openFolderPicker() {
  folderInputRef.value?.click();
}

/** 文件唯一键：文件夹场景用相对路径，单文件场景用 name，避免子目录同名冲突 */
function fileKey(f: File): string {
  return f.webkitRelativePath || f.name;
}

/** 选择文件后收集到清单（按相对路径去重，过滤空文件与非法格式） */
function collectFiles(files: FileList | null) {
  if (!files || !files.length) return;
  const seen = new Set(fileList.value.map(item => fileKey(item.file)));
  for (const f of Array.from(files)) {
    if (f.size === 0) continue;
    const key = fileKey(f);
    if (seen.has(key)) continue;
    seen.add(key);
    fileList.value.push({ file: f });
  }
}

function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  collectFiles(input.files);
  input.value = '';
}

function handleFolderChange(e: Event) {
  const input = e.target as HTMLInputElement;
  collectFiles(input.files);
  input.value = '';
}

function removeFile(index: number) {
  fileList.value.splice(index, 1);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

// ==================== 分片上传工具 ====================
async function uploadSingle(file: File, session: Api.Catalog.UploadSession): Promise<void> {
  const resp = await fetch(session.url!, {
    method: 'PUT',
    headers: file.type ? { 'Content-Type': file.type } : undefined,
    body: file
  });
  if (!resp.ok) throw new Error(`直传失败：HTTP ${resp.status}`);
}

async function uploadMultipart(file: File, session: Api.Catalog.UploadSession): Promise<void> {
  const partSize = session.partSize;
  const totalParts = Math.max(1, Math.ceil(file.size / partSize));
  const parts: Api.Catalog.PartInfo[] = [];
  for (let i = 0; i < totalParts; i++) {
    const start = i * partSize;
    const end = Math.min(file.size, start + partSize);
    const blob = file.slice(start, end);
    const partNumber = i + 1;
    const { data } = await fetchUploadPartPresign(session.objectKey, session.uploadId!, partNumber);
    if (!data?.url) throw new Error(`分片 ${partNumber} 直传地址获取失败`);
    const resp = await fetch(data.url, { method: 'PUT', body: blob });
    if (!resp.ok) throw new Error(`分片 ${partNumber} 上传失败：HTTP ${resp.status}`);
    const etag = resp.headers.get('etag');
    if (!etag) throw new Error(`分片 ${partNumber} 缺少 ETag`);
    parts.push({ partNumber, etag: etag.replace(/"/g, '') });
  }
  const completeRes = await completeCatalogUpload(session.objectKey, session.uploadId!, parts);
  const info = completeRes.data ?? (completeRes as unknown as Api.Catalog.ObjectInfo);
  if (info && !info.exists) throw new Error('分片合并失败，对象校验不通过');
}

/** 上传单个文件并登记，返回是否成功；失败抛错由调用方捕获 */
async function uploadAndRegister(file: File): Promise<void> {
  const presignRes = await fetchCatalogPresign({
    fileName: file.name,
    categoryId: form.categoryId!,
    fileSize: file.size,
    contentType: file.type || 'application/octet-stream'
  });
  const session = presignRes.data ?? (presignRes as unknown as Api.Catalog.UploadSession);
  if (!session?.objectKey) throw new Error('获取上传地址失败');

  // 组装元数据（名称优先用表单值，否则用文件名）
  const ext: Record<string, string> = {};
  if (form.description) ext.description = form.description;
  if (form.resolution) ext.resolution = form.resolution;
  const metadata: Api.Catalog.RegisterReq = {
    name: form.name || file.name.replace(/\.[^.]+$/, ''),
    categoryId: form.categoryId!,
    objectKey: session.objectKey,
    crs: form.crs || undefined,
    source: form.source || undefined,
    bbox: form.bbox || undefined,
    size: file.size,
    extendJson: Object.keys(ext).length ? JSON.stringify(ext) : undefined
  };

  if (session.method === 'PUT') {
    await uploadSingle(file, session);
    await registerCatalog(metadata);
  } else if (session.method === 'MPU') {
    await uploadMultipart(file, session);
    await registerCatalog(metadata);
  } else {
    // LOCAL：服务端中转
    await registerCatalog(metadata, file);
  }
}

// ==================== 提交（批量队列） ====================
async function handleSubmit() {
  if (!fileList.value.length) {
    window.$message?.warning('请先选择文件');
    return;
  }
  if (!form.categoryId) {
    window.$message?.warning('请选择数据分类');
    return;
  }
  if (!filesFormatValid.value) {
    window.$message?.warning(`存在当前分类不支持的格式，允许：${allowedFormats.value.join(' / ')}`);
    return;
  }
  submitting.value = true;
  stage.value = 'uploading';
  progress.value = 0;
  // 只处理未成功的文件（部分成功后点"继续上传"不会重复上传已成功的）
  fileList.value = fileList.value.filter(e => !e.ok);
  batchTotal.value = fileList.value.length;
  batchSuccess.value = 0;
  batchFailed.value = 0;

  const entries = fileList.value.slice();
  try {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      entry.ok = false;
      entry.error = undefined;
      try {
        await uploadAndRegister(entry.file);
        entry.ok = true;
        batchSuccess.value++;
      } catch (err) {
        entry.error = (err as Error)?.message || '上传失败';
        batchFailed.value++;
      }
      // 整体进度：已处理数 + 当前文件收尾
      progress.value = Math.round(((i + 1) / entries.length) * 100);
    }
    stage.value = 'done';
    if (batchFailed.value === 0) {
      window.$message?.success(`批量上传完成，成功 ${batchSuccess.value} 条`);
    } else {
      window.$message?.warning(`批量上传完成：成功 ${batchSuccess.value} 条，失败 ${batchFailed.value} 条`);
    }
    // 有成功即触发列表刷新（失败保留在清单便于重试）
    if (batchSuccess.value > 0) {
      emit('success');
      emit('update:show', false);
    }
  } finally {
    submitting.value = false;
  }
}

/** 重新尝试失败文件 */
function retryFailed() {
  handleSubmit();
}

function handleCancel() {
  if (submitting.value) return;
  emit('update:show', false);
}
</script>

<template>
  <NModal
    :show="props.show"
    :mask-closable="!submitting"
    style="--n-body-text-color: #cbe3ff"
    @update:show="v => emit('update:show', v)"
  >
    <div class="cat-upload-panel">
      <div class="cat-upload-panel__header">
        <div class="cat-upload-panel__titles">
          <span class="cat-upload-panel__title">数据入库</span>
          <span class="cat-upload-panel__subtitle">空间数据批量上传登记 · 支持多选 / 文件夹 · 大文件自动分片直传</span>
        </div>
        <button class="cat-upload-panel__close" :disabled="submitting" @click="handleCancel">✕</button>
      </div>

      <!-- Step 1: 选文件（多选 / 文件夹） -->
      <input ref="fileInputRef" type="file" multiple class="cat-upload-panel__file-input" @change="handleFileChange" />
      <input
        ref="folderInputRef"
        type="file"
        class="cat-upload-panel__file-input"
        v-bind="folderInputAttrs"
        @change="handleFolderChange"
      />
      <div class="cat-upload-drop" :class="{ 'cat-upload-drop--active': fileList.length }" @click="openFilePicker">
        <template v-if="fileList.length">
          <span class="cat-upload-drop__tip">已选 {{ fileList.length }} 个文件</span>
          <span class="cat-upload-drop__sub">{{ formatSize(totalSize) }} · 点击追加文件，或使用下方按钮选择文件夹</span>
        </template>
        <template v-else>
          <span class="cat-upload-drop__tip">点击选择数据文件</span>
          <span class="cat-upload-drop__sub">可多选独立影像（tif 等），逐个登记；大于 50MB 自动分片直传</span>
        </template>
      </div>
      <div class="cat-upload-drop-actions">
        <button class="cat-upload-drop-btn" @click="openFilePicker">+ 选择文件（可多选）</button>
        <button class="cat-upload-drop-btn" @click="openFolderPicker">+ 选择文件夹</button>
      </div>

      <!-- 文件清单 -->
      <div v-if="fileList.length" class="cat-upload-list">
        <div v-for="(item, idx) in fileList" :key="fileKey(item.file)" class="cat-upload-list__item">
          <span class="cat-upload-list__name" :title="item.file.webkitRelativePath || item.file.name">
            {{ item.file.webkitRelativePath || item.file.name }}
          </span>
          <span class="cat-upload-list__size">{{ formatSize(item.file.size) }}</span>
          <span
            class="cat-upload-list__status"
            :class="{
              'cat-upload-list__status--ok': item.ok,
              'cat-upload-list__status--err': item.error
            }"
          >
            {{ item.ok ? '成功' : item.error ? '失败' : '' }}
          </span>
          <button class="cat-upload-list__remove" :disabled="submitting" @click="removeFile(idx)">✕</button>
        </div>
      </div>

      <!-- 分类选择 -->
      <div class="cat-upload-field">
        <span class="cat-upload-field__label">
          数据分类
          <span class="cat-upload-field__required">*</span>
        </span>
        <NSpin :show="categoryLoading">
          <NTreeSelect
            v-model:value="form.categoryId"
            :options="categoryOptions"
            placeholder="请选择数据分类（批量统一应用）"
            clearable
          />
        </NSpin>
        <span v-if="selectedCategoryNode" class="cat-upload-field__hint">
          允许格式：{{ allowedFormats.join(' / ') }}
        </span>
        <span v-if="invalidFiles.length" class="cat-upload-field__hint cat-upload-field__hint--err">
          {{ invalidFiles.length }} 个文件格式不受支持：{{
            invalidFiles
              .slice(0, 3)
              .map(e => e.file.name)
              .join('、')
          }}{{ invalidFiles.length > 3 ? '…' : '' }}
        </span>
      </div>

      <!-- Step 2: 元数据（批量统一应用） -->
      <div class="cat-upload-meta">
        <div class="cat-upload-field">
          <span class="cat-upload-field__label">
            数据名称
            <span class="cat-upload-field__optional">（不填则用各文件名）</span>
          </span>
          <NInput v-model:value="form.name" placeholder="批量上传可不填，每条将用自身文件名" />
        </div>
        <div class="cat-upload-grid">
          <div class="cat-upload-field">
            <span class="cat-upload-field__label">数据来源</span>
            <NInput v-model:value="form.source" placeholder="如：测绘局 / 无人机采集" />
          </div>
          <div class="cat-upload-field">
            <span class="cat-upload-field__label">坐标系</span>
            <NInput v-model:value="form.crs" placeholder="如：EPSG:4326" />
          </div>
        </div>
        <div class="cat-upload-grid">
          <div class="cat-upload-field">
            <span class="cat-upload-field__label">空间范围 (minLng,minLat,maxLng,maxLat)</span>
            <NInput v-model:value="form.bbox" placeholder="如：116.3,39.9,116.5,40.1" />
          </div>
          <div class="cat-upload-field">
            <span class="cat-upload-field__label">分辨率</span>
            <NInput v-model:value="form.resolution" placeholder="可选，如：0.5m" />
          </div>
        </div>
        <div class="cat-upload-field">
          <span class="cat-upload-field__label">描述</span>
          <NInput
            v-model:value="form.description"
            type="textarea"
            :rows="2"
            placeholder="可选，批量统一应用到所有记录"
          />
        </div>
      </div>

      <!-- 进度 -->
      <div v-if="submitting || stage === 'done'" class="cat-upload-progress">
        <span class="cat-upload-progress__text">
          {{
            stage === 'uploading'
              ? `批量上传中 ${progress}%（${batchSuccess + batchFailed}/${batchTotal}）`
              : `上传完成：成功 ${batchSuccess}，失败 ${batchFailed}`
          }}
        </span>
        <div class="cat-upload-progress__bar">
          <div class="cat-upload-progress__bar-inner" :style="{ width: `${progress}%` }" />
        </div>
      </div>

      <div class="cat-upload-panel__actions">
        <NButton size="small" :disabled="submitting" @click="handleCancel">取消</NButton>
        <NButton v-if="stage === 'done' && batchFailed > 0" size="small" type="warning" @click="retryFailed">
          重试失败
        </NButton>
        <NButton type="primary" size="small" :loading="submitting" @click="handleSubmit">
          {{ stage === 'done' ? '继续上传' : '确认上传' }}
        </NButton>
      </div>
    </div>
  </NModal>
</template>

<style scoped lang="scss">
.cat-upload-panel {
  position: relative;
  width: 600px;
  max-width: 92vw;
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(6, 22, 47, 0.97), rgba(3, 15, 34, 0.98));
  border: 1px solid rgba(43, 131, 255, 0.3);
  box-shadow:
    inset 0 0 0 1px rgba(64, 158, 255, 0.08),
    0 24px 60px rgba(1, 8, 18, 0.6);
  overflow: visible;
  padding: 0 20px 18px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
}
.cat-upload-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0 12px;
  border-bottom: 1px solid rgba(43, 131, 255, 0.18);
  margin-bottom: 14px;
}
.cat-upload-panel__titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cat-upload-panel__title {
  font-size: 15px;
  font-weight: 600;
  color: #dbe9fa;
}
.cat-upload-panel__subtitle {
  font-size: 12px;
  color: rgba(168, 205, 240, 0.55);
}
.cat-upload-panel__close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: rgba(180, 210, 240, 0.7);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}
.cat-upload-panel__close:hover:not(:disabled) {
  color: #fff;
  background: rgba(41, 163, 255, 0.12);
}
.cat-upload-panel__close:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.cat-upload-panel__file-input {
  display: none;
}
.cat-upload-drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 22px 16px;
  border: 1.5px dashed rgba(43, 131, 255, 0.4);
  border-radius: 8px;
  cursor: pointer;
  background: rgba(2, 12, 28, 0.5);
  transition: all 0.2s;
  text-align: center;
  margin-bottom: 10px;
}
.cat-upload-drop:hover,
.cat-upload-drop--active {
  border-color: rgba(41, 163, 255, 0.7);
  background: rgba(41, 163, 255, 0.06);
}
.cat-upload-drop__name {
  font-size: 14px;
  font-weight: 500;
  color: #eaf6ff;
  word-break: break-all;
}
.cat-upload-drop__size {
  font-size: 12px;
  color: rgba(168, 205, 240, 0.6);
}
.cat-upload-drop__tip {
  font-size: 14px;
  color: rgba(203, 227, 255, 0.85);
}
.cat-upload-drop__sub {
  font-size: 12px;
  color: rgba(168, 205, 240, 0.5);
}
.cat-upload-drop-actions {
  display: flex;
  gap: 10px;
  margin: -4px 0 12px;
}
.cat-upload-drop-btn {
  flex: 1;
  padding: 7px 0;
  font-size: 12px;
  color: rgba(127, 210, 255, 0.85);
  background: rgba(41, 163, 255, 0.08);
  border: 1px solid rgba(41, 163, 255, 0.3);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}
.cat-upload-drop-btn:hover {
  color: #eaf6ff;
  background: rgba(41, 163, 255, 0.16);
}
.cat-upload-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 150px;
  overflow-y: auto;
  border: 1px solid rgba(43, 131, 255, 0.18);
  border-radius: 6px;
  padding: 6px 8px;
  margin-bottom: 12px;
  background: rgba(2, 12, 28, 0.4);
}
.cat-upload-list__item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(203, 227, 255, 0.85);
}
.cat-upload-list__name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cat-upload-list__size {
  color: rgba(168, 205, 240, 0.6);
  flex-shrink: 0;
}
.cat-upload-list__status {
  flex-shrink: 0;
  min-width: 32px;
  text-align: center;
  color: rgba(168, 205, 240, 0.5);
}
.cat-upload-list__status--ok {
  color: #67c23a;
}
.cat-upload-list__status--err {
  color: #f56c6c;
}
.cat-upload-list__remove {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: rgba(180, 210, 240, 0.7);
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s;
}
.cat-upload-list__remove:hover:not(:disabled) {
  color: #f56c6c;
  background: rgba(245, 108, 108, 0.1);
}
.cat-upload-list__remove:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.cat-upload-meta {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}
.cat-upload-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.cat-upload-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cat-upload-field__label {
  font-size: 13px;
  color: rgba(203, 227, 255, 0.85);
}
.cat-upload-field__required {
  color: #f56c6c;
  margin-left: 2px;
}
.cat-upload-field__optional {
  font-size: 11px;
  color: rgba(168, 205, 240, 0.5);
  margin-left: 4px;
}
.cat-upload-field__hint {
  font-size: 12px;
  color: rgba(127, 210, 255, 0.7);
}
.cat-upload-field__hint--err {
  color: #f56c6c;
}
.cat-upload-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 14px;
}
.cat-upload-progress__text {
  font-size: 12px;
  color: rgba(203, 227, 255, 0.85);
}
.cat-upload-progress__bar {
  height: 6px;
  background: rgba(43, 131, 255, 0.2);
  border-radius: 3px;
  overflow: hidden;
}
.cat-upload-progress__bar-inner {
  height: 100%;
  background: linear-gradient(90deg, rgba(41, 163, 255, 0.8), rgba(124, 92, 255, 0.8));
  border-radius: 3px;
  transition: width 0.3s;
}
.cat-upload-panel__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}
/* 输入深色适配 */
.cat-upload-meta :deep(.n-input),
.cat-upload-panel :deep(.n-base-selection),
.cat-upload-meta :deep(.n-input-number) {
  --n-color: rgba(4, 16, 36, 0.7);
  --n-color-focus: rgba(4, 16, 36, 0.9);
  --n-border: 1px solid rgba(43, 131, 255, 0.28);
  --n-border-hover: 1px solid rgba(41, 163, 255, 0.5);
  --n-text-color: #eaf6ff;
  --n-placeholder-color: rgba(168, 205, 240, 0.4);
  --n-border-radius: 6px;
}
.cat-upload-panel :deep(.n-form-item-label) {
  color: rgba(203, 227, 255, 0.85);
}
</style>
