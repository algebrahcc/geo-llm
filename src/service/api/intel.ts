import { request } from '../request/real';

/**
 * 保存情报（后端 POST /service/intel/detection）
 *
 * 识别本身走 `/api/vision/*`（YOLOv8 代理），本接口只负责把成果落成情报对象：
 * 服务端据此生成类别分布统计、中文摘要与情报点锚点，并给出可上图的情报图层地址。
 */
export function saveIntelDetection(data: Api.Intel.SavePayload) {
  return request<Api.Intel.IntelItem>({
    url: '/service/intel/detection',
    method: 'post',
    data
  });
}

/** 情报分页列表（不含逐目标明细） */
export function fetchIntelDetectionPage(params: Api.Intel.PageQuery = {}) {
  return request<Api.Intel.PageResult<Api.Intel.IntelItem>>({
    url: '/service/intel/detection/page',
    params
  });
}

/** 情报详情（含逐目标明细与轮廓） */
export function fetchIntelDetectionDetail(id: number) {
  return request<Api.Intel.IntelItem>({
    url: `/service/intel/detection/${id}`,
    method: 'get'
  });
}
