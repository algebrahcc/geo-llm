<script setup lang="ts">
import SvgIcon from '@/components/custom/svg-icon.vue';
import type { SelectOption } from 'naive-ui';

interface Props {
  keyword: string;
  source: string;
  status: string;
  sort: string;
  sourceOptions: SelectOption[];
  statusOptions: SelectOption[];
  sortOptions: SelectOption[];
}

defineProps<Props>();

const emit = defineEmits<{
  'update:keyword': [value: string];
  'update:source': [value: string];
  'update:status': [value: string];
  'update:sort': [value: string];
  importDoc: [];
  importImage: [];
  reset: [];
}>();
</script>

<template>
  <div class="toolbar">
    <div class="toolbar__left">
      <div class="search-box">
        <SvgIcon icon="mdi:magnify" class="search-box__icon" />
        <input
          :value="keyword"
          type="text"
          class="search-box__input"
          placeholder="搜索文档名、标签、来源"
          @input="emit('update:keyword', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>
    <div class="toolbar__right">
      <div class="filter-group">
        <span class="filter-label">来源</span>
        <NSelect :value="source" class="filter-select" clearable placeholder="全部" :options="sourceOptions" @update:value="emit('update:source', $event || '')" />
      </div>
      <div class="filter-group">
        <span class="filter-label">状态</span>
        <NSelect :value="status" class="filter-select" placeholder="全部" :options="statusOptions" @update:value="emit('update:status', $event)" />
      </div>
      <div class="filter-group">
        <span class="filter-label">排序</span>
        <NSelect :value="sort" class="filter-select" placeholder="默认" :options="sortOptions" @update:value="emit('update:sort', $event)" />
      </div>
      <NButton size="small" @click="emit('reset')">重置</NButton>
      <NButton type="primary" size="small" @click="emit('importDoc')">
        <template #icon>
          <SvgIcon icon="mdi:file-upload-outline" />
        </template>
        导入文档
      </NButton>
      <NButton size="small" @click="emit('importImage')">
        <template #icon>
          <SvgIcon icon="mdi:image-plus-outline" />
        </template>
        导入图片
      </NButton>
    </div>
  </div>
</template>

<style scoped lang="scss">
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-height: 60px;
  padding: 12px 18px;
  position: relative;
}

.toolbar::after {
  content: '';
  position: absolute;
  inset: auto 16px 0;
  height: 1px;
  background: linear-gradient(90deg, rgba(57, 171, 255, 0.22) 0%, rgba(57, 171, 255, 0.04) 100%);
}

.toolbar__left,
.toolbar__right {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Search box (catalog-style) */
.search-box {
  position: relative;
  width: min(340px, 100%);
  min-width: 240px;
  display: flex;
  align-items: center;
  border-radius: 6px;
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

.search-box:focus-within {
  border-color: rgba(58, 160, 255, 0.56);
  box-shadow:
    inset 0 1px 0 rgba(136, 214, 255, 0.06),
    0 0 0 2px rgba(41, 163, 255, 0.12),
    0 1px 4px rgba(0, 0, 0, 0.3);
}

.search-box__icon {
  position: absolute;
  left: 12px;
  font-size: 14px;
  color: #7cc4f0;
}

.search-box__input {
  width: 100%;
  height: 36px;
  padding: 0 14px 0 38px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #eaf5ff;
  font-size: 13px;
  outline: none;
  letter-spacing: 0.2px;
  font-family: 'Microsoft YaHei', 'PingFang SC', 'HarmonyOS Sans SC', 'Segoe UI', sans-serif;
}

.search-box__input::placeholder {
  color: rgba(132, 177, 233, 0.5);
}

/* Filter group (catalog-style) */
.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px;
  border-radius: 6px;
  background: linear-gradient(180deg, rgba(9, 43, 82, 0.96) 0%, rgba(4, 22, 43, 0.96) 100%);
  border: 1px solid rgba(46, 130, 223, 0.24);
  position: relative;
}

.filter-label {
  height: 30px;
  padding: 0 10px;
  border-radius: 4px;
  font-size: 12px;
  color: rgba(203, 227, 255, 0.72);
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
}

.filter-select {
  width: 110px;
}

/* NSelect deep overrides */
::deep(.filter-select .n-base-selection) {
  height: 30px;
  border-radius: 4px;
  background: rgba(2, 18, 36, 0.5);
  border-color: rgba(54, 132, 212, 0.12);
  box-shadow: none;
}

::deep(.filter-select .n-base-selection-label) {
  color: #eaf5ff;
}

::deep(.filter-select .n-base-selection-placeholder),
::deep(.filter-select .n-base-selection-input__content) {
  color: rgba(147, 196, 255, 0.62);
}

::deep(.filter-select .n-base-selection__border) {
  display: none;
}

/* NButton deep overrides — catalog-style dark buttons */
:deep(.n-button) {
  --n-height: 36px !important;
  --n-padding: 0 18px !important;
  --n-border-radius: 6px !important;
  --n-font-size: 13px !important;
  --n-border: 1px solid rgba(96, 191, 255, 0.32) !important;
  --n-border-hover: 1px solid rgba(70, 176, 255, 0.5) !important;
  --n-border-pressed: 1px solid rgba(96, 191, 255, 0.32) !important;
  --n-border-focus: 1px solid rgba(70, 176, 255, 0.5) !important;
  --n-color: linear-gradient(180deg, rgba(9, 43, 82, 0.94) 0%, rgba(5, 23, 46, 0.96) 100%) !important;
  --n-color-hover: rgba(12, 50, 92, 0.96) !important;
  --n-color-pressed: rgba(8, 36, 68, 0.96) !important;
  --n-color-focus: rgba(12, 50, 92, 0.96) !important;
  --n-text-color: #e9f5ff !important;
  --n-text-color-hover: #fff !important;
  --n-text-color-pressed: #e9f5ff !important;
  --n-text-color-focus: #fff !important;
  box-shadow: inset 0 1px 0 rgba(152, 219, 255, 0.06);
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

:deep(.n-button:hover) {
  transform: translateY(-1px);
}

:deep(.n-button--primary-type) {
  --n-color: linear-gradient(180deg, rgba(23, 131, 240, 0.96) 0%, rgba(8, 83, 171, 0.96) 100%) !important;
  --n-color-hover: linear-gradient(180deg, rgba(30, 142, 250, 0.98) 0%, rgba(12, 95, 190, 0.98) 100%) !important;
  --n-color-pressed: linear-gradient(180deg, rgba(16, 115, 215, 0.94) 0%, rgba(6, 70, 150, 0.94) 100%) !important;
  --n-border: 1px solid rgba(96, 191, 255, 0.32) !important;
  --n-border-hover: 1px solid rgba(96, 191, 255, 0.45) !important;
  box-shadow:
    inset 0 1px 0 rgba(181, 233, 255, 0.14),
    0 8px 20px rgba(4, 79, 162, 0.22);
}

:deep(.n-button--default-type) {
  --n-color: linear-gradient(180deg, rgba(9, 43, 82, 0.94) 0%, rgba(5, 23, 46, 0.96) 100%) !important;
  --n-color-hover: rgba(12, 50, 92, 0.96) !important;
}

@media (max-width: 1100px) {
  .toolbar {
    flex-wrap: wrap;
  }

  .search-box {
    min-width: 100%;
    width: 100%;
  }

  .toolbar__right {
    width: 100%;
    flex-wrap: wrap;
  }
}
</style>
