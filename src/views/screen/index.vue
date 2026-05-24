<script setup lang="ts">
import 'echarts-wordcloud';
import OfflineOlMap from '@/components/custom/offline-ol-map.vue';
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

defineOptions({
  name: 'ScreenPage'
});

const { domRef: taskDistributionDomRef } = useEcharts(() => ({
  tooltip: { trigger: 'item' },
  legend: { bottom: 0, left: 'center' },
  series: [
    {
      name: '任务分布',
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '45%'],
      itemStyle: { borderRadius: 6, borderColor: 'transparent', borderWidth: 2 },
      label: { show: false },
      data: screenTaskDistribution
    }
  ]
}));

const { domRef: taskTrendDomRef } = useEcharts(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 10, right: 10, top: 18, bottom: 12, containLabel: true },
  xAxis: { type: 'category', boundaryGap: false, data: screenTaskTrend.dates },
  yAxis: { type: 'value', splitLine: { show: true } },
  series: [
    { name: '新建', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, data: screenTaskTrend.created },
    { name: '完成', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, data: screenTaskTrend.completed }
  ]
}));

const { domRef: systemStatusDomRef } = useEcharts(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 10, right: 10, top: 18, bottom: 8, containLabel: true },
  xAxis: {
    type: 'category',
    data: ['健康度', 'CPU', '内存', '存储']
  },
  yAxis: { type: 'value', max: 100 },
  series: [
    {
      type: 'bar',
      barWidth: 18,
      data: [screenSystemStatus.health, screenSystemStatus.cpu, screenSystemStatus.memory, screenSystemStatus.storage]
    }
  ]
}));

const { domRef: hotKeywordsDomRef } = useEcharts(
  () =>
    ({
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'wordCloud',
          sizeRange: [10, 24],
          rotationRange: [0, 0],
          gridSize: 4,
          drawOutOfBound: false,
          layoutAnimation: true,
          textStyle: {
            fontWeight: 'bold',
            color: () => {
              return `rgb(${[Math.round(Math.random() * 160) + 95, Math.round(Math.random() * 160) + 95, Math.round(Math.random() * 160) + 95].join(',')})`;
            }
          },
          emphasis: {
            focus: 'self',
            textStyle: {
              textShadowBlur: 10,
              textShadowColor: 'rgba(0, 0, 0, 0.3)'
            }
          },
          data: screenHotKeywords
        }
      ]
    }) as any
);

const { domRef: aiRankDomRef } = useEcharts(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 10, right: 10, top: 10, bottom: 6, containLabel: true },
  xAxis: { type: 'value' },
  yAxis: { type: 'category', data: screenAiRank.map(i => i.name) },
  series: [{ type: 'bar', data: screenAiRank.map(i => i.value) }]
}));

// Bottom Center Charts
const { domRef: bottomDistDomRef } = useEcharts(() => ({
  tooltip: { trigger: 'item' },
  legend: { orient: 'vertical', left: 'left', textStyle: { fontSize: 10 } },
  series: [
    {
      name: '数据分布',
      type: 'pie',
      radius: ['50%', '80%'],
      center: ['65%', '50%'],
      avoidLabelOverlap: false,
      label: { show: false },
      data: screenTaskDistribution
    }
  ]
}));

const { domRef: bottomRadarDomRef } = useEcharts(() => ({
  tooltip: { trigger: 'item' },
  radar: {
    indicator: [
      { name: '准确性', max: 100 },
      { name: '实时性', max: 100 },
      { name: '完整性', max: 100 },
      { name: '覆盖度', max: 100 },
      { name: '可用性', max: 100 }
    ],
    radius: '70%',
    center: ['50%', '50%'],
    axisName: { fontSize: 10 }
  },
  series: [
    {
      name: '空间数据覆盖',
      type: 'radar',
      data: screenSpatialCoverage
    }
  ]
}));

const { domRef: bottomTrendDomRef } = useEcharts(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 10, right: 10, top: 10, bottom: 0, containLabel: true },
  xAxis: { type: 'category', data: screenDataUpdateTrend.dates },
  yAxis: { type: 'value' },
  series: [
    {
      name: '更新量',
      type: 'line',
      smooth: true,
      areaStyle: {
        opacity: 0.2
      },
      data: screenDataUpdateTrend.updates
    }
  ]
}));
</script>

<template>
  <NGrid responsive="screen" item-responsive :x-gap="16" :y-gap="16" cols="24" class="screen-wrap h-full bg-layout">
    <!-- Left Column -->
    <NGi span="24 s:24 m:6" class="h-full">
      <div class="flex flex-col h-full gap-16px">
        <NCard :bordered="false" size="small" class="panel-card flex-1">
          <template #header>
            <div class="panel-header">
              <div class="flex items-center gap-8px">
                <SvgIcon icon="mdi:chart-donut" class="panel-icon" />
                <span class="panel-title">任务分布概览</span>
              </div>
            </div>
          </template>
          <div ref="taskDistributionDomRef" class="h-full min-h-200px w-full"></div>
        </NCard>
        <NCard :bordered="false" size="small" class="panel-card flex-1">
          <template #header>
            <div class="panel-header">
              <div class="flex items-center gap-8px">
                <SvgIcon icon="mdi:chart-line" class="panel-icon" />
                <span class="panel-title">任务趋势</span>
              </div>
            </div>
          </template>
          <div ref="taskTrendDomRef" class="h-full min-h-200px w-full"></div>
        </NCard>
        <NCard :bordered="false" size="small" class="panel-card flex-1">
          <template #header>
            <div class="panel-header">
              <div class="flex items-center gap-8px">
                <SvgIcon icon="mdi:server" class="panel-icon" />
                <span class="panel-title">系统运行状态</span>
              </div>
            </div>
          </template>
          <div ref="systemStatusDomRef" class="h-full min-h-160px w-full"></div>
        </NCard>
      </div>
    </NGi>

    <!-- Center Column -->
    <NGi span="24 s:24 m:12" class="h-full">
      <div class="flex flex-col h-full">
        <!-- Top KPIs (aligned with map width) -->
        <NGrid responsive="screen" item-responsive :x-gap="12" :y-gap="12" cols="24" class="mb-16px shrink-0">
          <NGi v-for="item in screenKpis" :key="item.key" span="24 s:12 m:4">
            <NCard :bordered="false" size="small" class="panel-card kpi-card !h-full">
              <div class="flex items-center justify-between h-full px-4px">
                <div class="flex-1 min-w-0 text-center">
                  <div class="kpi-label text-12px truncate opacity-70">{{ item.label }}</div>
                  <div class="mt-4px flex items-baseline justify-center gap-4px">
                    <div class="kpi-value text-22px font-700 truncate line-height-none">{{ item.value }}</div>
                    <div class="text-11px opacity-50 shrink-0">{{ item.unit }}</div>
                  </div>
                </div>
              </div>
            </NCard>
          </NGi>
        </NGrid>

        <!-- Main Map -->
        <NCard :bordered="false" class="panel-card flex-1" :content-style="{ padding: '0px', height: '100%' }">
          <div class="h-full w-full">
            <OfflineOlMap
              class="h-full w-full"
              tile-url="/google satellite-z0-8.yocMFTJvR/{z}/{x}/{y}.jpg"
              :min-zoom="0"
              :max-zoom="8"
              :zoom="3"
            />
          </div>
        </NCard>

        <!-- Bottom 3 Charts -->
        <NGrid responsive="screen" item-responsive :x-gap="16" :y-gap="16" cols="24" class="mt-16px shrink-0">
          <NGi span="24 m:8">
            <NCard :bordered="false" size="small" title="数据分布类型图" class="panel-card">
              <div ref="bottomDistDomRef" class="h-160px w-full"></div>
            </NCard>
          </NGi>
          <NGi span="24 m:8">
            <NCard :bordered="false" size="small" title="空间数据覆盖雷达图" class="panel-card">
              <div ref="bottomRadarDomRef" class="h-160px w-full"></div>
            </NCard>
          </NGi>
          <NGi span="24 m:8">
            <NCard :bordered="false" size="small" title="数据更新趋势图" class="panel-card">
              <div ref="bottomTrendDomRef" class="h-160px w-full"></div>
            </NCard>
          </NGi>
        </NGrid>
      </div>
    </NGi>

    <!-- Right Column -->
    <NGi span="24 s:24 m:6" class="h-full">
      <div class="flex flex-col h-full gap-16px">
        <NCard :bordered="false" size="small" class="panel-card flex-1">
          <template #header>
            <div class="panel-header">
              <div class="flex items-center gap-8px">
                <SvgIcon icon="mdi:fire" class="panel-icon" />
                <span class="panel-title">热点词云</span>
                <span class="panel-sub">Top5</span>
              </div>
            </div>
          </template>
          <div ref="hotKeywordsDomRef" class="h-full min-h-200px w-full"></div>
        </NCard>
        <NCard :bordered="false" size="small" class="panel-card flex-1">
          <template #header>
            <div class="panel-header">
              <div class="flex items-center gap-8px">
                <SvgIcon icon="mdi:trophy-outline" class="panel-icon" />
                <span class="panel-title">AI 分析任务排名</span>
                <span class="panel-sub">Top5</span>
              </div>
            </div>
          </template>
          <div ref="aiRankDomRef" class="h-full min-h-200px w-full"></div>
        </NCard>
        <NCard :bordered="false" size="small" class="panel-card flex-1 overflow-hidden">
          <template #header>
            <div class="panel-header">
              <div class="flex items-center gap-8px">
                <SvgIcon icon="mdi:bell-outline" class="panel-icon" />
                <span class="panel-title">任务分析通知</span>
              </div>
            </div>
          </template>
          <div class="flex flex-col h-full overflow-y-auto divide-y divide-white/6 pr-4px">
            <div v-for="n in screenNotices" :key="n.id" class="py-10px">
              <div class="flex items-center justify-between gap-10px">
                <div class="min-w-0 flex items-center gap-8px">
                  <NTag :type="n.level" size="small" :bordered="false">
                    {{ n.level === 'info' ? '信息' : n.level === 'warning' ? '告警' : '错误' }}
                  </NTag>
                  <div class="min-w-0 truncate text-13px font-500">{{ n.title }}</div>
                </div>
                <div class="shrink-0 text-12px opacity-60">{{ n.time }}</div>
              </div>
              <div v-if="n.detail" class="mt-6px text-12px opacity-70">{{ n.detail }}</div>
            </div>
          </div>
        </NCard>
      </div>
    </NGi>
  </NGrid>
</template>

<style scoped>
.screen-wrap {
  min-height: calc(100vh - 140px);
}

.kpi-card {
  height: 64px;
}

.panel-card {
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.03));
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.25);
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.panel-card:hover {
  transform: translateY(-1px);
  border-color: rgba(var(--primary-500-color) / 0.35);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel-title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.2px;
}

.panel-sub {
  font-size: 12px;
  opacity: 0.65;
}

.panel-icon {
  font-size: 16px;
  opacity: 0.9;
  color: rgb(var(--primary-400-color));
}

.kpi-card {
  position: relative;
  overflow: hidden;
}

.kpi-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 3px;
  height: 100%;
  background: linear-gradient(180deg, rgb(var(--primary-400-color)), rgb(var(--primary-700-color)));
  opacity: 0.85;
}

.kpi-label {
  opacity: 0.72;
}

.kpi-value {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  letter-spacing: 0.4px;
}

.kpi-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--primary-500-color) / 0.12);
  border: 1px solid rgba(var(--primary-500-color) / 0.22);
}
</style>
