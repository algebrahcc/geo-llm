<script setup lang="ts">
import 'echarts-wordcloud';
import { computed, ref, watch } from 'vue';
import { useWindowSize } from '@vueuse/core';
import { useEcharts } from '@/hooks/common/echarts';
import {
  screenAiRank,
  screenDataTypeDistribution,
  screenDataUpdateTrend,
  screenHotKeywords,
  screenKpis,
  screenNotices,
  screenSpatialCoverage,
  screenSystemStatus,
  screenTaskDistribution,
  screenTaskTrend
} from '@/mock/screen';
import { useThemeStore } from '@/store/modules/theme';
import ScreenGlobeViewer from './modules/screen-globe-viewer.vue';
import type { SceneModeKey } from './modules/use-screen-globe';

defineOptions({
  name: 'ScreenPage'
});

const themeStore = useThemeStore();

const globeRef = ref<InstanceType<typeof ScreenGlobeViewer> | null>(null);
const activeSceneMode = ref<SceneModeKey>('2d');

const sceneModeOptions: { key: SceneModeKey; label: string }[] = [
  { key: '3d', label: '3D' },
  { key: '2d', label: '2D' }
];

function handleSceneModeSwitch(mode: SceneModeKey) {
  activeSceneMode.value = mode;
  globeRef.value?.switchSceneMode(mode);
}

// ---- Responsive chart sizing ----
const { width: windowWidth } = useWindowSize();
const r = computed(() => {
  const w = windowWidth.value;
  if (w >= 1920) {
    return {
      axis: 12,
      legend: 12,
      label: 11,
      markLabel: 10,
      barW: 30,
      barMax: 40,
      wcMin: 13,
      wcMax: 32,
      donutNum: 28,
      radarR: '70%',
      aiLabel: 13,
      aiLabelOffset: [6, 0]
    };
  }
  if (w >= 1440) {
    return {
      axis: 10,
      legend: 11,
      label: 10,
      markLabel: 9,
      barW: 22,
      barMax: 32,
      wcMin: 11,
      wcMax: 26,
      donutNum: 22,
      radarR: '66%',
      aiLabel: 12,
      aiLabelOffset: [4, 0]
    };
  }
  if (w >= 1280) {
    return {
      axis: 10,
      legend: 10,
      label: 9,
      markLabel: 9,
      barW: 20,
      barMax: 28,
      wcMin: 10,
      wcMax: 22,
      donutNum: 20,
      radarR: '64%',
      aiLabel: 11,
      aiLabelOffset: [3, 0]
    };
  }
  if (w >= 1100) {
    return {
      axis: 9,
      legend: 9,
      label: 9,
      markLabel: 8,
      barW: 18,
      barMax: 24,
      wcMin: 9,
      wcMax: 20,
      donutNum: 18,
      radarR: '60%',
      aiLabel: 10,
      aiLabelOffset: [2, 0]
    };
  }
  return {
    axis: 9,
    legend: 9,
    label: 8,
    markLabel: 8,
    barW: 14,
    barMax: 20,
    wcMin: 8,
    wcMax: 18,
    donutNum: 16,
    radarR: '56%',
    aiLabel: 10,
    aiLabelOffset: [2, 0]
  };
});

// ---- Color palette for charts（浅色下加深，保证白底对比度）----
const CHART_COLORS = computed(() =>
  themeStore.darkMode
    ? {
        primary: '#4a7dbd',
        secondary: '#00d4aa',
        warning: '#ffb020',
        danger: '#ff5c5c',
        info: '#7b8cff',
        purple: '#a78bfa'
      }
    : {
        primary: '#2563eb',
        secondary: '#0d9488',
        warning: '#b45309',
        danger: '#dc2626',
        info: '#4f46e5',
        purple: '#7c3aed'
      }
);

const PIE_COLORS = ['#4a7dbd', '#00d4aa', '#ffb020', '#7b8cff', '#ff7eb3'];

// ---- 图表主题色：深色为默认，浅色下换为白底可读的一套 ----
const chartTheme = computed(() => {
  if (!themeStore.darkMode) {
    return {
      tooltipBg: 'rgba(255, 255, 255, 0.96)',
      tooltipBorder: 'rgba(37, 99, 235, 0.25)',
      tooltipText: '#0f172a',
      legendText: 'rgba(30, 41, 59, 0.78)',
      legendTextDim: 'rgba(30, 41, 59, 0.68)',
      legendTextFaint: 'rgba(51, 65, 85, 0.6)',
      axisLine: 'rgba(37, 99, 235, 0.22)',
      axisLabel: 'rgba(51, 65, 85, 0.72)',
      axisLabelDim: 'rgba(51, 65, 85, 0.6)',
      splitLine: 'rgba(37, 99, 235, 0.12)',
      textPrimary: '#0f172a',
      pieBorder: 'rgba(255, 255, 255, 0.9)',
      pieShadow: 'rgba(15, 23, 42, 0.12)',
      areaBlue: ['rgba(37, 99, 235, 0.22)', 'rgba(37, 99, 235, 0.02)'],
      areaCyan: ['rgba(13, 148, 136, 0.2)', 'rgba(13, 148, 136, 0.02)'],
      barBlue: ['rgba(37, 99, 235, 0.8)', 'rgba(29, 78, 216, 0.55)'],
      barBlueSoft: ['rgba(37, 99, 235, 0.16)', 'rgba(37, 99, 235, 0.04)'],
      barBlueSofter: ['rgba(37, 99, 235, 0.12)', 'rgba(37, 99, 235, 0.03)'],
      barCyanSoft: ['rgba(13, 148, 136, 0.14)', 'rgba(13, 148, 136, 0.03)'],
      bandFills: [
        'rgba(37, 99, 235, 0.06)',
        'rgba(37, 99, 235, 0.1)',
        'rgba(37, 99, 235, 0.06)',
        'rgba(37, 99, 235, 0.03)'
      ],
      textFaint: 'rgba(51, 65, 85, 0.68)',
      textSoft: 'rgba(30, 41, 59, 0.88)'
    };
  }
  return {
    tooltipBg: 'rgba(6, 20, 40, 0.92)',
    tooltipBorder: 'rgba(41, 182, 255, 0.25)',
    tooltipText: '#e0f0ff',
    legendText: 'rgba(180, 210, 240, 0.72)',
    legendTextDim: 'rgba(180, 210, 240, 0.65)',
    legendTextFaint: 'rgba(180, 210, 240, 0.55)',
    axisLine: 'rgba(60, 130, 200, 0.2)',
    axisLabel: 'rgba(160, 195, 235, 0.55)',
    axisLabelDim: 'rgba(160, 195, 235, 0.45)',
    splitLine: 'rgba(60, 130, 200, 0.1)',
    textPrimary: '#e4f2ff',
    pieBorder: 'rgba(4, 16, 32, 0.85)',
    pieShadow: 'rgba(0, 0, 0, 0.35)',
    areaBlue: ['rgba(41, 182, 255, 0.28)', 'rgba(41, 182, 255, 0.02)'],
    areaCyan: ['rgba(0, 212, 170, 0.24)', 'rgba(0, 212, 170, 0.02)'],
    barBlue: ['rgba(41, 182, 255, 0.82)', 'rgba(15, 95, 190, 0.62)'],
    barBlueSoft: ['rgba(41, 182, 255, 0.32)', 'rgba(41, 182, 255, 0.02)'],
    barBlueSofter: ['rgba(41, 182, 255, 0.18)', 'rgba(41, 182, 255, 0.02)'],
    barCyanSoft: ['rgba(0, 212, 170, 0.15)', 'rgba(0, 212, 170, 0.02)'],
    bandFills: [
      'rgba(30, 70, 130, 0.06)',
      'rgba(30, 70, 130, 0.1)',
      'rgba(30, 70, 130, 0.06)',
      'rgba(30, 70, 130, 0.03)'
    ],
    textFaint: 'rgba(170, 200, 240, 0.68)',
    textSoft: 'rgba(228, 242, 255, 0.85)'
  };
});

// ---- Task Distribution Donut Chart (compact with center total) ----
const taskTotal = screenTaskDistribution.reduce((sum, item) => sum + item.value, 0);
const { domRef: taskDistributionDomRef, updateOptions: updateTaskDist } = useEcharts(() => ({
  tooltip: {
    trigger: 'item',
    backgroundColor: chartTheme.value.tooltipBg,
    borderColor: chartTheme.value.tooltipBorder,
    textStyle: { color: chartTheme.value.tooltipText, fontSize: r.value.label },
    formatter: '{b}: {c} ({d}%)'
  },
  legend: {
    bottom: 4,
    left: 'center',
    itemWidth: 10,
    itemHeight: 10,
    itemGap: 14,
    textStyle: { color: chartTheme.value.legendText, fontSize: r.value.legend }
  },
  series: [
    {
      name: '智能体任务分布',
      type: 'pie',
      radius: ['44%', '68%'],
      center: ['50%', '42%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 4,
        borderColor: chartTheme.value.pieBorder,
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
          fill: chartTheme.value.textPrimary,
          fontSize: r.value.donutNum,
          fontWeight: 800
        }
      }
    }
  ]
}));

// ---- Task Trend Line Chart ----
const { domRef: taskTrendDomRef, updateOptions: updateTaskTrend } = useEcharts(() => ({
  tooltip: {
    trigger: 'axis',
    backgroundColor: chartTheme.value.tooltipBg,
    borderColor: chartTheme.value.tooltipBorder,
    textStyle: { color: chartTheme.value.tooltipText, fontSize: r.value.label }
  },
  legend: {
    top: 2,
    right: 8,
    itemWidth: 14,
    itemHeight: 2,
    textStyle: { color: chartTheme.value.legendTextDim, fontSize: r.value.legend }
  },
  grid: { left: 12, right: 18, top: 28, bottom: 22, containLabel: true },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: screenTaskTrend.dates,
    axisLine: { lineStyle: { color: chartTheme.value.axisLine } },
    axisLabel: { color: chartTheme.value.axisLabel, fontSize: r.value.axis },
    axisTick: { show: false }
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: chartTheme.value.splitLine, type: 'dashed' } },
    axisLabel: { color: chartTheme.value.axisLabelDim, fontSize: r.value.axis }
  },
  series: [
    {
      name: '接收任务',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      lineStyle: { width: 2, color: CHART_COLORS.value.primary },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: chartTheme.value.areaBlue[0] },
            { offset: 1, color: chartTheme.value.areaBlue[1] }
          ]
        }
      },
      itemStyle: { color: CHART_COLORS.value.primary },
      data: screenTaskTrend.created
    },
    {
      name: '交付方案',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      lineStyle: { width: 2, color: CHART_COLORS.value.secondary },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: chartTheme.value.areaCyan[0] },
            { offset: 1, color: chartTheme.value.areaCyan[1] }
          ]
        }
      },
      itemStyle: { color: CHART_COLORS.value.secondary },
      data: screenTaskTrend.completed
    }
  ]
}));

// ---- System Status Gauge/Bar Chart ----
const { domRef: systemStatusDomRef, updateOptions: updateSystemStatus } = useEcharts(() => ({
  tooltip: {
    trigger: 'axis',
    backgroundColor: chartTheme.value.tooltipBg,
    borderColor: chartTheme.value.tooltipBorder,
    textStyle: { color: chartTheme.value.tooltipText, fontSize: r.value.label }
  },
  grid: { left: 12, right: 18, top: 20, bottom: 12, containLabel: true },
  xAxis: {
    type: 'category',
    data: ['平台健康度', 'CPU使用率', '内存占用', '存储空间'],
    axisLine: { lineStyle: { color: chartTheme.value.axisLine } },
    axisLabel: { color: chartTheme.value.axisLabel, fontSize: r.value.axis },
    axisTick: { show: false }
  },
  yAxis: {
    type: 'value',
    max: 100,
    splitLine: { lineStyle: { color: chartTheme.value.splitLine, type: 'dashed' } },
    axisLabel: { color: chartTheme.value.axisLabelDim, fontSize: r.value.axis, formatter: '{value}%' }
  },
  series: [
    {
      type: 'bar',
      barWidth: r.value.barW,
      barMaxWidth: r.value.barMax,
      barBorderRadius: [4, 4, 0, 0],
      itemStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: chartTheme.value.barBlue[0] },
            { offset: 1, color: chartTheme.value.barBlue[1] }
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
const { domRef: hotKeywordsDomRef, updateOptions: updateHotKeywords } = useEcharts(
  () =>
    ({
      tooltip: {
        trigger: 'item',
        backgroundColor: chartTheme.value.tooltipBg,
        borderColor: chartTheme.value.tooltipBorder,
        textStyle: { color: chartTheme.value.tooltipText, fontSize: r.value.label }
      },
      series: [
        {
          type: 'wordCloud',
          sizeRange: [r.value.wcMin, r.value.wcMax],
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
                  ? CHART_COLORS.value.primary
                  : i < 7
                    ? CHART_COLORS.value.secondary
                    : i < 11
                      ? CHART_COLORS.value.info
                      : chartTheme.value.textFaint
            }
          }))
        }
      ]
    }) as any
);

// ---- AI Ranking Horizontal Bar Chart ----
const aiRankColors = ['#ff5c5c', '#ffb020', '#4a7dbd', '#7b8cff', '#a78bfa'];
const { domRef: aiRankDomRef, updateOptions: updateAiRank } = useEcharts(() => ({
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    backgroundColor: chartTheme.value.tooltipBg,
    borderColor: chartTheme.value.tooltipBorder,
    textStyle: { color: chartTheme.value.tooltipText, fontSize: r.value.label }
  },
  grid: { left: 14, right: 42, top: 10, bottom: 6, containLabel: true },
  xAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: chartTheme.value.splitLine, type: 'dashed' } },
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
      color: chartTheme.value.legendText,
      fontSize: r.value.legend,
      width: 90,
      overflow: 'truncate',
      ellipsis: '...'
    }
  },
  series: [
    {
      type: 'bar',
      barWidth: r.value.barW - 6,
      barMaxWidth: r.value.barMax - 8,
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
            { offset: 0, color: chartTheme.value.barBlueSofter[0] },
            { offset: 1, color: aiRankColors[params.dataIndex % aiRankColors.length] }
          ]
        })
      },
      showBackground: true,
      backgroundStyle: {
        color: chartTheme.value.splitLine,
        borderRadius: [0, 10, 10, 0]
      },
      label: {
        show: true,
        position: 'right',
        color: chartTheme.value.textSoft,
        fontSize: r.value.aiLabel,
        fontWeight: 700,
        fontFamily: "'DIN', 'Consolas', monospace",
        offset: r.value.aiLabelOffset
      },
      data: screenAiRank.map(i => i.value)
    }
  ]
}));

// ---- Bottom: Data Type Distribution Pie ----
const { domRef: bottomDistDomRef, updateOptions: updateBottomDist } = useEcharts(() => ({
  tooltip: {
    trigger: 'item',
    backgroundColor: chartTheme.value.tooltipBg,
    borderColor: chartTheme.value.tooltipBorder,
    textStyle: { color: chartTheme.value.tooltipText, fontSize: r.value.label },
    formatter: '{b}: {c}TB ({d}%)'
  },
  legend: {
    orient: 'vertical',
    left: 'left',
    top: 'center',
    itemWidth: 9,
    itemHeight: 9,
    itemGap: 10,
    textStyle: { color: chartTheme.value.legendTextDim, fontSize: r.value.legend },
    formatter: name => `${name}  `
  },
  series: [
    {
      name: '基础地理要素类型分布',
      type: 'pie',
      radius: ['48%', '76%'],
      center: ['62%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 4,
        borderColor: chartTheme.value.pieBorder,
        borderWidth: 2
      },
      label: { show: false },
      animationType: 'scale',
      animationEasing: 'elasticOut',
      animationDuration: 1000,
      emphasis: {
        scale: true,
        scaleSize: 6,
        itemStyle: { shadowBlur: 16, shadowColor: chartTheme.value.pieShadow }
      },
      data: screenDataTypeDistribution.map((item, i) => ({
        ...item,
        itemStyle: { color: PIE_COLORS[i % PIE_COLORS.length] }
      }))
    }
  ]
}));

// ---- Bottom: Spatial Coverage Radar Chart ----
const { domRef: bottomRadarDomRef, updateOptions: updateBottomRadar } = useEcharts(() => ({
  tooltip: {
    trigger: 'item',
    backgroundColor: chartTheme.value.tooltipBg,
    borderColor: chartTheme.value.tooltipBorder,
    textStyle: { color: chartTheme.value.tooltipText, fontSize: r.value.label }
  },
  legend: {
    top: 4,
    right: 8,
    itemWidth: 12,
    itemHeight: 3,
    itemGap: 16,
    textStyle: { color: chartTheme.value.legendTextDim, fontSize: r.value.legend }
  },
  radar: {
    indicator: [
      { name: '准确性', max: 100 },
      { name: '实时性', max: 100 },
      { name: '完整性', max: 100 },
      { name: '覆盖度', max: 100 },
      { name: '可用性', max: 100 }
    ],
    radius: r.value.radarR,
    center: ['50%', '54%'],
    shape: 'polygon',
    splitNumber: 4,
    axisName: {
      color: chartTheme.value.textFaint,
      fontSize: r.value.axis,
      padding: [2, 4]
    },
    splitArea: {
      areaStyle: {
        color: chartTheme.value.bandFills
      }
    },
    splitLine: { lineStyle: { color: chartTheme.value.axisLine } },
    axisLine: { lineStyle: { color: chartTheme.value.axisLine } }
  },
  series: [
    {
      name: '要素保障能力',
      type: 'radar',
      symbol: 'circle',
      symbolSize: 4,
      lineStyle: { width: 2 },
      itemStyle: { color: CHART_COLORS.value.primary },
      areaStyle: { opacity: 0.18 },
      data: screenSpatialCoverage.map((item, i) => ({
        ...item,
        lineStyle: { color: i === 0 ? CHART_COLORS.value.primary : CHART_COLORS.value.secondary },
        itemStyle: { color: i === 0 ? CHART_COLORS.value.primary : CHART_COLORS.value.secondary },
        areaStyle: {
          color: i === 0 ? chartTheme.value.barBlueSofter[0] : chartTheme.value.barCyanSoft[0]
        }
      }))
    }
  ]
}));

// ---- Bottom: Data Update Trend Area Chart ----
const { domRef: bottomTrendDomRef, updateOptions: updateBottomTrend } = useEcharts(() => ({
  tooltip: {
    trigger: 'axis',
    backgroundColor: chartTheme.value.tooltipBg,
    borderColor: chartTheme.value.tooltipBorder,
    textStyle: { color: chartTheme.value.tooltipText, fontSize: r.value.label }
  },
  legend: {
    top: 2,
    right: 8,
    itemWidth: 14,
    itemHeight: 2,
    textStyle: { color: chartTheme.value.legendTextFaint, fontSize: r.value.legend },
    data: ['要素更新量']
  },
  grid: { left: 12, right: 18, top: 28, bottom: 22, containLabel: true },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: screenDataUpdateTrend.dates,
    axisLine: { lineStyle: { color: chartTheme.value.axisLine } },
    axisLabel: { color: chartTheme.value.axisLabel, fontSize: r.value.axis },
    axisTick: { show: false }
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: chartTheme.value.splitLine, type: 'dashed' } },
    axisLabel: { color: chartTheme.value.axisLabelDim, fontSize: r.value.axis }
  },
  series: [
    {
      name: '要素更新量',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      step: false,
      lineStyle: { width: 2.5, color: CHART_COLORS.value.primary },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: chartTheme.value.barBlueSoft[0] },
            { offset: 1, color: chartTheme.value.areaBlue[1] }
          ]
        }
      },
      itemStyle: { color: CHART_COLORS.value.primary },
      markPoint: {
        data: [{ type: 'max', name: '最大值' }],
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: { color: CHART_COLORS.value.primary, borderColor: '#fff', borderWidth: 2 },
        label: { color: '#fff', fontSize: r.value.markLabel, fontWeight: 600 }
      },
      data: screenDataUpdateTrend.updates
    }
  ]
}));

// ---- Re-apply chart options when window width crosses a breakpoint ----
const buckets = [0, 720, 1100, 1280, 1440, 1920, Infinity] as const;
function widthBucket(w: number) {
  return buckets.findIndex(b => w < b);
}
function refreshAllCharts() {
  updateTaskDist((_, factory) => factory());
  updateTaskTrend((_, factory) => factory());
  updateSystemStatus((_, factory) => factory());
  updateHotKeywords((_, factory) => factory());
  updateAiRank((_, factory) => factory());
  updateBottomDist((_, factory) => factory());
  updateBottomRadar((_, factory) => factory());
  updateBottomTrend((_, factory) => factory());
}

// 窗口宽度跨断点、或明暗主题切换时，按最新配色重建全部图表
watch(() => widthBucket(windowWidth.value), refreshAllCharts);
watch(() => themeStore.darkMode, refreshAllCharts);
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
              <span class="panel-header__title">智能体任务分布</span>
            </div>
            <div ref="taskDistributionDomRef" class="chart-body"></div>
          </div>

          <!-- Task Trend -->
          <div class="screen-panel">
            <div class="panel-header">
              <SvgIcon icon="mdi:chart-timeline-variant-shimmer" class="panel-header__icon" />
              <span class="panel-header__title">方案生成时效趋势</span>
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
              <span class="panel-header__title">平台运行健康度</span>
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
              <span class="panel-header__title">基础地理要素类型分布</span>
            </div>
            <div ref="bottomDistDomRef" class="chart-body"></div>
          </div>
          <div class="screen-panel">
            <div class="panel-header panel-header--sm">
              <span class="panel-header__title">要素保障能力雷达</span>
            </div>
            <div ref="bottomRadarDomRef" class="chart-body"></div>
          </div>
          <div class="screen-panel">
            <div class="panel-header panel-header--sm">
              <span class="panel-header__title">地理要素更新频次</span>
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
              <span class="panel-header__title">意图解析高频要素</span>
            </div>
            <div ref="hotKeywordsDomRef" class="chart-body"></div>
          </div>

          <!-- AI Ranking -->
          <div class="screen-panel">
            <div class="panel-header">
              <SvgIcon icon="mdi:format-list-numbered" class="panel-header__icon" />
              <span class="panel-header__title">智能体调用榜</span>
            </div>
            <div ref="aiRankDomRef" class="chart-body"></div>
          </div>

          <!-- Event Notifications -->
          <div class="screen-panel screen-panel--notice">
            <div class="panel-header">
              <SvgIcon icon="mdi:bell-ring-outline" class="panel-header__icon" />
              <span class="panel-header__title">情报与态势事件流</span>
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
  /* ---- 背景 ---- */
  --sd-bg-deep: #04101c;
  --sd-bg-bottom: #030c17;
  --sd-bg-veil-1: rgba(10, 70, 140, 0.14);
  --sd-bg-veil-2: rgba(10, 80, 160, 0.07);
  --sd-bg-veil-3: rgba(0, 140, 110, 0.05);
  --sd-bg-veil-4: rgba(41, 100, 200, 0.05);
  --sd-bg-sheen-1: rgba(10, 50, 100, 0.04);
  --sd-bg-sheen-2: rgba(10, 50, 100, 0.03);

  /* ---- 面板 ---- */
  --sd-surface: rgba(6, 20, 38, 0.86);
  --sd-border: rgba(36, 112, 196, 0.22);
  --sd-border-glow: rgba(41, 162, 255, 0.35);
  --sd-panel-inset: rgba(8, 40, 80, 0.15);
  --sd-panel-shadow: rgba(0, 0, 0, 0.25);
  --sd-panel-shadow-hover: rgba(0, 0, 0, 0.3);
  --sd-panel-shadow-strong: rgba(0, 0, 0, 0.35);
  --sd-glow-inset: rgba(41, 162, 255, 0.1);
  --sd-glow-soft: rgba(41, 162, 255, 0.06);
  --sd-glow-mid: rgba(41, 162, 255, 0.08);
  --sd-glow-strong: rgba(41, 162, 255, 0.12);

  /* ---- 面板头 ---- */
  --sd-header-line: rgba(36, 112, 196, 0.12);
  --sd-header-bg-top: rgba(12, 38, 72, 0.5);
  --sd-header-bg-bottom: rgba(6, 22, 44, 0.3);
  --sd-icon-glow: rgba(41, 182, 255, 0.25);
  --sd-title-glow: rgba(41, 182, 255, 0.12);
  --sd-tab-active-bg: rgba(41, 182, 255, 0.15);
  --sd-tab-active-border: rgba(41, 182, 255, 0.25);

  /* ---- 文字 ---- */
  --sd-text-primary: #e4f2ff;
  --sd-text-secondary: rgba(175, 208, 245, 0.72);
  --sd-text-muted: rgba(135, 178, 230, 0.5);
  --sd-text-hover: rgba(175, 208, 245, 0.8);

  /* ---- 强调色 ---- */
  --sd-accent-blue: #4a7dbd;
  --sd-accent-cyan: #00d4aa;
  --sd-accent-orange: #ffb020;
  --sd-accent-red: #ff5c5c;
  --sd-accent-purple: #a78bfa;

  /* ---- KPI ---- */
  --sd-kpi-shadow: rgba(0, 0, 0, 0.15);
  --sd-kpi-shadow-hover: rgba(0, 0, 0, 0.2);
  --sd-kpi-icon-bg-top: rgba(15, 40, 75, 0.8);
  --sd-kpi-icon-bg-bottom: rgba(10, 30, 60, 0.6);
  --sd-kpi-icon-border: rgba(41, 120, 200, 0.2);
  --sd-kpi-icon-glow: rgba(41, 182, 255, 0.1);
  --sd-kpi-value-glow: rgba(41, 182, 255, 0.1);
  --sd-kpi-value-glow-lg: rgba(41, 182, 255, 0.18);
  --sd-delta-up: rgba(0, 212, 170, 0.7);
  --sd-delta-down: rgba(255, 92, 92, 0.7);

  /* ---- 场景切换 ---- */
  --sd-scene-bg: rgba(6, 20, 38, 0.8);
  --sd-scene-border: rgba(36, 112, 196, 0.25);
  --sd-scene-text: rgba(175, 208, 245, 0.5);
  --sd-scene-border-hover: rgba(41, 162, 255, 0.2);
  --sd-scene-active-text: #4a7dbd;
  --sd-scene-active-bg: rgba(41, 182, 255, 0.12);
  --sd-scene-active-border: rgba(41, 182, 255, 0.35);

  /* ---- 通知 ---- */
  --sd-notice-line: rgba(36, 112, 196, 0.08);
  --sd-notice-hover: rgba(41, 162, 255, 0.05);
  --sd-notice-warning: rgba(255, 192, 100, 0.9);
  --sd-notice-error: rgba(255, 120, 120, 0.9);

  /* ---- 杂项 ---- */
  --sd-scroll-thumb: rgba(41, 128, 200, 0.35);

  position: relative;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  background:
    radial-gradient(ellipse 90% 70% at 50% -10%, var(--sd-bg-veil-1) 0%, transparent 55%),
    linear-gradient(180deg, var(--sd-bg-deep) 0%, var(--sd-bg-bottom) 100%);
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
    radial-gradient(circle at 20% 30%, var(--sd-bg-veil-2) 0%, transparent 40%),
    radial-gradient(circle at 80% 60%, var(--sd-bg-veil-3) 0%, transparent 35%),
    radial-gradient(circle at 50% 90%, var(--sd-bg-veil-4) 0%, transparent 40%);
}
.screen-bg-glow {
  background:
    linear-gradient(90deg, transparent 0%, var(--sd-bg-sheen-1) 20%, var(--sd-bg-sheen-1) 80%, transparent 100%),
    linear-gradient(180deg, transparent 0%, var(--sd-bg-sheen-2) 10%, transparent 90%);
}

/* ---------- Main Grid ---------- */
.screen-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(220px, 0.6fr) minmax(0, 1.8fr) minmax(220px, 0.6fr);
  gap: clamp(8px, 0.8vw, 14px);
  height: 100%;
  min-height: 0;
  padding: clamp(8px, 0.8vw, 14px);
  box-sizing: border-box;
}

.screen-col {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  gap: clamp(8px, 0.8vw, 14px);
}

.screen-center {
  width: 100%;
  justify-self: center;
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
    0 0 0 1px var(--sd-panel-inset) inset,
    0 4px 20px var(--sd-panel-shadow);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition:
    border-color 0.3s ease,
    box-shadow 0.3s ease;
}
.screen-panel:hover {
  border-color: var(--sd-border-glow);
  box-shadow:
    0 0 0 1px var(--sd-glow-inset) inset,
    0 4px 24px var(--sd-panel-shadow-hover),
    0 0 12px var(--sd-glow-soft);
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
  border-bottom: 1px solid var(--sd-header-line);
  background: linear-gradient(180deg, var(--sd-header-bg-top) 0%, var(--sd-header-bg-bottom) 100%);
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
  font-size: clamp(14px, 0.5vw + 0.6rem, 17px);
  color: var(--sd-accent-blue);
  opacity: 0.85;
  filter: drop-shadow(0 0 4px var(--sd-icon-glow));
}

.panel-header__title {
  font-size: clamp(12px, 0.55vw + 0.5rem, 15px);
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--sd-text-primary);
  text-shadow: 0 0 8px var(--sd-title-glow);
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
  background: var(--sd-tab-active-bg);
  border: 1px solid var(--sd-tab-active-border);
}

.chart-body {
  flex: 1;
  min-height: 140px;
  padding: 4px 4px 6px;
}
.chart-body--compact {
  padding: 2px 4px 4px;
  min-height: 110px;
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
  box-shadow: 0 1px 8px var(--sd-kpi-shadow);
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;
}
.kpi-item:hover {
  border-color: var(--sd-border-glow);
  box-shadow:
    0 2px 16px var(--sd-kpi-shadow-hover),
    0 0 8px var(--sd-glow-mid);
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
  background: linear-gradient(135deg, var(--sd-kpi-icon-bg-top), var(--sd-kpi-icon-bg-bottom));
  border: 1px solid var(--sd-kpi-icon-border);
  box-shadow: 0 0 6px var(--sd-kpi-icon-glow);
}

.kpi-item__info {
  min-width: 0;
}
.kpi-item__label {
  font-size: clamp(10px, 0.5vw + 0.45rem, 12px);
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
  font-size: clamp(14px, 1vw + 0.55rem, 22px);
  font-weight: 700;
  color: var(--sd-text-primary);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  text-shadow: 0 0 6px var(--sd-kpi-value-glow);
}
.kpi-item__delta {
  font-size: clamp(9px, 0.4vw + 0.4rem, 11px);
  font-weight: 600;
  color: var(--sd-delta-up);
}
.kpi-item__delta.down {
  color: var(--sd-delta-down);
}
.kpi-item__unit {
  font-size: clamp(9px, 0.4vw + 0.4rem, 11px);
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
    0 0 0 1px var(--sd-panel-inset) inset,
    0 4px 20px var(--sd-panel-shadow);
  animation: globe-border-breathe 4s ease-in-out infinite;
}

@keyframes globe-border-breathe {
  0%,
  100% {
    box-shadow:
      0 0 0 1px var(--sd-panel-inset) inset,
      0 4px 20px var(--sd-panel-shadow),
      0 0 0 rgba(41, 162, 255, 0);
  }
  50% {
    box-shadow:
      0 0 0 1px var(--sd-panel-inset) inset,
      0 4px 20px var(--sd-panel-shadow),
      0 0 8px var(--sd-glow-strong);
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
  background: var(--sd-scene-bg);
  border: 1px solid var(--sd-scene-border);
  border-radius: 4px;
  padding: 3px;
  backdrop-filter: blur(8px);
}

.scene-mode-btn {
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--sd-scene-text);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 0.3px;
}

.scene-mode-btn:hover {
  color: var(--sd-text-hover);
  border-color: var(--sd-scene-border-hover);
}

.scene-mode-btn.active {
  color: var(--sd-scene-active-text);
  background: var(--sd-scene-active-bg);
  border-color: var(--sd-scene-active-border);
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
    0 0 0 1px var(--sd-glow-strong) inset,
    0 6px 28px var(--sd-panel-shadow-strong),
    0 0 16px var(--sd-glow-mid);
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
  border-bottom: 1px solid var(--sd-notice-line);
  transition:
    background 0.2s ease,
    transform 0.2s ease;
  border-radius: 3px;
}
.notice-item:last-child {
  border-bottom: none;
}
.notice-item:hover {
  background: var(--sd-notice-hover);
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
  color: var(--sd-notice-warning);
}
.notice-level--error {
  color: var(--sd-notice-error);
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
  background: linear-gradient(90deg, var(--sd-text-primary) 40%, var(--sd-accent-blue) 50%, var(--sd-text-primary) 60%);
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
  background: var(--sd-scroll-thumb);
}
.screen-dashboard::-webkit-scrollbar-track,
.notice-list::-webkit-scrollbar-track {
  background: transparent;
}

/* ============================================================
   RESPONSIVE BREAKPOINTS
   ≥1920 4K boost, ≥1440 default, 1280 step-down,
   1100 single-column, 720 phone-style
   ============================================================ */

@media (min-width: 1920px) {
  .screen-grid {
    grid-template-columns: minmax(260px, 0.65fr) minmax(0, 1.9fr) minmax(260px, 0.65fr);
  }
  .kpi-item__value {
    text-shadow: 0 0 8px var(--sd-kpi-value-glow-lg);
  }
  .chart-body {
    min-height: 180px;
  }
  .chart-body--compact {
    min-height: 140px;
  }
}

@media (max-width: 1440px) {
  .screen-grid {
    grid-template-columns: minmax(200px, 0.55fr) minmax(0, 1.7fr) minmax(200px, 0.55fr);
  }
  .kpi-item__icon-wrap {
    width: 28px;
    height: 28px;
    font-size: 14px;
  }
}

@media (max-width: 1280px) {
  .screen-grid {
    grid-template-columns: minmax(180px, 0.5fr) minmax(0, 1.4fr) minmax(180px, 0.5fr);
  }
  .bottom-charts {
    grid-template-columns: 1fr;
    min-height: 200px;
  }
  .panel-header {
    padding: 8px 10px;
  }
  .panel-header--sm {
    padding: 6px 10px;
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
  .bottom-charts {
    grid-template-columns: repeat(3, 1fr);
  }
  .chart-body {
    min-height: 180px;
  }
}

@media (max-width: 720px) {
  .kpi-bar {
    flex-wrap: wrap;
  }
  .kpi-item {
    min-width: calc(50% - 4px);
    flex: 1 1 calc(50% - 4px);
  }
  .screen-left,
  .screen-right {
    flex-direction: column;
  }
  .bottom-charts {
    grid-template-columns: 1fr;
  }
  .kpi-item__value {
    font-size: 16px;
  }
  .panel-header__title {
    font-size: 12px;
  }
  .chart-body {
    min-height: 160px;
  }
}

/* ============================================================
   浅色主题适配
   深色为默认值，浅色在此覆盖同一批语义变量即可整体换肤
   ============================================================ */
html:not(.dark) .screen-dashboard {
  /* ---- 背景 ---- */
  --sd-bg-deep: #eef2f7;
  --sd-bg-bottom: #f7f9fc;
  --sd-bg-veil-1: rgba(37, 99, 235, 0.08);
  --sd-bg-veil-2: rgba(37, 99, 235, 0.05);
  --sd-bg-veil-3: rgba(13, 148, 136, 0.05);
  --sd-bg-veil-4: rgba(37, 99, 235, 0.04);
  --sd-bg-sheen-1: rgba(15, 23, 42, 0.02);
  --sd-bg-sheen-2: rgba(15, 23, 42, 0.015);

  /* ---- 面板 ---- */
  --sd-surface: rgba(255, 255, 255, 0.92);
  --sd-border: rgba(37, 99, 235, 0.18);
  --sd-border-glow: rgba(37, 99, 235, 0.42);
  --sd-panel-inset: rgba(255, 255, 255, 0.9);
  --sd-panel-shadow: rgba(15, 23, 42, 0.08);
  --sd-panel-shadow-hover: rgba(15, 23, 42, 0.12);
  --sd-panel-shadow-strong: rgba(15, 23, 42, 0.14);
  --sd-glow-inset: rgba(37, 99, 235, 0.06);
  --sd-glow-soft: rgba(37, 99, 235, 0.06);
  --sd-glow-mid: rgba(37, 99, 235, 0.08);
  --sd-glow-strong: rgba(37, 99, 235, 0.1);

  /* ---- 面板头 ---- */
  --sd-header-line: rgba(37, 99, 235, 0.12);
  --sd-header-bg-top: rgba(240, 245, 252, 0.92);
  --sd-header-bg-bottom: rgba(248, 250, 253, 0.72);
  --sd-icon-glow: rgba(37, 99, 235, 0.16);
  --sd-title-glow: rgba(37, 99, 235, 0.1);
  --sd-tab-active-bg: rgba(37, 99, 235, 0.1);
  --sd-tab-active-border: rgba(37, 99, 235, 0.28);

  /* ---- 文字 ---- */
  --sd-text-primary: #0f172a;
  --sd-text-secondary: rgba(30, 41, 59, 0.75);
  --sd-text-muted: rgba(51, 65, 85, 0.6);
  --sd-text-hover: rgba(30, 41, 59, 0.9);

  /* ---- 强调色（浅底上加深，保证对比度） ---- */
  --sd-accent-blue: #2563eb;
  --sd-accent-cyan: #0d9488;
  --sd-accent-orange: #b45309;
  --sd-accent-red: #dc2626;
  --sd-accent-purple: #7c3aed;

  /* ---- KPI ---- */
  --sd-kpi-shadow: rgba(15, 23, 42, 0.06);
  --sd-kpi-shadow-hover: rgba(15, 23, 42, 0.1);
  --sd-kpi-icon-bg-top: rgba(37, 99, 235, 0.12);
  --sd-kpi-icon-bg-bottom: rgba(37, 99, 235, 0.06);
  --sd-kpi-icon-border: rgba(37, 99, 235, 0.2);
  --sd-kpi-icon-glow: rgba(37, 99, 235, 0.1);
  --sd-kpi-value-glow: rgba(37, 99, 235, 0.08);
  --sd-kpi-value-glow-lg: rgba(37, 99, 235, 0.12);
  --sd-delta-up: rgba(13, 148, 136, 0.95);
  --sd-delta-down: rgba(220, 38, 38, 0.95);

  /* ---- 场景切换 ---- */
  --sd-scene-bg: rgba(255, 255, 255, 0.9);
  --sd-scene-border: rgba(37, 99, 235, 0.2);
  --sd-scene-text: rgba(51, 65, 85, 0.6);
  --sd-scene-border-hover: rgba(37, 99, 235, 0.3);
  --sd-scene-active-text: #1d4ed8;
  --sd-scene-active-bg: rgba(37, 99, 235, 0.1);
  --sd-scene-active-border: rgba(37, 99, 235, 0.35);

  /* ---- 通知 ---- */
  --sd-notice-line: rgba(37, 99, 235, 0.1);
  --sd-notice-hover: rgba(37, 99, 235, 0.06);
  --sd-notice-warning: #b45309;
  --sd-notice-error: #dc2626;

  /* ---- 杂项 ---- */
  --sd-scroll-thumb: rgba(37, 99, 235, 0.25);
}
</style>
