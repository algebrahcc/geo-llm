<script setup lang="ts">
import type { BuildingEnvironmentItem, BuildingForceCard, BuildingTask } from './types';

defineOptions({
  name: 'BuildingTaskStagePanel'
});

interface Props {
  task: BuildingTask;
  forces: BuildingForceCard[];
  environments: BuildingEnvironmentItem[];
  collapsed: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  toggleCollapse: [];
}>();

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
  <NCard :bordered="false" size="small" class="task-panel" :class="[{ 'task-panel--collapsed': collapsed }]">
    <template #header>
      <div class="panel-title-wrap">
        <div class="title-group">
          <SvgIcon icon="mdi:shield-outline" class="panel-icon" />
          <span>任务总控</span>
        </div>
        <NButton quaternary circle size="small" @click="emit('toggleCollapse')">
          <template #icon>
            <SvgIcon :icon="collapsed ? 'mdi:chevron-right' : 'mdi:chevron-left'" />
          </template>
        </NButton>
      </div>
    </template>

    <div v-if="!collapsed" class="panel-body">
      <div class="task-title">{{ task.title }}</div>
      <div class="task-summary">{{ task.summary }}</div>

      <div class="hero-grid">
        <div class="hero-item">
          <div class="hero-label">目标建筑</div>
          <div class="hero-value">{{ task.buildingName }}</div>
        </div>
        <div class="hero-item">
          <div class="hero-label">任务编号</div>
          <div class="hero-value">{{ task.code }}</div>
        </div>
        <div class="hero-item">
          <div class="hero-label">执行单元</div>
          <div class="hero-value">{{ task.operator }}</div>
        </div>
        <div class="hero-item">
          <div class="hero-label">更新时间</div>
          <div class="hero-value">{{ task.updatedAt }}</div>
        </div>
      </div>

      <NAlert type="info" :show-icon="false">{{ task.objective }}</NAlert>

      <div class="section-title">我方力量</div>
      <div class="info-list">
        <div v-for="item in forces" :key="item.id" class="info-item">
          <div class="info-head">
            <div class="info-name">
              <SvgIcon :icon="item.icon" />
              <span>{{ item.label }}</span>
            </div>
            <NTag size="small" :type="getToneType(item.tone)">{{ item.value }}</NTag>
          </div>
          <div class="info-desc">{{ item.description }}</div>
        </div>
      </div>

      <div class="section-title">战场环境</div>
      <div class="info-list">
        <div v-for="item in environments" :key="item.id" class="info-item">
          <div class="info-head">
            <div class="info-name">
              <SvgIcon :icon="item.icon" />
              <span>{{ item.label }}</span>
            </div>
            <NTag size="small" :type="getRiskType(item.level)">
              {{ item.level === 'high' ? '高风险' : item.level === 'medium' ? '中风险' : '低风险' }}
            </NTag>
          </div>
          <div class="info-desc">{{ item.description }}</div>
        </div>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
.task-panel {
  width: 324px;
  max-height: min(720px, calc(100vh - 176px));
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(10, 16, 30, 0.82);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(16px);
  overflow: hidden;
}

.task-panel--collapsed {
  width: 186px;
}

.panel-title-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: rgba(255, 255, 255, 0.92);
}

.title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-icon {
  font-size: 16px;
  color: #2b6bff;
}

.panel-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: min(640px, calc(100vh - 260px));
  overflow-y: auto;
  padding-right: 2px;
}

.task-title {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
}

.task-summary,
.info-desc {
  font-size: 12px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.62);
}

.hero-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.hero-item,
.info-item {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 9px 10px;
  background: rgba(255, 255, 255, 0.03);
}

.hero-label,
.section-title {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.58);
}

.hero-value {
  margin-top: 4px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.92);
}

.section-title {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.info-head,
.info-name {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.info-name {
  justify-content: flex-start;
}

.panel-body::-webkit-scrollbar {
  width: 6px;
}

.panel-body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
}
</style>
