<script setup lang="ts">
import type { BuildingEnvironmentItem, BuildingForceCard, BuildingTask } from './types';

defineOptions({
  name: 'BuildingTaskPanel'
});

interface Props {
  task: BuildingTask;
  forces: BuildingForceCard[];
  environments: BuildingEnvironmentItem[];
}

defineProps<Props>();

function getToneType(tone: BuildingForceCard['tone']) {
  if (tone === 'success') return 'success';
  if (tone === 'warning') return 'warning';

  return 'info';
}

function getRiskType(level: BuildingEnvironmentItem['level']) {
  if (level === 'high') return 'error';
  if (level === 'medium') return 'warning';

  return 'success';
}
</script>

<template>
  <NSpace vertical :size="16">
    <NCard :bordered="false" title="任务信息">
      <NSpace vertical :size="12">
        <div class="task-title">{{ task.title }}</div>
        <div class="task-summary">{{ task.summary }}</div>
        <div class="task-meta">
          <span>任务编号：{{ task.code }}</span>
          <span>操作单元：{{ task.operator }}</span>
          <span>更新时间：{{ task.updatedAt }}</span>
        </div>
        <NAlert type="info" :show-icon="false">{{ task.objective }}</NAlert>
      </NSpace>
    </NCard>

    <NCard :bordered="false" title="我方力量对比">
      <NSpace vertical :size="12">
        <div v-for="item in forces" :key="item.id" class="force-item">
          <div class="force-meta">
            <div class="force-name">
              <SvgIcon :icon="item.icon" />
              <span>{{ item.label }}</span>
            </div>
            <NTag size="small" :type="getToneType(item.tone)">{{ item.value }}</NTag>
          </div>
          <div class="force-desc">{{ item.description }}</div>
        </div>
      </NSpace>
    </NCard>

    <NCard :bordered="false" title="战场环境">
      <NSpace vertical :size="12">
        <div v-for="item in environments" :key="item.id" class="force-item">
          <div class="force-meta">
            <div class="force-name">
              <SvgIcon :icon="item.icon" />
              <span>{{ item.label }}</span>
            </div>
            <NTag size="small" :type="getRiskType(item.level)">
              {{ item.level === 'high' ? '高风险' : item.level === 'medium' ? '中风险' : '低风险' }}
            </NTag>
          </div>
          <div class="force-desc">{{ item.description }}</div>
        </div>
      </NSpace>
    </NCard>
  </NSpace>
</template>

<style scoped>
.task-title {
  font-size: 16px;
  font-weight: 600;
}

.task-summary,
.task-meta,
.force-desc {
  font-size: 12px;
  line-height: 1.7;
  color: var(--n-text-color-3);
}

.task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.force-item {
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 12px;
  padding: 12px;
}

.force-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.force-name {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
