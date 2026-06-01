<script setup lang="ts">
import type { PlanningPlanKey, PlanningPlanResult } from './types';

defineOptions({
  name: 'PlanningPlanCards'
});

interface Props {
  plans: readonly PlanningPlanResult[];
  selectedPlan: PlanningPlanKey;
}

defineProps<Props>();

const emit = defineEmits<{
  selectPlan: [key: PlanningPlanKey];
  viewDetail: [key: PlanningPlanKey];
  setAsExecute: [key: PlanningPlanKey];
}>();
</script>

<template>
  <div class="plan-cards">
    <div
      v-for="plan in plans"
      :key="plan.key"
      class="plan-card"
      :class="{
        'plan-card--selected': plan.key === selectedPlan,
        'plan-card--recommended': plan.isRecommended
      }"
      @click="emit('selectPlan', plan.key)"
    >
      <!-- 卡片头部 -->
      <div class="plan-card__header">
        <div class="plan-card__title-row">
          <span class="plan-card__label">
            {{ plan.label }}
            <template v-if="plan.isRecommended">（推荐）</template>
          </span>
          <span class="plan-card__tag" :class="`plan-card__tag--${plan.tagType}`">
            {{ plan.tag }}
          </span>
        </div>
        <div class="plan-card__score">
          综合评分：<span class="plan-card__score-value">{{ plan.score }}</span>
        </div>
      </div>

      <!-- 指标网格 -->
      <div class="plan-card__metrics">
        <div v-for="metric in plan.metrics" :key="metric.label" class="metric-item">
          <span class="metric-value">{{ metric.value }}</span>
          <span class="metric-label">{{ metric.unit || metric.label }}</span>
        </div>
      </div>

      <!-- 路线描述 -->
      <div class="plan-card__route">
        <div class="route-label">路线：</div>
        <div class="route-desc">{{ plan.routeDescription }}</div>
      </div>
      <div class="plan-card__roads">
        <div class="roads-label">主要道路：</div>
        <div class="roads-desc">{{ plan.mainRoads }}</div>
      </div>

      <!-- 操作按钮 -->
      <div class="plan-card__actions">
        <NButton
          size="small"
          secondary
          class="action-btn"
          @click.stop="emit('viewDetail', plan.key)"
        >
          查看详情
        </NButton>
        <NButton
          size="small"
          type="primary"
          class="action-btn action-btn--primary"
          @click.stop="emit('setAsExecute', plan.key)"
        >
          设为执行方案
        </NButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plan-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.plan-card {
  border: 1px solid rgba(41, 163, 255, 0.12);
  border-radius: 8px;
  padding: 14px 16px;
  background: rgba(6, 29, 56, 0.7);
  cursor: pointer;
  transition: all 0.25s ease;
}

.plan-card:hover {
  border-color: rgba(41, 163, 255, 0.3);
  background: rgba(6, 29, 56, 0.85);
}

.plan-card--selected {
  border-color: rgba(41, 163, 255, 0.5);
  background: rgba(41, 163, 255, 0.08);
}

.plan-card--recommended {
  border-color: rgba(46, 229, 157, 0.3);
}

.plan-card--recommended.plan-card--selected {
  border-color: rgba(46, 229, 157, 0.5);
  background: rgba(46, 229, 157, 0.06);
}

.plan-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.plan-card__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.plan-card__label {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.94);
}

.plan-card--recommended .plan-card__label {
  color: #2ee59d;
}

.plan-card__tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.plan-card__tag--success {
  background: rgba(46, 229, 157, 0.15);
  color: #2ee59d;
}

.plan-card__tag--info {
  background: rgba(41, 163, 255, 0.15);
  color: #29b6ff;
}

.plan-card__tag--warning {
  background: rgba(247, 194, 102, 0.15);
  color: #f7c766;
}

.plan-card__score {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.56);
}

.plan-card__score-value {
  font-size: 16px;
  font-weight: 700;
  color: #29b6ff;
  margin-left: 4px;
}

.plan-card__metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.metric-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px;
  border: 1px solid rgba(41, 163, 255, 0.1);
  border-radius: 6px;
  background: rgba(41, 163, 255, 0.04);
}

.metric-value {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
}

.metric-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.48);
  margin-top: 2px;
}

.plan-card__route,
.plan-card__roads {
  display: flex;
  gap: 6px;
  margin-bottom: 4px;
  font-size: 12px;
  line-height: 1.6;
}

.route-label,
.roads-label {
  color: rgba(255, 255, 255, 0.48);
  flex-shrink: 0;
}

.route-desc,
.roads-desc {
  color: rgba(255, 255, 255, 0.78);
}

.plan-card__actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.action-btn {
  flex: 1;
}

.action-btn--primary {
  background: linear-gradient(135deg, rgba(41, 163, 255, 0.3) 0%, rgba(43, 107, 255, 0.3) 100%);
}
</style>
