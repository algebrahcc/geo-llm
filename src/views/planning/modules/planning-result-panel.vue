<script setup lang="ts">
import type { PlanningRouteKey, PlanningRouteSummary } from './types';

defineOptions({
  name: 'PlanningResultPanel'
});

interface Props {
  collapsed: boolean;
  currentRoute: PlanningRouteKey;
  routes: ReadonlyArray<{ key: PlanningRouteKey; label: string; subtitle: string }>;
  summary: PlanningRouteSummary;
  running: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  selectRoute: [key: PlanningRouteKey];
  toggleCollapse: [];
  exportShot: [];
}>();
</script>

<template>
  <NCard
    :bordered="false"
    size="small"
    class="result-panel"
    :class="[{ 'result-panel--collapsed': collapsed }]"
    :content-style="{ padding: collapsed ? '12px 16px' : '0' }"
  >
    <template #header>
      <div class="panel-title-wrap">
        <div class="title-group">
          <SvgIcon icon="mdi:routes" class="panel-icon" />
          <span>路线结果</span>
        </div>
        <div class="header-actions">
          <NTag :bordered="false" size="small" :type="running ? 'warning' : 'success'">
            {{ running ? '规划中' : '已生成' }}
          </NTag>
          <NButton quaternary circle size="small" @click="emit('toggleCollapse')">
            <template #icon>
              <SvgIcon :icon="collapsed ? 'mdi:chevron-left' : 'mdi:chevron-right'" />
            </template>
          </NButton>
        </div>
      </div>
    </template>

    <div v-if="!collapsed" class="result-panel__scroll">
      <div class="result-panel__body">
        <div class="summary-head">
          <div class="summary-title">{{ summary.title }}</div>
          <div class="summary-subtitle">{{ summary.subtitle }}</div>
          <div class="summary-desc">{{ summary.summary }}</div>
        </div>

        <div class="metric-grid">
          <div v-for="metric in summary.metrics" :key="metric.label" class="metric-card">
            <div class="metric-label">{{ metric.label }}</div>
            <div class="metric-value" :class="[`metric-value--${metric.tone}`]">{{ metric.value }}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">候选路线</div>
          <div class="route-list">
            <button
              v-for="item in routes"
              :key="item.key"
              type="button"
              class="route-button"
              :class="[{ 'route-button--active': item.key === currentRoute }]"
              @click="emit('selectRoute', item.key)"
            >
              <span class="route-label">{{ item.label }}</span>
              <span class="route-subtitle">{{ item.subtitle }}</span>
            </button>
          </div>
        </div>

        <div class="section">
          <div class="section-title">路径亮点</div>
          <div class="text-list">
            <div v-for="item in summary.highlights" :key="item" class="text-item">{{ item }}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">风险说明</div>
          <div class="text-list">
            <div v-for="risk in summary.risks" :key="risk.title" class="risk-item">
              <div class="risk-title">{{ risk.title }}</div>
              <div class="risk-detail">{{ risk.detail }}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">结果操作</div>
          <NButton size="small" secondary block @click="emit('exportShot')">导出当前截图</NButton>
        </div>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
.result-panel {
  width: 360px;
  max-height: calc(100vh - 172px);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(15, 23, 42, 0.82);
  backdrop-filter: blur(14px);
}

.result-panel__scroll {
  max-height: calc(100vh - 220px);
  overflow-y: auto;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: rgba(141, 184, 255, 0.56) rgba(255, 255, 255, 0.06);
}

.result-panel__scroll::-webkit-scrollbar {
  width: 10px;
}

.result-panel__scroll::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(141, 184, 255, 0.72), rgba(43, 107, 255, 0.42));
  background-clip: padding-box;
}

.result-panel__scroll::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(141, 184, 255, 0.9), rgba(43, 107, 255, 0.6));
}

.result-panel__scroll::-webkit-scrollbar-track {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
}

.result-panel__body {
  padding: 12px 16px 16px;
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

.summary-head {
  padding-bottom: 12px;
}

.summary-title {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.94);
}

.summary-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #8db8ff;
}

.summary-desc {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.66);
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.metric-card {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
}

.metric-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.52);
}

.metric-value {
  margin-top: 4px;
  font-size: 16px;
  font-weight: 600;
}

.metric-value--primary {
  color: #8db8ff;
}

.metric-value--success {
  color: #62d89f;
}

.metric-value--warning {
  color: #f7c766;
}

.metric-value--error {
  color: #fb8a9b;
}

.section {
  margin-top: 16px;
}

.section-title {
  margin-bottom: 10px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.54);
  letter-spacing: 0.04em;
}

.route-list {
  display: grid;
  gap: 8px;
}

.route-button {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.88);
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease;
}

.route-button:hover {
  border-color: rgba(141, 184, 255, 0.42);
}

.route-button--active {
  border-color: rgba(43, 107, 255, 0.72);
  background: rgba(43, 107, 255, 0.15);
}

.route-label {
  font-size: 13px;
  font-weight: 600;
}

.route-subtitle {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.58);
}

.text-list {
  display: grid;
  gap: 8px;
}

.text-item,
.risk-item {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
}

.text-item {
  font-size: 12px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.84);
}

.risk-title {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
}

.risk-detail {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.6);
}

.result-panel--collapsed {
  width: 220px;
}
</style>
