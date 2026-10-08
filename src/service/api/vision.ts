import { request } from '../request/real';

/** 可用检测模型列表（后端 GET /api/vision/models，代理 YOLOv8 服务） */
export function fetchVisionModels() {
  return request<Api.Vision.ModelInfo[]>({
    url: '/api/vision/models',
    method: 'get'
  });
}

/**
 * 模型评测报告（后端 GET /api/vision/eval/report）
 *
 * 回放该模型最新一次离线评测结果：目标类型准确率与两套轮廓误差口径。
 * 未评测时 `evaluated=false` —— 这是正常状态，不代表接口出错。
 */
export function fetchModelEvalReport(model: string) {
  return request<Api.Vision.EvalReportPayload>({
    url: '/api/vision/eval/report',
    method: 'get',
    params: { model }
  });
}

/**
 * 图像目标检测（后端 POST /api/vision/obstacle-detect，multipart）
 *
 * @param file 图片文件（jpg/png/webp 等）
 * @param params model=road/military、conf 置信度阈值、returnAnnotated 是否返回标注图
 */
export function postObstacleDetect(file: File, params: Api.Vision.DetectParams = {}) {
  const fd = new FormData();
  fd.append('file', file);
  return request<Api.Vision.DetectResult>({
    url: '/api/vision/obstacle-detect',
    method: 'post',
    data: fd,
    params: {
      model: params.model,
      conf: params.conf,
      classes: params.classes,
      returnAnnotated: params.returnAnnotated ?? true
    },
    headers: { 'Content-Type': 'multipart/form-data' }
  });
}

/**
 * 目录数据直通检测（后端 POST /api/vision/obstacle-detect/catalog/{id}）
 *
 * 后端经存储抽象层（minio/local）读取对象内容送检，无需重新上传；
 * 文件需为 ≤200MB 的图片。
 */
export function postObstacleDetectCatalog(catalogId: string, params: Api.Vision.DetectParams = {}) {
  return request<Api.Vision.DetectResult>({
    url: `/api/vision/obstacle-detect/catalog/${catalogId}`,
    method: 'post',
    params: {
      model: params.model,
      conf: params.conf,
      classes: params.classes,
      returnAnnotated: params.returnAnnotated ?? true
    }
  });
}

/**
 * 目录数据原始图预览（后端 GET /api/vision/obstacle-detect/catalog/{id}/preview）
 *
 * 返回 data URI：jpg/png/gif/webp/bmp 原样；tif 等由服务端转 jpeg（最长边 2048）。
 */
export function fetchCatalogPreview(catalogId: string) {
  return request<string>({
    url: `/api/vision/obstacle-detect/catalog/${catalogId}/preview`,
    method: 'get'
  });
}
