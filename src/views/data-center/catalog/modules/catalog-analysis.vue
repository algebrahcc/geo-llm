<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { NCollapse, NCollapseItem, NModal } from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import type { CatalogItem } from '@/mock/catalog';
import { getGlobalImageryUrl, getOnlineImageryConfig, isOnlineImagery } from '@/utils/imagery';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import { defaults as defaultControls } from 'ol/control';
import { transformExtent, fromLonLat } from 'ol/proj';
import { createXYZ } from 'ol/tilegrid';
import 'ol/ol.css';

defineOptions({ name: 'CatalogAnalysis' });

const props = defineProps<{
  /** 待分析的数据目录项；为 null 时弹窗关闭 */
  item: CatalogItem | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

// ==================== 简化 GeoJSON 类型 ====================
interface SimpleGeometry {
  type: string;
  coordinates: unknown;
}
interface SimpleFeature {
  type: 'Feature';
  properties: Record<string, unknown> | null;
  geometry: SimpleGeometry;
}
interface SimpleFeatureCollection {
  type: 'FeatureCollection';
  features: SimpleFeature[];
}

// ==================== 状态 ====================
const selectedAnalysisType = ref('');
const isAnalysisLoading = ref(false);
const analysisMapContainer = ref<HTMLElement | null>(null);
const analysisMap = shallowRef<Map | null>(null);
const analysisVectorLayer = shallowRef<VectorLayer<VectorSource> | null>(null);

// ==================== 分析类型配置 ====================
interface AnalysisSubItem {
  key: string;
  label: string;
}
interface AnalysisCategory {
  key: string;
  label: string;
  icon: string;
  items: AnalysisSubItem[];
}

const analysisCategories: AnalysisCategory[] = [
  {
    key: 'feature-extraction',
    label: '要素提取',
    icon: 'mdi:vector-polygon',
    items: [
      { key: 'road', label: '道路提取' },
      { key: 'building', label: '建筑提取' },
      { key: 'water', label: '水体提取' },
      { key: 'vegetation', label: '植被提取' }
    ]
  },
  {
    key: 'target-detection',
    label: '目标检测',
    icon: 'mdi:target',
    items: [
      { key: 'vehicle', label: '车辆检测' },
      { key: 'ship', label: '船舶检测' },
      { key: 'aircraft', label: '飞机检测' }
    ]
  },
  {
    key: 'obstacle-recognition',
    label: '障碍物识别',
    icon: 'mdi:road-variant',
    items: [
      { key: 'road-damage', label: '道路损毁物' },
      { key: 'barrier', label: '路障/拒马' },
      { key: 'fortification', label: '防御工事' }
    ]
  }
];

function getSubItemIcon(key: string): string {
  const iconMap: Record<string, string> = {
    road: 'mdi:road-variant',
    building: 'mdi:office-building',
    water: 'mdi:water',
    vegetation: 'mdi:pine-tree',
    vehicle: 'mdi:car',
    ship: 'mdi:ferry',
    aircraft: 'mdi:airplane',
    'road-damage': 'mdi:road-variant',
    barrier: 'mdi:alert-octagon',
    fortification: 'mdi:shield-outline'
  };
  return iconMap[key] ?? 'mdi:map-marker';
}

// ==================== Mock Vector Data (GeoJSON Features) ====================
function getMockGeoJSON(type: string): SimpleFeatureCollection {
  const bbox = props.item?.bbox ?? [116.0, 30.0, 117.0, 31.0];
  const [minX, minY, maxX, maxY] = bbox;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const dx = (maxX - minX) * 0.15;
  const dy = (maxY - minY) * 0.15;

  const mockData: Record<string, SimpleFeatureCollection> = {
    road: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: '主干道A', type: 'road' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [cx - dx * 2, cy - dy * 0.3],
              [cx - dx, cy + dy * 0.1],
              [cx, cy - dy * 0.05],
              [cx + dx * 0.8, cy + dy * 0.2],
              [cx + dx * 1.5, cy - dy * 0.1]
            ]
          }
        },
        {
          type: 'Feature',
          properties: { name: '支路B', type: 'road' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [cx - dx * 0.5, cy - dy * 1.2],
              [cx - dx * 0.2, cy - dy * 0.3],
              [cx + dy * 0.3, cy + dy * 0.5],
              [cx + dx * 0.6, cy + dy * 1.0]
            ]
          }
        },
        {
          type: 'Feature',
          properties: { name: '环城路C', type: 'road' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [cx - dx * 1.3, cy],
              [cx - dx * 1.0, cy + dy * 0.8],
              [cx, cy + dy * 1.1],
              [cx + dx * 1.0, cy + dy * 0.6],
              [cx + dx * 1.3, cy - dy * 0.2]
            ]
          }
        }
      ]
    },
    building: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: '建筑群1', type: 'building' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [cx - dx * 0.6, cy - dy * 0.5],
                [cx - dx * 0.2, cy - dy * 0.5],
                [cx - dx * 0.2, cy - dy * 0.1],
                [cx - dx * 0.6, cy - dy * 0.1],
                [cx - dx * 0.6, cy - dy * 0.5]
              ]
            ]
          }
        },
        {
          type: 'Feature',
          properties: { name: '建筑群2', type: 'building' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [cx + dx * 0.3, cy + dy * 0.2],
                [cx + dx * 0.7, cy + dy * 0.2],
                [cx + dx * 0.7, cy + dy * 0.7],
                [cx + dx * 0.3, cy + dy * 0.7],
                [cx + dx * 0.3, cy + dy * 0.2]
              ]
            ]
          }
        },
        {
          type: 'Feature',
          properties: { name: '独立建筑3', type: 'building' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [cx - dx * 0.1, cy + dy * 0.4],
                [cx + dx * 0.15, cy + dy * 0.4],
                [cx + dx * 0.15, cy + dy * 0.75],
                [cx - dx * 0.1, cy + dy * 0.75],
                [cx - dx * 0.1, cy + dy * 0.4]
              ]
            ]
          }
        },
        {
          type: 'Feature',
          properties: { name: '大型建筑4', type: 'building' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [cx - dx * 1.0, cy + dy * 0.5],
                [cx - dx * 0.5, cy + dy * 0.5],
                [cx - dx * 0.5, cy + dy * 1.0],
                [cx - dx * 1.0, cy + dy * 1.0],
                [cx - dx * 1.0, cy + dy * 0.5]
              ]
            ]
          }
        }
      ]
    },
    water: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: '湖泊', type: 'water' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [cx + dx * 0.5, cy - dy * 0.8],
                [cx + dx * 1.2, cy - dy * 0.6],
                [cx + dx * 1.3, cy - dy * 0.1],
                [cx + dx * 0.9, cy + dy * 0.1],
                [cx + dx * 0.4, cy - dy * 0.1],
                [cx + dx * 0.3, cy - dy * 0.5],
                [cx + dx * 0.5, cy - dy * 0.8]
              ]
            ]
          }
        },
        {
          type: 'Feature',
          properties: { name: '河流', type: 'water' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [cx - dx * 1.5, cy + dy * 0.3],
              [cx - dx * 0.8, cy + dy * 0.5],
              [cx - dx * 0.2, cy + dy * 0.15],
              [cx + dx * 0.3, cy + dy * 0.4],
              [cx + dx * 1.0, cy + dy * 0.2],
              [cx + dx * 1.8, cy + dy * 0.5]
            ]
          }
        }
      ]
    },
    vegetation: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: '林区A', type: 'vegetation' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [cx - dx * 1.2, cy - dy * 1.0],
                [cx - dx * 0.4, cy - dy * 1.0],
                [cx - dx * 0.3, cy - dy * 0.5],
                [cx - dx * 0.8, cy - dy * 0.4],
                [cx - dx * 1.2, cy - dy * 0.6],
                [cx - dx * 1.2, cy - dy * 1.0]
              ]
            ]
          }
        },
        {
          type: 'Feature',
          properties: { name: '农田B', type: 'vegetation' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [cx + dx * 0.1, cy - dy * 1.1],
                [cx + dx * 0.8, cy - dy * 1.2],
                [cx + dx * 1.0, cy - dy * 0.6],
                [cx + dx * 0.3, cy - dy * 0.5],
                [cx + dx * 0.1, cy - dy * 1.1]
              ]
            ]
          }
        }
      ]
    },
    vehicle: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: '车辆-1', type: 'vehicle' },
          geometry: { type: 'Point', coordinates: [cx - dx * 0.3, cy - dy * 0.2] }
        },
        {
          type: 'Feature',
          properties: { name: '车辆-2', type: 'vehicle' },
          geometry: { type: 'Point', coordinates: [cx + dx * 0.1, cy + dy * 0.15] }
        },
        {
          type: 'Feature',
          properties: { name: '车辆-3', type: 'vehicle' },
          geometry: { type: 'Point', coordinates: [cx + dx * 0.5, cy - dy * 0.1] }
        },
        {
          type: 'Feature',
          properties: { name: '车辆-4', type: 'vehicle' },
          geometry: { type: 'Point', coordinates: [cx - dx * 0.7, cy + dy * 0.3] }
        },
        {
          type: 'Feature',
          properties: { name: '车辆-5', type: 'vehicle' },
          geometry: { type: 'Point', coordinates: [cx + dx * 0.8, cy + dy * 0.5] }
        }
      ]
    },
    ship: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: '船舶-1', type: 'ship' },
          geometry: { type: 'Point', coordinates: [cx + dx * 0.8, cy - dy * 0.4] }
        },
        {
          type: 'Feature',
          properties: { name: '船舶-2', type: 'ship' },
          geometry: { type: 'Point', coordinates: [cx + dx * 1.0, cy - dy * 0.1] }
        },
        {
          type: 'Feature',
          properties: { name: '船舶-3', type: 'ship' },
          geometry: { type: 'Point', coordinates: [cx + dx * 0.6, cy + dy * 0.35] }
        }
      ]
    },
    aircraft: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: '飞机-1', type: 'aircraft' },
          geometry: { type: 'Point', coordinates: [cx - dx * 0.9, cy + dy * 0.8] }
        },
        {
          type: 'Feature',
          properties: { name: '飞机-2', type: 'aircraft' },
          geometry: { type: 'Point', coordinates: [cx + dx * 0.4, cy + dy * 0.9] }
        }
      ]
    },
    'road-damage': {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: '路面损毁1', type: 'road-damage' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [cx - dx * 0.4, cy - dy * 0.3],
                [cx - dx * 0.1, cy - dy * 0.3],
                [cx - dx * 0.1, cy - dy * 0.15],
                [cx - dx * 0.4, cy - dy * 0.15],
                [cx - dx * 0.4, cy - dy * 0.3]
              ]
            ]
          }
        },
        {
          type: 'Feature',
          properties: { name: '桥梁断裂2', type: 'road-damage' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [cx + dx * 0.2, cy + dy * 0.1],
                [cx + dx * 0.45, cy + dy * 0.1],
                [cx + dx * 0.45, cy + dy * 0.25],
                [cx + dx * 0.2, cy + dy * 0.25],
                [cx + dx * 0.2, cy + dy * 0.1]
              ]
            ]
          }
        }
      ]
    },
    barrier: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: '路障-1', type: 'barrier' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [cx - dx * 0.5, cy + dy * 0.3],
              [cx - dx * 0.1, cy + dy * 0.5],
              [cx + dx * 0.2, cy + dy * 0.35]
            ]
          }
        },
        {
          type: 'Feature',
          properties: { name: '拒马-2', type: 'barrier' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [cx + dx * 0.5, cy - dy * 0.4],
              [cx + dx * 0.8, cy - dy * 0.2],
              [cx + dx * 1.0, cy - dy * 0.35]
            ]
          }
        }
      ]
    },
    fortification: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: '碉堡', type: 'fortification' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [cx - dx * 0.8, cy - dy * 0.7],
                [cx - dx * 0.5, cy - dy * 0.7],
                [cx - dx * 0.5, cy - dy * 0.45],
                [cx - dx * 0.8, cy - dy * 0.45],
                [cx - dx * 0.8, cy - dy * 0.7]
              ]
            ]
          }
        },
        {
          type: 'Feature',
          properties: { name: '战壕', type: 'fortification' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [cx - dx * 1.0, cy + dy * 0.6],
              [cx - dx * 0.5, cy + dy * 0.7],
              [cx, cy + dy * 0.6],
              [cx + dx * 0.5, cy + dy * 0.8]
            ]
          }
        }
      ]
    }
  };

  return (
    mockData[type] ?? {
      type: 'FeatureCollection',
      features: []
    }
  );
}

// ==================== Vector Style by type ====================
function getVectorStyle(featureType: string): Style {
  const styles: Record<string, Style> = {
    road: new Style({
      stroke: new Stroke({ color: '#ffeb3b', width: 3 })
    }),
    building: new Style({
      stroke: new Stroke({ color: '#ff9800', width: 2 }),
      fill: new Fill({ color: 'rgba(255, 152, 0, 0.25)' })
    }),
    water: new Style({
      stroke: new Stroke({ color: '#29b6f6', width: 2 }),
      fill: new Fill({ color: 'rgba(41, 182, 246, 0.25)' })
    }),
    vegetation: new Style({
      stroke: new Stroke({ color: '#66bb6a', width: 2 }),
      fill: new Fill({ color: 'rgba(102, 187, 106, 0.25)' })
    }),
    vehicle: new Style({
      image: new CircleStyle({
        radius: 7,
        fill: new Fill({ color: '#f44336' }),
        stroke: new Stroke({ color: '#fff', width: 2 })
      })
    }),
    ship: new Style({
      image: new CircleStyle({
        radius: 7,
        fill: new Fill({ color: '#2196f3' }),
        stroke: new Stroke({ color: '#fff', width: 2 })
      })
    }),
    aircraft: new Style({
      image: new CircleStyle({
        radius: 8,
        fill: new Fill({ color: '#e91e63' }),
        stroke: new Stroke({ color: '#fff', width: 2 })
      })
    }),
    'road-damage': new Style({
      stroke: new Stroke({ color: '#ff1744', width: 2, lineDash: [8, 4] }),
      fill: new Fill({ color: 'rgba(255, 23, 68, 0.3)' })
    }),
    barrier: new Style({
      stroke: new Stroke({ color: '#ff6d00', width: 3, lineDash: [6, 3] })
    }),
    fortification: new Style({
      stroke: new Stroke({ color: '#d500f9', width: 2 }),
      fill: new Fill({ color: 'rgba(213, 0, 249, 0.2)' })
    })
  };
  return styles[featureType] ?? new Style({});
}

function vectorStyleFunction(feature: import('ol/Feature').default): Style {
  const ft = feature.get('type') ?? '';
  return getVectorStyle(ft);
}

// ==================== OL Map Lifecycle ====================
function createTileLayer(): TileLayer {
  if (isOnlineImagery()) {
    const onlineConfig = getOnlineImageryConfig();
    const maxLevel = onlineConfig.maximumLevel ?? 18;

    return new TileLayer({
      source: new XYZ({
        tileGrid: createXYZ({
          maxZoom: maxLevel,
          tileSize: 256
        }),
        tileUrlFunction(tileCoord) {
          const [z, x, y] = tileCoord;
          const reverseY = (1 << z!) - y! - 1;
          const url = onlineConfig.url
            .replace('{z}', String(z))
            .replace('{x}', String(x))
            .replace('{reverseY}', String(reverseY))
            .replace('{-y}', String(reverseY));
          return url;
        },
        crossOrigin: 'anonymous'
      })
    });
  }
  const url = getGlobalImageryUrl();
  return new TileLayer({
    source: new XYZ({ url, crossOrigin: 'anonymous' })
  });
}

function initAnalysisMap() {
  if (!analysisMapContainer.value) return;

  const tileLayer = createTileLayer();
  const vectorSource = new VectorSource();
  // OL StyleLike 类型对单参数 style 函数推断不友好（同原父组件 as any 历史），显式断言到 StyleFunction
  const vLayer = new VectorLayer({
    source: vectorSource,

    style: vectorStyleFunction as any
  });
  analysisVectorLayer.value = vLayer;

  const bbox = props.item?.bbox ?? [116.0, 30.0, 117.0, 31.0];
  const extent = transformExtent(bbox, 'EPSG:4326', 'EPSG:3857');

  const map = new Map({
    target: analysisMapContainer.value,
    controls: defaultControls({ attribution: false, rotate: false }),
    layers: [tileLayer, vLayer],
    view: new View({
      projection: 'EPSG:3857',
      extent,
      center: fromLonLat([(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]),
      zoom: 10,
      minZoom: 1,
      maxZoom: 18
    })
  });
  analysisMap.value = map;

  map.getView().fit(extent, { padding: [40, 40, 40, 40], maxZoom: 16 });
}

function destroyAnalysisMap() {
  if (analysisMap.value) {
    analysisMap.value.setTarget(undefined);
    analysisMap.value = null;
  }
  analysisVectorLayer.value = null;
  selectedAnalysisType.value = '';
}

// ==================== 交互 ====================
function handleAnalysisTypeSelect(typeKey: string) {
  selectedAnalysisType.value = typeKey;
  isAnalysisLoading.value = true;
  const vLayer = analysisVectorLayer.value;
  if (!vLayer) {
    isAnalysisLoading.value = false;
    return;
  }

  const source = vLayer.getSource();
  if (!source) {
    isAnalysisLoading.value = false;
    return;
  }
  source.clear();

  // 模拟分析延迟，增强交互体感
  setTimeout(() => {
    const geojsonData = getMockGeoJSON(typeKey);
    const format = new GeoJSON();
    const features = format.readFeatures(geojsonData, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857'
    });
    source.addFeatures(features);
    isAnalysisLoading.value = false;

    if (features.length > 0 && analysisMap.value) {
      const extent = source.getExtent();
      if (extent) {
        analysisMap.value.getView().fit(extent, { padding: [60, 60, 60, 60], maxZoom: 16, duration: 600 });
      }
    }
  }, 300);
}

function handleClose() {
  emit('close');
}

// 打开时初始化地图，关闭/切换目录时销毁并重置
watch(
  () => props.item,
  val => {
    if (val) {
      selectedAnalysisType.value = '';
      nextTick(() => initAnalysisMap());
    } else {
      destroyAnalysisMap();
    }
  }
);

onBeforeUnmount(() => {
  destroyAnalysisMap();
});
</script>

<template>
  <!-- 数据分析弹窗（本期为 mock 演示） -->
  <NModal :show="Boolean(item)" :mask-closable="true" :close-on-esc="true" transform-origin="center">
    <div v-if="item" class="analysis-card">
      <!-- 标题区 -->
      <div class="analysis-header">
        <div class="analysis-header__left">
          <SvgIcon icon="mdi:target" class="analysis-header__icon" />
          <h3 class="analysis-header__title">{{ item.name }}</h3>
          <span class="analysis-header__badge">{{ item.type }}</span>
          <span class="analysis-header__separator">·</span>
          <SvgIcon icon="mdi:image-area" class="analysis-header__meta-icon" />
          <span class="analysis-header__range">{{ item.range }}</span>
        </div>
        <button class="analysis-header__close" @click="handleClose">
          <SvgIcon icon="mdi:close" class="analysis-header__close-icon" />
        </button>
      </div>

      <!-- 主体区域 -->
      <div class="analysis-body">
        <!-- 左侧面板 -->
        <div class="analysis-sidebar">
          <div class="analysis-sidebar__title">
            <SvgIcon icon="mdi:format-list-bulleted" class="analysis-sidebar__title-icon" />
            分析类型
          </div>
          <NCollapse
            :default-expanded-names="['feature-extraction', 'target-detection', 'obstacle-recognition']"
            class="analysis-collapse"
          >
            <NCollapseItem
              v-for="category in analysisCategories"
              :key="category.key"
              :title="category.label"
              :name="category.key"
            >
              <template #header-extra>
                <SvgIcon :icon="category.icon" class="analysis-category-icon" />
              </template>
              <div class="analysis-sub-list">
                <div
                  v-for="subItem in category.items"
                  :key="subItem.key"
                  class="analysis-sub-item"
                  :class="{
                    'analysis-sub-item--active': selectedAnalysisType === subItem.key,
                    'analysis-sub-item--loading': isAnalysisLoading && selectedAnalysisType === subItem.key
                  }"
                  @click="handleAnalysisTypeSelect(subItem.key)"
                >
                  <span class="analysis-sub-item__icon">
                    <SvgIcon :icon="getSubItemIcon(subItem.key)" />
                  </span>
                  <span class="analysis-sub-item__label">{{ subItem.label }}</span>
                  <SvgIcon
                    v-if="isAnalysisLoading && selectedAnalysisType === subItem.key"
                    icon="mdi:loading"
                    class="analysis-sub-item__spinner"
                  />
                </div>
              </div>
            </NCollapseItem>
          </NCollapse>
        </div>

        <!-- 中间地图区域 -->
        <div class="analysis-map-area" :class="{ 'analysis-map-area--active': selectedAnalysisType }">
          <div ref="analysisMapContainer" class="analysis-map-container"></div>
        </div>
      </div>
    </div>
  </NModal>
</template>

<style scoped lang="scss">
/* 弹窗经 NModal teleport 到 body，此处为 CSS 变量提供兜底值 */
/* ====== Analysis Modal ====== */

/* Card container with subtle border glow */
.analysis-card {
  width: 1200px;
  max-width: 95vw;
  height: 88vh;
  background: linear-gradient(180deg, rgba(4, 20, 44, 0.99) 0%, rgba(2, 14, 30, 0.99) 100%);
  border: 1px solid var(--catalog-surface-border, rgba(43, 131, 255, 0.28));
  border-top: 2px solid rgba(41, 163, 255, 0.3);
  border-radius: 10px;
  box-shadow:
    0 0 0 1px rgba(32, 111, 202, 0.12),
    0 4px 32px rgba(0, 10, 28, 0.6),
    0 0 80px rgba(41, 163, 255, 0.04);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ── Header ── */
.analysis-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid var(--catalog-line, rgba(25, 95, 176, 0.35));
  background: linear-gradient(90deg, rgba(0, 60, 140, 0.18) 0%, rgba(0, 20, 60, 0.06) 60%, rgba(0, 0, 0, 0) 100%);
  flex-shrink: 0;

  &__left {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  &__icon {
    font-size: 24px;
    color: var(--catalog-accent, #29a3ff);
    filter: drop-shadow(0 0 6px rgba(41, 163, 255, 0.4));
  }

  &__title {
    font-size: 17px;
    font-weight: 700;
    color: var(--catalog-text-primary, #eaf5ff);
    margin: 0;
    letter-spacing: 0.3px;
    line-height: 1.2;
  }

  &__badge {
    padding: 1px 8px;
    border-radius: 3px;
    background: rgba(41, 163, 255, 0.12);
    border: 1px solid rgba(41, 163, 255, 0.2);
    color: var(--catalog-accent, #29a3ff);
    font-size: 11px;
    font-weight: 500;
  }

  &__separator {
    color: rgba(147, 196, 255, 0.25);
    font-weight: 700;
  }

  &__meta-icon {
    font-size: 13px;
    opacity: 0.6;
  }

  &__range {
    font-size: 12px;
    color: var(--catalog-text-tertiary, rgba(147, 196, 255, 0.62));
    opacity: 0.8;
  }

  &__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: 1px solid rgba(100, 160, 255, 0.1);
    border-radius: 8px;
    background: rgba(2, 18, 36, 0.4);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      background: rgba(255, 107, 107, 0.12);
      border-color: rgba(255, 107, 107, 0.3);
      transform: scale(1.05);
    }
  }

  &__close-icon {
    font-size: 20px;
    color: var(--catalog-text-secondary, rgba(203, 227, 255, 0.72));
  }
}

/* ── Body ── */
.analysis-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ── Sidebar ── */
.analysis-sidebar {
  width: 280px;
  min-width: 280px;
  border-right: 1px solid var(--catalog-line, rgba(25, 95, 176, 0.35));
  overflow-y: auto;
  background: linear-gradient(180deg, rgba(2, 10, 24, 0.7) 0%, rgba(2, 14, 28, 0.5) 100%);

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(41, 163, 255, 0.2);
    border-radius: 2px;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 18px 12px;
    font-size: 12px;
    font-weight: 700;
    color: var(--catalog-text-tertiary, rgba(147, 196, 255, 0.62));
    text-transform: uppercase;
    letter-spacing: 1.2px;
    border-bottom: 1px solid rgba(25, 95, 176, 0.15);
  }

  &__title-icon {
    font-size: 15px;
    color: var(--catalog-accent, #29a3ff);
    opacity: 0.6;
  }
}

/* ── Collapse ── */
.analysis-collapse {
  :deep(.n-collapse-item) {
    margin: 0 !important;
    border-bottom: 1px solid rgba(25, 95, 176, 0.1);
  }

  :deep(.n-collapse-item__header) {
    padding: 10px 18px !important;
    transition: background 0.2s ease;

    &:hover {
      background: rgba(41, 163, 255, 0.04);
    }
  }

  :deep(.n-collapse-item__header-main) {
    font-size: 13px;
    font-weight: 700;
    color: var(--catalog-text-primary, #eaf5ff);
    letter-spacing: 0.3px;
  }

  :deep(.n-collapse-item__content-wrapper) {
    padding: 0 !important;
    border-top: 1px solid rgba(25, 95, 176, 0.08);
  }

  :deep(.n-collapse-item__content-inner) {
    padding: 6px 0 !important;
    background: rgba(0, 0, 0, 0.12);
  }

  :deep(.n-collapse-item-arrow) {
    color: var(--catalog-accent, #29a3ff);
    font-size: 14px;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
}

.analysis-category-icon {
  font-size: 17px;
  color: var(--catalog-accent, #29a3ff);
  opacity: 0.55;
}

/* ── Sub Items ── */
.analysis-sub-list {
  padding: 4px 10px;
}

.analysis-sub-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  margin-bottom: 2px;
  border: 1px solid transparent;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, rgba(41, 163, 255, 0.08), transparent);
    opacity: 0;
    transition: opacity 0.25s ease;
  }

  &__icon {
    font-size: 15px;
    color: var(--catalog-text-tertiary, rgba(147, 196, 255, 0.62));
    flex-shrink: 0;
    transition: all 0.25s ease;
  }

  &__label {
    font-size: 13px;
    color: var(--catalog-text-secondary, rgba(203, 227, 255, 0.72));
    transition: color 0.2s ease;
    flex: 1;
  }

  &__spinner {
    font-size: 14px;
    color: var(--catalog-accent, #29a3ff);
    animation: spin 0.8s linear infinite;
  }

  &:hover {
    background: rgba(41, 163, 255, 0.06);

    &::before {
      opacity: 1;
    }

    .analysis-sub-item__icon {
      color: var(--catalog-accent, #29a3ff);
      transform: translateX(2px);
    }

    .analysis-sub-item__label {
      color: var(--catalog-text-primary, #eaf5ff);
    }
  }

  &--active {
    background: rgba(41, 163, 255, 0.1);
    border-color: rgba(41, 163, 255, 0.2);
    box-shadow: inset 0 0 0 1px rgba(41, 163, 255, 0.08);

    .analysis-sub-item__icon {
      color: var(--catalog-accent, #29a3ff);
    }

    .analysis-sub-item__label {
      color: var(--catalog-accent, #29a3ff);
      font-weight: 600;
    }

    &::before {
      opacity: 1;
    }
  }

  &--loading {
    pointer-events: none;
    opacity: 0.7;
  }
}

/* ── Map Area ── */
.analysis-map-area {
  flex: 1;
  position: relative;
  overflow: hidden;
  cursor: crosshair;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border: 1px solid rgba(41, 163, 255, 0);
    border-radius: 0;
    pointer-events: none;
    transition: border-color 0.6s ease;
    z-index: 2;
  }

  &--active::after {
    border-color: rgba(41, 163, 255, 0.15);
  }
}

.analysis-map-container {
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;

  :deep(.ol-control button) {
    background: rgba(4, 20, 44, 0.92);
    color: var(--catalog-text-primary, #eaf5ff);
    border: 1px solid rgba(43, 131, 255, 0.2);
    border-radius: 6px;
    font-size: 17px;
    width: 30px;
    height: 30px;
    backdrop-filter: blur(6px);
    transition: all 0.2s ease;

    &:hover {
      background: rgba(41, 163, 255, 0.2);
      border-color: rgba(41, 163, 255, 0.4);
    }
  }

  :deep(.ol-zoom) {
    top: 14px;
    right: 14px;
    left: auto;
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
  }

  :deep(.ol-zoom button:first-child) {
    border-bottom: 1px solid rgba(43, 131, 255, 0.15);
  }

  :deep(.ol-viewport) {
    background: #010c1a;
  }
}

/* ── Keyframes ── */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
