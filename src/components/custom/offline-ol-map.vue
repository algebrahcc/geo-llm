<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useElementSize } from '@vueuse/core';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import { defaults as defaultControls } from 'ol/control';
import { transformExtent } from 'ol/proj';
import XYZ from 'ol/source/XYZ';
import 'ol/ol.css';

defineOptions({ name: 'OfflineOlMap' });

interface Props {
  tileUrl?: string;
  tileLayers?: Array<{
    url: string;
    extent?: [number, number, number, number];
    opacity?: number;
    minZoom?: number;
    maxZoom?: number;
    zIndex?: number;
  }>;
  center?: [number, number];
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
}

const props = withDefaults(defineProps<Props>(), {
  tileUrl: '/offline/tiles/{z}/{x}/{y}.png',
  tileLayers: () => [],
  center: () => [0, 0],
  zoom: 3,
  minZoom: 1,
  maxZoom: 19
});

const containerRef = ref<HTMLElement | null>(null);
const map = shallowRef<Map | null>(null);
const layers = shallowRef<TileLayer<XYZ>[]>([]);

const { width, height } = useElementSize(containerRef, { width: 0, height: 0 });

const normalizedTileLayers = computed(() => {
  if (props.tileLayers.length > 0) return props.tileLayers;

  return [{ url: props.tileUrl }];
});

function createLayer(config: NonNullable<Props['tileLayers']>[number]) {
  return new TileLayer({
    source: new XYZ({ url: config.url, crossOrigin: 'anonymous' }),
    opacity: config.opacity ?? 1,
    extent: config.extent ? transformExtent(config.extent, 'EPSG:4326', 'EPSG:3857') : undefined,
    minZoom: config.minZoom,
    maxZoom: config.maxZoom,
    zIndex: config.zIndex
  });
}

function initMap() {
  if (!containerRef.value) return;
  layers.value = normalizedTileLayers.value.map(createLayer);

  map.value = new Map({
    target: containerRef.value,
    controls: defaultControls({ attribution: false, rotate: false, zoom: false }),
    layers: layers.value,
    view: new View({
      projection: 'EPSG:3857',
      center: props.center,
      zoom: props.zoom,
      minZoom: props.minZoom,
      maxZoom: props.maxZoom
    })
  });
}

function destroyMap() {
  if (!map.value) return;
  map.value.setTarget(undefined);
  map.value = null;
  layers.value = [];
}

watch([width, height], () => {
  map.value?.updateSize();
});

watch(
  normalizedTileLayers,
  () => {
    const currentCenter = map.value?.getView().getCenter() ?? props.center;
    const currentZoom = map.value?.getView().getZoom() ?? props.zoom;
    destroyMap();
    initMap();

    const view = map.value?.getView();
    if (!view) return;

    view.setCenter(currentCenter);
    if (typeof currentZoom === 'number') {
      view.setZoom(currentZoom);
    }
  },
  { deep: true }
);

watch(
  () => [props.center, props.zoom, props.minZoom, props.maxZoom] as const,
  ([center, zoom, minZoom, maxZoom]) => {
    const view = map.value?.getView();
    if (!view) return;
    view.setMinZoom(minZoom);
    view.setMaxZoom(maxZoom);
    view.setCenter(center);
    view.setZoom(zoom);
  }
);

onMounted(() => {
  initMap();
});

onBeforeUnmount(() => {
  destroyMap();
});

defineExpose({ map });
</script>

<template>
  <div ref="containerRef" class="h-full w-full overflow-hidden rounded-8px"></div>
</template>

<style scoped>
:deep(.ol-viewport) {
  border-radius: 8px;
}
</style>
