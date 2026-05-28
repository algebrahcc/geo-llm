<script setup lang="ts">
import 'echarts-wordcloud';
import { ref } from 'vue';
import { useEcharts } from '@/hooks/common/echarts';
import {
  screenAiRank,
  screenDataUpdateTrend,
  screenHotKeywords,
  screenKpis,
  screenNotices,
  screenSpatialCoverage,
  screenSystemStatus,
  screenTaskDistribution,
  screenTaskTrend
} from '@/mock/screen';
import ScreenGlobeViewer from './modules/screen-globe-viewer.vue';
import type { SceneModeKey } from './modules/use-screen-globe';

defineOptions({
  name: 'ScreenPage'
});

const globeRef = ref<InstanceType<typeof ScreenGlobeViewer> | null>(null);
const activeSceneMode = ref<SceneModeKey>('3d');

const sceneModeOptions: { key: SceneModeKey; label: string }[] = [
  { key: '3d', label: '3D' },
  { key: '2d', label: '2D' }
];

function handleSceneModeSwitch(mode: SceneModeKey) {
  activeSceneMode.value = mode;
  globeRef.value?.switchSceneMode(mode);
}

// ---- Color palette for charts (matching reference design) ----
const CHART_COLORS = {
  primary: '#29b6ff',
  secondary: '#00d4aa',
  warning: '#ffb020',
  danger: '#ff5c5c',
  info: '#7b8cff',
  purple: '#a78bfa'
};

const PIE_COLORS = ['#29b6ff', '#00d4aa', '#ffb020', '#7b8cff', '#ff7eb3'];

// ---- Task Distribution Donut Chart (compact with center total) ----
const taskTotal = screenTaskDistribution.reduce((sum, item) => sum + item.value, 0);
const { domRef: taskDistributionDomRef } = useEcharts(() => ({
  tooltip: {
    trigger: 'item',
    backgroundColor: 'rgba(6, 20, 40, 0.92)',
    borderColor: 'rgba(41, 182, 255, 0.25)',
    textStyle: { color: '#e0f0ff', fontSize: 12 },
    formatter: '{b}: {c} ({d}%)'
  },
  legend: {
    bottom: 4,
    left: 'center',
    itemWidth: 10,
    itemHeight: 10,
    itemGap: 14,
    textStyle: { color: 'rgba(180, 210, 240, 0.72)', fontSize: 11 }
  },
  series: [
    {
      name: '任务分布',
      type: 'pie',
      radius: ['44%', '68%'],
      center: ['50%', '42%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 4,
        borderColor: 'rgba(4, 16, 32, 0.85)',
        borderWidth: 2
      },
      label: { show: false },
      emphasis: { scale: true, scaleSize: 6 },
      data: screenTaskDistribution.map((item, i) => ({
        ...item,
        itemStyle: { color: PIE_COLORS[i % PIE_COLORS.length] }
      })),
      animationType: 'scale',
      animationEasing: 'elasticOut',
      animationDuration: 1200,
      graphic: {
        type: 'text',
        left: 'center',
        top: '40%',
        style: {
          text: String(taskTotal),
          textAlign: 'center',
          fill: '#e4f2ff',
          fontSize: 22,
          fontWeight: 800
        }
      }
    }
  ]
}));

// ---- Task Trend Line Chart ----
const { domRef: taskTrendDomRef } = useEcharts(() => ({
  tooltip: {
    trigger: 'axis',
    backgroundColor: 'rgba(6, 20, 40, 0.92)',
    borderColor: 'rgba(41, 182, 255, 0.25)',
    textStyle: { color: '#e0f0ff', fontSize: 12 }
  },
  legend: {
    top: 2,
    right: 8,
    itemWidth: 14,
    itemHeight: 2,
    textStyle: { color: 'rgba(180, 210, 240, 0.65)', fontSize: 11 }
  },
  grid: { left: 12, right: 18, top: 28, bottom: 22, containLabel: true },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: screenTaskTrend.dates,
    axisLine: { lineStyle: { color: 'rgba(60, 130, 200, 0.2)' } },
    axisLabel: { color: 'rgba(160, 195, 235, 0.55)', fontSize: 10 },
    axisTick: { show: false }
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: 'rgba(60, 130, 200, 0.1)', type: 'dashed' } },
    axisLabel: { color: 'rgba(160, 195, 235, 0.45)', fontSize: 10 }
  },
  series: [
    {
      name: '新建',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      lineStyle: { width: 2, color: CHART_COLORS.primary },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(41, 182, 255, 0.28)' },
            { offset: 1, color: 'rgba(41, 182, 255, 0.02)' }
          ]
        }
      },
      itemStyle: { color: CHART_COLORS.primary },
      data: screenTaskTrend.created
    },
    {
      name: '完成',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      lineStyle: { width: 2, color: CHART_COLORS.secondary },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(0, 212, 170, 0.24)' },
            { offset: 1, color: 'rgba(0, 212, 170, 0.02)' }
          ]
        }
      },
      itemStyle: { color: CHART_COLORS.secondary },
      data: screenTaskTrend.completed
    }
  ]
}));

// ---- System Status Gauge/Bar Chart ----
const { domRef: systemStatusDomRef } = useEcharts(() => ({
  tooltip: {
    trigger: 'axis',
    backgroundColor: 'rgba(6, 20, 40, 0.92)',
    borderColor: 'rgba(41, 182, 255, 0.25)',
    textStyle: { color: '#e0f0ff', fontSize: 12 }
  },
  grid: { left: 12, right: 18, top: 20, bottom: 12, containLabel: true },
  xAxis: {
    type: 'category',
    data: ['健康度', 'CPU使用率', '内存占用', '存储空间'],
    axisLine: { lineStyle: { color: 'rgba(60, 130, 200, 0.2)' } },
    axisLabel: { color: 'rgba(160, 195, 235, 0.55)', fontSize: 10 },
    axisTick: { show: false }
  },
  yAxis: {
    type: 'value',
    max: 100,
    splitLine: { lineStyle: { color: 'rgba(60, 130, 200, 0.1)', type: 'dashed' } },
    axisLabel: { color: 'rgba(160, 195, 235, 0.45)', fontSize: 10, formatter: '{value}%' }
  },
  series: [
    {
      type: 'bar',
      barWidth: 22,
      barMaxWidth: 32,
      barBorderRadius: [4, 4, 0, 0],
      itemStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(41, 182, 255, 0.82)' },
            { offset: 1, color: 'rgba(15, 95, 190, 0.62)' }
          ]
        }
      },
      data: [
        screenSystemStatus.health,
        screenSystemStatus.cpu,
        screenSystemStatus.memory,
        screenSystemStatus.storage
      ].map(v => ({ value: v }))
    }
  ]
}));

// ---- Hot Keywords Word Cloud ----
const { domRef: hotKeywordsDomRef } = useEcharts(
  () =>
    ({
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(6, 20, 40, 0.92)',
        borderColor: 'rgba(41, 182, 255, 0.25)',
        textStyle: { color: '#e0f0ff', fontSize: 12 }
      },
      series: [
        {
          type: 'wordCloud',
          sizeRange: [11, 26],
          rotationRange: [0, 0],
          gridSize: 5,
          drawOutOfBound: false,
          layoutAnimation: true,
          textStyle: {
            fontWeight: 'bold',
            fontFamily: "'Microsoft YaHei', 'PingFang SC', sans-serif"
          },
          emphasis: {
            focus: 'self',
            textStyle: { textShadowBlur: 16, textShadowColor: 'rgba(41, 182, 255, 0.45)' }
          },
          data: screenHotKeywords.map((item, i) => ({
            ...item,
            textStyle: {
              color:
                i < 3
                  ? CHART_COLORS.primary
                  : i < 7
                    ? CHART_COLORS.secondary
                    : i < 11
                      ? CHART_COLORS.info
                      : 'rgba(150, 185, 225, 0.75)'
            }
          }))
        }
      ]
    }) as any
);

// ---- AI Ranking Horizontal Bar Chart ----
const aiRankColors = ['#ff5c5c', '#ffb020', '#29b6ff', '#7b8cff', '#a78bfa'];
const { domRef: aiRankDomRef } = useEcharts(() => ({
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    backgroundColor: 'rgba(6, 20, 40, 0.92)',
    borderColor: 'rgba(41, 182, 255, 0.25)',
    textStyle: { color: '#e0f0ff', fontSize: 12 }
  },
  grid: { left: 14, right: 42, top: 10, bottom: 6, containLabel: true },
  xAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: 'rgba(60, 130, 200, 0.06)', type: 'dashed' } },
    axisLabel: { show: false },
    axisLine: { show: false },
    axisTick: { show: false }
  },
  yAxis: {
    type: 'category',
    data: screenAiRank.map(i => i.name),
    inverse: true,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: 'rgba(180, 210, 240, 0.78)',
      fontSize: 11,
      width: 90,
      overflow: 'truncate',
      ellipsis: '...'
    }
  },
  series: [
    {
      type: 'bar',
      barWidth: 16,
      barMaxWidth: 20,
      barGap: '30%',
      itemStyle: {
        borderRadius: [0, 10, 10, 0],
        color: (params: any) => ({
          type: 'linear',
          x: 0,
          y: 0,
          x2: 1,
          y2: 0,
          colorStops: [
            { offset: 0, color: 'rgba(41, 182, 255, 0.18)' },
            { offset: 1, color: aiRankColors[params.dataIndex % aiRankColors.length] }
          ]
        })
      },
      showBackground: true,
      backgroundStyle: {
        color: 'rgba(30, 60, 100, 0.18)',
        borderRadius: [0, 10, 10, 0]
      },
      label: {
        show: true,
        position: 'right',
        color: 'rgba(228, 242, 255, 0.85)',
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "'DIN', 'Consolas', monospace",
        offset: [4, 0]
      },
      data: screenAiRank.map(i => i.value)
    }
  ]
}));

// ---- Bottom: Data Type Distribution Pie ----
const { domRef: bottomDistDomRef } = useEcharts(() => ({
  tooltip: {
    trigger: 'item',
    backgroundColor: 'rgba(6, 20, 40, 0.92)',
    borderColor: 'rgba(41, 182, 255, 0.25)',
    textStyle: { color: '#e0f0ff', fontSize: 12 },
    formatter: '{b}: {c}TB ({d}%)'
  },
  legend: {
    orient: 'vertical',
    left: 'left',
    top: 'center',
    itemWidth: 9,
    itemHeight: 9,
    itemGap: 10,
    textStyle: { color: 'rgba(170, 200, 240, 0.68)', fontSize: 10 },
    formatter: name => `${name}  `
  },
  series: [
    {
      name: '数据类型分布',
      type: 'pie',
      radius: ['48%', '76%'],
      center: ['62%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 4,
        borderColor: 'rgba(4, 16, 32, 0.85)',
        borderWidth: 2
      },
      label: { show: false },
      animationType: 'scale',
      animationEasing: 'elasticOut',
      animationDuration: 1000,
      emphasis: {
        scale: true,
        scaleSize: 6,
        itemStyle: { shadowBlur: 16, shadowColor: 'rgba(0, 0, 0, 0.35)' }
      },
      data: screenTaskDistribution.map((item, i) => ({
        ...item,
        itemStyle: { color: PIE_COLORS[i % PIE_COLORS.length] }
      }))
    }
  ]
}));

// ---- Bottom: Spatial Coverage Radar Chart ----
const { domRef: bottomRadarDomRef } = useEcharts(() => ({
  tooltip: {
    trigger: 'item',
    backgroundColor: 'rgba(6, 20, 40, 0.92)',
    borderColor: 'rgba(41, 182, 255, 0.25)',
    textStyle: { color: '#e0f0ff', fontSize: 12 }
  },
  legend: {
    top: 4,
    right: 8,
    itemWidth: 12,
    itemHeight: 3,
    itemGap: 16,
    textStyle: { color: 'rgba(170, 200, 240, 0.68)', fontSize: 10 }
  },
  radar: {
    indicator: [
      { name: '准确性', max: 100 },
      { name: '实时性', max: 100 },
      { name: '完整性', max: 100 },
      { name: '覆盖度', max: 100 },
      { name: '可用性', max: 100 }
    ],
    radius: '66%',
    center: ['50%', '54%'],
    shape: 'polygon',
    splitNumber: 4,
    axisName: {
      color: 'rgba(165, 198, 240, 0.68)',
      fontSize: 10,
      padding: [2, 4]
    },
    splitArea: {
      areaStyle: {
        color: [
          'rgba(30, 70, 130, 0.06)',
          'rgba(30, 70, 130, 0.1)',
          'rgba(30, 70, 130, 0.06)',
          'rgba(30, 70, 130, 0.03)'
        ]
      }
    },
    splitLine: { lineStyle: { color: 'rgba(60, 130, 200, 0.2)' } },
    axisLine: { lineStyle: { color: 'rgba(60, 130, 200, 0.25)' } }
  },
  series: [
    {
      name: '空间数据覆盖',
      type: 'radar',
      symbol: 'circle',
      symbolSize: 4,
      lineStyle: { width: 2 },
      itemStyle: { color: CHART_COLORS.primary },
      areaStyle: { opacity: 0.18 },
      data: screenSpatialCoverage.map((item, i) => ({
        ...item,
        lineStyle: { color: i === 0 ? CHART_COLORS.primary : CHART_COLORS.secondary },
        itemStyle: { color: i === 0 ? CHART_COLORS.primary : CHART_COLORS.secondary },
        areaStyle: {
          color: i === 0
            ? 'rgba(41, 182, 255, 0.18)'
            : 'rgba(0, 212, 170, 0.15)'
        }
      }))
    }
  ]
}));

// ---- Bottom: Data Update Trend Area Chart ----
const { domRef: bottomTrendDomRef } = useEcharts(() => ({
  tooltip: {
    trigger: 'axis',
    backgroundColor: 'rgba(6, 20, 40, 0.92)',
    borderColor: 'rgba(41, 182, 255, 0.25)',
    textStyle: { color: '#e0f0ff', fontSize: 12 }
  },
  legend: {
    top: 2,
    right: 8,
    itemWidth: 14,
    itemHeight: 2,
    textStyle: { color: 'rgba(180, 210, 240, 0.55)', fontSize: 10 },
    data: ['总更新量']
  },
  grid: { left: 12, right: 18, top: 28, bottom: 22, containLabel: true },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: screenDataUpdateTrend.dates,
    axisLine: { lineStyle: { color: 'rgba(60, 130, 200, 0.2)' } },
    axisLabel: { color: 'rgba(160, 195, 235, 0.55)', fontSize: 10 },
    axisTick: { show: false }
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: 'rgba(60, 130, 200, 0.1)', type: 'dashed' } },
    axisLabel: { color: 'rgba(160, 195, 235, 0.45)', fontSize: 10 }
  },
  series: [
    {
      name: '总更新量',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      step: false,
      lineStyle: { width: 2.5, color: CHART_COLORS.primary },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(41, 182, 255, 0.32)' },
            { offset: 1, color: 'rgba(41, 182, 255, 0.02)' }
          ]
        }
      },
      itemStyle: { color: CHART_COLORS.primary },
      markPoint: {
        data: [{ type: 'max', name: '最大值' }],
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: { color: CHART_COLORS.primary, borderColor: '#fff', borderWidth: 2 },
        label: { color: '#fff', fontSize: 9, fontWeight: 600 }
      },
      data: screenDataUpdateTrend.updates
    }
  ]
}));
</script>

<script lang="ts">
function getKpiIcon(key: string): string {
  const map: Record<string, string> = {
    taskTotal: 'mdi:clipboard-list-outline',
    taskOnline: 'mdi:refresh-circle',
    taskDone: 'mdi:check-circle-outline',
    aiCalls: 'mdi:brain',
    users: 'mdi:account-group-outline',
    dataVolume: 'mdi:database-outline'
  };
  return map[key] || 'mdi:information-outline';
}
</script>

<template>
  <div class="screen-dashboard">
    <!-- Background layers -->
    <div class="screen-bg" />
    <div class="screen-bg-glow" />

    <!-- Main Grid Layout -->
    <div class="screen-grid">
      <!-- ====== LEFT PANEL ====== -->
      <div class="screen-col screen-left">
        <div class="chart-group">
          <!-- Task Overview -->
          <div class="screen-panel">
            <div class="panel-header">
              <SvgIcon icon="mdi:chart-donut-variant" class="panel-header__icon" />
              <span class="panel-header__title">任务概览</span>
            </div>
            <div ref="taskDistributionDomRef" class="chart-body"></div>
          </div>

          <!-- Task Trend -->
          <div class="screen-panel">
            <div class="panel-header">
              <SvgIcon icon="mdi:chart-timeline-variant-shimmer" class="panel-header__icon" />
              <span class="panel-header__title">任务趋势</span>
              <div class="panel-tabs">
                <button type="button" class="tab-active">近7天</button>
                <button type="button" class="tab-btn">近30天</button>
              </div>
            </div>
            <div ref="taskTrendDomRef" class="chart-body"></div>
          </div>

          <!-- System Status -->
          <div class="screen-panel">
            <div class="panel-header">
              <SvgIcon icon="mdi:server-outline" class="panel-header__icon" />
              <span class="panel-header__title">系统运行状态</span>
            </div>
            <div ref="systemStatusDomRef" class="chart-body chart-body--compact"></div>
          </div>
        </div>
      </div>

      <!-- ====== CENTER COLUMN ====== -->
      <div class="screen-col screen-center">
        <!-- Top KPI Bar -->
        <div class="kpi-bar">
          <div v-for="kpi in screenKpis" :key="kpi.key" class="kpi-item">
            <div class="kpi-item__icon-wrap" :class="'kpi-icon--' + kpi.key">
              <SvgIcon :icon="getKpiIcon(kpi.key)" />
            </div>
            <div class="kpi-item__info">
              <div class="kpi-item__label">{{ kpi.label }}</div>
              <div class="kpi-item__val-row">
                <span class="kpi-item__value">{{ kpi.value }}</span>
                <span v-if="kpi.delta !== undefined" class="kpi-item__delta" :class="{ down: kpi.delta < 0 }">
                  {{ kpi.delta > 0 ? '+' : '' }}{{ kpi.delta }}
                </span>
              </div>
              <div v-if="kpi.unit" class="kpi-item__unit">{{ kpi.unit }}</div>
            </div>
          </div>
        </div>

        <!-- Globe Section -->
        <div class="map-section">
          <ScreenGlobeViewer ref="globeRef" class="map-canvas" />
          <!-- Scene Mode Switcher -->
          <div class="scene-mode-switcher">
            <button
              v-for="opt in sceneModeOptions"
              :key="opt.key"
              type="button"
              class="scene-mode-btn"
              :class="{ active: activeSceneMode === opt.key }"
              @click="handleSceneModeSwitch(opt.key)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- Bottom 3 Charts Row -->
        <div class="bottom-charts">
          <div class="screen-panel">
            <div class="panel-header panel-header--sm">
              <span class="panel-header__title">数据类型分布</span>
            </div>
            <div ref="bottomDistDomRef" class="chart-body"></div>
          </div>
          <div class="screen-panel">
            <div class="panel-header panel-header--sm">
              <span class="panel-header__title">空间数据覆盖评估图</span>
            </div>
            <div ref="bottomRadarDomRef" class="chart-body"></div>
          </div>
          <div class="screen-panel">
            <div class="panel-header panel-header--sm">
              <span class="panel-header__title">数据更新趋势</span>
            </div>
            <div ref="bottomTrendDomRef" class="chart-body"></div>
          </div>
        </div>
      </div>

      <!-- ====== RIGHT PANEL ====== -->
      <div class="screen-col screen-right">
        <div class="chart-group">
          <!-- Hot Keywords -->
          <div class="screen-panel">
            <div class="panel-header">
              <SvgIcon icon="mdi:cloud-outline" class="panel-header__icon" />
              <span class="panel-header__title">热点词云</span>
            </div>
            <div ref="hotKeywordsDomRef" class="chart-body"></div>
          </div>

          <!-- AI Ranking -->
          <div class="screen-panel">
            <div class="panel-header">
              <SvgIcon icon="mdi:format-list-numbered" class="panel-header__icon" />
              <span class="panel-header__title">分析任务排名</span>
            </div>
            <div ref="aiRankDomRef" class="chart-body"></div>
          </div>

          <!-- Event Notifications -->
          <div class="screen-panel screen-panel--notice">
            <div class="panel-header">
              <SvgIcon icon="mdi:bell-ring-outline" class="panel-header__icon" />
              <span class="panel-header__title">事件动态</span>
            </div>
            <div class="notice-list">
              <div v-for="n in screenNotices" :key="n.id" class="notice-item">
                <span class="notice-time">{{ n.time }}</span>
                <div class="notice-content">
                  <span class="notice-title" :class="'notice-level--' + n.level">{{ n.title }}</span>
                  <p v-if="n.detail" class="notice-detail">{{ n.detail }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ============================================================
   SCREEN DASHBOARD - Full Visual Overhaul
   Matching the reference "智能地理保障推演平台" design
   ============================================================ */

/* ---------- Global Variables ---------- */
.screen-dashboard {
  --sd-bg-deep: #04101c;
  --sd-surface: rgba(6, 20, 38, 0.86);
  --sd-border: rgba(36, 112, 196, 0.22);
  --sd-border-glow: rgba(41, 162, 255, 0.35);
  --sd-text-primary: #e4f2ff;
  --sd-text-secondary: rgba(175, 208, 245, 0.72);
  --sd-text-muted: rgba(135, 178, 230, 0.5);
  --sd-accent-blue: #29b6ff;
  --sd-accent-cyan: #00d4aa;
  --sd-accent-orange: #ffb020;
  --sd-accent-red: #ff5c5c;
  --sd-accent-purple: #a78bfa;

  position: relative;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  background:
    radial-gradient(ellipse 90% 70% at 50% -10%, rgba(10, 70, 140, 0.14) 0%, transparent 55%),
    linear-gradient(180deg, var(--sd-bg-deep) 0%, #030c17 100%);
  font-family: 'Microsoft YaHei', 'PingFang SC', 'HarmonyOS Sans SC', 'Segoe UI', sans-serif;
}

/* ---------- Background Glow Effects ---------- */
.screen-bg,
.screen-bg-glow {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}
.screen-bg {
  background:
    radial-gradient(circle at 20% 30%, rgba(10, 80, 160, 0.07) 0%, transparent 40%),
    radial-gradient(circle at 80% 60%, rgba(0, 140, 110, 0.05) 0%, transparent 35%),
    radial-gradient(circle at 50% 90%, rgba(41, 100, 200, 0.05) 0%, transparent 40%);
}
.screen-bg-glow {
  background:
    linear-gradient(90deg, transparent 0%, rgba(10, 50, 100, 0.04) 20%, rgba(10, 50, 100, 0.04) 80%, transparent 100%),
    linear-gradient(180deg, transparent 0%, rgba(10, 50, 100, 0.03) 10%, transparent 90%);
}

/* ---------- Main Grid ---------- */
.screen-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 300px 1fr 280px;
  gap: 12px;
  height: 100%;
  min-height: 0;
  padding: 12px 14px;
  box-sizing: border-box;
}

.screen-col {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  gap: 12px;
}

/* Equal-height chart group container */
.chart-group {
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: repeat(3, 1fr);
  gap: 12px;
  flex: 1;
  min-height: 0;
}

/* ---------- Screen Panel Base ---------- */
.screen-panel {
  position: relative;
  background: var(--sd-surface);
  border: 1px solid var(--sd-border);
  border-radius: 6px;
  box-shadow:
    0 0 0 1px rgba(8, 40, 80, 0.15) inset,
    0 4px 20px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}
.screen-panel:hover {
  border-color: var(--sd-border-glow);
  box-shadow:
    0 0 0 1px rgba(41, 162, 255, 0.1) inset,
    0 4px 24px rgba(0, 0, 0, 0.3),
    0 0 12px rgba(41, 162, 255, 0.06);
}

/* Panel corner accents — all 4 corners, always visible */
.screen-panel::before,
.screen-panel::after {
  content: '';
  position: absolute;
  width: 12px;
  height: 12px;
  pointer-events: none;
  z-index: 2;
  opacity: 0.4;
  transition: opacity 0.3s ease;
}
.screen-panel::before {
  top: -1px;
  left: -1px;
  border-top: 2px solid var(--sd-accent-blue);
  border-left: 2px solid var(--sd-accent-blue);
  border-radius: 6px 0 0 0;
}
.screen-panel::after {
  bottom: -1px;
  right: -1px;
  border-bottom: 2px solid var(--sd-accent-blue);
  border-right: 2px solid var(--sd-accent-blue);
  border-radius: 0 0 6px 0;
}
.screen-panel:hover::before,
.screen-panel:hover::after {
  opacity: 0.7;
}

/* Top-right & bottom-left corners via panel-header and chart-body */
.screen-panel .panel-header::after {
  content: '';
  position: absolute;
  top: -1px;
  right: -1px;
  width: 12px;
  height: 12px;
  border-top: 2px solid var(--sd-accent-blue);
  border-right: 2px solid var(--sd-accent-blue);
  border-radius: 0 6px 0 0;
  pointer-events: none;
  opacity: 0.4;
  transition: opacity 0.3s ease;
}
.screen-panel:hover .panel-header::after {
  opacity: 0.7;
}
.screen-panel .chart-body::before,
.screen-panel .notice-list::before {
  content: '';
  position: absolute;
  bottom: -1px;
  left: -1px;
  width: 12px;
  height: 12px;
  border-bottom: 2px solid var(--sd-accent-blue);
  border-left: 2px solid var(--sd-accent-blue);
  border-radius: 0 0 0 6px;
  pointer-events: none;
  z-index: 2;
  opacity: 0.4;
  transition: opacity 0.3s ease;
}
.screen-panel:hover .chart-body::before,
.screen-panel:hover .notice-list::before {
  opacity: 0.7;
}
.chart-body,
.notice-list {
  position: relative;
}

/* Panel Header */
.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(36, 112, 196, 0.12);
  background: linear-gradient(180deg, rgba(12, 38, 72, 0.5) 0%, rgba(6, 22, 44, 0.3) 100%);
  user-select: none;
  flex-shrink: 0;
  position: relative;
}

/* Header left accent bar */
.panel-header::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  bottom: 20%;
  width: 2px;
  border-radius: 1px;
  background: linear-gradient(180deg, transparent, var(--sd-accent-blue), transparent);
  opacity: 0.5;
}

.panel-header--sm {
  justify-content: space-between;
  padding: 8px 12px;
}

.panel-header__icon {
  font-size: 16px;
  color: var(--sd-accent-blue);
  opacity: 0.85;
  filter: drop-shadow(0 0 4px rgba(41, 182, 255, 0.25));
}

.panel-header__title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--sd-text-primary);
  text-shadow: 0 0 8px rgba(41, 182, 255, 0.12);
}

.panel-tabs {
  margin-left: auto;
  display: flex;
  gap: 4px;
}
.tab-btn,
.tab-active {
  padding: 2px 10px;
  font-size: 11px;
  border-radius: 4px;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}
.tab-btn {
  color: var(--sd-text-muted);
  background: transparent;
}
.tab-btn:hover {
  color: var(--sd-text-secondary);
}
.tab-active {
  color: var(--sd-text-primary);
  background: rgba(41, 182, 255, 0.15);
  border: 1px solid rgba(41, 182, 255, 0.25);
}

.chart-body {
  flex: 1;
  min-height: 0;
  padding: 4px 4px 6px;
}
.chart-body--compact {
  padding: 2px 4px 4px;
}

/* ============================================================
   LEFT PANEL SPECIFICS
   ============================================================ */

/* ============================================================
   CENTER COLUMN — KPI BAR
   ============================================================ */

.kpi-bar {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.kpi-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--sd-surface);
  border: 1px solid var(--sd-border);
  border-radius: 4px;
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;
}
.kpi-item:hover {
  border-color: var(--sd-border-glow);
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.2), 0 0 8px rgba(41, 162, 255, 0.08);
  transform: translateY(-1px);
}

/* KPI top highlight bar */
.kpi-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 20%;
  right: 20%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--sd-accent-blue), transparent);
  opacity: 0;
  transition: opacity 0.25s ease;
}
.kpi-item:hover::before {
  opacity: 0.6;
}

.kpi-item__icon-wrap {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  font-size: 15px;
  flex-shrink: 0;
  color: var(--sd-accent-blue);
  background: linear-gradient(135deg, rgba(15, 40, 75, 0.8), rgba(10, 30, 60, 0.6));
  border: 1px solid rgba(41, 120, 200, 0.2);
  box-shadow: 0 0 6px rgba(41, 182, 255, 0.1);
}

.kpi-item__info {
  min-width: 0;
}
.kpi-item__label {
  font-size: 11px;
  color: var(--sd-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.kpi-item__val-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-top: 2px;
}
.kpi-item__value {
  font-size: 18px;
  font-weight: 700;
  color: var(--sd-text-primary);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  text-shadow: 0 0 6px rgba(41, 182, 255, 0.1);
}
.kpi-item__delta {
  font-size: 10px;
  font-weight: 600;
  color: rgba(0, 212, 170, 0.7);
}
.kpi-item__delta.down {
  color: rgba(255, 92, 92, 0.7);
}
.kpi-item__unit {
  font-size: 10px;
  color: var(--sd-text-muted);
  margin-top: 1px;
}

/* ============================================================
   CENTER COLUMN — MAP
   ============================================================ */

.map-section {
  position: relative;
  flex: 1;
  min-height: 0;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--sd-border);
  box-shadow:
    0 0 0 1px rgba(8, 40, 80, 0.15) inset,
    0 4px 20px rgba(0, 0, 0, 0.25);
  animation: globe-border-breathe 4s ease-in-out infinite;
}

@keyframes globe-border-breathe {
  0%,
  100% {
    box-shadow:
      0 0 0 1px rgba(8, 40, 80, 0.15) inset,
      0 4px 20px rgba(0, 0, 0, 0.25),
      0 0 0 rgba(41, 162, 255, 0);
  }
  50% {
    box-shadow:
      0 0 0 1px rgba(8, 40, 80, 0.15) inset,
      0 4px 20px rgba(0, 0, 0, 0.25),
      0 0 8px rgba(41, 162, 255, 0.12);
  }
}

.map-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

/* Scene Mode Switcher */
.scene-mode-switcher {
  position: absolute;
  z-index: 10;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 4px;
  background: rgba(6, 20, 38, 0.8);
  border: 1px solid rgba(36, 112, 196, 0.25);
  border-radius: 4px;
  padding: 3px;
  backdrop-filter: blur(8px);
}

.scene-mode-btn {
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 600;
  color: rgba(175, 208, 245, 0.5);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 0.3px;
}

.scene-mode-btn:hover {
  color: rgba(175, 208, 245, 0.8);
  border-color: rgba(41, 162, 255, 0.2);
}

.scene-mode-btn.active {
  color: #29b6ff;
  background: rgba(41, 182, 255, 0.12);
  border-color: rgba(41, 182, 255, 0.35);
}

/* Bottom 3 Charts */
.bottom-charts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  flex-shrink: 0;
  min-height: 200px;
}
.bottom-charts .screen-panel {
  min-height: 200px;
  transition: all 0.3s ease;
}
.bottom-charts .screen-panel:hover {
  transform: translateY(-2px);
  box-shadow:
    0 0 0 1px rgba(41, 162, 255, 0.12) inset,
    0 6px 28px rgba(0, 0, 0, 0.35),
    0 0 16px rgba(41, 162, 255, 0.08);
}

/* ============================================================
   RIGHT PANEL — Notices
   ============================================================ */

.screen-panel--notice {
  flex: 1;
  min-height: 0;
}

.notice-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notice-item {
  display: flex;
  gap: 10px;
  padding: 8px 6px;
  border-bottom: 1px solid rgba(36, 112, 196, 0.08);
  transition: background 0.2s ease, transform 0.2s ease;
  border-radius: 3px;
}
.notice-item:last-child {
  border-bottom: none;
}
.notice-item:hover {
  background: rgba(41, 162, 255, 0.05);
  transform: translateX(3px);
}

.notice-time {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--sd-text-muted);
  font-variant-numeric: tabular-nums;
  width: 38px;
  padding-top: 1px;
}

.notice-content {
  min-width: 0;
  flex: 1;
}

.notice-title {
  display: block;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  word-break: break-word;
}
.notice-title::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}
.notice-level--info::before {
  background: var(--sd-accent-blue);
  box-shadow: 0 0 4px var(--sd-accent-blue);
}
.notice-level--warning::before {
  background: var(--sd-accent-orange);
  box-shadow: 0 0 4px var(--sd-accent-orange);
}
.notice-level--error::before {
  background: var(--sd-accent-red);
  box-shadow: 0 0 4px var(--sd-accent-red);
  animation: notice-pulse 2s ease-in-out infinite;
}
.notice-level--info {
  color: var(--sd-text-secondary);
}
.notice-level--warning {
  color: rgba(255, 192, 100, 0.9);
}
.notice-level--error {
  color: rgba(255, 120, 120, 0.9);
}

.notice-detail {
  margin: 4px 0 0 14px;
  font-size: 11px;
  color: var(--sd-text-muted);
  line-height: 1.4;
}

/* ============================================================
   Global Effects — Breathing glow, animations
   ============================================================ */

/* Notice error pulse animation */
@keyframes notice-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

/* KPI number shimmer effect */
@keyframes value-shimmer {
  0% {
    background-position: -200% center;
  }
  100% {
    background-position: 200% center;
  }
}

.kpi-item:hover .kpi-item__value {
  background: linear-gradient(
    90deg,
    var(--sd-text-primary) 40%,
    var(--sd-accent-blue) 50%,
    var(--sd-text-primary) 60%
  );
  background-size: 200% auto;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: value-shimmer 2s ease-in-out infinite;
}

/* ============================================================
   Scrollbars
   ============================================================ */

.screen-dashboard::-webkit-scrollbar,
.notice-list::-webkit-scrollbar {
  width: 5px;
}
.screen-dashboard::-webkit-scrollbar-thumb,
.notice-list::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(41, 128, 200, 0.35);
}
.screen-dashboard::-webkit-scrollbar-track,
.notice-list::-webkit-scrollbar-track {
  background: transparent;
}

/* ============================================================
   RESPONSIVE BREAKPOINTS
   ============================================================ */

@media (max-width: 1440px) {
  .screen-grid {
    grid-template-columns: 260px 1fr 250px;
    gap: 10px;
  }
  .kpi-bar {
    grid-template-columns: repeat(4, 1fr);
  }
  .bottom-charts {
    grid-template-columns: 1fr;
    min-height: 180px;
  }
}

@media (max-width: 1100px) {
  .screen-grid {
    grid-template-columns: 1fr;
  }
  .screen-left,
  .screen-right {
    flex-direction: row;
    flex-wrap: wrap;
  }
  .screen-left > *,
  .screen-right > * {
    min-width: 260px;
    flex: 1;
  }
  .screen-row {
    flex: 1;
    min-width: 200px;
  }
  .bottom-charts {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 720px) {
  .kpi-bar {
    grid-template-columns: repeat(2, 1fr);
  }
  .screen-left,
  .screen-right {
    flex-direction: column;
  }
  .bottom-charts {
    grid-template-columns: 1fr;
  }
}
</style>
