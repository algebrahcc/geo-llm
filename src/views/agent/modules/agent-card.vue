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
      return { label: '聊天助手', color: 'var(--ui-sem-blue)', icon: 'mdi:chat-outline' };
    case 2:
      return { label: '智能体', color: 'var(--ui-sem-indigo)', icon: 'mdi:robot-outline' };
    case 3:
      return { label: '工作流', color: 'var(--ui-sem-green)', icon: 'mdi:workflow' };
    default:
      return { label: '未知', color: '#64748b', icon: 'mdi:help-circle-outline' };
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
      return 'linear-gradient(135deg, var(--ui-sem-blue), var(--ui-sem-sky))';
    case 2:
      return 'linear-gradient(135deg, var(--ui-sem-indigo), var(--ui-sem-violet))';
    case 3:
      return 'linear-gradient(135deg, var(--ui-sem-green), var(--ui-sem-teal))';
    default:
      return 'linear-gradient(135deg, #64748b, #94a3b8)';
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
    box-shadow: 0 0 14px var(--ui-accent-136);
  }

  &__avatar-icon {
    font-size: 22px;
  }

  &__status {
    font-size: 12px;
    padding: 3px 9px;
    border-radius: 999px;

    &.is-on {
      color: var(--ui-accent-137);
      background: var(--ui-border-118);
      border: 1px solid var(--ui-border-119);
    }

    &.is-off {
      color: var(--agent-text-mute);
      background: var(--ui-text-91);
      border: 1px solid var(--ui-text-92);
    }
  }

  &__body {
    flex: 1;
    min-height: 50px;
  }

  &__title {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.2px;
    color: var(--agent-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__desc {
    margin-top: 5px;
    font-size: 13px;
    line-height: 1.6;
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
  width: 30px;
  height: 30px;
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
    background: var(--ui-accent-61);
    color: var(--ui-text-82);
  }
}
</style>
