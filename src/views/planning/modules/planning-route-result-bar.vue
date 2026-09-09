<script setup lang="ts">
import { computed, ref } from 'vue';
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

type Emits = import('@/typings/panel-emits').SelectablePanelEmits;

const emit = defineEmits<Emits>();

// ──── 方案折叠（默认全部收起，点击卡片头部展开详情；"展开全部"供比选） ────
const expandedCard = ref<string | null>(null);
const expandAll = ref(false);

const allExpanded = computed(() => expandAll.value && props.cards.length > 0);

function toggleCard(key: string) {
  expandedCard.value = expandedCard.value === key ? null : key;
  if (props.cards.every(c => expandedCard.value === c.key || (expandedCard.value === null && expandAll.value))) {
    expandAll.value = false;
  }
}

function toggleExpandAll() {
  expandAll.value = !expandAll.value;
  expandedCard.value = null;
}

/** 卡片头部点击：选中方案 + 切换折叠 */
function handleHeaderClick(card: PlanningRouteResultCard) {
  toggleCard(card.key);
  emit('select', card.key);
}

function isExpanded(key: string): boolean {
  return allExpanded.value || expandedCard.value === key;
}

/** 综合分色：高亮 400 系语义色 */
function getScoreColor(score: number): string {
  if (score >= 90) return '#34d399';
  if (score >= 80) return '#60a5fa';
  return '#fbbf24';
}

/** 路况等级色：畅通绿 / 基本畅通蓝 / 缓行黄 / 拥堵红 */
function getTrafficColor(level: string): string {
  if (level === '畅通') return '#34d399';
  if (level === '基本畅通') return '#60a5fa';
  if (level === '缓行') return '#fbbf24';
  return '#f87171';
}

function getSegmentColor(level: string): string {
  if (level.includes('拥堵')) return '#f87171';
  if (level.includes('缓行')) return '#fbbf24';
  if (level.includes('畅通') && level !== '畅通') return '#60a5fa';
  return '#34d399';
}
</script>

<template>
  <div class="route-result-bar" :class="{ 'route-result-bar--collapsed': collapsed }">
    <!-- 折叠态触发器 -->
    <template v-if="collapsed">
      <button type="button" class="bar-trigger" @click="emit('toggle-collapse')">
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
        <button v-if="cards.length > 0" type="button" class="expand-all-btn" @click="toggleExpandAll">
          {{ allExpanded ? '折叠全部' : '展开全部' }}
        </button>
        <button type="button" class="bar-close-btn" title="折叠" @click="emit('toggle-collapse')">
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
          <!-- 卡片头部（点击：选中 + 折叠/展开） -->
          <div class="card-header" @click.stop="handleHeaderClick(card)">
            <div class="card-header-top">
              <span class="plan-badge">{{ card.title }}</span>
              <span v-if="card.isRecommended" class="card-tag card-tag--recommend">{{ card.tag }}</span>
              <span v-else class="card-tag" :class="`card-tag--${card.tagType}`">{{ card.tag }}</span>
              <SvgIcon class="hint-chevron" :icon="isExpanded(card.key) ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
            </div>
            <div class="plan-name">{{ card.mainPath }}</div>
            <div class="card-subtitle">{{ card.subtitle }}</div>

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

            <div v-if="!isExpanded(card.key)" class="card-expand-hint">展开详情</div>
          </div>

          <!-- 展开详情 -->
          <div v-if="isExpanded(card.key)" class="card-detail">
            <!-- 亮点 -->
            <div class="card-highlights">
              <div v-for="(h, i) in card.highlights.slice(0, 3)" :key="i" class="highlight-item">
                <span class="highlight-dot" />
                {{ h }}
              </div>
            </div>

            <!-- 交通状况分析 -->
            <div v-if="card.traffic" class="card-traffic">
              <div class="traffic-header">
                <span class="traffic-title">交通状况</span>
                <span
                  class="traffic-level"
                  :style="{
                    color: getTrafficColor(card.traffic.level),
                    borderColor: `${getTrafficColor(card.traffic.level)}55`
                  }"
                >
                  {{ card.traffic.level }}
                </span>
                <span class="traffic-stat">
                  均速 {{ card.traffic.avgSpeed }}
                  <template v-if="card.traffic.delayMin > 0">· 延误 +{{ card.traffic.delayMin }}min</template>
                  <template v-else>· 无延误</template>
                </span>
              </div>
              <div class="traffic-segments">
                <div v-for="seg in card.traffic.segments" :key="seg.name" class="traffic-segment">
                  <span class="segment-dot" :style="{ background: getSegmentColor(seg.level) }" />
                  <span class="segment-name">{{ seg.name }}</span>
                  <span class="segment-level" :style="{ color: getSegmentColor(seg.level) }">{{ seg.level }}</span>
                  <span class="segment-note">{{ seg.note }}</span>
                </div>
              </div>
              <div v-if="card.traffic.impacts.length > 0" class="traffic-impacts">
                <div v-for="(impact, i) in card.traffic.impacts.slice(0, 2)" :key="i" class="traffic-impact">
                  {{ impact }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* 白系文字层级（弱化用不透明度而非发灰） */
.route-result-bar {
  --rb-t1: rgb(255 255 255 / 97%);
  --rb-t2: rgb(255 255 255 / 88%);
  --rb-t3: rgb(255 255 255 / 75%);
  --rb-t4: rgb(255 255 255 / 62%);

  --rb-accent: #8db8ff;
  --rb-line: rgb(255 255 255 / 8%);
  --rb-line-2: rgb(255 255 255 / 13%);

  display: flex;
  flex-direction: column;
  border-radius: 12px;
  background: rgb(8 14 26 / 92%);
  border: 1px solid var(--rb-line);
  backdrop-filter: blur(14px);
  box-shadow: 0 8px 30px rgb(0 0 0 / 35%);
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
  color: var(--rb-t2);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.18s;
}

.bar-trigger:hover {
  color: var(--rb-t1);
}

/* 标题栏 */
.bar-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--rb-line);
  flex-shrink: 0;
}

.bar-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  color: var(--rb-t1);
  flex: 1;
}

.bar-title-icon {
  font-size: 16px;
  color: var(--rb-accent);
}

.expand-all-btn {
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

.bar-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--rb-t3);
  cursor: pointer;
  font-size: 16px;
  transition: all 0.18s;
}

.bar-close-btn:hover {
  background: rgb(255 255 255 / 6%);
  color: var(--rb-t1);
}

/* 卡片滚动区 */
.cards-scroll {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgb(141 184 255 / 24%) transparent;
}

.cards-scroll::-webkit-scrollbar {
  width: 4px;
}

.cards-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgb(141 184 255 / 24%);
}

/* 方案卡片 */
.plan-card {
  width: 100%;
  border: 1px solid var(--rb-line);
  border-radius: 12px;
  background: linear-gradient(180deg, rgb(255 255 255 / 4%), rgb(255 255 255 / 1.5%));
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  flex-shrink: 0;
  overflow: hidden;
}

.plan-card:hover {
  border-color: rgb(124 184 255 / 40%);
}

.plan-card--selected {
  border-color: rgb(124 184 255 / 65%);
  box-shadow:
    0 0 0 1px rgb(124 184 255 / 18%),
    0 6px 20px rgb(74 125 189 / 16%);
}

/* 推荐卡：描边 + 微弱辉光 + 蓝色底调 */
.plan-card--recommended {
  border-color: rgb(124 184 255 / 45%);
  background: linear-gradient(180deg, rgb(74 125 189 / 10%), rgb(74 125 189 / 3%)), rgb(255 255 255 / 2%);
}

.plan-card--recommended.plan-card--selected {
  border-color: rgb(124 184 255 / 75%);
}

/* 卡片头部（点击区） */
.card-header {
  padding: 12px 14px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.card-header:hover {
  background: rgb(124 184 255 / 4%);
}

.card-header-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.plan-badge {
  font-size: 11px;
  padding: 2px 9px;
  border-radius: 4px;
  background: rgb(255 255 255 / 7%);
  color: var(--rb-t1);
  font-weight: 700;
  letter-spacing: 0.06em;
  border: 1px solid var(--rb-line-2);
}

.card-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.card-tag--recommend {
  background: rgb(74 125 189 / 20%);
  color: #a8c8f5;
  border: 1px solid rgb(124 184 255 / 40%);
  box-shadow: 0 2px 8px rgb(74 125 189 / 30%);
}

.card-tag--success {
  background: rgb(52 211 153 / 12%);
  color: #34d399;
}

.card-tag--info {
  background: rgb(96 165 250 / 12%);
  color: #60a5fa;
}

.card-tag--warning {
  background: rgb(251 191 36 / 12%);
  color: #fbbf24;
}

.hint-chevron {
  margin-left: auto;
  font-size: 15px;
  color: var(--rb-t3);
}

.plan-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--rb-t1);
  margin-bottom: 3px;
  letter-spacing: 0.01em;
}

.card-subtitle {
  font-size: 11.5px;
  color: var(--rb-t3);
  margin-bottom: 10px;
}

/* 指标行 */
.card-metrics {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 0;
  padding: 9px 12px;
  border-radius: 9px;
  background: rgb(255 255 255 / 4%);
  border: 1px solid var(--rb-line);
}

.metric {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.metric-value {
  font-size: 17px;
  font-weight: 700;
  color: var(--rb-t1);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.metric-value--time {
  color: #fb923c;
}

.metric-value--dist {
  color: var(--rb-accent);
}

.metric-label {
  font-size: 10.5px;
  font-weight: 500;
  color: var(--rb-t3);
  letter-spacing: 0.06em;
}

.metric-divider {
  width: 1px;
  height: 30px;
  background: var(--rb-line);
  flex-shrink: 0;
}

/* 展开提示 */
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

/* 展开详情 */
.card-detail {
  padding: 0 14px 12px;
  border-top: 1px solid var(--rb-line);
}

.card-highlights {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 10px;
}

.highlight-item {
  display: flex;
  align-items: baseline;
  gap: 7px;
  font-size: 11.5px;
  color: var(--rb-t2);
  line-height: 1.55;
}

.highlight-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--rb-accent);
  flex-shrink: 0;
  transform: translateY(-2px);
}

/* 交通状况分析 */
.card-traffic {
  margin-top: 10px;
  padding: 8px 10px 9px;
  border: 1px solid var(--rb-line);
  border-radius: 8px;
  background: rgb(255 255 255 / 2%);
}

.traffic-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.traffic-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--rb-t1);
  letter-spacing: 0.02em;
}

.traffic-level {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 8px;
  border: 1px solid;
}

.traffic-stat {
  flex: 1;
  font-size: 11px;
  color: var(--rb-t3);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.traffic-segments {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 6px;
}

.traffic-segment {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  line-height: 1.45;
}

.segment-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.segment-name {
  color: var(--rb-t2);
  font-weight: 500;
  flex-shrink: 0;
}

.segment-level {
  flex-shrink: 0;
  font-weight: 600;
}

.segment-note {
  color: var(--rb-t3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.traffic-impacts {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-top: 6px;
  border-top: 1px solid var(--rb-line);
}

.traffic-impact {
  font-size: 11px;
  color: var(--rb-t2);
  line-height: 1.45;
}
</style>
