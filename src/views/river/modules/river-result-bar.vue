<script setup lang="ts">
import { ref, computed } from 'vue';
import type { CrossingPlanCard, RejectedRouteData, RiverPlanKey } from './types';

const props = defineProps<{
  collapsed: boolean;
  plans: CrossingPlanCard[];
  confidence: number;
  activeKey?: RiverPlanKey;
  /** 被淘汰的渡河方式（含路线数据，可点击在地图上查看） */
  rejected?: RejectedRouteData[];
  /** 当前聚焦的淘汰项 id */
  activeRejectedId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'toggle-collapse'): void;
  (e: 'close'): void;
  (e: 'select', planKey: RiverPlanKey): void;
  (e: 'select-rejected', id: string): void;
}>();

const expandedCard = ref<number | null>(null);
const expandAll = ref(false);
const showRejected = ref(false);

// 军用设计原则：方案默认折叠，点击卡片展开详情；"展开全部"供比选

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

function toggleRejected() {
  showRejected.value = !showRejected.value;
}
</script>

<template>
  <div class="result-bar" :class="{ 'result-bar--collapsed': collapsed }">
    <!-- ── 标题栏 ── -->
    <div class="bar-header">
      <span class="header-title">渡河方案推荐</span>
      <span v-if="confidence > 0" class="confidence-badge">置信度 {{ confidence }}%</span>
      <button v-if="plans.length > 0 && !collapsed" type="button" class="expand-all-btn" @click="toggleExpandAll">
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
        <span class="empty-text">尚未生成方案，请先在左侧面板提交分析</span>
      </div>

      <template v-else>
        <!-- ══ 已淘汰方式（可点击查看路线） ══ -->
        <div v-if="rejected && rejected.length > 0" class="rejected-section">
          <div class="rejected-header" @click="toggleRejected">
            <SvgIcon class="rejected-chevron" :icon="showRejected ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
            <span class="rejected-title">已淘汰 {{ rejected.length }} 项不可行方式</span>
            <span class="rejected-hint">点击查看路线</span>
          </div>
          <Transition name="collapse">
            <div v-show="showRejected" class="rejected-list">
              <div
                v-for="r in rejected"
                :key="r.id"
                class="rejected-item"
                :class="{ 'rejected-item--active': r.id === props.activeRejectedId }"
                @click="emit('select-rejected', r.id)"
              >
                <div class="rejected-row">
                  <span class="rejected-name">{{ r.name }}</span>
                  <span class="rejected-reason">{{ r.reason }}</span>
                  <SvgIcon class="rejected-locate" icon="mdi:crosshairs-gps" />
                </div>
                <div v-if="r.detail.length" class="rejected-detail">
                  <span v-for="(d, j) in r.detail" :key="j" class="rejected-calc">{{ d }}</span>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <div class="plan-cards">
          <div
            v-for="plan in plans"
            :key="plan.rank"
            class="plan-card"
            :class="{ 'plan-card--recommended': plan.isRecommended, 'plan-card--active': plan.key === props.activeKey }"
          >
            <div class="card-body">
              <!-- ══ 卡片头部（默认折叠：编号 + 名称 + 三项关键指标） ══ -->
              <div
                class="card-header"
                @click="
                  toggleCard(plan.rank);
                  emit('select', plan.key);
                "
              >
                <div class="card-header-top">
                  <div class="card-identity">
                    <span class="plan-badge">{{ plan.label }}</span>
                    <span v-if="plan.isRecommended" class="recommend-flag">主推</span>
                  </div>
                  <SvgIcon
                    class="hint-chevron"
                    :icon="allExpanded || expandedCard === plan.rank ? 'mdi:chevron-up' : 'mdi:chevron-down'"
                  />
                </div>
                <div class="plan-name">{{ plan.title }}</div>

                <!-- 关键指标条（重点因素：数值大字加粗，标签小字置灰） -->
                <div class="metric-strip">
                  <div class="metric-chip">
                    <span class="chip-val">{{ plan.duration }}</span>
                    <span class="chip-label">完成用时</span>
                  </div>
                  <div class="metric-divider" />
                  <div class="metric-chip">
                    <span class="chip-val">{{ plan.capacity }}</span>
                    <span class="chip-label">渡河运力</span>
                  </div>
                  <div class="metric-divider" />
                  <div class="metric-chip">
                    <span
                      class="chip-val"
                      :class="{
                        'chip-val--s-you': plan.safety === '优',
                        'chip-val--s-liang': plan.safety === '良',
                        'chip-val--s-zhong': plan.safety === '中',
                        'chip-val--s-cha': plan.safety === '差'
                      }"
                    >
                      {{ plan.safety }}
                    </span>
                    <span class="chip-label">安全性</span>
                  </div>
                </div>

                <div v-if="!(allExpanded || expandedCard === plan.rank)" class="card-expand-hint">展开详情</div>
              </div>

              <!-- ══ 展开详情 ══ -->
              <div
                class="card-detail-wrapper"
                :class="{ 'card-detail-wrapper--open': allExpanded || expandedCard === plan.rank }"
              >
                <div class="card-detail">
                  <div class="detail-grid">
                    <div class="detail-block">
                      <div class="detail-label">态势与场景</div>
                      <div class="detail-text">{{ plan.scenario }}</div>
                    </div>
                    <div class="detail-block detail-block--key">
                      <div class="detail-label">机动路线</div>
                      <div class="detail-text">{{ plan.routeDesc }}</div>
                    </div>
                  </div>

                  <div class="detail-block">
                    <div class="detail-label">关键装备</div>
                    <div class="detail-tags">
                      <span v-for="eq in plan.keyEquipment" :key="eq" class="detail-tag">{{ eq }}</span>
                    </div>
                  </div>

                  <div class="detail-grid detail-grid--cols3">
                    <div class="detail-block detail-block--adv">
                      <div class="detail-label detail-label--adv">优势</div>
                      <ul class="detail-list">
                        <li v-for="(adv, i) in plan.advantages" :key="i">{{ adv }}</li>
                      </ul>
                    </div>
                    <div class="detail-block detail-block--risk">
                      <div class="detail-label detail-label--risk">风险</div>
                      <ul class="detail-list">
                        <li v-for="(risk, i) in plan.risks" :key="i">{{ risk }}</li>
                      </ul>
                    </div>
                    <div class="detail-block detail-block--cond">
                      <div class="detail-label">适用条件</div>
                      <ul class="detail-list">
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
  background: rgba(93, 140, 200, 0.1);
  color: #9db8dd;
  font-weight: 600;
  border: 1px solid rgba(93, 140, 200, 0.35);
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
  transition:
    background 0.18s,
    color 0.18s;
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

/* ──── 卡片竖排 ──── */
.plan-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 6px;
}

.plan-card {
  width: 100%;
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
  transition:
    border-color 0.25s,
    box-shadow 0.25s;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.015);
}

.plan-card:hover {
  border-color: rgba(43, 107, 255, 0.28);
}

.plan-card--recommended {
  border-color: rgba(93, 140, 200, 0.42);
  background: rgba(93, 140, 200, 0.05);
}

.plan-card--recommended:hover {
  border-color: rgba(93, 140, 200, 0.6);
}

.plan-card--active {
  border-color: rgba(93, 140, 200, 0.6);
  box-shadow: 0 0 0 1px rgba(93, 140, 200, 0.2);
  background: rgba(93, 140, 200, 0.06);
}

.plan-card--active.plan-card--recommended {
  border-color: rgba(93, 140, 200, 0.72);
  box-shadow: 0 0 0 1px rgba(93, 140, 200, 0.26);
}

/* ──── 卡片 body（弹性容器） ──── */
.card-body {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* ──── 卡片头部 ──── */
.card-header {
  padding: 12px 14px;
  cursor: pointer;
  transition: background 0.15s;
  flex-shrink: 0;
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
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
  font-weight: 700;
  letter-spacing: 0.06em;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.recommend-flag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  color: #fff;
  font-weight: 700;
  letter-spacing: 0.08em;
  background: #3d6fb4;
  border: 1px solid rgba(147, 178, 220, 0.55);
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

.chip-val {
  font-size: 14px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  font-variant-numeric: tabular-nums;
}

.chip-val--s-you {
  color: #6aae8a;
}
.chip-val--s-liang {
  color: #7f9fc9;
}
.chip-val--s-zhong {
  color: #c9a45c;
}
.chip-val--s-cha {
  color: #c25b5b;
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

.detail-label {
  border-left: 2px solid rgba(93, 140, 200, 0.55);
  padding-left: 6px;
  color: rgba(180, 202, 230, 0.85);
}

.detail-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.55;
}

/* 优势=绿 */
.detail-block--adv .detail-label--adv {
  border-left-color: rgba(106, 174, 138, 0.9);
  color: #6aae8a;
  font-weight: 700;
}

.detail-block--adv .detail-list {
  color: rgba(168, 205, 182, 0.8);
}

/* 风险=黄 */
.detail-block--risk .detail-label--risk {
  border-left-color: rgba(201, 164, 92, 0.9);
  color: #c9a45c;
  font-weight: 700;
}

.detail-block--risk .detail-list {
  color: rgba(210, 193, 152, 0.82);
}

/* 重点要素：机动路线（方案核心动作） */
.detail-block--key .detail-label {
  border-left-color: rgba(120, 170, 230, 0.95);
  color: rgba(255, 255, 255, 0.92);
  font-weight: 700;
}

.detail-block--key .detail-text {
  font-size: 12.5px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.96);
  line-height: 1.6;
}

/* 次级强调：适用条件（硬约束） */
.detail-block--cond .detail-label {
  border-left-color: rgba(201, 164, 92, 0.75);
  color: rgba(255, 255, 255, 0.85);
  font-weight: 600;
}

.detail-block--cond .detail-list {
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.82);
  font-weight: 500;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.detail-tag {
  font-size: 10.5px;
  padding: 2px 7px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.18);
  font-weight: 600;
}

.detail-list {
  margin: 0;
  padding-left: 14px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.58);
  line-height: 1.6;
}

.detail-list li + li {
  margin-top: 2px;
}

/* ──── 已淘汰方式 ──── */
.rejected-section {
  margin: 10px 0 12px;
  border: 1px solid rgba(239, 68, 68, 0.15);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(239, 68, 68, 0.03);
}

.rejected-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}

.rejected-header:hover {
  background: rgba(239, 68, 68, 0.06);
}

.rejected-chevron {
  font-size: 14px;
  color: rgba(239, 68, 68, 0.6);
}

.rejected-title {
  flex: 1;
  font-size: 11px;
  font-weight: 600;
  color: rgba(239, 68, 68, 0.8);
}

.rejected-hint {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  font-weight: 400;
}

.rejected-list {
  padding: 6px 12px 10px;
  border-top: 1px solid rgba(239, 68, 68, 0.1);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rejected-item {
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.rejected-item:hover {
  background: rgba(239, 68, 68, 0.06);
}

.rejected-item--active {
  background: rgba(239, 68, 68, 0.1);
  box-shadow: inset 2px 0 0 rgba(239, 68, 68, 0.6);
}

.rejected-locate {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.25);
  flex-shrink: 0;
  transition: color 0.15s;
}

.rejected-item:hover .rejected-locate,
.rejected-item--active .rejected-locate {
  color: rgba(239, 68, 68, 0.75);
}

.rejected-item:last-child {
  border-bottom: none;
}

.rejected-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.rejected-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.rejected-name {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  flex-shrink: 0;
}

.rejected-reason {
  flex: 1;
  font-size: 10px;
  color: rgba(239, 68, 68, 0.7);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rejected-detail {
  margin-top: 4px;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rejected-calc {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
  font-variant-numeric: tabular-nums;
}

.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.2s ease;
}

.collapse-enter-from,
.collapse-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}
</style>
