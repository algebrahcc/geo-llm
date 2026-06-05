<script setup lang="ts">
import { planningRouteResultCards } from '@/mock/planning';
import type { PlanningRouteResultCard } from './types';

defineOptions({
  name: 'PlanningRouteResultBar'
});

interface Props {
  collapsed?: boolean;
  selectedKey?: string | null;
  cards?: readonly PlanningRouteResultCard[];
}

const props = withDefaults(defineProps<Props>(), {
  collapsed: false,
  selectedKey: null,
  cards: () => planningRouteResultCards
});

const emit = defineEmits<{
  toggleCollapse: [];
  select: [key: string];
}>();

function getScoreColor(score: number): string {
  if (score >= 90) return '#2ee59d';
  if (score >= 80) return '#29b6ff';
  return '#fbbf24';
}
</script>

<template>
  <div class="route-result-bar" :class="{ 'route-result-bar--collapsed': collapsed }">
    <!-- 折叠态触发器 -->
    <template v-if="collapsed">
      <button type="button" class="bar-trigger" @click="emit('toggleCollapse')">
        <SvgIcon icon="mdi:routes" />
        机动规划方案推荐 · {{ cards.length }}个方案
        <SvgIcon icon="mdi:chevron-up" />
      </button>
    </template>

    <!-- 展开态 -->
    <template v-else>
      <!-- 标题栏 -->
      <div class="bar-header">
        <div class="bar-title">
          <SvgIcon icon="mdi:routes" class="bar-title-icon" />
          <span>机动规划方案推荐</span>
        </div>
        <button type="button" class="bar-close-btn" @click="emit('toggleCollapse')">
          <SvgIcon icon="mdi:chevron-down" />
        </button>
      </div>

      <!-- 方案卡片列表 -->
      <div class="cards-scroll">
        <div
          v-for="card in cards"
          :key="card.key"
          class="plan-card"
          :class="{
            'plan-card--selected': selectedKey === card.key,
            'plan-card--recommended': card.isRecommended
          }"
          @click="emit('select', card.key)"
        >
          <!-- 卡片头部 -->
          <div class="card-header">
            <span class="card-title">{{ card.title }}</span>
            <span class="card-subtitle">{{ card.subtitle }}</span>
            <span v-if="card.isRecommended" class="card-tag card-tag--recommend">{{ card.tag }}</span>
            <span v-else class="card-tag" :class="`card-tag--${card.tagType}`">{{ card.tag }}</span>
          </div>

          <!-- 指标行 -->
          <div class="card-metrics">
            <div class="metric">
              <span class="metric-value metric-value--time">{{ card.duration }}</span>
              <span class="metric-label">耗时</span>
            </div>
            <div class="metric-divider" />
            <div class="metric">
              <span class="metric-value metric-value--dist">{{ card.distance }}</span>
              <span class="metric-label">距离</span>
            </div>
            <div class="metric-divider" />
            <div class="metric">
              <span class="metric-value" :style="{ color: getScoreColor(card.score) }">{{ card.score }}</span>
              <span class="metric-label">综合分</span>
            </div>
          </div>

          <!-- 亮点 -->
          <div class="card-highlights">
            <div v-for="(h, i) in card.highlights.slice(0, 3)" :key="i" class="highlight-item">
              <span class="highlight-dot" />
              {{ h }}
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.route-result-bar {
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  background: rgba(8, 14, 26, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(14px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
  overflow: hidden;
}

/* 折叠触发器 */
.bar-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.18s;
}

.bar-trigger:hover {
  color: rgba(255, 255, 255, 0.92);
}

/* 标题栏 */
.bar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.bar-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.88);
}

.bar-title-icon {
  font-size: 16px;
  color: #29b6ff;
}

.bar-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  font-size: 16px;
  transition: all 0.18s;
}

.bar-close-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
}

/* 卡片滚动区 */
.cards-scroll {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(141, 184, 255, 0.2) transparent;
}

.cards-scroll::-webkit-scrollbar {
  height: 4px;
}

.cards-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(141, 184, 255, 0.2);
}

/* 方案卡片 */
.plan-card {
  min-width: 280px;
  max-width: 320px;
  padding: 14px 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.plan-card:hover {
  border-color: rgba(41, 163, 255, 0.3);
  background: rgba(41, 163, 255, 0.04);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.plan-card--selected {
  border-color: #29b6ff;
  background: rgba(41, 163, 255, 0.08);
  box-shadow: 0 0 0 1px rgba(41, 163, 255, 0.3);
}

.plan-card--recommended {
  border-color: rgba(46, 229, 157, 0.25);
}

/* 卡片头部 */
.card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.card-title {
  font-size: 14px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
}

.card-subtitle {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
}

.card-tag {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  margin-left: auto;
}

.card-tag--recommend {
  background: rgba(46, 229, 157, 0.15);
  color: #2ee59d;
  border: 1px solid rgba(46, 229, 157, 0.25);
}

.card-tag--success {
  background: rgba(46, 229, 157, 0.1);
  color: #2ee59d;
}

.card-tag--info {
  background: rgba(41, 163, 255, 0.1);
  color: #29b6ff;
}

.card-tag--warning {
  background: rgba(251, 191, 36, 0.1);
  color: #fbbf24;
}

/* 指标行 */
.card-metrics {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 10px;
  padding: 8px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.metric {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.metric-value {
  font-size: 14px;
  font-weight: 700;
}

.metric-value--time {
  color: #fb923c;
}

.metric-value--dist {
  color: #29b6ff;
}

.metric-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
}

.metric-divider {
  width: 1px;
  height: 28px;
  background: rgba(255, 255, 255, 0.06);
}

/* 亮点 */
.card-highlights {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.highlight-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.4;
}

.highlight-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #29b6ff;
  flex-shrink: 0;
}
</style>
