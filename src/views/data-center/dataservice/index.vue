<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue';
import {
  NButton,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NPopconfirm,
  NSelect,
  NSwitch,
  useMessage
} from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import EmptyState from '@/components/common/empty-state.vue';
import type { DataTableColumns, FormInst, FormRules, PaginationProps, SelectOption } from 'naive-ui';
import {
  fetchDataServicePage,
  fetchDataServiceCreate,
  fetchDataServiceUpdate,
  fetchDataServiceDelete,
  fetchDataServiceConnect
} from '@/service/api/dataservice';

const message = useMessage();

// ===== 分类 / 类型 / 来源 / 状态 常量 =====
const CATEGORY_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '影像地图', value: 'imagery' },
  { label: '地形', value: 'terrain' },
  { label: '三维模型', value: 'threed' },
  { label: '矢量', value: 'vector' },
  { label: '街景', value: 'streetview' },
  { label: '分析服务', value: 'analysis' }
];

const TYPE_OPTIONS: Record<string, string[]> = {
  imagery: ['xyz', 'tms', 'wms', 'wmts', 'arcgis'],
  terrain: ['cesium', 'arcgis'],
  threed: ['3dtiles', 'gltf', 'glb'],
  vector: ['geojson', 'kml', 'mvt', 'wfs'],
  streetview: ['google', 'panorama'],
  analysis: ['api']
};

const ORIGIN_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '内部服务', value: 'internal' },
  { label: '外部在线', value: 'external' }
];

const STATUS_OPTIONS: Array<{ label: string; value: number }> = [
  { label: '草稿', value: 0 },
  { label: '已发布', value: 1 },
  { label: '已下线', value: 2 }
];

function categoryLabel(category?: string) {
  return CATEGORY_OPTIONS.find(o => o.value === category)?.label || category || '-';
}

function originLabel(origin?: string) {
  return ORIGIN_OPTIONS.find(o => o.value === origin)?.label || origin || '-';
}

function statusConfig(status?: number | string) {
  const s = typeof status === 'string' ? Number(status) : status;
  if (s === 0) return { text: '草稿', type: 'default' };
  if (s === 1) return { text: '已发布', type: 'success' };
  if (s === 2) return { text: '已下线', type: 'warning' };
  return { text: '未知', type: 'default' };
}

function formatTime(v?: string) {
  if (!v) return '—';
  return v.replace('T', ' ').slice(0, 19);
}

function tryParseJson(v?: string): string {
  if (!v) return '';
  try {
    return JSON.stringify(JSON.parse(v), null, 2);
  } catch {
    return v;
  }
}

// ===== 列表 =====
const loading = ref(false);
const list = ref<Api.DataService.DataServiceItem[]>([]);
const keyword = ref('');
const categoryFilter = ref<string | null>(null);
const originFilter = ref<string | null>(null);
const statusFilter = ref<number | null>(null);
const pagination = ref<PaginationProps>({
  page: 1,
  pageSize: 10,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
  prefix: ({ itemCount }: { itemCount?: number }) => `共 ${itemCount ?? 0} 条`
});

// ===== 分组筛选 =====
const groupFilter = ref<string | null>(null);
const groupOptions = ref<Array<{ label: string; value: string }>>([]);

function collectGroups(items: Api.DataService.DataServiceItem[]) {
  items.forEach(item => {
    if (item.group && !groupOptions.value.some(o => o.value === item.group)) {
      groupOptions.value.push({ label: item.group, value: item.group });
    }
  });
}

async function loadList(reset = false) {
  if (reset) pagination.value.page = 1;
  loading.value = true;
  try {
    const params: Record<string, unknown> = {
      current: pagination.value.page,
      size: pagination.value.pageSize
    };
    if (keyword.value.trim()) params.name = keyword.value.trim();
    if (categoryFilter.value) params.category = categoryFilter.value;
    if (originFilter.value) params.origin = originFilter.value;
    if (statusFilter.value !== null && statusFilter.value !== undefined) params.status = statusFilter.value;
    if (groupFilter.value) params.group = groupFilter.value;
    const { data, error } = await fetchDataServicePage(params);
    if (!error && data) {
      const d = data as unknown as {
        records?: Api.DataService.DataServiceItem[];
        list?: Api.DataService.DataServiceItem[];
        total?: number;
      };
      list.value = d.records ?? d.list ?? [];
      pagination.value.itemCount = d.total ?? 0;
      collectGroups(list.value);
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

// ===== 动态表单 Schema（设计文档 5.3）=====
interface DynamicField {
  key: string;
  label: string;
  component: 'input' | 'number' | 'switch' | 'select' | 'textarea';
  /** top=formData 顶层字段；params/style=JSON 内结构化键 */
  target: 'top' | 'params' | 'style';
  placeholder?: string;
  options?: Array<{ label: string; value: string | number }>;
  required?: boolean;
  span?: 'half' | 'full';
  min?: number;
  max?: number;
  step?: number;
}

type JsonFieldValue = string | number | boolean | undefined;

/** category:type → 差异字段映射表（未匹配则无差异字段） */
const FORM_SCHEMA: Record<string, DynamicField[]> = {
  'imagery:xyz': [
    {
      key: 'tilingScheme',
      label: '瓦片网格',
      component: 'select',
      target: 'params',
      options: [
        { label: 'Geographic', value: 'Geographic' },
        { label: 'WebMercator', value: 'WebMercator' }
      ]
    },
    { key: 'minZoom', label: '最小层级', component: 'number', target: 'top', min: 0, max: 30 },
    { key: 'maxZoom', label: '最大层级', component: 'number', target: 'top', min: 0, max: 30 },
    {
      key: 'extent',
      label: '空间范围',
      component: 'textarea',
      target: 'top',
      span: 'full',
      placeholder: '[minLng,minLat,maxLng,maxLat]（JSON 数组，空表示不限）'
    }
  ],
  'imagery:tms': [
    {
      key: 'tilingScheme',
      label: '瓦片网格',
      component: 'select',
      target: 'params',
      options: [
        { label: 'Geographic', value: 'Geographic' },
        { label: 'WebMercator', value: 'WebMercator' }
      ]
    },
    { key: 'minZoom', label: '最小层级', component: 'number', target: 'top', min: 0, max: 30 },
    { key: 'maxZoom', label: '最大层级', component: 'number', target: 'top', min: 0, max: 30 },
    {
      key: 'extent',
      label: '空间范围',
      component: 'textarea',
      target: 'top',
      span: 'full',
      placeholder: '[minLng,minLat,maxLng,maxLat]（JSON 数组，空表示不限）'
    }
  ],
  'imagery:wms': [
    {
      key: 'layers',
      label: '图层名 (layers)',
      component: 'input',
      target: 'params',
      required: true,
      placeholder: '如：roads'
    },
    { key: 'minZoom', label: '最小层级', component: 'number', target: 'top', min: 0, max: 30 },
    { key: 'maxZoom', label: '最大层级', component: 'number', target: 'top', min: 0, max: 30 }
  ],
  'imagery:wmts': [
    {
      key: 'layer',
      label: '图层名 (layer)',
      component: 'input',
      target: 'params',
      required: true,
      placeholder: '如：base_map'
    },
    { key: 'style', label: '样式 (style)', component: 'input', target: 'params', placeholder: '默认 default' },
    { key: 'format', label: '图片格式 (format)', component: 'input', target: 'params', placeholder: 'image/png' },
    {
      key: 'tileMatrixSetID',
      label: '瓦片矩阵集 (tileMatrixSetID)',
      component: 'input',
      target: 'params',
      placeholder: 'EPSG:3857'
    },
    { key: 'minZoom', label: '最小层级', component: 'number', target: 'top', min: 0, max: 30 },
    { key: 'maxZoom', label: '最大层级', component: 'number', target: 'top', min: 0, max: 30 }
  ],
  'imagery:arcgis': [
    { key: 'maxZoom', label: '最大层级', component: 'number', target: 'top', min: 0, max: 30 },
    {
      key: 'extent',
      label: '空间范围',
      component: 'textarea',
      target: 'top',
      span: 'full',
      placeholder: '[minLng,minLat,maxLng,maxLat]（JSON 数组，空表示不限）'
    }
  ],
  'terrain:cesium': [
    { key: 'requestVertexNormals', label: '请求顶点法线', component: 'switch', target: 'params' },
    { key: 'requestWaterMask', label: '请求水面遮罩', component: 'switch', target: 'params' }
  ],
  'threed:3dtiles': [
    {
      key: 'extent',
      label: '空间范围（可选定位）',
      component: 'textarea',
      target: 'top',
      span: 'full',
      placeholder: '[minLng,minLat,maxLng,maxLat]（JSON 数组，空表示不限）'
    }
  ],
  'threed:glb': [
    {
      key: 'extent',
      label: '空间范围（可选定位）',
      component: 'textarea',
      target: 'top',
      span: 'full',
      placeholder: '[minLng,minLat,maxLng,maxLat]（JSON 数组，空表示不限）'
    }
  ],
  'vector:geojson': [
    {
      key: 'color',
      label: '填充颜色',
      component: 'input',
      target: 'style',
      placeholder: '如：#3b82f6 / rgba(59,130,246,0.6)'
    },
    { key: 'opacity', label: '透明度 (0~1)', component: 'number', target: 'style', min: 0, max: 1, step: 0.1 },
    { key: 'clampToGround', label: '贴地显示', component: 'switch', target: 'style' }
  ],
  'vector:kml': [
    {
      key: 'color',
      label: '填充颜色',
      component: 'input',
      target: 'style',
      placeholder: '如：#3b82f6 / rgba(59,130,246,0.6)'
    },
    { key: 'opacity', label: '透明度 (0~1)', component: 'number', target: 'style', min: 0, max: 1, step: 0.1 },
    { key: 'clampToGround', label: '贴地显示', component: 'switch', target: 'style' }
  ],
  'vector:mvt': [
    {
      key: 'sourceLayer',
      label: '图层名 (sourceLayer)',
      component: 'input',
      target: 'params',
      placeholder: '后端 ST_AsMVT 固定生成的 source-layer'
    },
    {
      key: 'style',
      label: '渲染样式 (StyleSpecification)',
      component: 'textarea',
      target: 'top',
      span: 'full',
      placeholder: '完整 Mapbox StyleSpecification JSON（不填则用默认色板）'
    }
  ],
  'streetview:google': [
    {
      key: 'key',
      label: 'API Key',
      component: 'input',
      target: 'params',
      required: true,
      placeholder: 'Google Street View Static API Key'
    },
    { key: 'heading', label: '水平角 (heading)', component: 'number', target: 'params', min: 0, max: 360 },
    { key: 'pitch', label: '俯仰角 (pitch)', component: 'number', target: 'params', min: -90, max: 90 }
  ],
  'analysis:api': [
    {
      key: 'params',
      label: '请求参数 (JSON)',
      component: 'textarea',
      target: 'top',
      span: 'full',
      placeholder: '分析服务调用参数，如 {"model":"xxx"}'
    }
  ]
};

// ===== 新增 / 编辑表单 =====
interface FormState {
  id?: number;
  name: string;
  category: Api.DataService.Category;
  type: string;
  origin: Api.DataService.Origin;
  url: string;
  params?: string;
  extent?: string;
  crs?: string;
  minZoom?: number;
  maxZoom?: number;
  enabled: number;
  sort: number;
  style?: string;
  description?: string;
  group?: string;
  status: number;
}

function createEmptyForm(): FormState {
  return {
    name: '',
    category: 'imagery',
    type: 'xyz',
    origin: 'external',
    url: '',
    params: '',
    extent: '',
    crs: 'EPSG:3857',
    minZoom: undefined,
    maxZoom: undefined,
    enabled: 1,
    sort: 0,
    style: '',
    description: '',
    group: '',
    status: 1
  };
}

const formVisible = ref(false);
const formLoading = ref(false);
const formRef = ref<FormInst | null>(null);
const formData = ref<FormState>(createEmptyForm());
const editingId = ref<number | null>(null);
const paramsFields = ref<Record<string, unknown>>({});
const styleFields = ref<Record<string, unknown>>({});

/** 当前 category:type 对应的差异字段 */
const currentSchema = computed<DynamicField[]>(
  () => FORM_SCHEMA[`${formData.value.category}:${formData.value.type}`] || []
);

function parseJsonObj(text?: string): Record<string, unknown> {
  if (!text) return {};
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

function toJsonObj(fields: Record<string, unknown>): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') obj[k] = v;
  });
  return obj;
}

function mergeFieldsIntoJson(existing: string | undefined, fields: Record<string, unknown>): string {
  const merged = { ...parseJsonObj(existing), ...toJsonObj(fields) };
  return Object.keys(merged).length ? JSON.stringify(merged) : '';
}

/** 读/写动态字段值（按 target 路由到 formData / params / style） */
function fieldValue(f: DynamicField, v?: JsonFieldValue): JsonFieldValue {
  if (v !== undefined) {
    if (f.target === 'params') paramsFields.value[f.key] = v;
    else if (f.target === 'style') styleFields.value[f.key] = v;
    else (formData.value as Record<string, unknown>)[f.key] = v;
    return undefined;
  }
  if (f.target === 'params') return paramsFields.value[f.key] as JsonFieldValue;
  if (f.target === 'style') return styleFields.value[f.key] as JsonFieldValue;
  return (formData.value as Record<string, unknown>)[f.key] as JsonFieldValue;
}

function strVal(f: DynamicField): string {
  const v = fieldValue(f);
  return v === undefined || v === null ? '' : String(v);
}

function numVal(f: DynamicField): number | undefined {
  const v = fieldValue(f);
  return v === undefined || v === null || v === '' ? undefined : Number(v);
}

/** 切换分类/类型时保留已填参数：结构化字段合回 JSON 后再重新解析 */
function resetJsonFields() {
  formData.value.params = mergeFieldsIntoJson(formData.value.params, paramsFields.value);
  formData.value.style = mergeFieldsIntoJson(formData.value.style, styleFields.value);
  paramsFields.value = parseJsonObj(formData.value.params);
  styleFields.value = parseJsonObj(formData.value.style);
}

function onCategoryChange(category: string) {
  formData.value.category = category as Api.DataService.Category;
  formData.value.type = (TYPE_OPTIONS[category] || [])[0] || '';
  resetJsonFields();
}

function onTypeChange() {
  resetJsonFields();
}

const typeOptions = computed<SelectOption[]>(() =>
  (TYPE_OPTIONS[formData.value.category] || []).map(t => ({ label: t, value: t }))
);

const formRules: FormRules = {
  name: { required: true, message: '请输入服务名称', trigger: ['blur', 'input'] },
  category: { required: true, message: '请选择服务分类', trigger: 'change' },
  type: { required: true, message: '请选择服务类型', trigger: 'change' },
  origin: { required: true, message: '请选择服务来源', trigger: 'change' },
  url: { required: true, message: '请输入服务地址', trigger: ['blur', 'input'] }
};

function openCreate() {
  editingId.value = null;
  formData.value = createEmptyForm();
  paramsFields.value = {};
  styleFields.value = {};
  formVisible.value = true;
}

function openEdit(row: Api.DataService.DataServiceItem) {
  editingId.value = row.id;
  formData.value = {
    id: row.id,
    name: row.name,
    category: row.category,
    type: row.type,
    origin: row.origin,
    url: row.url,
    params: row.params || '',
    extent: row.extent || '',
    crs: row.crs || '',
    minZoom: row.minZoom,
    maxZoom: row.maxZoom,
    enabled: Number(row.enabled) === 1 ? 1 : 0,
    sort: row.sort ?? 0,
    style: row.style || '',
    description: row.description || '',
    group: row.group || '',
    status: row.status ?? 1
  };
  paramsFields.value = parseJsonObj(row.params);
  styleFields.value = parseJsonObj(row.style);
  formVisible.value = true;
}

function closeForm() {
  if (formLoading.value) return;
  formVisible.value = false;
  formRef.value?.restoreValidation();
}

async function submitForm() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  // 动态差异字段 required 校验
  for (const f of currentSchema.value) {
    if (!f.required) continue;
    const v = fieldValue(f);
    if (v === undefined || v === null || v === '') {
      message.error(`请填写「${f.label}」`);
      return;
    }
  }
  // extent 必须是 4 元数组
  const ext = (formData.value.extent || '').trim();
  if (ext) {
    try {
      const arr = JSON.parse(ext);
      if (!Array.isArray(arr) || arr.length !== 4) {
        message.error('空间范围必须是 [minLng,minLat,maxLng,maxLat] 四元数组');
        return;
      }
    } catch {
      message.error('空间范围必须是合法 JSON 数组');
      return;
    }
  }
  formLoading.value = true;
  try {
    const payload = { ...formData.value } as Api.DataService.DataServiceForm;
    // params/style：结构化字段合回 JSON；extent：规范化 JSON 数组。空值置 undefined（后端落 NULL）
    payload.params = mergeFieldsIntoJson(formData.value.params, paramsFields.value) || undefined;
    payload.style = mergeFieldsIntoJson(formData.value.style, styleFields.value) || undefined;
    payload.extent = ext ? JSON.stringify(JSON.parse(ext)) : undefined;
    if (editingId.value) {
      await fetchDataServiceUpdate(editingId.value, payload);
      message.success('保存成功');
    } else {
      await fetchDataServiceCreate(payload);
      message.success('新增成功');
    }
    formVisible.value = false;
    loadList();
  } catch {
    message.error(editingId.value ? '保存失败' : '新增失败');
  } finally {
    formLoading.value = false;
  }
}

// ===== 删除 =====
async function confirmDelete(row: Api.DataService.DataServiceItem) {
  try {
    await fetchDataServiceDelete([row.id]);
    message.success('删除成功');
    if (list.value.length === 1 && (pagination.value.page ?? 1) > 1) {
      pagination.value.page = (pagination.value.page ?? 1) - 1;
    }
    loadList();
  } catch {
    message.error('删除失败');
  }
}

// ===== 测试连接 =====
const connectVisible = ref(false);
const connecting = ref(false);
const connectResult = ref<Api.DataService.DataServiceConnectResult | null>(null);
const connectTarget = ref<Api.DataService.DataServiceItem | null>(null);

async function testConnect(row: Api.DataService.DataServiceItem) {
  connectTarget.value = row;
  connectVisible.value = true;
  connectResult.value = null;
  connecting.value = true;
  try {
    const { data, error } = await fetchDataServiceConnect(row.id);
    if (!error && data) {
      connectResult.value = data;
    } else {
      connectResult.value = { reachable: false, httpStatus: 0, latencyMs: 0 };
      message.error('测试连接失败');
    }
  } catch {
    connectResult.value = { reachable: false, httpStatus: 0, latencyMs: 0 };
    message.error('测试连接失败');
  } finally {
    connecting.value = false;
  }
}

// ===== 详情 =====
const detailVisible = ref(false);
const detailData = ref<Api.DataService.DataServiceItem | null>(null);

function openDetail(row: Api.DataService.DataServiceItem) {
  detailData.value = row;
  detailVisible.value = true;
}

// ===== 列定义 =====
const columns = computed<DataTableColumns<Api.DataService.DataServiceItem>>(() => [
  {
    title: 'ID',
    key: 'id',
    align: 'center',
    width: 90,
    render(row) {
      return h('span', { class: 'row-text row-text--mono' }, row.id || '-');
    }
  },
  {
    title: '服务名称',
    key: 'name',
    align: 'center',
    render(row) {
      return h('div', { class: 'ds-name-cell' }, [
        h('span', { class: 'ds-name-cell__title' }, row.name || '未命名服务'),
        row.group ? h('span', { class: 'ds-name-cell__group' }, `#${row.group}`) : null
      ]);
    }
  },
  {
    title: '分类',
    key: 'category',
    align: 'center',
    render(row) {
      return h('span', { class: `ds-cat-chip ds-cat-chip--${row.category}` }, categoryLabel(row.category));
    }
  },
  {
    title: '类型',
    key: 'type',
    align: 'center',
    render(row) {
      return h('span', { class: 'row-text row-text--mono' }, row.type || '-');
    }
  },
  {
    title: '来源',
    key: 'origin',
    align: 'center',
    render(row) {
      return h(
        'span',
        {
          class:
            row.origin === 'external'
              ? 'ds-origin-tag ds-origin-tag--external'
              : 'ds-origin-tag ds-origin-tag--internal'
        },
        originLabel(row.origin)
      );
    }
  },
  {
    title: '服务地址',
    key: 'url',
    align: 'center',
    ellipsis: { tooltip: true },
    render(row) {
      return h('span', { class: 'row-text row-text--url' }, row.url || '-');
    }
  },
  {
    title: '默认加载',
    key: 'enabled',
    align: 'center',
    width: 100,
    render(row) {
      return h(
        'span',
        {
          class:
            Number(row.enabled) === 1 ? 'ds-status-tag ds-status-tag--success' : 'ds-status-tag ds-status-tag--default'
        },
        Number(row.enabled) === 1 ? '启用' : '关闭'
      );
    }
  },
  {
    title: '排序',
    key: 'sort',
    align: 'center',
    width: 80,
    render(row) {
      return h('span', { class: 'row-text row-text--mono' }, row.sort ?? 0);
    }
  },
  {
    title: '状态',
    key: 'status',
    align: 'center',
    width: 100,
    render(row) {
      const s = statusConfig(row.status);
      return h('span', { class: `ds-status-tag ds-status-tag--${s.type}` }, s.text);
    }
  },
  {
    title: '创建时间',
    key: 'createTime',
    align: 'center',
    width: 170,
    render(row) {
      return h('span', { class: 'row-text' }, formatTime(row.createTime));
    }
  },
  {
    title: '操作',
    key: 'actions',
    align: 'center',
    width: 190,
    render(row) {
      return h('div', { class: 'action-group' }, [
        h('div', { class: 'action-icon-btn', 'data-tooltip': '详情', onClick: () => openDetail(row) }, [
          h(SvgIcon, { icon: 'mdi:information-outline' })
        ]),
        h('div', { class: 'action-icon-btn', 'data-tooltip': '测试连接', onClick: () => testConnect(row) }, [
          h(SvgIcon, { icon: 'mdi:lan-connect' })
        ]),
        h('div', { class: 'action-icon-btn', 'data-tooltip': '编辑', onClick: () => openEdit(row) }, [
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
            default: () => '确认删除该服务？删除后不可恢复。'
          }
        )
      ]);
    }
  }
]);

onMounted(() => loadList(true));
</script>

<template>
  <div class="ds-page">
    <!-- 检索工具栏 -->
    <div class="ds-toolbar">
      <div class="ds-toolbar__left">
        <NInput
          v-model:value="keyword"
          class="ds-search-input"
          placeholder="搜索服务名称"
          clearable
          @keyup.enter="loadList(true)"
          @clear="loadList(true)"
        >
          <template #prefix>
            <SvgIcon icon="mdi:magnify" class="ds-search-input__icon" />
          </template>
        </NInput>
        <NSelect
          v-model:value="categoryFilter"
          class="ds-filter-select"
          :options="CATEGORY_OPTIONS"
          placeholder="全部分类"
          clearable
          :menu-props="{ class: 'ds-select-menu' }"
          @update:value="loadList(true)"
        />
        <NSelect
          v-model:value="originFilter"
          class="ds-filter-select"
          :options="[{ label: '全部来源', value: '' }, ...ORIGIN_OPTIONS]"
          placeholder="全部来源"
          :menu-props="{ class: 'ds-select-menu' }"
          @update:value="loadList(true)"
        />
        <NSelect
          v-model:value="statusFilter"
          class="ds-filter-select"
          :options="STATUS_OPTIONS"
          placeholder="全部状态"
          clearable
          :menu-props="{ class: 'ds-select-menu' }"
          @update:value="loadList(true)"
        />
        <NSelect
          v-model:value="groupFilter"
          class="ds-filter-select"
          :options="groupOptions"
          placeholder="全部分组"
          clearable
          :menu-props="{ class: 'ds-select-menu' }"
          @update:value="loadList(true)"
        />
      </div>
      <div class="ds-toolbar__right">
        <NButton class="ds-ghost-btn" :disabled="loading" @click="loadList(true)">
          <template #icon><SvgIcon icon="mdi:refresh" /></template>
          刷新
        </NButton>
        <NButton class="ds-primary-btn" @click="openCreate">
          <template #icon><SvgIcon icon="mdi:plus" /></template>
          新增服务
        </NButton>
      </div>
    </div>

    <!-- 表格卡片 -->
    <main class="ds-card">
      <div class="ds-card-head">
        <div class="ds-card-head__title">数据服务清单</div>
        <div class="ds-card-head__meta">{{ list.length }} 项</div>
      </div>
      <div class="ds-table-wrap">
        <NDataTable
          :columns="columns"
          :data="list"
          :loading="loading"
          :bordered="false"
          :single-line="false"
          :row-key="row => row.id"
          :pagination="pagination"
          remote
          class="ds-data-table"
          @update:page="onPageChange"
          @update:page-size="onPageSizeChange"
        />
        <EmptyState
          v-if="!loading && list.length === 0"
          absolute
          icon="mdi:server-network"
          title="暂无数据服务，点击右上角「新增服务」注册影像/地形等图源"
        />
      </div>
    </main>

    <!-- 新增/编辑弹窗 -->
    <NModal
      v-model:show="formVisible"
      :mask-closable="false"
      :close-on-esc="true"
      class="ds-detail-modal"
      @update:show="
        v => {
          if (!v) closeForm();
        }
      "
    >
      <div class="ds-detail-card ds-form-card">
        <div class="ds-detail-header">
          <div class="ds-detail-header__left">
            <span class="ds-detail-header__icon">
              <SvgIcon :icon="editingId ? 'mdi:pencil-outline' : 'mdi:plus'" />
            </span>
            <h2 class="ds-detail-header__title">{{ editingId ? '编辑数据服务' : '新增数据服务' }}</h2>
          </div>
          <button class="ds-detail-close-btn" :disabled="formLoading" @click="formVisible = false">
            <SvgIcon icon="mdi:close" />
          </button>
        </div>
        <div class="ds-detail-body">
          <NForm ref="formRef" :model="formData" :rules="formRules" label-placement="top" class="ds-form">
            <div class="ds-form-grid">
              <NFormItem label="服务名称" path="name" class="ds-form-item ds-form-item--wide">
                <NInput v-model:value="formData.name" placeholder="如：全国影像底图" />
              </NFormItem>
              <NFormItem label="服务分类" path="category">
                <NSelect
                  v-model:value="formData.category"
                  :options="CATEGORY_OPTIONS"
                  @update:value="v => onCategoryChange(String(v ?? ''))"
                />
              </NFormItem>
              <NFormItem label="服务类型" path="type">
                <NSelect v-model:value="formData.type" :options="typeOptions" @update:value="onTypeChange" />
              </NFormItem>
              <NFormItem label="来源" path="origin">
                <NSelect v-model:value="formData.origin" :options="ORIGIN_OPTIONS" />
              </NFormItem>
              <NFormItem label="服务地址" path="url" class="ds-form-item--wide">
                <NInput
                  v-model:value="formData.url"
                  placeholder="http(s)://...（internal 可为相对路径，如 /system/vector/tile/1）"
                />
              </NFormItem>
              <NFormItem label="坐标系">
                <NInput v-model:value="formData.crs" placeholder="EPSG:3857" />
              </NFormItem>
              <!-- 差异字段：按 category:type 由 FORM_SCHEMA 驱动渲染 -->
              <template v-for="f in currentSchema" :key="`${f.target}:${f.key}`">
                <NFormItem :label="f.label" :class="f.span === 'full' ? 'ds-form-item--wide' : ''" class="ds-form-item">
                  <NInput
                    v-if="f.component === 'input'"
                    :value="strVal(f)"
                    :placeholder="f.placeholder"
                    @update:value="v => fieldValue(f, v)"
                  />
                  <NInputNumber
                    v-else-if="f.component === 'number'"
                    :value="numVal(f)"
                    :min="f.min"
                    :max="f.max"
                    :step="f.step"
                    class="ds-num-input"
                    @update:value="v => fieldValue(f, v ?? undefined)"
                  />
                  <NSwitch
                    v-else-if="f.component === 'switch'"
                    :value="Boolean(fieldValue(f))"
                    @update:value="v => fieldValue(f, v)"
                  />
                  <NSelect
                    v-else-if="f.component === 'select'"
                    :value="strVal(f)"
                    :options="f.options"
                    :placeholder="f.placeholder"
                    @update:value="v => fieldValue(f, v ?? undefined)"
                  />
                  <NInput
                    v-else
                    :value="strVal(f)"
                    type="textarea"
                    :autosize="{ minRows: 2, maxRows: 4 }"
                    :placeholder="f.placeholder"
                    @update:value="v => fieldValue(f, v)"
                  />
                </NFormItem>
              </template>
              <NFormItem label="排序号">
                <NInputNumber v-model:value="formData.sort" :min="0" class="ds-num-input" />
              </NFormItem>
              <NFormItem label="默认加载">
                <NSwitch v-model:value="formData.enabled" :checked-value="1" :unchecked-value="0">
                  <template #checked>启用</template>
                  <template #unchecked>关闭</template>
                </NSwitch>
              </NFormItem>
              <NFormItem label="状态">
                <NSelect v-model:value="formData.status" :options="STATUS_OPTIONS" class="ds-num-input" />
              </NFormItem>
              <NFormItem label="分组" class="ds-form-item--wide">
                <NInput v-model:value="formData.group" placeholder="项目/场景维度分组（可选）" />
              </NFormItem>
              <NFormItem label="服务描述" class="ds-form-item--wide">
                <NInput
                  v-model:value="formData.description"
                  type="textarea"
                  :autosize="{ minRows: 2, maxRows: 4 }"
                  placeholder="服务用途说明（可选）"
                />
              </NFormItem>
            </div>
          </NForm>
          <div class="ds-import-footer">
            <NButton class="ds-ghost-btn" :disabled="formLoading" @click="formVisible = false">取消</NButton>
            <NButton class="ds-primary-btn" :loading="formLoading" @click="submitForm">
              {{ editingId ? '保存' : '新增' }}
            </NButton>
          </div>
        </div>
      </div>
    </NModal>

    <!-- 详情弹窗 -->
    <NModal v-model:show="detailVisible" :mask-closable="true" :close-on-esc="true" class="ds-detail-modal">
      <div v-if="detailData" class="ds-detail-card">
        <div class="ds-detail-header">
          <div class="ds-detail-header__left">
            <span class="ds-detail-header__icon">
              <SvgIcon icon="mdi:server-network" />
            </span>
            <div class="ds-detail-header__text">
              <h2 class="ds-detail-header__title">{{ detailData.name }}</h2>
              <div class="ds-detail-header__badges">
                <span class="ds-cat-chip" :class="`ds-cat-chip--${detailData.category}`">
                  {{ categoryLabel(detailData.category) }}
                </span>
                <span class="ds-status-tag" :class="`ds-status-tag--${statusConfig(detailData.status).type}`">
                  {{ statusConfig(detailData.status).text }}
                </span>
                <span v-if="detailData.type" class="row-text row-text--mono" style="font-size: 12px">
                  {{ detailData.type }}
                </span>
              </div>
            </div>
          </div>
          <button class="ds-detail-close-btn" @click="detailVisible = false">
            <SvgIcon icon="mdi:close" />
          </button>
        </div>
        <div class="ds-detail-body">
          <section class="ds-detail-section">
            <div class="ds-detail-section__title">
              <SvgIcon icon="mdi:information-outline" class="ds-detail-section__icon" />
              基础信息
            </div>
            <div class="ds-detail-grid">
              <div class="ds-detail-field">
                <div class="ds-detail-field__label">服务地址</div>
                <div class="ds-detail-field__value ds-detail-field__value--mono">{{ detailData.url }}</div>
              </div>
              <div class="ds-detail-field">
                <div class="ds-detail-field__label">来源</div>
                <div class="ds-detail-field__value">{{ originLabel(detailData.origin) }}</div>
              </div>
              <div class="ds-detail-field">
                <div class="ds-detail-field__label">坐标系</div>
                <div class="ds-detail-field__value">{{ detailData.crs || '—' }}</div>
              </div>
              <div class="ds-detail-field">
                <div class="ds-detail-field__label">层级范围</div>
                <div class="ds-detail-field__value">
                  {{ detailData.minZoom ?? '—' }} ~ {{ detailData.maxZoom ?? '—' }}
                </div>
              </div>
              <div class="ds-detail-field">
                <div class="ds-detail-field__label">默认加载</div>
                <div class="ds-detail-field__value">
                  {{ Number(detailData.enabled) === 1 ? '启用' : '关闭' }}
                </div>
              </div>
              <div class="ds-detail-field">
                <div class="ds-detail-field__label">排序号</div>
                <div class="ds-detail-field__value">{{ detailData.sort ?? 0 }}</div>
              </div>
              <div class="ds-detail-field">
                <div class="ds-detail-field__label">分组</div>
                <div class="ds-detail-field__value">{{ detailData.group || '—' }}</div>
              </div>
              <div class="ds-detail-field">
                <div class="ds-detail-field__label">创建时间</div>
                <div class="ds-detail-field__value ds-detail-field__value--small">
                  {{ formatTime(detailData.createTime) }}
                </div>
              </div>
              <div class="ds-detail-field ds-detail-field--full">
                <div class="ds-detail-field__label">空间范围</div>
                <div class="ds-detail-field__value ds-detail-field__value--mono">
                  {{ detailData.extent || '不限' }}
                </div>
              </div>
            </div>
          </section>

          <section v-if="detailData.description" class="ds-detail-section">
            <div class="ds-detail-section__title">
              <SvgIcon icon="mdi:text-box-outline" class="ds-detail-section__icon" />
              服务描述
            </div>
            <p class="ds-detail-desc">{{ detailData.description }}</p>
          </section>

          <section v-if="detailData.params" class="ds-detail-section">
            <div class="ds-detail-section__title">
              <SvgIcon icon="mdi:code-json" class="ds-detail-section__icon" />
              连接参数
            </div>
            <pre class="ds-detail-code">{{ tryParseJson(detailData.params) }}</pre>
          </section>

          <section v-if="detailData.style" class="ds-detail-section">
            <div class="ds-detail-section__title">
              <SvgIcon icon="mdi:palette-outline" class="ds-detail-section__icon" />
              渲染样式
            </div>
            <pre class="ds-detail-code">{{ tryParseJson(detailData.style) }}</pre>
          </section>
        </div>
      </div>
    </NModal>

    <!-- 连接测试弹窗 -->
    <NModal v-model:show="connectVisible" :mask-closable="true" :close-on-esc="true" class="ds-detail-modal">
      <div class="ds-detail-card ds-connect-card">
        <div class="ds-detail-header">
          <div class="ds-detail-header__left">
            <span class="ds-detail-header__icon">
              <SvgIcon icon="mdi:lan-connect" />
            </span>
            <div class="ds-detail-header__text">
              <h2 class="ds-detail-header__title">测试连接</h2>
              <div class="ds-detail-header__badges">
                <span class="row-text" style="font-size: 12px">{{ connectTarget?.name }}</span>
              </div>
            </div>
          </div>
          <button class="ds-detail-close-btn" @click="connectVisible = false">
            <SvgIcon icon="mdi:close" />
          </button>
        </div>
        <div class="ds-detail-body">
          <div v-if="connecting" class="ds-connect-loading">
            <SvgIcon icon="mdi:loading" class="ds-connect-loading__ico" />
            <p>正在探测服务地址…</p>
            <p class="ds-muted-text">{{ connectTarget?.url }}</p>
          </div>
          <div v-else-if="connectResult" class="ds-connect-result">
            <div
              class="ds-connect-hero"
              :class="connectResult.reachable ? 'ds-connect-hero--ok' : 'ds-connect-hero--fail'"
            >
              <SvgIcon
                :icon="connectResult.reachable ? 'mdi:check-circle' : 'mdi:close-circle'"
                class="ds-connect-hero__ico"
              />
              <span class="ds-connect-hero__text">
                {{ connectResult.reachable ? '服务可达' : '服务不可达' }}
              </span>
            </div>
            <div class="ds-connect-grid">
              <div class="ds-detail-field">
                <div class="ds-detail-field__label">HTTP 状态码</div>
                <div class="ds-detail-field__value row-text--mono">
                  {{ connectResult.httpStatus || '—' }}
                </div>
              </div>
              <div class="ds-detail-field">
                <div class="ds-detail-field__label">响应耗时</div>
                <div class="ds-detail-field__value row-text--mono">{{ connectResult.latencyMs }} ms</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
.ds-page {
  --ds-page-bg:
    radial-gradient(circle at top, rgba(0, 153, 255, 0.14) 0%, rgba(0, 0, 0, 0) 36%),
    linear-gradient(180deg, #041528 0%, #041120 38%, #03101b 100%);
  --ds-surface-bg: linear-gradient(180deg, rgba(3, 19, 41, 0.94) 0%, rgba(2, 15, 32, 0.96) 100%);
  --ds-surface-border: rgba(43, 131, 255, 0.28);
  --ds-line: rgba(25, 95, 176, 0.35);
  --ds-text-primary: #eaf5ff;
  --ds-text-secondary: rgba(203, 227, 255, 0.72);
  --ds-text-tertiary: rgba(147, 196, 255, 0.62);
  --ds-accent: #29a3ff;
  --ds-danger: #ff6b6b;
  height: 100%;
  background: var(--ds-page-bg);
  color: var(--ds-text-primary);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  box-sizing: border-box;
  overflow: hidden;
}

.ds-card {
  background: var(--ds-surface-bg);
  border: 1px solid var(--ds-surface-border);
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
.ds-card::before,
.ds-card::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  pointer-events: none;
  z-index: 2;
  opacity: 0.35;
}
.ds-card::before {
  top: -1px;
  left: -1px;
  border-top: 2px solid var(--ds-accent);
  border-left: 2px solid var(--ds-accent);
  border-radius: 4px 0 0 0;
}
.ds-card::after {
  bottom: -1px;
  right: -1px;
  border-bottom: 2px solid var(--ds-accent);
  border-right: 2px solid var(--ds-accent);
  border-radius: 0 0 4px 0;
}

.ds-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.ds-toolbar__left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1 1 auto;
  flex-wrap: nowrap;
}
.ds-toolbar__right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.ds-primary-btn {
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
.ds-primary-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  transition: left 0.6s ease;
}
.ds-primary-btn:hover {
  box-shadow:
    inset 0 1px 0 rgba(181, 233, 255, 0.22),
    0 6px 24px rgba(4, 79, 162, 0.35);
  transform: translateY(-2px);
}
.ds-primary-btn:hover::before {
  left: 100%;
}
.ds-primary-btn:active {
  transform: translateY(0);
  box-shadow:
    inset 0 2px 4px rgba(0, 0, 0, 0.2),
    0 2px 8px rgba(4, 79, 162, 0.2);
  transition: all 0.1s ease;
}

.ds-ghost-btn {
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
.ds-ghost-btn:hover {
  box-shadow:
    inset 0 1px 0 rgba(129, 211, 255, 0.08),
    0 4px 12px rgba(0, 0, 0, 0.25);
  transform: translateY(-2px);
  border-color: rgba(58, 160, 255, 0.5) !important;
}

.ds-search-input {
  max-width: 320px;
  min-width: 180px;
  flex: 1 1 180px;
}
.ds-search-input :deep(.n-input) {
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
.ds-search-input :deep(.n-input__border),
.ds-search-input :deep(.n-input__state-border) {
  display: none;
}
.ds-search-input__icon {
  font-size: 18px;
  color: #7cc4f0;
  opacity: 0.7;
}

.ds-filter-select {
  width: 150px;
  flex-shrink: 0;
}
/* naive-ui 的 select 视觉全部由 CSS 变量驱动：
   背景画在 .n-base-selection-label 上（--n-color），
   边框画在 __border / __state-border 子元素上（--n-border）。
   直接给 .n-base-selection 设 background / border 无效，
   必须覆盖变量；变量由 naive-ui 内联注入，需 !important 才能压制。 */
.ds-filter-select :deep(.n-base-selection) {
  --n-color: rgba(2, 16, 31, 0.98) !important;
  --n-color-active: rgba(2, 16, 31, 0.98) !important;
  --n-color-focus: rgba(2, 16, 31, 0.98) !important;
  --n-border: 1px solid rgba(43, 118, 197, 0.38) !important;
  --n-border-hover: 1px solid rgba(58, 160, 255, 0.5) !important;
  --n-border-active: 1px solid rgba(58, 160, 255, 0.65) !important;
  --n-border-focus: 1px solid rgba(58, 160, 255, 0.65) !important;
  --n-box-shadow-active: 0 0 0 2px rgba(41, 163, 255, 0.12) !important;
  --n-box-shadow-focus: 0 0 0 2px rgba(41, 163, 255, 0.12) !important;
  --n-text-color: #eaf5ff !important;
  --n-placeholder-color: rgba(132, 177, 233, 0.45) !important;
  --n-arrow-color: #7cc4f0 !important;
  --n-height: 38px !important;
  --n-border-radius: 8px !important;
  --n-padding-single: 0 26px 0 12px !important;
  border-radius: 8px;
}
.ds-filter-select :deep(.n-base-selection-label),
.ds-filter-select :deep(.n-base-selection-tags) {
  background: linear-gradient(180deg, rgba(2, 16, 31, 0.98) 0%, rgba(1, 12, 24, 0.98) 100%);
}
.ds-filter-select :deep(.n-base-selection-placeholder),
.ds-filter-select :deep(.n-base-selection-input__content) {
  color: rgba(132, 177, 233, 0.45);
}
.ds-filter-select :deep(.n-base-selection-arrow) {
  color: #7cc4f0;
  opacity: 0.7;
}

.ds-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--ds-line);
  background: linear-gradient(180deg, rgba(7, 27, 51, 0.94) 0%, rgba(4, 20, 40, 0.96) 100%);
  position: relative;
}
.ds-card-head::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  bottom: 20%;
  width: 2px;
  border-radius: 1px;
  background: linear-gradient(180deg, transparent, var(--ds-accent), transparent);
  opacity: 0.5;
}
.ds-card-head__title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-shadow: 0 0 8px rgba(41, 163, 255, 0.1);
}
.ds-card-head__meta {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  color: var(--ds-text-tertiary);
  font-size: 12px;
}
.ds-table-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
}

.ds-data-table {
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
.ds-data-table :deep(.n-data-table-th) {
  background: linear-gradient(180deg, rgba(6, 29, 56, 0.94) 0%, rgba(4, 22, 43, 0.94) 100%) !important;
  font-size: 13px;
  padding: 14px 12px;
}
.ds-data-table :deep(.n-data-table-td) {
  padding: 14px 12px;
  border-bottom: 1px solid rgba(18, 73, 135, 0.32) !important;
}
.ds-data-table :deep(.n-data-table-tr:hover .n-data-table-td) {
  background: rgba(33, 116, 212, 0.14) !important;
}
.ds-data-table :deep(.n-data-table-table) {
  border-collapse: separate;
  border-spacing: 0;
}

.ds-name-cell {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  max-width: 100%;
}
.ds-name-cell__title {
  color: var(--ds-text-primary);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ds-name-cell__group {
  flex-shrink: 0;
  color: var(--ds-text-tertiary);
  font-size: 11px;
  white-space: nowrap;
}

.row-text {
  color: var(--ds-text-secondary);
  font-size: 13px;
}
.row-text--muted {
  color: rgba(160, 198, 241, 0.74);
}
.row-text--mono {
  font-family: 'DIN', 'Consolas', monospace;
}
.row-text--url {
  font-size: 12px;
  font-family: 'DIN', 'Consolas', monospace;
}

.ds-cat-chip {
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
}
.ds-cat-chip--imagery {
  background: rgba(34, 197, 94, 0.15);
  border-color: rgba(34, 197, 94, 0.3);
  color: rgba(74, 222, 128, 0.9);
}
.ds-cat-chip--terrain {
  background: rgba(168, 85, 247, 0.15);
  border-color: rgba(168, 85, 247, 0.3);
  color: rgba(216, 180, 254, 0.9);
}
.ds-cat-chip--threed {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.3);
  color: rgba(147, 197, 253, 0.9);
}
.ds-cat-chip--vector {
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.3);
  color: rgba(251, 191, 36, 0.9);
}
.ds-cat-chip--streetview {
  background: rgba(236, 72, 153, 0.15);
  border-color: rgba(236, 72, 153, 0.3);
  color: rgba(249, 168, 212, 0.9);
}
.ds-cat-chip--analysis {
  background: rgba(14, 165, 233, 0.15);
  border-color: rgba(14, 165, 233, 0.3);
  color: rgba(103, 232, 249, 0.9);
}

.ds-origin-tag,
.ds-status-tag {
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
.ds-origin-tag--internal {
  background: rgba(148, 163, 184, 0.12);
  border: 1px solid rgba(148, 163, 184, 0.2);
  color: rgba(203, 213, 225, 0.7);
}
.ds-origin-tag--external {
  background: rgba(41, 163, 255, 0.12);
  border: 1px solid rgba(41, 163, 255, 0.3);
  color: rgba(125, 211, 252, 0.9);
}
.ds-status-tag--success {
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: rgba(74, 222, 128, 0.9);
}
.ds-status-tag--warning {
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: rgba(251, 191, 36, 0.9);
}
.ds-status-tag--danger {
  background: rgba(255, 107, 107, 0.15);
  border: 1px solid rgba(255, 107, 107, 0.3);
  color: rgba(255, 141, 141, 0.9);
}
.ds-status-tag--default {
  background: rgba(148, 163, 184, 0.12);
  border: 1px solid rgba(148, 163, 184, 0.2);
  color: rgba(203, 213, 225, 0.7);
}

.ds-data-table :deep(.action-group) {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
}
.ds-data-table :deep(.action-icon-btn) {
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
.ds-data-table :deep(.action-icon-btn:hover) {
  color: #fff;
  background: rgba(41, 163, 255, 0.18);
  border-color: rgba(41, 163, 255, 0.35);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(41, 163, 255, 0.2);
}
.ds-data-table :deep(.action-icon-btn::after) {
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
.ds-data-table :deep(.action-icon-btn:hover::after) {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
.ds-data-table :deep(.action-icon-btn--danger) {
  background: rgba(255, 107, 107, 0.05);
  border-color: rgba(255, 107, 107, 0.12);
  color: rgba(255, 141, 141, 0.7);
}
.ds-data-table :deep(.action-icon-btn--danger:hover) {
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.15);
  border-color: rgba(255, 107, 107, 0.35);
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.18);
}

.ds-data-table :deep(.n-data-table__pagination) {
  border-top: 1px solid var(--ds-line);
  background: linear-gradient(180deg, rgba(4, 21, 41, 0.98) 0%, rgba(4, 18, 34, 0.98) 100%);
  min-height: 52px;
  padding: 8px 14px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.ds-data-table :deep(.n-pagination) {
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
  font-size: 13px;
}
.ds-data-table :deep(.n-pagination .n-pagination-item) {
  min-width: 30px;
  height: 30px;
  border-radius: 5px;
  font-size: 13px;
  transition: all 0.2s ease;
}

.ds-detail-modal {
  --n-border-radius: 8px;
}
.ds-detail-card {
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
.ds-form-card {
  width: 760px;
}

.ds-detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--ds-line);
  background: linear-gradient(180deg, rgba(8, 36, 68, 0.96) 0%, rgba(4, 22, 46, 0.96) 100%);
  position: relative;
}
.ds-detail-header::after {
  content: '';
  position: absolute;
  left: 0;
  top: 16%;
  bottom: 16%;
  width: 3px;
  border-radius: 2px;
  background: linear-gradient(180deg, transparent, var(--ds-accent), transparent);
  opacity: 0.6;
}
.ds-detail-header__left {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-width: 0;
}
.ds-detail-header__icon {
  flex-shrink: 0;
  font-size: 28px;
  color: #62c4ff;
  filter: drop-shadow(0 0 8px rgba(98, 196, 255, 0.3));
  margin-top: 2px;
}
.ds-detail-header__text {
  min-width: 0;
}
.ds-detail-header__title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.3px;
  color: var(--ds-text-primary);
  line-height: 1.4;
  text-shadow: 0 0 10px rgba(41, 163, 255, 0.12);
}
.ds-detail-header__badges {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.ds-detail-close-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(45, 111, 183, 0.28);
  border-radius: 6px;
  background: rgba(6, 25, 50, 0.6);
  color: var(--ds-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 18px;
}
.ds-detail-close-btn:hover {
  color: var(--ds-accent);
  border-color: rgba(70, 176, 255, 0.4);
  background: rgba(41, 163, 255, 0.08);
}
.ds-detail-close-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ds-detail-body {
  flex: 1;
  min-height: 0;
  padding: 20px 24px 24px;
  overflow-y: auto;
}
.ds-detail-body::-webkit-scrollbar {
  width: 6px;
}
.ds-detail-body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(48, 127, 212, 0.45);
}
.ds-detail-body::-webkit-scrollbar-track {
  background: transparent;
}

.ds-detail-section {
  margin-bottom: 20px;
}
.ds-detail-section:last-child {
  margin-bottom: 0;
}
.ds-detail-section__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ds-accent);
  letter-spacing: 0.3px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(25, 95, 176, 0.22);
}
.ds-detail-section__icon {
  font-size: 16px;
  opacity: 0.85;
}
.ds-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px 24px;
}
.ds-detail-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.ds-detail-field--full {
  grid-column: 1 / -1;
}
.ds-detail-field__label {
  font-size: 11px;
  color: var(--ds-text-tertiary);
  letter-spacing: 0.2px;
}
.ds-detail-field__value {
  font-size: 13px;
  color: var(--ds-text-primary);
  line-height: 1.5;
  word-break: break-all;
}
.ds-detail-field__value--small {
  font-size: 12px;
}
.ds-detail-field__value--mono {
  font-family: 'DIN', 'Consolas', monospace;
  font-size: 12px;
  color: rgba(234, 245, 255, 0.88);
  letter-spacing: 0.4px;
}
.ds-detail-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  color: var(--ds-text-secondary);
  padding: 12px 14px;
  border-radius: 6px;
  background: rgba(2, 14, 30, 0.6);
  border: 1px solid rgba(25, 95, 176, 0.18);
}
.ds-detail-code {
  margin: 0;
  padding: 12px 14px;
  border-radius: 6px;
  background: rgba(2, 14, 30, 0.6);
  border: 1px solid rgba(25, 95, 176, 0.18);
  font-family: 'DIN', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(203, 227, 255, 0.8);
  white-space: pre-wrap;
  word-break: break-all;
}

.ds-form {
  --n-label-text-color: var(--ds-text-secondary);
}
.ds-form :deep(.n-form-item-label) {
  color: var(--ds-text-secondary);
  font-size: 13px;
}
.ds-form :deep(.n-input) {
  --n-color: rgba(6, 18, 38, 0.7) !important;
  --n-border: 1px solid rgba(76, 169, 255, 0.22) !important;
  --n-border-hover: 1px solid rgba(76, 169, 255, 0.45) !important;
  --n-border-focus: 1px solid rgba(76, 169, 255, 0.65) !important;
  --n-text-color: #eaf5ff !important;
  --n-placeholder-color: rgba(132, 177, 233, 0.4) !important;
  --n-caret-color: #5ea4ff !important;
  --n-font-size: 13px !important;
  --n-height: 38px !important;
  --n-border-radius: 8px !important;
}
.ds-form :deep(.n-base-selection) {
  --n-border: 1px solid rgba(76, 169, 255, 0.22) !important;
  --n-border-hover: 1px solid rgba(76, 169, 255, 0.45) !important;
  --n-border-focus: 1px solid rgba(76, 169, 255, 0.65) !important;
  --n-color: rgba(6, 18, 38, 0.7) !important;
  --n-color-active: rgba(6, 18, 38, 0.7) !important;
  --n-border-radius: 8px !important;
  height: 38px;
}
.ds-form :deep(.n-base-selection-label) {
  color: #eaf5ff;
}
.ds-form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0 20px;
}
.ds-form-item--wide {
  grid-column: 1 / -1;
}
.ds-num-input {
  width: 100%;
}
.ds-import-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--ds-line);
}

.ds-connect-card {
  width: 460px;
}
.ds-connect-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 30px 0;
  color: var(--ds-text-secondary);
  font-size: 13px;
}
.ds-connect-loading__ico {
  font-size: 36px;
  color: #62c4ff;
  animation: ds-spin 1s linear infinite;
}
.ds-connect-loading p {
  margin: 0;
}
.ds-muted-text {
  font-size: 12px;
  color: var(--ds-text-tertiary);
  word-break: break-all;
  text-align: center;
}
.ds-connect-hero {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 8px;
  margin-bottom: 18px;
  font-size: 14px;
  font-weight: 600;
}
.ds-connect-hero__ico {
  font-size: 26px;
}
.ds-connect-hero--ok {
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.35);
  color: rgba(74, 222, 128, 0.95);
}
.ds-connect-hero--fail {
  background: rgba(255, 107, 107, 0.12);
  border: 1px solid rgba(255, 107, 107, 0.35);
  color: rgba(255, 141, 141, 0.95);
}
.ds-connect-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px 24px;
}

@keyframes ds-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>

<!--
  下拉菜单面板被 teleport 到 body，scoped 选择器无法命中，需单独的非 scoped 块。
  class 通过 NSelect 的 menu-props 注入，故只影响本页工具栏的 4 个筛选下拉。
-->
<style lang="scss">
.ds-select-menu {
  --n-color: rgba(3, 18, 38, 0.98) !important;
  --n-border-radius: 8px !important;
  --n-menu-box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5) !important;
  --n-option-font-size-medium: 13px !important;
  --n-option-text-color: rgba(203, 227, 255, 0.82) !important;
  --n-option-text-color-active: #7cc4f0 !important;
  --n-option-text-color-pressed: #7cc4f0 !important;
  --n-option-color-pending: rgba(14, 42, 88, 0.92) !important;
  --n-option-color-active: rgba(23, 115, 230, 0.22) !important;
  --n-option-color-active-pending: rgba(23, 115, 230, 0.3) !important;
  --n-option-check-color: #62c4ff !important;
  --n-group-header-text-color: rgba(132, 177, 233, 0.55) !important;
  --n-action-divider-color: rgba(43, 118, 197, 0.25) !important;
  border: 1px solid rgba(43, 118, 197, 0.32);
  overflow: hidden;
}
</style>
