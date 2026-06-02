<script setup lang="ts">
import { ref } from 'vue';

defineOptions({
  name: 'BuildingAiAssistant'
});

defineProps<{
  collapsed: boolean;
  running: boolean;
}>();

const emit = defineEmits<{
  'toggle-collapse': [];
  send: [message: string];
}>();

// 对话消息
const chatInput = ref('');
const messages = ref<Array<{ id: string; role: 'assistant' | 'user'; content: string }>>([
  {
    id: 'welcome',
    role: 'assistant',
    content: '您好，我是楼宇夺控AI助手。当前目标为第聂伯公寓（5层苏式居民楼），3-5层为敌占区域。请告知您的分析需求。'
  }
]);

const actionTags = [
  { label: '楼层结构分析', icon: 'mdi:domain' },
  { label: '逐层清剿路线', icon: 'mdi:map-marker-path' },
  { label: '火力点定位', icon: 'mdi:crosshairs-gps' },
  { label: '平民风险评估', icon: 'mdi:shield-alert' },
  { label: '突入方案生成', icon: 'mdi:tactical-helmet' },
  { label: '撤离路线规划', icon: 'mdi:chart-timeline-variant-shimmer' }
];

function handleSend() {
  const text = chatInput.value.trim();
  if (!text) return;
  emit('send', text);
  messages.value.push({ id: `u-${Date.now()}`, role: 'user', content: text });
  chatInput.value = '';
}

function handleQuickAction(label: string) {
  const msg = `请${label}`;
  messages.value.push({ id: `q-${Date.now()}`, role: 'user', content: msg });
  emit('send', msg);
}
</script>

<template>
  <div class="ai-panel" :class="{ 'ai-panel--collapsed': collapsed }">
    <!-- 标题栏 -->
    <div class="panel-header">
      <span class="header-icon">🤖</span>
      <span class="header-title">AI对话</span>
      <span class="agent-status" :class="{ 'agent-status--online': !running, 'agent-status--busy': running }">
        <span class="status-dot" />
        {{ running ? '思考中' : '在线' }}
      </span>
      <button type="button" class="action-btn" title="折叠" @click="emit('toggle-collapse')">
        <SvgIcon :icon="collapsed ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
      </button>
    </div>

    <div v-show="!collapsed" class="panel-content">
      <!-- 欢迎语 -->
      <div class="greeting-box">
        <SvgIcon icon="mdi:robot-outline" class="greet-icon" />
        <span>{{ messages[0]?.content }}</span>
      </div>

      <!-- 快捷操作按钮 -->
      <div class="action-tags">
        <button
          v-for="tag in actionTags"
          :key="tag.label"
          type="button"
          class="action-tag-btn"
          @click="handleQuickAction(tag.label)"
        >
          <SvgIcon :icon="tag.icon" />
          {{ tag.label }}
        </button>
      </div>

      <!-- 示例按钮 -->
      <div class="example-action">
        <NButton size="small" type="primary" block @click="handleQuickAction('分析第3层敌火力分布和弱点')">
          请分析第3层敌火力分布和弱点
        </NButton>
      </div>

      <!-- 思考中状态 -->
      <div v-if="running" class="thinking-bar">
        <SvgIcon icon="mdi:loading" class="think-spin" />
        <span>正在思考中......</span>
      </div>

      <!-- 对话记录 -->
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
        placeholder="输入您的指令..."
        @keyup.enter="handleSend"
      />
      <button type="button" class="send-btn" :disabled="!chatInput.trim()" @click="handleSend">
        <SvgIcon icon="mdi:send" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.ai-panel {
  width: 400px;
  max-height: 340px;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: rgba(8, 14, 26, 0.92);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255,255,255,0.03);
  backdrop-filter: blur(22px);
  overflow: hidden;
}
.ai-panel--collapsed { max-height: 44px; }

.panel-header {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
  background: rgba(255,255,255,0.01);
}
.header-icon { font-size: 18px; }
.header-title { flex: 1; font-size: 14px; font-weight: 700; color: rgba(255,255,255,0.9); }

.agent-status {
  display: flex; align-items: center; gap: 5px;
  font-size: 10px; padding: 3px 10px; border-radius: 999px; font-weight: 600;
}
.status-dot { width: 6px; height: 6px; border-radius: 50%; }
.agent-status--online { background: rgba(34,197,94,0.12); color: #4ade80; border: 1px solid rgba(34,197,94,0.2); }
.agent-status--online .status-dot { background: #4ade80; box-shadow: 0 0 5px rgba(34,197,94,0.4); animation: pulse-dot 2s infinite; }
.agent-status--busy { background: rgba(251,191,36,0.12); color: #fbbf24; border: 1px solid rgba(251,191,36,0.2); animation: glow 1.8s infinite; }
.agent-status--busy .status-dot { background: #fbbf24; }
@keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.4} }
@keyframes glow { 0%,100%{box-shadow:0 0 6px rgba(251,191,36,.2)} 50%{box-shadow:0 0 16px rgba(251,191,36,.45)} }

.action-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: none; border-radius: 6px;
  background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.4);
  cursor: pointer; transition: all 0.15s;
}
.action-btn:hover { background: rgba(99,102,241,0.12); color: rgba(255,255,255,0.85); }

.panel-content {
  flex: 1; min-height: 0; overflow-y: auto; padding: 10px 14px 8px;
  scrollbar-width: thin; scrollbar-color: rgba(99,102,241,0.2) transparent;
}
.panel-content::-webkit-scrollbar { width: 4px; }
.panel-content::-webkit-scrollbar-thumb { border-radius: 999px; background: rgba(99,102,241,0.15); }

.greeting-box {
  display: flex; gap: 8px; align-items: flex-start;
  padding: 10px 12px; border-radius: 10px; margin-bottom: 10px;
  background: rgba(99,102,241,0.06); border: 1px solid rgba(99,102,241,0.1);
  border-left: 2px solid #6366f1;
}
.greet-icon { font-size: 18px; flex-shrink: 0; color: #6366f1; }
.greeting-box span:last-child { font-size: 12px; color: rgba(255,255,255,0.7); line-height: 1.6; }

.action-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; }
.action-tag-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 10px; border: 1px solid rgba(129,140,248,0.18);
  border-radius: 8px; background: rgba(129,140,248,0.06);
  color: #a5b4fc; font-size: 11px; font-weight: 500;
  cursor: pointer; transition: all 0.18s ease;
}
.action-tag-btn:hover {
  background: rgba(129,140,248,0.14); border-color: rgba(99,102,241,0.35);
  transform: translateY(-1px); box-shadow: 0 2px 8px rgba(99,102,241,0.15);
}
.action-tag-btn .n-icon { font-size: 12px; }

.example-action { margin-bottom: 8px; }

.thinking-bar {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  background: rgba(251,191,36,0.06); border: 1px solid rgba(251,191,36,0.12);
  border-left: 2px solid #fbbf24; border-radius: 8px;
  font-size: 12px; color: rgba(251,191,36,0.9);
}
.think-spin { animation: spin 0.8s linear infinite; font-size: 15px; color: #fbbf24; }
@keyframes spin { to { transform: rotate(360deg); } }

.chat-messages { margin-top: 6px; }
.chat-msg { display: flex; gap: 8px; padding: 4px 0; align-items: flex-start; animation: msg-in 0.2s ease; }
@keyframes msg-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
.chat-msg--user { flex-direction: row-reverse; }
.msg-avatar { font-size: 16px; flex-shrink: 0; line-height: 1; }
.msg-bubble {
  font-size: 12px; padding: 7px 11px; border-radius: 10px;
  max-width: 80%; line-height: 1.5;
}
.msg-bubble--assistant { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.65); border-top-left-radius: 2px; }
.msg-bubble--user { background: rgba(99,102,241,0.15); color: rgba(255,255,255,0.9); border-top-right-radius: 2px; }

.chat-input-area {
  padding: 10px 14px; border-top: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0; background: rgba(15,23,42,0.85);
  backdrop-filter: blur(8px); display: flex; gap: 8px; align-items: center;
}
.chat-input {
  flex: 1; padding: 9px 12px;
  border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;
  background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.88);
  font-size: 12px; outline: none; transition: all 0.2s;
}
.chat-input::placeholder { color: rgba(255,255,255,0.22); }
.chat-input:focus { border-color: rgba(99,102,241,0.45); box-shadow: 0 0 0 2px rgba(99,102,241,0.08); }

.send-btn {
  display: flex; align-items: center; justify-content: center;
  width: 38px; height: 38px; border: none; border-radius: 10px;
  background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff;
  cursor: pointer; font-size: 15px; transition: all 0.15s; flex-shrink: 0;
}
.send-btn:hover:not(:disabled) { opacity: 0.92; transform: scale(1.04); box-shadow: 0 4px 12px rgba(99,102,241,0.3); }
.send-btn:active:not(:disabled) { transform: scale(0.95); }
.send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
</style>
