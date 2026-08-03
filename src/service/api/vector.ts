import { request } from '../request/real';

/** 分页查询矢量图层列表 */
export function fetchVectorPage(params?: Api.Vector.VectorQuery) {
  return request<Api.Vector.PageResult<Api.Vector.VectorItem>>({
    url: '/system/vector',
    params
  });
}

/** 查询矢量图层详情 */
export function fetchVectorDetail(id: string | number) {
  return request<Api.Vector.VectorDetail>({
    url: `/system/vector/${id}`
  });
}

/** 新建矢量图层记录 */
export function fetchVectorCreate(data: Api.Vector.VectorForm) {
  return request<Api.Vector.IdResp>({
    url: '/system/vector',
    method: 'post',
    data
  });
}

/** 编辑矢量图层记录 */
export function fetchVectorUpdate(id: string | number, data: Api.Vector.VectorForm) {
  return request<void>({
    url: `/system/vector/${id}`,
    method: 'put',
    data
  });
}

/** 删除矢量图层（同时会 DROP 动态矢量表） */
export function fetchVectorDelete(ids: (string | number)[]) {
  return request<void>({
    url: '/system/vector',
    method: 'delete',
    data: { ids }
  });
}

/** 从服务端路径导入矢量文件 */
export function importVectorFromPath(data: Api.Vector.ImportFromPathReq) {
  return request<void>({
    url: '/system/vector/save',
    method: 'post',
    data
  });
}

/** 上传矢量文件导入（GeoJSON/Shapefile.zip） */
export function uploadVectorFile(file: File, onProgress?: (percent: number) => void) {
  const fd = new FormData();
  fd.append('file', file);
  return request<void>({
    url: '/system/vector/upload',
    method: 'post',
    data: fd,
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress ? e => onProgress(Math.round((e.progress ?? 0) * 100)) : undefined
  });
}

/** 生成 MVT 瓦片 URL */
export function getVectorTileUrl(vectorId: string | number, _sourceType: string): string | null {
  if (!vectorId) return null;
  // 瓦片由 OpenLayers 直接请求，不走 axios request 代理，需要完整后端地址
  // eslint-disable-next-line no-underscore-dangle
  const baseUrl =
    window['__APP_CONFIG__']?.VITE_SERVICE_REAL_BASE_URL ||
    import.meta.env.VITE_SERVICE_REAL_BASE_URL ||
    'http://localhost:8000';
  return `${baseUrl}/system/vector/tile/${vectorId}/{z}/{x}/{y}.pbf`;
}

/** 获取矢量图层的经纬度边界 [minLng, minLat, maxLng, maxLat] */
export function fetchVectorExtent(vectorId: string | number) {
  return request<number[]>({
    url: `/system/vector/extent/${vectorId}`
  });
}

/** 按视口 bbox 获取矢量要素 GeoJSON（含点聚合/线面简化） */
export function fetchVectorFeaturesInBbox(
  vectorId: string | number,
  params: { minLng: number; minLat: number; maxLng: number; maxLat: number; zoom: number }
) {
  return request<any>({
    url: `/system/vector/${vectorId}/features`,
    params
  });
}

/** 获取完整 GeoJSON FeatureCollection（供 Cesium GeoJsonDataSource 加载） */
export function fetchVectorGeoJson(vectorId: string | number) {
  return request<any>({
    url: `/system/vector/${vectorId}/geojson`
  });
}
