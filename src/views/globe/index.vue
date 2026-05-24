<script setup lang="ts">
defineOptions({
  name: 'GlobePage'
});

const leftTools = ['地理分析工具', '定位', '测距', '测面', '标注', '清除'];
const rightTools = ['图层', '复位', '俯仰', '旋转', '缩放'];
</script>

<template>
  <div class="relative h-[calc(100vh-120px)]">
    <NCard :bordered="false" class="h-full">
      <div class="h-full flex-center opacity-70">三维地球占位</div>
    </NCard>

    <div class="absolute left-12px top-12px flex-col gap-8px">
      <NButton v-for="t in leftTools" :key="t" size="small" secondary>{{ t }}</NButton>
    </div>

    <div class="absolute right-12px top-12px flex-col gap-8px">
      <NButton v-for="t in rightTools" :key="t" size="small" secondary>{{ t }}</NButton>
    </div>

    <NCard :bordered="false" size="small" class="absolute right-12px bottom-12px w-320px">
      <div class="text-14px font-600 mb-8px">AI 分析助手</div>
      <div class="text-12px opacity-70 mb-12px">在当前视角下发起分析、生成标注或导出截图。</div>
      <NSpace :size="8">
        <NButton type="primary" size="small">开始分析</NButton>
        <NButton size="small">生成标注</NButton>
        <NButton size="small">导出截图</NButton>
      </NSpace>
    </NCard>
  </div>
</template>

<style scoped></style>
