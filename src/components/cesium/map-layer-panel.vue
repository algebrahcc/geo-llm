<script lang="ts">
/**
 * 矢量图层（桥接后端 VectorItem + 前端显隐状态）
 *
 * 通用地图图层面板使用的图层条目类型，供 river/planning/globe/building 等地图页复用。
 */
export interface VectorLayerItem {
  key: string; // 'vector-{id}'
  id: string; // 后端矢量图层 ID
  label: string; // vectorName
  sourceType: string; // GeoJSON / Shapefile
  featureCount: number;
  visible: boolean;
}
</script>

<script setup lang="ts">
import type { ServiceLayerHandle } from '@/composables/cesium/service-loader';

defineOptions({
  name: 'MapLayerPanel'
});

const props = defineProps<{
  collapsed: boolean;
  vectorLayers: VectorLayerItem[];
  vectorLoading: boolean;
  /** 数据服务激活图层句柄（阶段二，来自 useCesiumServices.handles） */
  serviceHandles?: ServiceLayerHandle[];
}>();

const emit = defineEmits<{
  (e: 'toggle-vector', id: string): void;
  (e: 'toggle-collapse'): void;
  (e: 'close'): void;
  (e: 'toggle-service', id: number, visible: boolean): void;
  (e: 'remove-service', id: number): void;
  (e: 'opacity-service', id: number, opacity: number): void;
  (e: 'reorder-service', fromIndex: number, toIndex: number): void;
}>();

const visibleCount = () => {
  let c = props.vectorLayers.filter(l => l.visible).length;
  c += (props.serviceHandles ?? []).filter(h => h.visible).length;
  return c;
};
const totalCount = () => props.vectorLayers.length + (props.serviceHandles?.length ?? 0);

/** 给每个矢量图层分配一个颜色（循环取色） */
const VECTOR_COLORS = ['#ff6600', '#5ea4ff', '#2ee59d', '#ffcf5c', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];
function vectorColor(index: number) {
  return VECTOR_COLORS[index % VECTOR_COLORS.length];
}
</script>

<template>
  <div class="layer-panel" :class="{ 'layer-panel--collapsed': collapsed }">
    <!-- 标题栏 -->
    <div class="panel-header">
      <span class="header-icon">
        <SvgIcon icon="mdi:layers-outline" />
      </span>
      <span class="header-title">图层</span>
      <span class="layer-count">{{ visibleCount() }}/{{ totalCount() }}</span>
      <div class="header-actions">
        <button type="button" class="action-btn" :title="collapsed ? '展开' : '折叠'" @click="emit('toggle-collapse')">
          <SvgIcon :icon="collapsed ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
        </button>
        <button type="button" class="action-btn" title="关闭" @click="emit('close')">
          <SvgIcon icon="mdi:close" />
        </button>
      </div>
    </div>

    <div v-show="!collapsed" class="panel-content">
      <!-- ====== Section 1：矢量图层 ====== -->
      <div class="layer-section-title">
        矢量图层
        <span v-if="vectorLoading" class="loading-dot">加载中…</span>
      </div>

      <div v-if="vectorLayers.length === 0 && !vectorLoading" class="layer-empty">
        暂无矢量图层，请先在
        <a href="/#/data-center/vector" target="_blank">矢量数据管理</a>
        上传数据
      </div>

      <div
        v-for="(layer, idx) in vectorLayers"
        :key="layer.id"
        class="layer-item"
        :class="{ 'layer-item--active': layer.visible }"
      >
        <button
          type="button"
          class="eye-btn"
          :class="{ 'eye-btn--off': !layer.visible }"
          :title="layer.visible ? '隐藏图层' : '显示图层'"
          @click="emit('toggle-vector', layer.id)"
        >
          <SvgIcon :icon="layer.visible ? 'mdi:eye' : 'mdi:eye-off'" />
        </button>
        <span class="layer-swatch" :style="{ background: vectorColor(idx) }" />
        <div class="layer-meta">
          <span class="layer-name" :class="{ 'layer-name--dim': !layer.visible }">{{ layer.label }}</span>
          <span class="layer-sub">{{ layer.sourceType }} · {{ layer.featureCount }} 要素</span>
        </div>
      </div>

      <!-- ====== Section 2：数据服务（通用 LayerPanel，设计文档 5.7，按分类分组折叠） ====== -->
      <div class="layer-section-title">数据服务</div>
      <LayerPanel
        :handles="serviceHandles ?? []"
        :show-header="false"
        grouped
        @toggle="(id: number, v: boolean) => emit('toggle-service', id, v)"
        @opacity="(id: number, o: number) => emit('opacity-service', id, o)"
        @remove="(id: number) => emit('remove-service', id)"
        @reorder="(from: number, to: number) => emit('reorder-service', from, to)"
      />
    </div>
  </div>
</template>

<style scoped>
.layer-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  flex-shrink: 0;
}

.header-icon {
  font-size: 20px;
  color: #62c4ff;
}

.header-title {
  flex: 1;
  font-size: 15px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
}

.layer-count {
  font-size: 11px;
  padding: 3px 9px;
  border-radius: 10px;
  background: rgba(141, 184, 255, 0.12);
  color: #8db8ff;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  font-size: 18px;
  transition:
    background 0.18s,
    color 0.18s;
}

.action-btn:hover {
  background: rgba(43, 107, 255, 0.16);
  color: rgba(255, 255, 255, 0.9);
}

.panel-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 12px 14px;
  scrollbar-width: thin;
  scrollbar-color: rgba(141, 184, 255, 0.24) transparent;
}

.panel-content::-webkit-scrollbar {
  width: 6px;
}
.panel-content::-webkit-scrollbar-track {
  background: transparent;
}
.panel-content::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(141, 184, 255, 0.24);
}

/* ──── Section 标题 ──── */
.layer-section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.34);
  padding: 14px 16px 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.layer-section-title:first-child {
  padding-top: 4px;
}
.loading-dot {
  font-size: 11px;
  color: rgba(141, 184, 255, 0.7);
  text-transform: none;
  letter-spacing: 0;
}
.layer-empty {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.32);
  padding: 12px 16px;
  line-height: 1.7;
}
.layer-empty a {
  color: #62c4ff;
  text-decoration: none;
}
.layer-empty a:hover {
  text-decoration: underline;
}

/* ──── 图层卡片（与服务图层统一视觉） ──── */
.layer-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: default;
  border: 1px solid transparent;
  transition:
    background 0.15s,
    border-color 0.15s;
}
.layer-item:hover {
  background: rgba(43, 107, 255, 0.07);
}
.layer-item--active {
  background: rgba(255, 255, 255, 0.025);
}

.eye-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #62c4ff;
  cursor: pointer;
  font-size: 19px;
  flex-shrink: 0;
  padding: 0;
  transition:
    background 0.15s,
    color 0.15s;
}
.eye-btn:hover {
  background: rgba(98, 196, 255, 0.12);
}
.eye-btn--off {
  color: rgba(255, 255, 255, 0.32);
}

.layer-swatch {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  flex-shrink: 0;
  margin-top: 4px;
  border: 1px solid rgba(255, 255, 255, 0.16);
}
.layer-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.layer-name {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.layer-name--dim {
  color: rgba(255, 255, 255, 0.45);
}
.layer-sub {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.42);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
