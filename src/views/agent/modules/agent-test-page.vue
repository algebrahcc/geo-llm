<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useThemeStore } from '@/store/modules/theme';
import SvgIcon from '@/components/custom/svg-icon.vue';
import AgentSidebar from './agent-sidebar.vue';
import AgentConversationSidebar from './agent-conversation-sidebar.vue';
import { useAgentSelection } from './use-agent';
import { useDifyApps } from './use-dify-app';
import { useAuthStore } from '@/store/modules/auth';
import { useAgentChat } from './use-agent-chat';
import MarkdownIt from 'markdown-it';

defineOptions({
  name: 'AgentTestPage'
});

/** AI 回答 markdown 渲染（html:false 防 XSS） */
const md = new MarkdownIt({ html: false, linkify: true, breaks: true });
function renderMarkdown(text: string): string {
  return md.render(text);
}

const route = useRoute();
const router = useRouter();
const themeStore = useThemeStore();
const darkMode = computed(() => themeStore.darkMode);
const { resolveAgent, agentList, loading: agentLoading } = useDifyApps();
const { agentKey, selectedAgent, updateAgentQuery } = useAgentSelection(route, router, resolveAgent, agentList);
const authStore = useAuthStore();
const userId = computed(() => String(authStore.userInfo.userId ?? ''));
const activeAgentKey = computed(() => selectedAgent.value.key || agentKey.value);
/** 当前智能体的本地 dify_app 主键 id（雪花 Long 序列化为字符串，必须保留字符串避免精度丢失） */
const currentAppId = computed(() => activeAgentKey.value || undefined);

const {
  testing,
  uploadFiles,
  streamOutput,
  streamEvents,
  prompt,
  messages,
  messageArea,
  reasoningPanelClosed,
  currentConversationId,
  inputFocused,
  conversationList,
  conversationLoading,
  isWorkflow,
  parameterFields,
  fileCapability,
  quickPrompts,
  copyMessage,
  getFieldStringValue,
  getFieldNumberValue,
  getFieldSelectValue,
  getFieldSwitchValue,
  updateFieldValue,
  handleLocalFileChange,
  handleLocalFileRemove,
  removeConversation,
  applyRenamed,
  switchConversation,
  newConversation,
  clearChat,
  handleStop,
  handleRun
} = useAgentChat({ agentKey, selectedAgent, currentAppId, userId });

function handleSelect(key: typeof agentKey.value) {
  updateAgentQuery(key);
}
</script>

<template>
  <div class="agent-test-page-root">
    <div class="agent-domain-page" :class="{ 'agent-domain-page--dark': darkMode }">
      <div class="agent-shell">
        <aside class="agent-sidebar panel-surface">
          <AgentSidebar :active-key="agentKey" :agents="agentList" :loading="agentLoading" @select="handleSelect" />
        </aside>

        <section class="agent-main">
          <!-- 对话型主区：底部固定输入框 + 气泡流 -->
          <div v-if="!isWorkflow" class="chat-panel panel-surface">
            <AgentConversationSidebar
              :list="conversationList"
              :loading="conversationLoading"
              :active-id="currentConversationId"
              :app-id="currentAppId"
              :user-id="userId"
              @new="newConversation"
              @select="switchConversation"
              @remove="removeConversation"
              @renamed="applyRenamed"
            />

            <div class="chat-body">
              <div class="panel-head">
                <SvgIcon :icon="selectedAgent.icon" class="panel-head__icon" />
                <span class="panel-head__title">{{ selectedAgent.name }}</span>
                <NTag size="small" round :bordered="false" class="mode-tag">对话</NTag>
                <div class="ml-auto flex gap-8px">
                  <NButton text size="small" :disabled="!messages.length || testing" @click="clearChat">
                    <template #icon>
                      <SvgIcon icon="mdi:delete-sweep-outline" />
                    </template>
                    清空
                  </NButton>
                  <NButton secondary size="small" :disabled="!testing" @click="handleStop">
                    <template #icon>
                      <SvgIcon icon="mdi:stop" />
                    </template>
                    停止
                  </NButton>
                </div>
              </div>

              <div ref="messageArea" class="chat-messages">
                <div v-if="!messages.length" class="chat-welcome">
                  <SvgIcon icon="mdi:message-processing-outline" class="chat-welcome__icon" />
                  <div class="chat-welcome__title">开始调试</div>
                  <div class="chat-welcome__desc">在下方输入消息，模拟对话测试应用，流式返回结果。</div>
                  <div v-if="quickPrompts.length" class="chat-welcome__prompts">
                    <button
                      v-for="item in quickPrompts"
                      :key="item"
                      type="button"
                      class="prompt-chip"
                      @click="handleRun(item)"
                    >
                      {{ item }}
                    </button>
                  </div>
                </div>

                <div v-for="msg in messages" :key="msg.id" class="chat-row" :class="msg.role">
                  <div class="chat-avatar" :class="msg.role">
                    <SvgIcon :icon="msg.role === 'user' ? 'mdi:account-outline' : selectedAgent.icon" />
                  </div>
                  <div class="chat-bubble" :class="msg.role">
                    <!-- 思考过程折叠面板（参考 Dify：进行中默认展开，结束后默认折叠） -->
                    <details v-if="msg.reasoning" class="think-panel" :open="msg.streaming || !reasoningPanelClosed">
                      <summary class="think-panel__summary">
                        <span class="think-panel__chevron">▸</span>
                        <span v-if="msg.streaming" class="think-panel__label think-panel__label--active">思考中…</span>
                        <span v-else class="think-panel__label">思考过程</span>
                      </summary>
                      <div class="think-panel__body">{{ msg.reasoning }}</div>
                    </details>
                    <div v-if="msg.content" class="chat-bubble__text">
                      <template v-if="msg.role !== 'user'">
                        <div class="chat-md" v-html="renderMarkdown(msg.content)" />
                        <span v-if="msg.streaming" class="type-cursor">▍</span>
                      </template>
                      <template v-else>{{ msg.content }}</template>
                    </div>
                    <div v-else-if="msg.streaming && !msg.reasoning" class="chat-bubble__loading">
                      <span class="dot" />
                      <span class="dot" />
                      <span class="dot" />
                    </div>
                    <div v-if="msg.content || !msg.streaming" class="chat-bubble__meta">
                      <span class="chat-bubble__time">{{ msg.time }}</span>
                      <button type="button" class="copy-btn" title="复制内容" @click="copyMessage(msg)">
                        <SvgIcon icon="mdi:content-copy" />
                      </button>
                    </div>
                    <div v-if="msg.suggested?.length" class="chat-bubble__suggested">
                      <button
                        v-for="q in msg.suggested"
                        :key="q"
                        type="button"
                        class="prompt-chip"
                        @click="handleRun(q)"
                      >
                        {{ q }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="chat-input" :class="{ 'chat-input--focused': inputFocused }">
                <div class="chat-input__box">
                  <NInput
                    v-model:value="prompt"
                    type="textarea"
                    :autosize="{ minRows: 1, maxRows: 5 }"
                    placeholder="输入消息，Enter 发送，Shift+Enter 换行"
                    :disabled="testing"
                    @focus="inputFocused = true"
                    @blur="inputFocused = false"
                    @keydown.enter.prevent="handleRun()"
                  />
                  <div class="chat-input__toolbar">
                    <div class="flex items-center gap-2px">
                      <NUpload
                        v-if="fileCapability.supportLocalFile"
                        multiple
                        :max="fileCapability.limit"
                        :file-list="uploadFiles"
                        :default-upload="false"
                        :accept="fileCapability.accept === '*' ? undefined : fileCapability.accept"
                        class="inline-block"
                        @change="handleLocalFileChange"
                        @remove="handleLocalFileRemove"
                      >
                        <button type="button" class="icon-btn" title="上传文件">
                          <SvgIcon icon="mdi:paperclip" />
                        </button>
                      </NUpload>
                      <span v-if="testing" class="chat-input__status">
                        <span class="pulse-dot" />
                        生成中…
                      </span>
                    </div>
                    <div class="flex items-center gap-6px">
                      <span v-if="prompt.trim() && !testing" class="chat-input__hint">Enter 发送</span>
                      <NButton
                        type="primary"
                        size="small"
                        :loading="testing"
                        :disabled="!prompt.trim()"
                        @click="handleRun()"
                      >
                        <template #icon>
                          <SvgIcon icon="mdi:send" />
                        </template>
                        发送
                      </NButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 工作流主区：单轮运行（输入表单 + 运行结果） -->
          <div v-else class="wf-panel panel-surface">
            <div class="panel-head">
              <SvgIcon :icon="selectedAgent.icon" class="panel-head__icon" />
              <span class="panel-head__title">{{ selectedAgent.name }}</span>
              <NTag size="small" round :bordered="false" class="mode-tag">工作流</NTag>
              <div class="ml-auto flex gap-8px">
                <NButton secondary size="small" :disabled="!testing" @click="handleStop">
                  <template #icon>
                    <SvgIcon icon="mdi:stop" />
                  </template>
                  停止
                </NButton>
                <NButton type="primary" size="small" :loading="testing" :disabled="!prompt.trim()" @click="handleRun()">
                  <template #icon>
                    <SvgIcon icon="mdi:play" />
                  </template>
                  运行
                </NButton>
              </div>
            </div>

            <div class="wf-panel__body">
              <div class="wf-run-form">
                <div class="wf-run-form__desc">
                  填写运行参数，点击「运行」执行工作流，下方展示节点执行过程与最终输出。
                </div>

                <NFormItem label="执行说明">
                  <NInput
                    v-model:value="prompt"
                    type="textarea"
                    placeholder="输入执行说明，作为工作流输入"
                    :autosize="{ minRows: 2, maxRows: 4 }"
                  />
                </NFormItem>

                <template v-if="parameterFields.length">
                  <div class="runtime-section__title">工作流变量</div>
                  <div class="flex flex-col gap-6px">
                    <NFormItem
                      v-for="field in parameterFields"
                      :key="field.name"
                      :label="field.label"
                      :required="field.required"
                    >
                      <NInput
                        v-if="field.kind === 'text'"
                        :value="getFieldStringValue(field.name)"
                        :placeholder="field.placeholder"
                        @update:value="value => updateFieldValue(field.name, value)"
                      />
                      <NInput
                        v-else-if="field.kind === 'textarea'"
                        :value="getFieldStringValue(field.name)"
                        type="textarea"
                        :placeholder="field.placeholder"
                        :autosize="{ minRows: 3, maxRows: 6 }"
                        @update:value="value => updateFieldValue(field.name, value)"
                      />
                      <NInputNumber
                        v-else-if="field.kind === 'number'"
                        class="w-full"
                        :value="getFieldNumberValue(field.name)"
                        @update:value="value => updateFieldValue(field.name, value)"
                      />
                      <NSelect
                        v-else-if="field.kind === 'select'"
                        :value="getFieldSelectValue(field.name)"
                        :options="field.options || []"
                        clearable
                        @update:value="value => updateFieldValue(field.name, value)"
                      />
                      <NSwitch
                        v-else
                        :value="getFieldSwitchValue(field.name)"
                        @update:value="value => updateFieldValue(field.name, value)"
                      />
                    </NFormItem>
                  </div>
                </template>

                <div v-if="quickPrompts.length" class="wf-run-form__prompts">
                  <button
                    v-for="item in quickPrompts"
                    :key="item"
                    type="button"
                    class="prompt-chip"
                    @click="handleRun(item)"
                  >
                    {{ item }}
                  </button>
                </div>
              </div>

              <div class="wf-run-result">
                <div class="wf-run-result__head">运行结果</div>
                <div v-if="streamOutput" class="wf-output">{{ streamOutput }}</div>
                <div v-else class="wf-run-result__empty">运行后在此查看输出</div>

                <div v-if="streamEvents.length" class="wf-run-result__logs">
                  <div class="wf-run-result__logtitle">节点执行过程</div>
                  <div class="flex flex-col gap-6px">
                    <div
                      v-for="item in streamEvents"
                      :key="item.id"
                      class="step-card"
                      :class="{ 'step-card--tool': item.kind === 'tool' }"
                    >
                      <div class="step-label">
                        <SvgIcon v-if="item.kind === 'tool'" icon="mdi:toolbox-outline" class="step-label__icon" />
                        {{ item.label }}
                      </div>
                      <div class="step-detail">{{ item.detail }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.agent-test-page-root {
  height: 100%;
}

.agent-domain-page {
  height: 100%;
  background: var(--agent-page-bg);
  color: #eaf5ff;
  overflow: auto;
}

.agent-domain-page--dark {
  color-scheme: dark;
}

.agent-shell {
  height: 100%;
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  gap: 10px;
  padding: 12px 14px;
  box-sizing: border-box;
}

.agent-sidebar {
  min-width: 0;
  overflow: visible;
}

.agent-main {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: 1fr;
  gap: 10px;
  min-height: 0;
  height: 100%;
}

/* 对话主区 */
.chat-panel {
  display: flex;
  flex-direction: row;
  min-height: 0;
  min-width: 0;
  height: 100%;
  /* clip 而非 hidden：保留圆角裁剪，但不建立滚动容器，使输入条 sticky 能响应外层滚动 */
  overflow: clip;
}

.chat-body {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 工作流主区 */
.wf-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  height: 100%;
  overflow: hidden;

  &__body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 14px 18px;
    overflow-y: auto;
    min-height: 0;
  }
}

.wf-run-form {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &__desc {
    font-size: 12px;
    color: rgba(203, 227, 255, 0.55);
    margin-bottom: 6px;
  }

  &__prompts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }
}

.wf-run-result {
  margin-top: 4px;

  &__head {
    font-size: 13px;
    font-weight: 700;
    color: #eaf5ff;
    margin-bottom: 8px;
  }

  &__empty {
    font-size: 12px;
    color: rgba(203, 227, 255, 0.4);
    padding: 16px 0;
    text-align: center;
    border: 1px dashed rgba(25, 95, 176, 0.25);
    border-radius: 6px;
  }

  &__logs {
    margin-top: 14px;
  }

  &__logtitle {
    font-size: 12px;
    font-weight: 600;
    color: rgba(203, 227, 255, 0.7);
    margin-bottom: 6px;
  }
}

.wf-output {
  padding: 12px 14px;
  border-radius: 6px;
  background: rgba(6, 20, 38, 0.5);
  border: 1px solid rgba(25, 95, 176, 0.18);
  color: rgba(41, 163, 255, 0.9);
  font-size: 13px;
  line-height: 22px;
  white-space: pre-wrap;
  word-break: break-word;
}

.mode-tag {
  background: rgba(41, 163, 255, 0.12);
  border: 1px solid rgba(41, 163, 255, 0.25);
  color: rgba(41, 163, 255, 0.95);
  margin-left: 8px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

.chat-welcome {
  margin: auto;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: rgba(203, 227, 255, 0.6);

  &__icon {
    font-size: 46px;
    color: rgba(41, 163, 255, 0.35);
  }

  &__title {
    font-size: 16px;
    font-weight: 700;
    color: #eaf5ff;
  }

  &__desc {
    font-size: 12px;
    max-width: 420px;
    line-height: 1.6;
  }

  &__prompts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
    max-width: 420px;
  }
}

.chat-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  animation: chat-in 0.25s ease;

  &.user {
    flex-direction: row-reverse;
  }
}

@keyframes chat-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.chat-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
  font-size: 16px;
  color: #fff;

  &.user {
    background: linear-gradient(135deg, #3b82f6, #60a5fa);
  }

  &.assistant {
    background: linear-gradient(135deg, #8b5cf6, #a78bfa);
    box-shadow: 0 0 10px rgba(139, 92, 246, 0.3);
  }
}

.chat-bubble {
  max-width: 76%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;

  &.user {
    background: linear-gradient(135deg, rgba(19, 95, 182, 0.55), rgba(9, 46, 92, 0.55));
    border: 1px solid rgba(61, 166, 255, 0.35);
    color: #fff;
    border-bottom-right-radius: 4px;
  }

  &.assistant {
    background: rgba(6, 20, 38, 0.5);
    border: 1px solid rgba(25, 95, 176, 0.22);
    color: #d6eaff;
    border-bottom-left-radius: 4px;
  }

  &__loading {
    display: inline-flex;
    gap: 4px;
    padding: 4px 0;

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: rgba(41, 163, 255, 0.6);
      animation: chat-blink 1.2s infinite;

      &:nth-child(2) {
        animation-delay: 0.2s;
      }

      &:nth-child(3) {
        animation-delay: 0.4s;
      }
    }
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  &:hover &__meta {
    opacity: 1;
  }

  &__time {
    font-size: 11px;
    color: rgba(203, 227, 255, 0.4);
  }

  &__suggested {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }
}

/* 思考过程折叠面板（对齐 Dify 折叠设计） */
.think-panel {
  margin-bottom: 8px;
  border: 1px solid rgba(25, 95, 176, 0.22);
  border-radius: 6px;
  background: rgba(12, 38, 72, 0.35);
  font-size: 12px;

  &__summary {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    cursor: pointer;
    list-style: none;
    user-select: none;
    color: rgba(147, 196, 255, 0.75);

    &::-webkit-details-marker {
      display: none;
    }
  }

  &__chevron {
    display: inline-block;
    font-size: 10px;
    transition: transform 0.25s ease;
    color: rgba(41, 163, 255, 0.85);
  }

  &[open] &__chevron {
    transform: rotate(90deg);
  }

  &__label {
    font-weight: 600;
    color: rgba(203, 227, 255, 0.75);

    &--active {
      color: rgba(41, 163, 255, 0.95);
    }
  }

  &__body {
    margin: 0 8px 8px 8px;
    padding: 8px 10px;
    border-left: 2px solid rgba(41, 163, 255, 0.4);
    background: rgba(6, 20, 38, 0.45);
    border-radius: 0 4px 4px 0;
    color: rgba(203, 227, 255, 0.62);
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }
}

/* 打字机光标 */
.type-cursor {
  display: inline-block;
  margin-left: 1px;
  color: rgba(41, 163, 255, 0.9);
  animation: type-cursor-blink 0.9s steps(1) infinite;
}

@keyframes type-cursor-blink {
  0%,
  60% {
    opacity: 1;
  }

  61%,
  100% {
    opacity: 0;
  }
}

.copy-btn {
  appearance: none;
  border: none;
  background: transparent;
  padding: 0;
  color: rgba(203, 227, 255, 0.45);
  cursor: pointer;
  font-size: 13px;
  display: inline-flex;
  align-items: center;

  &:hover {
    color: #29a3ff;
  }
}

@keyframes chat-blink {
  0%,
  80%,
  100% {
    opacity: 0.3;
  }

  40% {
    opacity: 1;
  }
}

.chat-input {
  position: sticky;
  bottom: 0;
  z-index: 5;
  /* 与 panel-surface 同底色，吸附时遮挡滚动内容 */
  background: var(--agent-surface-bg);
  border-radius: 0 0 var(--agent-radius) var(--agent-radius);
  padding: 10px 14px 12px;
  transition: box-shadow 0.2s ease;

  /* 浮动输入条：与消息区留出间距，聚焦时高亮描边 */
  &__box {
    background: rgba(12, 38, 72, 0.45);
    border: 1px solid rgba(25, 95, 176, 0.22);
    border-radius: 12px;
    padding: 8px 12px 6px;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  &--focused &__box {
    border-color: rgba(41, 163, 255, 0.55);
    box-shadow: 0 0 0 3px rgba(41, 163, 255, 0.08);
  }

  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
  }

  &__status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: rgba(41, 163, 255, 0.85);
  }

  &__hint {
    font-size: 11px;
    color: rgba(203, 227, 255, 0.4);
  }
}

.pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #29a3ff;
  animation: pulse-dot 1s infinite;
}

@keyframes pulse-dot {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(41, 163, 255, 0.5);
  }

  50% {
    box-shadow: 0 0 0 6px rgba(41, 163, 255, 0);
  }
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgba(203, 227, 255, 0.7);
  cursor: pointer;
  font-size: 17px;

  &:hover {
    background: rgba(41, 163, 255, 0.12);
    color: #29a3ff;
  }
}

.runtime-section__title {
  margin: 4px 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(203, 227, 255, 0.82);
}

.prompt-chip {
  font-size: 12px;
  padding: 5px 12px;
  border: 1px solid rgba(41, 163, 255, 0.25);
  border-radius: 999px;
  background: rgba(41, 163, 255, 0.08);
  color: rgba(203, 227, 255, 0.85);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: #29a3ff;
    background: rgba(41, 163, 255, 0.16);
    color: #29a3ff;
  }
}

.step-card {
  padding: 10px 12px;
  border-radius: 4px;
  background: rgba(12, 38, 72, 0.4);
  border: 1px solid rgba(25, 95, 176, 0.12);

  &--tool {
    background: rgba(52, 211, 153, 0.06);
    border-color: rgba(52, 211, 153, 0.28);
    border-left: 3px solid rgba(52, 211, 153, 0.7);
  }
}

.step-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #eaf5ff;

  &__icon {
    width: 13px;
    height: 13px;
    color: #34d399;
  }
}

.step-detail {
  margin-top: 4px;
  font-size: 11px;
  line-height: 18px;
  color: rgba(203, 227, 255, 0.55);
  white-space: pre-wrap;
}

@media (max-width: 1199px) {
  .agent-shell {
    grid-template-columns: 1fr;
  }

  .agent-main {
    grid-template-columns: 1fr;
  }

  .agent-sidebar {
    max-height: 280px;
  }

  .chat-bubble {
    max-width: 92%;
  }
}

/* markdown 内容 */
.chat-md :deep(p) {
  margin: 0 0 6px;
}
.chat-md :deep(p:last-child) {
  margin-bottom: 0;
}
.chat-md :deep(ul),
.chat-md :deep(ol) {
  margin: 4px 0 6px;
  padding-left: 18px;
}
.chat-md :deep(li) {
  margin: 2px 0;
}
.chat-md :deep(code) {
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 11px;
  font-family: 'Consolas', monospace;
}
.chat-md :deep(pre) {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 8px 10px;
  overflow-x: auto;
  margin: 6px 0;
}
.chat-md :deep(pre code) {
  background: transparent;
  padding: 0;
}
.chat-md :deep(table) {
  border-collapse: collapse;
  margin: 6px 0;
  font-size: 11px;
}
.chat-md :deep(th),
.chat-md :deep(td) {
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 4px 8px;
}
.chat-md :deep(h1),
.chat-md :deep(h2),
.chat-md :deep(h3),
.chat-md :deep(h4) {
  font-size: 13px;
  margin: 8px 0 4px;
}
</style>
