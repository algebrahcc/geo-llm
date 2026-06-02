<script setup lang="ts">
import { ref } from 'vue';
import { planningRouteQuickTags } from '@/mock/planning';
import type { PlanningAnalysisStep, PlanningChatMessage } from './types';

defineOptions({
  name: 'PlanningRouteAiPanel'
});

interface Props {
  collapsed: boolean;
  running: boolean;
  steps: PlanningAnalysisStep[];
  progress: number;
  statusText: string;
  knowledgeHits?: { docCount: number; chunkCount: number; docNames: string[] } | null;
}

const props = withDefaults(defineProps<Props>(), {
  collapsed: false,
  running: false,
  progress: 0,
  statusText: ''
});

const emit = defineEmits<{
  toggleCollapse: [];
  send: [message: string];
}>();

const chatInput = ref('');
const messages = ref<PlanningChatMessage[]>([
  {
    id: 'route-welcome',
    role: 'assistant',
    content: '您好，我是机动规划AI助手。请设置左侧规划参数，我将为您智能规划最优机动路线。您也可以直接向我提问。'
  }
]);

function handleSend() {
  const text = chatInput.value.trim();
  if (!text) return;
  emit('send', text);
  messages.value.push({ id: `route-u-${Date.now()}`, role: 'user', content: text });
  chatInput.value = '';
}

function handleQuickAction(label: string) {
  const msg = `请${label}`;
  messages.value.push({ id: `route-q-${Date.now()}`, role: 'user', content: msg });
  emit('send', msg);
}

function getStatusIcon(step: PlanningAnalysisStep) {
  if (step.status === 'completed') return 'mdi:check-circle';
  if (step.status === 'running') return step.icon;
  return 'mdi:clock-outline';
}
</script>

<template>
  <div class="route-ai-panel" :class="{ 'route-ai-panel--collapsed': collapsed }">
    <!-- 标题栏 -->
    <div class="ai-header">
      <span class="ai-icon">🤖</span>
      <div class="ai-title-group">
        <span class="ai-title">AI智能助手</span>
        <span class="ai-subtitle">机动规划助手</span>
      </div>
      <span class="agent-status" :class="{ 'agent-status--online': !running, 'agent-status--busy': running }">
        <span class="status-dot" />
        {{ running ? '分析中' : '在线' }}
      </span>
      <button type="button" class="action-btn" title="折叠" @click="emit('toggleCollapse')">
        <SvgIcon :icon="collapsed ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
      </button>
    </div>

    <div v-show="!collapsed" class="ai-body">
      <!-- 欢迎语 -->
      <div class="greeting-box">
        <SvgIcon icon="mdi:robot-outline" class="greet-icon" />
        <span>{{ messages[0]?.content }}</span>
      </div>

      <!-- 快捷标签 -->
      <div class="action-tags">
        <button
          v-for="tag in planningRouteQuickTags"
          :key="tag.label"
          type="button"
          class="action-tag-btn"
          @click="handleQuickAction(tag.label)"
        >
          <SvgIcon :icon="tag.icon" />
          {{ tag.label }}
        </button>
      </div>

      <!-- 智能分析进度 -->
      <div class="analysis-section">
        <div class="analysis-title">智能分析进度（输出）</div>
        <div class="steps-list">
          <div
            v-for="(step, index) in steps"
            :key="step.id"
            class="step-item"
            :class="[`step-item--${step.status}`]"
          >
            <div class="step-line-wrap" v-if="index > 0">
              <div class="step-line" :class="{ 'step-line--active': step.status === 'completed' || step.status === 'running' }" />
            </div>
            <div class="step-node-row">
              <div class="step-circle" :class="`step-circle--${step.status}`">
                <SvgIcon :icon="getStatusIcon(step)" />
              </div>
              <div class="step-info">
                <span class="step-label">{{ step.label }}</span>
                <span class="step-status-text">
                  <template v-if="step.status === 'completed'">已完成</template>
                  <template v-else-if="step.status === 'running'">进行中...</template>
                  <template v-else>等待中</template>
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 进度条 -->
        <div class="progress-bar-wrap">
          <div class="progress-bar">
            <div class="progress-bar__fill" :style="{ width: `${progress}%` }" />
          </div>
          <span class="progress-percent">{{ progress }}%</span>
        </div>

        <!-- 状态文字 -->
        <div v-if="statusText" class="progress-status">{{ statusText }}</div>
      </div>

      <!-- 知识库命中提示 -->
      <div v-if="knowledgeHits" class="knowledge-badge">
        <SvgIcon icon="mdi:book-open-page-variant-outline" class="kb-icon" />
        <div class="kb-info">
          <span class="kb-title">知识库召回</span>
          <span class="kb-detail">
            命中 <strong>{{ knowledgeHits.docCount }}</strong> 篇文档
            （{{ knowledgeHits.docNames.slice(0, 2).join('、') }}<template v-if="knowledgeHits.docCount > 3"> 等</template>），
            共 <strong>{{ knowledgeHits.chunkCount }}</strong> 条知识片段
          </span>
        </div>
      </div>

      <!-- 对话消息区 -->
      <div v-if="messages.length > 1" class="chat-messages">
        <div v-for="msg in messages.slice(1)" :key="msg.id" class="chat-msg" :class="[`chat-msg--${msg.role}`]">
          <span class="msg-avatar">{{ msg.role === 'user' ? '👤' : '🤖' }}</span>
          <div class="msg-bubble" :class="[`msg-bubble--${msg.role}`]">{{ msg.content }}</div>
        </div>
      </div>
    </div>

    <!-- 输入区 -->
    <div v-show="!collapsed" class="chat-input-area">
      <input
        v-model="chatInput"
        type="text"
        class="chat-input"
        placeholder="输入问题..."
        @keyup.enter="handleSend"
      />
      <button type="button" class="send-btn" :disabled="!chatInput.trim()" @click="handleSend">
        <SvgIcon icon="mdi:send" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.route-ai-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.route-ai-panel--collapsed .ai-body,
.route-ai-panel--collapsed .chat-input-area {
  display: none;
}

/* 标题栏 */
.ai-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.01);
}

.ai-icon {
  font-size: 20px;
}

.ai-title-group {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.ai-title {
  font-size: 14px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
}

.ai-subtitle {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
}

.agent-status {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  padding: 3px 10px;
  border-radius: 999px;
  font-weight: 600;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.agent-status--online {
  background: rgba(34, 197, 94, 0.12);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.agent-status--online .status-dot {
  background: #4ade80;
  box-shadow: 0 0 5px rgba(34, 197, 94, 0.4);
  animation: pulse-dot 2s infinite;
}

.agent-status--busy {
  background: rgba(251, 191, 36, 0.12);
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.2);
  animation: glow 1.8s infinite;
}

.agent-status--busy .status-dot {
  background: #fbbf24;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@keyframes glow {
  0%, 100% { box-shadow: 0 0 6px rgba(251, 191, 36, 0.2); }
  50% { box-shadow: 0 0 16px rgba(251, 191, 36, 0.45); }
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover {
  background: rgba(99, 102, 241, 0.12);
  color: rgba(255, 255, 255, 0.85);
}

/* 内容区 */
.ai-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 14px 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(141, 184, 255, 0.15) transparent;
}

.ai-body::-webkit-scrollbar {
  width: 4px;
}

.ai-body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(141, 184, 255, 0.15);
}

/* 欢迎语 */
.greeting-box {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 10px;
  margin-bottom: 10px;
  background: rgba(99, 102, 241, 0.06);
  border: 1px solid rgba(99, 102, 241, 0.1);
  border-left: 2px solid #6366f1;
}

.greet-icon {
  font-size: 18px;
  flex-shrink: 0;
  color: #6366f1;
}

.greeting-box span:last-child {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
}

/* 快捷标签 */
.action-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 10px;
}

.action-tag-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border: 1px solid rgba(129, 140, 248, 0.18);
  border-radius: 8px;
  background: rgba(129, 140, 248, 0.06);
  color: #a5b4fc;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s ease;
}

.action-tag-btn:hover {
  background: rgba(129, 140, 248, 0.14);
  border-color: rgba(99, 102, 241, 0.35);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.15);
}

/* 分析进度区 */
.analysis-section {
  margin-bottom: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(41, 163, 255, 0.04);
  border: 1px solid rgba(41, 163, 255, 0.1);
}

.analysis-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.78);
  margin-bottom: 10px;
}

/* 步骤列表 */
.steps-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.step-item {
  display: flex;
  flex-direction: column;
}

.step-line-wrap {
  padding-left: 14px;
  height: 16px;
}

.step-line {
  width: 2px;
  height: 100%;
  background: rgba(41, 163, 255, 0.12);
  transition: background 0.3s ease;
}

.step-line--active {
  background: linear-gradient(180deg, #29b6ff, #2b6bff);
}

.step-node-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.step-circle {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 14px;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.step-circle--completed {
  background: rgba(41, 163, 255, 0.2);
  color: #29b6ff;
}

.step-circle--running {
  background: rgba(41, 163, 255, 0.25);
  color: #29b6ff;
  animation: pulse 1.5s ease-in-out infinite;
}

.step-circle--pending {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.35);
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(41, 163, 255, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(41, 163, 255, 0); }
}

.step-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.step-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
}

.step-item--completed .step-label {
  color: rgba(255, 255, 255, 0.88);
}

.step-item--running .step-label {
  color: #29b6ff;
  font-weight: 500;
}

.step-status-text {
  font-size: 10px;
}

.step-item--completed .step-status-text {
  color: #2ee59d;
}

.step-item--running .step-status-text {
  color: #29b6ff;
}

.step-item--pending .step-status-text {
  color: rgba(255, 255, 255, 0.35);
}

/* 进度条 */
.progress-bar-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: rgba(41, 163, 255, 0.12);
  overflow: hidden;
}

.progress-bar__fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #29b6ff 0%, #2b6bff 100%);
  transition: width 0.5s ease;
}

.progress-percent {
  font-size: 13px;
  font-weight: 600;
  color: #29b6ff;
  min-width: 36px;
  text-align: right;
}

.progress-status {
  margin-top: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

/* 知识库命中卡片 */
.knowledge-badge {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(41, 163, 255, 0.2);
  border-radius: 8px;
  background: rgba(41, 163, 255, 0.06);
}

.kb-icon {
  font-size: 18px;
  color: #29b6ff;
  flex-shrink: 0;
  margin-top: 1px;
}

.kb-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.kb-title {
  font-size: 12px;
  font-weight: 600;
  color: #29b6ff;
}

.kb-detail {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.58);
  line-height: 1.5;
}

.kb-detail strong {
  color: rgba(255, 255, 255, 0.82);
  font-weight: 600;
}

/* 对话消息 */
.chat-messages {
  margin-top: 6px;
}

.chat-msg {
  display: flex;
  gap: 8px;
  padding: 4px 0;
  align-items: flex-start;
  animation: msg-in 0.2s ease;
}

@keyframes msg-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.chat-msg--user {
  flex-direction: row-reverse;
}

.msg-avatar {
  font-size: 16px;
  flex-shrink: 0;
  line-height: 1;
}

.msg-bubble {
  font-size: 12px;
  padding: 7px 11px;
  border-radius: 10px;
  max-width: 80%;
  line-height: 1.5;
}

.msg-bubble--assistant {
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.65);
  border-top-left-radius: 2px;
}

.msg-bubble--user {
  background: rgba(99, 102, 241, 0.15);
  color: rgba(255, 255, 255, 0.9);
  border-top-right-radius: 2px;
}

/* 输入区 */
.chat-input-area {
  padding: 10px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  gap: 8px;
  align-items: center;
}

.chat-input {
  flex: 1;
  padding: 9px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.88);
  font-size: 12px;
  outline: none;
  transition: all 0.2s;
}

.chat-input::placeholder {
  color: rgba(255, 255, 255, 0.22);
}

.chat-input:focus {
  border-color: rgba(99, 102, 241, 0.45);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.08);
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  color: #fff;
  cursor: pointer;
  font-size: 15px;
  transition: all 0.15s;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  opacity: 0.92;
  transform: scale(1.04);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.send-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.send-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
</style>
