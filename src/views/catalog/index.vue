<script setup lang="ts">
import { computed, h, ref, watch } from 'vue';
import type { SelectOption } from 'naive-ui';
import { NButton, NDataTable, NInput, NPagination, NSelect, NTree, type DataTableColumns } from 'naive-ui';
import { useThemeStore } from '@/store/modules/theme';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { agentLabelMap, catalogCategories, catalogData, type AgentKey, type CatalogItem } from '@/mock/catalog';

defineOptions({
  name: 'CatalogPage'
});

const activeTab = ref('总览');
const selectedCategory = ref<string | null>(null);
const searchKeyword = ref('');
const selectedType = ref('');
const isLoading = ref(false);
const expandedKeys = ref<string[]>([]);
const dataList = ref<CatalogItem[]>([...catalogData]);
const themeStore = useThemeStore();
const darkMode = computed(() => themeStore.darkMode);
const currentPage = ref(1);
const pageSize = ref(10);
const detailVisible = ref(false);
const detailItem = ref<CatalogItem | null>(null);

const categoryCountMap = computed<Record<string, number>>(() => {
  return dataList.value.reduce<Record<string, number>>((acc, item) => {
    const typeToKeys: Record<string, string[]> = {
      '遥感影像': ['img', 'img-optical', 'img-sar', 'img-aerial', 'img-multi'],
      '数字高程': ['dem', 'dem-dem', 'dem-dsm', 'dem-derived'],
      '倾斜摄影': ['oblique', 'oblique-city', 'oblique-single', 'oblique-3dtiles'],
      '气象水文': ['hydro', 'hydro-rain', 'hydro-river', 'hydro-lake', 'hydro-station'],
      '地下管网': ['pipe', 'pipe-water', 'pipe-other', 'pipe-elec'],
      '矢量基础': ['vec', 'vec-dlg', 'vec-building', 'vec-traffic', 'vec-admin', 'vec-landuse'],
      '地名地址': ['poi', 'poi-strategic', 'poi-target', 'poi-facility'],
      '战场专题': ['battlefield', 'bf-climate', 'bf-geology', 'bf-em', 'bf-pop'],
      '障碍物与目标': ['obstacle', 'obs-urban', 'obs-traffic', 'obs-defense'],
      '多模态语料': ['corpus', 'corpus-text', 'corpus-image', 'corpus-media'],
      '历史方案': ['plan', 'plan-river', 'plan-route', 'plan-building']
    };
    const keys = typeToKeys[item.type];
    if (keys) {
      for (const k of keys) {
        acc[k] = (acc[k] || 0) + 1;
      }
    }
    return acc;
  }, {});
});

const treeOptions = computed(() =>
  catalogCategories.map(cat => ({
    label: `${cat.label} (${categoryCountMap.value[cat.key] || 0})`,
    key: cat.key,
    children: cat.children?.map(child => ({
      label: `${child.label} (${categoryCountMap.value[child.key] || 0})`,
      key: child.key
    }))
  }))
);

const typeOptions = computed<SelectOption[]>(() => [
  { label: '全部', value: '' },
  { label: '遥感影像', value: '遥感影像' },
  { label: '数字高程', value: '数字高程' },
  { label: '倾斜摄影', value: '倾斜摄影' },
  { label: '气象水文', value: '气象水文' },
  { label: '地下管网', value: '地下管网' },
  { label: '矢量基础', value: '矢量基础' },
  { label: '地名地址', value: '地名地址' },
  { label: '战场专题', value: '战场专题' },
  { label: '障碍物与目标', value: '障碍物与目标' },
  { label: '多模态语料', value: '多模态语料' },
  { label: '历史方案', value: '历史方案' }
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
  { label: '楼宇夺控', value: '楼宇夺控' },
  { label: '城市攻防', value: '城市攻防' },
  { label: '交通研判', value: '交通研判' },
  { label: '地形分析', value: '地形分析' },
  { label: '目标识别', value: '目标识别' },
  { label: '态势感知', value: '态势感知' },
  { label: '预案生成', value: '预案生成' }
]);

const filteredData = computed(() => {
  let filtered = [...dataList.value];

  // Tab 过滤 — 新 11 类映射
  const TAB_TO_TYPE: Record<string, string[]> = {
    '遥感影像': ['遥感影像'],
    '数字高程': ['数字高程'],
    '倾斜摄影': ['倾斜摄影'],
    '气象水文': ['气象水文'],
    '地下管网': ['地下管网'],
    '矢量基础': ['矢量基础'],
    '地名地址': ['地名地址'],
    '战场专题': ['战场专题'],
    '障碍物与目标': ['障碍物与目标'],
    '多模态语料': ['多模态语料'],
    '历史方案': ['历史方案']
  };

  if (activeTab.value && activeTab.value !== '总览') {
    const types = TAB_TO_TYPE[activeTab.value];
    if (types) {
      filtered = filtered.filter(item => types.includes(item.type));
    }
  }

  if (selectedCategory.value) {
    const TYPE_TO_CATEGORY: Record<string, string[]> = {
      '遥感影像': ['img', 'img-optical', 'img-sar', 'img-aerial', 'img-multi'],
      '数字高程': ['dem', 'dem-dem', 'dem-dsm', 'dem-derived'],
      '倾斜摄影': ['oblique', 'oblique-city', 'oblique-single', 'oblique-3dtiles'],
      '气象水文': ['hydro', 'hydro-rain', 'hydro-river', 'hydro-lake', 'hydro-station'],
      '地下管网': ['pipe', 'pipe-water', 'pipe-other', 'pipe-elec'],
      '矢量基础': ['vec', 'vec-dlg', 'vec-building', 'vec-traffic', 'vec-admin', 'vec-landuse'],
      '地名地址': ['poi', 'poi-strategic', 'poi-target', 'poi-facility'],
      '战场专题': ['battlefield', 'bf-climate', 'bf-geology', 'bf-em', 'bf-pop'],
      '障碍物与目标': ['obstacle', 'obs-urban', 'obs-traffic', 'obs-defense'],
      '多模态语料': ['corpus', 'corpus-text', 'corpus-image', 'corpus-media'],
      '历史方案': ['plan', 'plan-river', 'plan-route', 'plan-building']
    };
    filtered = filtered.filter(item => {
      const cats = TYPE_TO_CATEGORY[item.type];
      return cats ? cats.includes(selectedCategory.value!) : false;
    });
  }

  if (selectedAgent.value) {
    filtered = filtered.filter(item => item.agentBinding?.includes(selectedAgent.value as AgentKey));
  }

  if (selectedScenario.value) {
    filtered = filtered.filter(item => item.scenarioTags?.includes(selectedScenario.value as any));
  }

  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase();
    filtered = filtered.filter(
      item =>
        item.name.toLowerCase().includes(keyword) ||
        item.range.toLowerCase().includes(keyword) ||
        item.source.toLowerCase().includes(keyword) ||
        item.tags?.some(t => t.toLowerCase().includes(keyword)) ||
        item.agentBinding?.some(a => agentLabelMap[a]?.toLowerCase().includes(keyword)) ||
        item.scenarioTags?.some(s => s.toLowerCase().includes(keyword))
    );
  }

  if (selectedType.value) {
    filtered = filtered.filter(item => item.type === selectedType.value);
  }
  return filtered;
});

const totalPages = computed(() => Math.max(1, Math.ceil(filteredData.value.length / pageSize.value)));
const pageItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredData.value.slice(start, start + pageSize.value);
});

const summaryMetrics = computed(() => {
  const total = dataList.value.length;
  const published = dataList.value.filter(item => item.status === 'published').length;
  const draft = dataList.value.filter(item => item.status === 'draft').length;
  const totalSize = dataList.value.reduce((sum, item) => sum + normalizeSize(item.size), 0);
  return {
    total,
    published,
    draft,
    totalSize: `${totalSize.toFixed(2)} GB`
  };
});

watch(filteredData, () => {
  if (currentPage.value !== 1) {
    currentPage.value = 1;
  }
});

watch(pageSize, () => {
  if (currentPage.value > totalPages.value) {
    currentPage.value = totalPages.value;
  }
});

type CatalogActionKey = 'publish' | 'download' | 'delete' | 'refresh' | 'detail';

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
  { key: 'refresh', label: '更新', icon: 'mdi:refresh' },
  { key: 'detail', label: '详情', icon: 'mdi:information-outline' }
];

// ====== NDataTable columns ======
const columns = computed<DataTableColumns<CatalogItem>>(() => [
  {
    title: '数据名称',
    key: 'name',
    width: 260,
    render(row) {
      return h('div', { class: 'dataset-cell' }, [
        h(SvgIcon, { icon: 'mdi:database', class: 'dataset-cell__bullet' }),
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
    width: 120,
    render(row) {
      return h('span', { class: 'row-text row-text--muted' }, row.ingestTime);
    }
  },
  {
    title: '数据类型',
    key: 'type',
    width: 100,
    render(row) {
      return h('span', { class: `type-chip ${getTypeTagClass(row.type)}` }, row.type);
    }
  },
  {
    title: '空间范围',
    key: 'range',
    width: 120,
    render(row) {
      return h('span', { class: 'row-text' }, row.range);
    }
  },
  {
    title: '数据来源',
    key: 'source',
    width: 100,
    render(row) {
      return h('span', { class: 'row-text' }, row.source);
    }
  },
  {
    title: '数据大小',
    key: 'size',
    width: 90,
    render(row) {
      return h('span', { class: 'row-text row-text--mono' }, row.size);
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 180,
    fixed: 'right',
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
            'data-tooltip': '更新',
            onClick: () => handleAction('refresh', row)
          },
          [h(SvgIcon, { icon: 'mdi:refresh', class: 'action-icon-btn__svg' })]
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
        )
      ]);
    }
  }
]);

// ====== NDataTable theme overrides ======
const dataTableThemeOverrides = {
  thColor: 'rgba(6, 29, 56, 0.94)',
  thColorHover: 'rgba(10, 38, 72, 0.96)',
  tdColor: 'transparent',
  tdColorHover: 'rgba(33, 116, 212, 0.14)',
  borderColor: 'rgba(25, 95, 176, 0.35)',
  thTextColor: 'rgba(203, 227, 255, 0.72)',
  tdTextColor: 'rgba(203, 227, 255, 0.72)',
  borderRadius: '4px',
  fontSize: '12px',
  thFontWeight: '600'
};

function normalizeSize(size: string) {
  const value = parseFloat(size);
  if (size.toUpperCase().includes('MB')) return value / 1024;
  return value;
}

function getDataTypeIcon(type: string): string {
  const iconMap: Record<string, string> = {
    '遥感影像': 'mdi:database',
    '数字高程': 'mdi:terrain',
    '倾斜摄影': 'mdi:layers-triple',
    '气象水文': 'mdi:weather-rainy',
    '地下管网': 'mdi:transit-connection-horizontal',
    '矢量基础': 'mdi:vector-polyline',
    '地名地址': 'mdi:map-marker-outline',
    '战场专题': 'mdi:shield-outline',
    '障碍物与目标': 'mdi:alert-octagon-outline',
    '多模态语料': 'mdi:file-document-multiple-outline',
    '历史方案': 'mdi:history'
  };
  return iconMap[type] || 'mdi:file-document-outline';
}

function getTypeTagClass(type: string) {
  const typeClassMap: Record<string, string> = {
    '遥感影像': 'type-chip--image',
    '数字高程': 'type-chip--elevation',
    '倾斜摄影': 'type-chip--oblique',
    '气象水文': 'type-chip--hydro',
    '地下管网': 'type-chip--pipe',
    '矢量基础': 'type-chip--vector',
    '地名地址': 'type-chip--poi',
    '战场专题': 'type-chip--battlefield',
    '障碍物与目标': 'type-chip--obstacle',
    '多模态语料': 'type-chip--corpus',
    '历史方案': 'type-chip--plan'
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

function handleCategorySelect(keys: string[]) {
  selectedCategory.value = keys.length > 0 ? keys[0] : null;
  currentPage.value = 1;
}

function togglePublish(item: CatalogItem) {
  const idx = dataList.value.findIndex(d => d.id === item.id);
  if (idx !== -1) {
    if (dataList.value[idx].status === 'published') {
      dataList.value[idx].status = 'offline';
      window.$message?.warning(`${item.name} 已下线`);
    } else {
      dataList.value[idx].status = 'published';
      window.$message?.success(`${item.name} 已发布`);
    }
  }
}

function handleDelete(item: CatalogItem) {
  window.$dialog?.warning({
    title: '确认删除',
    content: `确定要删除数据「${item.name}」吗？此操作不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => {
      const idx = dataList.value.findIndex(d => d.id === item.id);
      if (idx !== -1) {
        dataList.value.splice(idx, 1);
        window.$message?.success('删除成功');
      }
    }
  });
}

function showImport() {
  window.$message?.info('数据入库功能开发中...');
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
      window.$message?.success(`开始下载：${item.name}`);
      break;
    case 'delete':
      handleDelete(item);
      break;
    case 'refresh':
      window.$message?.info(`已触发更新：${item.name}`);
      break;
    case 'detail':
      detailItem.value = item;
      detailVisible.value = true;
      break;
    default:
      break;
  }
}

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
              <span>共 {{ filteredData.length }} 条结果</span>
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
                single-line
                flex-height
                class="catalog-data-table"
              />

              <div class="catalog-mobile-list">
                <div v-for="item in pageItems" :key="`mobile-${item.id}`" class="catalog-mobile-card">
                  <div class="catalog-mobile-card__head">
                    <div class="dataset-cell">
                      <SvgIcon :icon="getDataTypeIcon(item.type)" class="dataset-cell__bullet" />
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
                  共 {{ filteredData.length }} 条
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
                  :item-count="filteredData.length"
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

          <!-- 数据质量 -->
          <div v-if="detailItem.quality" class="detail-section">
            <div class="detail-section__title">
              <SvgIcon icon="mdi:shield-check-outline" class="detail-section__icon" />
              数据质量
            </div>
            <div class="detail-grid">
              <div class="detail-field">
                <span class="detail-field__label">综合评分</span>
                <span class="detail-field__value">
                  {{ detailItem.quality.score }} 分
                  <span class="detail-grade" :class="`detail-grade--${detailItem.quality.grade}`">{{ detailItem.quality.grade }}</span>
                </span>
              </div>
              <div class="detail-field">
                <span class="detail-field__label">完整性</span>
                <span class="detail-field__value">{{ detailItem.quality.completeness }}%</span>
              </div>
              <div class="detail-field">
                <span class="detail-field__label">时效性</span>
                <span class="detail-field__value">{{ detailItem.quality.timeliness }}%</span>
              </div>
              <div class="detail-field">
                <span class="detail-field__label">精度</span>
                <span class="detail-field__value">{{ detailItem.quality.accuracy }}%</span>
              </div>
            </div>
          </div>

          <!-- 智能体关联 & 场景标签 -->
          <div v-if="detailItem.agentBinding?.length || detailItem.scenarioTags?.length" class="detail-section">
            <div class="detail-section__title">
              <SvgIcon icon="mdi:robot-outline" class="detail-section__icon" />
              智能体与场景
            </div>
            <div class="detail-grid">
              <div v-if="detailItem.agentBinding?.length" class="detail-field detail-field--full">
                <span class="detail-field__label">可调用智能体</span>
                <div class="detail-tags">
                  <span v-for="a in detailItem.agentBinding" :key="a" class="detail-tag detail-tag--agent">{{ agentLabelMap[a] || a }}</span>
                </div>
              </div>
              <div v-if="detailItem.scenarioTags?.length" class="detail-field detail-field--full">
                <span class="detail-field__label">任务场景</span>
                <div class="detail-tags">
                  <span v-for="s in detailItem.scenarioTags" :key="s" class="detail-tag detail-tag--scenario">{{ s }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 瓦片/服务状态 -->
          <div v-if="detailItem.tileStatus" class="detail-section">
            <div class="detail-section__title">
              <SvgIcon icon="mdi:server-network-outline" class="detail-section__icon" />
              瓦片与服务
            </div>
            <div class="detail-grid">
              <div class="detail-field">
                <span class="detail-field__label">已切片</span>
                <span class="detail-field__value">{{ detailItem.tileStatus.tiled ? '是' : '否' }}</span>
              </div>
              <div class="detail-field">
                <span class="detail-field__label">支持协议</span>
                <span class="detail-field__value">{{ detailItem.tileStatus.protocols.join(', ') || '—' }}</span>
              </div>
              <div v-if="detailItem.tileStatus.serviceUrl" class="detail-field detail-field--full">
                <span class="detail-field__label">服务地址</span>
                <span class="detail-field__value detail-field__value--mono">{{ detailItem.tileStatus.serviceUrl }}</span>
              </div>
            </div>
          </div>

          <!-- 数据血缘 -->
          <div v-if="detailItem.lineage" class="detail-section">
            <div class="detail-section__title">
              <SvgIcon icon="mdi:source-branch" class="detail-section__icon" />
              数据血缘
            </div>
            <div class="detail-grid">
              <div class="detail-field">
                <span class="detail-field__label">数据源</span>
                <span class="detail-field__value">{{ detailItem.lineage.source }}</span>
              </div>
              <div class="detail-field">
                <span class="detail-field__label">版本</span>
                <span class="detail-field__value detail-field__value--mono">{{ detailItem.lineage.version }}</span>
              </div>
              <div v-if="detailItem.lineage.processedSteps?.length" class="detail-field detail-field--full">
                <span class="detail-field__label">整编步骤</span>
                <div class="detail-steps">
                  <span v-for="(step, idx) in detailItem.lineage.processedSteps" :key="idx" class="detail-step">
                    <span class="detail-step__num">{{ idx + 1 }}</span>{{ step }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 审核状态 -->
          <div v-if="detailItem.audit" class="detail-section">
            <div class="detail-section__title">
              <SvgIcon icon="mdi:check-decagram-outline" class="detail-section__icon" />
              审核状态
            </div>
            <div class="detail-grid">
              <div class="detail-field">
                <span class="detail-field__label">审核人</span>
                <span class="detail-field__value">{{ detailItem.audit.auditor }}</span>
              </div>
              <div class="detail-field">
                <span class="detail-field__label">审核时间</span>
                <span class="detail-field__value">{{ detailItem.audit.auditTime }}</span>
              </div>
              <div class="detail-field">
                <span class="detail-field__label">审核结果</span>
                <span class="detail-field__value">
                  <span class="detail-audit-badge" :class="`detail-audit-badge--${detailItem.audit.status}`">
                    {{ detailItem.audit.status === 'approved' ? '已通过' : detailItem.audit.status === 'pending' ? '待审核' : '已驳回' }}
                  </span>
                </span>
              </div>
              <div v-if="detailItem.audit.comments" class="detail-field detail-field--full">
                <span class="detail-field__label">审核意见</span>
                <span class="detail-field__value">{{ detailItem.audit.comments }}</span>
              </div>
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
                <span class="detail-field__value detail-field__value--mono">{{ detailItem.finetuneStatus.sampleCount?.toLocaleString() || '—' }}</span>
              </div>
              <div class="detail-field">
                <span class="detail-field__label">标注完成度</span>
                <span class="detail-field__value">{{ detailItem.finetuneStatus.annotationComplete ?? '—' }}%</span>
              </div>
              <div v-if="detailItem.finetuneStatus.taskTypes?.length" class="detail-field detail-field--full">
                <span class="detail-field__label">适用任务</span>
                <div class="detail-tags">
                  <span v-for="t in detailItem.finetuneStatus.taskTypes" :key="t" class="detail-tag detail-tag--finetune">{{ t }}</span>
                </div>
              </div>
              <div v-if="detailItem.finetuneStatus.modelVersion" class="detail-field detail-field--full">
                <span class="detail-field__label">模型版本</span>
                <span class="detail-field__value detail-field__value--mono">{{ detailItem.finetuneStatus.modelVersion }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
.catalog-page {
  --catalog-page-bg:
    radial-gradient(circle at top, rgba(0, 153, 255, 0.14) 0%, rgba(0, 0, 0, 0) 36%),
    linear-gradient(180deg, #041528 0%, #041120 38%, #03101b 100%);
  --catalog-surface-bg: linear-gradient(180deg, rgba(3, 19, 41, 0.94) 0%, rgba(2, 15, 32, 0.96) 100%);
  --catalog-surface-border: rgba(43, 131, 255, 0.28);
  --catalog-strong-border: rgba(38, 142, 255, 0.4);
  --catalog-line: rgba(25, 95, 176, 0.35);
  --catalog-text-primary: #eaf5ff;
  --catalog-text-secondary: rgba(203, 227, 255, 0.72);
  --catalog-text-tertiary: rgba(147, 196, 255, 0.62);
  --catalog-input-bg: rgba(2, 18, 36, 0.92);
  --catalog-input-border: rgba(35, 111, 196, 0.4);
  --catalog-glow: 0 0 0 1px rgba(32, 111, 202, 0.22), 0 18px 40px rgba(1, 8, 18, 0.45);
  --catalog-button-bg: linear-gradient(180deg, #0d5fc8 0%, #093f8a 100%);
  --catalog-button-border: rgba(96, 191, 255, 0.32);
  --catalog-accent: #29a3ff;
  --catalog-danger: #ff6b6b;
  height: 100%;
  background: var(--catalog-page-bg);
  color: var(--catalog-text-primary);
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
  background: linear-gradient(180deg, rgba(10, 38, 72, 0.96) 0%, rgba(5, 25, 47, 0.96) 100%);
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
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-shadow: 0 0 8px rgba(41, 163, 255, 0.12);
}

.catalog-sidebar__panel {
  flex: 1;
  min-height: 0;
  padding: 8px;
  overflow: auto;
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
    linear-gradient(180deg, rgba(7, 31, 58, 0.98) 0%, rgba(4, 21, 41, 0.98) 100%),
    linear-gradient(90deg, rgba(22, 116, 214, 0.12) 0%, rgba(0, 0, 0, 0) 34%);
  position: relative;
}

.catalog-topbar::after {
  content: '';
  position: absolute;
  inset: auto 16px 0;
  height: 1px;
  background: linear-gradient(90deg, rgba(57, 171, 255, 0.22) 0%, rgba(57, 171, 255, 0.04) 100%);
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
  border: 1px solid rgba(58, 145, 231, 0.18);
  background: linear-gradient(180deg, rgba(8, 42, 82, 0.82) 0%, rgba(5, 24, 48, 0.88) 100%);
  color: rgba(203, 227, 255, 0.76);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  box-shadow: inset 0 1px 0 rgba(129, 211, 255, 0.08);
  user-select: none;
}

.catalog-search-panel__label-icon {
  font-size: 15px;
  color: #7cc4f0;
  opacity: 0.8;
}

/* ──── Search Input (NInput override) ──── */
.catalog-search-input {
  width: min(400px, 100%);
  min-width: 280px;
}

.catalog-search-input :deep(.n-input) {
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
  font-family: 'Microsoft YaHei', 'PingFang SC', 'HarmonyOS Sans SC', 'Segoe UI', sans-serif;
  letter-spacing: 0.2px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: linear-gradient(180deg, rgba(2, 16, 31, 0.98) 0%, rgba(1, 12, 24, 0.98) 100%);
  position: relative;
}

.catalog-search-input :deep(.n-input:hover) {
  box-shadow: inset 0 1px 0 rgba(136, 214, 255, 0.04), 0 2px 8px rgba(0, 0, 0, 0.25);
  border-color: rgba(58, 160, 255, 0.5) !important;
}

.catalog-search-input :deep(.n-input--focus) {
  box-shadow: 0 0 0 2px rgba(41, 163, 255, 0.12), 0 4px 12px rgba(0, 0, 0, 0.3);
  background: linear-gradient(180deg, rgba(3, 20, 38, 0.98) 0%, rgba(2, 16, 31, 0.98) 100%);
}

/* Hide default NInput border/state-border for cleaner look */
.catalog-search-input :deep(.n-input__border),
.catalog-search-input :deep(.n-input__state-border) {
  display: none;
}

/* Enhanced placeholder animation */
.catalog-search-input :deep(.n-input__placeholder) {
  transition: color 0.3s ease, transform 0.3s ease;
}

.catalog-search-input :deep(.n-input--focus .n-input__placeholder) {
  color: rgba(132, 177, 233, 0.6) !important;
  transform: translateX(2px);
}

.catalog-search-input__icon {
  font-size: 18px;
  color: #7cc4f0;
  opacity: 0.7;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.catalog-search-input :deep(.n-input--focus) .catalog-search-input__icon {
  opacity: 1;
  color: #5ea4ff;
  transform: scale(1.1);
}

/* Subtle glow effect on focus */
.catalog-search-input :deep(.n-input--focus)::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 9px;
  background: linear-gradient(135deg, rgba(41, 163, 255, 0.1) 0%, rgba(41, 163, 255, 0.05) 100%);
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
  --n-color: linear-gradient(180deg, #1783f0 0%, #0853ab 100%) !important;
  --n-color-hover: linear-gradient(180deg, #2b93ff 0%, #0d6ad6 100%) !important;
  --n-color-pressed: linear-gradient(180deg, #0d6ad6 0%, #064a94 100%) !important;
  --n-text-color: #fff !important;
  --n-text-color-hover: #fff !important;
  --n-text-color-pressed: rgba(255, 255, 255, 0.85) !important;
  --n-border: none !important;
  --n-border-radius: 6px !important;
  --n-font-size: 12px !important;
  --n-height: 28px !important;
  --n-padding: 0 14px !important;
  --n-icon-size: 14px !important;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
  letter-spacing: 0.3px;
  box-shadow: inset 0 1px 0 rgba(181, 233, 255, 0.18), 0 2px 8px rgba(12, 110, 206, 0.25);
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
  box-shadow: inset 0 1px 0 rgba(181, 233, 255, 0.25), 0 4px 16px rgba(12, 110, 206, 0.35);
  transform: translateY(-2px);
}

.catalog-search-btn:hover::before {
  left: 100%;
}

.catalog-search-btn:active {
  transform: translateY(0);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2), 0 1px 4px rgba(12, 110, 206, 0.2);
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
  box-shadow: inset 0 1px 0 rgba(181, 233, 255, 0.14), 0 4px 16px rgba(4, 79, 162, 0.22);
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
  box-shadow: inset 0 1px 0 rgba(181, 233, 255, 0.22), 0 6px 24px rgba(4, 79, 162, 0.35);
  transform: translateY(-2px);
}

.catalog-primary-btn:hover::before {
  left: 100%;
}

.catalog-primary-btn:active {
  transform: translateY(0);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(4, 79, 162, 0.2);
  transition: all 0.1s ease;
}

/* Focus state for accessibility */
.catalog-primary-btn:focus-visible {
  outline: 2px solid rgba(41, 163, 255, 0.6);
  outline-offset: 2px;
}

.catalog-ghost-btn {
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

.catalog-ghost-btn:hover {
  box-shadow: inset 0 1px 0 rgba(129, 211, 255, 0.08), 0 4px 12px rgba(0, 0, 0, 0.25);
  transform: translateY(-2px);
  border-color: rgba(58, 160, 255, 0.5) !important;
}

.catalog-ghost-btn:active {
  transform: translateY(0);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.15);
  transition: all 0.1s ease;
}

/* Focus state for accessibility */
.catalog-ghost-btn:focus-visible {
  outline: 2px solid rgba(41, 163, 255, 0.6);
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
  background: linear-gradient(180deg, rgba(9, 43, 82, 0.96) 0%, rgba(4, 22, 43, 0.96) 100%);
  border: 1px solid rgba(46, 130, 223, 0.24);
  box-shadow: inset 0 1px 0 rgba(152, 219, 255, 0.06), 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.catalog-filter-card:hover {
  border-color: rgba(58, 160, 255, 0.4);
  box-shadow: inset 0 1px 0 rgba(152, 219, 255, 0.1), 0 4px 12px rgba(0, 0, 0, 0.3);
  transform: translateY(-1px);
}

.catalog-filter-card__glow {
  position: absolute;
  inset: 1px;
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(90deg, rgba(43, 163, 255, 0.08) 0%, rgba(0, 0, 0, 0) 55%);
}

.catalog-filter {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 168px;
  height: 34px;
  padding: 0 10px;
  border-radius: 6px;
}

.catalog-filter__label {
  font-size: 12px;
  font-weight: 600;
  color: rgba(205, 229, 255, 0.72);
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
  background: linear-gradient(180deg, rgba(7, 27, 51, 0.94) 0%, rgba(4, 20, 40, 0.96) 100%);
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
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-shadow: 0 0 8px rgba(41, 163, 255, 0.1);
}

.catalog-card-head__meta {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  color: var(--catalog-text-tertiary);
  font-size: 12px;
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
}

/* ====== NDataTable deep overrides ====== */
.catalog-data-table {
  flex: 1;
  --n-th-color: rgba(6, 29, 56, 0.94) !important;
  --n-td-color: transparent !important;
  --n-td-color-hover: rgba(33, 116, 212, 0.14) !important;
  --n-border-color: rgba(25, 95, 176, 0.35) !important;
  --n-th-text-color: rgba(203, 227, 255, 0.72) !important;
  --n-td-text-color: rgba(203, 227, 255, 0.72) !important;
  --n-th-font-weight: 600 !important;
  --n-font-size: 12px !important;
}

.catalog-data-table :deep(.n-data-table-th) {
  background: linear-gradient(180deg, rgba(6, 29, 56, 0.94) 0%, rgba(4, 22, 43, 0.94) 100%) !important;
  font-size: 12px;
  padding: 14px 12px;
}

.catalog-data-table :deep(.n-data-table-td) {
  padding: 14px 12px;
  border-bottom: 1px solid rgba(18, 73, 135, 0.32) !important;
}

.catalog-data-table :deep(.n-data-table-tr:hover .n-data-table-td) {
  background: rgba(33, 116, 212, 0.14) !important;
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

.dataset-cell__bullet {
  flex-shrink: 0;
  font-size: 18px;
  color: #62c4ff;
  filter: drop-shadow(0 0 4px rgba(98, 196, 255, 0.25));
}

.dataset-cell__content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.dataset-cell__title {
  color: var(--catalog-text-primary);
  font-size: 13px;
  line-height: 1.4;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dataset-cell__sub {
  color: var(--catalog-text-tertiary);
  font-size: 11px;
}

.row-text {
  color: var(--catalog-text-secondary);
  font-size: 12px;
}

.row-text--muted {
  color: rgba(160, 198, 241, 0.74);
}

.row-text--mono {
  font-family: 'DIN', 'Consolas', monospace;
}

.type-chip {
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

.type-chip--image {
  background: rgba(73, 105, 255, 0.22);
  border-color: rgba(97, 127, 255, 0.32);
  color: #b1c0ff;
}

.type-chip--oblique {
  background: rgba(70, 105, 216, 0.22);
  border-color: rgba(70, 140, 255, 0.34);
  color: #98c5ff;
}

.type-chip--elevation {
  background: rgba(111, 175, 57, 0.22);
  border-color: rgba(121, 203, 61, 0.36);
  color: #d2ff9e;
}

.type-chip--hydro {
  background: rgba(19, 141, 170, 0.22);
  border-color: rgba(47, 191, 223, 0.34);
  color: #8deaff;
}

.type-chip--pipe {
  background: rgba(183, 122, 17, 0.22);
  border-color: rgba(255, 176, 52, 0.36);
  color: #ffd586;
}

.type-chip--topic,
.type-chip--default {
  background: rgba(150, 69, 18, 0.22);
  border-color: rgba(255, 132, 72, 0.34);
  color: #ffb087;
}

/* Actions — icon-only circle buttons (inside NDataTable, use :deep) */
.catalog-data-table :deep(.action-group) {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
}

.catalog-data-table :deep(.action-icon-btn) {
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

.catalog-data-table :deep(.action-icon-btn:hover) {
  color: #fff;
  background: rgba(41, 163, 255, 0.18);
  border-color: rgba(41, 163, 255, 0.35);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(41, 163, 255, 0.2);
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
  background: rgba(6, 29, 56, 0.95);
  border: 1px solid rgba(41, 163, 255, 0.25);
  color: rgba(203, 227, 255, 0.9);
  font-size: 11px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease, transform 0.2s ease;
  z-index: 10;
}

.catalog-data-table :deep(.action-icon-btn:hover::after) {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.catalog-data-table :deep(.action-icon-btn__svg) {
  font-size: 15px;
  transition: transform 0.25s ease;
}

.catalog-data-table :deep(.action-icon-btn:hover .action-icon-btn__svg) {
  transform: scale(1.18);
}

/* Danger variant */
.catalog-data-table :deep(.action-icon-btn--danger) {
  background: rgba(255, 107, 107, 0.05);
  border-color: rgba(255, 107, 107, 0.12);
  color: rgba(255, 141, 141, 0.7);
}

.catalog-data-table :deep(.action-icon-btn--danger:hover) {
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.15);
  border-color: rgba(255, 107, 107, 0.35);
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.18);
}

.catalog-data-table :deep(.action-icon-btn--danger:hover::after) {
  border-color: rgba(255, 107, 107, 0.25);
}

.catalog-footer {
  min-height: 48px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid var(--catalog-line);
  background: linear-gradient(180deg, rgba(4, 21, 41, 0.98) 0%, rgba(4, 18, 34, 0.98) 100%);
}

.catalog-footer__summary {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--catalog-text-secondary);
  font-size: 12px;
}

.catalog-footer__divider {
  width: 1px;
  height: 10px;
  background: linear-gradient(180deg, transparent, rgba(70, 122, 190, 0.45), transparent);
}

/* NPagination deep overrides */
.catalog-footer :deep(.n-pagination) {
  --n-item-text-color: rgba(203, 227, 255, 0.72) !important;
  --n-item-text-color-hover: #fff !important;
  --n-item-text-color-active: #fff !important;
  --n-item-color-active: linear-gradient(180deg, rgba(17, 100, 206, 0.64) 0%, rgba(8, 66, 138, 0.64) 100%) !important;
  --n-item-border-active: 1px solid rgba(70, 176, 255, 0.5) !important;
  --n-item-color: rgba(6, 25, 50, 0.82) !important;
  --n-item-border: 1px solid rgba(45, 111, 183, 0.34) !important;
  --n-item-border-hover: 1px solid rgba(70, 176, 255, 0.4) !important;
  --n-item-color-hover: rgba(10, 40, 80, 0.9) !important;
  --n-item-border-radius: 3px !important;
  font-size: 12px;
}

.catalog-footer :deep(.n-pagination .n-pagination-item) {
  min-width: 28px;
  height: 28px;
  border-radius: 3px;
}

.catalog-footer :deep(.n-pagination .n-pagination-item--active) {
  box-shadow: 0 0 6px rgba(41, 163, 255, 0.2);
}

.catalog-footer :deep(.n-pagination-size-picker .n-base-selection) {
  --n-border: 1px solid rgba(45, 111, 183, 0.34) !important;
  --n-border-hover: 1px solid rgba(70, 176, 255, 0.4) !important;
  --n-border-active: 1px solid rgba(70, 176, 255, 0.5) !important;
  --n-color: rgba(6, 25, 50, 0.82) !important;
  --n-color-active: rgba(6, 25, 50, 0.82) !important;
  --n-text-color: rgba(203, 227, 255, 0.72) !important;
  height: 28px;
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

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--catalog-line);
  background: linear-gradient(180deg, rgba(8, 36, 68, 0.96) 0%, rgba(4, 22, 46, 0.96) 100%);
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
  color: #62c4ff;
  filter: drop-shadow(0 0 8px rgba(98, 196, 255, 0.3));
  margin-top: 2px;
}

.detail-header__text {
  min-width: 0;
}

.detail-header__title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.3px;
  color: var(--catalog-text-primary);
  line-height: 1.4;
  text-shadow: 0 0 10px rgba(41, 163, 255, 0.12);
}

.detail-header__badges {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.detail-status-tag {
  font-size: 11px !important;
  padding: 0 8px !important;
  height: 22px !important;
  line-height: 22px !important;
}

.detail-close-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(45, 111, 183, 0.28);
  border-radius: 6px;
  background: rgba(6, 25, 50, 0.6);
  color: var(--catalog-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 18px;
}

.detail-close-btn:hover {
  color: var(--catalog-accent);
  border-color: rgba(70, 176, 255, 0.4);
  background: rgba(41, 163, 255, 0.08);
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
  background: rgba(48, 127, 212, 0.45);
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
  font-size: 13px;
  font-weight: 600;
  color: var(--catalog-accent);
  letter-spacing: 0.3px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(25, 95, 176, 0.22);
}

.detail-section__icon {
  font-size: 16px;
  opacity: 0.85;
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
  font-size: 11px;
  color: var(--catalog-text-tertiary);
  letter-spacing: 0.2px;
}

.detail-field__value {
  font-size: 13px;
  color: var(--catalog-text-primary);
  line-height: 1.5;
  word-break: break-all;
}

.detail-field__value--small {
  font-size: 12px;
}

.detail-field__value--mono {
  font-family: 'DIN', 'Consolas', monospace;
  font-size: 12px;
  color: rgba(234, 245, 255, 0.88);
  letter-spacing: 0.4px;
}

.detail-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  color: var(--catalog-text-secondary);
  padding: 12px 14px;
  border-radius: 6px;
  background: rgba(2, 14, 30, 0.6);
  border: 1px solid rgba(25, 95, 176, 0.18);
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-tag {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 12px;
  border-radius: 4px;
  font-size: 12px;
  background: rgba(41, 163, 255, 0.1);
  border: 1px solid rgba(41, 163, 255, 0.22);
  color: rgba(203, 227, 255, 0.82);
  transition: all 0.2s ease;
}

.detail-tag:hover {
  background: rgba(41, 163, 255, 0.16);
  border-color: rgba(41, 163, 255, 0.36);
  color: #eaf5ff;
}

.detail-tag--agent {
  background: rgba(139, 92, 246, 0.12);
  border-color: rgba(139, 92, 246, 0.28);
  color: rgba(196, 181, 253, 0.9);
}

.detail-tag--scenario {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.25);
  color: rgba(167, 243, 208, 0.9);
}

.detail-tag--finetune {
  background: rgba(251, 191, 36, 0.1);
  border-color: rgba(251, 191, 36, 0.25);
  color: rgba(253, 230, 138, 0.9);
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

.detail-grade--A { background: rgba(16, 185, 129, 0.2); color: #34d399; }
.detail-grade--B { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
.detail-grade--C { background: rgba(251, 191, 36, 0.2); color: #fbbf24; }
.detail-grade--D { background: rgba(239, 68, 68, 0.2); color: #f87171; }

.detail-audit-badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.detail-audit-badge--approved { background: rgba(16, 185, 129, 0.15); color: #34d399; }
.detail-audit-badge--pending { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
.detail-audit-badge--rejected { background: rgba(239, 68, 68, 0.15); color: #f87171; }

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
  background: rgba(41, 163, 255, 0.08);
  border: 1px solid rgba(41, 163, 255, 0.15);
  color: rgba(203, 227, 255, 0.8);
}

.detail-step__num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(41, 163, 255, 0.2);
  color: #60a5fa;
  font-size: 10px;
  font-weight: 700;
}

/* New type-chip variants */
.type-chip--vector { background: rgba(99, 102, 241, 0.12); border-color: rgba(99, 102, 241, 0.3); color: rgba(165, 180, 252, 0.9); }
.type-chip--poi { background: rgba(236, 72, 153, 0.12); border-color: rgba(236, 72, 153, 0.3); color: rgba(244, 114, 182, 0.9); }
.type-chip--battlefield { background: rgba(239, 68, 68, 0.12); border-color: rgba(239, 68, 68, 0.3); color: rgba(248, 113, 113, 0.9); }
.type-chip--obstacle { background: rgba(245, 158, 11, 0.12); border-color: rgba(245, 158, 11, 0.3); color: rgba(251, 191, 36, 0.9); }
.type-chip--corpus { background: rgba(20, 184, 166, 0.12); border-color: rgba(20, 184, 166, 0.3); color: rgba(94, 234, 212, 0.9); }
.type-chip--plan { background: rgba(168, 85, 247, 0.12); border-color: rgba(168, 85, 247, 0.3); color: rgba(192, 132, 252, 0.9); }

:deep(.n-tree-node-content) {
  height: 36px;
  padding-left: 4px;
  border-radius: 6px;
  color: var(--catalog-text-secondary);
  border: 1px solid transparent;
}

:deep(.n-tree-node-content:hover) {
  background: linear-gradient(90deg, rgba(17, 79, 153, 0.16) 0%, rgba(8, 37, 74, 0.16) 100%);
  border-color: rgba(47, 133, 225, 0.22);
}

:deep(.n-tree-node--selected > .n-tree-node-content) {
  background: linear-gradient(90deg, rgba(19, 95, 182, 0.38) 0%, rgba(9, 46, 92, 0.16) 100%);
  color: #fff;
  border-color: rgba(61, 166, 255, 0.28);
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
  font-size: 13px;
}

:deep(.catalog-filter__select .n-base-selection) {
  height: 30px;
  border-radius: 6px;
  background: rgba(2, 18, 36, 0.5);
  border-color: rgba(54, 132, 212, 0.12);
  box-shadow: none;
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
  background: rgba(48, 127, 212, 0.58);
}

.catalog-sidebar__panel::-webkit-scrollbar-track,
.catalog-data-table :deep(.n-data-table-base-table-body::-webkit-scrollbar-track) {
  background: rgba(4, 20, 40, 0.45);
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
    border: 1px solid rgba(33, 111, 195, 0.28);
    border-radius: 6px;
    background: linear-gradient(180deg, rgba(5, 24, 46, 0.98) 0%, rgba(3, 18, 34, 0.98) 100%);
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
    font-size: 12px;
    color: var(--catalog-text-secondary);
  }

  .catalog-mobile-card__grid span {
    color: var(--catalog-text-tertiary);
    font-size: 11px;
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

  .action-icon-btn:hover {
    color: #fff;
    background: rgba(41, 163, 255, 0.18);
    border-color: rgba(41, 163, 255, 0.35);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(41, 163, 255, 0.2);
  }

  .action-icon-btn::after {
    content: attr(data-tooltip);
    position: absolute;
    top: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%) translateY(-4px);
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(6, 29, 56, 0.95);
    border: 1px solid rgba(41, 163, 255, 0.25);
    color: rgba(203, 227, 255, 0.9);
    font-size: 11px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease, transform 0.2s ease;
    z-index: 10;
  }

  .action-icon-btn:hover::after {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }

  .action-icon-btn__svg {
    font-size: 15px;
    transition: transform 0.25s ease;
  }

  .action-icon-btn:hover .action-icon-btn__svg {
    transform: scale(1.18);
  }

  .action-icon-btn--danger {
    background: rgba(255, 107, 107, 0.05);
    border-color: rgba(255, 107, 107, 0.12);
    color: rgba(255, 141, 141, 0.7);
  }

  .action-icon-btn--danger:hover {
    color: #ff6b6b;
    background: rgba(255, 107, 107, 0.15);
    border-color: rgba(255, 107, 107, 0.35);
    box-shadow: 0 4px 12px rgba(255, 107, 107, 0.18);
  }

  .action-icon-btn--danger:hover::after {
    border-color: rgba(255, 107, 107, 0.25);
  }

  .catalog-footer__summary {
    flex-wrap: wrap;
  }
}
</style>
