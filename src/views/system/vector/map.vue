<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NButton, NTag, useMessage } from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { fetchVectorDetail, fetchVectorExtent, getVectorTileUrl } from '@/service/api/vector';
import { getBasemapUrl, getBasemapMaxZoom } from '@/utils/basemap';

import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import VectorTileLayer from 'ol/layer/VectorTile';
import VectorTileSource from 'ol/source/VectorTile';
import MVT from 'ol/format/MVT';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import { defaults as defaultControls } from 'ol/control';
import { createXYZ } from 'ol/tilegrid';
import { fromLonLat, transformExtent } from 'ol/proj';
import 'ol/ol.css';

defineOptions({ name: 'VectorMapView' });

const route = useRoute();
const router = useRouter();
const message = useMessage();

// ==================== 状态 ====================
const mapContainer = ref<HTMLDivElement>();
const mapLoaded = ref(false);
const mapError = ref('');
const layerName = ref('');
const sourceType = ref('');
const featureCount = ref(0);

let olMap: Map | null = null;

// ==================== 样式函数 ====================
function vectorStyle() {
  return new Style({
    fill: new Fill({ color: 'rgba(255, 102, 0, 0.25)' }),
    stroke: new Stroke({ color: '#ff6600', width: 2 }),
    image: new CircleStyle({
      radius: 5,
      fill: new Fill({ color: '#ff6600' }),
      stroke: new Stroke({ color: '#fff', width: 1.5 })
    })
  });
}

// ==================== 初始化地图 ====================
async function initMap() {
  const vectorId = (route.query.vectorId as string) || (route.query.id as string);
  if (!vectorId) {
    mapError.value = '缺少矢量图层 ID 参数';
    return;
  }

  // 获取图层元数据
  try {
    const { data } = await fetchVectorDetail(vectorId);
    if (data) {
      layerName.value = data.vectorName;
      sourceType.value = data.sourceType;
      featureCount.value = Number(data.featureCount) || 0;
    }
  } catch {
    // ignore
  }

  const tileUrl = getVectorTileUrl(vectorId, sourceType.value);
  if (!tileUrl) {
    mapError.value = '无法生成瓦片 URL';
    return;
  }

  await nextTick();
  if (!mapContainer.value) return;

  // 矢量瓦片源
  const vectorSource = new VectorTileSource({
    format: new MVT(),
    url: tileUrl,
    tileGrid: createXYZ({ maxZoom: 18 })
  });

  vectorSource.on('tileloaderror', () => {
    console.warn('[VectorMap] tile load error');
  });
  vectorSource.on('tileloadend', () => {
    // tile loaded
  });

  const vectorLayer = new VectorTileLayer({
    source: vectorSource,
    style: vectorStyle(),
    declutter: true,
    renderMode: 'vector'
  });

  // 根据 config.json 构建底图 Layer
  const layers: any[] = [];
  const basemapUrl = getBasemapUrl();
  if (basemapUrl) {
    layers.push(
      new TileLayer({
        source: new XYZ({ url: basemapUrl, maxZoom: getBasemapMaxZoom() })
      })
    );
  }
  layers.push(vectorLayer);

  olMap = new Map({
    target: mapContainer.value,
    layers,
    view: new View({
      center: fromLonLat([104.07, 36.06]),
      zoom: 4,
      minZoom: 2,
      maxZoom: 18
    }),
    controls: defaultControls({ zoom: true, attribution: true })
  });

  mapLoaded.value = true;

  // 自动定位到数据范围
  try {
    const result: any = await fetchVectorExtent(vectorId);
    const extent = (result?.data?.data ?? result?.data ?? result?.response?.data?.data ?? result?.response?.data) as
      | number[]
      | null;
    if (extent && extent.length === 4) {
      const [minLng, minLat, maxLng, maxLat] = extent;
      setTimeout(() => {
        olMap!.getView().fit(transformExtent([minLng, minLat, maxLng, maxLat], 'EPSG:4326', 'EPSG:3857'), {
          padding: [40, 40, 40, 40],
          maxZoom: 14,
          duration: 800
        });
      }, 500);
    }
  } catch {
    // ignore
  }
}

function handleBack() {
  router.push({ name: 'system_vector' });
}

async function handleFitExtent() {
  const vectorId = route.query.vectorId as string;
  if (!vectorId || !olMap) return;
  try {
    const result: any = await fetchVectorExtent(vectorId);
    const extent = (result?.data?.data ?? result?.data ?? result?.response?.data?.data ?? result?.response?.data) as
      | number[]
      | null;
    if (extent && extent.length === 4) {
      const [minLng, minLat, maxLng, maxLat] = extent;
      olMap.getView().fit(transformExtent([minLng, minLat, maxLng, maxLat], 'EPSG:4326', 'EPSG:3857'), {
        padding: [40, 40, 40, 40],
        maxZoom: 14,
        duration: 800
      });
    } else {
      message.info('暂无数据范围信息');
    }
  } catch {
    message.warning('获取数据范围失败');
  }
}

onMounted(() => {
  initMap();
});

onBeforeUnmount(() => {
  if (olMap) {
    olMap.setTarget(undefined);
    olMap = null;
  }
});
</script>

<template>
  <div class="map-page">
    <div class="map-toolbar">
      <div class="map-toolbar__left">
        <NButton size="small" quaternary @click="handleBack">
          <template #icon><SvgIcon icon="mdi:arrow-left" /></template>
          返回列表
        </NButton>
        <span class="map-toolbar__title">
          <SvgIcon icon="mdi:map" style="margin-right: 6px" />
          {{ layerName || '矢量地图' }}
        </span>
        <NTag v-if="sourceType" type="info" size="small" :bordered="false">{{ sourceType }}</NTag>
        <NTag v-if="featureCount > 0" type="success" size="small" :bordered="false">{{ featureCount }} 个要素</NTag>
      </div>
      <div class="map-toolbar__right">
        <NButton size="small" @click="handleFitExtent">适配范围</NButton>
      </div>
    </div>

    <div v-if="mapError" class="map-error">
      <SvgIcon icon="mdi:alert-circle" style="font-size: 48px; color: var(--error-color)" />
      <p>{{ mapError }}</p>
      <NButton type="primary" size="small" @click="handleBack">返回列表</NButton>
    </div>

    <div v-else ref="mapContainer" class="map-container" />
  </div>
</template>

<style scoped>
.map-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.map-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--card-color);
  border-bottom: 1px solid var(--divider-color);
  flex-shrink: 0;
}
.map-toolbar__left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.map-toolbar__title {
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
}
.map-toolbar__right {
  display: flex;
  gap: 8px;
}
.map-container {
  flex: 1;
  min-height: 0;
  background: #f5f5f5;
}
.map-error {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 16px;
  color: var(--text-color-3);
  font-size: 15px;
}
</style>
