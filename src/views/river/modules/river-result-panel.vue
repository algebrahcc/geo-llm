<script setup lang="ts">
import type { RiverPlanKey, RiverPlanSummary } from './types';

defineOptions({
  name: 'RiverResultPanel'
});

interface Props {
  collapsed: boolean;
  currentPlan: RiverPlanKey;
  plans: ReadonlyArray<{ key: RiverPlanKey; label: string; subtitle: string }>;
  summary: RiverPlanSummary;
  running: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  selectPlan: [key: RiverPlanKey];
  toggleCollapse: [];
  exportShot: [];
  generateMark: [];
}>();
</script>

<template>
  <NCard
    :bordered="false"
    size="small"
    class="result-panel"
    :class="[{ 'result-panel--collapsed': collapsed }]"
    :content-style="{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }"
  >
    <template #header>
      <div class="panel-title-wrap">
        <div class="title-group">
          <SvgIcon icon="mdi:chart-timeline-variant-shimmer" class="panel-icon" />
          <span>方案结果</span>
        </div>
        <div class="header-actions">
          <NTag :bordered="false" size="small" :type="running ? 'warning' : 'success'">
            {{ running ? '推演中' : '已生成' }}
          </NTag>
          <NButton quaternary circle size="small" @click="emit('toggleCollapse')">
            <template #icon>
              <SvgIcon :icon="collapsed ? 'mdi:chevron-left' : 'mdi:chevron-right'" />
            </template>
          </NButton>
        </div>
      </div>
    </template>

    <div v-if="!collapsed">
      <div class="summary-head">
        <div class="summary-title">{{ summary.title }}</div>
        <div class="summary-desc">{{ summary.summary }}</div>
      </div>

      <div class="metric-grid">
        <div v-for="metric in summary.metrics" :key="metric.label" class="metric-card">
          <div class="metric-label">{{ metric.label }}</div>
          <div class="metric-value" :class="[`metric-value--${metric.tone}`]">{{ metric.value }}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">方案切换</div>
        <div class="plan-list">
          <button
            v-for="item in plans"
            :key="item.key"
            type="button"
            class="plan-button"
            :class="[{ 'plan-button--active': item.key === currentPlan }]"
            @click="emit('selectPlan', item.key)"
          >
            <span class="plan-label">{{ item.label }}</span>
            <span class="plan-subtitle">{{ item.subtitle }}</span>
          </button>
        </div>
      </div>

      <div class="section">
        <div class="section-title">建议动作</div>
        <div class="text-list">
          <div v-for="action in summary.actions" :key="action" class="text-item">{{ action }}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">风险提示</div>
        <div class="text-list">
          <div v-for="risk in summary.risks" :key="risk.title" class="risk-item">
            <div class="risk-title">{{ risk.title }}</div>
            <div class="risk-detail">{{ risk.detail }}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">标注 / 材料</div>
        <div class="material-actions">
          <NButton size="small" secondary @click="emit('generateMark')">生成标注</NButton>
          <NButton size="small" secondary @click="emit('exportShot')">导出截图</NButton>
        </div>
        <div class="material-list">
          <div v-for="item in summary.materials" :key="item.id" class="material-item">
            <div class="material-name">{{ item.name }}</div>
            <div class="material-meta">{{ item.type }} · {{ item.status }}</div>
          </div>
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

.result-panel :deep(.n-card__content) {
  scrollbar-width: thin;
  scrollbar-color: rgba(141, 184, 255, 0.38) rgba(255, 255, 255, 0.05);
}

.result-panel :deep(.n-card__content::-webkit-scrollbar) {
  width: 8px;
}

.result-panel :deep(.n-card__content::-webkit-scrollbar-thumb) {
  border: 2px solid transparent;
  border-radius: 999px;
  background: rgba(141, 184, 255, 0.38);
  background-clip: padding-box;
}

.result-panel :deep(.n-card__content::-webkit-scrollbar-track) {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
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

.plan-list {
  display: grid;
  gap: 8px;
}

.plan-button {
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

.plan-button:hover,
.plan-button--active {
  border-color: rgba(43, 107, 255, 0.52);
  background: rgba(43, 107, 255, 0.12);
}

.plan-label {
  font-size: 13px;
}

.plan-subtitle {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.56);
}

.text-list {
  display: grid;
  gap: 8px;
}

.text-item,
.risk-item,
.material-item {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
}

.text-item {
  font-size: 12px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.84);
}

.risk-title,
.material-name {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
}

.risk-detail,
.material-meta {
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.56);
}

.material-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.material-list {
  display: grid;
  gap: 8px;
}

.result-panel--collapsed {
  width: 220px;
}
</style>
