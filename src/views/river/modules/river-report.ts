/**
 * 渡河工程保障方案报告：由当前任务数据生成一份可汇报、可存档的 HTML 文档。
 *
 * 对应指标「生成的报告或方案遵循标准模板（含文字说明、矢量地图附图），可用于会议
 * 汇报或存档」：
 *   - **标准模板**：封面（标题/任务/时间/单位）→ 任务概况 → 渡场勘察数据 →
 *     渡场筛选结果 → 推荐方案要点 → 附图 → 数据来源声明，固定章节顺序；
 *   - **文字说明**：各章节均为结构化文字与表格，不依赖交互；
 *   - **矢量地图附图**：把当前三维视角截取的画布图嵌进文档（矢量标绘已渲染在球面上）；
 *   - **可汇报可存档**：文档自带打印样式，浏览器「打印 → 另存为 PDF」即得 A4 版式文件。
 *
 * 刻意产出 HTML 而非 docx/pdf：项目当前没有 docx/jspdf 依赖，引入会显著增大体积；
 * 而浏览器打印链路零依赖、版式可控，且 HTML 本身即可存档（本地打开无需软件）。
 */
import type { CrossingPlanCard, CrossingSettingForm } from './types';
import type { SurveyReport } from '@/mock/river-survey';

export interface RiverReportInput {
  form: CrossingSettingForm;
  survey: SurveyReport;
  /** 候选渡场（含筛选依据）；为空时报告仍可生成，仅略过该章节 */
  plans: CrossingPlanCard[];
  /** 地图附图（PNG dataURL）；为 null 时该章节给出"未取到画面"的说明 */
  mapImage: string | null;
  generatedAt: Date;
  /** 生成单位（演示固定值，接入后可由登录用户所属单位带出） */
  unit?: string;
}

/** 工程量与兵力概算（演示按河宽与兵力规模派生，便于替换为真实计算） */
export interface RiverWorkload {
  /** 门桥/浮桥展开长度（m） */
  spanMeters: number;
  /** 桥节数（按单节 6.7m 估算） */
  sections: number;
  /** 需清障的抛石护岸长度（m） */
  clearingMeters: number;
  /** 作业分队编成 */
  teams: Array<{ name: string; strength: string; duty: string }>;
}

/** 单节浮桥/门桥长度（m）：重型门桥器材的常见节长，用于估算节数 */
const SECTION_LENGTH_M = 6.7;

/** 兵力规模 → 作业分队编成（演示映射） */
const TEAM_PLAN: Record<string, Array<{ name: string; strength: string; duty: string }>> = {
  '1个连': [
    { name: '架桥分队', strength: '1 个排', duty: '门桥编组展开与对接' },
    { name: '操舟分队', strength: '1 个班', duty: '漕渡与舟艇驾驶' },
    { name: '引导勤务组', strength: '1 个班', duty: '进出路引导与交通管制' }
  ],
  '1个营': [
    { name: '架桥分队', strength: '2 个连', duty: '门桥编组展开、对接与锚定' },
    { name: '操舟分队', strength: '1 个连', duty: '漕渡、舟艇驾驶与水上救援' },
    { name: '引导勤务组', strength: '1 个排', duty: '进出路引导、交通管制与警戒' },
    { name: '技术保障组', strength: '1 个班', duty: '器材抢修与油料补给' }
  ]
};

/** 默认编成（兵力规模未匹配到时使用） */
const DEFAULT_TEAMS = [
  { name: '架桥分队', strength: '2 个连', duty: '门桥编组展开、对接与锚定' },
  { name: '操舟分队', strength: '1 个连', duty: '漕渡、舟艇驾驶与水上救援' },
  { name: '引导勤务组', strength: '1 个排', duty: '进出路引导、交通管制与警戒' },
  { name: '技术保障组', strength: '1 个班', duty: '器材抢修与油料补给' }
];

/**
 * 由任务参数派生工程量与兵力概算。
 *
 * 这些数字在演示里由河宽与兵力规模推出（而非写死），是为了让"改河宽 → 报告里的
 * 展开长度与节数跟着变"这件事在演示中成立；接入真实计算后替换本函数即可。
 */
export function deriveWorkload(form: CrossingSettingForm): RiverWorkload {
  const spanMeters = Math.max(0, Math.round(form.riverWidth));
  return {
    spanMeters,
    sections: Math.ceil(spanMeters / SECTION_LENGTH_M),
    // 勘察报告指出西岸 0~40m 为抛石护岸，需清障后方可下水
    clearingMeters: 40,
    teams: TEAM_PLAN[form.forceScale] ?? DEFAULT_TEAMS
  };
}

/** HTML 转义：任务名等来自用户输入，直接拼进文档会破坏版式甚至注入 */
function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 任务概况表 */
function renderTaskSection(form: CrossingSettingForm): string {
  const rows: Array<[string, string]> = [
    ['任务名称', form.taskName],
    ['渡河位置', form.location],
    ['任务类型', form.taskType],
    ['行动时间', form.actionTime],
    ['兵力规模', form.forceScale],
    ['河幅', `${form.riverWidth} m`],
    ['水深', form.waterDepthRange],
    ['流速', form.flowVelocity],
    ['河床性质', form.riverbedTerrain],
    ['气象条件', form.weatherCondition],
    ['能见度', `${form.visibilityKm} km`],
    ['敌情', form.strategicIntent],
    ['时限', form.timeConstraint],
    ['可用资源', form.availableResources.join('、') || '—'],
    ['其他要求', form.otherRequirements || '—']
  ];
  return `
    <section class="chapter">
      <h2>一、任务概况</h2>
      <table class="kv">
        <tbody>
          ${rows.map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`).join('')}
        </tbody>
      </table>
    </section>`;
}

/** 勘察数据章节 */
function renderSurveySection(survey: SurveyReport): string {
  const platforms = survey.platforms.map(p => `${p.kind}（${p.model}）`).join('、');
  return `
    <section class="chapter">
      <h2>二、渡场勘察数据</h2>
      <p class="lead">
        勘察报告：<b>${escapeHtml(survey.title)}</b>（${escapeHtml(survey.id)}）；来源：${escapeHtml(platforms)}；
        勘察时间 ${escapeHtml(survey.executedAt)}；区域：${escapeHtml(survey.area)}。
      </p>
      <table class="grid">
        <thead>
          <tr><th style="width:16%">要素</th><th style="width:24%">提取值</th><th>说明</th><th style="width:22%">出处</th></tr>
        </thead>
        <tbody>
          ${survey.fields
            .map(
              field => `<tr>
                <td>${escapeHtml(field.label)}</td>
                <td><b>${escapeHtml(field.value)}</b>${field.unit ? ` <span class="unit">${escapeHtml(field.unit)}</span>` : ''}</td>
                <td>${escapeHtml(field.detail)}</td>
                <td class="dim">${escapeHtml(field.source)}</td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </section>`;
}

/** 渡场筛选结果章节 */
function renderScreeningSection(plans: CrossingPlanCard[]): string {
  if (plans.length === 0) {
    return `
      <section class="chapter">
        <h2>三、渡场筛选结果</h2>
        <p class="lead">尚未执行渡场筛选，请先在系统中提交分析。</p>
      </section>`;
  }

  const blocks = plans
    .map(
      plan => `
      <div class="site">
        <div class="site-head">
          <span class="site-rank">方案${plan.rank}</span>
          <span class="site-name">${escapeHtml(plan.siteName ?? plan.title)}</span>
          <span class="site-priority ${plan.priority === '推荐' ? 'is-top' : ''}">${escapeHtml(plan.priority ?? '')}</span>
          <span class="site-score">综合评分 ${plan.totalScore ?? '—'}</span>
        </div>
        <p class="site-reason">
          推荐方式：<b>${escapeHtml(plan.title)}</b>。${escapeHtml(plan.scenario)}。
          预计用时 ${escapeHtml(plan.duration)}，渡河运力 ${escapeHtml(plan.capacity)}，安全性${escapeHtml(plan.safety)}。
        </p>
        ${
          plan.criteria?.length
            ? `<table class="grid">
                <thead><tr><th style="width:16%">筛选维度</th><th style="width:26%">勘察实测</th><th>对照结论</th><th style="width:10%">得分</th></tr></thead>
                <tbody>
                  ${plan.criteria
                    .map(
                      c =>
                        `<tr><td>${escapeHtml(c.label)}</td><td>${escapeHtml(c.value)}</td><td>${escapeHtml(c.verdict)}</td><td class="num">${c.score}</td></tr>`
                    )
                    .join('')}
                </tbody>
              </table>`
            : ''
        }
        <p class="site-duty"><b>机动路线：</b>${escapeHtml(plan.routeDesc)}</p>
      </div>`
    )
    .join('');

  const top = plans[0];
  return `
    <section class="chapter">
      <h2>三、渡场筛选结果</h2>
      <p class="lead">
        依据勘察报告与渡场适配规则，对 ${plans.length} 处候选渡场逐维度打分（河宽 / 流速窗口 / 水深 /
        河床承载 / 进出路通联 / 岸滩与遮蔽），推荐优先级如下。
      </p>
      ${blocks}
      <p class="conclusion">
        <b>筛选结论：</b>推荐使用「${escapeHtml(top.siteName ?? top.title)}」（综合评分 ${top.totalScore ?? '—'}），
        其余渡场作为备选与应急方案保留。
      </p>
    </section>`;
}

/** 方案要点章节（含工程量与兵力概算） */
function renderPlanSection(form: CrossingSettingForm, plans: CrossingPlanCard[], workload: RiverWorkload): string {
  const top = plans[0];
  return `
    <section class="chapter">
      <h2>四、渡河工程保障方案要点</h2>
      ${
        top
          ? `<p class="lead">
               选定渡场：<b>${escapeHtml(top.siteName ?? top.title)}</b>；实施方式：<b>${escapeHtml(top.title)}</b>；
               预计用时 ${escapeHtml(top.duration)}；渡河运力 ${escapeHtml(top.capacity)}。
             </p>
             <p><b>关键装备：</b>${top.keyEquipment.map(escapeHtml).join('、')}。</p>
             <p><b>有利条件：</b>${top.advantages.map(escapeHtml).join('；')}。</p>
             <p><b>主要风险：</b>${top.risks.map(escapeHtml).join('；')}。</p>
             <p><b>适用条件：</b>${top.conditions.map(escapeHtml).join('；')}。</p>`
          : '<p class="lead">尚未生成方案。</p>'
      }

      <h3>4.1 工程量概算</h3>
      <table class="grid">
        <thead><tr><th style="width:34%">项目</th><th style="width:26%">数量</th><th>说明</th></tr></thead>
        <tbody>
          <tr><td>门桥/浮桥展开长度</td><td class="num">${workload.spanMeters} m</td><td>按河幅实测值展开</td></tr>
          <tr><td>桥节数</td><td class="num">${workload.sections} 节</td><td>按单节 ${SECTION_LENGTH_M} m 估算</td></tr>
          <tr><td>近岸清障</td><td class="num">${workload.clearingMeters} m</td><td>西岸抛石护岸，需清障后下水</td></tr>
          <tr><td>进出路整修</td><td class="num">2 处</td><td>东岸出口 2 处 90° 转弯需引导与路面加固</td></tr>
        </tbody>
      </table>

      <h3>4.2 兵力分配</h3>
      <table class="grid">
        <thead><tr><th style="width:24%">编组</th><th style="width:18%">兵力</th><th>任务</th></tr></thead>
        <tbody>
          ${workload.teams
            .map(
              t =>
                `<tr><td>${escapeHtml(t.name)}</td><td>${escapeHtml(t.strength)}</td><td>${escapeHtml(t.duty)}</td></tr>`
            )
            .join('')}
        </tbody>
      </table>
      <p class="dim">按 ${escapeHtml(form.forceScale)} 规模编成，实际以现场指挥员命令为准。</p>

      <h3>4.3 实施流程</h3>
      <table class="grid">
        <thead><tr><th style="width:14%">时序</th><th style="width:26%">阶段</th><th>主要作业</th></tr></thead>
        <tbody>
          <tr><td>T-90min</td><td>勘察与准备</td><td>复核水位流速、展开器材、清障下水点、进出路引导就位</td></tr>
          <tr><td>T-30min</td><td>编组展开</td><td>门桥编组下水对接，操舟分队就位，观察哨与警戒到位</td></tr>
          <tr><td>T0</td><td>漕渡开始</td><td>按平潮窗口开始漕渡，首批为侦察与先遣分队</td></tr>
          <tr><td>T+60min</td><td>连续漕渡</td><td>按批次往返，重装备优先，同步组织换乘与集结点管制</td></tr>
          <tr><td>T+150min</td><td>收尾与撤收</td><td>末批渡河后收拢器材，撤除引导勤务，恢复进出路通行</td></tr>
        </tbody>
      </table>
    </section>`;
}

/** 附图章节 */
function renderFigureSection(mapImage: string | null): string {
  return `
    <section class="chapter">
      <h2>五、矢量地图附图</h2>
      ${
        mapImage
          ? `<figure class="map-figure">
               <img src="${mapImage}" alt="渡场态势与标绘图" />
               <figcaption>图 1　渡场态势与方案标绘图（三维视角截图，含渡场、进出路与推荐路线标绘）</figcaption>
             </figure>`
          : `<p class="lead">未取到地图画面，请在三维场景中打开本报告以生成附图。</p>`
      }
    </section>`;
}

/** 生成完整报告 HTML */
export function buildRiverReportHtml(input: RiverReportInput): string {
  const { form, survey, plans, mapImage, generatedAt } = input;
  const unit = input.unit ?? '工程保障分队';
  const workload = deriveWorkload(form);
  const stamp = formatDateTime(generatedAt);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>渡河工程保障方案报告 - ${escapeHtml(form.taskName)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 24px 28px 40px;
    color: #1a1a1a; background: #f5f6f8;
    font-family: "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif;
    font-size: 13px; line-height: 1.75;
  }
  .sheet { max-width: 820px; margin: 0 auto; padding: 40px 44px 48px; background: #fff; box-shadow: 0 2px 16px rgb(0 0 0 / 12%); }
  .toolbar { max-width: 820px; margin: 0 auto 14px; display: flex; gap: 10px; justify-content: flex-end; }
  .toolbar button {
    padding: 8px 16px; font-size: 13px; cursor: pointer;
    color: #fff; background: #1e4b8f; border: none; border-radius: 6px;
  }
  .toolbar button.ghost { color: #1e4b8f; background: #fff; border: 1px solid #c3d0e2; }
  .cover { padding-bottom: 20px; border-bottom: 2px solid #1e4b8f; text-align: center; }
  .cover h1 { margin: 0 0 6px; font-size: 25px; letter-spacing: 4px; }
  .cover .sub { color: #55637a; font-size: 14px; letter-spacing: 1px; }
  .cover .meta { margin-top: 18px; display: flex; justify-content: center; gap: 34px; color: #55637a; font-size: 12.5px; }
  .chapter { margin-top: 26px; }
  h2 { margin: 0 0 10px; padding-left: 10px; font-size: 16px; border-left: 4px solid #1e4b8f; }
  h3 { margin: 18px 0 8px; font-size: 14px; color: #24344d; }
  p { margin: 6px 0; }
  .lead { color: #33415c; }
  .dim { color: #7a869a; font-size: 12px; }
  .unit { color: #7a869a; font-size: 12px; }
  .num { font-family: ui-monospace, consolas, monospace; text-align: right; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 4px; }
  th, td { padding: 6px 9px; text-align: left; vertical-align: top; border: 1px solid #d6dce6; }
  thead th { color: #24344d; background: #eef2f8; font-weight: 600; }
  table.kv th { width: 18%; color: #55637a; background: #f7f9fc; font-weight: 500; }
  .site { margin: 12px 0; padding: 12px 14px 14px; border: 1px solid #dbe2ec; border-radius: 6px; }
  .site-head { display: flex; gap: 10px; align-items: baseline; }
  .site-rank { color: #55637a; font-size: 12px; }
  .site-name { font-size: 15px; font-weight: 700; }
  .site-priority { padding: 1px 8px; color: #33415c; font-size: 12px; background: #eef2f8; border-radius: 4px; }
  .site-priority.is-top { color: #fff; background: #1e7a4f; }
  .site-score { margin-left: auto; color: #55637a; font-family: ui-monospace, consolas, monospace; font-size: 12px; }
  .site-reason, .site-duty { color: #33415c; }
  .conclusion { margin-top: 14px; padding: 10px 12px; background: #eef7f1; border-left: 4px solid #1e7a4f; }
  .map-figure { margin: 12px 0 0; }
  .map-figure img { width: 100%; border: 1px solid #d6dce6; }
  figcaption { margin-top: 6px; color: #55637a; font-size: 12px; text-align: center; }
  .foot { margin-top: 30px; padding-top: 12px; color: #7a869a; font-size: 11.5px; border-top: 1px solid #dbe2ec; }
  @media print {
    body { padding: 0; background: #fff; }
    .sheet { max-width: none; padding: 0; box-shadow: none; }
    .toolbar { display: none; }
    .chapter { break-inside: avoid; }
    .site { break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <button type="button" onclick="window.print()">打印 / 另存为 PDF</button>
    <button type="button" class="ghost" onclick="window.close()">关闭</button>
  </div>

  <div class="sheet">
    <div class="cover">
      <h1>渡河工程保障方案报告</h1>
      <div class="sub">${escapeHtml(form.taskName)}</div>
      <div class="meta">
        <span>生成单位：${escapeHtml(unit)}</span>
        <span>生成时间：${stamp}</span>
        <span>报告编号：RV-${generatedAt.getFullYear()}${String(generatedAt.getMonth() + 1).padStart(2, '0')}${String(generatedAt.getDate()).padStart(2, '0')}-01</span>
      </div>
    </div>

    ${renderTaskSection(form)}
    ${renderSurveySection(survey)}
    ${renderScreeningSection(plans)}
    ${renderPlanSection(form, plans, workload)}
    ${renderFigureSection(mapImage)}

    <div class="foot">
      说明：本报告由地理环境分析系统依据渡场勘察数据与渡场筛选规则自动生成；勘察数据来源于无人机与无人船回传的《${escapeHtml(survey.title)}》；
      工程量与兵力为概算值，实施前须经现地复核与指挥员批准。附图取自三维场景当前视角，矢量标绘已随图渲染。
    </div>
  </div>
</body>
</html>`;
}
