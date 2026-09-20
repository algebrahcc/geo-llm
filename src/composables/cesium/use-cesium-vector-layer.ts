/**
 * Cesium 矢量图层组合层（通用）
 *
 * 通过 mvt-imagery-provider 按瓦片渲染后端 MVT 接口（GeoJSON / Shapefile 均转 MVT），
 * 提供加载 / 显隐 / 移除能力。供 river / planning 等地图模块复用同一套数据加载逻辑。
 */
import MVTImageryProvider from 'mvt-imagery-provider';
import type { StyleSpecification } from 'mvt-imagery-provider';
import { Cartesian3, type ImageryLayer, type ImageryProvider } from 'cesium';
import { fetchVectorExtent, getVectorTileUrl } from '@/service/api/vector';
import { unwrapResponseData } from '@/service/request/envelope';
import { createLayerRegistry } from './scene/layer-registry';
import type { CesiumBaseReturn } from './use-cesium-base';

interface VectorLayerEntry {
  provider: MVTImageryProvider;
  layer: ImageryLayer;
}

export function useCesiumVectorLayer(base: CesiumBaseReturn) {
  const vectorLayerMap = new Map<string, VectorLayerEntry>();

  /**
   * 矢量图层显隐真相。
   *
   * 此前 `layer.show` 是直接被写的（三处），既没有可查询的状态来源，
   * 重新加载时又会无条件 `show = true`。现在每个矢量图层一个 key，
   * 面板/模块都从这里读，球上状态与 UI 状态不会再分叉。
   */
  const vectorVisibility = createLayerRegistry();
  const keyOf = (vectorId: string) => `vector:${vectorId}`;

  /**
   * 构造矢量图层的 Mapbox StyleSpec：sources 指向后端 MVT 瓦片 URL，
   * layers 定义橙色系（#ff8c00）点/线/面三套样式，所有矢量图层共用。
   */
  function buildVectorMvtStyle(vectorId: string, sourceType: string): StyleSpecification {
    const tileUrl = getVectorTileUrl(vectorId, sourceType);
    const sourceName = `vector-${vectorId}`;
    return {
      version: 8,
      name: `vector-${vectorId}`,
      sources: {
        [sourceName]: {
          type: 'vector',
          scheme: 'xyz',
          tiles: tileUrl ? [tileUrl] : []
        }
      },
      // 后端 MVT 由 ST_AsMVT(tile, 'vector', 4096, 'geom') 生成，source-layer 固定为 'vector'。
      // mvt-basic-render 要求每个矢量图层必须显式指定 source-layer，否则构建失败。
      layers: [
        {
          id: `${sourceName}-fill`,
          type: 'fill',
          source: sourceName,
          'source-layer': 'vector',
          paint: {
            'fill-color': 'rgba(255, 140, 0, 0.25)',
            'fill-outline-color': 'rgba(255, 140, 0, 0.9)'
          }
        },
        {
          id: `${sourceName}-line`,
          type: 'line',
          source: sourceName,
          'source-layer': 'vector',
          paint: {
            'line-color': 'rgba(255, 140, 0, 0.94)',
            'line-width': 3
          }
        }
      ]
    };
  }

  /** 飞行至矢量数据范围中心（extent 为 [west, south, east, north]，来自后端 /system/vector/extent） */
  async function flyToVector(vectorId: string, vectorName?: string) {
    const viewer = base.viewerRef.value;
    if (!viewer) return;
    let extent: number[] | null = null;
    try {
      const extentResult = await fetchVectorExtent(vectorId);
      extent = unwrapResponseData<number[]>(extentResult);
    } catch {
      /* 无 extent 时提示即可 */
    }

    if (extent && extent.length === 4) {
      const centerLng = (extent[0] + extent[2]) / 2;
      const centerLat = (extent[1] + extent[3]) / 2;
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(centerLng, centerLat, 12000)
      });
    } else {
      window.$message?.warning(vectorName ? `图层 "${vectorName}" 未获取到数据范围` : '未获取到矢量数据范围');
    }
  }

  async function loadVectorLayer(vectorId: string, vectorName: string, sourceType = '') {
    const viewer = base.viewerRef.value;
    if (!viewer) return;
    const existing = vectorLayerMap.get(vectorId);
    if (existing) {
      // 语义：loadVectorLayer = 加载并显示（面板眼睛打开时调用）。
      // 只想「定位」而不动显隐，请用 flyToVector —— 它不碰显隐状态。
      vectorVisibility.setVisible(keyOf(vectorId), true);
      base.requestRender();
      return;
    }

    try {
      const provider = new MVTImageryProvider({
        style: buildVectorMvtStyle(vectorId, sourceType)
      });
      // 兼容 Cesium 1.143：ImageryProvider 新增了抽象方法 getTileCredits，
      // 而 mvt-imagery-provider@1.0.3 基于旧版 Cesium（1.106）实现，未提供该方法。
      // 这里补一个默认实现（返回空数组，无瓦片级 credit），并断言为 ImageryProvider。
      (provider as unknown as { getTileCredits: () => unknown[] }).getTileCredits = () => [];
      const layer = viewer.imageryLayers.addImageryProvider(provider as unknown as ImageryProvider);
      vectorLayerMap.set(vectorId, { provider, layer });
      // 绑定到显隐真相：attach 立刻回放当前状态，新图层不会沿用 Cesium 默认的 show
      vectorVisibility.attach(keyOf(vectorId), {
        setVisible: visible => {
          layer.show = visible;
        },
        // 矢量影像层不支持整体透明度
        setOpacity: () => {}
      });
      vectorVisibility.setVisible(keyOf(vectorId), true);

      await flyToVector(vectorId, vectorName);

      base.requestRender();
    } catch (e: any) {
      console.error('[Vector] 加载失败:', e.message);
      window.$message?.warning(`图层 "${vectorName}" 渲染失败`);
    }
  }

  function setVectorLayerVisible(vectorId: string, show: boolean) {
    if (!vectorLayerMap.has(vectorId)) return;
    vectorVisibility.setVisible(keyOf(vectorId), show);
    base.requestRender();
  }

  /**
   * 读取矢量图层当前显隐。
   *
   * 面板侧应以此为准，避免"UI 显示已开启、球上其实没有"这类分叉 ——
   * 这正是本步要消除的问题。
   */
  function isVectorLayerVisible(vectorId: string): boolean {
    return vectorVisibility.get(keyOf(vectorId)).visible;
  }

  function removeVectorLayer(vectorId: string) {
    const viewer = base.viewerRef.value;
    const entry = vectorLayerMap.get(vectorId);
    if (viewer && entry) {
      viewer.imageryLayers.remove(entry.layer, true);
      vectorLayerMap.delete(vectorId);
      vectorVisibility.remove(keyOf(vectorId));
      base.requestRender();
    }
  }

  return {
    loadVectorLayer,
    flyToVector,
    setVectorLayerVisible,
    isVectorLayerVisible,
    removeVectorLayer
  };
}
