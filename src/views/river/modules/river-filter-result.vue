<script setup lang="ts">
import { computed } from 'vue';
import type { EngineeringPlan, FilterStep, PortFilterResult } from './types';
import { filterSteps as defaultFilterSteps, engineeringPlans, portFilterResults } from '@/mock/river';

defineOptions({
  name: 'RiverFilterResult'
});

interface Props {
  collapsed: boolean;
  ports?: PortFilterResult[];
  plans?: EngineeringPlan[];
  steps?: FilterStep[];
  running: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  ports: () => portFilterResults,
  plans: () => engineeringPlans,
  steps: () => defaultFilterSteps
});

const emit = defineEmits<{
  compare: [];
  viewDetail: [plan: EngineeringPlan];
}>();

const stepIcons: Record<FilterStep['status'], string> = {
  success: 'mdi:check-circle',
  running: 'mdi:loading',
  waiting: 'mdi:clock-outline'
};

const stepColors: Record<FilterStep['status'], string> = {
  success: '#22c55e',
  running: '#3b82f6',
  waiting: 'rgba(255,255,255,0.2)'
};

function feasibilityColor(f: string) {
  const map: Record<string, string> = {
    可行: '#22c55e',
    较优: '#3b82f6',
    一般: '#f59e0b',
    不可行: '#ef4444'
  };
  return map[f] || '#fff';
}

function feasibilityBg(f: string) {
  const map: Record<string, string> = {
    可行: 'rgba(34,197,94,0.12)',
    较优: 'rgba(59,130,246,0.12)',
    一般: 'rgba(245,158,11,0.12)',
    不可行: 'rgba(239,68,68,0.12)'
  };
  return map[f] || 'transparent';
}

function planBorderColor(plan: EngineeringPlan) {
  return plan.isRecommended ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.06)';
}

const completedSteps = computed(() => props.steps.filter(s => s.status === 'success').length);
const totalSteps = computed(() => props.steps.length);
</script>

<template>
  <NCard
    :bordered="false"
    size="small"
    class="filter-result"
    :class="[{ 'filter-result--collapsed': collapsed }]"
    :content-style="{ padding: 0 }"
  >
    <template #header>
      <div class="panel-title-wrap">
        <div class="title-group">
          <SvgIcon icon="mdi:robot-outline" class="panel-icon" />
          <span>筛选结果</span>
          <span v-if="!running && completedSteps === totalSteps" class="result-badge">
            {{ ports.length }} 港口 · {{ plans.length }} 方案
          </span>
        </div>
        <div class="header-actions">
          <span class="status-dot" :class="running ? 'status-dot--active' : 'status-dot--done'"></span>
          <NTag :bordered="false" size="tiny" :type="running ? 'warning' : 'success'" class="status-tag">
            {{ running ? '筛选中...' : '已完成' }}
          </NTag>
        </div>
      </div>
    </template>

    <div v-if="!collapsed" class="panel-content">
      <!-- ═══ 智能筛选助手 ═══ -->
      <div class="assistant-section">
        <div class="assistant-header">
          <SvgIcon icon="mdi:brain" class="assistant-icon" />
          <span>智能筛选助手</span>
          <span v-if="!running" class="assistant-progress">{{ completedSteps }}/{{ totalSteps }} 步骤完成</span>
        </div>
        <div class="step-tracker">
          <div v-for="(step, idx) in steps" :key="step.key" class="step-item">
            <div class="step-dot-wrap">
              <SvgIcon
                :icon="stepIcons[step.status]"
                class="step-dot"
                :style="{ color: stepColors[step.status] }"
                :class="{ 'step-dot--spin': step.status === 'running', 'step-dot--pop': step.status === 'success' }"
              />
              <div
                v-if="idx < steps.length - 1"
                class="step-line"
                :class="{ 'step-line--done': step.status === 'success' }"
              ></div>
            </div>
            <div class="step-info">
              <div class="step-label" :class="{ 'step-label--done': step.status === 'success' }">{{ step.label }}</div>
              <div v-if="step.status === 'running'" class="step-sub">处理中...</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ 港口分析结果 ═══ -->
      <div class="section">
        <div class="section-title">
          <SvgIcon icon="mdi:anchor" class="section-title-icon" />
          港口分析结果
        </div>
        <div class="port-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th class="col-rank">#</th>
                <th>港口名称</th>
                <th class="col-score">综合评分</th>
                <th>水深(m)</th>
                <th>水宽(m)</th>
                <th>流速</th>
                <th class="col-feas">可行性</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(port, idx) in ports" :key="port.id" class="table-row">
                <td class="col-rank">
                  <span v-if="idx < 3" class="rank-badge" :class="`rank-badge--${idx + 1}`">{{ idx + 1 }}</span>
                  <span v-else>{{ idx + 1 }}</span>
                </td>
                <td class="port-name">{{ port.name }}</td>
                <td class="col-score">
                  <div class="score-bar-wrap">
                    <div class="score-bar-fill" :style="{ width: `${port.score}%` }"></div>
                    <span class="score-value">{{ port.score }}</span>
                  </div>
                </td>
                <td>{{ port.depth }}</td>
                <td>{{ port.width }}</td>
                <td>{{ port.velocity }}m/s</td>
                <td class="col-feas">
                  <span
                    class="feas-tag"
                    :style="{ color: feasibilityColor(port.feasibility), background: feasibilityBg(port.feasibility) }"
                  >
                    {{ port.feasibility }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ═══ 推荐工程方案 Top 3 ═══ -->
      <div class="section">
        <div class="section-title-wrap">
          <div class="section-title">
            <SvgIcon icon="mdi:trophy-outline" class="section-title-icon" />
            推荐工程方案 Top 3
          </div>
          <NButton size="tiny" secondary class="compare-btn" @click="emit('compare')">
            <template #icon><SvgIcon icon="mdi:compare" /></template>
            方案对比
          </NButton>
        </div>
        <div class="plan-cards">
          <div
            v-for="plan in plans"
            :key="plan.rank"
            class="plan-card"
            :class="{ 'plan-card--recommended': plan.isRecommended }"
            :style="{ borderColor: planBorderColor(plan) }"
          >
            <div class="plan-card-header">
              <span class="plan-label">{{ plan.label }}</span>
              <NTag v-if="plan.isRecommended" :bordered="false" size="tiny" type="success">推荐</NTag>
            </div>
            <div class="plan-card-body">
              <div class="plan-row">
                <span class="plan-key">港口</span>
                <span>{{ plan.portName }}</span>
              </div>
              <div class="plan-row">
                <span class="plan-key">工装</span>
                <span>{{ plan.equipmentType }}</span>
              </div>
              <div class="plan-row">
                <span class="plan-key">耗时</span>
                <span>{{ plan.estimatedTime }}</span>
              </div>
              <div class="plan-row">
                <span class="plan-key">保障</span>
                <span>{{ plan.supportAbility }}</span>
              </div>
              <div class="plan-row plan-row--score">
                <span class="plan-key">评分</span>
                <span class="plan-score">{{ plan.score }}</span>
              </div>
            </div>
            <NButton size="tiny" type="primary" block class="plan-detail-btn" @click="emit('viewDetail', plan)">
              查看详情
            </NButton>
          </div>
        </div>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
/* ──── Panel Shell ──── */
.filter-result {
  width: 100% !important;
  border: none !important;
  background: transparent !important;
  backdrop-filter: none !important;
  border-radius: 0 !important;
}

.filter-result :deep(.n-card-header) {
  padding: 14px 16px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.panel-content {
  overflow-y: auto;
  max-height: calc(100vh - 180px);
}

/* ──── Header ──── */
.panel-title-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
}

.panel-icon {
  font-size: 18px;
  color: #3b82f6;
}

.result-badge {
  font-size: 11px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.4);
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.status-tag {
  font-size: 11px !important;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
  transition: background-color 0.3s ease;
}
.status-dot--active {
  background: #f59e0b;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
  animation: pulse-dot 1.4s ease-in-out infinite;
}
.status-dot--done {
  background: #22c55e;
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.4);
  }
}

/* ──── Assistant Section ──── */
.assistant-section {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.assistant-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.assistant-icon {
  font-size: 15px;
  color: #a78bfa;
}
.assistant-progress {
  margin-left: auto;
  font-size: 11px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.36);
  text-transform: none;
}

/* ──── Step Tracker ──── */
.step-tracker {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
}

.step-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 33.33%;
  flex: 1;
}

.step-dot-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}

.step-dot {
  font-size: 18px;
  flex-shrink: 0;
}

.step-dot--spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.step-dot--pop {
  animation: popIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes popIn {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.step-line {
  width: 2px;
  height: 14px;
  margin: 2px 0;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 1px;
}

.step-line--done {
  background: rgba(34, 197, 94, 0.4);
}

.step-info {
  padding-top: 2px;
}

.step-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  white-space: nowrap;
  transition: color 0.18s ease;
}

.step-label--done {
  color: rgba(255, 255, 255, 0.7);
}
.step-sub {
  font-size: 10px;
  color: #3b82f6;
}

/* ──── Sections ──── */
.section {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.section:last-of-type {
  border-bottom: none;
}

.section-title,
.section-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.56);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.section-title-wrap {
  justify-content: space-between;
}
.section-title-icon {
  font-size: 14px;
  color: #3b82f6;
  opacity: 0.6;
}

.compare-btn {
  font-size: 11px !important;
}

/* ──── Port Table ──── */
.port-table-wrap {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.data-table th {
  padding: 8px 10px;
  text-align: left;
  color: rgba(255, 255, 255, 0.4);
  font-weight: 500;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  white-space: nowrap;
}

.data-table td {
  padding: 8px 10px;
  color: rgba(255, 255, 255, 0.78);
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  white-space: nowrap;
}

.table-row {
  transition: background-color 0.14s ease;
}
.table-row:hover {
  background: rgba(59, 130, 246, 0.06);
}

/* Rank badges */
.col-rank {
  width: 40px;
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
}

.rank-badge--1 {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #0f172a;
}
.rank-badge--2 {
  background: linear-gradient(135deg, #94a3b8, #64748b);
  color: #0f172a;
}
.rank-badge--3 {
  background: linear-gradient(135deg, #b45309, #92400e);
  color: #0f172a;
}

.port-name {
  font-weight: 600;
}

/* Score bar */
.col-score {
  width: 100px;
}

.score-bar-wrap {
  position: relative;
  height: 20px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 4px;
  overflow: hidden;
}

.score-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, rgba(59, 130, 246, 0.3), rgba(59, 130, 246, 0.5));
  border-radius: 4px;
  transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.score-value {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
}

.col-feas {
  width: 72px;
}

.feas-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}

/* ──── Plan Cards ──── */
.plan-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.plan-card {
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    transform 0.18s ease;
}

.plan-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.plan-card--recommended {
  box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.15);
}

.plan-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.plan-label {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.plan-card-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.plan-row {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.72);
}

.plan-key {
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.36);
  min-width: 28px;
}

.plan-row--score {
  padding-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.plan-score {
  font-weight: 700;
  font-size: 14px;
  color: #3b82f6;
}

.plan-detail-btn {
  margin-top: 2px;
  font-size: 11px;
}

.filter-result--collapsed {
  width: 100% !important;
}
</style>
