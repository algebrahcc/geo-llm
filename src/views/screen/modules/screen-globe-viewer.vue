<script setup lang="ts">
/**
 * 统计大屏中间地图容器
 *
 * 当前只渲染底图：原先叠加的「节点散点层」已移除 —— 那批点没有业务口径
 * （名称是"任务节点-某地"、数值没有单位、也没有来源），即使补上标签、分档与图例，
 * 也只是把噪声包装得更精致，观众依然读不出结论。
 *
 * 若日后要重新叠加图层，请先确认**数据来源与口径**（例如真实的服务调用量、
 * 任务分布、要素覆盖度），再连同"大小/颜色/动效各表示什么"与图例一起设计；
 * 缺少口径的图层不要加回来。
 */
import { onMounted } from 'vue';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import FpsIndicator from '@/components/cesium/fps-indicator.vue';
import { useScreenGlobe } from './use-screen-globe';

defineOptions({
  name: 'ScreenGlobeViewer'
});

const { containerRef, viewerRef, initViewer, switchSceneMode } = useScreenGlobe();

onMounted(async () => {
  await initViewer();
});

defineExpose({
  switchSceneMode
});
</script>

<template>
  <div class="screen-globe-shell">
    <div ref="containerRef" class="screen-globe-viewer"></div>
    <FpsIndicator :viewer="viewerRef" :bottom="16" />
  </div>
</template>

<style scoped>
.screen-globe-shell {
  position: relative;
  height: 100%;
  width: 100%;
}

.screen-globe-viewer {
  height: 100%;
  width: 100%;
  background: #04101c;
}

.screen-globe-viewer :deep(.cesium-widget-credits),
.screen-globe-viewer :deep(.cesium-viewer-bottom),
.screen-globe-viewer :deep(.cesium-credit-logoContainer) {
  display: none !important;
}
</style>
