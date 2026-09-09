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

type Emits = import('@/typings/panel-emits').SelectablePanelEmits<RiverPlanKey> & {
  'select-rejected': [id: string];
};

const emit = defineEmits<Emits>();

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
                  <div class="detail-block detail-block--key">
                    <div class="detail-label">机动路线</div>
                    <div class="detail-text">{{ plan.routeDesc }}</div>
                  </div>

                  <div class="detail-block">
                    <div class="detail-label">关键装备</div>
                    <div class="detail-tags">
                      <span v-for="eq in plan.keyEquipment" :key="eq" class="detail-tag">{{ eq }}</span>
                    </div>
                  </div>

                  <div class="detail-grid">
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
                  </div>

                  <div v-if="plan.conditions.length" class="cond-strip">
                    <span class="cond-label">适用条件</span>
                    <span v-for="(cond, i) in plan.conditions" :key="i" class="cond-item">{{ cond }}</span>
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
/* ═══════════════════════════════════════════════════════════════
   渡河方案推荐 — 深色数据面板设计
   设计基准（市场主流做法）：
   - 文字以白色系为主，弱化层级用降低不透明度而非偏灰发暗，
     保证深色底上的可读性（正文 ≥ rgba(255,255,255,.72)）
   - 语义色采用高亮 400 系（emerald/amber/sky/red），替代偏暗的 600 系
   - 字号阶梯：面板标题 14 → 方案名 15 → 小标题 12 → 正文 11.5，
     小标题恒大于其下方正文
   ═══════════════════════════════════════════════════════════════ */
.result-bar {
  --rb-t1: rgb(255 255 255 / 97%);
  --rb-t2: rgb(255 255 255 / 88%);
  --rb-t3: rgb(255 255 255 / 75%);
  --rb-t4: rgb(255 255 255 / 62%);

  --rb-primary: #4a7dbd;
  --rb-primary-bright: #7cb8ff;
  --rb-success: #34d399;
  --rb-info: #60a5fa;
  --rb-warning: #fbbf24;
  --rb-danger: #f87171;

  --rb-line: rgb(255 255 255 / 9%);
  --rb-line-2: rgb(255 255 255 / 14%);

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
  border-bottom: 1px solid var(--rb-line);
  flex-shrink: 0;
}

.header-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--rb-t1);
  flex-shrink: 0;
  letter-spacing: 0.02em;
}

.confidence-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgb(74 125 189 / 14%);
  color: #a8c8f5;
  font-weight: 600;
  border: 1px solid rgb(124 184 255 / 35%);
  font-variant-numeric: tabular-nums;
}

.expand-all-btn {
  margin-left: auto;
  font-size: 11px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--rb-line-2);
  background: rgb(255 255 255 / 5%);
  color: var(--rb-t2);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.expand-all-btn:hover {
  border-color: rgb(124 184 255 / 45%);
  color: #fff;
  background: rgb(74 125 189 / 14%);
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
  background: rgb(255 255 255 / 6%);
  color: var(--rb-t2);
  cursor: pointer;
  font-size: 16px;
  transition:
    background 0.18s,
    color 0.18s;
}

.action-btn:hover {
  background: rgb(74 125 189 / 18%);
  color: #fff;
}

/* ──── 内容滚动区 ──── */
.bar-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 14px 14px;
  scrollbar-width: thin;
  scrollbar-color: rgb(124 184 255 / 32%) transparent;
}

.bar-content::-webkit-scrollbar {
  height: 5px;
}

.bar-content::-webkit-scrollbar-track {
  background: transparent;
}

.bar-content::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgb(124 184 255 / 32%);
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
  color: var(--rb-t2);
}

/* ──── 卡片竖排 ──── */
.plan-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 6px;
}

.plan-card {
  position: relative;
  width: 100%;
  min-width: 0;
  border: 1px solid var(--rb-line);
  border-radius: 12px;
  overflow: hidden;
  transition:
    border-color 0.25s,
    box-shadow 0.25s;
  flex-shrink: 0;
  background: linear-gradient(180deg, rgb(255 255 255 / 4%), rgb(255 255 255 / 1.5%));
}

.plan-card:hover {
  border-color: rgb(124 184 255 / 40%);
}

/* 主推卡片：描边 + 微弱辉光 + 蓝色底调（不做装饰条） */
.plan-card--recommended {
  border-color: rgb(124 184 255 / 45%);
  background: linear-gradient(180deg, rgb(74 125 189 / 10%), rgb(74 125 189 / 3%)), rgb(255 255 255 / 2%);
  box-shadow: 0 6px 20px rgb(74 125 189 / 14%);
}

.plan-card--recommended:hover {
  border-color: rgb(124 184 255 / 60%);
}

.plan-card--active {
  border-color: rgb(124 184 255 / 65%);
  box-shadow:
    0 0 0 1px rgb(124 184 255 / 18%),
    0 6px 20px rgb(74 125 189 / 16%);
}

.plan-card--active.plan-card--recommended {
  border-color: rgb(124 184 255 / 75%);
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
  background: rgb(124 184 255 / 4%);
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
  padding: 2px 9px;
  border-radius: 4px;
  background: rgb(255 255 255 / 7%);
  color: var(--rb-t1);
  font-weight: 700;
  letter-spacing: 0.08em;
  border: 1px solid var(--rb-line-2);
}

.recommend-flag {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  color: #fff;
  font-weight: 700;
  letter-spacing: 0.1em;
  background: linear-gradient(135deg, #5b9bd9 0%, #3d6fb4 100%);
  border: 1px solid rgb(168 200 245 / 55%);
  box-shadow: 0 2px 8px rgb(74 125 189 / 35%);
}

.plan-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--rb-t1);
  margin-bottom: 10px;
  letter-spacing: 0.01em;
}

/* ──── 指标条 ──── */
.metric-strip {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 9px 12px;
  background: rgb(255 255 255 / 4%);
  border-radius: 9px;
  border: 1px solid var(--rb-line);
}

.metric-chip {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.chip-val {
  font-size: 17px;
  font-weight: 700;
  color: var(--rb-t1);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.chip-val--s-you {
  color: var(--rb-success);
}
.chip-val--s-liang {
  color: var(--rb-info);
}
.chip-val--s-zhong {
  color: var(--rb-warning);
}
.chip-val--s-cha {
  color: var(--rb-danger);
}

.chip-label {
  font-size: 10.5px;
  font-weight: 500;
  color: var(--rb-t2);
  letter-spacing: 0.06em;
}

.metric-divider {
  width: 1px;
  height: 30px;
  background: var(--rb-line);
  flex-shrink: 0;
}

/* ──── 展开提示 ──── */
.card-expand-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 10px;
  font-size: 10.5px;
  color: var(--rb-t3);
  transition: color 0.15s;
}

.card-header:hover .card-expand-hint {
  color: var(--rb-t1);
}

.hint-chevron {
  font-size: 15px;
  color: var(--rb-t2);
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
  padding: 12px 14px 14px;
  flex: 1;
  overflow-y: auto;
  min-width: 0;
  border-top: 1px solid var(--rb-line);
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
  margin-bottom: 10px;
}

.detail-block {
  margin-bottom: 6px;
}

.detail-grid .detail-block {
  margin-bottom: 0;
}

/* 小标题：纯文字排版（不做侧边色条），字号恒大于下方正文 */
.detail-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--rb-t1);
  margin-bottom: 5px;
  letter-spacing: 0.03em;
  line-height: 1.3;
}

.detail-text {
  font-size: 11.5px;
  color: var(--rb-t2);
  line-height: 1.6;
}

/* 优势=绿字（仅着色，不加装饰） */
.detail-block--adv .detail-label--adv {
  color: #6ee7b7;
}

.detail-block--adv .detail-list {
  color: var(--rb-t2);
}

/* 风险=琥珀字 */
.detail-block--risk .detail-label--risk {
  color: #fcd34d;
}

.detail-block--risk .detail-list {
  color: var(--rb-t2);
}

/* 机动路线：与其余正文同规格 */
.detail-block--key .detail-text {
  color: var(--rb-t1);
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.detail-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgb(255 255 255 / 6%);
  color: var(--rb-t1);
  border: 1px solid var(--rb-line-2);
  font-weight: 600;
}

.detail-list {
  margin: 0;
  padding-left: 0;
  font-size: 11.5px;
  color: var(--rb-t2);
  line-height: 1.6;
  list-style: none;
}

.detail-list li + li {
  margin-top: 3px;
}

/* 适用条件：单行紧凑条（替代独立列表块） */
.cond-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 0;
  margin-top: 2px;
  padding-top: 10px;
  border-top: 1px solid var(--rb-line);
}

.cond-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--rb-t1);
  margin-right: 8px;
  letter-spacing: 0.03em;
  flex-shrink: 0;
}

.cond-item {
  font-size: 11.5px;
  color: var(--rb-t2);
  line-height: 1.6;
}

.cond-item + .cond-item::before {
  content: '·';
  margin: 0 8px;
  color: var(--rb-t3);
}

/* ──── 已淘汰方式 ──── */
.rejected-section {
  margin: 10px 0 12px;
  border: 1px solid rgb(248 113 113 / 28%);
  border-radius: 9px;
  overflow: hidden;
  background: rgb(248 113 113 / 5%);
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
  background: rgb(248 113 113 / 8%);
}

.rejected-chevron {
  font-size: 14px;
  color: #fda4af;
}

.rejected-title {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: #fda4af;
}

.rejected-hint {
  font-size: 10.5px;
  color: var(--rb-t2);
  font-weight: 400;
}

.rejected-list {
  padding: 6px 12px 10px;
  border-top: 1px solid rgb(248 113 113 / 15%);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rejected-item {
  padding: 6px 0;
  border-bottom: 1px solid rgb(255 255 255 / 5%);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.rejected-item:hover {
  background: rgb(248 113 113 / 8%);
}

.rejected-item--active {
  background: rgb(248 113 113 / 12%);
  box-shadow: inset 2px 0 0 var(--rb-danger);
}

.rejected-locate {
  font-size: 13px;
  color: var(--rb-t2);
  flex-shrink: 0;
  transition: color 0.15s;
}

.rejected-item:hover .rejected-locate,
.rejected-item--active .rejected-locate {
  color: #fda4af;
}

.rejected-item:last-child {
  border-bottom: none;
}

.rejected-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.rejected-name {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--rb-t1);
  flex-shrink: 0;
}

.rejected-reason {
  flex: 1;
  font-size: 11px;
  color: #fca5a5;
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
  font-size: 10.5px;
  color: var(--rb-t2);
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
