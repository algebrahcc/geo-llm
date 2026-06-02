<script setup lang="ts">
import { computed } from 'vue';
import type {
  BuildingDetailInfo,
  BuildingBIMFloor,
  BuildingEntrance,
} from './types';
import { BIMLegendItems, type BIMLegendKey } from './types';

defineOptions({
  name: 'BuildingInfoPanel'
});

interface Props {
  detail: BuildingDetailInfo;
  bimFloors: BuildingBIMFloor[];
  entrances: BuildingEntrance[];
  primaryEntranceId?: string;
  collapsed: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  toggleCollapse: [];
  setPrimaryEntrance: [id: string];
}>();

const primaryEntrance = computed(
  () => props.entrances.find(e => e.id === props.primaryEntranceId) || props.entrances[0] || null
);

function getLegendColor(key: BIMLegendKey) {
  return BIMLegendItems.find(item => item.key === key)?.color || '#e8e8e8';
}
</script>

<template>
  <NCard :bordered="false" size="small" class="info-panel" :class="[{ 'info-panel--collapsed': collapsed }]">
    <template #header>
      <div class="panel-title-wrap">
        <div class="title-group">
          <SvgIcon icon="mdi:office-building-outline" class="panel-icon" />
          <span>建筑文本信息</span>
        </div>
        <NButton quaternary circle size="small" @click="emit('toggleCollapse')">
          <template #icon>
            <SvgIcon :icon="collapsed ? 'mdi:chevron-left' : 'mdi:chevron-right'" />
          </template>
        </NButton>
      </div>
    </template>

    <div v-if="!collapsed" class="panel-body">
      <!-- ════════ 建筑基本信息 ════════ -->
      <div class="section">
        <div class="section-label">建筑文本信息</div>

        <div class="detail-grid">
          <div class="detail-cell"><span class="dc-k">建筑名称</span><span class="dc-v">{{ detail.name }}</span></div>
          <div class="detail-cell"><span class="dc-k">建筑类型</span><span class="dc-v">{{ detail.buildingType }}</span></div>
          <div class="detail-cell"><span class="dc-k">占地面积</span><span class="dc-v">{{ detail.area }} m²</span></div>
          <div class="detail-cell"><span class="dc-k">地上层数</span><span class="dc-v">{{ detail.aboveGroundFloors }}F</span></div>
          <div class="detail-cell"><span class="dc-k">地下层数</span><span class="dc-v">{{ detail.belowGroundFloors }}F</span></div>
          <div class="detail-cell"><span class="dc-k">建筑面积</span><span class="dc-v mono">~{{ detail.totalArea.toLocaleString() }} m²</span></div>
          <div class="detail-cell"><span class="dc-k">结构类型</span><span class="dc-v">{{ detail.structureType }}</span></div>
          <div class="detail-cell"><span class="dc-k">建造年份</span><span class="dc-v">{{ detail.builtYear }}年</span></div>
          <div class="detail-cell"><span class="dc-k">使用情况</span><span class="dc-v">{{ detail.usageStatus }}</span></div>
        </div>
        <div class="remark-box">
          <span class="remark-label">备注情况</span>
          <span class="remark-text">{{ detail.remarks }}</span>
        </div>
      </div>

      <!-- ════════ 内部结构 BIM 示意图 ════════ -->
      <div class="section">
        <div class="section-label">内部结构BIM示意图</div>

        <div class="bim-layout">
          <!-- 楼层列表 -->
          <div class="bim-floor-list">
            <div
              v-for="floor in bimFloors"
              :key="floor.id"
              class="bim-floor-item"
            >
              <span class="floor-badge" :style="{ color: floor.color }">{{ floor.label }}</span>
            </div>
          </div>

          <!-- 建筑剖面示意 -->
          <div class="bim-diagram">
            <svg viewBox="0 0 120 130" class="bim-svg">
              <!-- 建筑外轮廓 -->
              <rect x="15" y="8" width="90" height="115" rx="2" fill="none" stroke="#5ea4ff" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.6"/>
              <!-- 楼顶 -->
              <line x1="14" y1="12" x2="106" y2="12" stroke="rgba(255,255,255,0.15)" stroke-width="0.8"/>
              <!-- 楼层线 + 楼梯间示意 -->
              <line x1="16" y1="32" x2="104" y2="32" stroke="rgba(255,255,255,0.08)" stroke-width="0.5"/>
              <rect x="25" y="16" width="12" height="14" rx="1" fill="#e8e8e8" opacity="0.6"/>
              <rect x="41" y="16" width="20" height="14" rx="1" fill="#ffcf5c" opacity="0.5"/>
              <rect x="65" y="16" width="34" height="14" rx="1" fill="#e8e8e8" opacity="0.6"/>

              <line x1="16" y1="52" x2="104" y2="52" stroke="rgba(255,255,255,0.08)" stroke-width="0.5"/>
              <rect x="25" y="36" width="12" height="14" rx="1" fill="#5ea4ff" opacity="0.5"/>
              <rect x="41" y="36" width="30" height="14" rx="1" fill="#e8e8e8" opacity="0.6"/>
              <rect x="75" y="36" width="24" height="14" rx="1" fill="#e8e8e8" opacity="0.6"/>

              <line x1="16" y1="72" x2="104" y2="72" stroke="rgba(255,255,255,0.08)" stroke-width="0.5"/>
              <rect x="25" y="56" width="12" height="14" rx="1" fill="#5ea4ff" opacity="0.4"/>
              <rect x="41" y="56" width="28" height="14" rx="1" fill="#fb7185" opacity="0.5"/>
              <rect x="73" y="56" width="26" height="14" rx="1" fill="#fb7185" opacity="0.5"/>

              <line x1="16" y1="92" x2="104" y2="92" stroke="rgba(255,255,255,0.08)" stroke-width="0.5"/>
              <rect x="25" y="76" width="12" height="14" rx="1" fill="#5ea4ff" opacity="0.3"/>
              <rect x="41" y="76" width="58" height="14" rx="1" fill="#fb7185" opacity="0.5"/>

              <line x1="16" y1="112" x2="104" y2="112" stroke="rgba(255,255,255,0.08)" stroke-width="0.5"/>
              <rect x="25" y="96" width="12" height="14" rx="1" fill="#5ea4ff" opacity="0.3"/>
              <rect x="41" y="96" width="58" height="14" rx="1" fill="#fb7185" opacity="0.4"/>

              <text x="60" y="125" font-size="7" fill="rgba(255,255,255,0.25)" text-anchor="middle">预制板公寓剖面</text>
            </svg>
          </div>

          <!-- 图例 -->
          <div class="bim-legend">
            <div v-for="item in BIMLegendItems" :key="item.key" class="legend-item">
              <span class="legend-dot" :style="{ background: item.color }" />
              <span class="legend-label">{{ item.label }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ════════ 主要入口信息 ════════ -->
      <div class="section section--last">
        <div class="section-label">主要入口信息</div>

        <div v-if="primaryEntrance" class="entrance-card">
          <div class="entrance-head">
            <span class="entrance-name">{{ primaryEntrance.name }}</span>
            <NTag
              v-if="primaryEntrance.isPrimary"
              size="small"
              type="info"
              round
            >主入口</NTag>
            <NButton
              size="tiny"
              type="primary"
              @click="emit('setPrimaryEntrance', primaryEntrance.id)"
            >设为主要突破口</NButton>
          </div>

          <div class="entrance-grid">
            <div class="eg-cell"><span class="eg-k">入口类型</span><span class="eg-v">{{ primaryEntrance.type }}</span></div>
            <div class="eg-cell"><span class="eg-k">朝向</span><span class="eg-v">{{ primaryEntrance.orientation }}</span></div>
            <div class="eg-cell"><span class="eg-k">宽度</span><span class="eg-v">{{ primaryEntrance.width }} m</span></div>
            <div class="eg-cell"><span class="eg-k">高度</span><span class="eg-v">{{ primaryEntrance.height }} m</span></div>
            <div class="eg-cell"><span class="eg-k">门类型</span><span class="eg-v">{{ primaryEntrance.doorType }}</span></div>
            <div class="eg-cell"><span class="eg-k">防护等级</span><span class="eg-v">{{ primaryEntrance.protectionLevel }}</span></div>
          </div>
          <div class="entrance-suspicious">
            <span class="es-label">可疑特征</span>
            <span class="es-value">{{ primaryEntrance.suspiciousFeatures || '—' }}</span>
          </div>
        </div>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
.info-panel {
  width: 310px;
  max-height: min(780px, calc(100vh - 130px));
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(8, 14, 26, 0.9);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255,255,255,0.03);
  backdrop-filter: blur(20px);
  overflow: hidden;
}
.info-panel--collapsed { width: 186px; }

.panel-title-wrap {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  color: rgba(255, 255, 255, 0.9);
}
.title-group { display: flex; align-items: center; gap: 8px; }
.panel-icon { font-size: 17px; color: #22c55e; }

.panel-body {
  display: flex; flex-direction: column; gap: 14px;
  max-height: min(700px, calc(100vh - 280px));
  overflow-y: auto; padding: 4px 2px 0 0; margin-right: -2px;
}
.section { border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 14px; }
.section--last { border-bottom: none; padding-bottom: 0; }

.section-label {
  font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.85);
  margin-bottom: 10px; letter-spacing: 0.02em;
}

.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 8px; }
.detail-cell {
  display: flex; flex-direction: column; gap: 3px; padding: 7px 9px; border-radius: 6px;
  background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);
  transition: border-color 0.15s, background 0.15s;
}
.detail-cell:hover { border-color: rgba(34,197,94,0.15); background: rgba(34,197,94,0.03); }
.dc-k { font-size: 10px; color: rgba(255,255,255,0.38); font-weight: 500; text-transform: uppercase; letter-spacing: 0.02em; }
.dc-v { font-size: 12px; color: rgba(255,255,255,0.88); font-weight: 600; }
.dc-v.mono { font-family: 'JetBrains Mono',monospace; font-size: 11px; }

.remark-box {
  display: flex; flex-direction: column; gap: 3px;
  margin-top: 6px; padding: 8px 10px; border-radius: 8px;
  background: rgba(251,191,36,0.06); border: 1px solid rgba(251,191,36,0.15);
  border-left: 2px solid #fbbf24;
}
.remark-label { font-size: 10px; color: rgba(251,191,36,0.85); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
.remark-text { font-size: 12px; color: rgba(255,255,255,0.65); line-height: 1.55; }

.bim-layout { display: flex; flex-direction: column; gap: 8px; }
.bim-floor-list { display: flex; flex-direction: column; gap: 3px; max-height: 130px; overflow-y: auto; }
.bim-floor-item {
  display: flex; align-items: center; padding: 5px 9px; border-radius: 6px;
  background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
  transition: border-color 0.15s, transform 0.15s;
  cursor: default;
}
.bim-floor-item:hover { border-color: rgba(94,164,255,0.2); transform: translateX(2px); }
.floor-badge { font-size: 13px; font-weight: 700; font-family: 'JetBrains Mono',monospace; }

.bim-diagram {
  display: flex; justify-content: center; padding: 8px 0;
  background: rgba(0,0,0,0.25); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);
}
.bim-svg { width: 110px; height: auto; }

.bim-legend { display: flex; flex-wrap: wrap; gap: 6px 12px; padding: 4px 2px; }
.legend-item { display: flex; align-items: center; gap: 5px; }
.legend-dot { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
.legend-label { font-size: 10px; color: rgba(255,255,255,0.5); }

.entrance-card {
  border: 1px solid rgba(94,164,255,0.15);
  border-radius: 10px; background: rgba(59,130,246,0.03);
  padding: 12px;
  transition: border-color 0.2s;
}
.entrance-card:hover { border-color: rgba(94,164,255,0.25); }
.entrance-head {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  margin-bottom: 10px;
}
.entrance-name { font-size: 14px; font-weight: 700; color: rgba(255,255,255,0.92); }

.entrance-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; }
.eg-cell {
  display: flex; flex-direction: column; gap: 2px; padding: 5px 7px; border-radius: 5px;
  background: rgba(255,255,255,0.02); transition: background 0.15s;
}
.eg-cell:hover { background: rgba(255,255,255,0.04); }
.eg-k { font-size: 10px; color: rgba(255,255,255,0.35); font-weight: 500; }
.eg-v { font-size: 12px; color: rgba(255,255,255,0.85); font-weight: 600; }

.entrance-suspicious {
  display: flex; gap: 6px; margin-top: 10px; padding: 7px 9px; border-radius: 6px;
  background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.12);
  border-left: 2px solid #ef4444;
}
.es-label { font-size: 10px; color: rgba(239,68,68,0.85); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
.es-value { font-size: 12px; color: rgba(255,255,255,0.6); line-height: 1.5; }

.panel-body::-webkit-scrollbar { width: 4px; }
.panel-body::-webkit-scrollbar-thumb { border-radius: 999px; background: rgba(255,255,255,0.08); }
</style>
