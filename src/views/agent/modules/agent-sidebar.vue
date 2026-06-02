<script setup lang="ts">
import { computed } from 'vue';
import { NTag } from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { agentDefinitions, getTasksByAgentKey, type AgentKey } from '@/mock/agent';

defineProps<{
  activeKey: AgentKey;
}>();

const emit = defineEmits<{
  select: [key: AgentKey];
  create: [];
}>();

const runtimeMeta = {
  online: { label: '在线', type: 'success' as const },
  busy: { label: '繁忙', type: 'warning' as const },
  draft: { label: '草稿', type: 'default' as const }
};

const items = computed(() =>
  agentDefinitions.map(item => ({
    ...item,
    taskCount: getTasksByAgentKey(item.key).length
  }))
);
</script>

<template>
  <div class="sidebar-panel">
    <div class="sidebar-panel__header">
      <SvgIcon icon="mdi:robot" class="sidebar-panel__header-icon" />
      <span class="sidebar-panel__header-title">智能体列表</span>
      <button type="button" class="header-create-btn" title="新建智能体" @click="emit('create')">
        <SvgIcon icon="mdi:plus" />
      </button>
    </div>
    <div class="sidebar-panel__body">
      <div class="flex flex-col gap-8px">
        <button
          v-for="item in items"
          :key="item.key"
          type="button"
          class="agent-item"
          :class="[{ 'agent-item--active': item.key === activeKey }]"
          @click="emit('select', item.key)"
        >
          <div class="flex items-start gap-10px">
            <div class="agent-icon">
              <SvgIcon :icon="item.icon" />
            </div>
            <div class="min-w-0 flex-1 text-left">
              <div class="flex items-center justify-between gap-6px">
                <div class="agent-name">{{ item.name }}</div>
                <NTag size="small" round :type="runtimeMeta[item.status].type" :bordered="false">
                  {{ runtimeMeta[item.status].label }}
                </NTag>
              </div>
              <div class="agent-slogan">{{ item.slogan }}</div>
              <div class="agent-meta">
                <span>{{ item.model }}</span>
                <span>{{ item.taskCount }} 条任务</span>
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.sidebar-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sidebar-panel__header {
  display: flex;
  align-items: center;
  height: 46px;
  padding: 0 14px;
  border-bottom: 1px solid rgba(25, 95, 176, 0.35);
  background: linear-gradient(180deg, rgba(10, 38, 72, 0.96) 0%, rgba(5, 25, 47, 0.96) 100%);
  position: relative;
}

.sidebar-panel__header::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  bottom: 20%;
  width: 2px;
  border-radius: 1px;
  background: linear-gradient(180deg, transparent, #29a3ff, transparent);
  opacity: 0.5;
}

.sidebar-panel__header-icon {
  font-size: 16px;
  color: #29a3ff;
  filter: drop-shadow(0 0 4px rgba(41, 163, 255, 0.25));
}

.sidebar-panel__header-title {
  margin-left: 8px;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: #eaf5ff;
  text-shadow: 0 0 8px rgba(41, 163, 255, 0.12);
}

.header-create-btn {
  margin-left: auto;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid rgba(41, 163, 255, 0.3);
  background: rgba(41, 163, 255, 0.08);
  color: rgba(147, 196, 255, 0.6);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.header-create-btn:hover {
  border-color: rgba(41, 163, 255, 0.6);
  background: rgba(41, 163, 255, 0.15);
  color: #29a3ff;
  box-shadow: 0 0 10px rgba(41, 163, 255, 0.2);
}

.sidebar-panel__body {
  flex: 1;
  min-height: 0;
  padding: 8px;
  overflow: auto;
}

.sidebar-panel__body::-webkit-scrollbar {
  width: 8px;
}

.sidebar-panel__body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(48, 127, 212, 0.58);
}

.sidebar-panel__body::-webkit-scrollbar-track {
  background: rgba(4, 20, 40, 0.45);
}

.agent-item {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease;
}

.agent-item:hover {
  background: linear-gradient(90deg, rgba(17, 79, 153, 0.16) 0%, rgba(8, 37, 74, 0.16) 100%);
  border-color: rgba(47, 133, 225, 0.22);
}

.agent-item--active {
  background: linear-gradient(90deg, rgba(19, 95, 182, 0.38) 0%, rgba(9, 46, 92, 0.16) 100%);
  border-color: rgba(61, 166, 255, 0.28);
  box-shadow: inset 2px 0 0 #29a3ff;
}

.agent-name {
  font-size: 13px;
  font-weight: 600;
  color: rgba(203, 227, 255, 0.82);
  line-height: 1.4;
}

.agent-item--active .agent-name {
  color: #fff;
}

.agent-slogan {
  margin-top: 4px;
  font-size: 11px;
  line-height: 16px;
  color: rgba(147, 196, 255, 0.5);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.agent-meta {
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: rgba(147, 196, 255, 0.45);
}

.agent-icon {
  display: flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: rgba(41, 163, 255, 0.12);
  border: 1px solid rgba(41, 163, 255, 0.22);
  color: rgba(203, 227, 255, 0.82);
  flex-shrink: 0;
}
</style>
