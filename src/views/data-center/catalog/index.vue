<script setup lang="ts">
import { computed, h, onMounted, ref, watch } from 'vue';
import type { SelectOption } from 'naive-ui';
import { NButton, NDataTable, NInput, NModal, NPagination, NSelect, NTree, type DataTableColumns } from 'naive-ui';
import { useThemeStore } from '@/store/modules/theme';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { agentLabelMap, type CatalogItem } from '@/mock/catalog';
import {
  fetchCatalogPage,
  fetchCategoryTree,
  publishCatalog,
  deleteCatalog,
  fetchCatalogDownloadUrl
} from '@/service/api/catalog';
import CatalogCategoryManage from './modules/catalog-category-manage.vue';
import CatalogUploadModal from './modules/catalog-upload-modal.vue';
import CatalogAnalysis from './modules/catalog-analysis.vue';

defineOptions({
  name: 'CatalogPage'
});

const activeTab = ref('总览');
const selectedCategory = ref<string | null>(null);
const searchKeyword = ref('');
const selectedType = ref<string>('');
const isLoading = ref(false);
const expandedKeys = ref<string[]>([]);
const dataList = ref<CatalogItem[]>([]);
const categoryTree = ref<Api.Catalog.CategoryNode[]>([]);
const themeStore = useThemeStore();
const darkMode = computed(() => themeStore.darkMode);
const currentPage = ref(1);
const pageSize = ref(10);
const detailVisible = ref(false);
const detailItem = ref<CatalogItem | null>(null);
/** 分析弹窗（独立组件 CatalogAnalysis）：item 非空即打开 */
const analysisItem = ref<CatalogItem | null>(null);

// ====== 上传弹窗（独立组件 CatalogUploadModal）======
const uploadVisible = ref(false);
const categoryManageVisible = ref(false);

/** 分类管理变更后刷新分类树与列表 */
function handleCategoryChanged() {
  loadCategoryTree().then(() => loadData());
}

/** 左侧分类树选项（基于后端真实 data_category 树，含每类计数；key 为雪花 ID 字符串） */
const treeOptions = computed(() =>
  categoryTree.value.map(cat => ({
    label: `${cat.name} (${cat.count || 0})`,
    key: String(cat.id),
    children: cat.children?.map(child => ({
      label: `${child.name} (${child.count || 0})`,
      key: String(child.id)
    }))
  }))
);

/** 顶部"数据类型"下拉（取分类树一级节点，即大类） */
const typeOptions = computed<SelectOption[]>(() => [
  { label: '全部', value: '' },
  ...categoryTree.value.map(cat => ({ label: cat.name, value: String(cat.id) }))
]);

const selectedAgent = ref('');
const selectedScenario = ref('');

const agentOptions = computed<SelectOption[]>(() => [
  { label: '全部智能体', value: '' },
  ...Object.entries(agentLabelMap).map(([k, v]) => ({ label: v, value: k }))
]);

const scenarioOptions = computed<SelectOption[]>(() => [
  { label: '全部场景', value: '' },
  { label: '渡河保障', value: '渡河保障' },
  { label: '机动路线规划', value: '机动路线规划' },
  { label: '城市攻防', value: '城市攻防' },
  { label: '交通研判', value: '交通研判' },
  { label: '地形分析', value: '地形分析' },
  { label: '目标识别', value: '目标识别' },
  { label: '态势感知', value: '态势感知' },
  { label: '预案生成', value: '预案生成' }
]);

/**
 * 总览统计：基于一次全量加载（statDataList，仅用于顶部指标统计）。
 * 列表本身走后端分页（dataList 只含当前页）。
 */
const statDataList = ref<CatalogItem[]>([]);
const total = ref(0);

const summaryMetrics = computed(() => {
  const published = statDataList.value.filter(item => item.status === 'published').length;
  const draft = statDataList.value.filter(item => item.status === 'draft').length;
  const totalSize = statDataList.value.reduce((sum, item) => sum + normalizeSize(item.size), 0);
  return {
    published,
    draft,
    totalSize: `${totalSize.toFixed(2)} GB`
  };
});

/** 当前页展示数据 = 后端分页返回的当前页 records */
const pageItems = computed(() => dataList.value);

type CatalogActionKey = 'publish' | 'download' | 'delete' | 'refresh' | 'detail' | 'analysis';

interface CatalogActionItem {
  key: CatalogActionKey;
  label: string;
  icon: string;
  danger?: boolean;
}

const actionGroups: CatalogActionItem[] = [
  { key: 'publish', label: '发布', icon: 'mdi:send-outline' },
  { key: 'download', label: '下载', icon: 'mdi:download-outline' },
  { key: 'delete', label: '删除', icon: 'mdi:trash-can-outline', danger: true },
  { key: 'detail', label: '详情', icon: 'mdi:information-outline' },
  { key: 'analysis', label: '分析', icon: 'mdi:chart-box-outline' }
];

// ====== NDataTable columns ======
const columns = computed<DataTableColumns<CatalogItem>>(() => [
  {
    title: '数据名称',
    key: 'name',
    width: 260,
    render(row) {
      return h('div', { class: 'dataset-cell' }, [
        h('div', { class: 'dataset-cell__content' }, [
          h('div', { class: 'dataset-cell__title' }, row.name),
          h('div', { class: 'dataset-cell__sub' }, row.timePhase)
        ])
      ]);
    }
  },
  {
    title: '数据时间',
    key: 'ingestTime',
    width: 150,
    render(row) {
      return h('span', { class: 'row-text row-text--muted' }, row.ingestTime);
    }
  },
  {
    title: '数据类型',
    key: 'type',
    width: 120,
    render(row) {
      return h('span', { class: `type-chip ${getTypeTagClass(row.type)}` }, row.type);
    }
  },
  {
    title: '空间范围',
    key: 'range',
    width: 140,
    render(row) {
      return h('span', { class: 'row-text' }, row.range);
    }
  },
  {
    title: '数据来源',
    key: 'source',
    width: 125,
    render(row) {
      return h('span', { class: 'row-text' }, row.source);
    }
  },
  {
    title: '数据大小',
    key: 'size',
    width: 110,
    render(row) {
      return h('span', { class: 'row-text row-text--mono' }, row.size);
    }
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
    align: 'center',
    render(row) {
      const cfg = getStatusConfig(row.status);
      return h('span', { class: `status-tag status-tag--${cfg.type}` }, cfg.label);
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 230,
    fixed: 'right',
    align: 'center',
    render(row) {
      return h('div', { class: 'action-group' }, [
        h(
          'button',
          {
            type: 'button',
            class: 'action-icon-btn',
            'data-tooltip': '发布',
            onClick: () => handleAction('publish', row)
          },
          [h(SvgIcon, { icon: 'mdi:send-outline', class: 'action-icon-btn__svg' })]
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'action-icon-btn',
            'data-tooltip': '下载',
            onClick: () => handleAction('download', row)
          },
          [h(SvgIcon, { icon: 'mdi:download-outline', class: 'action-icon-btn__svg' })]
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'action-icon-btn action-icon-btn--danger',
            'data-tooltip': '删除',
            onClick: () => handleAction('delete', row)
          },
          [h(SvgIcon, { icon: 'mdi:trash-can-outline', class: 'action-icon-btn__svg' })]
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'action-icon-btn',
            'data-tooltip': '详情',
            onClick: () => handleAction('detail', row)
          },
          [h(SvgIcon, { icon: 'mdi:information-outline', class: 'action-icon-btn__svg' })]
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'action-icon-btn action-icon-btn--analysis',
            'data-tooltip': '分析',
            onClick: () => handleAction('analysis', row)
          },
          [h(SvgIcon, { icon: 'mdi:chart-box-outline', class: 'action-icon-btn__svg' })]
        )
      ]);
    }
  }
]);

// ====== NDataTable theme overrides ======
const dataTableThemeOverrides = {
  // 颜色走 ui-palette 变量，浅色模式下表格自动跟随
  thColor: 'var(--ui-surface-20)',
  thColorHover: 'var(--ui-surface-4)',
  tdColor: 'transparent',
  tdColorHover: 'var(--ui-border-23)',
  borderColor: 'var(--ui-border-4)',
  thTextColor: 'var(--ui-text-19)',
  tdTextColor: 'var(--ui-text-20)',
  borderRadius: '4px',
  fontSize: '14px',
  thFontWeight: '600'
};

function normalizeSize(size: string) {
  const value = parseFloat(size);
  if (size.toUpperCase().includes('MB')) return value / 1024;
  return value;
}

function getDataTypeIcon(type: string): string {
  const iconMap: Record<string, string> = {
    遥感影像: 'mdi:database',
    数字高程: 'mdi:terrain',
    倾斜摄影: 'mdi:layers-triple',
    气象水文: 'mdi:weather-rainy',
    地下管网: 'mdi:transit-connection-horizontal',
    矢量基础: 'mdi:vector-polyline',
    地名地址: 'mdi:map-marker-outline',
    战场专题: 'mdi:shield-outline',
    障碍物与目标: 'mdi:alert-octagon-outline',
    多模态语料: 'mdi:file-document-multiple-outline',
    历史方案: 'mdi:history'
  };
  return iconMap[type] || 'mdi:file-document-outline';
}

function getTypeTagClass(type: string) {
  const typeClassMap: Record<string, string> = {
    遥感影像: 'type-chip--image',
    数字高程: 'type-chip--elevation',
    倾斜摄影: 'type-chip--oblique',
    气象水文: 'type-chip--hydro',
    地下管网: 'type-chip--pipe',
    矢量基础: 'type-chip--vector',
    地名地址: 'type-chip--poi',
    战场专题: 'type-chip--battlefield',
    障碍物与目标: 'type-chip--obstacle',
    多模态语料: 'type-chip--corpus',
    历史方案: 'type-chip--plan'
  };
  return typeClassMap[type] || 'type-chip--default';
}

function getStatusConfig(status: string) {
  const map: Record<string, { label: string; type: 'success' | 'warning' | 'default' }> = {
    published: { label: '已发布', type: 'success' },
    draft: { label: '草稿', type: 'warning' },
    offline: { label: '已下线', type: 'default' }
  };
  return map[status] || { label: status, type: 'default' as const };
}

function formatBbox(bbox?: [number, number, number, number]) {
  if (!bbox) return '—';
  return `${bbox[0].toFixed(2)}°E, ${bbox[1].toFixed(2)}°N → ${bbox[2].toFixed(2)}°E, ${bbox[3].toFixed(2)}°N`;
}

function handleCategorySelect(keys: Array<string | number>) {
  const first = keys[0];
  selectedCategory.value = first != null ? String(first) : null;
  currentPage.value = 1;
}

function togglePublish(item: CatalogItem) {
  const idx = dataList.value.findIndex(d => d.id === item.id);
  if (idx === -1) return;
  // mock status 字符串 -> 后端数字（0草稿/1已发布/2已下线）
  const current = dataList.value[idx].status;
  const target = current === 'published' ? 2 : 1;
  publishCatalog(item.id, target)
    .then(() => {
      dataList.value[idx].status = target === 2 ? 'offline' : 'published';
      if (target === 2) window.$message?.warning(`${item.name} 已下线`);
      else window.$message?.success(`${item.name} 已发布`);
    })
    .catch(() => window.$message?.error('操作失败'));
}

function handleDelete(item: CatalogItem) {
  window.$dialog?.warning({
    title: '确认删除',
    content: `确定要删除数据「${item.name}」吗？此操作不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => {
      deleteCatalog(item.id)
        .then(() => {
          const idx = dataList.value.findIndex(d => d.id === item.id);
          if (idx !== -1) dataList.value.splice(idx, 1);
          window.$message?.success('删除成功');
        })
        .catch(() => window.$message?.error('删除失败'));
    }
  });
}

function showImport() {
  uploadVisible.value = true;
}

/** 上传成功后刷新列表 */
function handleUploadSuccess() {
  loadData();
  loadStatistics();
}

function handleSearch() {
  currentPage.value = 1;
}

function handleReset() {
  activeTab.value = '总览';
  selectedCategory.value = null;
  searchKeyword.value = '';
  selectedType.value = '';
  selectedAgent.value = '';
  selectedScenario.value = '';
  currentPage.value = 1;
}

function handleAction(action: CatalogActionKey, item: CatalogItem) {
  switch (action) {
    case 'publish':
      togglePublish(item);
      break;
    case 'download':
      fetchCatalogDownloadUrl(item.id)
        .then(res => {
          const url = res.data;
          if (url) window.open(url, '_blank');
          else window.$message?.warning('该数据无下载地址');
        })
        .catch(() => window.$message?.error('获取下载地址失败'));
      break;
    case 'delete':
      handleDelete(item);
      break;
    case 'detail':
      detailItem.value = item;
      detailVisible.value = true;
      break;
    case 'analysis':
      analysisItem.value = item;
      break;
    default:
      break;
  }
}

// ====== 数据加载（真实后端）======

/** 分类树索引：nodeId -> 节点（用于从 categoryId 推导大类 id/name，key 为雪花 ID 字符串） */
const categoryNodeMap = computed<Record<string, Api.Catalog.CategoryNode>>(() => {
  const map: Record<string, Api.Catalog.CategoryNode> = {};
  const walk = (nodes: Api.Catalog.CategoryNode[]) => {
    for (const n of nodes) {
      map[String(n.id)] = n;
      if (n.children?.length) walk(n.children);
    }
  };
  walk(categoryTree.value);
  return map;
});

/** 将字节格式化为展示字符串（兼容 normalizeSize 的 parseFloat） */
function formatSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return '-';
  const gb = bytes / 1024 / 1024 / 1024;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** 后端返回字段 -> 前端 mock CatalogItem 字段适配（保留 OL/详情/分析对 type/range/status 等的依赖） */
function adaptItem(raw: Api.Catalog.CatalogItem): CatalogItem {
  const node = categoryNodeMap.value[raw.categoryId ?? ''];
  // 大类（一级节点）id 与名称：从叶子沿 parentId 上溯到根
  let rootId: string | null = null;
  let rootName = raw.typeName ?? '';
  let cur: Api.Catalog.CategoryNode | undefined = node;
  const visited = new Set<string>();
  while (cur && !visited.has(String(cur.id))) {
    visited.add(String(cur.id));
    rootName = cur.name;
    rootId = String(cur.id);
    cur = cur.parentId != null ? categoryNodeMap.value[String(cur.parentId)] : undefined;
  }
  return {
    id: raw.id,
    name: raw.name,
    ingestTime: raw.createTime ?? '',
    timePhase: raw.extendJson
      ? (() => {
          try {
            const j = JSON.parse(raw.extendJson);
            return j.timePhase ?? j.phase ?? '';
          } catch {
            return '';
          }
        })()
      : '',
    range: raw.bbox ?? raw.categoryName ?? '',
    type: rootName || raw.typeName || raw.categoryName || '未分类',
    status: raw.status === 1 ? 'published' : raw.status === 2 ? 'offline' : 'draft',
    size: formatSize(raw.size),
    source: raw.source ?? '',
    format: raw.format ?? '',
    coordinateSystem: raw.crs ?? '',
    bbox: raw.bbox
      ? (() => {
          try {
            const arr = JSON.parse(raw.bbox);
            return Array.isArray(arr) && arr.length === 4 ? arr : undefined;
          } catch {
            return undefined;
          }
        })()
      : undefined,
    // 补充分类字段（filteredData 按 id 过滤用）
    categoryId: raw.categoryId ?? undefined,
    typeId: rootId ?? undefined
  } as CatalogItem;
}

/** 构建后端查询参数（后端分页 + 筛选） */
function buildPageParams() {
  const params: Api.Catalog.CatalogQuery = {
    page: currentPage.value,
    size: pageSize.value,
    name: searchKeyword.value || undefined,
    status: undefined
  };
  if (selectedCategory.value) params.categoryId = selectedCategory.value;
  if (selectedType.value) params.typeId = selectedType.value;
  if (activeTab.value && activeTab.value !== '总览') {
    // Tab 对应大类 id：从分类树一级节点按 name 匹配
    const root = categoryTree.value.find(c => c.name === activeTab.value);
    if (root) params.typeId = root.id;
  }
  return params;
}

let loadSeq = 0;

async function loadData() {
  // 请求序号守卫：快速翻页时丢弃迟到的旧响应，避免表格显示回旧页数据
  const seq = ++loadSeq;
  isLoading.value = true;
  try {
    const res = await fetchCatalogPage(buildPageParams());
    if (seq !== loadSeq) return;
    const pageData = res.data;
    const pageResult = Array.isArray(pageData)
      ? (pageData as unknown as Api.Catalog.PageResult<Api.Catalog.CatalogItem>)
      : (pageData as Api.Catalog.PageResult<Api.Catalog.CatalogItem>);
    // Continew 全局包装为 { list, total }，IPage 原生为 { records, total }——双结构兼容
    const rawList =
      (pageResult as { list?: Api.Catalog.CatalogItem[] }).list ??
      (pageResult as { records?: Api.Catalog.CatalogItem[] }).records ??
      [];
    dataList.value = rawList.map(adaptItem);
    total.value = Number(pageResult?.total ?? 0);
    // 加载全量统计（仅用于顶部指标）
    loadStatistics();
  } catch {
    if (seq !== loadSeq) return;
    dataList.value = [];
    total.value = 0;
    window.$message?.error('数据目录加载失败');
  } finally {
    if (seq === loadSeq) isLoading.value = false;
  }
}

/** 全量加载用于顶部统计（不用于列表） */
async function loadStatistics() {
  try {
    const res = await fetchCatalogPage({ page: 1, size: 1000 });
    const pageData = res.data;
    // Continew 全局包装为 { list, total }，IPage 原生为 { records, total }——双结构兼容
    const wrapped = pageData as { list?: Api.Catalog.CatalogItem[]; records?: Api.Catalog.CatalogItem[] };
    const records = Array.isArray(pageData) ? pageData : (wrapped?.list ?? wrapped?.records ?? []);
    statDataList.value = records.map(adaptItem);
  } catch {
    statDataList.value = [];
  }
}

async function loadCategoryTree() {
  try {
    const res = await fetchCategoryTree();
    const payload = res.data;
    categoryTree.value = Array.isArray(payload) ? (payload as Api.Catalog.CategoryNode[]) : [];
  } catch {
    categoryTree.value = [];
  }
}

onMounted(() => {
  loadCategoryTree().then(() => loadData());
});

// 筛选条件变化：重置到第一页并重新请求后端分页
watch([activeTab, selectedCategory, selectedType, searchKeyword], () => {
  if (currentPage.value !== 1) {
    currentPage.value = 1;
  } else {
    loadData();
  }
});

// 页码/每页条数变化：重新请求后端分页
watch([currentPage, pageSize], () => {
  loadData();
});
</script>

<template>
  <div class="catalog-page" :class="{ 'catalog-page--dark': darkMode }">
    <div class="catalog-shell">
      <aside class="catalog-sidebar">
        <div class="catalog-sidebar__header">
          <div class="catalog-sidebar__title">数据目录</div>
        </div>
        <div class="catalog-sidebar__panel">
          <NTree
            v-model:expanded-keys="expandedKeys"
            block-line
            :data="treeOptions"
            selectable
            expand-on-click
            @update:selected-keys="handleCategorySelect"
          />
        </div>
        <div class="catalog-sidebar__manage" @click="categoryManageVisible = true">
          <SvgIcon icon="mdi:cog-outline" class="catalog-sidebar__manage-icon" />
          管理分类
        </div>
      </aside>

      <section class="catalog-main">
        <div class="catalog-topbar">
          <div class="catalog-topbar__left">
            <div class="catalog-search-panel">
              <div class="catalog-search-panel__label">
                <SvgIcon icon="mdi:magnify" class="catalog-search-panel__label-icon" />
                目录检索
              </div>
              <NInput
                v-model:value="searchKeyword"
                class="catalog-search-input"
                placeholder="输入关键词搜索数据名称、来源、范围、Agent、场景标签…"
                clearable
                @keyup.enter="handleSearch"
              >
                <template #prefix>
                  <SvgIcon icon="mdi:magnify" class="catalog-search-input__icon" />
                </template>
                <template #suffix>
                  <NButton type="primary" size="small" class="catalog-search-btn" @click="handleSearch">
                    <SvgIcon icon="mdi:magnify" class="catalog-search-btn__icon" />
                    搜索
                  </NButton>
                </template>
              </NInput>
            </div>
          </div>
          <div class="catalog-topbar__right">
            <div class="catalog-filter-card">
              <div class="catalog-filter-card__glow" />
              <div class="catalog-filter">
                <span class="catalog-filter__label">数据类型</span>
                <NSelect v-model:value="selectedType" class="catalog-filter__select" :options="typeOptions" />
              </div>
              <div class="catalog-filter">
                <span class="catalog-filter__label">智能体</span>
                <NSelect v-model:value="selectedAgent" class="catalog-filter__select" :options="agentOptions" />
              </div>
              <div class="catalog-filter">
                <span class="catalog-filter__label">场景</span>
                <NSelect v-model:value="selectedScenario" class="catalog-filter__select" :options="scenarioOptions" />
              </div>
            </div>
            <NButton type="primary" class="catalog-primary-btn catalog-primary-btn--upload" @click="showImport">
              <SvgIcon icon="mdi:upload-outline" />
              <span>上传</span>
            </NButton>
            <NButton class="catalog-ghost-btn" @click="handleReset">重置</NButton>
          </div>
        </div>

        <div class="catalog-main__card">
          <div class="catalog-card-head">
            <div class="catalog-card-head__title">目录清单</div>
            <div class="catalog-card-head__meta">
              <span>共 {{ total }} 条结果</span>
            </div>
          </div>

          <div class="catalog-table-wrap">
            <div v-if="isLoading" class="catalog-loading">数据加载中...</div>

            <template v-else>
              <NDataTable
                :columns="columns"
                :data="pageItems"
                :pagination="false"
                :row-key="(row: CatalogItem) => row.id"
                :theme-overrides="dataTableThemeOverrides"
                :bordered="false"
                :scroll-x="1235"
                single-line
                flex-height
                class="catalog-data-table"
              />

              <div class="catalog-mobile-list">
                <div v-for="item in pageItems" :key="`mobile-${item.id}`" class="catalog-mobile-card">
                  <div class="catalog-mobile-card__head">
                    <div class="dataset-cell">
                      <div class="dataset-cell__content">
                        <div class="dataset-cell__title">{{ item.name }}</div>
                        <div class="dataset-cell__sub">{{ item.ingestTime }}</div>
                      </div>
                    </div>
                    <span class="type-chip" :class="getTypeTagClass(item.type)">
                      {{ item.type }}
                    </span>
                  </div>
                  <div class="catalog-mobile-card__grid">
                    <div>
                      <span>空间范围</span>
                      {{ item.range }}
                    </div>
                    <div>
                      <span>数据来源</span>
                      {{ item.source }}
                    </div>
                    <div>
                      <span>数据大小</span>
                      {{ item.size }}
                    </div>
                    <div>
                      <span>时相</span>
                      {{ item.timePhase }}
                    </div>
                  </div>
                  <div class="catalog-mobile-card__actions">
                    <button
                      v-for="action in actionGroups"
                      :key="`${item.id}-${action.key}`"
                      type="button"
                      class="action-icon-btn"
                      :class="{ 'action-icon-btn--danger': action.danger }"
                      :data-tooltip="action.label"
                      @click="handleAction(action.key, item)"
                    >
                      <SvgIcon :icon="action.icon" class="action-icon-btn__svg" />
                    </button>
                  </div>
                </div>
              </div>

              <div class="catalog-footer">
                <div class="catalog-footer__summary">
                  共 {{ total }} 条
                  <span class="catalog-footer__divider" />
                  已发布 {{ summaryMetrics.published }} 条
                  <span class="catalog-footer__divider" />
                  草稿 {{ summaryMetrics.draft }} 条
                  <span class="catalog-footer__divider" />
                  总容量 {{ summaryMetrics.totalSize }}
                </div>

                <NPagination
                  v-model:page="currentPage"
                  v-model:page-size="pageSize"
                  :item-count="total"
                  :page-sizes="[10, 20, 50]"
                  show-size-picker
                />
              </div>
            </template>
          </div>
        </div>
      </section>
    </div>

    <!-- 详情弹窗 -->
    <NModal v-model:show="detailVisible" :mask-closable="true" :close-on-esc="true" class="catalog-detail-modal">
      <div v-if="detailItem" class="detail-card">
        <!-- 标题区 -->
        <div class="detail-header">
          <div class="detail-header__left">
            <SvgIcon :icon="getDataTypeIcon(detailItem.type)" class="detail-header__icon" />
            <div class="detail-header__text">
              <h3 class="detail-header__title">{{ detailItem.name }}</h3>
              <div class="detail-header__badges">
                <span class="type-chip" :class="getTypeTagClass(detailItem.type)">
                  {{ detailItem.type }}
                </span>
                <NTag
                  :type="getStatusConfig(detailItem.status).type"
                  size="small"
                  :bordered="false"
                  class="detail-status-tag"
                >
                  {{ getStatusConfig(detailItem.status).label }}
                </NTag>
              </div>
            </div>
          </div>
          <NButton class="detail-close-btn" @click="detailVisible = false">
            <SvgIcon icon="mdi:close" />
          </NButton>
        </div>

        <!-- 信息区 -->
        <div class="detail-body">
          <!-- 基本信息区 -->
          <div class="detail-section">
            <div class="detail-section__title">
              <SvgIcon icon="mdi:information-outline" class="detail-section__icon" />
              基本信息
            </div>
            <div class="detail-grid">
              <div class="detail-field">
                <span class="detail-field__label">数据来源</span>
                <span class="detail-field__value">{{ detailItem.source }}</span>
              </div>
              <div class="detail-field">
                <span class="detail-field__label">数据格式</span>
                <span class="detail-field__value">{{ detailItem.format || '—' }}</span>
              </div>
              <div class="detail-field">
                <span class="detail-field__label">分辨率</span>
                <span class="detail-field__value">{{ detailItem.resolution || '—' }}</span>
              </div>
              <div class="detail-field">
                <span class="detail-field__label">坐标系</span>
                <span class="detail-field__value detail-field__value--small">
                  {{ detailItem.coordinateSystem || '—' }}
                </span>
              </div>
              <div class="detail-field">
                <span class="detail-field__label">数据大小</span>
                <span class="detail-field__value">{{ detailItem.size }}</span>
              </div>
              <div class="detail-field">
                <span class="detail-field__label">时相</span>
                <span class="detail-field__value">{{ detailItem.timePhase }}</span>
              </div>
              <div class="detail-field">
                <span class="detail-field__label">入库时间</span>
                <span class="detail-field__value">{{ detailItem.ingestTime }}</span>
              </div>
              <div class="detail-field">
                <span class="detail-field__label">更新时间</span>
                <span class="detail-field__value">{{ detailItem.updateTime || '—' }}</span>
              </div>
            </div>
          </div>

          <!-- 空间范围区 -->
          <div class="detail-section">
            <div class="detail-section__title">
              <SvgIcon icon="mdi:map-marker-outline" class="detail-section__icon" />
              空间范围
            </div>
            <div class="detail-grid">
              <div class="detail-field detail-field--full">
                <span class="detail-field__label">空间范围</span>
                <span class="detail-field__value">{{ detailItem.range }}</span>
              </div>
              <div class="detail-field detail-field--full">
                <span class="detail-field__label">坐标范围 (BBox)</span>
                <span class="detail-field__value detail-field__value--mono">{{ formatBbox(detailItem.bbox) }}</span>
              </div>
            </div>
          </div>

          <!-- 描述区 -->
          <div v-if="detailItem.description" class="detail-section">
            <div class="detail-section__title">
              <SvgIcon icon="mdi:text-box-outline" class="detail-section__icon" />
              数据描述
            </div>
            <p class="detail-desc">{{ detailItem.description }}</p>
          </div>

          <!-- 标签区 -->
          <div v-if="detailItem.tags?.length" class="detail-section">
            <div class="detail-section__title">
              <SvgIcon icon="mdi:tag-outline" class="detail-section__icon" />
              标签
            </div>
            <div class="detail-tags">
              <span v-for="tag in detailItem.tags" :key="tag" class="detail-tag">{{ tag }}</span>
            </div>
          </div>

          <!-- 微调状态 -->
          <div v-if="detailItem.finetuneStatus?.used" class="detail-section">
            <div class="detail-section__title">
              <SvgIcon icon="mdi:brain" class="detail-section__icon" />
              模型微调
            </div>
            <div class="detail-grid">
              <div class="detail-field">
                <span class="detail-field__label">标注样本数</span>
                <span class="detail-field__value detail-field__value--mono">
                  {{ detailItem.finetuneStatus.sampleCount?.toLocaleString() || '—' }}
                </span>
              </div>
              <div class="detail-field">
                <span class="detail-field__label">标注完成度</span>
                <span class="detail-field__value">{{ detailItem.finetuneStatus.annotationComplete ?? '—' }}%</span>
              </div>
              <div v-if="detailItem.finetuneStatus.taskTypes?.length" class="detail-field detail-field--full">
                <span class="detail-field__label">适用任务</span>
                <div class="detail-tags">
                  <span
                    v-for="t in detailItem.finetuneStatus.taskTypes"
                    :key="t"
                    class="detail-tag detail-tag--finetune"
                  >
                    {{ t }}
                  </span>
                </div>
              </div>
              <div v-if="detailItem.finetuneStatus.modelVersion" class="detail-field detail-field--full">
                <span class="detail-field__label">模型版本</span>
                <span class="detail-field__value detail-field__value--mono">
                  {{ detailItem.finetuneStatus.modelVersion }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </NModal>

    <!-- 数据入库上传弹窗（独立组件：分片直传 / 中转） -->
    <CatalogUploadModal v-model:show="uploadVisible" @success="handleUploadSuccess" />

    <!-- 分类管理弹窗 -->
    <CatalogCategoryManage v-model:show="categoryManageVisible" @refresh="handleCategoryChanged" />

    <!-- 数据分析弹窗（独立组件：地图 + mock 要素分析） -->
    <CatalogAnalysis :item="analysisItem" @close="analysisItem = null" />
  </div>
</template>

<style scoped lang="scss">
.catalog-page {
  --catalog-page-bg:
    radial-gradient(circle at top, var(--ui-border-1) 0%, rgba(0, 0, 0, 0) 36%),
    linear-gradient(180deg, var(--ui-page-1) 0%, var(--ui-page-2) 38%, var(--ui-page-3) 100%);
  --catalog-surface-bg: linear-gradient(180deg, var(--ui-surface-1) 0%, var(--ui-surface-2) 100%);
  --catalog-surface-border: var(--ui-border-2);
  --catalog-strong-border: var(--ui-border-3);
  --catalog-line: var(--ui-border-4);
  --catalog-text-primary: var(--ui-text-1);
  --catalog-text-secondary: var(--ui-text-2);
  --catalog-text-tertiary: var(--ui-text-3);
  --catalog-input-bg: var(--ui-surface-3);
  --catalog-input-border: var(--ui-border-5);
  --catalog-glow: 0 0 0 1px var(--ui-border-6), 0 18px 40px var(--ui-shadow-1);
  --catalog-button-bg: linear-gradient(180deg, var(--ui-accent-1) 0%, var(--ui-accent-2) 100%);
  --catalog-button-border: var(--ui-accent-3);
  --catalog-accent: var(--ui-accent-4);
  --catalog-danger: var(--ui-accent-5);
  height: 100%;
  background: var(--catalog-page-bg);
  color: var(--catalog-text-primary);
  font-size: 15px;
  overflow: hidden;
}

.catalog-page--dark {
  color-scheme: dark;
}

.catalog-shell {
  height: 100%;
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  gap: 10px;
  padding: 12px 14px;
  box-sizing: border-box;
}

.catalog-sidebar,
.catalog-main__card,
.catalog-topbar {
  background: var(--catalog-surface-bg);
  border: 1px solid var(--catalog-surface-border);
  box-shadow: var(--catalog-glow);
  position: relative;
}

/* Sidebar corner accents */
.catalog-sidebar::before,
.catalog-sidebar::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  pointer-events: none;
  z-index: 2;
  opacity: 0.35;
}
.catalog-sidebar::before {
  top: -1px;
  left: -1px;
  border-top: 2px solid var(--catalog-accent);
  border-left: 2px solid var(--catalog-accent);
  border-radius: 4px 0 0 0;
}
.catalog-sidebar::after {
  bottom: -1px;
  right: -1px;
  border-bottom: 2px solid var(--catalog-accent);
  border-right: 2px solid var(--catalog-accent);
  border-radius: 0 0 4px 0;
}

/* Main card corner accents */
.catalog-main__card::before,
.catalog-main__card::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  pointer-events: none;
  z-index: 2;
  opacity: 0.35;
}
.catalog-main__card::before {
  top: -1px;
  left: -1px;
  border-top: 2px solid var(--catalog-accent);
  border-left: 2px solid var(--catalog-accent);
  border-radius: 4px 0 0 0;
}
.catalog-main__card::after {
  bottom: -1px;
  right: -1px;
  border-bottom: 2px solid var(--catalog-accent);
  border-right: 2px solid var(--catalog-accent);
  border-radius: 0 0 4px 0;
}

.catalog-sidebar {
  min-width: 0;
  display: flex;
  flex-direction: column;
  border-radius: 4px;
  overflow: hidden;
}

.catalog-sidebar__header {
  display: flex;
  align-items: center;
  height: 46px;
  padding: 0 14px;
  border-bottom: 1px solid var(--catalog-line);
  background: linear-gradient(180deg, var(--ui-surface-4) 0%, var(--ui-surface-5) 100%);
  position: relative;
}

/* Sidebar header left accent bar */
.catalog-sidebar__header::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  bottom: 20%;
  width: 2px;
  border-radius: 1px;
  background: linear-gradient(180deg, transparent, var(--catalog-accent), transparent);
  opacity: 0.5;
}

.catalog-sidebar__title {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-shadow: 0 0 8px var(--ui-border-7);
}

.catalog-sidebar__panel {
  flex: 1;
  min-height: 0;
  padding: 8px;
  overflow: auto;
}
.catalog-sidebar__manage {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  margin: 4px 8px 8px;
  font-size: 15px;
  color: var(--ui-text-4);
  border: 1px dashed var(--ui-border-8);
  border-radius: 8px;
  cursor: pointer;
  transition:
    color 0.2s,
    border-color 0.2s;
}
.catalog-sidebar__manage:hover {
  color: var(--vt-c-primary, var(--ui-accent-6));
  border-color: var(--vt-c-primary, var(--ui-accent-6));
}
.catalog-sidebar__manage-icon {
  font-size: 15px;
}

.catalog-main {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.catalog-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-height: 60px;
  padding: 12px 18px;
  border-radius: 6px;
  background:
    linear-gradient(180deg, var(--ui-surface-6) 0%, var(--ui-surface-7) 100%),
    linear-gradient(90deg, var(--ui-border-9) 0%, rgba(0, 0, 0, 0) 34%);
  position: relative;
}

.catalog-topbar::after {
  content: '';
  position: absolute;
  inset: auto 16px 0;
  height: 1px;
  background: linear-gradient(90deg, var(--ui-accent-7) 0%, var(--ui-accent-8) 100%);
}

.catalog-topbar__left,
.catalog-topbar__right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.catalog-topbar__left {
  min-width: 0;
}

.catalog-search-panel {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.catalog-search-panel__label {
  height: 38px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid var(--ui-border-10);
  background: linear-gradient(180deg, var(--ui-surface-8) 0%, var(--ui-surface-9) 100%);
  color: var(--ui-text-5);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.5px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  box-shadow: inset 0 1px 0 var(--ui-text-6);
  user-select: none;
}

.catalog-search-panel__label-icon {
  font-size: 15px;
  color: var(--ui-accent-9);
  opacity: 0.8;
}

/* ──── Search Input (NInput override) ──── */
.catalog-search-input {
  width: min(400px, 100%);
  min-width: 280px;
}

.catalog-search-input :deep(.n-input) {
  --n-border: 1px solid var(--ui-border-11) !important;
  --n-border-hover: 1px solid var(--ui-accent-10) !important;
  --n-border-focus: 1px solid var(--ui-accent-11) !important;
  --n-color: var(--ui-surface-10) !important;
  --n-color-focus: var(--ui-surface-10) !important;
  --n-text-color: var(--ui-text-1) !important;
  --n-placeholder-color: var(--ui-text-7) !important;
  --n-caret-color: var(--ui-accent-12) !important;
  --n-font-size: 15px !important;
  --n-height: 40px !important;
  --n-border-radius: 8px !important;
  --n-box-shadow-focus: 0 0 0 2px var(--ui-border-7), 0 2px 8px var(--ui-shadow-2) !important;
  font-family: 'Microsoft YaHei', 'PingFang SC', 'HarmonyOS Sans SC', 'Segoe UI', sans-serif;
  letter-spacing: 0.2px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: linear-gradient(180deg, var(--ui-surface-10) 0%, var(--ui-shadow-3) 100%);
  position: relative;
}

.catalog-search-input :deep(.n-input:hover) {
  box-shadow:
    inset 0 1px 0 var(--ui-text-8),
    0 2px 8px var(--ui-shadow-2);
  border-color: var(--ui-accent-10) !important;
}

.catalog-search-input :deep(.n-input--focus) {
  box-shadow:
    0 0 0 2px var(--ui-border-7),
    0 4px 12px var(--ui-shadow-4);
  background: linear-gradient(180deg, var(--ui-surface-11) 0%, var(--ui-surface-10) 100%);
}

/* Hide default NInput border/state-border for cleaner look */
.catalog-search-input :deep(.n-input__border),
.catalog-search-input :deep(.n-input__state-border) {
  display: none;
}

/* Enhanced placeholder animation */
.catalog-search-input :deep(.n-input__placeholder) {
  transition:
    color 0.3s ease,
    transform 0.3s ease;
}

.catalog-search-input :deep(.n-input--focus .n-input__placeholder) {
  color: var(--ui-text-9) !important;
  transform: translateX(2px);
}

.catalog-search-input__icon {
  font-size: 18px;
  color: var(--ui-accent-9);
  opacity: 0.7;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.catalog-search-input :deep(.n-input--focus) .catalog-search-input__icon {
  opacity: 1;
  color: var(--ui-accent-12);
  transform: scale(1.1);
}

/* Subtle glow effect on focus */
.catalog-search-input :deep(.n-input--focus)::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 9px;
  background: linear-gradient(135deg, var(--ui-border-12) 0%, var(--ui-border-13) 100%);
  pointer-events: none;
  z-index: -1;
  animation: inputGlow 2s ease-in-out infinite alternate;
}

@keyframes inputGlow {
  0% {
    opacity: 0.5;
    transform: scale(1);
  }
  100% {
    opacity: 1;
    transform: scale(1.02);
  }
}

/* ──── Search Button (inside NInput suffix) ──── */
.catalog-search-btn {
  --n-color: linear-gradient(180deg, var(--ui-accent-13) 0%, var(--ui-accent-14) 100%) !important;
  --n-color-hover: linear-gradient(180deg, var(--ui-accent-15) 0%, var(--ui-accent-16) 100%) !important;
  --n-color-pressed: linear-gradient(180deg, var(--ui-accent-16) 0%, var(--ui-accent-17) 100%) !important;
  --n-text-color: #fff !important;
  --n-text-color-hover: #fff !important;
  --n-text-color-pressed: rgba(255, 255, 255, 0.85) !important;
  --n-border: none !important;
  --n-border-radius: 6px !important;
  --n-font-size: 14px !important;
  --n-height: 32px !important;
  --n-padding: 0 16px !important;
  --n-icon-size: 16px !important;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
  letter-spacing: 0.3px;
  box-shadow:
    inset 0 1px 0 var(--ui-text-10),
    0 2px 8px var(--ui-border-14);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.catalog-search-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent);
  transition: left 0.5s ease;
}

.catalog-search-btn:hover {
  box-shadow:
    inset 0 1px 0 var(--ui-text-11),
    0 4px 16px var(--ui-border-15);
  transform: translateY(-2px);
}

.catalog-search-btn:hover::before {
  left: 100%;
}

.catalog-search-btn:active {
  transform: translateY(0);
  box-shadow:
    inset 0 2px 4px var(--ui-shadow-5),
    0 1px 4px var(--ui-border-16);
  transition: all 0.1s ease;
}

.catalog-search-btn__icon {
  font-size: 14px;
  opacity: 0.9;
  transition: transform 0.3s ease;
}

.catalog-search-btn:hover .catalog-search-btn__icon {
  transform: scale(1.1);
}

/* ──── Primary / Ghost Buttons ──── */
.catalog-primary-btn :deep(.n-button),
.catalog-ghost-btn :deep(.n-button) {
  font-family: 'Microsoft YaHei', 'PingFang SC', 'HarmonyOS Sans SC', 'Segoe UI', sans-serif;
}

.catalog-primary-btn {
  --n-color: linear-gradient(180deg, var(--ui-accent-18) 0%, var(--ui-accent-19) 100%) !important;
  --n-color-hover: linear-gradient(180deg, var(--ui-accent-20) 0%, var(--ui-accent-21) 100%) !important;
  --n-color-pressed: linear-gradient(180deg, var(--ui-accent-19) 0%, var(--ui-accent-22) 100%) !important;
  --n-text-color: var(--ui-text-12) !important;
  --n-text-color-hover: #fff !important;
  --n-text-color-pressed: rgba(255, 255, 255, 0.9) !important;
  --n-border: 1px solid var(--ui-accent-3) !important;
  --n-border-hover: 1px solid var(--ui-accent-23) !important;
  --n-border-radius: 8px !important;
  --n-font-size: 15px !important;
  --n-height: 40px !important;
  --n-padding: 0 20px !important;
  font-weight: 600;
  letter-spacing: 0.3px;
  box-shadow:
    inset 0 1px 0 var(--ui-text-13),
    0 4px 16px var(--ui-border-17);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.catalog-primary-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  transition: left 0.6s ease;
}

.catalog-primary-btn:hover {
  box-shadow:
    inset 0 1px 0 var(--ui-text-14),
    0 6px 24px var(--ui-border-18);
  transform: translateY(-2px);
}

.catalog-primary-btn:hover::before {
  left: 100%;
}

.catalog-primary-btn:active {
  transform: translateY(0);
  box-shadow:
    inset 0 2px 4px var(--ui-shadow-5),
    0 2px 8px var(--ui-border-19);
  transition: all 0.1s ease;
}

/* Focus state for accessibility */
.catalog-primary-btn:focus-visible {
  outline: 2px solid var(--ui-accent-24);
  outline-offset: 2px;
}

.catalog-ghost-btn {
  --n-color: linear-gradient(180deg, var(--ui-surface-12) 0%, var(--ui-surface-13) 100%) !important;
  --n-color-hover: linear-gradient(180deg, var(--ui-accent-25) 0%, var(--ui-surface-14) 100%) !important;
  --n-color-pressed: linear-gradient(180deg, var(--ui-surface-13) 0%, var(--ui-surface-15) 100%) !important;
  --n-text-color: var(--ui-text-15) !important;
  --n-text-color-hover: var(--ui-text-12) !important;
  --n-border: 1px solid var(--ui-border-20) !important;
  --n-border-hover: 1px solid var(--ui-accent-10) !important;
  --n-border-radius: 8px !important;
  --n-font-size: 15px !important;
  --n-height: 40px !important;
  --n-padding: 0 20px !important;
  letter-spacing: 0.3px;
  box-shadow: inset 0 1px 0 var(--ui-text-16);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.catalog-ghost-btn:hover {
  box-shadow:
    inset 0 1px 0 var(--ui-text-6),
    0 4px 12px var(--ui-shadow-2);
  transform: translateY(-2px);
  border-color: var(--ui-accent-10) !important;
}

.catalog-ghost-btn:active {
  transform: translateY(0);
  box-shadow: inset 0 2px 4px var(--ui-shadow-6);
  transition: all 0.1s ease;
}

/* Focus state for accessibility */
.catalog-ghost-btn:focus-visible {
  outline: 2px solid var(--ui-accent-24);
  outline-offset: 2px;
}

.catalog-primary-btn--upload {
  min-width: 88px;
}

/* ──── Filter Card ──── */
.catalog-filter-card {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  padding: 2px;
  border-radius: 8px;
  background: linear-gradient(180deg, var(--ui-surface-16) 0%, var(--ui-surface-17) 100%);
  border: 1px solid var(--ui-border-21);
  box-shadow:
    inset 0 1px 0 var(--ui-text-17),
    0 2px 8px var(--ui-shadow-5);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.catalog-filter-card:hover {
  border-color: var(--ui-accent-26);
  box-shadow:
    inset 0 1px 0 var(--ui-text-18),
    0 4px 12px var(--ui-shadow-4);
  transform: translateY(-1px);
}

.catalog-filter-card__glow {
  position: absolute;
  inset: 1px;
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(90deg, var(--ui-border-22) 0%, rgba(0, 0, 0, 0) 55%);
}

.catalog-filter {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 198px;
  height: 38px;
  padding: 0 10px;
  border-radius: 6px;
}

.catalog-filter__label {
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-text-5);
  white-space: nowrap;
  letter-spacing: 0.3px;
}

.catalog-filter__select {
  flex: 1;
  min-width: 0;
  width: auto;
}

.catalog-main__card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 4px;
  overflow: hidden;
}

.catalog-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--catalog-line);
  background: linear-gradient(180deg, var(--ui-surface-18) 0%, var(--ui-surface-19) 100%);
  position: relative;
}

/* Card head left accent bar */
.catalog-card-head::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  bottom: 20%;
  width: 2px;
  border-radius: 1px;
  background: linear-gradient(180deg, transparent, var(--catalog-accent), transparent);
  opacity: 0.5;
}

.catalog-card-head__title {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-shadow: 0 0 8px var(--ui-border-12);
}

.catalog-card-head__meta {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  color: var(--catalog-text-secondary);
  font-size: 14px;
}

.catalog-table-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.catalog-loading {
  flex: 1;
  display: grid;
  place-items: center;
  color: var(--catalog-text-secondary);
  font-size: 15px;
}

/* ====== NDataTable deep overrides ====== */
.catalog-data-table {
  flex: 1;
  --n-th-color: var(--ui-surface-20) !important;
  --n-td-color: transparent !important;
  --n-td-color-hover: var(--ui-border-23) !important;
  --n-border-color: var(--ui-border-4) !important;
  --n-th-text-color: var(--ui-text-19) !important;
  --n-td-text-color: var(--ui-text-20) !important;
  --n-th-font-weight: 600 !important;
  --n-font-size: 14px !important;
}

.catalog-data-table :deep(.n-data-table-th) {
  background: linear-gradient(180deg, var(--ui-surface-20) 0%, var(--ui-surface-21) 100%) !important;
  font-size: 14px;
  padding: 15px 14px;
}

.catalog-data-table :deep(.n-data-table-td) {
  padding: 16px 14px;
  border-bottom: 1px solid var(--ui-border-24) !important;
}

.catalog-data-table :deep(.n-data-table-tr:hover .n-data-table-td) {
  background: var(--ui-border-23) !important;
}

.catalog-data-table :deep(.n-data-table-table) {
  border-collapse: separate;
  border-spacing: 0;
}

.dataset-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.dataset-cell__content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dataset-cell__title {
  color: var(--catalog-text-primary);
  font-size: 15px;
  line-height: 1.4;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dataset-cell__sub {
  color: var(--catalog-text-tertiary);
  font-size: 13px;
}

.row-text {
  color: var(--catalog-text-secondary);
  font-size: 14px;
}

.row-text--muted {
  color: var(--ui-text-21);
}

.row-text--mono {
  font-family: 'DIN', 'Consolas', monospace;
}

.type-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 86px;
  height: 28px;
  padding: 0 12px;
  border-radius: 4px;
  border: 1px solid transparent;
  font-size: 13px;
  line-height: 1;
  transition: all 0.2s ease;
}

.status-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 62px;
  height: 28px;
  padding: 0 10px;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1;
  font-weight: 500;
}

.status-tag--success {
  background: var(--ui-border-25);
  border: 1px solid var(--ui-border-26);
  color: var(--ui-accent-27);
}

.status-tag--warning {
  background: var(--ui-border-27);
  border: 1px solid var(--ui-border-28);
  color: var(--ui-accent-28);
}

.status-tag--default {
  background: var(--ui-accent-29);
  border: 1px solid var(--ui-accent-30);
  color: var(--ui-text-22);
}

.type-chip--image {
  background: var(--ui-accent-31);
  border-color: var(--ui-accent-32);
  color: var(--ui-text-23);
}

.type-chip--oblique {
  background: var(--ui-border-29);
  border-color: var(--ui-accent-33);
  color: var(--ui-text-24);
}

.type-chip--elevation {
  background: var(--ui-border-30);
  border-color: var(--ui-border-31);
  color: var(--ui-text-25);
}

.type-chip--hydro {
  background: var(--ui-border-32);
  border-color: var(--ui-border-33);
  color: var(--ui-text-26);
}

.type-chip--pipe {
  background: var(--ui-border-34);
  border-color: var(--ui-accent-34);
  color: var(--ui-text-27);
}

.type-chip--topic,
.type-chip--default {
  background: var(--ui-border-35);
  border-color: var(--ui-accent-35);
  color: var(--ui-text-28);
}

/* Actions — icon-only circle buttons (inside NDataTable, use :deep) */
.catalog-data-table :deep(.action-group) {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
}

.catalog-data-table :deep(.action-icon-btn) {
  position: relative;
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--ui-border-36);
  border: 1px solid var(--ui-border-37);
  color: var(--ui-text-29);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: inherit;
  outline: none;
}

.catalog-data-table :deep(.action-icon-btn:hover) {
  color: #fff;
  background: var(--ui-border-37);
  border-color: var(--ui-border-38);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--ui-border-39);
}

/* tooltip on hover — 显示在按钮下方，避免首行被表头遮挡 */
.catalog-data-table :deep(.action-icon-btn::after) {
  content: attr(data-tooltip);
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%) translateY(-4px);
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--ui-surface-22);
  border: 1px solid var(--ui-border-40);
  color: var(--ui-text-30);
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  z-index: 10;
}

.catalog-data-table :deep(.action-icon-btn:hover::after) {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.catalog-data-table :deep(.action-icon-btn__svg) {
  font-size: 17px;
  transition: transform 0.25s ease;
}

.catalog-data-table :deep(.action-icon-btn:hover .action-icon-btn__svg) {
  transform: scale(1.18);
}

/* Danger variant */
.catalog-data-table :deep(.action-icon-btn--danger) {
  background: var(--ui-accent-36);
  border-color: var(--ui-accent-37);
  color: var(--ui-text-31);
}

.catalog-data-table :deep(.action-icon-btn--danger:hover) {
  color: var(--ui-accent-5);
  background: var(--ui-accent-38);
  border-color: var(--ui-accent-39);
  box-shadow: 0 4px 12px var(--ui-accent-40);
}

.catalog-data-table :deep(.action-icon-btn--danger:hover::after) {
  border-color: var(--ui-accent-41);
}

.catalog-footer {
  min-height: 48px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid var(--catalog-line);
  background: linear-gradient(180deg, var(--ui-surface-7) 0%, var(--ui-surface-23) 100%);
}

.catalog-footer__summary {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--catalog-text-secondary);
  font-size: 14px;
}

.catalog-footer__divider {
  width: 1px;
  height: 10px;
  background: linear-gradient(180deg, transparent, var(--ui-border-41), transparent);
}

/* NPagination deep overrides */
.catalog-footer :deep(.n-pagination) {
  --n-item-text-color: var(--ui-text-5) !important;
  --n-item-text-color-hover: #fff !important;
  --n-item-text-color-active: #fff !important;
  --n-item-color-active: linear-gradient(180deg, var(--ui-accent-42) 0%, var(--ui-accent-43) 100%) !important;
  --n-item-border-active: 1px solid var(--ui-accent-44) !important;
  --n-item-color: var(--ui-surface-24) !important;
  --n-item-border: 1px solid var(--ui-border-42) !important;
  --n-item-border-hover: 1px solid var(--ui-accent-45) !important;
  --n-item-color-hover: var(--ui-surface-25) !important;
  --n-item-border-radius: 3px !important;
  font-size: 14px;
}

.catalog-footer :deep(.n-pagination .n-pagination-item) {
  min-width: 32px;
  height: 32px;
  border-radius: 3px;
}

.catalog-footer :deep(.n-pagination .n-pagination-item--active) {
  box-shadow: 0 0 6px var(--ui-border-39);
}

.catalog-footer :deep(.n-pagination-size-picker .n-base-selection) {
  --n-border: 1px solid var(--ui-border-42) !important;
  --n-border-hover: 1px solid var(--ui-accent-45) !important;
  --n-border-active: 1px solid var(--ui-accent-44) !important;
  --n-color: var(--ui-surface-24) !important;
  --n-color-active: var(--ui-surface-24) !important;
  --n-text-color: var(--ui-text-5) !important;
  height: 32px;
  border-radius: 3px;
}

.catalog-mobile-list {
  display: none;
}

/* ========== Detail Modal ========== */
.catalog-detail-modal {
  --n-border-radius: 8px;
}

.detail-card {
  /* NModal teleport 到 body，父级 .catalog-page 的变量无法继承，这里显式补齐 */
  --catalog-text-primary: var(--ui-text-1);
  --catalog-text-secondary: var(--ui-text-2);
  --catalog-text-tertiary: var(--ui-text-3);
  --catalog-line: var(--ui-border-4);
  --catalog-accent: var(--ui-accent-4);
  color: var(--catalog-text-primary);
  width: 680px;
  max-width: 92vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
  background: linear-gradient(180deg, var(--ui-surface-26) 0%, var(--ui-surface-27) 100%);
  border: 1px solid var(--ui-border-43);
  box-shadow:
    0 0 0 1px var(--ui-border-44),
    0 24px 64px var(--ui-shadow-7),
    0 0 80px var(--ui-border-45);
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--catalog-line);
  background: linear-gradient(180deg, var(--ui-surface-28) 0%, var(--ui-surface-29) 100%);
  position: relative;
}

.detail-header::after {
  content: '';
  position: absolute;
  left: 0;
  top: 16%;
  bottom: 16%;
  width: 3px;
  border-radius: 2px;
  background: linear-gradient(180deg, transparent, var(--catalog-accent), transparent);
  opacity: 0.6;
}

.detail-header__left {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-width: 0;
}

.detail-header__icon {
  flex-shrink: 0;
  font-size: 28px;
  color: var(--ui-accent-46);
  filter: drop-shadow(0 0 8px var(--ui-accent-47));
  margin-top: 2px;
}

.detail-header__text {
  min-width: 0;
}

.detail-header__title {
  margin: 0;
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 0.3px;
  color: var(--catalog-text-primary);
  line-height: 1.4;
  text-shadow: 0 0 10px var(--ui-border-7);
}

.detail-header__badges {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.detail-status-tag {
  font-size: 13px !important;
  padding: 0 10px !important;
  height: 26px !important;
  line-height: 26px !important;
}

.detail-close-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 1px solid var(--ui-border-46);
  border-radius: 6px;
  background: var(--ui-surface-30);
  color: var(--catalog-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 18px;
}

.detail-close-btn:hover {
  color: var(--catalog-accent);
  border-color: var(--ui-accent-45);
  background: var(--ui-border-36);
}

.detail-body {
  flex: 1;
  min-height: 0;
  padding: 20px 24px 24px;
  overflow-y: auto;
}

.detail-body::-webkit-scrollbar {
  width: 6px;
}

.detail-body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: var(--ui-border-47);
}

.detail-body::-webkit-scrollbar-track {
  background: transparent;
}

.detail-section {
  margin-bottom: 20px;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-section__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--catalog-accent);
  letter-spacing: 0.3px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--ui-border-48);
}

.detail-section__icon {
  font-size: 18px;
  opacity: 0.9;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px 24px;
}

.detail-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.detail-field--full {
  grid-column: 1 / -1;
}

.detail-field__label {
  font-size: 13px;
  color: var(--catalog-text-tertiary);
  letter-spacing: 0.2px;
}

.detail-field__value {
  font-size: 15px;
  color: var(--catalog-text-primary);
  line-height: 1.5;
  word-break: break-all;
}

.detail-field__value--small {
  font-size: 14px;
}

.detail-field__value--mono {
  font-family: 'DIN', 'Consolas', monospace;
  font-size: 14px;
  color: var(--ui-text-32);
  letter-spacing: 0.4px;
}

.detail-desc {
  margin: 0;
  font-size: 15px;
  line-height: 1.8;
  color: var(--catalog-text-secondary);
  padding: 12px 14px;
  border-radius: 6px;
  background: var(--ui-surface-31);
  border: 1px solid var(--ui-border-49);
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-tag {
  display: inline-flex;
  align-items: center;
  height: 30px;
  padding: 0 12px;
  border-radius: 4px;
  font-size: 14px;
  background: var(--ui-border-12);
  border: 1px solid var(--ui-border-50);
  color: var(--ui-text-5);
  transition: all 0.2s ease;
}

.detail-tag:hover {
  background: var(--ui-border-51);
  border-color: var(--ui-border-52);
  color: var(--ui-text-33);
}

.detail-tag--agent {
  background: var(--ui-accent-48);
  border-color: var(--ui-accent-49);
  color: var(--ui-text-34);
}

.detail-tag--scenario {
  background: var(--ui-border-53);
  border-color: var(--ui-border-54);
  color: var(--ui-text-35);
}

.detail-tag--finetune {
  background: var(--ui-border-55);
  border-color: var(--ui-border-56);
  color: var(--ui-text-36);
}

.detail-grade {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  margin-left: 6px;
  vertical-align: middle;
}

.detail-grade--A {
  background: var(--ui-border-57);
  color: var(--ui-accent-50);
}
.detail-grade--B {
  background: var(--ui-border-58);
  color: var(--ui-accent-51);
}
.detail-grade--C {
  background: var(--ui-border-59);
  color: var(--ui-accent-52);
}
.detail-grade--D {
  background: var(--ui-accent-53);
  color: var(--ui-accent-54);
}

.detail-audit-badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.detail-audit-badge--approved {
  background: var(--ui-border-60);
  color: var(--ui-accent-50);
}
.detail-audit-badge--pending {
  background: var(--ui-border-61);
  color: var(--ui-accent-52);
}
.detail-audit-badge--rejected {
  background: var(--ui-accent-55);
  color: var(--ui-accent-54);
}

.detail-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.detail-step {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 10px;
  border-radius: 4px;
  font-size: 11px;
  background: var(--ui-border-36);
  border: 1px solid var(--ui-border-62);
  color: var(--ui-text-37);
}

.detail-step__num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--ui-border-39);
  color: var(--ui-accent-51);
  font-size: 10px;
  font-weight: 700;
}

/* New type-chip variants */
.type-chip--vector {
  background: var(--ui-accent-56);
  border-color: var(--ui-accent-57);
  color: var(--ui-text-38);
}
.type-chip--poi {
  background: var(--ui-accent-58);
  border-color: var(--ui-accent-59);
  color: var(--ui-accent-60);
}
.type-chip--battlefield {
  background: var(--ui-accent-61);
  border-color: var(--ui-accent-62);
  color: var(--ui-accent-63);
}
.type-chip--obstacle {
  background: var(--ui-border-63);
  border-color: var(--ui-border-28);
  color: var(--ui-accent-28);
}
.type-chip--corpus {
  background: var(--ui-border-64);
  border-color: var(--ui-border-65);
  color: var(--ui-accent-64);
}
.type-chip--plan {
  background: var(--ui-accent-65);
  border-color: var(--ui-accent-66);
  color: var(--ui-text-39);
}

:deep(.n-tree-node-content) {
  height: 40px;
  padding-left: 4px;
  border-radius: 6px;
  color: var(--catalog-text-secondary);
  border: 1px solid transparent;
  font-size: 15px;
}

:deep(.n-tree-node-content:hover) {
  background: linear-gradient(90deg, var(--ui-border-66) 0%, var(--ui-surface-32) 100%);
  border-color: var(--ui-border-67);
}

:deep(.n-tree-node--selected > .n-tree-node-content) {
  background: linear-gradient(90deg, var(--ui-border-68) 0%, var(--ui-surface-33) 100%);
  color: #fff;
  border-color: var(--ui-accent-67);
  box-shadow: inset 2px 0 0 var(--catalog-accent);
}

:deep(.n-tree-node-indent) {
  width: 12px !important;
}

:deep(.n-tree-node-switcher) {
  color: var(--catalog-text-tertiary);
  width: 18px;
}

:deep(.n-tree-node-content__text) {
  font-size: 15px;
}

:deep(.catalog-filter__select .n-base-selection) {
  height: 34px;
  border-radius: 6px;
  background: var(--ui-surface-34);
  border-color: var(--ui-border-69);
  box-shadow: none;
  font-size: 14px;
}

:deep(.catalog-filter__select .n-base-selection-label) {
  color: var(--catalog-text-primary);
}

:deep(.catalog-filter__select .n-base-selection-placeholder),
:deep(.catalog-filter__select .n-base-selection-input__content) {
  color: var(--catalog-text-tertiary);
}

:deep(.catalog-filter__select .n-base-selection__border) {
  display: none;
}

:deep(.catalog-filter__select .n-base-selection-input) {
  padding-left: 6px;
}

.catalog-sidebar__panel::-webkit-scrollbar,
.catalog-data-table :deep(.n-data-table-base-table-body::-webkit-scrollbar) {
  width: 8px;
  height: 8px;
}

.catalog-sidebar__panel::-webkit-scrollbar-thumb,
.catalog-data-table :deep(.n-data-table-base-table-body::-webkit-scrollbar-thumb) {
  border-radius: 999px;
  background: var(--ui-accent-68);
}

.catalog-sidebar__panel::-webkit-scrollbar-track,
.catalog-data-table :deep(.n-data-table-base-table-body::-webkit-scrollbar-track) {
  background: var(--ui-surface-35);
}

@media (max-width: 1280px) {
  .catalog-topbar {
    flex-wrap: wrap;
  }

  .catalog-search-panel {
    width: 100%;
  }

  .catalog-search-input {
    flex: 1;
    min-width: 200px;
  }

  .catalog-topbar__right {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .catalog-footer {
    flex-direction: column;
    align-items: flex-start;
    padding-top: 10px;
    padding-bottom: 10px;
  }
}

@media (max-width: 1024px) {
  .catalog-shell {
    grid-template-columns: 1fr;
  }

  .catalog-sidebar {
    max-height: 280px;
  }

  .catalog-search {
    min-width: 100%;
    width: 100%;
  }

  .catalog-search-panel__label {
    display: none;
  }

  .catalog-topbar__left,
  .catalog-topbar__right {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .catalog-shell {
    padding: 10px;
  }

  .catalog-topbar {
    gap: 10px;
  }

  .catalog-primary-btn:not(.catalog-primary-btn--inline),
  .catalog-ghost-btn,
  .catalog-filter-card,
  .catalog-filter,
  .catalog-filter__select,
  .catalog-primary-btn--upload {
    width: 100%;
  }

  .catalog-filter {
    min-width: 0;
    justify-content: space-between;
  }

  .catalog-card-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .catalog-table {
    display: none;
  }

  .catalog-mobile-list {
    display: grid;
    gap: 10px;
    padding: 12px;
    overflow: auto;
  }

  .catalog-mobile-card {
    border: 1px solid var(--ui-border-70);
    border-radius: 6px;
    background: linear-gradient(180deg, var(--ui-surface-36) 0%, var(--ui-surface-37) 100%);
    padding: 12px;
  }

  .catalog-mobile-card__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .catalog-mobile-card__grid {
    margin-top: 12px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .catalog-mobile-card__grid div {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 14px;
    color: var(--catalog-text-secondary);
  }

  .catalog-mobile-card__grid span {
    color: var(--catalog-text-tertiary);
    font-size: 13px;
  }

  .catalog-mobile-card__actions {
    margin-top: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }

  .action-icon-btn {
    position: relative;
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--ui-border-36);
    border: 1px solid var(--ui-border-37);
    color: var(--ui-text-29);
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: inherit;
    outline: none;
  }

  .action-icon-btn:hover {
    color: #fff;
    background: var(--ui-border-37);
    border-color: var(--ui-border-38);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px var(--ui-border-39);
  }

  .action-icon-btn::after {
    content: attr(data-tooltip);
    position: absolute;
    top: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%) translateY(-4px);
    padding: 3px 8px;
    border-radius: 4px;
    background: var(--ui-surface-22);
    border: 1px solid var(--ui-border-40);
    color: var(--ui-text-30);
    font-size: 12px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition:
      opacity 0.2s ease,
      transform 0.2s ease;
    z-index: 10;
  }

  .action-icon-btn:hover::after {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }

  .action-icon-btn__svg {
    font-size: 17px;
    transition: transform 0.25s ease;
  }

  .action-icon-btn:hover .action-icon-btn__svg {
    transform: scale(1.18);
  }

  .action-icon-btn--danger {
    background: var(--ui-accent-36);
    border-color: var(--ui-accent-37);
    color: var(--ui-text-31);
  }

  .action-icon-btn--danger:hover {
    color: var(--ui-accent-5);
    background: var(--ui-accent-38);
    border-color: var(--ui-accent-39);
    box-shadow: 0 4px 12px var(--ui-accent-40);
  }

  .action-icon-btn--danger:hover::after {
    border-color: var(--ui-accent-41);
  }

  .catalog-footer__summary {
    flex-wrap: wrap;
  }
}

/* ── Button accent ── */
.action-icon-btn--analysis {
  background: var(--ui-border-45);
  border-color: var(--ui-border-7);
  color: var(--ui-accent-24);
}

.action-icon-btn--analysis:hover {
  color: var(--catalog-accent);
  background: var(--ui-border-62);
  border-color: var(--ui-border-71);
  box-shadow: 0 4px 12px var(--ui-border-62);
}

.action-icon-btn--analysis:hover::after {
  border-color: var(--ui-border-39);
}

/* ── Keyframes ── */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
