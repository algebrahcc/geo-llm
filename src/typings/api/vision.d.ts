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
