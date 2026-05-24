<script setup lang="ts">
import type { GlobeLogEntry } from './types';

defineOptions({
  name: 'GlobeAnalysisPanel'
});

interface Props {
  logs: GlobeLogEntry[];
  running: boolean;
  collapsed: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  analyze: [];
  generateMark: [];
  exportShot: [];
  toggleCollapse: [];
}>();
</script>

<template>
  <NCard :bordered="false" size="small" class="analysis-panel" :class="[{ 'analysis-panel--collapsed': collapsed }]">
    <template #header>
      <div class="panel-title-wrap">
        <div class="title-group">
          <SvgIcon icon="mdi:robot-outline" class="panel-icon" />
          <span>AI 分析助手</span>
        </div>
        <div class="header-actions">
          <NTag :bordered="false" size="small" :type="running ? 'warning' : 'success'">
            {{ running ? '运行中' : '待命' }}
          </NTag>
          <NButton quaternary circle size="small" @click="emit('toggleCollapse')">
            <template #icon>
              <SvgIcon :icon="collapsed ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
            </template>
          </NButton>
        </div>
      </div>
    </template>

    <div v-if="!collapsed">
      <div class="panel-desc">在当前视角下发起分析、生成标注或导出截图。</div>

      <div class="action-row">
        <NButton type="primary" size="small" :loading="running" @click="emit('analyze')">开始分析</NButton>
        <NButton size="small" secondary @click="emit('generateMark')">生成标注</NButton>
        <NButton size="small" secondary @click="emit('exportShot')">导出截图</NButton>
      </div>

      <div class="log-list">
        <div v-if="logs.length === 0" class="empty-log">分析日志将在这里展示</div>
        <div v-for="log in logs" :key="log.id" class="log-item">
          <span class="log-dot" :class="[`log-dot--${log.status}`]"></span>
          <div class="log-content">
            <div class="log-text">{{ log.text }}</div>
            <div class="log-time">{{ log.time }}</div>
          </div>
        </div>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
.analysis-panel {
  width: 340px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(12px);
}

.panel-title-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.92);
}

.panel-icon {
  font-size: 16px;
  color: #2b6bff;
}

.panel-desc {
  font-size: 12px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.68);
}

.action-row {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.log-list {
  margin-top: 14px;
  display: flex;
  max-height: 200px;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.empty-log {
  border: 1px dashed rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 14px 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.48);
  text-align: center;
}

.log-item {
  display: flex;
  gap: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
}

.log-dot {
  margin-top: 4px;
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 999px;
}

.log-dot--running {
  background: #fbbf24;
}

.log-dot--success {
  background: #2ee59d;
}

.log-content {
  min-width: 0;
  flex: 1;
}

.log-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.88);
}

.log-time {
  margin-top: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.48);
}

.analysis-panel--collapsed {
  width: 260px;
}
</style>
