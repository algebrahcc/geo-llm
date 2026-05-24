<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useElementSize } from '@vueuse/core';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import { defaults as defaultControls } from 'ol/control';
import 'ol/ol.css';

defineOptions({ name: 'OfflineOlMap' });

interface Props {
  tileUrl?: string;
  center?: [number, number];
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
}

const props = withDefaults(defineProps<Props>(), {
  tileUrl: '/offline/tiles/{z}/{x}/{y}.png',
  center: () => [0, 0],
  zoom: 3,
  minZoom: 1,
  maxZoom: 19
});

const containerRef = ref<HTMLElement | null>(null);
const map = shallowRef<Map | null>(null);
const layer = shallowRef<TileLayer<XYZ> | null>(null);

const { width, height } = useElementSize(containerRef, { width: 0, height: 0 });

function initMap() {
  if (!containerRef.value) return;

  const source = new XYZ({ url: props.tileUrl, crossOrigin: 'anonymous' });
  layer.value = new TileLayer({ source });

  map.value = new Map({
    target: containerRef.value,
    controls: defaultControls({ attribution: false, rotate: false, zoom: false }),
    layers: [layer.value],
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
  layer.value = null;
}

watch([width, height], () => {
  map.value?.updateSize();
});

watch(
  () => props.tileUrl,
  url => {
    const source = layer.value?.getSource();
    source?.setUrl(url);
    source?.refresh();
  }
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
