/** 视觉检测（YOLOv8 服务代理）：类型定义 */
declare namespace Api.Vision {
  /** 检测模型信息 */
  interface ModelInfo {
    /** 模型注册名，detect 的 model 参数取此值 */
    name: string;
    description: string;
    /** 权重是否已加载可用 */
    available: boolean;
  }

  /** 单个检测目标 */
  interface Detection {
    classId: number;
    /** 英文类别名，如 Tank */
    className: string;
    /** 中文类别名，如 坦克 */
    classNameZh: string;
    /** 置信度 0-1 */
    confidence: number;
    /** 原图像素坐标 [x1, y1, x2, y2] */
    bbox: number[];
    /**
     * 外形轮廓：[[x, y], ...] 归一化到 0-1（相对图幅宽高）。
     *
     * 归一化的意义：轮廓与分辨率解耦，前端叠加时按当前显示尺寸换算即可，
     * 换缩略图或原图都不必重新请求。未产出轮廓时缺省。
     */
    polygon?: number[][] | null;
    /** 轮廓来源：seg=分割模型掩膜；approx=检测框内近似（分割数据不可得时的退路） */
    polygonSource?: 'seg' | 'approx' | null;
  }

  /** 检测结果 */
  interface DetectResult {
    success: boolean;
    /** 模型注册名：road / military / obstacle */
    model: string;
    /** 权重文件名 */
    modelFile: string;
    width: number;
    height: number;
    /** 推理耗时（毫秒） */
    inferenceMs: number;
    /** 中文摘要，如「检测到 坦克×5」 */
    summary: string;
    /** 目标清单，按置信度降序 */
    detections: Detection[];
    /** 标注图 data URI（returnAnnotated=true 时返回） */
    annotatedImageBase64?: string | null;
  }

  /** 轮廓误差统计（两套口径之一） */
  interface ContourStat {
    /** 参与统计的目标对数 */
    samples: number;
    /** 平均误差（0-1）；无样本时为 null */
    mean_error: number | null;
    /** 中位误差（0-1）；无样本时为 null */
    median_error: number | null;
  }

  /** 离线评测报告（由 Python 评测模块产出，前端只读展示关键项） */
  interface EvalReport {
    /** 测试图像数 */
    images?: number;
    /** 命中 / 误检 / 漏检 */
    tp?: number;
    fp?: number;
    fn?: number;
    /** 目标类型判断准确率（0-1，要求 ≥0.9） */
    accuracy?: number;
    /** 分类别查准率/查全率 */
    per_class?: Record<string, { tp: number; fp: number; fn: number; precision: number; recall: number }>;
    /** 轮廓误差：IoU（面积型）口径 */
    contour_iou?: ContourStat;
    /** 轮廓误差：平均边界距离（形状型）口径 */
    contour_boundary?: ContourStat;
    /** 误差归因：真值类别被误认为哪类 */
    confusion?: Array<{ gt_class: string; pred_class: string; count: number }>;
    /** 阈值判定（准确率 ≥90%、轮廓误差 ≤20%） */
    thresholds?: {
      accuracy_required: number;
      accuracy_pass: boolean;
      contour_iou_required: number;
      contour_iou_pass: boolean;
      contour_boundary_required: number;
      contour_boundary_pass: boolean;
    };
  }

  /** 评测报告载荷 */
  interface EvalReportPayload {
    model: string;
    /** 是否已有评测结果（false 表示该模型尚未离线评测） */
    evaluated: boolean;
    report?: EvalReport | null;
  }

  /** 检测请求参数 */
  interface DetectParams {
    /** 模型：road=道路障碍物 / military=军事目标 */
    model?: string;
    /** 置信度阈值 0.01-1，默认 0.25 */
    conf?: number;
    /** 类别过滤：all / 逗号分隔类别 id */
    classes?: string;
    /** 是否返回标注图 base64 */
    returnAnnotated?: boolean;
  }
}
