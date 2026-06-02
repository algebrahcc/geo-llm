<script setup lang="ts">
import { ref, watch } from 'vue';
import type { AiAnalysisStep, ChatMessage, CrossingSettingForm, KnowledgeHitDisplay } from './types';

const props = defineProps<{
  collapsed: boolean;
  running: boolean;
  form: CrossingSettingForm | null;
  steps: AiAnalysisStep[];
  knowledgeHits: KnowledgeHitDisplay[];
  references: string[];
  agentOnline: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-collapse'): void;
  (e: 'close'): void;
  (e: 'send-message', msg: string): void;
}>();

// ──── 区块折叠状态 ────
const sectionCollapsed = ref<Record<string, boolean>>({
  intro: false,
  params: false,
  progress: false,
  knowledge: false,
});

function toggleSection(key: string) {
  sectionCollapsed.value[key] = !sectionCollapsed.value[key];
}

// ──── 对话 ────
const chatInput = ref('');
const messages = ref<ChatMessage[]>([
  {
    id: 'welcome',
    role: 'assistant',
    content: '您好，我是渡河工程方案助手。基于您提供的要求参数，我将为您进行智能分析并生成最优渡河保障方案。',
    timestamp: Date.now()
  }
]);

const expandedKnowledge = ref<string | null>(null);
const capabilityTags = ['知识库检索', '方案材料导出', '地图标注'];

// ──── 参数回显列表 ────
const paramList = ref<Array<{ label: string; value: string }>>([]);

watch(
  () => props.form,
  form => {
    if (!form) {
      paramList.value = [];
      return;
    }
    paramList.value = [
      { label: '任务名称', value: form.taskName },
      { label: '渡河位置', value: form.location },
      { label: '任务类型', value: form.taskType },
      { label: '作战时间', value: form.actionTime },
      { label: '保障兵力', value: form.forceScale },
      { label: '河宽', value: `${form.riverWidth}m` },
      { label: '水深', value: form.waterDepthRange },
      { label: '流速', value: form.flowVelocity },
      { label: '河床地形', value: form.riverbedTerrain },
      { label: '天气条件', value: form.weatherCondition },
      { label: '能见度', value: `${form.visibilityKm} km` },
      { label: '时间约束', value: form.timeConstraint },
      { label: '其他要求', value: form.otherRequirements }
    ].filter(item => item.value && item.value !== '0' && item.value !== '0m' && item.value !== '0 km');
  },
  { immediate: true, deep: true }
);

// ──── 计算完成/总数 ────
const completedStepsCount = () => props.steps.filter(s => s.status === 'success').length;
const totalStepsCount = () => props.steps.length;

// ──── 发送消息 ────
function handleSend() {
  const text = chatInput.value.trim();
  if (!text) return;
  emit('send-message', text);
  messages.value.push({
    id: `user-${Date.now()}`,
    role: 'user',
    content: text,
    timestamp: Date.now()
  });
  chatInput.value = '';
}

function toggleKnowledgeHit(docName: string) {
  expandedKnowledge.value = expandedKnowledge.value === docName ? null : docName;
}

function getStepStatusIcon(status: AiAnalysisStep['status']) {
  if (status === 'success') return '✅';
  if (status === 'running') return '🔄';
  return '⏳';
}

function getStepStatusLabel(status: AiAnalysisStep['status']) {
  if (status === 'success') return '已完成';
  if (status === 'running') return '进行中';
  return '等待中';
}
</script>

<template>
  <div class="ai-panel" :class="{ 'ai-panel--collapsed': collapsed }">
    <!-- ── 标题栏 ── -->
    <div class="panel-header">
      <span class="header-icon">🤖</span>
      <span class="header-title">渡河工程方案助手</span>
      <span
        class="agent-status"
        :class="{ 'agent-status--online': agentOnline && !running, 'agent-status--busy': running }"
      >
        <span class="status-dot" />
        {{ running ? '分析中' : agentOnline ? '在线' : '离线' }}
      </span>
      <div class="header-actions">
        <button type="button" class="action-btn" title="折叠" @click="emit('toggle-collapse')">
          <SvgIcon :icon="collapsed ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
        </button>
        <button type="button" class="action-btn" title="关闭" @click="emit('close')">
          <SvgIcon icon="mdi:close" />
        </button>
      </div>
    </div>

    <!-- ── 内嵌工具栏：整体进度 ── -->
    <div v-if="totalStepsCount() > 0" class="analysis-toolbar">
      <div class="toolbar-progress">
        <span class="toolbar-label">分析进度</span>
        <div class="toolbar-bar">
          <div
            class="toolbar-fill"
            :style="{ width: `${(completedStepsCount() / totalStepsCount()) * 100}%` }"
          />
        </div>
        <span class="toolbar-count">{{ completedStepsCount() }}/{{ totalStepsCount() }}</span>
      </div>
    </div>

    <div v-show="!collapsed" class="panel-content">
      <!-- ══════ AI 介绍区 ══════ -->
      <div class="content-section">
        <div class="section-header-bar" @click="toggleSection('intro')">
          <span class="section-quick-icon">🧠</span>
          <span class="section-quick-title">关于助手</span>
          <SvgIcon
            class="section-chevron"
            :icon="sectionCollapsed.intro ? 'mdi:chevron-down' : 'mdi:chevron-up'"
          />
        </div>
        <div v-show="!sectionCollapsed.intro" class="section-body">
          <div class="intro-greeting">
            <span class="greeting-icon">💬</span>
            <span class="greeting-text">{{ messages[0]?.content }}</span>
          </div>
          <div class="capability-tags">
            <span v-for="tag in capabilityTags" :key="tag" class="cap-tag">
              {{ tag }}
            </span>
          </div>
        </div>
      </div>

      <!-- ══════ 输入参数回显 ══════ -->
      <div v-if="paramList.length > 0" class="content-section">
        <div class="section-header-bar" @click="toggleSection('params')">
          <span class="section-quick-icon">📝</span>
          <span class="section-quick-title">输入参数</span>
          <span class="section-badge">{{ paramList.length }}</span>
          <SvgIcon
            class="section-chevron"
            :icon="sectionCollapsed.params ? 'mdi:chevron-down' : 'mdi:chevron-up'"
          />
        </div>
        <div v-show="!sectionCollapsed.params" class="section-body section-body--compact">
          <div class="param-list">
            <div v-for="item in paramList" :key="item.label" class="param-item">
              <span class="param-label">{{ item.label }}</span>
              <span class="param-value">{{ item.value }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════ 智能体分析进度 ══════ -->
      <div v-if="steps.length > 0" class="content-section">
        <div class="section-header-bar" @click="toggleSection('progress')">
          <span class="section-quick-icon">📊</span>
          <span class="section-quick-title">分析过程</span>
          <span class="section-badge section-badge--accent">{{ completedStepsCount() }}/{{ totalStepsCount() }}</span>
          <SvgIcon
            class="section-chevron"
            :icon="sectionCollapsed.progress ? 'mdi:chevron-down' : 'mdi:chevron-up'"
          />
        </div>
        <div v-show="!sectionCollapsed.progress" class="section-body">
          <div class="step-list">
            <div
              v-for="(step, idx) in steps"
              :key="step.key"
              class="step-item"
              :class="{
                'step-item--running': step.status === 'running',
                'step-item--done': step.status === 'success'
              }"
            >
              <!-- 左侧圆点+连线 -->
              <div class="step-indicator">
                <div
                  class="step-dot"
                  :class="`step-dot--${step.status}`"
                >
                  <span v-if="step.status === 'success'" class="dot-check">✓</span>
                  <span v-else-if="step.status === 'running'" class="dot-spinner" />
                </div>
                <div
                  v-if="idx < steps.length - 1"
                  class="step-line"
                  :class="{ 'step-line--done': step.status === 'success' }"
                />
              </div>
              <!-- 内容 -->
              <div class="step-body">
                <div class="step-top">
                  <span class="step-label">{{ step.label }}</span>
                  <span class="step-status-tag" :class="`tag-${step.status}`">
                    {{ getStepStatusLabel(step.status) }}
                  </span>
                </div>
                <div v-if="step.tool" class="step-tool">🔧 调用：{{ step.tool }}</div>
                <div v-if="step.description" class="step-desc">{{ step.description }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════ 知识库检索结果 ══════ -->
      <div v-if="knowledgeHits.length > 0" class="content-section">
        <div class="section-header-bar" @click="toggleSection('knowledge')">
          <span class="section-quick-icon">📚</span>
          <span class="section-quick-title">知识库命中</span>
          <span class="section-badge section-badge--green">{{ knowledgeHits.length }}</span>
          <SvgIcon
            class="section-chevron"
            :icon="sectionCollapsed.knowledge ? 'mdi:chevron-down' : 'mdi:chevron-up'"
          />
        </div>
        <div v-show="!sectionCollapsed.knowledge" class="section-body">
          <div class="knowledge-list">
            <div
              v-for="hit in knowledgeHits"
              :key="hit.documentName"
              class="knowledge-card"
              :class="{ 'knowledge-card--expanded': expandedKnowledge === hit.documentName }"
            >
              <div class="knowledge-card-header" @click="toggleKnowledgeHit(hit.documentName)">
                <div class="doc-info">
                  <span class="doc-name">{{ hit.documentName }}</span>
                  <span class="doc-category">{{ hit.documentCategory }}</span>
                </div>
                <div class="doc-meta">
                  <span class="doc-format">{{ hit.documentFormat }}</span>
                  <span class="doc-match">{{ hit.matchCount }} 条</span>
                  <SvgIcon
                    class="doc-chevron"
                    :icon="expandedKnowledge === hit.documentName ? 'mdi:chevron-up' : 'mdi:chevron-down'"
                  />
                </div>
              </div>
              <div v-if="expandedKnowledge === hit.documentName" class="knowledge-card-body">
                <div v-for="(snippet, sIdx) in hit.topSnippets" :key="sIdx" class="snippet-item">
                  <div class="snippet-header">
                    <span class="snippet-title">{{ snippet.chunkTitle }}</span>
                    <span class="snippet-score-badge">{{ (snippet.score).toFixed(1) }}</span>
                  </div>
                  <div class="snippet-text">{{ snippet.snippet }}</div>
                  <div class="snippet-score-bar">
                    <div class="score-track">
                      <div class="score-fill" :style="{ width: `${snippet.score * 25}%` }" />
                    </div>
                    <span class="score-label">相关性 {{ (snippet.score * 25).toFixed(0) }}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════ 引用来源 ══════ -->
      <div v-if="references.length > 0" class="references-section">
        <div class="ref-label">🔗 引用来源</div>
        <div class="ref-tags">
          <span v-for="(ref, i) in references" :key="i" class="ref-tag" :class="{ 'ref-tag--doc': i < references.length - 2, 'ref-tag--sys': i >= references.length - 2 }">
            {{ ref }}
          </span>
        </div>
      </div>

      <!-- ══════ 对话消息 ══════ -->
      <div v-if="messages.length > 1" class="chat-messages">
        <div class="chat-divider"><span>对话记录</span></div>
        <div
          v-for="msg in messages.slice(1)"
          :key="msg.id"
          class="chat-msg"
          :class="`chat-msg--${msg.role}`"
        >
          <span class="msg-avatar">{{ msg.role === 'user' ? '👤' : '🤖' }}</span>
          <div class="msg-bubble" :class="`msg-bubble--${msg.role}`">
            {{ msg.content }}
          </div>
        </div>
      </div>
    </div>

    <!-- ══════ 对话输入 ══════ -->
    <div v-show="!collapsed" class="chat-input-area">
      <div class="chat-input-wrapper">
        <input
          v-model="chatInput"
          type="text"
          class="chat-input"
          placeholder="输入消息与助手对话..."
          @keyup.enter="handleSend"
        />
        <button type="button" class="send-btn" :disabled="!chatInput.trim()" @click="handleSend">
          <SvgIcon icon="mdi:send" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ──── 根布局 ──── */
.ai-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/* ──── 标题栏 ──── */
.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.header-icon {
  font-size: 18px;
}

.header-title {
  flex: 1;
  font-size: 14px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
}

.agent-status {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 999px;
  font-weight: 600;
  border: 1px solid transparent;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.agent-status--online {
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
  border-color: rgba(34, 197, 94, 0.25);
}

.agent-status--busy {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.25);
}

.header-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  font-size: 16px;
  transition: background 0.18s, color 0.18s;
}

.action-btn:hover {
  background: rgba(43, 107, 255, 0.15);
  color: rgba(255, 255, 255, 0.85);
}

/* ──── 分析工具栏 ──── */
.analysis-toolbar {
  padding: 8px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}

.toolbar-progress {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolbar-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
}

.toolbar-bar {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 2px;
  overflow: hidden;
}

.toolbar-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: 2px;
  transition: width 0.4s ease-out;
}

.toolbar-count {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.72);
  min-width: 24px;
  text-align: right;
}

/* ──── 滚动容器 ──── */
.panel-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 14px 10px;
  scrollbar-width: thin;
  scrollbar-color: rgba(141, 184, 255, 0.24) transparent;
}

.panel-content::-webkit-scrollbar {
  width: 5px;
}

.panel-content::-webkit-scrollbar-track {
  background: transparent;
}

.panel-content::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(141, 184, 255, 0.24);
}

/* ──── 区块 ──── */
.content-section {
  margin-bottom: 6px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 0.2s;
}

.content-section:hover {
  border-color: rgba(255, 255, 255, 0.1);
}

.section-header-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}

.section-header-bar:hover {
  background: rgba(43, 107, 255, 0.06);
}

.section-quick-icon {
  font-size: 14px;
}

.section-quick-title {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.76);
}

.section-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(141, 184, 255, 0.12);
  color: #8db8ff;
  font-weight: 600;
}

.section-badge--accent {
  background: rgba(43, 107, 255, 0.15);
  color: #4d8fff;
}

.section-badge--green {
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
}

.section-chevron {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.3);
  transition: transform 0.2s;
}

.section-body {
  padding: 8px 12px 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.section-body--compact {
  padding: 6px 12px 8px;
}

/* ──── 介绍区 ──── */
.intro-greeting {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 10px 12px;
  background: rgba(43, 107, 255, 0.06);
  border: 1px solid rgba(43, 107, 255, 0.1);
  border-radius: 10px;
  margin-bottom: 8px;
}

.greeting-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.greeting-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
  line-height: 1.65;
}

.capability-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cap-tag {
  font-size: 11px;
  padding: 3px 9px;
  border-radius: 8px;
  background: rgba(141, 184, 255, 0.08);
  color: #8db8ff;
  border: 1px solid rgba(141, 184, 255, 0.12);
  font-weight: 500;
}

/* ──── 参数列表 ──── */
.param-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px 12px;
}

.param-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 11px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.025);
}

.param-item:last-child {
  border-bottom: none;
}

.param-label {
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.param-value {
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
  text-align: right;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ──── 步骤列表（新设计：时间线风格） ──── */
.step-list {
  display: flex;
  flex-direction: column;
}

.step-item {
  display: flex;
  gap: 10px;
}

.step-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 22px;
  flex-shrink: 0;
}

.step-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  border: 2px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  transition: all 0.3s ease;
}

.step-dot--success {
  border-color: rgba(34, 197, 94, 0.5);
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.step-dot--running {
  border-color: rgba(59, 130, 246, 0.5);
  background: rgba(59, 130, 246, 0.12);
}

.dot-check {
  font-size: 10px;
  font-weight: 700;
}

.dot-spinner {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 2px solid #2b6bff;
  border-top-color: transparent;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.step-line {
  flex: 1;
  width: 2px;
  min-height: 18px;
  background: rgba(255, 255, 255, 0.08);
  margin: 4px 0;
}

.step-line--done {
  background: rgba(34, 197, 94, 0.25);
}

.step-body {
  flex: 1;
  padding: 2px 0 10px;
  min-width: 0;
}

.step-item:last-child .step-body {
  padding-bottom: 0;
}

.step-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.step-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.76);
  font-weight: 500;
  flex: 1;
}

.step-item--done .step-label {
  color: rgba(255, 255, 255, 0.6);
}

.step-item--running .step-label {
  color: rgba(255, 255, 255, 0.88);
  font-weight: 600;
}

.step-status-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 6px;
  font-weight: 600;
  flex-shrink: 0;
}

.tag-success {
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
}

.tag-running {
  background: rgba(59, 130, 246, 0.1);
  color: #60a5fa;
}

.tag-waiting {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.3);
}

@keyframes tagPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

.step-tool {
  font-size: 11px;
  color: #8db8ff;
  margin-top: 2px;
}

.step-desc {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.42);
  margin-top: 2px;
  line-height: 1.5;
}

/* ──── 知识库卡片 ──── */
.knowledge-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.knowledge-card {
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.knowledge-card:hover {
  border-color: rgba(43, 107, 255, 0.3);
}

.knowledge-card--expanded {
  border-color: rgba(59, 130, 246, 0.3);
}

.knowledge-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.02);
  transition: background 0.15s;
  gap: 8px;
}

.knowledge-card-header:hover {
  background: rgba(43, 107, 255, 0.05);
}

.doc-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.doc-name {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.84);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-category {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
}

.doc-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.doc-format {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(141, 184, 255, 0.1);
  color: #8db8ff;
}

.doc-match {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
}

.doc-chevron {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.3);
}

.knowledge-card-body {
  padding: 6px 10px 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.snippet-item {
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.035);
}

.snippet-item:last-child {
  border-bottom: none;
}

.snippet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
  gap: 8px;
}

.snippet-title {
  font-size: 11px;
  font-weight: 600;
  color: #8db8ff;
}

.snippet-score-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(43, 107, 255, 0.12);
  color: #4d8fff;
  font-weight: 600;
  flex-shrink: 0;
}

.snippet-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.55;
  margin-bottom: 4px;
}

.snippet-score-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.score-track {
  flex: 1;
  height: 3px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 2px;
  overflow: hidden;
}

.score-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: 2px;
  transition: width 0.4s ease-out;
}

.score-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
  white-space: nowrap;
}

/* ──── 引用来源 ──── */
.references-section {
  margin-top: 6px;
  padding: 8px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.ref-label {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 6px;
}

.ref-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.ref-tag {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 5px;
  border: 1px solid transparent;
  font-weight: 500;
}

.ref-tag--doc {
  background: rgba(245, 158, 11, 0.08);
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.15);
}

.ref-tag--sys {
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.4);
  border-color: rgba(255, 255, 255, 0.06);
}

/* ──── 对话消息 ──── */
.chat-messages {
  margin-top: 2px;
}

.chat-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 0 6px;
}

.chat-divider::before,
.chat-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
}

.chat-divider span {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.chat-msg {
  display: flex;
  gap: 8px;
  padding: 5px 0;
  align-items: flex-start;
}

.chat-msg--user {
  flex-direction: row-reverse;
}

.msg-avatar {
  font-size: 18px;
  flex-shrink: 0;
  line-height: 1;
}

.msg-bubble {
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 10px;
  max-width: 80%;
  line-height: 1.5;
}

.msg-bubble--assistant {
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.7);
  border-top-left-radius: 2px;
}

.msg-bubble--user {
  background: rgba(43, 107, 255, 0.14);
  color: rgba(255, 255, 255, 0.88);
  border-top-right-radius: 2px;
}

/* ──── 输入区 ──── */
.chat-input-area {
  padding: 10px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
  background: rgba(15, 20, 35, 0.95);
}

.chat-input-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
}

.chat-input {
  flex: 1;
  padding: 9px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.88);
  font-size: 12px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.chat-input::placeholder {
  color: rgba(255, 255, 255, 0.28);
}

.chat-input:focus {
  border-color: rgba(43, 107, 255, 0.5);
  box-shadow: 0 0 0 2px rgba(43, 107, 255, 0.08);
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: none;
  border-radius: 10px;
  background: #3b82f6;
  color: #fff;
  cursor: pointer;
  font-size: 16px;
  transition: opacity 0.18s, transform 0.12s;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: scale(1.04);
}

.send-btn:active:not(:disabled) {
  transform: scale(0.96);
}

.send-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
