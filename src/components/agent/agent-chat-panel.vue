<script setup lang="ts">
/**
 * 场景智能体面板（公用组件，零 Cesium 依赖）
 *
 * 真连 Dify Agent 应用：流式对话、多轮会话、历史会话管理、建议问题、
 * markdown 渲染；AI 回复中的 ```plot 标绘指令由本组件解析后通过
 * plot-instruction 事件抛给宿主页执行（组件不直接操作地图）。
 *
 * 设计文档：docs/场景智能体面板设计方案.md
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import MarkdownIt from 'markdown-it';
import { fetchDifyChatStream } from '@/service/api/dify-stream';
import {
  deleteDifyConversation,
  fetchDifyConversationMessages,
  fetchDifyConversations,
  fetchDifySuggestedQuestions
} from '@/service/api/dify';
import { fetchDifyAppList } from '@/service/api/difyApp';
import { useAuthStore } from '@/store/modules/auth';
import {
  PLOT_ACTION_META,
  scanPlotInstructions,
  stripPlotInstructions,
  type PlotInstruction
} from './plot-instruction';

defineOptions({
  name: 'AgentChatPanel'
});

interface PanelChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  streaming?: boolean;
  /** agent 思考/工具调用过程 */
  thoughts?: Array<{ tool?: string; input?: string; observation?: string }>;
  /** 回复中解析出的标绘指令（已逐条 emit 给宿主页） */
  plotInstructions?: PlotInstruction[];
  /** 解析失败的指令块数 */
  plotFailedCount?: number;
  /** 建议问题（回复完成后拉取） */
  suggested?: string[];
}

const props = withDefaults(
  defineProps<{
    collapsed?: boolean;
    title?: string;
    /** Dify 应用 id（后端 dify_app 主键）；不传走后端默认应用 */
    appId?: string | number;
    /** 场景上下文（随每条消息作为 inputs.context 传给 Dify） */
    context?: Record<string, unknown> | null;
    welcomeText?: string;
    capabilities?: string[];
    /** 系统通知（如"分析完成"衔接消息），变化时注入一条系统消息 */
    notice?: string | null;
  }>(),
  {
    collapsed: false,
    title: '场景智能体',
    appId: undefined,
    context: null,
    welcomeText:
      '您好，我是本场景的智能参谋。可以结合当前任务回答专业问题；也可以用自然语言下达标绘指令，例如"关渡大桥损毁了，标出来"。',
    capabilities: () => ['知识库问答', '地图标绘', '方案解读'],
    notice: null
  }
);

const emit = defineEmits<{
  (e: 'toggle-collapse'): void;
  (e: 'close'): void;
  (e: 'plot-instruction', instruction: PlotInstruction): void;
}>();

const authStore = useAuthStore();
const userId = computed(() => String(authStore.userInfo.userId ?? ''));

// ──── markdown（html:false 防 XSS） ────
const md = new MarkdownIt({ html: false, linkify: true, breaks: true });
function renderMarkdown(text: string): string {
  return md.render(text);
}

// ──── 会话与消息 ────
let messageSeq = 0;
// 用户手动切换智能体后，欢迎语随应用动态生成，不再使用宿主页固定文案
let appSwitched = false;
const appOptions = ref<AppOption[]>([]);
const currentAppId = ref<string | null>(props.appId != null ? String(props.appId) : null);
const currentAppName = computed(() => appOptions.value.find(o => o.value === currentAppId.value)?.label ?? '');

function welcomeMessage(): PanelChatMessage {
  const appName = appSwitched ? currentAppName.value : '';
  const content = appName
    ? `已切换至智能体「${appName}」。\n\n可以结合当前任务回答专业问题，也可以用自然语言下达标绘指令（如「标注某个点位」「画一条机动路线」「圈出警戒区域」）。`
    : props.welcomeText;
  return {
    id: `welcome-${++messageSeq}`,
    role: 'assistant',
    content
  };
}
const messages = ref<PanelChatMessage[]>([welcomeMessage()]);
const conversationId = ref('');
const input = ref('');
const streaming = ref(false);
let abortController: AbortController | null = null;

// ──── 智能体应用选择（基于后端 dify_app 列表，仅 agent 类型） ────
interface AppOption {
  label: string;
  value: string;
}
const appsLoading = ref(false);

async function loadApps() {
  appsLoading.value = true;
  try {
    const res = await fetchDifyAppList();
    // 只返回已发布的 agent 应用：排除明确未发布（published === false）；
    // 发布状态未知（null/undefined，如后端接口失败）时保留，避免误过滤导致下拉为空
    const list = (res?.data ?? []).filter(app => app.type === 2 && app.published !== false);
    appOptions.value = list.map(app => ({ label: app.name, value: app.id }));
    // 未指定应用或当前值不在列表中时，默认选中第一个 agent 应用
    if (appOptions.value.length > 0 && !appOptions.value.some(o => o.value === currentAppId.value)) {
      currentAppId.value = appOptions.value[0].value;
      resetConversation();
    }
  } catch {
    appOptions.value = [];
  } finally {
    appsLoading.value = false;
  }
}

function resetConversation() {
  conversationId.value = '';
  messages.value = [welcomeMessage()];
}

// ──── 历史会话 ────
const conversations = ref<Api.Dify.ConversationItem[]>([]);
const conversationsOpen = ref(false);

function handleAppChange() {
  // 切换应用：欢迎语随应用重建，会话与历史不跨应用，全部重置后重新拉取
  appSwitched = true;
  resetConversation();
  conversations.value = [];
  conversationsOpen.value = false;
  void loadConversations();
}

const contentRef = ref<HTMLElement | null>(null);
function scrollToBottom() {
  nextTick(() => {
    contentRef.value?.scrollTo({ top: contentRef.value.scrollHeight, behavior: 'smooth' });
  });
}

// ──── 历史会话 ────
async function loadConversations() {
  if (!userId.value) return;
  try {
    const { data, error } = await fetchDifyConversations({
      appId: currentAppId.value ?? undefined,
      userId: userId.value,
      limit: 20
    });
    if (!error) conversations.value = data?.data ?? [];
  } catch {
    conversations.value = [];
  }
}

function toggleConversations() {
  conversationsOpen.value = !conversationsOpen.value;
  if (conversationsOpen.value) void loadConversations();
}

function handleNewConversation() {
  conversationId.value = '';
  messages.value = [welcomeMessage()];
  conversationsOpen.value = false;
}

async function handleSelectConversation(conv: Api.Dify.ConversationItem) {
  conversationsOpen.value = false;
  if (conv.id === conversationId.value) return;
  conversationId.value = conv.id;
  messages.value = [];
  try {
    const { data, error } = await fetchDifyConversationMessages({
      appId: currentAppId.value ?? undefined,
      userId: userId.value,
      conversationId: conv.id,
      limit: 50
    });
    if (error) return;
    const list = (data?.data ?? []).slice().reverse();
    list.forEach(item => {
      if (item.query) {
        messages.value.push({ id: `q-${item.id}`, role: 'user', content: item.query });
      }
      if (item.answer) {
        messages.value.push({ id: `a-${item.id}`, role: 'assistant', content: item.answer });
      }
    });
    scrollToBottom();
  } catch {
    window.$message?.warning('历史消息加载失败');
  }
}

async function handleDeleteConversation(conv: Api.Dify.ConversationItem) {
  try {
    const { error } = await deleteDifyConversation({
      appId: currentAppId.value ?? undefined,
      userId: userId.value,
      conversationId: conv.id
    });
    if (!error) {
      conversations.value = conversations.value.filter(c => c.id !== conv.id);
      if (conv.id === conversationId.value) handleNewConversation();
    }
  } catch {
    window.$message?.warning('会话删除失败');
  }
}

// ──── 发送与流式接收 ────
async function handleSend(text?: string) {
  const query = (text ?? input.value).trim();
  if (!query || streaming.value) return;
  input.value = '';

  messages.value.push({ id: `u-${++messageSeq}`, role: 'user', content: query });
  const assistant: PanelChatMessage = {
    id: `a-${++messageSeq}`,
    role: 'assistant',
    content: '',
    streaming: true,
    thoughts: []
  };
  messages.value.push(assistant);
  scrollToBottom();

  streaming.value = true;
  abortController = new AbortController();

  const findMsg = () => messages.value.find(m => m.id === assistant.id);
  let doneMessageId = '';

  // ──── 标绘指令渐进解析：流式过程中一旦出现完整指令立即执行，不依赖流结束 ────
  const plotIdByKey = new Map<string, string>();
  const executedPlotKeys = new Set<string>();
  let plotSeq = 0;

  function consumePlotInstructions(msg: PanelChatMessage, execute: boolean) {
    const { valid } = scanPlotInstructions(msg.content);
    valid.forEach(({ instruction, raw }) => {
      const key = `${msg.id}|${raw}`;
      if (!plotIdByKey.has(key)) plotIdByKey.set(key, `ai-plot-${++plotSeq}`);
      instruction.id = plotIdByKey.get(key);
      if (execute && !executedPlotKeys.has(key)) {
        executedPlotKeys.add(key);
        emit('plot-instruction', instruction);
      }
      msg.plotInstructions = msg.plotInstructions ?? [];
      if (!msg.plotInstructions.some(i => i.id === instruction.id)) {
        msg.plotInstructions.push(instruction);
      }
    });
  }

  try {
    await fetchDifyChatStream(
      {
        appId: currentAppId.value ?? undefined,
        userId: userId.value,
        query,
        conversationId: conversationId.value || '',
        inputs: props.context ? { context: JSON.stringify(props.context) } : undefined
      },
      {
        onDelta: delta => {
          const msg = findMsg();
          if (msg) {
            msg.content += delta;
            // 流式中渐进解析：完整指令一出现即标绘（即使 SSE 流未正常关闭也能标绘）
            consumePlotInstructions(msg, true);
            scrollToBottom();
          }
        },
        onThought: payload => {
          const msg = findMsg();
          if (!msg) return;
          msg.thoughts = msg.thoughts ?? [];
          const tool = typeof payload.tool === 'string' ? payload.tool : undefined;
          const toolInput =
            typeof payload.tool_input === 'string'
              ? payload.tool_input
              : payload.tool_input
                ? JSON.stringify(payload.tool_input)
                : undefined;
          const observation = typeof payload.observation === 'string' ? payload.observation : undefined;
          // 噪声事件（既无工具名也无观察结果）直接丢弃，避免重复事件刷屏
          if (!tool && !observation) return;
          // 去重：同一工具+入参视为同一轮思考，仅补全观察结果
          const key = `${tool ?? ''}|${toolInput ?? ''}`;
          const existing = msg.thoughts.find(t => `${t.tool ?? ''}|${t.input ?? ''}` === key);
          if (existing) {
            if (observation && !existing.observation) existing.observation = observation;
            return;
          }
          // 硬上限，防止异常流把列表刷爆
          if (msg.thoughts.length >= 50) return;
          msg.thoughts.push({ tool, input: toolInput, observation });
        },
        onDone: payload => {
          const convId = typeof payload === 'string' ? payload : String(payload.conversationId || '');
          if (convId) conversationId.value = convId;
          if (typeof payload !== 'string' && payload.messageId) doneMessageId = payload.messageId;
        },
        onError: errText => {
          const msg = findMsg();
          if (msg && !msg.content) msg.content = `⚠️ ${errText}`;
        }
      },
      abortController.signal
    );
  } catch {
    const msg = findMsg();
    if (msg && !msg.content) msg.content = '⚠️ 请求失败，请检查智能体服务与网络';
  } finally {
    const msg = findMsg();
    if (msg) {
      msg.streaming = false;
      // 补漏执行 + 清理文本中的指令块（流式中已执行的指令不会重复 emit）
      consumePlotInstructions(msg, true);
      const { cleaned, failedBlocks } = stripPlotInstructions(msg.content);
      msg.content = cleaned;
      msg.plotFailedCount = failedBlocks || undefined;
      // 建议问题
      if (doneMessageId) {
        try {
          const { data, error } = await fetchDifySuggestedQuestions({
            appId: currentAppId.value ?? undefined,
            messageId: doneMessageId,
            userId: userId.value
          });
          if (!error) {
            msg.suggested = (data?.data ?? [])
              .map(item => (typeof item === 'string' ? item : (item.question ?? '')))
              .filter(Boolean)
              .slice(0, 3);
          }
        } catch {
          /* 建议问题失败不影响主流程 */
        }
      }
    }
    streaming.value = false;
    abortController = null;
    scrollToBottom();
  }
}

function handleStop() {
  abortController?.abort();
}

function handleSuggestedClick(question: string) {
  void handleSend(question);
}

/** 删除单条标绘：抛 remove 指令给宿主页，并从卡片列表移除 */
function handleRemoveInstruction(msg: PanelChatMessage, id: string) {
  emit('plot-instruction', { action: 'remove', id });
  if (msg.plotInstructions) {
    msg.plotInstructions = msg.plotInstructions.filter(instr => instr.id !== id);
  }
}

// ──── 系统通知注入（分析完成衔接等） ────
watch(
  () => props.notice,
  notice => {
    if (notice) {
      messages.value.push({ id: `sys-${++messageSeq}`, role: 'system', content: notice });
      scrollToBottom();
    }
  }
);

function formatTime(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function instructionSummary(instruction: PlotInstruction): string {
  if (instruction.name || instruction.text) return instruction.name || instruction.text || '';
  if (instruction.action === 'flyTo') return `${instruction.lon?.toFixed(4)}, ${instruction.lat?.toFixed(4)}`;
  return instruction.id ?? '';
}

onMounted(() => {
  void loadApps();
});

onUnmounted(() => abortController?.abort());
</script>

<template>
  <div class="agent-chat-panel">
    <!-- ── 标题栏 ── -->
    <div class="panel-header">
      <span class="header-icon">
        <SvgIcon icon="mdi:robot-outline" />
      </span>
      <span class="header-title">{{ title }}</span>
      <NSelect
        v-model:value="currentAppId"
        class="app-selector-select"
        size="small"
        :options="appOptions"
        :loading="appsLoading"
        placeholder="选择智能体应用"
        @update:value="handleAppChange"
      />
      <span class="agent-status">
        <span class="status-dot" />
        {{ streaming ? '对话中' : '在线' }}
      </span>
      <div class="header-actions">
        <button type="button" class="header-btn" title="历史会话" @click="toggleConversations">
          <SvgIcon icon="mdi:history" />
        </button>
        <button type="button" class="header-btn" title="新会话" @click="handleNewConversation">
          <SvgIcon icon="mdi:plus" />
        </button>
        <button type="button" class="header-btn" :title="collapsed ? '展开' : '折叠'" @click="emit('toggle-collapse')">
          <SvgIcon :icon="collapsed ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
        </button>
        <button type="button" class="header-btn" title="关闭" @click="emit('close')">
          <SvgIcon icon="mdi:close" />
        </button>
      </div>
    </div>

    <!-- ── 历史会话下拉 ── -->
    <div v-if="conversationsOpen" class="history-dropdown">
      <div v-if="conversations.length === 0" class="history-empty">暂无历史会话</div>
      <div
        v-for="conv in conversations"
        :key="conv.id"
        class="history-item"
        :class="{ 'history-item--active': conv.id === conversationId }"
        @click="handleSelectConversation(conv)"
      >
        <span class="history-name">{{ conv.name }}</span>
        <span class="history-time">{{ formatTime(conv.updated_at) }}</span>
        <button type="button" class="history-del" title="删除会话" @click.stop="handleDeleteConversation(conv)">
          <SvgIcon icon="mdi:delete-outline" />
        </button>
      </div>
    </div>

    <!-- ── 消息区 ── -->
    <div v-show="!collapsed" ref="contentRef" class="panel-content">
      <!-- 欢迎语 -->
      <div class="welcome">
        <div class="welcome-greeting">
          <span class="welcome-icon">💬</span>
          <span class="welcome-text">{{ messages[0]?.content }}</span>
        </div>
        <div class="capability-tags">
          <span v-for="tag in capabilities" :key="tag" class="cap-tag">{{ tag }}</span>
        </div>
      </div>

      <!-- 消息列表（跳过欢迎语） -->
      <div v-for="msg in messages.slice(1)" :key="msg.id" class="chat-msg" :class="`chat-msg--${msg.role}`">
        <span class="msg-avatar">{{ msg.role === 'user' ? '👤' : msg.role === 'system' ? '📌' : '🤖' }}</span>
        <div class="msg-body">
          <div class="msg-bubble" :class="`msg-bubble--${msg.role}`">
            <!-- 系统消息：居中小字 -->
            <template v-if="msg.role === 'system'">
              <span class="system-text">{{ msg.content }}</span>
            </template>
            <!-- 助手消息 -->
            <template v-else-if="msg.role === 'assistant'">
              <div v-if="msg.thoughts && msg.thoughts.length > 0" class="msg-thoughts">
                <details>
                  <summary>思考与工具调用（{{ msg.thoughts.length }}）</summary>
                  <div v-for="(t, i) in msg.thoughts.slice(0, 8)" :key="i" class="thought-item">
                    <div v-if="t.tool" class="thought-tool">🔧 {{ t.tool }}</div>
                    <div v-if="t.input" class="thought-line">入参：{{ t.input }}</div>
                    <div v-if="t.observation" class="thought-line">结果：{{ t.observation }}</div>
                  </div>
                  <div v-if="msg.thoughts.length > 8" class="thought-more">…另有 {{ msg.thoughts.length - 8 }} 条</div>
                </details>
              </div>
              <div class="msg-md" v-html="renderMarkdown(msg.content)" />
              <span v-if="msg.streaming" class="msg-cursor">▌</span>
            </template>
            <!-- 用户消息 -->
            <template v-else>{{ msg.content }}</template>
          </div>

          <!-- 标绘指令卡片 -->
          <div v-if="msg.plotInstructions && msg.plotInstructions.length > 0" class="plot-cards">
            <div v-for="instr in msg.plotInstructions" :key="instr.id" class="plot-card">
              <SvgIcon class="plot-card-icon" :icon="PLOT_ACTION_META[instr.action].icon" />
              <span class="plot-card-label">{{ PLOT_ACTION_META[instr.action].label }}</span>
              <span class="plot-card-name" :title="instructionSummary(instr)">{{ instructionSummary(instr) }}</span>
              <span class="plot-card-status">已标绘</span>
              <button
                type="button"
                class="plot-card-del"
                title="删除该标绘"
                @click="handleRemoveInstruction(msg, instr.id!)"
              >
                <SvgIcon icon="mdi:close" />
              </button>
            </div>
            <div v-if="msg.plotFailedCount" class="plot-failed">{{ msg.plotFailedCount }} 条指令解析失败，已跳过</div>
          </div>

          <!-- 建议问题 -->
          <div v-if="msg.suggested && msg.suggested.length > 0 && !streaming" class="suggested">
            <button
              v-for="q in msg.suggested"
              :key="q"
              type="button"
              class="suggested-chip"
              @click="handleSuggestedClick(q)"
            >
              {{ q }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── 输入区 ── -->
    <div v-show="!collapsed" class="chat-input-area">
      <div class="chat-input-wrapper">
        <input
          v-model="input"
          type="text"
          class="chat-input"
          placeholder="输入消息，如：关渡大桥损毁了，标出来"
          @keyup.enter="handleSend()"
        />
        <button v-if="streaming" type="button" class="send-btn send-btn--stop" title="停止生成" @click="handleStop">
          <SvgIcon icon="mdi:stop" />
        </button>
        <button v-else type="button" class="send-btn" :disabled="!input.trim()" title="发送" @click="handleSend()">
          <SvgIcon icon="mdi:send" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.agent-chat-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  position: relative;
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
  color: #62c4ff;
  display: flex;
}

.header-title {
  flex-shrink: 0;
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
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.25);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.header-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
}

.header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  font-size: 15px;
  transition:
    background 0.18s,
    color 0.18s;
}

.header-btn:hover {
  background: rgba(43, 107, 255, 0.15);
  color: rgba(255, 255, 255, 0.85);
}

/* ──── 标题栏内联应用选择器（标题右侧） ──── */
.app-selector-select {
  flex: 1 1 120px;
  min-width: 100px;
  max-width: 240px;
}

/* ──── 历史会话下拉 ──── */
.history-dropdown {
  position: absolute;
  top: 46px;
  right: 10px;
  z-index: 30;
  width: 280px;
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid rgba(43, 131, 255, 0.3);
  border-radius: 10px;
  background: rgba(8, 18, 34, 0.98);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  scrollbar-width: thin;
}

.history-empty {
  padding: 14px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
  text-align: center;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  transition: background 0.15s;
}

.history-item:hover {
  background: rgba(43, 107, 255, 0.1);
}

.history-item--active {
  background: rgba(43, 107, 255, 0.16);
}

.history-name {
  flex: 1;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.82);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-time {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  font-family: 'Consolas', monospace;
  flex-shrink: 0;
}

.history-del {
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  font-size: 14px;
  display: flex;
  padding: 2px;
}

.history-del:hover {
  color: #fb7185;
}

/* ──── 消息区 ──── */
.panel-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 14px;
  scrollbar-width: thin;
  scrollbar-color: rgba(141, 184, 255, 0.24) transparent;
}

.panel-content::-webkit-scrollbar {
  width: 5px;
}

.panel-content::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(141, 184, 255, 0.24);
}

/* 欢迎语 */
.welcome {
  margin-bottom: 10px;
}

.welcome-greeting {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 10px 12px;
  background: rgba(43, 107, 255, 0.06);
  border: 1px solid rgba(43, 107, 255, 0.12);
  border-radius: 10px;
  margin-bottom: 8px;
}

.welcome-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.welcome-text {
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
  border: 1px solid rgba(141, 184, 255, 0.14);
  font-weight: 500;
}

/* 消息 */
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

.msg-body {
  max-width: 88%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.chat-msg--user .msg-body {
  align-items: flex-end;
}

.msg-bubble {
  font-size: 12px;
  padding: 7px 11px;
  border-radius: 10px;
  line-height: 1.6;
  word-break: break-word;
}

.msg-bubble--assistant {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.82);
  border-top-left-radius: 2px;
  align-self: flex-start;
}

.msg-bubble--user {
  background: rgba(43, 107, 255, 0.16);
  color: rgba(255, 255, 255, 0.9);
  border-top-right-radius: 2px;
}

.msg-bubble--system {
  align-self: center;
  background: transparent;
  padding: 2px 8px;
}

.system-text {
  font-size: 11px;
  color: rgba(141, 184, 255, 0.65);
}

.msg-cursor {
  display: inline-block;
  color: #29a3ff;
  animation: blink 0.9s step-end infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

/* 思考与工具调用折叠 */
.msg-thoughts {
  margin-bottom: 6px;
}

.msg-thoughts details {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
}

.msg-thoughts summary {
  padding: 4px 8px;
  font-size: 11px;
  color: rgba(147, 196, 255, 0.65);
  cursor: pointer;
  user-select: none;
}

.thought-item {
  padding: 4px 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.thought-tool {
  font-size: 12px;
  color: #8db8ff;
  font-weight: 600;
}

.thought-line {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.62);
  word-break: break-all;
  margin-top: 3px;
  line-height: 1.55;
  max-height: 4.65em;
  overflow: hidden;
}

.thought-more {
  padding: 4px 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
}

/* markdown 内容 */
.msg-md :deep(p) {
  margin: 0 0 6px;
}

.msg-md :deep(p:last-child) {
  margin-bottom: 0;
}

.msg-md :deep(ul),
.msg-md :deep(ol) {
  margin: 4px 0 6px;
  padding-left: 18px;
}

.msg-md :deep(li) {
  margin: 2px 0;
}

.msg-md :deep(code) {
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 11px;
  font-family: 'Consolas', monospace;
}

.msg-md :deep(pre) {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 8px 10px;
  overflow-x: auto;
  margin: 6px 0;
}

.msg-md :deep(pre code) {
  background: transparent;
  padding: 0;
}

.msg-md :deep(table) {
  border-collapse: collapse;
  margin: 6px 0;
  font-size: 11px;
}

.msg-md :deep(th),
.msg-md :deep(td) {
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 4px 8px;
}

.msg-md :deep(h1),
.msg-md :deep(h2),
.msg-md :deep(h3),
.msg-md :deep(h4) {
  font-size: 13px;
  margin: 8px 0 4px;
}

/* 标绘指令卡片 */
.plot-cards {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.plot-card {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 9px;
  border: 1px solid rgba(43, 131, 255, 0.28);
  border-radius: 8px;
  background: rgba(43, 131, 255, 0.08);
}

.plot-card-icon {
  font-size: 15px;
  color: #62c4ff;
  flex-shrink: 0;
  display: flex;
}

.plot-card-label {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  flex-shrink: 0;
}

.plot-card-name {
  flex: 1;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plot-card-status {
  font-size: 10px;
  font-weight: 600;
  color: #2ee59d;
  flex-shrink: 0;
}

.plot-card-del {
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  font-size: 13px;
  display: flex;
  padding: 2px;
  flex-shrink: 0;
  border-radius: 4px;
}

.plot-card-del:hover {
  color: #fb7185;
  background: rgba(251, 113, 133, 0.12);
}

.plot-failed {
  font-size: 10px;
  color: rgba(251, 113, 133, 0.8);
  padding: 2px 4px;
}

/* 建议问题 */
.suggested {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  width: 100%;
}

.suggested-chip {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(141, 184, 255, 0.3);
  background: rgba(141, 184, 255, 0.08);
  color: #8db8ff;
  cursor: pointer;
  transition: all 0.15s;
}

.suggested-chip:hover {
  background: rgba(141, 184, 255, 0.18);
  color: #b3d4ff;
}

/* 输入区 */
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
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
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
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: #3b82f6;
  color: #fff;
  cursor: pointer;
  font-size: 16px;
  flex-shrink: 0;
  transition:
    opacity 0.18s,
    transform 0.12s;
}

.send-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: scale(1.04);
}

.send-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.send-btn--stop {
  background: #f59e0b;
}
</style>
