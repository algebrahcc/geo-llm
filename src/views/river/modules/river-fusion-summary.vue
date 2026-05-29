<script setup lang="ts">
import type { FusionDataSummary } from './types';

defineOptions({
  name: 'RiverFusionSummary'
});

interface Props {
  data: FusionDataSummary;
}

defineProps<Props>();

const emit = defineEmits<{
  aiGenerate: [];
}>();
</script>

<template>
  <div class="fusion-summary">
    <div class="fusion-header">
      <div class="fusion-title">
        <SvgIcon icon="mdi:database-sync-outline" class="fusion-icon" />
        <span>融合数据概要</span>
      </div>
      <NButton size="tiny" type="primary" secondary @click="emit('aiGenerate')">
        <template #icon><SvgIcon icon="mdi:robot-outline" /></template>
        AI 生成
      </NButton>
    </div>

    <div class="fusion-columns">
      <!-- 河水信息 -->
      <div class="fusion-col">
        <div class="col-header">
          <SvgIcon icon="mdi:waves" class="col-icon" />
          <span>河水信息</span>
        </div>
        <div class="col-body">
          <div class="data-row">
            <span class="data-key">流量</span>
            <span class="data-val">{{ data.waterInfo.flowRate }}</span>
          </div>
          <div class="data-row">
            <span class="data-key">平均流速</span>
            <span class="data-val">{{ data.waterInfo.avgVelocity }}</span>
          </div>
          <div class="data-row">
            <span class="data-key">岸倾水位</span>
            <span class="data-val">{{ data.waterInfo.bankWaterLevel }}</span>
          </div>
        </div>
      </div>

      <!-- 地形地貌 -->
      <div class="fusion-col">
        <div class="col-header">
          <SvgIcon icon="mdi:terrain" class="col-icon" />
          <span>地形地貌</span>
        </div>
        <div class="col-body">
          <div class="data-row">
            <span class="data-key">地形类型</span>
            <span class="data-val">{{ data.terrainInfo.terrainType }}</span>
          </div>
          <div class="data-row">
            <span class="data-key">坡度范围</span>
            <span class="data-val">{{ data.terrainInfo.slopeRange }}</span>
          </div>
          <div class="data-row">
            <span class="data-key">植被覆盖率</span>
            <span class="data-val">{{ data.terrainInfo.vegetationCoverage }}</span>
          </div>
        </div>
      </div>

      <!-- 遥感影像 -->
      <div class="fusion-col">
        <div class="col-header">
          <SvgIcon icon="mdi:satellite-variant" class="col-icon" />
          <span>遥感影像</span>
        </div>
        <div class="col-body">
          <div class="data-row">
            <span class="data-key">最近影像</span>
            <span class="data-val">{{ data.remoteSensing.latestImage }}</span>
          </div>
          <div class="data-row">
            <span class="data-key">分辨率</span>
            <span class="data-val">{{ data.remoteSensing.resolution }}</span>
          </div>
          <div class="data-row">
            <span class="data-key">情报强度</span>
            <span class="data-val">{{ data.remoteSensing.intelligenceLevel }}</span>
          </div>
        </div>
      </div>

      <!-- 文本情报 -->
      <div class="fusion-col">
        <div class="col-header">
          <SvgIcon icon="mdi:file-document-outline" class="col-icon" />
          <span>文本情报</span>
        </div>
        <div class="col-body">
          <div class="data-row">
            <span class="data-key">相关报告数</span>
            <span class="data-val">{{ data.textIntel.reportCount }}</span>
          </div>
          <div class="data-row">
            <span class="data-key">情报强度</span>
            <span class="data-val">{{ data.textIntel.intelligenceLevel }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fusion-summary {
  padding: 12px 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.82);
  backdrop-filter: blur(14px);
}

.fusion-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.fusion-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.fusion-icon {
  font-size: 16px;
  color: #2b6bff;
}

.fusion-columns {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.fusion-col {
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
}

.col-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.78);
}

.col-icon {
  font-size: 14px;
  color: #5ea4ff;
}

.col-body {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.data-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
}

.data-key {
  color: rgba(255, 255, 255, 0.48);
}

.data-val {
  color: rgba(255, 255, 255, 0.88);
  font-weight: 500;
}
</style>
