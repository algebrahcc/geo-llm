<script setup lang="ts">
import { ref } from 'vue';
import { planningPlanADetailSegments, planningPlanATotalDistance, planningPlanATotalDuration } from '@/mock/planning';
import PlanningPlanCards from './planning-plan-cards.vue';
import PlanningRouteDetailTable from './planning-route-detail-table.vue';
import type { PlanningPlanKey, PlanningPlanResult, PlanningMissionResultSummary } from './types';

defineOptions({
  name: 'PlanningMissionResult'
});

interface Props {
  plans: readonly PlanningPlanResult[];
  selectedPlan: PlanningPlanKey;
  summary: PlanningMissionResultSummary;
  running: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  selectPlan: [key: PlanningPlanKey];
  viewDetail: [key: PlanningPlanKey];
  setAsExecute: [key: PlanningPlanKey];
}>();

const activeResultTab = ref<'recommend' | 'compare'>('recommend');
</script>

<template>
  <div class="mission-result">
    <div class="mission-result__scroll">
      <div class="mission-result__body">
        <!-- 标题 -->
        <div class="result-header">
          <SvgIcon icon="mdi:routes" class="header-icon" />
          <span class="header-title">智能规划结果</span>
        </div>

        <!-- 方案推荐/方案对比 Tab -->
        <div class="result-tabs">
          <button
            type="button"
            class="result-tab"
            :class="{ 'result-tab--active': activeResultTab === 'recommend' }"
            @click="activeResultTab = 'recommend'"
          >
            方案推荐
          </button>
          <button
            type="button"
            class="result-tab"
            :class="{ 'result-tab--active': activeResultTab === 'compare' }"
            @click="activeResultTab = 'compare'"
          >
            方案对比
          </button>
        </div>

        <!-- 摘要信息 -->
        <div class="result-summary">
          <div class="summary-item">
            <span class="summary-label">推荐方案总数</span>
            <span class="summary-value">{{ summary.totalPlans }} 条</span>
          </div>
          <div class="summary-divider"></div>
          <div class="summary-item">
            <span class="summary-label">综合最优方案</span>
            <span class="summary-value summary-value--highlight">{{ summary.bestPlan }}</span>
          </div>
          <div class="summary-divider"></div>
          <div class="summary-item">
            <span class="summary-label">综合评分</span>
            <span class="summary-value summary-value--score">
              {{ summary.bestScore }}<span class="score-unit">/100</span>
            </span>
          </div>
        </div>

        <!-- 方案卡片 -->
        <PlanningPlanCards
          :plans="plans"
          :selected-plan="selectedPlan"
          @select-plan="emit('selectPlan', $event)"
          @view-detail="emit('viewDetail', $event)"
          @set-as-execute="emit('setAsExecute', $event)"
        />

        <!-- 备注 -->
        <div class="result-note">
          注：评分综合考虑用时、距离、路况、风险等因素
        </div>

        <!-- 详细路线表格 -->
        <PlanningRouteDetailTable
          :segments="planningPlanADetailSegments"
          :total-distance="planningPlanATotalDistance"
          :total-duration="planningPlanATotalDuration"
          plan-label="方案一"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.mission-result {
  width: 380px;
  max-height: calc(100vh - 100px);
  border: 1px solid rgba(41, 163, 255, 0.15);
  border-radius: 8px;
  background: rgba(6, 29, 56, 0.92);
  backdrop-filter: blur(16px);
  overflow: hidden;
}

.mission-result__scroll {
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: rgba(41, 163, 255, 0.4) rgba(255, 255, 255, 0.06);
}

.mission-result__scroll::-webkit-scrollbar {
  width: 6px;
}

.mission-result__scroll::-webkit-scrollbar-thumb {
  border-radius: 3px;
  background: rgba(41, 163, 255, 0.4);
}

.mission-result__scroll::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.06);
}

.mission-result__body {
  padding: 16px;
}

/* 标题 */
.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.header-icon {
  font-size: 18px;
  color: #29b6ff;
}

.header-title {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.94);
}

/* Tab */
.result-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 14px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  padding: 3px;
}

.result-tab {
  flex: 1;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.56);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.result-tab:hover {
  color: rgba(255, 255, 255, 0.8);
}

.result-tab--active {
  background: rgba(41, 163, 255, 0.2);
  color: #29b6ff;
  font-weight: 500;
}

/* 摘要 */
.result-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid rgba(41, 163, 255, 0.1);
  border-radius: 6px;
  background: rgba(41, 163, 255, 0.04);
  margin-bottom: 14px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.summary-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.48);
  margin-bottom: 4px;
}

.summary-value {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
}

.summary-value--highlight {
  color: #2ee59d;
}

.summary-value--score {
  color: #29b6ff;
}

.score-unit {
  font-size: 11px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.48);
}

.summary-divider {
  width: 1px;
  height: 28px;
  background: rgba(41, 163, 255, 0.15);
  flex-shrink: 0;
}

/* 备注 */
.result-note {
  margin-top: 12px;
  margin-bottom: 16px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  font-style: italic;
}
</style>
