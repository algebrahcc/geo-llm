<script setup lang="ts">
import { h } from 'vue';
import { NButton, NDataTable } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import type { PlanningRouteSegment } from './types';

defineOptions({
  name: 'PlanningRouteDetailTable'
});

interface Props {
  segments: readonly PlanningRouteSegment[];
  totalDistance: number;
  totalDuration: string;
  planLabel: string;
}

defineProps<Props>();

const columns: DataTableColumns<PlanningRouteSegment> = [
  {
    title: '路段',
    key: 'section',
    ellipsis: { tooltip: true },
    render(row) {
      return h('span', { style: { color: 'rgba(255,255,255,0.88)', fontSize: '12px' } }, row.section);
    }
  },
  {
    title: '道路名称',
    key: 'roadName',
    width: 100,
    render(row) {
      return h('span', { style: { color: 'rgba(255,255,255,0.72)', fontSize: '12px' } }, row.roadName);
    }
  },
  {
    title: '里程(km)',
    key: 'distance',
    width: 80,
    align: 'right',
    render(row) {
      return h('span', { style: { color: 'rgba(255,255,255,0.88)', fontSize: '12px' } }, String(row.distance));
    }
  },
  {
    title: '预计用时',
    key: 'duration',
    width: 80,
    align: 'right',
    render(row) {
      return h('span', { style: { color: 'rgba(255,255,255,0.88)', fontSize: '12px' } }, row.duration);
    }
  },
  {
    title: '路况',
    key: 'roadCondition',
    width: 70,
    align: 'center',
    render(row) {
      const color = row.roadCondition === '畅通' ? '#2ee59d' : '#f7c766';
      return h(
        'span',
        { style: { color, fontSize: '12px', fontWeight: '500' } },
        row.roadCondition
      );
    }
  },
  {
    title: '操作',
    key: 'action',
    width: 60,
    align: 'center',
    render() {
      return h(
        NButton,
        {
          size: 'small',
          quaternary: true,
          type: 'info',
          style: 'font-size: 12px'
        },
        { default: () => '详情' }
      );
    }
  }
];

function getRowClass(_row: PlanningRouteSegment, index: number) {
  return index % 2 === 0 ? 'row-even' : 'row-odd';
}
</script>

<template>
  <div class="route-detail-table">
    <div class="table-header">
      <SvgIcon icon="mdi:map-marker-path" class="table-icon" />
      <span class="table-title">{{ planLabel }} 详细路线</span>
    </div>
    <div class="table-wrap">
      <NDataTable
        :columns="columns"
        :data="[...segments]"
        :bordered="false"
        :single-line="false"
        size="small"
        :row-class-name="getRowClass"
        class="detail-datatable"
      />
      <!-- 合计行 -->
      <div class="table-footer">
        <div class="footer-cell footer-cell--label">合计</div>
        <div class="footer-cell"></div>
        <div class="footer-cell footer-cell--value">{{ totalDistance.toLocaleString() }} km</div>
        <div class="footer-cell footer-cell--value">{{ totalDuration }}</div>
        <div class="footer-cell"></div>
        <div class="footer-cell"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.route-detail-table {
  border: 1px solid rgba(41, 163, 255, 0.12);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(6, 29, 56, 0.7);
}

.table-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(41, 163, 255, 0.1);
}

.table-icon {
  font-size: 16px;
  color: #29b6ff;
}

.table-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.88);
}

.table-wrap {
  overflow-x: auto;
}

.detail-datatable :deep(.n-data-table) {
  --n-th-color: rgba(6, 29, 56, 0.6);
  --n-td-color: transparent;
  --n-border-color: rgba(41, 163, 255, 0.08);
  --n-th-text-color: rgba(255, 255, 255, 0.56);
  --n-font-size: 12px;
}

.detail-datatable :deep(.n-data-table-th) {
  background: rgba(41, 163, 255, 0.06) !important;
  border-bottom: 1px solid rgba(41, 163, 255, 0.1) !important;
}

.detail-datatable :deep(.n-data-table-td) {
  border-bottom: 1px solid rgba(41, 163, 255, 0.05) !important;
  padding: 8px 12px !important;
}

.detail-datatable :deep(.row-even) {
  background: rgba(41, 163, 255, 0.02) !important;
}

.detail-datatable :deep(.row-odd) {
  background: transparent !important;
}

.table-footer {
  display: grid;
  grid-template-columns: 1fr 100px 80px 80px 70px 60px;
  padding: 10px 12px;
  background: rgba(41, 163, 255, 0.08);
  border-top: 1px solid rgba(41, 163, 255, 0.15);
}

.footer-cell {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
}

.footer-cell--label {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.88);
}

.footer-cell--value {
  text-align: right;
  font-weight: 500;
  color: #29b6ff;
}
</style>
