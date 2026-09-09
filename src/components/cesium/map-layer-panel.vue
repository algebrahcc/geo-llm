<script setup lang="ts">
import { ref } from 'vue';
import type { ServiceLayerHandle } from '@/composables/cesium/service-loader';
import type { VectorLayerItem } from '@/typings/cesium';

defineOptions({
  name: 'MapLayerPanel'
});

const props = defineProps<{
  collapsed: boolean;
  vectorLayers: VectorLayerItem[];
  vectorLoading: boolean;
  /** 地表透视（地下模式）开关状态 */
  surfaceTranslucent?: boolean;
  /** 数据服务激活图层句柄（阶段二，来自 useCesiumServices.handles） */
  serviceHandles?: ServiceLayerHandle[];
}>();

type Emits = import('@/typings/panel-emits').PanelEmits & {
  'toggle-vector': [id: string];
  'toggle-service': [id: number, visible: boolean];
  'remove-service': [id: number];
  'reorder-service': [fromIndex: number, toIndex: number];
  'fly-service': [id: number];
  'fly-vector': [id: string];
  'toggle-translucency': [enabled: boolean];
};

const emit = defineEmits<Emits>();

// 矢量图层分组折叠（与数据服务分组交互一致）
const vectorGroupCollapsed = ref(false);

function toggleVectorGroup() {
  vectorGroupCollapsed.value = !vectorGroupCollapsed.value;
}

const visibleCount = () => {
  let c = props.vectorLayers.filter(l => l.visible).length;
  c += (props.serviceHandles ?? []).filter(h => h.visible).length;
  return c;
};
const totalCount = () => props.vectorLayers.length + (props.serviceHandles?.length ?? 0);
</script>

<template>
  <div class="layer-panel" :class="{ 'layer-panel--collapsed': collapsed }">
    <!-- 标题栏 -->
    <div class="panel-header">
      <span class="header-icon">
        <SvgIcon icon="mdi:layers-outline" />
      </span>
      <span class="header-title">图层管理</span>
      <span class="layer-count">{{ visibleCount() }}/{{ totalCount() }}</span>
      <div class="header-actions">
        <button
          type="button"
          class="action-btn"
          :class="{ 'action-btn--active': surfaceTranslucent }"
          :title="surfaceTranslucent ? '关闭地表透视' : '地表透视（查看地下要素）'"
          @click="emit('toggle-translucency', !surfaceTranslucent)"
        >
          <SvgIcon icon="mdi:earth" />
        </button>
        <button type="button" class="action-btn" :title="collapsed ? '展开' : '折叠'" @click="emit('toggle-collapse')">
          <SvgIcon :icon="collapsed ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
        </button>
        <button type="button" class="action-btn" title="关闭" @click="emit('close')">
          <SvgIcon icon="mdi:close" />
        </button>
      </div>
    </div>

    <div v-show="!collapsed" class="panel-content">
      <!-- ====== Section 1：数据服务（通用 LayerPanel，设计文档 5.7，按分类分组折叠） ====== -->
      <div class="layer-section-title">数据服务</div>
      <LayerPanel
        :handles="serviceHandles ?? []"
        :show-header="false"
        grouped
        @toggle="(id: number, v: boolean) => emit('toggle-service', id, v)"
        @remove="(id: number) => emit('remove-service', id)"
        @reorder="(from: number, to: number) => emit('reorder-service', from, to)"
        @fly="(id: number) => emit('fly-service', id)"
      />

      <!-- ====== Section 2：矢量图层 ====== -->
      <div class="layer-section-title layer-section-title--toggle" @click="toggleVectorGroup">
        矢量图层
        <span class="group-count">{{ vectorLayers.length }}</span>
        <span v-if="vectorLoading" class="loading-dot">加载中…</span>
        <SvgIcon class="group-chevron" :icon="vectorGroupCollapsed ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
      </div>

      <div v-show="!vectorGroupCollapsed">
        <div v-if="vectorLayers.length === 0 && !vectorLoading" class="layer-empty">
          暂无矢量图层，请先在
          <a href="/#/data-center/vector" target="_blank">矢量数据管理</a>
          上传数据
        </div>

        <div
          v-for="layer in vectorLayers"
          :key="layer.id"
          class="layer-item"
          :class="{ 'layer-item--active': layer.visible }"
          :title="`${layer.label}（双击定位到数据范围）`"
          @dblclick="emit('fly-vector', layer.id)"
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
          <span class="layer-accent" />
          <div class="layer-meta">
            <span class="layer-name" :class="{ 'layer-name--dim': !layer.visible }">{{ layer.label }}</span>
            <span class="layer-sub">{{ layer.sourceType }} · {{ layer.featureCount }} 要素</span>
          </div>
        </div>
      </div>
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
  color: #8db0dd;
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
  background: rgba(74, 125, 189, 0.14);
  color: #8db0dd;
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
  background: rgba(93, 140, 200, 0.18);
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

.action-btn--active {
  color: #8db0dd;
  background: rgba(93, 140, 200, 0.18);
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
.layer-section-title--toggle {
  cursor: pointer;
  user-select: none;
}

.layer-section-title--toggle:hover {
  color: rgba(255, 255, 255, 0.6);
}

.group-count {
  font-size: 10px;
  padding: 0 6px;
  border-radius: 8px;
  background: rgba(74, 125, 189, 0.14);
  color: #8db0dd;
  font-weight: 600;
  line-height: 16px;
}

.group-chevron {
  margin-left: auto;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.35);
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
  color: #8db0dd;
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
  background: rgba(93, 140, 200, 0.08);
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
  color: #8db0dd;
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

.layer-accent {
  width: 3px;
  height: 22px;
  border-radius: 1px;
  flex-shrink: 0;
  margin-top: 2px;
  background: rgba(74, 125, 189, 0.65);
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
