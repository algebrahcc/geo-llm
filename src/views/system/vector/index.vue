<script setup lang="ts">
import { computed, h, onMounted, onBeforeUnmount, nextTick, ref, watch } from 'vue';
import { NButton, NDataTable, NInput, NModal, NPopconfirm, NSelect, NUpload, useMessage } from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import type { DataTableColumns, PaginationProps, SelectOption } from 'naive-ui';
import {
  fetchVectorPage,
  fetchVectorDetail,
  fetchVectorExtent,
  fetchVectorUpdate,
  fetchVectorDelete,
  uploadVectorFile,
  getVectorTileUrl
} from '@/service/api/vector';
import { getBasemapUrl, getBasemapMaxZoom } from '@/utils/basemap';

import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import VectorTileLayer from 'ol/layer/VectorTile';
import VectorTileSource from 'ol/source/VectorTile';
import MVT from 'ol/format/MVT';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import { defaults as defaultControls } from 'ol/control';
import { createXYZ } from 'ol/tilegrid';
import { fromLonLat, transformExtent } from 'ol/proj';
import 'ol/ol.css';

const message = useMessage();

const loading = ref(false);
const list = ref<Api.Vector.VectorItem[]>([]);
const keyword = ref('');
const typeFilter = ref<string | null>(null);
const pagination = ref<PaginationProps>({
  page: 1,
  pageSize: 10,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
  prefix: ({ itemCount }: { itemCount?: number }) => `共 ${itemCount ?? 0} 条`
});

const typeOptions: SelectOption[] = [
  { label: '全部类型', value: '' },
  { label: 'GeoJSON', value: 'GeoJSON' }
];

function statusConfig(status?: number | string) {
  const s = typeof status === 'string' ? Number(status) : status;
  if (s === 0 || String(status) === 'IMPORTING') return { text: '导入中', type: 'warning' };
  if (s === 1 || String(status) === 'SUCCESS') return { text: '已完成', type: 'success' };
  if (s === 2 || String(status) === 'FAILED') return { text: '失败', type: 'danger' };
  return { text: '未知', type: 'default' };
}

function formatCount(v?: string) {
  if (!v) return '0';
  const n = Number(v);
  return Number.isNaN(n) ? v : n.toLocaleString();
}

function formatTime(v?: string) {
  if (!v) return '—';
  return v.replace('T', ' ').slice(0, 19);
}

function formatSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function loadList(reset = false) {
  if (reset) pagination.value.page = 1;
  loading.value = true;
  try {
    const params: Record<string, unknown> = {
      current: pagination.value.page,
      size: pagination.value.pageSize
    };
    if (keyword.value.trim()) params.keyword = keyword.value.trim();
    if (typeFilter.value) params.sourceType = typeFilter.value;
    const res = await fetchVectorPage(params);
    if (res && (res as any).data) {
      const d = (res as any).data;
      list.value = d.records ?? d.list ?? [];
      pagination.value.itemCount = d.total ?? 0;
    } else {
      list.value = [];
      pagination.value.itemCount = 0;
    }
  } catch {
    message.error('加载列表失败');
  } finally {
    loading.value = false;
  }
}

function onPageChange(page: number) {
  pagination.value.page = page;
  loadList();
}

function onPageSizeChange(size: number) {
  pagination.value.pageSize = size;
  pagination.value.page = 1;
  loadList();
}

// ===== 地图弹窗 =====
const mapVisible = ref(false);
const mapRow = ref<Api.Vector.VectorItem | null>(null);

// ===== 操作 =====
function openMap(row: Api.Vector.VectorItem) {
  mapRow.value = row;
  mapVisible.value = true;
}
const mapContainer = ref<HTMLDivElement>();
const mapLoaded = ref(false);
const mapError = ref('');
const mapLayerName = ref('');
const mapSourceType = ref('');
const mapFeatureCount = ref(0);
let olMap: Map | null = null;

function vectorStyle() {
  return new Style({
    fill: new Fill({ color: 'rgba(255, 102, 0, 0.25)' }),
    stroke: new Stroke({ color: '#ff6600', width: 2 }),
    image: new CircleStyle({
      radius: 5,
      fill: new Fill({ color: '#ff6600' }),
      stroke: new Stroke({ color: '#fff', width: 1.5 })
    })
  });
}

async function initMap() {
  if (!mapRow.value) return;
  const vectorId = mapRow.value.id;
  if (!vectorId) {
    mapError.value = '缺少矢量图层 ID 参数';
    return;
  }

  mapError.value = '';
  mapLoaded.value = false;

  try {
    const { data } = await fetchVectorDetail(vectorId);
    if (data) {
      mapLayerName.value = data.vectorName;
      mapSourceType.value = data.sourceType;
      mapFeatureCount.value = Number(data.featureCount) || 0;
    }
  } catch {
    /* ignore */
  }

  const tileUrl = getVectorTileUrl(vectorId, mapSourceType.value);
  if (!tileUrl) {
    mapError.value = '无法生成瓦片 URL';
    return;
  }

  await nextTick();
  if (!mapContainer.value) return;

  const vectorSource = new VectorTileSource({
    format: new MVT(),
    url: tileUrl,
    tileGrid: createXYZ({ maxZoom: 18 })
  });

  const vectorLayer = new VectorTileLayer({
    source: vectorSource,
    style: vectorStyle(),
    declutter: true,
    renderMode: 'vector'
  });

  const layers: any[] = [];
  const basemapUrl = getBasemapUrl();
  if (basemapUrl) {
    layers.push(new TileLayer({ source: new XYZ({ url: basemapUrl, maxZoom: getBasemapMaxZoom() }) }));
  }
  layers.push(vectorLayer);

  olMap = new Map({
    target: mapContainer.value,
    layers,
    view: new View({ center: fromLonLat([104.07, 36.06]), zoom: 4, minZoom: 2, maxZoom: 18 }),
    controls: defaultControls({ zoom: true, attribution: true })
  });
  mapLoaded.value = true;

  try {
    const result: any = await fetchVectorExtent(vectorId);
    const extent = (result?.data ?? result?.response?.data) as number[] | null;
    if (extent && extent.length === 4) {
      const [minLng, minLat, maxLng, maxLat] = extent;
      setTimeout(() => {
        olMap!.getView().fit(transformExtent([minLng, minLat, maxLng, maxLat], 'EPSG:4326', 'EPSG:3857'), {
          padding: [40, 40, 40, 40],
          maxZoom: 14,
          duration: 800
        });
      }, 500);
    }
  } catch {
    /* ignore */
  }
}

function closeMap() {
  if (olMap) {
    olMap.setTarget(undefined);
    olMap = null;
  }
  mapError.value = '';
  mapLoaded.value = false;
  mapRow.value = null;
}

async function handleFitExtent() {
  if (!mapRow.value || !olMap) return;
  try {
    const result: any = await fetchVectorExtent(mapRow.value.id);
    const extent = (result?.data ?? result?.response?.data) as number[] | null;
    if (extent && extent.length === 4) {
      const [minLng, minLat, maxLng, maxLat] = extent;
      olMap.getView().fit(transformExtent([minLng, minLat, maxLng, maxLat], 'EPSG:4326', 'EPSG:3857'), {
        padding: [40, 40, 40, 40],
        maxZoom: 14,
        duration: 800
      });
    } else {
      message.info('暂无数据范围信息');
    }
  } catch {
    message.warning('获取数据范围失败');
  }
}

watch(mapVisible, visible => {
  if (visible) nextTick(() => initMap());
  else closeMap();
});

onBeforeUnmount(() => {
  if (olMap) {
    olMap.setTarget(undefined);
    olMap = null;
  }
});

const detailVisible = ref(false);
const detailData = ref<Api.Vector.VectorItem | null>(null);
function openDetail(row: Api.Vector.VectorItem) {
  detailData.value = row;
  detailVisible.value = true;
}

// ===== 编辑 =====
const editVisible = ref(false);
const editData = ref<Api.Vector.VectorItem | null>(null);
const editName = ref('');
const editLoading = ref(false);

function editRow(row: Api.Vector.VectorItem) {
  editData.value = row;
  editName.value = row.vectorName || '';
  editVisible.value = true;
}

function closeEdit() {
  editData.value = null;
  editName.value = '';
}

async function submitEdit() {
  if (!editData.value) return;
  editLoading.value = true;
  try {
    await fetchVectorUpdate(editData.value.id, { vectorName: editName.value });
    message.success('编辑成功');
    editVisible.value = false;
    loadList();
  } catch {
    message.error('编辑失败');
  } finally {
    editLoading.value = false;
  }
}

async function confirmDelete(row: Api.Vector.VectorItem) {
  try {
    await fetchVectorDelete([row.id]);
    message.success('删除成功');
    if (list.value.length === 1 && (pagination.value.page ?? 1) > 1) {
      pagination.value.page = (pagination.value.page ?? 1) - 1;
    }
    loadList();
  } catch {
    message.error('删除失败');
  }
}

// ===== 上传 =====
const importVisible = ref(false);
const importLoading = ref(false);
const importError = ref('');
const selectedFile = ref<File | null>(null);
const uploadRef = ref<any>(null);

function onFileChange({ fileList }: { fileList: any[] }) {
  importError.value = '';
  const f = fileList[0]?.file as File | undefined;
  if (!f) {
    selectedFile.value = null;
    return;
  }
  const lower = f.name.toLowerCase();
  if (!lower.endsWith('.geojson') && !lower.endsWith('.json')) {
    importError.value = '仅支持 GeoJSON 文件（.geojson / .json）';
    selectedFile.value = null;
    return;
  }
  selectedFile.value = f;
}

function closeImport() {
  if (importLoading.value) return;
  importVisible.value = false;
  selectedFile.value = null;
  importError.value = '';
  uploadRef.value?.clear();
}

async function confirmImport() {
  if (!selectedFile.value) {
    importError.value = '请先选择文件';
    return;
  }
  importLoading.value = true;
  importError.value = '';
  try {
    await uploadVectorFile(selectedFile.value);
    message.success('导入成功，地图服务生成中');
    importVisible.value = false;
    selectedFile.value = null;
    uploadRef.value?.clear();
    loadList(true);
  } catch (e: any) {
    importError.value = e?.message || '导入失败，请检查文件格式或服务状态';
  } finally {
    importLoading.value = false;
  }
}

// ===== 列定义 =====
const columns = computed<DataTableColumns<Api.Vector.VectorItem>>(() => [
  {
    title: 'ID',
    key: 'id',
    align: 'center',
    render(row) {
      return h('span', { class: 'row-text row-text--mono' }, row.id || '-');
    }
  },
  {
    title: '图层名称',
    key: 'vectorName',
    align: 'center',
    render(row) {
      return h('div', { class: 'dataset-cell' }, [
        h('span', { class: 'dataset-cell__title' }, row.vectorName || '未命名图层')
      ]);
    }
  },

  {
    title: '类型',
    key: 'sourceType',
    align: 'center',
    render(row) {
      return row.sourceType
        ? h(
            'span',
            {
              class: `vec-type-chip ${row.sourceType === 'GeoJSON' ? 'vec-type-chip--geojson' : 'vec-type-chip--default'}`
            },
            row.sourceType
          )
        : h('span', { class: 'row-text row-text--muted' }, '-');
    }
  },
  {
    title: '要素',
    key: 'featureCount',
    align: 'center',
    render(row) {
      return h('span', { class: 'row-text row-text--mono' }, formatCount(row.featureCount));
    }
  },
  {
    title: '状态',
    key: 'importStatus',
    align: 'center',
    render(row) {
      const s = statusConfig(row.importStatus);
      return h('span', { class: `vec-status-tag vec-status-tag--${s.type}` }, s.text);
    }
  },
  {
    title: '创建时间',
    key: 'createTime',
    align: 'center',
    render(row) {
      return h('span', { class: 'row-text' }, formatTime(row.createTime));
    }
  },
  {
    title: '操作',
    key: 'actions',
    align: 'center',
    render(row) {
      return h('div', { class: 'action-group' }, [
        h('div', { class: 'action-icon-btn', 'data-tooltip': '查看地图', onClick: () => openMap(row) }, [
          h(SvgIcon, { icon: 'mdi:map-outline' })
        ]),
        h('div', { class: 'action-icon-btn', 'data-tooltip': '详情', onClick: () => openDetail(row) }, [
          h(SvgIcon, { icon: 'mdi:information-outline' })
        ]),
        h('div', { class: 'action-icon-btn', 'data-tooltip': '编辑', onClick: () => editRow(row) }, [
          h(SvgIcon, { icon: 'mdi:pencil-outline' })
        ]),
        h(
          NPopconfirm,
          { onPositiveClick: () => confirmDelete(row), positiveText: '删除', negativeText: '取消' },
          {
            trigger: () =>
              h('div', { class: 'action-icon-btn action-icon-btn--danger', 'data-tooltip': '删除' }, [
                h(SvgIcon, { icon: 'mdi:close' })
              ]),
            default: () => '确认删除该图层？删除后不可恢复。'
          }
        )
      ]);
    }
  }
]);

onMounted(() => loadList(true));
</script>

<template>
  <div class="vec-page">
    <!-- 检索工具栏 -->
    <div class="vec-toolbar">
      <div class="vec-toolbar__left">
        <NInput
          v-model:value="keyword"
          class="vec-search-input"
          placeholder="搜索图层名称 / ID"
          clearable
          @keyup.enter="loadList(true)"
          @clear="loadList(true)"
        >
          <template #prefix>
            <SvgIcon icon="mdi:magnify" class="vec-search-input__icon" />
          </template>
        </NInput>
        <NSelect
          v-model:value="typeFilter"
          class="vec-filter-select"
          :options="typeOptions"
          placeholder="全部类型"
          @update:value="loadList(true)"
        />
      </div>
      <div class="vec-toolbar__right">
        <NButton class="vec-ghost-btn" :disabled="loading" @click="loadList(true)">
          <template #icon><SvgIcon icon="mdi:refresh" /></template>
          刷新
        </NButton>
        <NButton class="vec-primary-btn" @click="importVisible = true">
          <template #icon><SvgIcon icon="mdi:cloud-upload-outline" /></template>
          上传数据
        </NButton>
      </div>
    </div>

    <!-- 表格卡片 -->
    <main class="vec-card">
      <div class="vec-card-head">
        <div class="vec-card-head__title">矢量图层清单</div>
        <div class="vec-card-head__meta">GeoJSON · 上传即预览</div>
      </div>
      <div class="vec-table-wrap">
        <NDataTable
          :columns="columns"
          :data="list"
          :loading="loading"
          :bordered="false"
          :single-line="false"
          :row-key="row => row.id"
          :pagination="pagination"
          remote
          class="vec-data-table"
          @update:page="onPageChange"
          @update:page-size="onPageSizeChange"
        />
        <div v-if="!loading && list.length === 0" class="vec-empty">
          <SvgIcon icon="mdi:layers-outline" class="vec-empty__ico" />
          <p class="vec-empty__text">暂无矢量图层，点击右上角「上传数据」导入 GeoJSON</p>
        </div>
      </div>
    </main>

    <!-- 地图弹窗 -->
    <NModal
      v-model:show="mapVisible"
      :mask-closable="true"
      :close-on-esc="true"
      class="vec-map-modal"
      :on-after-leave="closeMap"
    >
      <div class="vec-map-card">
        <div class="vec-map-header">
          <div class="vec-map-header__left">
            <SvgIcon icon="mdi:map-outline" style="font-size: 20px; color: #62c4ff" />
            <span class="vec-map-header__title">{{ mapLayerName || '矢量地图' }}</span>
            <span v-if="mapSourceType" class="vec-type-chip vec-type-chip--geojson">{{ mapSourceType }}</span>
            <span v-if="mapFeatureCount > 0" class="vec-status-tag vec-status-tag--success">
              {{ mapFeatureCount.toLocaleString() }} 要素
            </span>
          </div>
          <div class="vec-map-header__right">
            <NButton size="small" @click="handleFitExtent">适配范围</NButton>
            <button class="vec-detail-close-btn" @click="mapVisible = false">
              <SvgIcon icon="mdi:close" />
            </button>
          </div>
        </div>
        <div v-if="mapError" class="vec-map-error">
          <SvgIcon icon="mdi:alert-circle" style="font-size: 48px; opacity: 0.4" />
          <p>{{ mapError }}</p>
        </div>
        <div v-else ref="mapContainer" class="vec-map-container" />
      </div>
    </NModal>

    <!-- 详情弹窗 -->
    <NModal v-model:show="detailVisible" :mask-closable="true" :close-on-esc="true" class="vec-detail-modal">
      <div v-if="detailData" class="vec-detail-card">
        <div class="vec-detail-header">
          <div class="vec-detail-header__left">
            <span class="vec-detail-header__icon">
              <SvgIcon icon="mdi:map-outline" />
            </span>
            <div class="vec-detail-header__text">
              <h2 class="vec-detail-header__title">{{ detailData.vectorName }}</h2>
              <div class="vec-detail-header__badges">
                <span
                  class="vec-type-chip"
                  :class="detailData.sourceType === 'GeoJSON' ? 'vec-type-chip--geojson' : 'vec-type-chip--default'"
                >
                  {{ detailData.sourceType || '未知' }}
                </span>
                <span class="vec-status-tag" :class="`vec-status-tag--${statusConfig(detailData.importStatus).type}`">
                  {{ statusConfig(detailData.importStatus).text }}
                </span>
              </div>
            </div>
          </div>
          <button class="vec-detail-close-btn" @click="detailVisible = false">
            <SvgIcon icon="mdi:close" />
          </button>
        </div>

        <div class="vec-detail-body">
          <section class="vec-detail-section">
            <div class="vec-detail-section__title">
              <SvgIcon icon="mdi:information-outline" class="vec-detail-section__icon" />
              基础信息
            </div>
            <div class="vec-detail-grid">
              <div class="vec-detail-field">
                <div class="vec-detail-field__label">图层名称</div>
                <div class="vec-detail-field__value">{{ detailData.vectorName }}</div>
              </div>
              <div class="vec-detail-field">
                <div class="vec-detail-field__label">数据类型</div>
                <div class="vec-detail-field__value">{{ detailData.sourceType || '—' }}</div>
              </div>
              <div class="vec-detail-field">
                <div class="vec-detail-field__label">要素数量</div>
                <div class="vec-detail-field__value vec-detail-field__value--mono">
                  {{ formatCount(detailData.featureCount) }}
                </div>
              </div>
              <div class="vec-detail-field">
                <div class="vec-detail-field__label">创建时间</div>
                <div class="vec-detail-field__value vec-detail-field__value--small">
                  {{ formatTime(detailData.createTime) }}
                </div>
              </div>
              <div class="vec-detail-field vec-detail-field--full">
                <div class="vec-detail-field__label">图层 ID</div>
                <div class="vec-detail-field__value vec-detail-field__value--mono">{{ detailData.id }}</div>
              </div>
            </div>
          </section>

          <section v-if="detailData.sourcePath" class="vec-detail-section">
            <div class="vec-detail-section__title">
              <SvgIcon icon="mdi:folder-open-outline" class="vec-detail-section__icon" />
              存储路径
            </div>
            <p class="vec-detail-desc">{{ detailData.sourcePath }}</p>
          </section>
        </div>
      </div>
    </NModal>

    <!-- 编辑弹窗 -->
    <NModal
      v-model:show="editVisible"
      :mask-closable="false"
      :close-on-esc="true"
      class="vec-detail-modal"
      @update:show="
        v => {
          if (!v) closeEdit();
        }
      "
    >
      <div v-if="editData" class="vec-detail-card">
        <div class="vec-detail-header">
          <div class="vec-detail-header__left">
            <span class="vec-detail-header__icon">
              <SvgIcon icon="mdi:pencil-outline" />
            </span>
            <h2 class="vec-detail-header__title">编辑图层</h2>
          </div>
          <button class="vec-detail-close-btn" @click="editVisible = false">
            <SvgIcon icon="mdi:close" />
          </button>
        </div>
        <div class="vec-detail-body">
          <div class="vec-edit-field">
            <label class="vec-edit-field__label">图层名称</label>
            <NInput v-model:value="editName" placeholder="输入图层名称" class="vec-edit-field__input" />
          </div>
          <div class="vec-import-footer" style="margin-top: 24px">
            <NButton class="vec-ghost-btn" @click="editVisible = false">取消</NButton>
            <NButton class="vec-primary-btn" :loading="editLoading" @click="submitEdit">保存</NButton>
          </div>
        </div>
      </div>
    </NModal>

    <!-- 上传弹窗 -->
    <NModal v-model:show="importVisible" :mask-closable="false" :close-on-esc="false" class="vec-detail-modal">
      <div class="vec-detail-card">
        <div class="vec-detail-header">
          <div class="vec-detail-header__left">
            <span class="vec-detail-header__icon">
              <SvgIcon icon="mdi:cloud-upload-outline" />
            </span>
            <div>
              <h2 class="vec-detail-header__title">上传矢量数据</h2>
              <div class="vec-detail-header__badges">
                <span class="vec-muted-text">仅支持 GeoJSON 文件（.geojson / .json）</span>
              </div>
            </div>
          </div>
          <button class="vec-detail-close-btn" :disabled="importLoading" @click="closeImport">
            <SvgIcon icon="mdi:close" />
          </button>
        </div>

        <div class="vec-detail-body">
          <NUpload
            ref="uploadRef"
            class="vec-upload"
            :default-upload="false"
            :max="1"
            accept=".geojson,.json,application/geo+json,application/json"
            @change="onFileChange"
          >
            <div class="vec-upload__zone">
              <SvgIcon icon="mdi:cloud-upload-outline" class="vec-upload__ico" />
              <div class="vec-upload__title">将 GeoJSON 文件拖拽到此处，或点击选择</div>
              <div class="vec-upload__hint">单文件最大 500MB</div>
            </div>
          </NUpload>

          <div v-if="selectedFile" class="vec-upload__file">
            <SvgIcon icon="mdi:file-document-outline" class="vec-upload__file-ico" />
            <span class="vec-upload__file-name">{{ selectedFile.name }}</span>
            <span class="vec-upload__file-size">{{ formatSize(selectedFile.size) }}</span>
          </div>

          <p v-if="importError" class="vec-import-error">
            <SvgIcon icon="mdi:alert-outline" />
            {{ importError }}
          </p>

          <div class="vec-import-footer">
            <NButton class="vec-ghost-btn" :disabled="importLoading" @click="closeImport">取消</NButton>
            <NButton
              class="vec-primary-btn"
              :disabled="!selectedFile || importLoading"
              :loading="importLoading"
              @click="confirmImport"
            >
              {{ importLoading ? '导入中…' : '开始导入' }}
            </NButton>
          </div>
        </div>
      </div>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
.vec-page {
  --vec-page-bg:
    radial-gradient(circle at top, rgba(0, 153, 255, 0.14) 0%, rgba(0, 0, 0, 0) 36%),
    linear-gradient(180deg, #041528 0%, #041120 38%, #03101b 100%);
  --vec-surface-bg: linear-gradient(180deg, rgba(3, 19, 41, 0.94) 0%, rgba(2, 15, 32, 0.96) 100%);
  --vec-surface-border: rgba(43, 131, 255, 0.28);
  --vec-line: rgba(25, 95, 176, 0.35);
  --vec-text-primary: #eaf5ff;
  --vec-text-secondary: rgba(203, 227, 255, 0.72);
  --vec-text-tertiary: rgba(147, 196, 255, 0.62);
  --vec-accent: #29a3ff;
  --vec-danger: #ff6b6b;
  height: 100%;
  background: var(--vec-page-bg);
  color: var(--vec-text-primary);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  box-sizing: border-box;
  overflow: hidden;
}

.vec-card {
  background: var(--vec-surface-bg);
  border: 1px solid var(--vec-surface-border);
  box-shadow:
    0 0 0 1px rgba(32, 111, 202, 0.22),
    0 18px 40px rgba(1, 8, 18, 0.45);
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 4px;
  overflow: hidden;
}

/* Card corner accents — same as catalog */
.vec-card::before,
.vec-card::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  pointer-events: none;
  z-index: 2;
  opacity: 0.35;
}
.vec-card::before {
  top: -1px;
  left: -1px;
  border-top: 2px solid var(--vec-accent);
  border-left: 2px solid var(--vec-accent);
  border-radius: 4px 0 0 0;
}
.vec-card::after {
  bottom: -1px;
  right: -1px;
  border-bottom: 2px solid var(--vec-accent);
  border-right: 2px solid var(--vec-accent);
  border-radius: 0 0 4px 0;
}

/* ===== Toolbar — single row: search + filter + actions ===== */
.vec-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.vec-toolbar__left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.vec-toolbar__right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

/* ===== Primary / Ghost Buttons (NButton) — same as catalog ===== */
.vec-primary-btn {
  --n-color: linear-gradient(180deg, rgba(23, 131, 240, 0.96) 0%, rgba(8, 83, 171, 0.96) 100%) !important;
  --n-color-hover: linear-gradient(180deg, rgba(43, 151, 255, 0.98) 0%, rgba(13, 93, 186, 0.98) 100%) !important;
  --n-color-pressed: linear-gradient(180deg, rgba(8, 83, 171, 0.96) 0%, rgba(5, 63, 141, 0.96) 100%) !important;
  --n-text-color: #e9f5ff !important;
  --n-text-color-hover: #fff !important;
  --n-text-color-pressed: rgba(255, 255, 255, 0.9) !important;
  --n-border: 1px solid rgba(96, 191, 255, 0.32) !important;
  --n-border-hover: 1px solid rgba(96, 191, 255, 0.5) !important;
  --n-border-radius: 8px !important;
  --n-font-size: 13px !important;
  --n-height: 38px !important;
  --n-padding: 0 18px !important;
  font-weight: 600;
  letter-spacing: 0.3px;
  box-shadow:
    inset 0 1px 0 rgba(181, 233, 255, 0.14),
    0 4px 16px rgba(4, 79, 162, 0.22);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}
.vec-primary-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  transition: left 0.6s ease;
}
.vec-primary-btn:hover {
  box-shadow:
    inset 0 1px 0 rgba(181, 233, 255, 0.22),
    0 6px 24px rgba(4, 79, 162, 0.35);
  transform: translateY(-2px);
}
.vec-primary-btn:hover::before {
  left: 100%;
}
.vec-primary-btn:active {
  transform: translateY(0);
  box-shadow:
    inset 0 2px 4px rgba(0, 0, 0, 0.2),
    0 2px 8px rgba(4, 79, 162, 0.2);
  transition: all 0.1s ease;
}

.vec-ghost-btn {
  --n-color: linear-gradient(180deg, rgba(9, 43, 82, 0.94) 0%, rgba(5, 23, 46, 0.96) 100%) !important;
  --n-color-hover: linear-gradient(180deg, rgba(14, 53, 102, 0.96) 0%, rgba(8, 33, 66, 0.96) 100%) !important;
  --n-color-pressed: linear-gradient(180deg, rgba(5, 23, 46, 0.96) 0%, rgba(3, 16, 35, 0.96) 100%) !important;
  --n-text-color: rgba(203, 227, 255, 0.85) !important;
  --n-text-color-hover: #e9f5ff !important;
  --n-border: 1px solid rgba(43, 118, 197, 0.35) !important;
  --n-border-hover: 1px solid rgba(58, 160, 255, 0.5) !important;
  --n-border-radius: 8px !important;
  --n-font-size: 13px !important;
  --n-height: 38px !important;
  --n-padding: 0 18px !important;
  letter-spacing: 0.3px;
  box-shadow: inset 0 1px 0 rgba(129, 211, 255, 0.04);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.vec-ghost-btn:hover {
  box-shadow:
    inset 0 1px 0 rgba(129, 211, 255, 0.08),
    0 4px 12px rgba(0, 0, 0, 0.25);
  transform: translateY(-2px);
  border-color: rgba(58, 160, 255, 0.5) !important;
}
.vec-ghost-btn:active {
  transform: translateY(0);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.15);
  transition: all 0.1s ease;
}

.vec-search-input {
  max-width: 400px;
  min-width: 280px;
}
.vec-search-input :deep(.n-input) {
  --n-border: 1px solid rgba(43, 118, 197, 0.38) !important;
  --n-border-hover: 1px solid rgba(58, 160, 255, 0.5) !important;
  --n-border-focus: 1px solid rgba(58, 160, 255, 0.65) !important;
  --n-color: rgba(2, 16, 31, 0.98) !important;
  --n-color-focus: rgba(2, 16, 31, 0.98) !important;
  --n-text-color: #eaf5ff !important;
  --n-placeholder-color: rgba(132, 177, 233, 0.45) !important;
  --n-caret-color: #5ea4ff !important;
  --n-font-size: 13px !important;
  --n-height: 38px !important;
  --n-border-radius: 8px !important;
  --n-box-shadow-focus: 0 0 0 2px rgba(41, 163, 255, 0.12), 0 2px 8px rgba(0, 0, 0, 0.25) !important;
  letter-spacing: 0.2px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: linear-gradient(180deg, rgba(2, 16, 31, 0.98) 0%, rgba(1, 12, 24, 0.98) 100%);
}
.vec-search-input :deep(.n-input__border),
.vec-search-input :deep(.n-input__state-border) {
  display: none;
}
.vec-search-input__icon {
  font-size: 18px;
  color: #7cc4f0;
  opacity: 0.7;
}

.vec-filter-select {
  width: 168px;
}
.vec-filter-select :deep(.n-base-selection) {
  height: 38px;
  border-radius: 8px;
  background: rgba(2, 16, 31, 0.98);
  border-color: rgba(43, 118, 197, 0.38);
}
.vec-filter-select :deep(.n-base-selection-label) {
  color: var(--vec-text-primary);
}
.vec-filter-select :deep(.n-base-selection-placeholder),
.vec-filter-select :deep(.n-base-selection-input__content) {
  color: var(--vec-text-tertiary);
}

/* ===== Card head ===== */
.vec-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--vec-line);
  background: linear-gradient(180deg, rgba(7, 27, 51, 0.94) 0%, rgba(4, 20, 40, 0.96) 100%);
  position: relative;
}
.vec-card-head::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  bottom: 20%;
  width: 2px;
  border-radius: 1px;
  background: linear-gradient(180deg, transparent, var(--vec-accent), transparent);
  opacity: 0.5;
}
.vec-card-head__title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-shadow: 0 0 8px rgba(41, 163, 255, 0.1);
}
.vec-card-head__meta {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  color: var(--vec-text-tertiary);
  font-size: 12px;
}
.vec-table-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* ===== NDataTable deep overrides — same as catalog ===== */
.vec-data-table {
  flex: 1;
  --n-th-color: rgba(6, 29, 56, 0.94) !important;
  --n-td-color: transparent !important;
  --n-td-color-hover: rgba(33, 116, 212, 0.14) !important;
  --n-border-color: rgba(25, 95, 176, 0.35) !important;
  --n-th-text-color: rgba(203, 227, 255, 0.72) !important;
  --n-td-text-color: rgba(203, 227, 255, 0.72) !important;
  --n-th-font-weight: 600 !important;
  --n-font-size: 13px !important;
}
.vec-data-table :deep(.n-data-table-th) {
  background: linear-gradient(180deg, rgba(6, 29, 56, 0.94) 0%, rgba(4, 22, 43, 0.94) 100%) !important;
  font-size: 13px;
  padding: 14px 12px;
}
.vec-data-table :deep(.n-data-table-td) {
  padding: 14px 12px;
  border-bottom: 1px solid rgba(18, 73, 135, 0.32) !important;
}
.vec-data-table :deep(.n-data-table-tr:hover .n-data-table-td) {
  background: rgba(33, 116, 212, 0.14) !important;
}
.vec-data-table :deep(.n-data-table-table) {
  border-collapse: separate;
  border-spacing: 0;
}

/* ===== Table cell helpers — same as catalog ===== */
.dataset-cell {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}
.dataset-cell__bullet {
  flex-shrink: 0;
  font-size: 14px;
  color: #62c4ff;
  filter: drop-shadow(0 0 4px rgba(98, 196, 255, 0.25));
  line-height: 1;
}
.dataset-cell__title {
  color: var(--vec-text-primary);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}
.dataset-cell__sub {
  flex-shrink: 0;
  color: var(--vec-text-tertiary);
  font-size: 11px;
  white-space: nowrap;
}

.row-text {
  color: var(--vec-text-secondary);
  font-size: 13px;
}
.row-text--muted {
  color: rgba(160, 198, 241, 0.74);
}
.row-text--mono {
  font-family: 'DIN', 'Consolas', monospace;
}

/* Type chips — same spec as catalog */
.vec-type-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 74px;
  height: 24px;
  padding: 0 10px;
  border-radius: 4px;
  border: 1px solid transparent;
  font-size: 11px;
  line-height: 1;
  transition: all 0.2s ease;
}
.vec-type-chip--geojson {
  background: rgba(34, 197, 94, 0.15);
  border-color: rgba(34, 197, 94, 0.3);
  color: rgba(74, 222, 128, 0.9);
}
.vec-type-chip--default {
  background: rgba(150, 69, 18, 0.22);
  border-color: rgba(255, 132, 72, 0.34);
  color: #ffb087;
}

/* Status tags — same spec as catalog */
.vec-status-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 52px;
  height: 22px;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 1;
  font-weight: 500;
}
.vec-status-tag--success {
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: rgba(74, 222, 128, 0.9);
}
.vec-status-tag--warning {
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: rgba(251, 191, 36, 0.9);
}
.vec-status-tag--danger {
  background: rgba(255, 107, 107, 0.15);
  border: 1px solid rgba(255, 107, 107, 0.3);
  color: rgba(255, 141, 141, 0.9);
}
.vec-status-tag--default {
  background: rgba(148, 163, 184, 0.12);
  border: 1px solid rgba(148, 163, 184, 0.2);
  color: rgba(203, 213, 225, 0.7);
}

/* ===== Action buttons — same as catalog (round, with tooltip) ===== */
.vec-data-table :deep(.action-group) {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
}
.vec-data-table :deep(.action-icon-btn) {
  position: relative;
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(41, 163, 255, 0.06);
  border: 1px solid rgba(41, 163, 255, 0.12);
  color: rgba(203, 227, 255, 0.65);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: inherit;
  outline: none;
}
.vec-data-table :deep(.action-icon-btn:hover) {
  color: #fff;
  background: rgba(41, 163, 255, 0.18);
  border-color: rgba(41, 163, 255, 0.35);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(41, 163, 255, 0.2);
}
.vec-data-table :deep(.action-icon-btn::after) {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  padding: 3px 8px;
  border-radius: 4px;
  background: rgba(6, 29, 56, 0.95);
  border: 1px solid rgba(41, 163, 255, 0.25);
  color: rgba(203, 227, 255, 0.9);
  font-size: 11px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  z-index: 10;
}
.vec-data-table :deep(.action-icon-btn:hover::after) {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
.vec-data-table :deep(.action-icon-btn--danger) {
  background: rgba(255, 107, 107, 0.05);
  border-color: rgba(255, 107, 107, 0.12);
  color: rgba(255, 141, 141, 0.7);
}
.vec-data-table :deep(.action-icon-btn--danger:hover) {
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.15);
  border-color: rgba(255, 107, 107, 0.35);
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.18);
}

/* ===== Pagination footer bar ===== */
.vec-data-table :deep(.n-data-table__pagination) {
  border-top: 1px solid var(--vec-line);
  background: linear-gradient(180deg, rgba(4, 21, 41, 0.98) 0%, rgba(4, 18, 34, 0.98) 100%);
  min-height: 52px;
  padding: 8px 14px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.vec-data-table :deep(.n-pagination) {
  --n-item-text-color: rgba(203, 227, 255, 0.78) !important;
  --n-item-text-color-hover: #fff !important;
  --n-item-text-color-active: #fff !important;
  --n-item-color-active: linear-gradient(180deg, rgba(23, 115, 230, 0.72) 0%, rgba(10, 72, 148, 0.72) 100%) !important;
  --n-item-border-active: 1px solid rgba(92, 184, 255, 0.55) !important;
  --n-item-color: rgba(8, 28, 56, 0.85) !important;
  --n-item-border: 1px solid rgba(48, 115, 190, 0.36) !important;
  --n-item-border-hover: 1px solid rgba(76, 169, 255, 0.5) !important;
  --n-item-color-hover: rgba(14, 42, 88, 0.92) !important;
  --n-item-border-radius: 5px !important;
  --n-input-border: 1px solid rgba(48, 115, 190, 0.36) !important;
  --n-input-border-hover: 1px solid rgba(76, 169, 255, 0.5) !important;
  font-size: 13px;
}
.vec-data-table :deep(.n-pagination .n-pagination-item) {
  min-width: 30px;
  height: 30px;
  border-radius: 5px;
  font-size: 13px;
  transition: all 0.2s ease;
}
.vec-data-table :deep(.n-pagination .n-pagination-item:hover) {
  border-color: rgba(76, 169, 255, 0.5);
  color: #fff;
  background: rgba(14, 42, 88, 0.92);
  transform: translateY(-1px);
}
.vec-data-table :deep(.n-pagination .n-pagination-item--active) {
  box-shadow: 0 2px 10px rgba(41, 163, 255, 0.25);
  font-weight: 600;
}
.vec-data-table :deep(.n-pagination .n-pagination-item--disabled) {
  opacity: 0.45;
}
.vec-data-table :deep(.n-pagination .n-pagination-quick-jumper) {
  color: var(--vec-text-secondary);
  font-size: 13px;
}
.vec-data-table :deep(.n-pagination .n-pagination-quick-jumper .n-input) {
  --n-height: 30px;
  --n-border-radius: 5px;
}
.vec-data-table :deep(.n-pagination-ellipsis) {
  color: rgba(203, 227, 255, 0.5);
  font-size: 13px;
}

/* Empty state */
.vec-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  pointer-events: none;
}
.vec-empty__ico {
  font-size: 42px;
  color: rgba(98, 196, 255, 0.35);
}
.vec-empty__text {
  margin: 0;
  font-size: 13px;
  color: var(--vec-text-tertiary);
}

/* ====== Detail Modal — same as catalog-detail-modal ====== */
.vec-detail-modal {
  --n-border-radius: 8px;
}
.vec-detail-card {
  width: 680px;
  max-width: 92vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(4, 22, 46, 0.98) 0%, rgba(3, 16, 35, 0.99) 100%);
  border: 1px solid rgba(43, 131, 255, 0.32);
  box-shadow:
    0 0 0 1px rgba(32, 111, 202, 0.18),
    0 24px 64px rgba(1, 6, 16, 0.7),
    0 0 80px rgba(41, 163, 255, 0.06);
}

.vec-detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--vec-line);
  background: linear-gradient(180deg, rgba(8, 36, 68, 0.96) 0%, rgba(4, 22, 46, 0.96) 100%);
  position: relative;
}
.vec-detail-header::after {
  content: '';
  position: absolute;
  left: 0;
  top: 16%;
  bottom: 16%;
  width: 3px;
  border-radius: 2px;
  background: linear-gradient(180deg, transparent, var(--vec-accent), transparent);
  opacity: 0.6;
}
.vec-detail-header__left {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-width: 0;
}
.vec-detail-header__icon {
  flex-shrink: 0;
  font-size: 28px;
  color: #62c4ff;
  filter: drop-shadow(0 0 8px rgba(98, 196, 255, 0.3));
  margin-top: 2px;
}
.vec-detail-header__text {
  min-width: 0;
}
.vec-detail-header__title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.3px;
  color: var(--vec-text-primary);
  line-height: 1.4;
  text-shadow: 0 0 10px rgba(41, 163, 255, 0.12);
}
.vec-detail-header__badges {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.vec-muted-text {
  font-size: 12px;
  color: var(--vec-text-tertiary);
}

.vec-detail-close-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(45, 111, 183, 0.28);
  border-radius: 6px;
  background: rgba(6, 25, 50, 0.6);
  color: var(--vec-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 18px;
}
.vec-detail-close-btn:hover {
  color: var(--vec-accent);
  border-color: rgba(70, 176, 255, 0.4);
  background: rgba(41, 163, 255, 0.08);
}
.vec-detail-close-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.vec-detail-body {
  flex: 1;
  min-height: 0;
  padding: 20px 24px 24px;
  overflow-y: auto;
}
.vec-detail-body::-webkit-scrollbar {
  width: 6px;
}
.vec-detail-body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(48, 127, 212, 0.45);
}
.vec-detail-body::-webkit-scrollbar-track {
  background: transparent;
}

.vec-detail-section {
  margin-bottom: 20px;
}
.vec-detail-section:last-child {
  margin-bottom: 0;
}
.vec-detail-section__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vec-accent);
  letter-spacing: 0.3px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(25, 95, 176, 0.22);
}
.vec-detail-section__icon {
  font-size: 16px;
  opacity: 0.85;
}

.vec-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px 24px;
}
.vec-detail-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.vec-detail-field--full {
  grid-column: 1 / -1;
}
.vec-detail-field__label {
  font-size: 11px;
  color: var(--vec-text-tertiary);
  letter-spacing: 0.2px;
}
.vec-detail-field__value {
  font-size: 13px;
  color: var(--vec-text-primary);
  line-height: 1.5;
  word-break: break-all;
}
.vec-detail-field__value--small {
  font-size: 12px;
}
.vec-detail-field__value--mono {
  font-family: 'DIN', 'Consolas', monospace;
  font-size: 12px;
  color: rgba(234, 245, 255, 0.88);
  letter-spacing: 0.4px;
}
.vec-detail-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  color: var(--vec-text-secondary);
  padding: 12px 14px;
  border-radius: 6px;
  background: rgba(2, 14, 30, 0.6);
  border: 1px solid rgba(25, 95, 176, 0.18);
}

/* ===== Upload ===== */
.vec-upload {
  width: 100%;
}
.vec-upload :deep(.n-upload-trigger),
.vec-upload :deep(.n-upload) {
  display: block;
  width: 100%;
}
.vec-upload__zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 30px 20px;
  border-radius: 8px;
  border: 1.5px dashed rgba(70, 176, 255, 0.4);
  background: rgba(4, 22, 46, 0.5);
  cursor: pointer;
  transition: all 0.25s ease;
}
.vec-upload__zone:hover {
  border-color: rgba(70, 176, 255, 0.7);
  background: rgba(10, 40, 80, 0.5);
  box-shadow: inset 0 0 30px rgba(41, 163, 255, 0.08);
}
.vec-upload__ico {
  font-size: 38px;
  color: #62c4ff;
  filter: drop-shadow(0 0 8px rgba(98, 196, 255, 0.3));
}
.vec-upload__title {
  font-size: 13px;
  color: var(--vec-text-primary);
}
.vec-upload__hint {
  font-size: 11px;
  color: var(--vec-text-tertiary);
}
.vec-upload__file {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 6px;
  background: rgba(2, 14, 30, 0.6);
  border: 1px solid rgba(25, 95, 176, 0.22);
  margin-top: 14px;
}
.vec-upload__file-ico {
  font-size: 18px;
  color: var(--vec-accent);
}
.vec-upload__file-name {
  font-size: 12px;
  color: var(--vec-text-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vec-upload__file-size {
  font-size: 11px;
  color: var(--vec-text-tertiary);
  flex-shrink: 0;
}
.vec-import-error {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 12px;
  color: rgba(255, 141, 141, 0.9);
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(255, 107, 107, 0.15);
  border: 1px solid rgba(255, 107, 107, 0.3);
  margin-top: 14px;
}
.vec-import-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--vec-line);
}

/* Modal backdrop */
.vec-page :deep(.n-modal-mask) {
  background: rgba(2, 8, 18, 0.62);
  backdrop-filter: blur(2px);
}

/* ===== Edit form ===== */
.vec-edit-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.vec-edit-field__label {
  font-size: 13px;
  color: var(--vec-text-secondary);
  font-weight: 500;
}
.vec-edit-field__input :deep(.n-input) {
  --n-color: rgba(6, 18, 38, 0.7) !important;
  --n-border: 1px solid rgba(76, 169, 255, 0.22) !important;
  --n-border-focus: 1px solid rgba(76, 169, 255, 0.6) !important;
  --n-text-color: #eaf5ff !important;
  --n-height: 40px !important;
  --n-border-radius: 8px !important;
}

/* ===== Map Modal ===== */
.vec-map-modal {
  --n-border-radius: 8px;
}
.vec-map-card {
  width: 90vw;
  max-width: 1400px;
  height: 80vh;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(4, 22, 46, 0.98) 0%, rgba(3, 16, 35, 0.99) 100%);
  border: 1px solid rgba(43, 131, 255, 0.32);
  box-shadow:
    0 0 0 1px rgba(32, 111, 202, 0.18),
    0 24px 64px rgba(1, 6, 16, 0.7),
    0 0 80px rgba(41, 163, 255, 0.06);
}
.vec-map-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--vec-line);
  background: linear-gradient(180deg, rgba(8, 36, 68, 0.96) 0%, rgba(4, 22, 46, 0.96) 100%);
  flex-shrink: 0;
}
.vec-map-header__left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.vec-map-header__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--vec-text-primary);
}
.vec-map-header__right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.vec-map-container {
  flex: 1;
  min-height: 0;
  background: #1a1f2e;
}
.vec-map-container :deep(.ol-control) {
  background: transparent;
}
.vec-map-container :deep(.ol-zoom) {
  top: 12px;
  left: 12px;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}
.vec-map-container :deep(.ol-zoom button) {
  background: rgba(8, 22, 44, 0.92) !important;
  color: rgba(203, 227, 255, 0.85) !important;
  border: 1px solid rgba(70, 176, 255, 0.25);
  width: 32px;
  height: 32px;
  font-size: 18px;
}
.vec-map-container :deep(.ol-attribution) {
  bottom: 6px;
  right: 6px;
  background: rgba(3, 16, 35, 0.85);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 10px;
  color: rgba(160, 198, 241, 0.55);
}
.vec-map-container :deep(.ol-attribution a) {
  color: rgba(160, 198, 241, 0.55);
}
.vec-map-error {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 14px;
  color: var(--vec-text-tertiary);
  font-size: 14px;
}
</style>
