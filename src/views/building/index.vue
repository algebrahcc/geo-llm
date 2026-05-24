<script setup lang="ts">
defineOptions({
  name: 'BuildingPage'
});
</script>

<template>
  <NGrid :x-gap="16" :y-gap="16" cols="24">
    <NGi span="24 s:24 m:6">
      <NSpace vertical :size="16">
        <NCard :bordered="false" title="任务信息">占位</NCard>
        <NCard :bordered="false" title="我方力量对比">占位</NCard>
        <NCard :bordered="false" title="战场环境">占位</NCard>
      </NSpace>
    </NGi>

    <NGi span="24 s:24 m:12">
      <NCard :bordered="false" title="三维地图" class="h-520px">
        <div class="h-full flex-center opacity-70">三维场景占位</div>
      </NCard>
      <NCard :bordered="false" title="情景漫游面板" class="mt-16px">
        <div class="flex justify-between">
          <NSpace :size="8">
            <NButton size="small" secondary>播放</NButton>
            <NButton size="small" secondary>暂停</NButton>
            <NButton size="small" secondary>关键点</NButton>
          </NSpace>
          <NButton size="small" type="primary">截图生成材料</NButton>
        </div>
      </NCard>
    </NGi>

    <NGi span="24 s:24 m:6">
      <NSpace vertical :size="16">
        <NCard :bordered="false" title="建筑文本信息">占位</NCard>
        <NCard :bordered="false" title="内部结构 BIM">占位</NCard>
        <NCard :bordered="false" title="周边环境">占位</NCard>
      </NSpace>
    </NGi>
  </NGrid>
</template>

<style scoped></style>
