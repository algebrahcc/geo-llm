<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { NButton, NCollapse, NCollapseItem, NEmpty, NInputNumber, NModal } from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import type { CatalogItem } from '@/mock/catalog';
import { getGlobalImageryUrl, getOnlineImageryConfig, isOnlineImagery } from '@/utils/imagery';
import {
  fetchCatalogPreview,
  fetchVisionModels,
  postObstacleDetect,
  postObstacleDetectCatalog
} from '@/service/api/vision';
import { classColor, confLevel } from '@/utils/detect-colors';
import OlMap from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Fill, Stroke } from 'ol/style';
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
const analysisMap = shallowRef<OlMap | null>(null);
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

/** 真实 AI 检测模型（YOLOv8 服务），key 与后端 /api/vision/models 的模型名一致 */
const realModelMeta: Record<string, { label: string; description: string }> = {
  military: { label: '军事目标检测', description: '火炮/导弹/雷达/火箭炮/士兵/坦克/车辆 7 类' },
  obstacle: { label: '工程障碍检测', description: '断桥/废墟/塌陷坑 3 类灾害目标' },
  road: { label: '道路障碍物检测', description: '行人/车辆/动物等道路动态障碍（COCO）' }
};

const analysisCategories: AnalysisCategory[] = [
  {
    key: 'feature-extraction',
    label: '要素提取',
    icon: 'mdi:vector-polygon',
    items: [
      { key: 'road-extraction', label: '道路提取' },
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
      { key: 'military', label: realModelMeta.military.label },
      { key: 'obstacle', label: realModelMeta.obstacle.label },
      { key: 'road', label: realModelMeta.road.label }
    ]
  }
];

function getSubItemIcon(key: string): string {
  const iconMap: Record<string, string> = {
    'road-extraction': 'mdi:road-variant',
    building: 'mdi:office-building',
    water: 'mdi:water',
    vegetation: 'mdi:pine-tree',
    military: 'mdi:radar',
    obstacle: 'mdi:alert-octagon',
    'road-damage': 'mdi:road-variant',
    barrier: 'mdi:alert-octagon',
    fortification: 'mdi:shield-outline'
  };
  return iconMap[key] ?? 'mdi:map-marker';
}

function isRealModelKey(key: string): boolean {
  return key in realModelMeta;
}

const isDetectMode = computed(() => isRealModelKey(selectedAnalysisType.value));

// ==================== AI 检测（图片级）状态 ====================
const modelAvailability = ref<Record<string, boolean>>({});
const selectedFile = ref<File | null>(null);
const selectedFileName = ref('');
const previewUrl = ref('');
const detectConf = ref(0.25);
const isDetecting = ref(false);
const detectResult = ref<Api.Vision.DetectResult | null>(null);
const detectError = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);
/** 检测数据来源：catalog=当前目录数据（免上传），upload=本地图片 */
const detectSource = ref<'catalog' | 'upload'>('catalog');
/** 目录数据原始图预览（data URI） */
const catalogPreviewUrl = ref('');
const isLoadingPreview = ref(false);

/** 原始图（本地上传预览 / 目录数据预览） */
const originalImageUrl = computed(() => previewUrl.value || catalogPreviewUrl.value || '');
/** 服务端标注图 */
const annotatedImageUrl = computed(() => detectResult.value?.annotatedImageBase64 || '');
/** 图像区展示：检测框叠加在原图上 / 服务端标注图 */
const viewMode = ref<'overlay' | 'annotated'>('overlay');
const displayImageUrl = computed(() => {
  if (viewMode.value === 'annotated' && annotatedImageUrl.value) return annotatedImageUrl.value;
  return originalImageUrl.value || annotatedImageUrl.value;
});

/** 开始检测按钮禁用条件 */
const runDisabled = computed(() => isDetecting.value || (detectSource.value === 'upload' && !selectedFile.value));

// ─── 检测结果可视化：类别统计 / 筛选 / 清单与图上框联动 ───
const activeDetectionIdx = ref<number | null>(null);
const hoverDetectionIdx = ref<number | null>(null);
const classFilter = ref<string>('all');

/** 按类别聚合统计（供筛选 chips） */
const classStats = computed(() => {
  const map = new Map<string, { key: string; name: string; en: string; count: number; maxConf: number }>();
  (detectResult.value?.detections ?? []).forEach(d => {
    const key = d.classNameZh || d.className;
    const cur = map.get(key) ?? { key, name: d.classNameZh, en: d.className, count: 0, maxConf: 0 };
    cur.count += 1;
    cur.maxConf = Math.max(cur.maxConf, d.confidence);
    map.set(key, cur);
  });
  return [...map.values()].sort((a, b) => b.count - a.count);
});

/** 筛选后的目标清单（保留原始序号，与图上框联动） */
const visibleDetections = computed(() => {
  const list = detectResult.value?.detections ?? [];
  return list
    .map((d, i) => ({ d, i }))
    .filter(x => classFilter.value === 'all' || (x.d.classNameZh || x.d.className) === classFilter.value);
});

/** 图上检测框定位（bbox 按原图像素 → 百分比；等比缩放下比例不变） */
function boxStyle(d: Api.Vision.Detection): Record<string, string> {
  const w = detectResult.value?.width || 1;
  const h = detectResult.value?.height || 1;
  const [x1, y1, x2, y2] = d.bbox;
  return {
    left: `${(x1 / w) * 100}%`,
    top: `${(y1 / h) * 100}%`,
    width: `${((x2 - x1) / w) * 100}%`,
    height: `${((y2 - y1) / h) * 100}%`,
    borderColor: classColor(d.classNameZh || d.className)
  };
}

function toggleDetection(i: number) {
  activeDetectionIdx.value = activeDetectionIdx.value === i ? null : i;
}

// ─── 检测框叠加层定位：按 object-fit contain 计算图像实际渲染区域 ───
const frameContainerRef = ref<HTMLElement | null>(null);
const imgRef = ref<HTMLImageElement | null>(null);
const frameStyle = ref<Record<string, string | number>>({ opacity: 0 });

function updateBoxRect() {
  const container = frameContainerRef.value;
  const img = imgRef.value;
  if (!container || !img || !img.naturalWidth || !img.naturalHeight) return;
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  if (!cw || !ch) return;
  const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  frameStyle.value = {
    left: `${(cw - w) / 2}px`,
    top: `${(ch - h) / 2}px`,
    width: `${w}px`,
    height: `${h}px`,
    opacity: 1
  };
}

let boxResizeObserver: ResizeObserver | null = null;

onMounted(() => {
  boxResizeObserver = new ResizeObserver(() => updateBoxRect());
  if (frameContainerRef.value) boxResizeObserver.observe(frameContainerRef.value);
});

watch(displayImageUrl, () => {
  frameStyle.value = { opacity: 0 };
  nextTick(() => updateBoxRect());
});

/** 加载目录数据原始图预览（tif 等格式由后端转 jpeg） */
async function loadCatalogPreview() {
  if (!props.item || isLoadingPreview.value) return;
  isLoadingPreview.value = true;
  catalogPreviewUrl.value = '';
  const res = await fetchCatalogPreview(props.item.id);
  isLoadingPreview.value = false;
  if (!res.error && res.data) {
    catalogPreviewUrl.value = res.data;
  } else {
    // 预览失败不阻断检测（如超大分辨率图后端拒绝生成预览）
    console.warn('[catalog-analysis] 预览加载失败', res.error);
  }
}

async function loadModelAvailability() {
  const res = await fetchVisionModels();
  const map: Record<string, boolean> = {};
  (res.data ?? []).forEach(m => {
    map[m.name] = Boolean(m.available);
  });
  modelAvailability.value = map;
}

function currentModelAvailable(): boolean {
  return modelAvailability.value[selectedAnalysisType.value] !== false;
}

function handlePickFile() {
  fileInputRef.value?.click();
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  selectedFile.value = file;
  selectedFileName.value = file.name;
  previewUrl.value = URL.createObjectURL(file);
  detectResult.value = null;
  detectError.value = '';
  input.value = '';
}

function resetDetectState() {
  selectedFile.value = null;
  selectedFileName.value = '';
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
  detectResult.value = null;
  detectError.value = '';
  isDetecting.value = false;
  catalogPreviewUrl.value = '';
  activeDetectionIdx.value = null;
  hoverDetectionIdx.value = null;
  classFilter.value = 'all';
  viewMode.value = 'overlay';
  detectSource.value = props.item ? 'catalog' : 'upload';
}

async function handleRunDetect() {
  if (runDisabled.value) return;
  if (!currentModelAvailable()) {
    detectError.value = '该模型权重未部署（不可用），请联系管理员确认 YOLOv8 服务状态';
    return;
  }
  isDetecting.value = true;
  detectError.value = '';
  detectResult.value = null;
  const params: Api.Vision.DetectParams = {
    model: selectedAnalysisType.value,
    conf: detectConf.value,
    returnAnnotated: true
  };
  const res =
    detectSource.value === 'catalog'
      ? await detectCatalogItem(params)
      : await postObstacleDetect(selectedFile.value as File, params);
  isDetecting.value = false;
  if (res.error) {
    const err = res.error as unknown as { msg?: string; message?: string };
    detectError.value = err?.msg || err?.message || '检测失败，请稍后重试';
    return;
  }
  detectResult.value = res.data ?? null;
  // 检测完成：切到原图+检测框视图，重置筛选与选中
  viewMode.value = 'overlay';
  classFilter.value = 'all';
  activeDetectionIdx.value = null;
  hoverDetectionIdx.value = null;
}

/** 目录数据直通：后端经存储抽象层（minio/local）读对象内容送检，无需重新上传 */
async function detectCatalogItem(params: Api.Vision.DetectParams) {
  type DetectFlatResp = Awaited<ReturnType<typeof postObstacleDetectCatalog>>;
  if (!props.item) {
    return { data: null, error: { msg: '未选择目录数据' } } as unknown as DetectFlatResp;
  }
  return postObstacleDetectCatalog(props.item.id, params);
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
    'road-extraction': {
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

  const map = new OlMap({
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
  // 真实模型：进入 AI 检测面板（图片级展示），不渲染 mock 地图
  if (isRealModelKey(typeKey)) {
    selectedAnalysisType.value = typeKey;
    resetDetectState();
    // resetDetectState 把来源重置为 catalog（有目录项时），自动加载原始图预览
    if (detectSource.value === 'catalog') {
      loadCatalogPreview();
    }
    return;
  }

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

// 切回「检测当前数据」来源时自动加载原始图预览
watch(detectSource, val => {
  if (val === 'catalog' && props.item && !catalogPreviewUrl.value) {
    loadCatalogPreview();
  }
});

// 打开时初始化地图，关闭/切换目录时销毁并重置
watch(
  () => props.item,
  val => {
    if (val) {
      selectedAnalysisType.value = '';
      resetDetectState();
      loadModelAvailability();
      nextTick(() => initAnalysisMap());
    } else {
      destroyAnalysisMap();
      resetDetectState();
    }
  }
);

onBeforeUnmount(() => {
  boxResizeObserver?.disconnect();
  boxResizeObserver = null;
  destroyAnalysisMap();
  resetDetectState();
});
</script>

<template>
  <!-- 数据分析弹窗：要素提取为 mock 演示；目标检测/障碍物识别为真实 AI 检测 -->
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
          <NCollapse :default-expanded-names="['feature-extraction', 'target-detection']" class="analysis-collapse">
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
                    'analysis-sub-item--loading': isAnalysisLoading && selectedAnalysisType === subItem.key,
                    'analysis-sub-item--disabled':
                      isRealModelKey(subItem.key) && modelAvailability[subItem.key] === false
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

        <!-- 中间区域：mock 地图（要素提取） -->
        <div
          v-show="!isDetectMode"
          class="analysis-map-area"
          :class="{ 'analysis-map-area--active': selectedAnalysisType }"
        >
          <div ref="analysisMapContainer" class="analysis-map-container"></div>
        </div>

        <!-- 中间区域：AI 检测（图片级展示） -->
        <div v-show="isDetectMode" class="detect-area">
          <div class="detect-toolbar">
            <span class="detect-toolbar__model">
              <SvgIcon icon="mdi:radar" />
              {{ realModelMeta[selectedAnalysisType]?.label || 'AI 检测' }}
            </span>
            <div class="detect-toolbar__source">
              <button
                class="detect-source-btn"
                :class="{ 'detect-source-btn--active': detectSource === 'catalog' }"
                :disabled="!item"
                title="直接检测当前目录数据，无需重新上传"
                @click="detectSource = 'catalog'"
              >
                <SvgIcon icon="mdi:database" />
                检测当前数据
              </button>
              <button
                class="detect-source-btn"
                :class="{ 'detect-source-btn--active': detectSource === 'upload' }"
                @click="detectSource = 'upload'"
              >
                <SvgIcon icon="mdi:upload" />
                本地图片
              </button>
            </div>
            <input
              ref="fileInputRef"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/bmp,image/tiff,.tif,.tiff"
              class="detect-toolbar__file-input"
              @change="handleFileChange"
            />
            <span v-if="detectSource === 'catalog' && item" class="detect-toolbar__filename" :title="item.name">
              {{ item.name }}
            </span>
            <template v-if="detectSource === 'upload'">
              <button class="detect-toolbar__upload" @click="handlePickFile">
                <SvgIcon icon="mdi:upload" />
                选择图片
              </button>
              <span class="detect-toolbar__filename" :title="selectedFileName">
                {{ selectedFileName || '未选择图片' }}
              </span>
            </template>
            <div class="detect-toolbar__conf">
              <span>置信度阈值</span>
              <NInputNumber
                v-model:value="detectConf"
                :min="0.01"
                :max="1"
                :step="0.05"
                size="small"
                style="width: 110px"
              />
            </div>
            <NButton
              type="primary"
              size="small"
              :loading="isDetecting"
              :disabled="runDisabled"
              @click="handleRunDetect"
            >
              开始检测
            </NButton>
          </div>

          <div v-if="detectError" class="detect-alert">
            <SvgIcon icon="mdi:alert-circle" />
            {{ detectError }}
          </div>

          <div class="detect-content">
            <div ref="frameContainerRef" class="detect-image">
              <div v-if="displayImageUrl" class="detect-image__frame" :style="frameStyle">
                <img ref="imgRef" :src="displayImageUrl" alt="检测图片" @load="updateBoxRect" />
                <!-- 原图 + 自绘检测框（中文标签，按类别配色，清单联动） -->
                <template v-if="viewMode === 'overlay' && detectResult">
                  <div
                    v-for="x in visibleDetections"
                    :key="x.i"
                    class="dbox"
                    :class="[
                      `dbox--${confLevel(x.d.confidence)}`,
                      {
                        'dbox--active': activeDetectionIdx === x.i || hoverDetectionIdx === x.i,
                        'dbox--dim':
                          (activeDetectionIdx !== null && activeDetectionIdx !== x.i) ||
                          (hoverDetectionIdx !== null && hoverDetectionIdx !== x.i)
                      }
                    ]"
                    :style="boxStyle(x.d)"
                    :title="`${x.d.classNameZh} · 置信度 ${(x.d.confidence * 100).toFixed(1)}% · bbox [${x.d.bbox.join(', ')}]`"
                    @click="toggleDetection(x.i)"
                    @mouseenter="hoverDetectionIdx = x.i"
                    @mouseleave="hoverDetectionIdx = null"
                  >
                    <span class="dbox__tag" :style="{ background: classColor(x.d.classNameZh || x.d.className) }">
                      {{ x.d.classNameZh }}
                      {{ (x.d.confidence * 100).toFixed(0) }}%
                    </span>
                  </div>
                </template>
              </div>
              <NEmpty
                v-else
                :description="
                  detectSource === 'catalog'
                    ? '点击「开始检测」分析当前目录数据（支持 jpg/png/webp/tif，≤200MB）'
                    : '上传图片后开始检测'
                "
                class="detect-image__empty"
              />
              <!-- 视图切换（有结果且两种视图都有来源时） -->
              <div v-if="detectResult && originalImageUrl && annotatedImageUrl" class="detect-image__views">
                <button :class="{ 'detect-view-btn--active': viewMode === 'overlay' }" @click="viewMode = 'overlay'">
                  检测框
                </button>
                <button
                  :class="{ 'detect-view-btn--active': viewMode === 'annotated' }"
                  @click="viewMode = 'annotated'"
                >
                  服务标注
                </button>
              </div>
              <div v-if="isDetecting || isLoadingPreview" class="detect-image__loading">
                <SvgIcon icon="mdi:loading" class="detect-image__spinner" />
                {{ isDetecting ? '检测中…' : '预览加载中…' }}
              </div>
            </div>

            <div class="detect-result">
              <div v-if="detectResult" class="detect-result__summary">
                <SvgIcon icon="mdi:check-decagram" />
                <span>{{ detectResult.summary }}</span>
                <span class="detect-result__meta">
                  {{ detectResult.detections.length }} 个目标 · {{ detectResult.inferenceMs }}ms ·
                  {{ detectResult.width }}×{{ detectResult.height }}
                </span>
              </div>
              <!-- 类别统计筛选 chips -->
              <div v-if="classStats.length" class="detect-result__chips">
                <button
                  class="detect-chip"
                  :class="{ 'detect-chip--active': classFilter === 'all' }"
                  @click="classFilter = 'all'"
                >
                  全部 {{ (detectResult?.detections ?? []).length }}
                </button>
                <button
                  v-for="s in classStats"
                  :key="s.key"
                  class="detect-chip"
                  :class="{ 'detect-chip--active': classFilter === s.key }"
                  :style="
                    classFilter === s.key
                      ? { background: classColor(s.key), borderColor: classColor(s.key) }
                      : { borderColor: classColor(s.key) }
                  "
                  @click="classFilter = classFilter === s.key ? 'all' : s.key"
                >
                  {{ s.name }}×{{ s.count }}
                </button>
              </div>
              <div class="detect-result__list">
                <div
                  v-for="x in visibleDetections"
                  :key="x.i"
                  class="detect-row"
                  :class="{
                    'detect-row--active': activeDetectionIdx === x.i || hoverDetectionIdx === x.i,
                    'detect-row--low': x.d.confidence < 0.4
                  }"
                  :title="`bbox [${x.d.bbox.join(', ')}]`"
                  @mouseenter="hoverDetectionIdx = x.i"
                  @mouseleave="hoverDetectionIdx = null"
                  @click="toggleDetection(x.i)"
                >
                  <span class="detect-row__idx">{{ x.i + 1 }}</span>
                  <span
                    class="detect-row__dot"
                    :style="{ background: classColor(x.d.classNameZh || x.d.className) }"
                  ></span>
                  <span class="detect-row__name">{{ x.d.classNameZh }}</span>
                  <span class="detect-row__en">{{ x.d.className }}</span>
                  <span v-if="x.d.confidence < 0.4" class="detect-row__review">待确认</span>
                  <div class="detect-row__bar">
                    <div
                      class="detect-row__bar-fill"
                      :class="`detect-row__bar-fill--${confLevel(x.d.confidence)}`"
                      :style="{ width: `${Math.min(x.d.confidence * 100, 100)}%` }"
                    ></div>
                  </div>
                  <span class="detect-row__conf">{{ (x.d.confidence * 100).toFixed(1) }}%</span>
                </div>
                <NEmpty
                  v-if="detectResult && visibleDetections.length === 0 && detectResult.detections.length > 0"
                  description="该类别下无目标，点击「全部」恢复"
                  class="detect-result__empty"
                />
                <NEmpty
                  v-if="detectResult && detectResult.detections.length === 0"
                  description="未检测到目标，可尝试降低置信度阈值"
                  class="detect-result__empty"
                />
                <NEmpty
                  v-if="!detectResult && !isDetecting"
                  description="检测结果将显示在这里"
                  class="detect-result__empty"
                />
              </div>
            </div>
          </div>
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
  display: flex;
  flex-direction: column;

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

  &--disabled {
    opacity: 0.45;
    cursor: not-allowed;
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

/* ── Detect Area（AI 检测，图片级展示） ── */
.detect-source-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  font-size: 12px;
  color: var(--catalog-text-secondary, rgba(203, 227, 255, 0.72));
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &--active {
    color: var(--catalog-accent, #29a3ff);
    background: rgba(41, 163, 255, 0.16);
    font-weight: 600;
  }

  &:hover:not(:disabled) {
    color: var(--catalog-accent, #29a3ff);
    background: rgba(41, 163, 255, 0.1);
  }
}

.detect-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.detect-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  border-bottom: 1px solid rgba(25, 95, 176, 0.2);
  flex-shrink: 0;
  flex-wrap: wrap;

  &__model {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--catalog-accent, #29a3ff);
  }

  &__source {
    display: inline-flex;
    border: 1px solid rgba(41, 163, 255, 0.25);
    border-radius: 6px;
    overflow: hidden;
  }

  &__upload {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    font-size: 12px;
    color: var(--catalog-text-primary, #eaf5ff);
    background: rgba(41, 163, 255, 0.12);
    border: 1px solid rgba(41, 163, 255, 0.3);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: rgba(41, 163, 255, 0.22);
    }
  }

  &__file-input {
    display: none;
  }

  &__filename {
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: var(--catalog-text-tertiary, rgba(147, 196, 255, 0.62));
  }

  &__conf {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--catalog-text-tertiary, rgba(147, 196, 255, 0.62));

    :deep(.n-input) {
      background: rgba(2, 18, 36, 0.6);
    }
  }
}

.detect-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 18px 0;
  padding: 8px 12px;
  font-size: 12px;
  color: #ff8a80;
  background: rgba(255, 23, 68, 0.08);
  border: 1px solid rgba(255, 23, 68, 0.25);
  border-radius: 6px;
  flex-shrink: 0;
}

.detect-content {
  flex: 1;
  display: flex;
  gap: 14px;
  padding: 14px 18px 18px;
  min-height: 0;
}

.detect-image {
  flex: 1.4;
  min-width: 0;
  border: 1px solid rgba(25, 95, 176, 0.3);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;

  /* 图像实际渲染区域（object-fit contain 换算，JS 定位），检测框百分比叠加其上 */
  &__frame {
    position: absolute;
    z-index: 1;

    img {
      width: 100%;
      height: 100%;
      display: block;
    }
  }

  &__empty {
    opacity: 0.5;
  }

  &__views {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 5;
    display: inline-flex;
    border: 1px solid rgba(43, 131, 255, 0.35);
    border-radius: 6px;
    overflow: hidden;
    background: rgba(2, 10, 20, 0.8);
    backdrop-filter: blur(4px);

    button {
      padding: 4px 10px;
      font-size: 11px;
      color: rgba(203, 227, 255, 0.75);
      background: transparent;
      border: none;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .detect-view-btn--active {
      color: #eaf5ff;
      background: rgba(41, 163, 255, 0.28);
      font-weight: 600;
    }
  }

  &__loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 13px;
    color: var(--catalog-accent, #29a3ff);
    background: rgba(1, 12, 26, 0.7);
    backdrop-filter: blur(2px);
  }

  &__spinner {
    font-size: 20px;
    animation: spin 0.8s linear infinite;
  }
}

/* 检测框叠加层（原图 + 中文标签，按类别配色） */
.dbox {
  position: absolute;
  border: 2px solid;
  box-sizing: border-box;
  cursor: pointer;
  transition:
    opacity 0.15s ease,
    box-shadow 0.15s ease;

  &--low {
    border-style: dashed;
  }

  &--active {
    box-shadow:
      0 0 0 2px rgba(255, 255, 255, 0.85),
      0 0 14px rgba(41, 163, 255, 0.5);
    z-index: 3;

    .dbox__tag {
      opacity: 1;
    }
  }

  &--dim {
    opacity: 0.25;
  }

  &__tag {
    position: absolute;
    top: -20px;
    left: -2px;
    font-size: 11px;
    font-weight: 600;
    color: #fff;
    padding: 1px 6px;
    border-radius: 3px;
    line-height: 18px;
    white-space: nowrap;
    pointer-events: none;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
    opacity: 0.92;
    transition: opacity 0.15s ease;
  }
}

.detect-result {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(25, 95, 176, 0.3);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.18);
  overflow: hidden;

  /* 类别统计筛选 chips */
  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 10px 10px 4px;
  }

  &__summary {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding: 10px 14px;
    font-size: 13px;
    font-weight: 600;
    color: #7ee787;
    background: rgba(126, 231, 135, 0.06);
    border-bottom: 1px solid rgba(25, 95, 176, 0.2);
  }

  &__meta {
    font-size: 11px;
    font-weight: 400;
    color: var(--catalog-text-tertiary, rgba(147, 196, 255, 0.62));
  }

  &__list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 10px;

    &::-webkit-scrollbar {
      width: 4px;
    }
    &::-webkit-scrollbar-thumb {
      background: rgba(41, 163, 255, 0.2);
      border-radius: 2px;
    }
  }

  &__empty {
    margin-top: 40px;
    opacity: 0.5;
  }
}

.detect-chip {
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 10px;
  color: rgba(203, 227, 255, 0.85);
  background: rgba(41, 163, 255, 0.06);
  border: 1px solid rgba(41, 163, 255, 0.3);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(41, 163, 255, 0.15);
  }

  &--active {
    color: #06121f;
    font-weight: 700;
  }
}

.detect-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 5px;
  font-size: 12px;
  transition: background 0.15s ease;
  cursor: pointer;

  &:hover {
    background: rgba(41, 163, 255, 0.06);
  }

  &--active {
    background: rgba(41, 163, 255, 0.14);
    box-shadow: inset 0 0 0 1px rgba(41, 163, 255, 0.3);
  }

  &--low .detect-row__name {
    opacity: 0.55;
  }

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &__review {
    font-size: 10px;
    color: #ffb02e;
    border: 1px solid rgba(255, 176, 46, 0.4);
    padding: 0 4px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  &__idx {
    width: 20px;
    text-align: center;
    color: var(--catalog-text-tertiary, rgba(147, 196, 255, 0.5));
    font-size: 11px;
    flex-shrink: 0;
  }

  &__name {
    width: 52px;
    font-weight: 600;
    color: var(--catalog-text-primary, #eaf5ff);
    flex-shrink: 0;
  }

  &__en {
    width: 70px;
    color: var(--catalog-text-tertiary, rgba(147, 196, 255, 0.55));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-shrink: 0;
  }

  &__bar {
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: rgba(41, 163, 255, 0.1);
    overflow: hidden;
  }

  &__bar-fill {
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(90deg, rgba(41, 163, 255, 0.7), #7ee787);
    transition: width 0.4s ease;

    &--high {
      background: linear-gradient(90deg, rgba(126, 231, 135, 0.75), #7ee787);
    }

    &--mid {
      background: linear-gradient(90deg, rgba(41, 163, 255, 0.65), #8db8ff);
    }

    &--low {
      background: rgba(255, 176, 46, 0.65);
    }
  }

  &__conf {
    width: 44px;
    text-align: right;
    color: #7ee787;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }
}

/* ── Keyframes ── */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
