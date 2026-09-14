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
        <NSelect
          :value="source"
          class="filter-select"
          clearable
          placeholder="全部"
          :options="sourceOptions"
          @update:value="emit('update:source', $event || '')"
        />
      </div>
      <div class="filter-group">
        <span class="filter-label">状态</span>
        <NSelect
          :value="status"
          class="filter-select"
          placeholder="全部"
          :options="statusOptions"
          @update:value="emit('update:status', $event)"
        />
      </div>
      <div class="filter-group">
        <span class="filter-label">排序</span>
        <NSelect
          :value="sort"
          class="filter-select"
          placeholder="默认"
          :options="sortOptions"
          @update:value="emit('update:sort', $event)"
        />
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
  background: linear-gradient(90deg, var(--ui-accent-7) 0%, var(--ui-accent-8) 100%);
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
    linear-gradient(180deg, var(--ui-surface-10) 0%, var(--ui-surface-75) 100%),
    linear-gradient(90deg, var(--ui-border-114) 0%, rgba(0, 0, 0, 0) 50%);
  border: 1px solid var(--ui-border-11);
  box-shadow:
    inset 0 1px 0 var(--ui-text-8),
    0 1px 3px var(--ui-shadow-2);
  transition:
    border-color 0.25s ease,
    box-shadow 0.25s ease;
}

.search-box:focus-within {
  border-color: var(--ui-accent-124);
  box-shadow:
    inset 0 1px 0 var(--ui-text-87),
    0 0 0 2px var(--ui-border-7),
    0 1px 4px var(--ui-shadow-4);
}

.search-box__icon {
  position: absolute;
  left: 12px;
  font-size: 14px;
  color: var(--ui-accent-9);
}

.search-box__input {
  width: 100%;
  height: 36px;
  padding: 0 14px 0 38px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--ui-text-33);
  font-size: 13px;
  outline: none;
  letter-spacing: 0.2px;
  font-family: 'Microsoft YaHei', 'PingFang SC', 'HarmonyOS Sans SC', 'Segoe UI', sans-serif;
}

.search-box__input::placeholder {
  color: var(--ui-accent-125);
}

/* Filter group (catalog-style) */
.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px;
  border-radius: 6px;
  background: linear-gradient(180deg, var(--ui-surface-16) 0%, var(--ui-surface-17) 100%);
  border: 1px solid var(--ui-border-21);
  position: relative;
}

.filter-label {
  height: 30px;
  padding: 0 10px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--ui-text-42);
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
  background: var(--ui-surface-34);
  border-color: var(--ui-border-69);
  box-shadow: none;
}

::deep(.filter-select .n-base-selection-label) {
  color: var(--ui-text-33);
}

::deep(.filter-select .n-base-selection-placeholder),
::deep(.filter-select .n-base-selection-input__content) {
  color: var(--ui-text-41);
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
  --n-border: 1px solid var(--ui-accent-3) !important;
  --n-border-hover: 1px solid var(--ui-accent-44) !important;
  --n-border-pressed: 1px solid var(--ui-accent-3) !important;
  --n-border-focus: 1px solid var(--ui-accent-44) !important;
  --n-color: linear-gradient(180deg, var(--ui-surface-12) 0%, var(--ui-surface-13) 100%) !important;
  --n-color-hover: var(--ui-accent-126) !important;
  --n-color-pressed: var(--ui-surface-28) !important;
  --n-color-focus: var(--ui-accent-126) !important;
  --n-text-color: var(--ui-text-12) !important;
  --n-text-color-hover: #fff !important;
  --n-text-color-pressed: var(--ui-text-12) !important;
  --n-text-color-focus: #fff !important;
  box-shadow: inset 0 1px 0 var(--ui-text-17);
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease,
    transform 0.2s ease;
}

:deep(.n-button:hover) {
  transform: translateY(-1px);
}

:deep(.n-button--primary-type) {
  --n-color: linear-gradient(180deg, var(--ui-accent-18) 0%, var(--ui-accent-19) 100%) !important;
  --n-color-hover: linear-gradient(180deg, var(--ui-accent-127) 0%, var(--ui-accent-128) 100%) !important;
  --n-color-pressed: linear-gradient(180deg, var(--ui-accent-129) 0%, var(--ui-accent-130) 100%) !important;
  --n-border: 1px solid var(--ui-accent-3) !important;
  --n-border-hover: 1px solid var(--ui-accent-131) !important;
  box-shadow:
    inset 0 1px 0 var(--ui-text-13),
    0 8px 20px var(--ui-border-17);
}

:deep(.n-button--default-type) {
  --n-color: linear-gradient(180deg, var(--ui-surface-12) 0%, var(--ui-surface-13) 100%) !important;
  --n-color-hover: var(--ui-accent-126) !important;
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
