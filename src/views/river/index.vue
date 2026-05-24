<script setup lang="ts">
defineOptions({
  name: 'RiverPage'
});

const steps = ['环境分析', '面源评估分析', '知识抽取', '平行方案设计', '算法模块', '风险评估', '输出方案生成'];
const planTabs = ['方案一', '方案二', '方案三'];
</script>

<template>
  <NGrid :x-gap="16" :y-gap="16" cols="24">
    <NGi span="24 s:24 m:6">
      <NCard :bordered="false" title="任务输入">
        <NForm label-placement="left" label-width="80">
          <NFormItem label="任务名称">
            <NInput placeholder="请输入" />
          </NFormItem>
          <NFormItem label="任务类型">
            <NSelect :options="[{ label: '渡河保障', value: 'river' }]" />
          </NFormItem>
          <NFormItem label="任务范围">
            <NInput placeholder="框选/输入范围" />
          </NFormItem>
          <NFormItem label="部队规模">
            <NInput placeholder="例如：1 个营" />
          </NFormItem>
          <NFormItem label="车辆数量">
            <NInput placeholder="例如：30" />
          </NFormItem>
          <NFormItem label="时间要求">
            <NInput placeholder="例如：2 小时内完成" />
          </NFormItem>
          <div class="pt-8px">
            <NButton type="primary" block>智能分析</NButton>
          </div>
        </NForm>
      </NCard>
    </NGi>

    <NGi span="24 s:24 m:12">
      <NCard :bordered="false" title="三维地图" class="h-520px">
        <div class="h-full flex-center opacity-70">三维地图占位</div>
      </NCard>
      <NCard :bordered="false" title="分析流程" class="mt-16px">
        <NSteps :current="1" size="small">
          <NStep v-for="s in steps" :key="s" :title="s" />
        </NSteps>
      </NCard>
    </NGi>

    <NGi span="24 s:24 m:6">
      <NSpace vertical :size="16">
        <NCard :bordered="false" title="分析结果总览">占位</NCard>
        <NCard :bordered="false" title="方案切换">
          <NSpace :size="8">
            <NButton v-for="t in planTabs" :key="t" size="small" secondary>{{ t }}</NButton>
          </NSpace>
        </NCard>
        <NCard :bordered="false" title="方案内容">占位</NCard>
        <NCard :bordered="false" title="标注/材料">占位</NCard>
      </NSpace>
    </NGi>
  </NGrid>
</template>

<style scoped></style>
