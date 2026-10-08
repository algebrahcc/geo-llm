/**
 * 研判报告与决策日志导出（条款 (9)：支撑生成地形要图或地形分析报告）
 *
 * 报告由规则结论拼装、大模型叙述作为「模型归纳与质疑」单列一段：
 * 这样即使没有配置模型通道，报告依然完整可用；有模型时也不会把模型的话
 * 混进实测结论里，评审时能分清哪句是算出来的、哪句是模型讲的。
 */

import type { DecisionLogEntry, JudgementItem, SituationBrief } from './situation-brief';

export interface ReportMetrics {
  /** 规则通道耗时（毫秒） */
  ruleMs: number;
  /** 模型通道耗时（毫秒）；未跑为 null */
  llmMs: number | null;
  /** 引用命中率（可追溯性） */
  citation: number;
  /** 与规则基线的一致率；模型未返回结构化结论时为 null */
  agreement: number | null;
}

export interface SituationReportInput {
  brief: SituationBrief;
  items: JudgementItem[];
  narrative: string;
  metrics: ReportMetrics;
  log: DecisionLogEntry[];
}

const TOPIC_LABEL: Record<JudgementItem['topic'], string> = {
  passability: '通过性判定',
  'critical-node': '关键节点',
  risk: '断堵卡风险',
  bypass: '临机开设通路'
};

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function topicTable(items: JudgementItem[], topic: JudgementItem['topic']): string {
  const rows = items.filter(item => item.topic === topic);
  if (rows.length === 0) return '<p class="empty">无</p>';
  return [
    '<table><thead><tr><th>目标</th><th>等级</th><th>结论</th><th>依据要素</th><th>置信度</th></tr></thead><tbody>',
    ...rows.map(
      item =>
        `<tr><td>${escapeHtml(item.targetId)}</td><td>${escapeHtml(item.level)}</td><td>${escapeHtml(
          item.conclusion
        )}</td><td>${escapeHtml(item.evidenceIds.join('、') || '—')}</td><td>${item.confidence.toFixed(2)}</td></tr>`
    ),
    '</tbody></table>'
  ].join('');
}

/** 生成可直接打印/导出的分析报告（含选区条件、四类结论、质效读数与决策日志） */
export function buildSituationReportHtml(input: SituationReportInput): string {
  const { brief, metrics } = input;
  const [minLon, minLat, maxLon, maxLat] = brief.region.bounds;
  const topics: Array<JudgementItem['topic']> = ['passability', 'critical-node', 'risk', 'bypass'];

  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8" /><title>战场环境分析研判报告</title>
<style>
  body { font-family: "Microsoft YaHei", sans-serif; margin: 32px; color: #1f2933; }
  h1 { font-size: 20px; } h2 { font-size: 15px; margin-top: 22px; border-left: 3px solid #2ba3ff; padding-left: 8px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; margin-top: 6px; }
  th, td { border: 1px solid #d7dee6; padding: 4px 6px; text-align: left; }
  th { background: #f2f6fa; }
  .meta { font-size: 12px; color: #52606d; }
  .empty { font-size: 12px; color: #7b8794; }
  .narrative { font-size: 13px; line-height: 1.7; white-space: pre-wrap; background: #f7f9fb; padding: 10px; border-radius: 4px; }
</style></head>
<body>
<h1>战场环境分析研判报告</h1>
<p class="meta">研判区：${escapeHtml(brief.region.name)}　范围：[${minLon.toFixed(4)}, ${minLat.toFixed(4)}, ${maxLon.toFixed(
    4
  )}, ${maxLat.toFixed(4)}]　面积：${brief.region.areaKm2} km²</p>
<p class="meta">车辆类型：${escapeHtml(brief.vehicle.label)}　参与研判要素：${brief.evidences.length} 个${
    brief.truncated ? '（已截断）' : ''
  }　生成时间：${new Date().toLocaleString('zh-CN', { hour12: false })}</p>

<h2>一、结论汇总</h2>
${topics.map(topic => `<h3 style="font-size:13px">${TOPIC_LABEL[topic]}</h3>${topicTable(input.items, topic)}`).join('')}

<h2>二、模型归纳与质疑</h2>
<div class="narrative">${input.narrative ? escapeHtml(input.narrative) : '未启用模型通道（仅规则结论）。'}</div>

<h2>三、质效读数</h2>
<table><tbody>
<tr><th>规则通道耗时</th><td>${metrics.ruleMs} ms</td></tr>
<tr><th>模型通道耗时</th><td>${metrics.llmMs === null ? '—' : `${metrics.llmMs} ms`}</td></tr>
<tr><th>引用命中率</th><td>${(metrics.citation * 100).toFixed(1)}%</td></tr>
<tr><th>与规则基线一致率</th><td>${metrics.agreement === null ? '模型未返回结构化结论' : `${(metrics.agreement * 100).toFixed(1)}%`}</td></tr>
</tbody></table>

<h2>四、决策日志</h2>
<table><thead><tr><th>时间</th><th>触发条件</th><th>结论数</th><th>引用命中率</th><th>复核状态</th></tr></thead><tbody>
${input.log
  .map(
    entry =>
      `<tr><td>${entry.time}</td><td>${escapeHtml(entry.trigger)}</td><td>${entry.conclusionCount}</td><td>${(
        entry.citationHitRate * 100
      ).toFixed(
        1
      )}%</td><td>${entry.reviewed === 'pending' ? '待复核' : entry.reviewed === 'accepted' ? '已采纳' : '已否决'}</td></tr>`
  )
  .join('')}
</tbody></table>
<p class="meta">说明：数值型结论（通过性、关键节点、风险等级、适宜等级）均由图论/几何规则算出，可复算；
模型输出仅作为归纳与质疑，人工复核后方可进入方案。</p>
</body></html>`;
}

/** 决策日志导出为 Markdown（便于随方案归档） */
export function buildDecisionLogMarkdown(entries: DecisionLogEntry[]): string {
  const lines = [
    '# 研判决策日志',
    '',
    '| 时间 | 触发条件 | 区域 | 车辆 | 结论数 | 引用命中率 | 复核状态 |',
    '|---|---|---|---|---|---|---|'
  ];
  entries.forEach(entry => {
    const review = entry.reviewed === 'pending' ? '待复核' : entry.reviewed === 'accepted' ? '已采纳' : '已否决';
    lines.push(
      `| ${entry.time} | ${entry.trigger} | ${entry.region} | ${entry.vehicle} | ${entry.conclusionCount} | ${(
        entry.citationHitRate * 100
      ).toFixed(1)}% | ${review} |`
    );
  });
  return `${lines.join('\n')}\n`;
}

/** 下载文本文件（报告/日志导出共用） */
export function downloadText(filename: string, content: string, mime = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
