<script setup lang="ts">
defineOptions({
  name: 'AgentPage'
});

const agents = ['地理分析助手', '机动规划助手', '渡河保障助手', '影像识别助手'];
const tabs = ['运行中', '详情', '版本', '性能评测', '配置', '测试'];
</script>

<template>
  <NGrid :x-gap="16" :y-gap="16" cols="24">
    <NGi span="24 s:24 m:5">
      <NCard :bordered="false" title="AI 智能体中心">
        <NList hoverable clickable>
          <NListItem v-for="a in agents" :key="a">{{ a }}</NListItem>
        </NList>
      </NCard>
    </NGi>

    <NGi span="24 s:24 m:19">
      <NSpace vertical :size="16">
        <NCard :bordered="false">
          <NTabs type="line" animated>
            <NTabPane v-for="t in tabs" :key="t" :name="t" :tab="t" />
          </NTabs>
        </NCard>

        <NCard :bordered="false" title="能力流程">
          <NGrid :x-gap="12" :y-gap="12" cols="24">
            <NGi span="24 s:12 m:6">
              <NCard :bordered="true" size="small" title="输入理解">占位</NCard>
            </NGi>
            <NGi span="24 s:12 m:6">
              <NCard :bordered="true" size="small" title="空间分析">占位</NCard>
            </NGi>
            <NGi span="24 s:12 m:6">
              <NCard :bordered="true" size="small" title="智能推理">占位</NCard>
            </NGi>
            <NGi span="24 s:12 m:6">
              <NCard :bordered="true" size="small" title="结果输出">占位</NCard>
            </NGi>
          </NGrid>
        </NCard>

        <NCard :bordered="false" title="调用日志">
          <NEmpty description="暂无调用记录" />
        </NCard>
      </NSpace>
    </NGi>
  </NGrid>
</template>

<style scoped></style>
