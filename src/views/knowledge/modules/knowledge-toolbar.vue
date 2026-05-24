<script setup lang="ts">
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
  import: [];
  reset: [];
}>();
</script>

<template>
  <NCard :bordered="false" class="toolbar-card">
    <div class="flex flex-wrap items-center justify-between gap-16px">
      <div class="flex flex-1 flex-wrap items-center gap-12px">
        <NInput
          :value="keyword"
          clearable
          class="min-w-260px max-w-360px"
          placeholder="搜索文档名、标签、来源"
          @update:value="emit('update:keyword', $event)"
        >
          <template #prefix>
            <span class="i-mdi:magnify text-16px text-[#94a3b8]" />
          </template>
        </NInput>
        <NSelect
          :value="source"
          class="min-w-180px"
          clearable
          placeholder="筛选来源"
          :options="sourceOptions"
          @update:value="emit('update:source', $event || '')"
        />
        <NSelect
          :value="status"
          class="min-w-140px"
          placeholder="处理状态"
          :options="statusOptions"
          @update:value="emit('update:status', $event)"
        />
        <NSelect
          :value="sort"
          class="min-w-140px"
          placeholder="排序方式"
          :options="sortOptions"
          @update:value="emit('update:sort', $event)"
        />
      </div>
      <div class="flex items-center gap-8px">
        <NButton secondary @click="emit('reset')">重置</NButton>
        <NButton type="primary" @click="emit('import')">导入文档</NButton>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
.toolbar-card {
  background: rgba(15, 23, 42, 0.72);
  border-radius: 20px;
}
</style>
