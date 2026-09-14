<script setup lang="ts">
import { computed } from 'vue';
import { NTag } from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import type { AgentDefinition, AgentKey } from './types';

const props = defineProps<{
  activeKey: AgentKey;
  /** 智能体列表：未传时为空 */
  agents?: AgentDefinition[];
  /** 是否正在从后端加载真实智能体 */
  loading?: boolean;
}>();

const emit = defineEmits<{
  select: [key: AgentKey];
  create: [];
  refresh: [];
}>();

const runtimeMeta = {
  online: { label: '在线', type: 'success' as const },
  busy: { label: '繁忙', type: 'warning' as const },
  draft: { label: '草稿', type: 'default' as const }
};

const items = computed(() => props.agents ?? []);
</script>

<template>
  <div class="sidebar-panel">
    <div class="panel-head">
      <SvgIcon icon="mdi:robot" class="panel-head__icon" />
      <span class="panel-head__title">智能体列表</span>
      <div class="panel-head__extra">
        <button
          type="button"
          class="header-create-btn"
          title="刷新真实数据"
          :disabled="loading"
          @click="emit('refresh')"
        >
          <SvgIcon icon="mdi:refresh" :class="{ 'is-spin': loading }" />
        </button>
        <button type="button" class="header-create-btn" title="新建智能体" @click="emit('create')">
          <SvgIcon icon="mdi:plus" />
        </button>
      </div>
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
                <span>{{ item.category || '--' }}</span>
                <span>{{ item.model || '默认引擎' }}</span>
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

.header-create-btn {
  margin-left: auto;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid var(--ui-border-71);
  background: var(--ui-border-36);
  color: var(--ui-text-90);
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.header-create-btn:hover {
  border-color: var(--ui-accent-24);
  background: var(--ui-border-62);
  color: var(--ui-accent-4);
  box-shadow: 0 0 10px var(--ui-border-39);
}

.header-create-btn .is-spin {
  animation: agent-spin 0.8s linear infinite;
}

@keyframes agent-spin {
  to {
    transform: rotate(360deg);
  }
}

.sidebar-panel__body {
  flex: 1;
  min-height: 0;
  padding: 8px;
  overflow: auto;
}

.agent-item {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease;
}

.agent-item:hover {
  background: linear-gradient(90deg, var(--ui-border-66) 0%, var(--ui-surface-32) 100%);
  border-color: var(--ui-border-67);
}

.agent-item--active {
  background: linear-gradient(90deg, var(--ui-border-68) 0%, var(--ui-surface-33) 100%);
  border-color: var(--ui-accent-67);
  box-shadow: inset 2px 0 0 var(--ui-accent-4);
}

.agent-name {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: var(--ui-text-76);
  line-height: 1.5;
}

.agent-item--active .agent-name {
  color: var(--ui-text-1);
}

.agent-slogan {
  margin-top: 5px;
  font-size: 14px;
  line-height: 20px;
  color: var(--ui-text-45);
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
  font-size: 13px;
  color: var(--ui-text-88);
}

.agent-icon {
  display: flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: var(--ui-border-7);
  border: 1px solid var(--ui-border-50);
  color: var(--ui-text-76);
  flex-shrink: 0;
}
</style>
