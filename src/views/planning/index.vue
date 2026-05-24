<script setup lang="ts">
defineOptions({
  name: 'PlanningPage'
});

const routeTabs = ['路线一：用时最短', '路线二：距离最短', '路线三：成本最小'];
</script>

<template>
  <NGrid :x-gap="16" :y-gap="16" cols="24">
    <NGi span="24 s:24 m:6">
      <NCard :bordered="false" title="路线规划">
        <NForm label-placement="left" label-width="60">
          <NFormItem label="起点">
            <NInput placeholder="点选/输入" />
          </NFormItem>
          <NFormItem label="终点">
            <NInput placeholder="点选/输入" />
          </NFormItem>
          <NFormItem label="约束">
            <NCheckboxGroup>
              <NSpace vertical :size="8">
                <NCheckbox value="single">单路线规划</NCheckbox>
                <NCheckbox value="multi">多路线规划</NCheckbox>
                <NCheckbox value="no-road">无通路路线规划</NCheckbox>
                <NCheckbox value="avoid">避障规划</NCheckbox>
              </NSpace>
            </NCheckboxGroup>
          </NFormItem>
          <NButton type="primary" block>智能规划</NButton>
        </NForm>
      </NCard>
    </NGi>

    <NGi span="24 s:24 m:12">
      <NCard :bordered="false" title="三维地图" class="h-520px">
        <div class="h-full flex-center opacity-70">三维地图占位</div>
      </NCard>
    </NGi>

    <NGi span="24 s:24 m:6">
      <NCard :bordered="false" title="规划结果">
        <div class="text-12px opacity-70 mb-12px">选择路线查看指标与说明。</div>
        <NSpace vertical :size="8">
          <NButton v-for="t in routeTabs" :key="t" secondary size="small" block>{{ t }}</NButton>
        </NSpace>
      </NCard>
    </NGi>
  </NGrid>
</template>

<style scoped></style>
