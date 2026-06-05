<script setup lang="ts">
/**
 * Cesium Viewer 基础封装组件
 *
 * 封装 Viewer 生命周期、公共操作导出、CSS 样式隐藏，
 * 各场景 viewer 只需在此基础上扩展特定业务逻辑。
 */
import { onMounted } from 'vue';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useCesiumBase, type ViewerInitHooks } from '@/composables/cesium/use-cesium-base';

defineOptions({ name: 'CesiumViewer' });

const props = defineProps<{
  initHooks?: ViewerInitHooks;
}>();

const emit = defineEmits<{
  ready: [];
}>();

const base = useCesiumBase();

defineExpose({
  initViewer: base.initViewer,
  destroyViewer: base.destroyViewer,
  viewerRef: base.viewerRef,
  containerRef: base.containerRef,
  imageryLayers: base.imageryLayers,
  flyToLocation: base.flyToLocation,
  resetView: base.flyToLocation,
  zoomIn: base.zoomIn,
  zoomOut: base.zoomOut,
  rotate: base.rotate,
  pitch: base.pitch,
  exportScreenshot: base.exportScreenshot,
  is2dMode: base.is2dMode,
  toggleViewMode: base.toggleViewMode,
  requestRender: base.requestRender,
  getColor: base.getColor,
  getCartesianFromScreen: base.getCartesianFromScreen,
  bindMouseEvents: base.bindMouseEvents,
  addCameraChangeListener: base.addCameraChangeListener,
  removeCameraChangeListener: base.removeCameraChangeListener
});

onMounted(async () => {
  await base.initViewer(props.initHooks);
  emit('ready');
});
</script>

<template>
  <div class="cesium-viewer-shell">
    <div ref="containerRef" class="cesium-viewer-container" />
  </div>
</template>

<style scoped>
.cesium-viewer-shell {
  position: relative;
  height: 100%;
  min-height: 520px;
  overflow: hidden;
  border-radius: 0;
  background: #050810;
}
.cesium-viewer-container {
  height: 100%;
  width: 100%;
}
.cesium-viewer-shell :deep(.cesium-widget-credits),
.cesium-viewer-shell :deep(.cesium-viewer-bottom),
.cesium-viewer-shell :deep(.cesium-credit-logoContainer) {
  display: none !important;
}
</style>
