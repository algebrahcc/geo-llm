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
import type { CesiumBaseReturn } from './use-cesium-base';

interface VectorLayerEntry {
  provider: MVTImageryProvider;
  layer: ImageryLayer;
}

export function useCesiumVectorLayer(base: CesiumBaseReturn) {
  const vectorLayerMap = new Map<string, VectorLayerEntry>();

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

  async function loadVectorLayer(vectorId: string, vectorName: string, sourceType = '') {
    const viewer = base.viewerRef.value;
    if (!viewer) return;
    const existing = vectorLayerMap.get(vectorId);
    if (existing) {
      existing.layer.show = true;
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
      layer.show = true;
      vectorLayerMap.set(vectorId, { provider, layer });

      let extent: number[] | null = null;
      try {
        const extentResult = await fetchVectorExtent(vectorId);
        extent = unwrapResponseData<number[]>(extentResult);
      } catch {
        /* 无 extent 也能加载 */
      }

      if (extent && extent.length === 4) {
        const centerLng = (extent[0] + extent[2]) / 2;
        const centerLat = (extent[1] + extent[3]) / 2;
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(centerLng, centerLat, 12000)
        });
      } else {
        window.$message?.warning(`图层 "${vectorName}" 已加载（未获取到范围）`);
      }

      base.requestRender();
    } catch (e: any) {
      console.error('[Vector] 加载失败:', e.message);
      window.$message?.warning(`图层 "${vectorName}" 渲染失败`);
    }
  }

  function setVectorLayerVisible(vectorId: string, show: boolean) {
    const entry = vectorLayerMap.get(vectorId);
    if (entry) {
      entry.layer.show = show;
      base.requestRender();
    }
  }

  function removeVectorLayer(vectorId: string) {
    const viewer = base.viewerRef.value;
    const entry = vectorLayerMap.get(vectorId);
    if (viewer && entry) {
      viewer.imageryLayers.remove(entry.layer, true);
      vectorLayerMap.delete(vectorId);
      base.requestRender();
    }
  }

  return {
    loadVectorLayer,
    setVectorLayerVisible,
    removeVectorLayer
  };
}
