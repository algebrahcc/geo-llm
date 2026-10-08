/**
 * 渡场勘察报告（演示数据）。
 *
 * 对齐考核指标里「读取无人机、无人船回传的勘察报告（内含图片），提取进出路通联、
 * 流速、河床断面、水位等数据」这一条：
 *   - 报告头：来源平台、时间、区域、页数与附图，对应"勘察报告"实体；
 *   - `fields`：就是要求提取的四类数据，字段结构按"可回填方案设置表单"设计，
 *     接真实解析服务时只需把这一份换成接口返回；
 *   - `riverbedProfile`：河床断面折线，前端据此画剖面图（不依赖图片资源）；
 *   - `qa`：报告问答的演示问答对，答案里带引用出处（接入大模型后由模型生成）。
 *
 * 数据刻意与 `mock/river.ts` 的表单默认值一致（河宽 491m、流速 0.8~1.8m/s、
 * 泥沙质），这样"报告 → 回填表单"在演示里是自洽的。
 */

/** 提取项：四类数据（进出路通联 / 流速 / 水位 / 河床断面） */
export type SurveyFieldKey = 'access' | 'velocity' | 'waterLevel' | 'riverbed';

export interface SurveyExtractedField {
  key: SurveyFieldKey;
  /** 提取项名称 */
  label: string;
  /** 主值（卡片大字） */
  value: string;
  /** 单位或补充量纲 */
  unit?: string;
  /** 结论性说明 */
  detail: string;
  /** 子项（逐条列出，如进出路分"进路/出路/通联"） */
  items: Array<{ label: string; text: string }>;
  /** 提取置信度（0~1，演示用；真实场景来自解析服务） */
  confidence: number;
  /** 原文出处（供"依据可追溯"展示） */
  source: string;
}

/** 报告附图（演示用示意图，前端按 kind 内联绘制，不依赖图片文件） */
export interface SurveyFigure {
  id: string;
  name: string;
  kind: 'ortho' | 'section' | 'road';
  caption: string;
  takenAt: string;
}

export interface SurveyReport {
  id: string;
  title: string;
  /** 回传平台 */
  platforms: Array<{ kind: '无人机' | '无人船'; model: string; task: string }>;
  executedAt: string;
  area: string;
  operator: string;
  pageCount: number;
  /** 报告体量描述（演示里体现在"读取了什么"） */
  extractSummary: string;
  fields: SurveyExtractedField[];
  /** 河床断面：距西岸距离(m) → 水深(m，正数表示水下深度) */
  riverbedProfile: Array<{ distance: number; depth: number }>;
  /** 断面辅助信息 */
  section: {
    width: number;
    maxDepth: number;
    maxDepthAt: number;
    bedMaterial: string;
    bearingCapacity: string;
    obstacles: string;
  };
  figures: SurveyFigure[];
  /** 报告问答（演示问答对；接入大模型后由模型按报告内容生成） */
  qa: Array<{ question: string; answer: string; citations: string[] }>;
}

/** 解析进度步骤（点"解析报告"后逐条亮起，对应真实场景的文档解析/要素抽取） */
export const surveyParseSteps = [
  { key: 'load', label: '读取报告文件', detail: 'PDF 12 页 · 内嵌图片 6 张' },
  { key: 'ocr', label: '版面还原与图文分离', detail: '识别表格 4 处、图注 6 处' },
  { key: 'access', label: '抽取进出路通联', detail: '匹配路网与桥涵限载信息' },
  { key: 'hydrology', label: '抽取水文要素', detail: '流速垂线分布 · 水位过程线' },
  { key: 'section', label: '抽取河床断面', detail: '断面折线转坐标序列' },
  { key: 'index', label: '要素入库与知识库挂接', detail: '生成 4 条结构化要素' }
] as const;

/**
 * 河床断面折线：淡水河关渡段，河宽 491m，最深 8.2m 出现在距西岸 210m 处。
 * 形状按"近岸浅、主槽深、东岸略陡"的典型感潮河段特征给出。
 */
const riverbedProfile: Array<{ distance: number; depth: number }> = [
  { distance: 0, depth: 0.4 },
  { distance: 25, depth: 1.6 },
  { distance: 50, depth: 2.4 },
  { distance: 75, depth: 3.1 },
  { distance: 100, depth: 4.0 },
  { distance: 125, depth: 5.2 },
  { distance: 150, depth: 6.4 },
  { distance: 175, depth: 7.5 },
  { distance: 200, depth: 8.1 },
  { distance: 210, depth: 8.2 },
  { distance: 225, depth: 8.0 },
  { distance: 250, depth: 7.4 },
  { distance: 275, depth: 6.6 },
  { distance: 300, depth: 5.8 },
  { distance: 325, depth: 5.1 },
  { distance: 350, depth: 4.4 },
  { distance: 375, depth: 3.8 },
  { distance: 400, depth: 3.2 },
  { distance: 425, depth: 2.6 },
  { distance: 450, depth: 2.0 },
  { distance: 470, depth: 1.4 },
  { distance: 491, depth: 0.8 }
];

export const surveyReport: SurveyReport = {
  id: 'SR-2026-0614-002',
  title: '淡水河关渡段渡场勘察报告',
  platforms: [
    { kind: '无人机', model: '多旋翼测绘机', task: '正射影像与岸滩地形采集' },
    { kind: '无人船', model: '单波束测量船', task: '水深测量与流速剖面' }
  ],
  executedAt: '2026-06-14 15:20',
  area: '淡水河关渡段（八里侧西岸 — 关渡侧东岸）',
  operator: '工程勘察分队',
  pageCount: 12,
  extractSummary: '报告 12 页，内嵌图片 6 张、表格 4 处；已抽取 4 类要素共 11 条数据',
  fields: [
    {
      key: 'access',
      label: '进出路通联',
      value: '进路可达 / 出路受限',
      detail: '西岸进路满足重装通行；东岸出口存在两处小半径转弯，需引导车',
      items: [
        {
          label: '进路（西岸）',
          text: '台15线 → 乡道，水泥路面宽 6.5m，40t 级车辆可通行，无桥涵限载，距渡场集结点 3.2km'
        },
        {
          label: '出路（东岸）',
          text: '中央北路 → 洲美快速道路，2 处 90° 转弯最小半径 12m，重装车辆需引导；路面宽 7.0m'
        },
        { label: '通联', text: '两岸公网覆盖良好；西岸滩地约 400m 范围信号弱，建议配中继' }
      ],
      confidence: 0.92,
      source: '§3.2 进出路通联分析（第 5—6 页）'
    },
    {
      key: 'velocity',
      label: '流速',
      value: '0.6 ~ 2.4',
      unit: 'm/s',
      detail: '平潮期 0.6~1.2 m/s，涨潮期可达 2.4 m/s，超门桥架设上限',
      items: [
        { label: '垂线分布', text: '表层 1.9 / 中层 1.4 / 底层 0.9 m/s（涨潮实测）' },
        { label: '平潮窗口', text: '0.6~1.2 m/s，持续约 90 分钟' },
        { label: '涨潮峰值', text: '2.4 m/s（超 2.0 m/s 时不宜架设门桥）' }
      ],
      confidence: 0.88,
      source: '§4.1 流速观测（第 7 页）'
    },
    {
      key: 'waterLevel',
      label: '水位',
      value: '+1.8',
      unit: 'm（黄海基准）',
      detail: '半日潮，最大潮差 2.9m；适宜作业窗口为平潮前后各 45 分钟',
      items: [
        { label: '勘察时水位', text: '+1.8m；近 24h 变幅 2.6m' },
        { label: '潮型', text: '半日潮，涨潮历时约 5h50m' },
        { label: '作业窗口', text: '06:00—07:30 平潮期（与预案开始时间吻合）' }
      ],
      confidence: 0.9,
      source: '§4.2 水位与潮位（第 8 页）'
    },
    {
      key: 'riverbed',
      label: '河床断面',
      value: '491 / 8.2',
      unit: 'm 宽 / m 深',
      detail: '主槽偏西岸一侧，河床为中砂夹淤泥，承载力 60kPa',
      items: [
        { label: '断面形态', text: '最深处距西岸 210m，水深 8.2m；两岸坡比 1:6 左右' },
        { label: '河床质', text: '中砂夹淤泥，承载力约 60kPa，适宜锚定与桥脚支撑' },
        { label: '障碍物', text: '西岸 0~40m 抛石护岸，高出河床约 0.8m，影响近岸舟桥下水' }
      ],
      confidence: 0.85,
      source: '§5.1 河床断面测量（第 9—10 页）'
    }
  ],
  riverbedProfile,
  section: {
    width: 491,
    maxDepth: 8.2,
    maxDepthAt: 210,
    bedMaterial: '中砂夹淤泥',
    bearingCapacity: '60kPa',
    obstacles: '西岸 0~40m 抛石护岸（高出河床约 0.8m）'
  },
  figures: [
    {
      id: 'fig-ortho',
      name: '渡场正射影像图',
      kind: 'ortho',
      caption: '覆盖渡场及两岸各 600m，可见西岸滩地与东岸码头',
      takenAt: '2026-06-14 15:26'
    },
    {
      id: 'fig-section',
      name: '河床断面测量图',
      kind: 'section',
      caption: '无人船走航测线，主槽最深 8.2m（距西岸 210m）',
      takenAt: '2026-06-14 15:48'
    },
    {
      id: 'fig-road',
      name: '东岸出口道路实景',
      kind: 'road',
      caption: '东岸中央北路出口，存在 90° 转弯与路面收窄段',
      takenAt: '2026-06-14 16:05'
    }
  ],
  qa: [
    {
      question: '进出路能否通行重装车辆？',
      answer:
        '西岸进路（台15线 → 乡道）路面宽 6.5m、无桥涵限载，40t 级车辆可正常通行；东岸出路存在 2 处最小半径 12m 的 90° 转弯，重装车辆需引导车先行，建议在方案中安排 1 组引导与交通管制。',
      citations: ['§3.2 进出路通联分析', '§3.4 道路实景照片（图 6）']
    },
    {
      question: '适宜渡河的时间窗口是什么？',
      answer:
        '该河段为半日潮、最大潮差 2.9m。平潮期流速 0.6~1.2 m/s、水位变幅小，是架设与航渡的适宜窗口；勘察结论给出 06:00—07:30（平潮前后各 45 分钟），与预案开始时间 06:00 吻合。',
      citations: ['§4.1 流速观测', '§4.2 水位与潮位']
    },
    {
      question: '河床条件对门桥架设有什么影响？',
      answer:
        '主槽最深 8.2m 位于距西岸 210m 处，河床为中砂夹淤泥、承载力约 60kPa，适合舟桥锚定与桥脚支撑；但西岸 0~40m 存在抛石护岸，高出河床约 0.8m，近岸下水与桥脚定位需避让或先行清障。',
      citations: ['§5.1 河床断面测量', '§5.3 障碍物说明']
    }
  ]
};

/** 报告要素 → 方案设置表单的可回填字段（演示里点"应用到方案设置"用） */
export const surveyToFormPatch = {
  riverWidth: surveyReport.section.width,
  waterDepthRange: '4~8m',
  flowVelocity: '0.6~2.4 m/s（平潮 0.6~1.2）',
  riverbedTerrain: '中砂夹淤泥（含抛石护岸）'
};
