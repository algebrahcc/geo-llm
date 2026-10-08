/** 情报检测记录（图文情报识别成果）：类型定义 */
declare namespace Api.Intel {
  /** 类别分布统计项（对应一期条款「数量、分布」） */
  interface ClassStat {
    /** 类别名（中文优先） */
    name: string;
    /** 该类别目标数 */
    count: number;
    /** 该类别最高置信度 */
    maxConf: number;
    /** 该类别平均置信度 */
    avgConf: number;
  }

  /** 情报记录 */
  interface IntelItem {
    id: number;
    name: string;
    /** catalog=目录数据直通检测 / upload=本地上传检测 */
    source: string;
    /** 源影像目录项 id */
    catalogId?: number;
    /** 检测模型注册名 */
    model: string;
    modelFile?: string;
    /** 源图宽（像素） */
    width?: number;
    /** 源图高（像素） */
    height?: number;
    /** 推理耗时（毫秒） */
    inferenceMs?: number;
    /** 目标总数 */
    detectionCount: number;
    /** 带外形轮廓的目标数 */
    polygonCount: number;
    /** 最高置信度 */
    maxConf?: number;
    /** 中文摘要 */
    summary?: string;
    /** 类别分布统计 */
    classStats: ClassStat[];
    /** 逐目标明细（仅详情接口返回） */
    detections?: Api.Vision.Detection[];
    /** 情报点经度 */
    longitude?: number;
    /** 情报点纬度 */
    latitude?: number;
    /** 入库时间 */
    createTime?: string;
    /** 情报图层地址（相对路径，可直接登记为数据服务） */
    geojsonUrl: string;
    /** 情报底图地址（相对路径） */
    imageUrl: string;
  }

  /** 保存情报请求（直接把检测结果回传，统计与锚点由服务端推导） */
  interface SavePayload {
    /** 情报名称；不填时服务端按摘要生成 */
    name?: string;
    source?: 'catalog' | 'upload';
    /** 源影像目录项 id（catalog 来源建议传，便于溯源与底图回退） */
    catalogId?: number;
    /** 情报点经度（目录项 bbox 中心） */
    longitude?: number;
    /** 情报点纬度 */
    latitude?: number;
    result: Api.Vision.DetectResult;
  }

  /** 分页查询条件 */
  interface PageQuery {
    current?: number;
    size?: number;
    name?: string;
  }

  /** 分页结果（MyBatis-Plus Page 结构） */
  type PageResult<T> = {
    records: T[];
    total: number;
    current: number;
    size: number;
  };
}
