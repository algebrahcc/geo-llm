<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PortAssessment, ResourceStatItem } from './types';
import { resourceStatItems, equipmentResourceDetails, pontoonResourceDetails } from '@/mock/river';

defineOptions({
  name: 'RiverAssessResult'
});

interface Props {
  collapsed: boolean;
  ports: PortAssessment[];
  running: boolean;
}

const props = defineProps<Props>();

const resourceTab = ref<'equipment' | 'pontoon'>('equipment');

const gradeStats = computed(() => {
  const map: Record<string, number> = { 推荐: 0, 较优: 0, 一般: 0, 不推荐: 0 };
  props.ports.forEach(p => {
    map[p.grade] = (map[p.grade] || 0) + 1;
  });
  return map;
});

const totalPorts = computed(() => props.ports.length);

const gradeColors: Record<string, string> = {
  推荐: '#22c55e',
  较优: '#3b82f6',
  一般: '#f59e0b',
  不推荐: '#ef4444'
};

const legendItems = [
  { label: '天然渡口', color: '#22c55e' },
  { label: '可建设渡口', color: '#3b82f6' },
  { label: '不推荐渡口', color: '#ef4444' },
  { label: '工程装备重点', color: '#f59e0b' },
  { label: '舟桥器材点', color: '#38bdf8' },
  { label: '保障区', color: '#a78bfa' },
  { label: '消选方向', color: '#f97316' }
];

const radarLabels = ['通行', '隐蔽', '防护', '地形', '后勤'];

const avgRadarValues = computed(() => {
  if (props.ports.length === 0) return [0, 0, 0, 0, 0];
  const len = props.ports.length;
  return [
    Math.round(props.ports.reduce((s, p) => s + p.passAbility, 0) / len),
    Math.round(props.ports.reduce((s, p) => s + p.concealment, 0) / len),
    Math.round(props.ports.reduce((s, p) => s + p.protection, 0) / len),
    Math.round(props.ports.reduce((s, p) => s + p.terrain, 0) / len),
    Math.round(props.ports.reduce((s, p) => s + p.logistics, 0) / len)
  ];
});

const currentResourceDetails = computed(() =>
  resourceTab.value === 'equipment' ? equipmentResourceDetails : pontoonResourceDetails
);

function gradeClass(grade: string) {
  const map: Record<string, string> = {
    推荐: 'grade-recommend',
    较优: 'grade-good',
    一般: 'grade-normal',
    不推荐: 'grade-bad'
  };
  return map[grade] || '';
}
</script>

<template>
  <NCard
    :bordered="false"
    size="small"
    class="assess-result"
    :class="[{ 'assess-result--collapsed': collapsed }]"
    :content-style="{ padding: 0 }"
  >
    <template #header>
      <div class="panel-title-wrap">
        <div class="title-group">
          <SvgIcon icon="mdi:chart-donut" class="panel-icon" />
          <span>评估结果</span>
          <span v-if="!running && totalPorts > 0" class="result-badge">{{ totalPorts }} 个可用渡口</span>
        </div>
        <div class="header-actions">
          <span class="status-dot" :class="running ? 'status-dot--active' : 'status-dot--done'"></span>
          <NTag :bordered="false" size="tiny" :type="running ? 'warning' : 'success'" class="status-tag">
            {{ running ? '评估中...' : '已完成' }}
          </NTag>
        </div>
      </div>
    </template>

    <div v-if="!collapsed" class="panel-content">
      <!-- ═══ 评估结果概览 - 环形图 ═══ -->
      <div class="section">
        <div class="section-title">评估结果概览</div>
        <div class="ring-chart-area">
          <div class="ring-chart">
            <svg viewBox="0 0 120 120" width="100" height="100">
              <!-- Track -->
              <circle cx="60" cy="60" r="45" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="10" />
              <!-- Segments -->
              <template
                v-for="(seg, idx) in [
                  { grade: '推荐', pct: totalPorts ? gradeStats['推荐'] / totalPorts : 0 },
                  { grade: '较优', pct: totalPorts ? gradeStats['较优'] / totalPorts : 0 },
                  { grade: '一般', pct: totalPorts ? gradeStats['一般'] / totalPorts : 0 },
                  { grade: '不推荐', pct: totalPorts ? gradeStats['不推荐'] / totalPorts : 0 }
                ]"
                :key="idx"
              >
                <circle
                  v-if="seg.pct > 0"
                  cx="60"
                  cy="60"
                  r="45"
                  fill="none"
                  :stroke="gradeColors[seg.grade]"
                  stroke-width="10"
                  stroke-linecap="round"
                  :stroke-dasharray="`${seg.pct * 282.74} ${282.74}`"
                  :stroke-dashoffset="`${
                    -282.74 *
                    (idx === 0
                      ? 0
                      : idx === 1
                        ? gradeStats['推荐'] / totalPorts
                        : idx === 2
                          ? (gradeStats['推荐'] + gradeStats['较优']) / totalPorts
                          : (gradeStats['推荐'] + gradeStats['较优'] + gradeStats['一般']) / totalPorts)
                  }`"
                  transform="rotate(-90 60 60)"
                  class="ring-segment"
                />
              </template>
              <text x="60" y="55" text-anchor="middle" fill="#fff" font-size="20" font-weight="700">
                {{ totalPorts }}
              </text>
              <text x="60" y="73" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="9">可用渡口</text>
            </svg>
          </div>
          <div class="ring-legend">
            <div v-for="g in ['推荐', '较优', '一般', '不推荐']" :key="g" class="legend-row">
              <span class="legend-dot" :style="{ background: gradeColors[g] }"></span>
              <span class="legend-label">{{ g }}</span>
              <span class="legend-count">{{ gradeStats[g] }}个</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ 图例 ═══ -->
      <div class="section">
        <div class="section-title">图例</div>
        <div class="map-legend">
          <div v-for="item in legendItems" :key="item.label" class="map-legend-item">
            <span class="legend-dot" :style="{ background: item.color }"></span>
            <span>{{ item.label }}</span>
          </div>
        </div>
      </div>

      <!-- ═══ 关键资源统计 ═══ -->
      <div class="section">
        <div class="section-title">关键资源统计</div>
        <div class="resource-grid">
          <div
            v-for="(item, idx) in resourceStatItems as ResourceStatItem[]"
            :key="item.category"
            class="resource-card"
            :style="{ animationDelay: `${idx * 0.06}s` }"
          >
            <div class="resource-icon-wrap">
              <SvgIcon :icon="item.icon" class="resource-icon" />
            </div>
            <div class="resource-info">
              <div class="resource-count">
                {{ item.count }}
                <span class="resource-unit">{{ item.unit }}</span>
              </div>
              <div class="resource-name">{{ item.category }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ 评估指标分布 - 雷达图 ═══ -->
      <div class="section">
        <div class="section-title">评估指标分布</div>
        <div class="radar-area">
          <svg viewBox="0 0 200 200" width="180" height="180">
            <!-- Grid -->
            <polygon
              v-for="level in [0.2, 0.4, 0.6, 0.8, 1]"
              :key="level"
              :points="
                radarLabels
                  .map((_, i) => {
                    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                    const r = level * 75;
                    return `${100 + r * Math.cos(angle)},${100 + r * Math.sin(angle)}`;
                  })
                  .join(' ')
              "
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              stroke-width="1"
            />
            <!-- Axes -->
            <line
              v-for="i in 5"
              :key="'axis-' + i"
              x1="100"
              y1="100"
              :x2="100 + 75 * Math.cos((Math.PI * 2 * (i - 1)) / 5 - Math.PI / 2)"
              :y2="100 + 75 * Math.sin((Math.PI * 2 * (i - 1)) / 5 - Math.PI / 2)"
              stroke="rgba(255,255,255,0.06)"
              stroke-width="1"
            />
            <!-- Data area -->
            <polygon
              :points="
                avgRadarValues
                  .map((v, i) => {
                    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                    const r = (v / 100) * 75;
                    return `${100 + r * Math.cos(angle)},${100 + r * Math.sin(angle)}`;
                  })
                  .join(' ')
              "
              fill="rgba(59,130,246,0.12)"
              stroke="#3b82f6"
              stroke-width="2"
              stroke-linejoin="round"
            />
            <!-- Data points -->
            <circle
              v-for="(v, i) in avgRadarValues"
              :key="'pt-' + i"
              :cx="100 + (v / 100) * 75 * Math.cos((Math.PI * 2 * i) / 5 - Math.PI / 2)"
              :cy="100 + (v / 100) * 75 * Math.sin((Math.PI * 2 * i) / 5 - Math.PI / 2)"
              r="3"
              fill="#3b82f6"
              stroke="#0f172a"
              stroke-width="1.5"
            />
            <!-- Labels -->
            <text
              v-for="(label, i) in radarLabels"
              :key="label"
              :x="100 + 92 * Math.cos((Math.PI * 2 * i) / 5 - Math.PI / 2)"
              :y="100 + 92 * Math.sin((Math.PI * 2 * i) / 5 - Math.PI / 2)"
              text-anchor="middle"
              dominant-baseline="middle"
              fill="rgba(255,255,255,0.56)"
              font-size="9"
              font-weight="500"
            >
              {{ label }}
            </text>
          </svg>
        </div>
      </div>

      <!-- ═══ 资源分布详情 ═══ -->
      <div class="section">
        <div class="section-title">资源分布详情</div>
        <NTabs v-model:value="resourceTab" type="segment" size="small" class="resource-tabs">
          <NTab name="equipment">工程装备</NTab>
          <NTab name="pontoon">舟桥器材</NTab>
        </NTabs>
        <div class="resource-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>数量</th>
                <th>位置</th>
                <th class="col-status">状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in currentResourceDetails" :key="row.name" class="table-row">
                <td class="td-name">{{ row.name }}</td>
                <td>
                  {{ row.count }}
                  <span class="td-unit">{{ row.unit }}</span>
                </td>
                <td>{{ row.location }}</td>
                <td class="col-status">
                  <span
                    class="status-tag-cell"
                    :class="{
                      'status-available': row.status === '可用',
                      'status-standby': row.status === '待命',
                      'status-unavailable': row.status !== '可用' && row.status !== '待命'
                    }"
                  >
                    {{ row.status }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ═══ 渡口评估结果表格 ═══ -->
      <div class="section">
        <div class="section-title">渡口评估结果</div>
        <div class="port-table-wrap">
          <table class="data-table data-table--compact">
            <thead>
              <tr>
                <th class="col-rank">#</th>
                <th>港口名称</th>
                <th class="col-type">类型</th>
                <th class="col-num">综合</th>
                <th class="col-num">通行</th>
                <th class="col-num">隐蔽</th>
                <th class="col-num">防护</th>
                <th class="col-num">地形</th>
                <th class="col-num">后勤</th>
                <th class="col-grade">等级</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(port, idx) in ports" :key="port.id" class="table-row">
                <td class="col-rank">{{ idx + 1 }}</td>
                <td class="port-name">{{ port.name }}</td>
                <td class="col-type">{{ port.type }}</td>
                <td class="col-num score-val">{{ port.score }}</td>
                <td class="col-num">{{ port.passAbility }}</td>
                <td class="col-num">{{ port.concealment }}</td>
                <td class="col-num">{{ port.protection }}</td>
                <td class="col-num">{{ port.terrain }}</td>
                <td class="col-num">{{ port.logistics }}</td>
                <td class="col-grade">
                  <span class="grade-tag" :class="gradeClass(port.grade)">{{ port.grade }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
/* ──── Panel Shell ──── */
.assess-result {
  width: 100% !important;
  border: none !important;
  background: transparent !important;
  backdrop-filter: none !important;
  border-radius: 0 !important;
}

.assess-result :deep(.n-card-header) {
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

/* ──── Sections ──── */
.section {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.section:last-of-type {
  border-bottom: none;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.48);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ──── Ring Chart ──── */
.ring-chart-area {
  display: flex;
  align-items: center;
  gap: 20px;
}

.ring-segment {
  transition: stroke-dasharray 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.ring-legend {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
}

.legend-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-label {
  min-width: 40px;
}

.legend-count {
  margin-left: auto;
  color: rgba(255, 255, 255, 0.36);
}

/* ──── Map Legend ──── */
.map-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
}

.map-legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}

/* ──── Resource Grid ──── */
.resource-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.resource-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  transition:
    border-color 0.18s ease,
    transform 0.18s ease;
  animation: cardFadeIn 0.4s ease backwards;
}

@keyframes cardFadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.resource-card:hover {
  border-color: rgba(59, 130, 246, 0.2);
  transform: translateY(-2px);
}

.resource-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: rgba(59, 130, 246, 0.1);
  flex-shrink: 0;
}

.resource-icon {
  font-size: 18px;
  color: #3b82f6;
}

.resource-count {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  line-height: 1.2;
}

.resource-unit {
  font-size: 10px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.36);
  margin-left: 1px;
}

.resource-name {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.42);
}

/* ──── Radar ──── */
.radar-area {
  display: flex;
  justify-content: center;
  padding: 4px 0;
}

/* ──── Tables ──── */
.resource-table-wrap,
.port-table-wrap {
  overflow-x: auto;
}

.resource-tabs {
  margin-bottom: 8px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.data-table th {
  padding: 7px 8px;
  text-align: left;
  color: rgba(255, 255, 255, 0.36);
  font-weight: 500;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  white-space: nowrap;
}

.data-table td {
  padding: 7px 8px;
  color: rgba(255, 255, 255, 0.72);
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  white-space: nowrap;
}

.data-table--compact th,
.data-table--compact td {
  padding: 6px 6px;
  font-size: 10px;
}

.table-row {
  transition: background-color 0.14s ease;
}
.table-row:hover {
  background: rgba(59, 130, 246, 0.05);
}

.td-name {
  font-weight: 600;
}
.port-name {
  font-weight: 600;
}
.td-unit {
  color: rgba(255, 255, 255, 0.36);
  font-size: 10px;
}

.col-rank {
  width: 28px;
}
.col-type {
  width: 72px;
}
.col-num {
  width: 44px;
  text-align: center;
}
.col-grade {
  width: 64px;
}
.col-status {
  width: 52px;
}

.score-val {
  font-weight: 700;
  color: #3b82f6;
}

/* Status cell tags */
.status-tag-cell {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}

.status-available {
  color: #22c55e;
  background: rgba(34, 197, 94, 0.1);
}

.status-standby {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}

.status-unavailable {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

/* Grade tags */
.grade-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}

.grade-recommend {
  color: #22c55e;
  background: rgba(34, 197, 94, 0.12);
}
.grade-good {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.12);
}
.grade-normal {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.12);
}
.grade-bad {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.12);
}

.assess-result--collapsed {
  width: 100% !important;
}
</style>
