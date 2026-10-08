<script setup lang="ts">
/**
 * 渡场勘察报告面板（演示）。
 *
 * 对应指标「读取无人机、无人船回传的勘察报告（内含图片），提取进出路通联、流速、
 * 河床断面、水位等数据，并支持基于大模型的报告及关联知识库的查询」。
 *
 * 演示动线：① 点「解析报告」→ 6 步解析进度依次亮起；② 四类提取要素卡逐项可展开，
 * 每项带置信度与原文出处；③ 河床断面按真实折线绘制（不依赖图片）；④ 报告附图为
 * 内联示意图；⑤ 报告问答走预设问答对，答案带引用出处；⑥ 一键把要素回填方案设置表单。
 *
 * 接入真实解析服务时，本文件无需改动：把 `@/mock/river-survey` 换成接口返回即可。
 */
import { computed, ref } from 'vue';
import { surveyParseSteps, surveyReport, surveyToFormPatch, type SurveyFieldKey } from '@/mock/river-survey';
import type { CrossingSettingForm } from './types';

defineOptions({ name: 'RiverSurveyPanel' });

defineProps<{ collapsed: boolean }>();

const emit = defineEmits<{
  'toggle-collapse': [];
  close: [];
  'apply-to-form': [patch: Partial<CrossingSettingForm>];
}>();

// ─── 解析进度（演示：逐条亮起） ─────────────────────
const parsedStep = ref(0);
const parsing = ref(false);

const parseDone = computed(() => parsedStep.value >= surveyParseSteps.length);

function handleParse(): void {
  if (parsing.value) return;
  parsing.value = true;
  parsedStep.value = 0;
  const timer = window.setInterval(() => {
    parsedStep.value += 1;
    if (parsedStep.value >= surveyParseSteps.length) {
      window.clearInterval(timer);
      parsing.value = false;
    }
  }, 260);
}

// ─── 要素卡展开 ────────────────────────────────────
const openField = ref<SurveyFieldKey | null>('access');

function toggleField(key: SurveyFieldKey): void {
  openField.value = openField.value === key ? null : key;
}

// ─── 报告问答（演示：预设问答对） ───────────────────
const openQa = ref<number | null>(0);

function toggleQa(index: number): void {
  openQa.value = openQa.value === index ? null : index;
}

// ─── 河床断面折线 ──────────────────────────────────
const SECTION_W = 480;
const SECTION_H = 132;
const SURFACE_Y = 14;
const PAD_X = 26;

/** 距离 → 横坐标 */
function scaleX(distance: number): number {
  return PAD_X + (distance / surveyReport.section.width) * (SECTION_W - PAD_X * 2);
}

/** 水深 → 纵坐标（水面为 0，向下为正） */
function scaleY(depth: number): number {
  return SURFACE_Y + (depth / surveyReport.section.maxDepth) * 96;
}

const bedPath = computed(() =>
  surveyReport.riverbedProfile
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${scaleX(point.distance).toFixed(1)},${scaleY(point.depth).toFixed(1)}`
    )
    .join(' ')
);

/** 河床填充区域（折线 + 底边闭合） */
const bedAreaPath = computed(
  () =>
    `${bedPath.value} L${scaleX(surveyReport.section.width).toFixed(1)},${SECTION_H - 8} L${scaleX(0).toFixed(1)},${SECTION_H - 8} Z`
);

const maxDepthX = computed(() => scaleX(surveyReport.section.maxDepthAt));
const maxDepthY = computed(() => scaleY(surveyReport.section.maxDepth));
</script>

<template>
  <div class="survey-panel">
    <!-- ══ 标题栏 ══ -->
    <div class="panel-header">
      <span class="header-title">渡场勘察报告</span>
      <div class="header-actions">
        <button type="button" class="action-btn" title="折叠" @click="emit('toggle-collapse')">
          <SvgIcon :icon="collapsed ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
        </button>
        <button type="button" class="action-btn" title="关闭" @click="emit('close')">
          <SvgIcon icon="mdi:close" />
        </button>
      </div>
    </div>

    <div v-show="!collapsed" class="panel-content">
      <!-- ══ 报告信息 ══ -->
      <div class="form-section">
        <div class="section-label section-label--report">
          报告信息
          <span class="section-tag">{{ surveyReport.id }}</span>
        </div>
        <div class="section-body">
          <p class="report-title">{{ surveyReport.title }}</p>

          <div class="kv-list">
            <div class="kv-row">
              <span class="kv-key">回传平台</span>
              <span class="kv-val">
                <span v-for="platform in surveyReport.platforms" :key="platform.model" class="platform-chip">
                  {{ platform.kind }}（{{ platform.model }}）
                </span>
              </span>
            </div>
            <div class="kv-row">
              <span class="kv-key">勘察时间</span>
              <span class="kv-val">{{ surveyReport.executedAt }} · {{ surveyReport.operator }}</span>
            </div>
            <div class="kv-row">
              <span class="kv-key">勘察区域</span>
              <span class="kv-val">{{ surveyReport.area }}</span>
            </div>
            <div class="kv-row">
              <span class="kv-key">报告体量</span>
              <span class="kv-val">
                {{ surveyReport.pageCount }} 页 · 内嵌图片 {{ surveyReport.figures.length }} 张
              </span>
            </div>
          </div>

          <div class="parse-actions">
            <button type="button" class="submit-btn" :disabled="parsing" @click="handleParse">
              <SvgIcon :icon="parseDone ? 'mdi:refresh' : 'mdi:file-search-outline'" />
              <span class="btn-text">{{ parsing ? '解析中…' : parseDone ? '重新解析' : '解析报告要素' }}</span>
            </button>
          </div>

          <!-- 解析进度 -->
          <ol v-if="parsedStep > 0" class="parse-steps">
            <li
              v-for="(step, index) in surveyParseSteps"
              :key="step.key"
              class="parse-step"
              :class="{
                'parse-step--done': index < parsedStep,
                'parse-step--running': index === parsedStep && parsing
              }"
            >
              <SvgIcon
                class="parse-step__icon"
                :icon="
                  index < parsedStep
                    ? 'mdi:check-circle-outline'
                    : index === parsedStep && parsing
                      ? 'mdi:loading'
                      : 'mdi:circle-outline'
                "
                :class="{ 'is-spin': index === parsedStep && parsing }"
              />
              <span class="parse-step__label">{{ step.label }}</span>
              <span class="parse-step__detail">{{ step.detail }}</span>
            </li>
          </ol>
        </div>
      </div>

      <template v-if="parseDone">
        <!-- ══ 提取要素（四类数据） ══ -->
        <div class="form-section">
          <div class="section-label section-label--extract">
            提取要素
            <span class="section-tag">
              {{ surveyReport.fields.length }} 类 / {{ surveyReport.extractSummary.split('）。')[0] }}
            </span>
          </div>
          <div class="section-body">
            <div v-for="field in surveyReport.fields" :key="field.key" class="field-card">
              <button type="button" class="field-card__head" @click="toggleField(field.key)">
                <span class="field-card__label">{{ field.label }}</span>
                <span class="field-card__value">
                  {{ field.value }}
                  <em v-if="field.unit">{{ field.unit }}</em>
                </span>
                <SvgIcon
                  class="field-card__chevron"
                  :icon="openField === field.key ? 'mdi:chevron-up' : 'mdi:chevron-down'"
                />
              </button>

              <div v-show="openField === field.key" class="field-card__body">
                <p class="field-card__detail">{{ field.detail }}</p>
                <ul class="item-list">
                  <li v-for="item in field.items" :key="item.label">
                    <span class="item-label">{{ item.label }}</span>
                    <span class="item-text">{{ item.text }}</span>
                  </li>
                </ul>
                <div class="field-card__foot">
                  <span class="confidence">提取置信度 {{ Math.round(field.confidence * 100) }}%</span>
                  <span class="source">出处：{{ field.source }}</span>
                </div>
              </div>
            </div>

            <button type="button" class="ghost-btn" @click="emit('apply-to-form', surveyToFormPatch)">
              <SvgIcon icon="mdi:arrow-collapse-down" />
              将要素回填到方案设置
            </button>
          </div>
        </div>

        <!-- ══ 河床断面 ══ -->
        <div class="form-section">
          <div class="section-label section-label--section">河床断面</div>
          <div class="section-body">
            <svg class="bed-svg" :viewBox="`0 0 ${SECTION_W} ${SECTION_H}`" preserveAspectRatio="none">
              <!-- 水面 -->
              <line :x1="PAD_X - 16" :y1="SURFACE_Y" :x2="SECTION_W - PAD_X + 16" :y2="SURFACE_Y" class="bed-water" />
              <text :x="PAD_X - 18" :y="SURFACE_Y + 4" class="bed-axis">水位 +1.8m</text>
              <!-- 河床填充与折线 -->
              <path :d="bedAreaPath" class="bed-area" />
              <path :d="bedPath" class="bed-line" />
              <!-- 最深点 -->
              <line :x1="maxDepthX" :y1="SURFACE_Y" :x2="maxDepthX" :y2="maxDepthY" class="bed-marker-line" />
              <circle :cx="maxDepthX" :cy="maxDepthY" r="3" class="bed-marker-dot" />
              <text :x="maxDepthX + 6" :y="maxDepthY + 4" class="bed-marker-text">最深 8.2m @ 210m</text>
              <!-- 两岸 -->
              <text :x="PAD_X" :y="SECTION_H - 2" class="bed-axis">西岸 0m</text>
              <text :x="SECTION_W - PAD_X - 26" :y="SECTION_H - 2" class="bed-axis">东岸 491m</text>
            </svg>

            <div class="kv-list kv-list--compact">
              <div class="kv-row">
                <span class="kv-key">河床质</span>
                <span class="kv-val">
                  {{ surveyReport.section.bedMaterial }} · 承载力 {{ surveyReport.section.bearingCapacity }}
                </span>
              </div>
              <div class="kv-row">
                <span class="kv-key">障碍物</span>
                <span class="kv-val">{{ surveyReport.section.obstacles }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ══ 报告附图 ══ -->
        <div class="form-section">
          <div class="section-label section-label--figure">报告附图</div>
          <div class="section-body">
            <div class="figure-grid">
              <figure v-for="figure in surveyReport.figures" :key="figure.id" class="figure">
                <div class="figure__canvas">
                  <!-- 无人机正射影像示意 -->
                  <svg v-if="figure.kind === 'ortho'" viewBox="0 0 160 96" class="figure__svg">
                    <rect width="160" height="96" class="fig-ground" />
                    <path
                      d="M-6 18 C 40 34, 70 52, 104 66 C 124 74, 146 80, 166 84 L166 96 L-6 96 Z"
                      class="fig-water"
                    />
                    <g class="fig-grid">
                      <line x1="40" y1="0" x2="40" y2="96" />
                      <line x1="80" y1="0" x2="80" y2="96" />
                      <line x1="120" y1="0" x2="120" y2="96" />
                      <line x1="0" y1="40" x2="160" y2="40" />
                      <line x1="0" y1="70" x2="160" y2="70" />
                    </g>
                    <rect x="26" y="34" width="12" height="12" class="fig-mark" />
                    <rect x="108" y="70" width="12" height="12" class="fig-mark" />
                    <line x1="38" y1="40" x2="108" y2="76" class="fig-route" />
                  </svg>

                  <!-- 断面测量示意 -->
                  <svg v-else-if="figure.kind === 'section'" viewBox="0 0 160 96" class="figure__svg">
                    <rect width="160" height="96" class="fig-ground" />
                    <line x1="0" y1="20" x2="160" y2="20" class="fig-surface" />
                    <path :d="bedPath" class="fig-bed" transform="translate(4,14) scale(0.315,0.62)" />
                    <text x="8" y="14" class="fig-label">无人船测线</text>
                  </svg>

                  <!-- 道路实景示意 -->
                  <svg v-else viewBox="0 0 160 96" class="figure__svg">
                    <rect width="160" height="96" class="fig-ground" />
                    <path d="M4 84 L52 84 L86 40 L156 40" class="fig-road" />
                    <path d="M4 92 L52 92 L86 48 L156 48" class="fig-road fig-road--edge" />
                    <circle cx="52" cy="84" r="5" class="fig-corner" />
                    <circle cx="86" cy="40" r="5" class="fig-corner" />
                    <text x="8" y="18" class="fig-label">2 处 90° 转弯</text>
                  </svg>
                </div>
                <figcaption class="figure__caption">
                  <span class="figure__name">{{ figure.name }}</span>
                  <span class="figure__meta">{{ figure.takenAt }} · {{ figure.caption }}</span>
                </figcaption>
              </figure>
            </div>
          </div>
        </div>

        <!-- ══ 报告问答 ══ -->
        <div class="form-section">
          <div class="section-label section-label--qa">
            报告与知识库问答
            <span class="section-tag">大模型 · 带引用</span>
          </div>
          <div class="section-body">
            <div v-for="(item, index) in surveyReport.qa" :key="item.question" class="qa-item">
              <button type="button" class="qa-question" @click="toggleQa(index)">
                <SvgIcon icon="mdi:comment-question-outline" />
                <span>{{ item.question }}</span>
                <SvgIcon class="qa-chevron" :icon="openQa === index ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
              </button>
              <div v-show="openQa === index" class="qa-answer">
                <p>{{ item.answer }}</p>
                <div class="qa-citations">
                  <span v-for="cite in item.citations" :key="cite" class="citation">
                    <SvgIcon icon="mdi:file-document-outline" />
                    {{ cite }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* 与渡河方案设置面板同一套外观（river-setting-panel.vue） */
.survey-panel {
  --sv-text-1: rgb(255 255 255 / 95%);
  --sv-text-2: rgb(255 255 255 / 84%);
  --sv-text-3: rgb(255 255 255 / 70%);
  --sv-text-4: rgb(255 255 255 / 56%);

  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 0;
  overflow: hidden;
}

/* ── 标题栏 ── */
.panel-header {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid rgb(255 255 255 / 6%);
}

.header-title {
  flex: 1;
  color: var(--sv-text-1);
  font-size: var(--font-xl);
  font-weight: 700;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: var(--sv-text-3);
  font-size: var(--font-xl);
  cursor: pointer;
  background: rgb(255 255 255 / 6%);
  border: none;
  border-radius: 6px;
  transition:
    background 0.18s,
    color 0.18s;
}

.action-btn:hover {
  color: var(--sv-text-1);
  background: rgb(43 107 255 / 15%);
}

/* ── 滚动区 ── */
.panel-content {
  flex: 1;
  min-height: 0;
  padding: 14px 16px 12px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgb(141 184 255 / 24%) transparent;
}

.panel-content::-webkit-scrollbar {
  width: 5px;
}

.panel-content::-webkit-scrollbar-thumb {
  background: rgb(141 184 255 / 24%);
  border-radius: 999px;
}

/* ── 分区 ── */
.form-section {
  margin-bottom: 12px;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 5%);
  border-radius: 10px;
}

.section-label {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  color: var(--sv-text-3);
  font-size: var(--font-sm);
  font-weight: 600;
  letter-spacing: 0.02em;
  background: rgb(255 255 255 / 2%);
  border-left: 2px solid rgb(93 140 200 / 45%);
}

.section-tag {
  margin-left: auto;
  color: var(--sv-text-4);
  font-size: var(--font-xs);
  font-weight: 400;
}

.section-body {
  padding: 10px 12px 12px;
}

.report-title {
  margin: 0 0 8px;
  color: var(--sv-text-1);
  font-size: var(--font-md);
  font-weight: 600;
}

/* ── 键值行 ── */
.kv-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kv-list--compact {
  margin-top: 10px;
}

.kv-row {
  display: flex;
  gap: 10px;
  font-size: var(--font-sm);
  line-height: 1.6;
}

.kv-key {
  flex: none;
  width: 68px;
  color: var(--sv-text-4);
}

.kv-val {
  flex: 1;
  color: var(--sv-text-2);
}

.platform-chip {
  display: inline-block;
  margin-right: 6px;
  padding: 0 6px;
  color: var(--sv-text-3);
  font-size: var(--font-xs);
  background: rgb(255 255 255 / 6%);
  border-radius: 5px;
}

/* ── 解析 ── */
.parse-actions {
  margin-top: 12px;
}

.submit-btn {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 9px 0;
  color: var(--sv-text-1);
  font-size: var(--font-sm);
  cursor: pointer;
  background: rgb(43 107 255 / 30%);
  border: 1px solid rgb(93 140 200 / 50%);
  border-radius: 7px;
  transition: background 0.18s;
}

.submit-btn:hover:not(:disabled) {
  background: rgb(43 107 255 / 42%);
}

.submit-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.btn-text {
  font-weight: 600;
}

.parse-steps {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.parse-step {
  display: flex;
  gap: 8px;
  align-items: baseline;
  color: var(--sv-text-4);
  font-size: var(--font-xs);
  transition: color 0.2s;
}

.parse-step--done {
  color: var(--sv-text-2);
}

.parse-step__icon {
  flex: none;
  align-self: center;
  font-size: var(--font-md);
}

.parse-step--done .parse-step__icon {
  color: #4f9e75;
}

.parse-step--running .parse-step__icon {
  color: #5d9bff;
}

.parse-step__label {
  flex: none;
}

.parse-step__detail {
  color: rgb(255 255 255 / 40%);
}

.is-spin {
  animation: survey-spin 1s linear infinite;
}

@keyframes survey-spin {
  to {
    transform: rotate(360deg);
  }
}

/* ── 要素卡 ── */
.field-card + .field-card {
  margin-top: 6px;
}

.field-card {
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 6%);
  border-radius: 8px;
}

.field-card__head {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
  padding: 8px 10px;
  cursor: pointer;
  background: rgb(255 255 255 / 3%);
  border: none;
}

.field-card__head:hover {
  background: rgb(255 255 255 / 6%);
}

.field-card__label {
  color: var(--sv-text-3);
  font-size: var(--font-sm);
}

.field-card__value {
  margin-left: auto;
  color: var(--sv-text-1);
  font-family: ui-monospace, consolas, monospace;
  font-size: var(--font-md);
  font-weight: 600;
}

.field-card__value em {
  margin-left: 4px;
  color: var(--sv-text-4);
  font-size: var(--font-xs);
  font-style: normal;
}

.field-card__chevron {
  color: var(--sv-text-4);
}

.field-card__body {
  padding: 9px 10px 10px;
  border-top: 1px solid rgb(255 255 255 / 5%);
}

.field-card__detail {
  margin: 0 0 7px;
  color: var(--sv-text-2);
  font-size: var(--font-sm);
  line-height: var(--font-lh-body);
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.item-list li {
  display: flex;
  gap: 8px;
  font-size: var(--font-xs);
  line-height: 1.7;
}

.item-label {
  flex: none;
  width: 78px;
  color: var(--sv-text-4);
}

.item-text {
  flex: 1;
  color: var(--sv-text-3);
}

.field-card__foot {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 8px;
  padding-top: 7px;
  border-top: 1px dashed rgb(255 255 255 / 8%);
}

.confidence {
  color: #7fc9a1;
  font-size: var(--font-xs);
}

.source {
  color: var(--sv-text-4);
  font-size: var(--font-xs);
}

.ghost-btn {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin-top: 10px;
  padding: 8px 0;
  color: var(--sv-text-2);
  font-size: var(--font-sm);
  cursor: pointer;
  background: rgb(255 255 255 / 6%);
  border: none;
  border-radius: 7px;
  transition:
    background 0.18s,
    color 0.18s;
}

.ghost-btn:hover {
  color: var(--sv-text-1);
  background: rgb(255 255 255 / 10%);
}

/* ── 河床断面图 ── */
.bed-svg {
  display: block;
  width: 100%;
  height: 132px;
}

.bed-water {
  stroke: rgb(93 160 255 / 70%);
  stroke-width: 1;
  stroke-dasharray: 4 3;
}

.bed-axis {
  fill: rgb(255 255 255 / 45%);
  font-size: 9px;
}

.bed-area {
  fill: rgb(93 140 200 / 18%);
}

.bed-line {
  fill: none;
  stroke: #5d9bff;
  stroke-width: 1.6;
}

.bed-marker-line {
  stroke: rgb(255 208 130 / 55%);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

.bed-marker-dot {
  fill: #ffd082;
}

.bed-marker-text {
  fill: rgb(255 208 130 / 90%);
  font-size: 9px;
}

/* ── 附图 ── */
.figure-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.figure {
  margin: 0;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 6%);
  border-radius: 8px;
}

.figure__canvas {
  background: #0a1322;
}

.figure__svg {
  display: block;
  width: 100%;
  height: 96px;
}

.fig-ground {
  fill: #12203a;
}

.fig-water {
  fill: rgb(70 130 220 / 35%);
}

.fig-grid line {
  stroke: rgb(255 255 255 / 8%);
  stroke-width: 0.5;
}

.fig-mark {
  fill: #5d9bff;
  stroke: rgb(255 255 255 / 60%);
  stroke-width: 0.8;
}

.fig-route {
  stroke: rgb(255 208 130 / 85%);
  stroke-width: 1.2;
  stroke-dasharray: 3 2;
}

.fig-surface {
  stroke: rgb(93 160 255 / 70%);
  stroke-width: 1;
}

.fig-bed {
  fill: rgb(93 140 200 / 18%);
  stroke: #5d9bff;
  stroke-width: 2;
}

.fig-road {
  fill: none;
  stroke: rgb(255 255 255 / 70%);
  stroke-width: 3;
}

.fig-road--edge {
  stroke: rgb(255 255 255 / 25%);
  stroke-width: 1;
}

.fig-corner {
  fill: none;
  stroke: #ffd082;
  stroke-width: 1.4;
}

.fig-label {
  fill: rgb(255 255 255 / 60%);
  font-size: 9px;
}

.figure__caption {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 7px 10px 9px;
}

.figure__name {
  color: var(--sv-text-2);
  font-size: var(--font-sm);
}

.figure__meta {
  color: var(--sv-text-4);
  font-size: var(--font-xs);
  line-height: 1.5;
}

/* ── 报告问答 ── */
.qa-item + .qa-item {
  margin-top: 6px;
}

.qa-question {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
  padding: 8px 10px;
  color: var(--sv-text-2);
  font-size: var(--font-sm);
  text-align: left;
  cursor: pointer;
  background: rgb(255 255 255 / 3%);
  border: 1px solid rgb(255 255 255 / 6%);
  border-radius: 8px;
}

.qa-question:hover {
  color: var(--sv-text-1);
  background: rgb(255 255 255 / 6%);
}

.qa-chevron {
  margin-left: auto;
  color: var(--sv-text-4);
}

.qa-answer {
  padding: 9px 10px 10px;
  color: var(--sv-text-3);
  font-size: var(--font-xs);
  line-height: var(--font-lh-body);
}

.qa-answer p {
  margin: 0;
}

.qa-citations {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.citation {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 2px 7px;
  color: var(--sv-text-4);
  font-size: var(--font-xs);
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 5px;
}
</style>
