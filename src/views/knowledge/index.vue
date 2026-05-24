<script setup lang="ts">
import { h, resolveComponent } from 'vue';

defineOptions({
  name: 'KnowledgePage'
});

const categories = ['长江流域', '黄河流域', '...'];

const columns = [
  { title: '序号', key: 'no', width: 70 },
  { title: '文件名', key: 'name' },
  { title: '大小/KB', key: 'size' },
  { title: '来源', key: 'source' },
  { title: '录入时间', key: 'createdAt' },
  { title: '更新时间', key: 'updatedAt' },
  { title: '审核人', key: 'reviewer' },
  {
    title: '操作',
    key: 'actions',
    render() {
      return h('div', { class: 'flex gap-8px' }, [
        h(resolveComponent('NButton') as any, { size: 'tiny', secondary: true }, { default: () => '查看' }),
        h(resolveComponent('NButton') as any, { size: 'tiny', secondary: true }, { default: () => '编辑' }),
        h(
          resolveComponent('NButton') as any,
          { size: 'tiny', tertiary: true, type: 'error' },
          { default: () => '删除' }
        )
      ]);
    }
  }
];

const data = [
  {
    no: 1,
    name: '长江流域资料.pdf',
    size: 300,
    source: '整理归档',
    createdAt: '2026-05-20 10:20',
    updatedAt: '2026-05-21 09:12',
    reviewer: '管理员'
  },
  {
    no: 2,
    name: '黄河流域资料.docx',
    size: 500,
    source: '整理归档',
    createdAt: '2026-05-18 11:00',
    updatedAt: '2026-05-18 11:00',
    reviewer: '管理员'
  }
];
</script>

<template>
  <NSpace vertical :size="16">
    <div class="flex items-center justify-between">
      <NSpace :size="12">
        <NCard v-for="c in categories" :key="c" :bordered="false" size="small" class="w-180px">
          <div class="text-14px font-600">{{ c }}</div>
        </NCard>
      </NSpace>
      <NButton type="primary">导入</NButton>
    </div>

    <NCard :bordered="false" title="文件/条目列表">
      <NDataTable :columns="columns" :data="data" size="small" />
    </NCard>
  </NSpace>
</template>

<style scoped></style>
