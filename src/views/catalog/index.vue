<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { SelectOption } from 'naive-ui';
import { NSelect, NTree } from 'naive-ui';
import { useThemeStore } from '@/store/modules/theme';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { catalogCategories, catalogData, type CatalogItem } from '@/mock/catalog';

defineOptions({
  name: 'CatalogPage'
});

const activeTab = ref('总览');
const selectedCategory = ref<string | null>(null);
const searchKeyword = ref('');
const selectedType = ref('');
const isLoading = ref(false);
const expandedKeys = ref<string[]>(['img', 'dem', 'oblique', 'hydro', 'pipe']);
const dataList = ref<CatalogItem[]>([...catalogData]);
const themeStore = useThemeStore();
const darkMode = computed(() => themeStore.darkMode);
const currentPage = ref(1);
const pageSize = ref(10);
const detailVisible = ref(false);
const detailItem = ref<CatalogItem | null>(null);

const categoryCountMap = computed<Record<string, number>>(() => {
  return dataList.value.reduce<Record<string, number>>((acc, item) => {
    if (item.type === '影像') {
      acc.img = (acc.img || 0) + 1;
      acc['img-global'] = (acc['img-global'] || 0) + 1;
    } else if (item.type === '高程') {
      acc.dem = (acc.dem || 0) + 1;
      acc['dem-30'] = (acc['dem-30'] || 0) + 1;
    } else if (item.type === '倾斜摄影') {
      acc.oblique = (acc.oblique || 0) + 1;
      acc['oblique-city'] = (acc['oblique-city'] || 0) + 1;
    } else if (item.type === '气象水文') {
      acc.hydro = (acc.hydro || 0) + 1;
      acc['hydro-rain'] = (acc['hydro-rain'] || 0) + 1;
    } else if (item.type === '矢量管网') {
      acc.pipe = (acc.pipe || 0) + 1;
      acc['pipe-vector'] = (acc['pipe-vector'] || 0) + 1;
    } else {
      acc.topic = (acc.topic || 0) + 1;
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
  { label: '影像数据', value: '影像' },
  { label: '高程数据', value: '高程' },
  { label: '倾斜摄影', value: '倾斜摄影' },
  { label: '气象水文', value: '气象水文' },
  { label: '矢量管网', value: '矢量管网' },
  { label: '专题数据', value: '专题数据' }
]);

const filteredData = computed(() => {
  let filtered = [...dataList.value];

  if (activeTab.value && activeTab.value !== '总览') {
    filtered = filtered.filter(item => {
      switch (activeTab.value) {
        case '影像数据':
          return item.type === '影像' || item.type === '倾斜摄影';
        case '数字高程':
          return item.type === '高程';
        case '地下管网':
          return item.type === '矢量管网';
        case '专题数据':
          return item.type === '专题数据';
        default:
          return true;
      }
    });
  }

  if (selectedCategory.value) {
    filtered = filtered.filter(item => {
      if (selectedCategory.value?.includes('img')) return item.type === '影像' || item.type === '倾斜摄影';
      if (selectedCategory.value?.includes('dem')) return item.type === '高程';
      if (selectedCategory.value?.includes('oblique')) return item.type === '倾斜摄影';
      if (selectedCategory.value?.includes('hydro')) return item.type === '气象水文';
      if (selectedCategory.value?.includes('pipe')) return item.type === '矢量管网';
      return false;
    });
  }

  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase();
    filtered = filtered.filter(
      item =>
        item.name.toLowerCase().includes(keyword) ||
        item.range.toLowerCase().includes(keyword) ||
        item.source.toLowerCase().includes(keyword)
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

const pageNumberList = computed<(number | string)[]>(() => {
  const total = totalPages.value;
  const page = currentPage.value;
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (page >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '...', page - 1, page, page + 1, '...', total];
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

watch([filteredData, pageSize], () => {
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

function normalizeSize(size: string) {
  const value = parseFloat(size);
  if (size.toUpperCase().includes('MB')) return value / 1024;
  return value;
}

function getDataTypeIcon(type: string): string {
  const iconMap: Record<string, string> = {
    影像: 'mdi:database',
    倾斜摄影: 'mdi:layers-triple',
    高程: 'mdi:terrain',
    气象水文: 'mdi:weather-rainy',
    矢量管网: 'mdi:transit-connection-horizontal',
    专题数据: 'mdi:folder-star-outline'
  };
  return iconMap[type] || 'mdi:file-document-outline';
}

function getTypeTagClass(type: string) {
  const typeClassMap: Record<string, string> = {
    影像: 'type-chip--image',
    倾斜摄影: 'type-chip--oblique',
    高程: 'type-chip--elevation',
    气象水文: 'type-chip--hydro',
    矢量管网: 'type-chip--pipe',
    专题数据: 'type-chip--topic'
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

function changePage(page: number) {
  if (page < 1 || page > totalPages.value) return;
  currentPage.value = page;
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
              <div class="catalog-search-panel__label">目录检索</div>
              <div class="catalog-search">
                <SvgIcon icon="mdi:magnify" class="catalog-search__icon" />
                <input
                  v-model="searchKeyword"
                  type="text"
                  class="catalog-search__input"
                  placeholder="请输入关键词搜索数据名称"
                  @keyup.enter="handleSearch"
                />
                <button type="button" class="catalog-primary-btn catalog-primary-btn--inline" @click="handleSearch">
                  搜索
                </button>
              </div>
            </div>
          </div>
          <div class="catalog-topbar__right">
            <div class="catalog-filter-card">
              <div class="catalog-filter-card__glow" />
              <div class="catalog-filter">
                <span class="catalog-filter__label">数据类型</span>
                <NSelect v-model:value="selectedType" class="catalog-filter__select" :options="typeOptions" />
              </div>
            </div>
            <button type="button" class="catalog-primary-btn catalog-primary-btn--upload" @click="showImport">
              <SvgIcon icon="mdi:upload-outline" />
              <span>上传</span>
            </button>
            <button type="button" class="catalog-ghost-btn" @click="handleReset">重置</button>
          </div>
        </div>

        <div class="catalog-main__card">
          <div class="catalog-card-head">
            <div class="catalog-card-head__title">目录清单</div>
            <div class="catalog-card-head__meta">
              <span v-if="selectedCategory">当前分类：{{ selectedCategory }}</span>
              <span>共 {{ filteredData.length }} 条结果</span>
            </div>
          </div>

          <div class="catalog-table-wrap">
            <div v-if="isLoading" class="catalog-loading">数据加载中...</div>

            <template v-else>
              <div class="catalog-table">
                <div class="catalog-table__head">
                  <div class="col-name">数据名称</div>
                  <div class="col-time">数据时间</div>
                  <div class="col-type">数据类型</div>
                  <div class="col-range">空间范围</div>
                  <div class="col-source">数据来源</div>
                  <div class="col-size">数据大小</div>
                  <div class="col-actions">管理操作</div>
                </div>

                <div class="catalog-table__body">
                  <div v-for="item in pageItems" :key="item.id" class="catalog-row">
                    <div class="col-name">
                      <div class="dataset-cell">
                        <SvgIcon icon="mdi:database" class="dataset-cell__bullet" />
                        <div class="dataset-cell__content">
                          <div class="dataset-cell__title">{{ item.name }}</div>
                          <div class="dataset-cell__sub">{{ item.timePhase }}</div>
                        </div>
                      </div>
                    </div>

                    <div class="col-time row-text row-text--muted">{{ item.ingestTime }}</div>

                    <div class="col-type">
                      <span class="type-chip" :class="getTypeTagClass(item.type)">
                        {{ item.type }}
                      </span>
                    </div>

                    <div class="col-range row-text">{{ item.range }}</div>
                    <div class="col-source row-text">{{ item.source }}</div>
                    <div class="col-size row-text row-text--mono">{{ item.size }}</div>

                    <div class="col-actions">
                      <button
                        v-for="action in actionGroups"
                        :key="action.key"
                        type="button"
                        class="action-item"
                        :class="{ 'action-item--danger': action.danger }"
                        @click="handleAction(action.key, item)"
                      >
                        <SvgIcon :icon="action.icon" class="action-item__icon" />
                        <span class="action-item__text">{{ action.label }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

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
                      class="action-item"
                      :class="{ 'action-item--danger': action.danger }"
                      @click="handleAction(action.key, item)"
                    >
                      <SvgIcon :icon="action.icon" class="action-item__icon" />
                      <span class="action-item__text">{{ action.label }}</span>
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

                <div class="catalog-pagination">
                  <button type="button" class="pager-btn" @click="changePage(currentPage - 1)">
                    <SvgIcon icon="mdi:chevron-left" />
                  </button>
                  <button
                    v-for="page in pageNumberList"
                    :key="`page-${page}`"
                    type="button"
                    class="pager-btn"
                    :class="{ 'pager-btn--active': page === currentPage, 'pager-btn--ghost': page === '...' }"
                    :disabled="page === '...'"
                    @click="typeof page === 'number' && changePage(page)"
                  >
                    {{ page }}
                  </button>
                  <button type="button" class="pager-btn" @click="changePage(currentPage + 1)">
                    <SvgIcon icon="mdi:chevron-right" />
                  </button>
                  <div class="page-size-box">
                    <span>{{ pageSize }}条/页</span>
                  </div>
                  <div class="page-jumper">
                    <span>跳至</span>
                    <input
                      :value="currentPage"
                      type="number"
                      min="1"
                      :max="totalPages"
                      @change="changePage(Number(($event.target as any).value || 1))"
                    />
                    <span>页</span>
                  </div>
                </div>
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
          <button type="button" class="detail-close-btn" @click="detailVisible = false">
            <SvgIcon icon="mdi:close" />
          </button>
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
  --catalog-table-head-bg: linear-gradient(180deg, rgba(6, 29, 56, 0.94) 0%, rgba(4, 22, 43, 0.94) 100%);
  --catalog-table-row-hover: rgba(33, 116, 212, 0.14);
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
  height: 36px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid rgba(58, 145, 231, 0.18);
  background: linear-gradient(180deg, rgba(8, 42, 82, 0.82) 0%, rgba(5, 24, 48, 0.88) 100%);
  color: rgba(203, 227, 255, 0.76);
  font-size: 12px;
  letter-spacing: 0.4px;
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  box-shadow: inset 0 1px 0 rgba(129, 211, 255, 0.08);
}

.catalog-search {
  position: relative;
  width: min(380px, 100%);
  min-width: 280px;
  display: flex;
  align-items: center;
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(2, 16, 31, 0.98) 0%, rgba(4, 23, 44, 0.98) 100%),
    linear-gradient(90deg, rgba(37, 122, 211, 0.06) 0%, rgba(0, 0, 0, 0) 50%);
  border: 1px solid rgba(43, 118, 197, 0.38);
  box-shadow:
    inset 0 1px 0 rgba(136, 214, 255, 0.04),
    0 1px 3px rgba(0, 0, 0, 0.25);
  transition:
    border-color 0.25s ease,
    box-shadow 0.25s ease;
}

.catalog-search:focus-within {
  border-color: rgba(58, 160, 255, 0.56);
  box-shadow:
    inset 0 1px 0 rgba(136, 214, 255, 0.06),
    0 0 0 2px rgba(41, 163, 255, 0.12),
    0 1px 4px rgba(0, 0, 0, 0.3);
}

.catalog-search__icon {
  position: absolute;
  left: 12px;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  font-size: 14px;
  color: #7cc4f0;
}

.catalog-search__input,
.catalog-ghost-btn,
.catalog-primary-btn,
.page-jumper input {
  font-family: 'Microsoft YaHei', 'PingFang SC', 'HarmonyOS Sans SC', 'Segoe UI', sans-serif;
}

.catalog-search__input {
  width: 100%;
  height: 38px;
  padding: 0 96px 0 40px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--catalog-text-primary);
  font-size: 13px;
  outline: none;
  letter-spacing: 0.2px;
}

.catalog-search__input::placeholder {
  color: rgba(132, 177, 233, 0.5);
}

.catalog-search__input:focus {
  + .catalog-primary-btn--inline {
    filter: brightness(1.08);
    box-shadow:
      inset 0 1px 0 rgba(181, 233, 255, 0.22),
      0 0 12px rgba(12, 110, 206, 0.3);
  }
}

.catalog-primary-btn--inline {
  position: absolute;
  right: 4px;
  height: 30px;
  padding: 0 18px;
  font-size: 12px;
  border-radius: 6px;
  background: linear-gradient(180deg, rgba(23, 131, 240, 0.96) 0%, rgba(8, 83, 171, 0.96) 100%);
  box-shadow:
    inset 0 1px 0 rgba(181, 233, 255, 0.18),
    0 0 10px rgba(12, 110, 206, 0.2);
}

.catalog-primary-btn,
.catalog-ghost-btn,
.action-item,
.pager-btn {
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease,
    transform 0.2s ease;
}

.catalog-primary-btn,
.catalog-ghost-btn {
  height: 38px;
  padding: 0 18px;
  border-radius: 8px;
  border: 1px solid var(--catalog-button-border);
  font-size: 13px;
  color: #e9f5ff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.catalog-primary-btn {
  background: linear-gradient(180deg, rgba(23, 131, 240, 0.96) 0%, rgba(8, 83, 171, 0.96) 100%);
  box-shadow:
    inset 0 1px 0 rgba(181, 233, 255, 0.14),
    0 8px 20px rgba(4, 79, 162, 0.22);
}

.catalog-ghost-btn {
  background: linear-gradient(180deg, rgba(9, 43, 82, 0.94) 0%, rgba(5, 23, 46, 0.96) 100%);
}

.catalog-primary-btn:hover,
.catalog-ghost-btn:hover,
.pager-btn:hover,
.action-item:hover {
  transform: translateY(-1px);
}

.catalog-primary-btn--upload {
  min-width: 88px;
}

.catalog-filter-card {
  position: relative;
  padding: 2px;
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(9, 43, 82, 0.96) 0%, rgba(4, 22, 43, 0.96) 100%);
  border: 1px solid rgba(46, 130, 223, 0.24);
  box-shadow:
    inset 0 1px 0 rgba(152, 219, 255, 0.06),
    0 1px 3px rgba(0, 0, 0, 0.2);
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
  gap: 10px;
  min-width: 214px;
  height: 34px;
  padding: 0 12px;
  border-radius: 6px;
}

.catalog-filter__label {
  font-size: 12px;
  color: rgba(205, 229, 255, 0.72);
  white-space: nowrap;
}

.catalog-filter__select {
  width: 136px;
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

.catalog-table {
  display: block;
  min-width: 1120px;
}

.catalog-table__head,
.catalog-row {
  display: grid;
  grid-template-columns: 2.4fr 1.35fr 1.1fr 1.05fr 1.05fr 0.8fr 1.9fr;
  align-items: center;
}

.catalog-table__head {
  min-height: 44px;
  padding: 0 12px;
  background: var(--catalog-table-head-bg);
  border-bottom: 1px solid var(--catalog-line);
  color: var(--catalog-text-secondary);
  font-size: 12px;
}

.catalog-table__body {
  overflow: auto;
  flex: 1;
}

.catalog-row {
  min-height: 66px;
  padding: 0 12px;
  border-bottom: 1px solid rgba(18, 73, 135, 0.32);
  transition: background 0.2s ease;
}

.catalog-row:hover {
  background: var(--catalog-table-row-hover);
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
  gap: 4px;
}

.dataset-cell__title {
  color: var(--catalog-text-primary);
  font-size: 13px;
  line-height: 1.4;
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

.catalog-row:hover .type-chip {
  box-shadow: 0 0 6px rgba(41, 163, 255, 0.12);
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

.col-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
}

.action-item {
  min-width: 34px;
  padding: 0 2px;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--catalog-text-secondary);
  background: transparent;
  border: none;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.action-item:hover {
  color: var(--catalog-accent);
  background: rgba(41, 163, 255, 0.08);
}

.action-item__icon {
  font-size: 16px;
  transition: transform 0.2s ease;
}

.action-item:hover .action-item__icon {
  transform: scale(1.15);
}

.action-item__text {
  font-size: 11px;
  line-height: 1;
}

.action-item--danger {
  color: #ff8d8d;
}
.action-item--danger:hover {
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.08);
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

.catalog-pagination {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pager-btn,
.page-size-box,
.page-jumper {
  height: 28px;
  border: 1px solid rgba(45, 111, 183, 0.34);
  background: rgba(6, 25, 50, 0.82);
  color: var(--catalog-text-secondary);
  border-radius: 3px;
}

.pager-btn {
  min-width: 28px;
  padding: 0 8px;
}

.pager-btn--active {
  color: #fff;
  border-color: rgba(70, 176, 255, 0.5);
  background: linear-gradient(180deg, rgba(17, 100, 206, 0.64) 0%, rgba(8, 66, 138, 0.64) 100%);
  box-shadow: 0 0 6px rgba(41, 163, 255, 0.2);
}

.pager-btn--ghost {
  cursor: default;
}

.page-size-box,
.page-jumper {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  font-size: 12px;
}

.page-jumper input {
  width: 36px;
  height: 20px;
  background: rgba(2, 18, 36, 0.88);
  border: 1px solid rgba(45, 111, 183, 0.34);
  color: #fff;
  text-align: center;
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
.catalog-table__body::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.catalog-sidebar__panel::-webkit-scrollbar-thumb,
.catalog-table__body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(48, 127, 212, 0.58);
}

.catalog-sidebar__panel::-webkit-scrollbar-track,
.catalog-table__body::-webkit-scrollbar-track {
  background: rgba(4, 20, 40, 0.45);
}

@media (max-width: 1280px) {
  .catalog-topbar {
    flex-wrap: wrap;
  }

  .catalog-search-panel {
    width: 100%;
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
  }

  .catalog-footer__summary {
    flex-wrap: wrap;
  }

  .catalog-pagination {
    flex-wrap: wrap;
  }
}
</style>
