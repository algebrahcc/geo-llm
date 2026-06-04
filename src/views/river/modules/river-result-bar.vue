<script setup lang="ts">
import { ref, computed } from 'vue';
import type { CrossingPlanCard } from './types';

const props = defineProps<{
  collapsed: boolean;
  plans: CrossingPlanCard[];
  confidence: number;
}>();

const emit = defineEmits<{
  (e: 'toggle-collapse'): void;
  (e: 'close'): void;
}>();

const expandedCard = ref<number | null>(null);
const expandAll = ref(false);

const allExpanded = computed(() => expandAll.value && props.plans.length > 0);

function toggleCard(rank: number) {
  expandedCard.value = expandedCard.value === rank ? null : rank;
  if (props.plans.every(p => expandedCard.value === p.rank || (expandedCard.value === null && expandAll.value))) {
    expandAll.value = false;
  }
}

function toggleExpandAll() {
  expandAll.value = !expandAll.value;
  expandedCard.value = null;
}

function getStars(stars: number): string {
  return '★'.repeat(stars) + '☆'.repeat(5 - stars);
}

function getSafetyColor(safety: string): string {
  if (safety === '优') return '#22c55e';
  if (safety === '良') return '#3b82f6';
  return '#f59e0b';
}
</script>

<template>
  <div class="result-bar" :class="{ 'result-bar--collapsed': collapsed }">
    <!-- ── 标题栏 ── -->
    <div class="bar-header">
      <span class="header-icon">🏆</span>
      <span class="header-title">渡河方案推荐</span>
      <span v-if="confidence > 0" class="confidence-badge">
        <span class="conf-dot" />
        置信度 {{ confidence }}%
      </span>
      <button
        v-if="plans.length > 0 && !collapsed"
        type="button"
        class="expand-all-btn"
        @click="toggleExpandAll"
      >
        {{ allExpanded ? '折叠全部' : '展开全部' }}
      </button>
      <div class="header-actions">
        <button type="button" class="action-btn" title="折叠" @click="emit('toggle-collapse')">
          <SvgIcon :icon="collapsed ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
        </button>
        <button type="button" class="action-btn" title="关闭" @click="emit('close')">
          <SvgIcon icon="mdi:close" />
        </button>
      </div>
    </div>

    <div v-show="!collapsed" class="bar-content">
      <div v-if="plans.length === 0" class="empty-state">
        <span class="empty-icon">📋</span>
        <span class="empty-text">尚未生成方案，请先在左侧面板提交分析</span>
      </div>

      <template v-else>
        <div class="plan-desc">
          共生成 <strong>{{ plans.length }}</strong> 项可行方案，综合知识库检索与智能体推理分析，按推荐指数排序：
        </div>

        <div class="plan-cards">
          <div
            v-for="plan in plans"
            :key="plan.rank"
            class="plan-card"
            :class="{
              'plan-card--recommended': plan.isRecommended,
              'plan-card--expanded': allExpanded || expandedCard === plan.rank
            }"
          >
            <!-- ══ 卡片内侧容器（展开时切换为行布局） ══ -->
            <div class="card-body" :class="{ 'card-body--row': allExpanded || expandedCard === plan.rank }">
              <!-- ══ 卡片头部（始终可见，折叠态在左侧） ══ -->
              <div class="card-header" @click="toggleCard(plan.rank)">
                <div class="card-header-top">
                  <div class="card-identity">
                    <span class="plan-badge" :class="{ 'plan-badge--gold': plan.isRecommended }">
                      {{ plan.label }}
                    </span>
                    <span v-if="plan.isRecommended" class="recommend-star">★ 推荐</span>
                  </div>
                  <div class="card-stars">{{ getStars(plan.stars) }}</div>
                </div>
                <div class="plan-name">{{ plan.title }}</div>

                <!-- 关键指标条 -->
                <div class="metric-strip">
                  <div class="metric-chip">
                    <span class="chip-icon">⏱</span>
                    <span class="chip-val">{{ plan.duration }}</span>
                    <span class="chip-label">用时</span>
                  </div>
                  <div class="metric-divider" />
                  <div class="metric-chip">
                    <span class="chip-icon">🚛</span>
                    <span class="chip-val">{{ plan.capacity }}</span>
                    <span class="chip-label">能力</span>
                  </div>
                  <div class="metric-divider" />
                  <div class="metric-chip">
                    <span class="chip-icon">🛡</span>
                    <span class="chip-val" :style="{ color: getSafetyColor(plan.safety) }">{{ plan.safety }}</span>
                    <span class="chip-label">安全性</span>
                  </div>
                </div>

                <div class="card-expand-hint">
                  <SvgIcon
                    class="hint-chevron"
                    :icon="(allExpanded || expandedCard === plan.rank) ? 'mdi:chevron-right' : 'mdi:chevron-down'"
                  />
                  <span>{{ (allExpanded || expandedCard === plan.rank) ? '收起' : '查看详情' }}</span>
                </div>
              </div>

              <!-- ══ 展开详情（CSS 过渡高度，避免 v-if 跳变） ══ -->
              <div class="card-detail-wrapper" :class="{ 'card-detail-wrapper--open': allExpanded || expandedCard === plan.rank }">
                <div class="card-detail">
                <div class="detail-grid">
                  <div class="detail-block">
                    <div class="detail-label">📌 推荐场景</div>
                    <div class="detail-text">{{ plan.scenario }}</div>
                  </div>
                  <div class="detail-block">
                    <div class="detail-label">🗺️ 路线说明</div>
                    <div class="detail-text">{{ plan.routeDesc }}</div>
                  </div>
                </div>

                <div class="detail-block">
                  <div class="detail-label">🔧 关键装备</div>
                  <div class="detail-tags">
                    <span v-for="eq in plan.keyEquipment" :key="eq" class="detail-tag">{{ eq }}</span>
                  </div>
                </div>

                <div class="detail-grid detail-grid--cols3">
                  <div class="detail-block">
                    <div class="detail-label detail-label--pos">✅ 优势</div>
                    <ul class="detail-list">
                      <li v-for="(adv, i) in plan.advantages" :key="i">{{ adv }}</li>
                    </ul>
                  </div>
                  <div class="detail-block">
                    <div class="detail-label detail-label--warn">⚠️ 风险</div>
                    <ul class="detail-list detail-list--warn">
                      <li v-for="(risk, i) in plan.risks" :key="i">{{ risk }}</li>
                    </ul>
                  </div>
                  <div class="detail-block">
                    <div class="detail-label detail-label--info">📋 适用条件</div>
                    <ul class="detail-list detail-list--info">
                      <li v-for="(cond, i) in plan.conditions" :key="i">{{ cond }}</li>
                    </ul>
                  </div>
                </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* ──── 根 ──── */
.result-bar {
  width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/* ──── 标题栏 ──── */
.bar-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.header-icon {
  font-size: 16px;
}

.header-title {
  font-size: 13px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
  flex-shrink: 0;
}

.confidence-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
  font-weight: 600;
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.conf-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
}

.expand-all-btn {
  margin-left: auto;
  font-size: 11px;
  padding: 3px 9px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.expand-all-btn:hover {
  border-color: rgba(43, 107, 255, 0.35);
  color: rgba(255, 255, 255, 0.85);
  background: rgba(43, 107, 255, 0.08);
}

.header-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  font-size: 16px;
  transition: background 0.18s, color 0.18s;
}

.action-btn:hover {
  background: rgba(43, 107, 255, 0.15);
  color: rgba(255, 255, 255, 0.85);
}

/* ──── 内容滚动区 ──── */
.bar-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 14px 14px;
  scrollbar-width: thin;
  scrollbar-color: rgba(141, 184, 255, 0.24) transparent;
}

.bar-content::-webkit-scrollbar {
  height: 5px;
}

.bar-content::-webkit-scrollbar-track {
  background: transparent;
}

.bar-content::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(141, 184, 255, 0.24);
}

/* ──── 空状态 ──── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 0;
}

.empty-icon {
  font-size: 28px;
}

.empty-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
}

/* ──── 描述 ──── */
.plan-desc {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.42);
  margin-bottom: 10px;
  line-height: 1.5;
}

.plan-desc strong {
  color: #8db8ff;
}

/* ──── 卡片横排 ──── */
.plan-cards {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 6px;
  scrollbar-width: thin;
  scrollbar-color: rgba(141, 184, 255, 0.16) transparent;
}

.plan-cards::-webkit-scrollbar {
  height: 4px;
}

.plan-cards::-webkit-scrollbar-thumb {
  border-radius: 2px;
  background: rgba(141, 184, 255, 0.16);
}

.plan-card {
  min-width: 280px;
  max-width: 320px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
  transition: border-color 0.25s, box-shadow 0.25s, min-width 0.3s, max-width 0.3s;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.015);
}

.plan-card:hover {
  border-color: rgba(43, 107, 255, 0.28);
}

.plan-card--recommended {
  border-color: rgba(34, 197, 94, 0.25);
  background: rgba(34, 197, 94, 0.02);
}

.plan-card--recommended:hover {
  border-color: rgba(34, 197, 94, 0.4);
}

.plan-card--expanded {
  min-width: 600px;
  max-width: 640px;
}

/* ──── 卡片 body（弹性容器） ──── */
.card-body {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.card-body--row {
  flex-direction: row;
}

/* ──── 卡片头部 ──── */
.card-header {
  padding: 12px 14px;
  cursor: pointer;
  transition: background 0.15s;
  flex-shrink: 0;
}

.card-body--row .card-header {
  width: 280px;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
}

.card-header:hover {
  background: rgba(43, 107, 255, 0.03);
}

.card-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.card-identity {
  display: flex;
  align-items: center;
  gap: 6px;
}

.plan-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(141, 184, 255, 0.1);
  color: #8db8ff;
  font-weight: 700;
  border: 1px solid rgba(141, 184, 255, 0.18);
}

.plan-badge--gold {
  background: rgba(245, 158, 11, 0.12);
  color: #fbbf24;
  border-color: rgba(245, 158, 11, 0.2);
}

.recommend-star {
  font-size: 10px;
  color: #fbbf24;
  font-weight: 600;
}

.card-stars {
  font-size: 11px;
  letter-spacing: 0.5px;
  color: #fbbf24;
}

.plan-name {
  font-size: 14px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 10px;
}

/* ──── 指标条 ──── */
.metric-strip {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.025);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.metric-chip {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.chip-icon {
  font-size: 12px;
  margin-bottom: 2px;
}

.chip-val {
  font-size: 13px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
}

.chip-label {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.35);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.metric-divider {
  width: 1px;
  height: 28px;
  background: rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

/* ──── 展开提示 ──── */
.card-expand-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 10px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  transition: color 0.15s;
}

.card-header:hover .card-expand-hint {
  color: rgba(255, 255, 255, 0.5);
}

.hint-chevron {
  font-size: 14px;
}

/* ──── 详情区域 ──── */
.card-detail-wrapper {
  overflow: hidden;
}

.card-detail-wrapper:not(.card-detail-wrapper--open) {
  max-height: 0;
  opacity: 0;
}

.card-detail-wrapper--open {
  max-height: none;
  opacity: 1;
  transition: opacity 0.2s ease;
}

.card-detail {
  padding: 12px 14px;
  flex: 1;
  overflow-y: auto;
  min-width: 0;
}

.card-body--row .card-detail-wrapper {
  flex: 1;
  min-width: 0;
  max-height: none !important;
  overflow-y: auto;
  border-left: 1px solid rgba(255, 255, 255, 0.06);
}


.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
  margin-bottom: 8px;
}

.detail-grid--cols3 {
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}

.detail-block {
  margin-bottom: 6px;
}

.detail-grid .detail-block {
  margin-bottom: 0;
}

.detail-label {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.55);
  margin-bottom: 4px;
}

.detail-label--warn {
  color: #f59e0b;
}

.detail-label--pos {
  color: #22c55e;
}

.detail-label--info {
  color: #3b82f6;
}

.detail-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.48);
  line-height: 1.55;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.detail-tag {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 5px;
  background: rgba(43, 107, 255, 0.08);
  color: #7da8ff;
  border: 1px solid rgba(43, 107, 255, 0.12);
  font-weight: 500;
}

.detail-list {
  margin: 0;
  padding-left: 14px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.48);
  line-height: 1.6;
}

.detail-list--warn {
  color: rgba(245, 158, 11, 0.7);
}

.detail-list--info {
  color: rgba(59, 130, 246, 0.7);
}

.detail-list li + li {
  margin-top: 2px;
}
</style>
