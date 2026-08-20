<script setup lang="ts">
import { computed } from 'vue';
import { NTag } from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import type { AgentDefinition } from './types';

const props = defineProps<{
  app: AgentDefinition;
}>();

const emit = defineEmits<{
  open: [app: AgentDefinition];
  config: [app: AgentDefinition];
  edit: [app: AgentDefinition];
  remove: [app: AgentDefinition];
  orchestrate: [app: AgentDefinition];
}>();

const typeMeta = computed(() => {
  switch (props.app.appType) {
    case 1:
      return { label: '聊天助手', color: '#3b82f6', icon: 'mdi:chat-outline' };
    case 2:
      return { label: '智能体', color: '#8b5cf6', icon: 'mdi:robot-outline' };
    case 3:
      return { label: '工作流', color: '#10b981', icon: 'mdi:workflow' };
    default:
      return { label: '未知', color: '#9ca3af', icon: 'mdi:help-circle-outline' };
  }
});

const statusMeta = computed(() => {
  switch (props.app.status) {
    case 'online':
      return { label: '在线', on: true };
    case 'busy':
      return { label: '繁忙', on: true };
    default:
      return { label: '草稿', on: false };
  }
});

const avatarBg = computed(() => {
  switch (props.app.appType) {
    case 1:
      return 'linear-gradient(135deg, #3b82f6, #60a5fa)';
    case 2:
      return 'linear-gradient(135deg, #8b5cf6, #a78bfa)';
    case 3:
      return 'linear-gradient(135deg, #10b981, #34d399)';
    default:
      return 'linear-gradient(135deg, #9ca3af, #cbd5e1)';
  }
});
</script>

<template>
  <div class="agent-card grid-card" @click="emit('orchestrate', app)">
    <div class="grid-card__top">
      <div class="grid-card__avatar" :style="{ background: avatarBg }">
        <SvgIcon v-if="app.icon" :icon="app.icon" class="grid-card__avatar-icon" />
        <SvgIcon v-else :icon="typeMeta.icon" class="grid-card__avatar-icon" />
      </div>
      <span class="grid-card__status" :class="statusMeta.on ? 'is-on' : 'is-off'">
        {{ statusMeta.label }}
      </span>
    </div>

    <div class="grid-card__body">
      <div class="grid-card__title" :title="app.name">{{ app.name }}</div>
      <div class="grid-card__desc" :title="app.description">{{ app.description || app.slogan || '暂无描述' }}</div>
    </div>

    <div class="grid-card__foot">
      <NTag size="small" round :bordered="false" class="agent-tag-soft">
        <template #icon>
          <SvgIcon :icon="typeMeta.icon" />
        </template>
        {{ typeMeta.label }}
      </NTag>
      <div class="grid-card__actions" @click.stop>
        <button type="button" class="card-action" title="运行" @click="emit('open', app)">
          <SvgIcon icon="mdi:play-circle-outline" />
        </button>
        <button type="button" class="card-action" title="配置" @click="emit('config', app)">
          <SvgIcon icon="mdi:tune-variant" />
        </button>
        <button type="button" class="card-action" title="前往编排" @click="emit('orchestrate', app)">
          <SvgIcon icon="mdi:open-in-new" />
        </button>
        <button type="button" class="card-action" title="编辑" @click="emit('edit', app)">
          <SvgIcon icon="mdi:pencil-outline" />
        </button>
        <button type="button" class="card-action card-action--danger" title="删除" @click="emit('remove', app)">
          <SvgIcon icon="mdi:delete-outline" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.grid-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  cursor: pointer;

  &__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: var(--agent-radius-sm);
    color: #fff;
    box-shadow: 0 0 14px rgba(52, 168, 255, 0.18);
  }

  &__avatar-icon {
    font-size: 22px;
  }

  &__status {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 999px;

    &.is-on {
      color: #5ce6c8;
      background: rgba(0, 212, 170, 0.12);
      border: 1px solid rgba(0, 212, 170, 0.22);
    }

    &.is-off {
      color: var(--agent-text-mute);
      background: rgba(147, 196, 255, 0.08);
      border: 1px solid rgba(147, 196, 255, 0.18);
    }
  }

  &__body {
    flex: 1;
    min-height: 50px;
  }

  &__title {
    font-size: 14px;
    font-weight: 700;
    color: var(--agent-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__desc {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--agent-text-mute);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__actions {
    display: flex;
    gap: 2px;
  }
}

.card-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--agent-text-mute);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: var(--agent-accent-soft);
    color: var(--agent-accent);
  }

  &--danger:hover {
    background: rgba(239, 68, 68, 0.12);
    color: #ff7a7a;
  }
}
</style>
