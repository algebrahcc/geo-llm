<script setup lang="ts">
import { computed, reactive } from 'vue';
import SvgIcon from '@/components/custom/svg-icon.vue';
import type { AgentCreateModel } from './types';

const emit = defineEmits<{
  submit: [payload: AgentCreateModel];
  cancel: [];
}>();

const typeCards = [
  {
    value: 2,
    icon: 'mdi:robot-outline',
    label: 'Agent',
    desc: '面向复杂任务的智能体，可调用工具、多轮推理',
    accent: '#8b5cf6'
  },
  {
    value: 1,
    icon: 'mdi:chat-outline',
    label: '聊天助手',
    desc: '基于大模型的对话式应用，支持知识库问答',
    accent: '#38bdf8'
  },
  {
    value: 3,
    icon: 'mdi:workflow-outline',
    label: '工作流',
    desc: '拖拽编排的流程式应用，精确控制执行逻辑',
    accent: '#34d399'
  }
] satisfies Array<{
  value: Api.DifyApp.AppType;
  icon: string;
  label: string;
  desc: string;
  accent: string;
}>;

const form = reactive<Pick<AgentCreateModel, 'name' | 'type' | 'description'>>({
  name: '',
  type: 2,
  description: ''
});

const formValid = computed(() => Boolean(form.name.trim()));

function selectType(value: Api.DifyApp.AppType) {
  form.type = value;
}

function handleSubmit() {
  if (!form.name.trim()) {
    window.$message?.warning('请填写应用名称');
    return;
  }

  emit('submit', {
    name: form.name.trim(),
    type: form.type,
    description: form.description?.trim() ?? ''
  });
}
</script>

<template>
  <div class="create-form">
    <div class="step-panel">
      <div class="step-panel__header">
        <SvgIcon icon="mdi:plus-box-outline" class="step-panel__icon" />
        <div>
          <div class="step-panel__title">创建应用</div>
          <div class="step-panel__subtitle">创建应用到编排平台并登记到本地，创建后可继续编排。</div>
        </div>
      </div>

      <div class="type-grid">
        <button
          v-for="card in typeCards"
          :key="card.value"
          type="button"
          class="type-card"
          :class="{ 'type-card--active': form.type === card.value }"
          :style="{ '--card-accent': card.accent }"
          @click="selectType(card.value)"
        >
          <div class="type-card__icon" :style="{ color: card.accent }">
            <SvgIcon :icon="card.icon" />
          </div>
          <div class="type-card__label">{{ card.label }}</div>
          <div class="type-card__desc">{{ card.desc }}</div>
          <div class="type-card__radio">
            <span class="radio-dot" :class="{ 'is-on': form.type === card.value }" />
          </div>
        </button>
      </div>

      <NForm label-placement="top" :show-feedback="false" class="step-form">
        <NFormItem label="应用名称" required>
          <NInput v-model:value="form.name" placeholder="请输入应用名称" @keydown.enter.prevent="handleSubmit" />
        </NFormItem>

        <NFormItem label="应用描述">
          <NInput
            v-model:value="form.description"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 5 }"
            placeholder="请输入应用说明（可选）"
          />
        </NFormItem>
      </NForm>

      <div class="step-actions">
        <NButton quaternary @click="emit('cancel')">取消</NButton>
        <div class="flex-1" />
        <NButton type="primary" :disabled="!formValid" @click="handleSubmit">
          <template #icon>
            <SvgIcon icon="mdi:rocket-launch-outline" />
          </template>
          创建应用
        </NButton>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.create-form {
  min-width: 0;
}

.step-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.step-panel__header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(25, 95, 176, 0.2);
}

.step-panel__icon {
  font-size: 22px;
  color: var(--accent, #29a3ff);
  filter: drop-shadow(0 0 8px rgba(41, 163, 255, 0.25));
  margin-top: 2px;
}

.step-panel__title {
  font-size: 16px;
  font-weight: 700;
  color: #eaf5ff;
  line-height: 1.3;
}

.step-panel__subtitle {
  font-size: 12px;
  color: rgba(147, 196, 255, 0.5);
  margin-top: 3px;
}

.type-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.type-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 14px;
  border: 1px solid rgba(25, 95, 176, 0.25);
  border-radius: 12px;
  background: rgba(6, 20, 38, 0.5);
  color: #eaf5ff;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--card-accent);
    background: rgba(10, 32, 58, 0.6);
    transform: translateY(-1px);
  }

  &--active {
    border-color: var(--card-accent);
    background: rgba(10, 32, 58, 0.7);
    box-shadow: inset 0 0 16px rgba(52, 168, 255, 0.12);
  }

  &__icon {
    font-size: 22px;
    filter: drop-shadow(0 0 8px color-mix(in srgb, var(--card-accent) 55%, transparent));
  }

  &__label {
    font-size: 14px;
    font-weight: 700;
  }

  &__desc {
    font-size: 11px;
    line-height: 1.45;
    color: rgba(147, 196, 255, 0.55);
    min-height: 32px;
  }

  &__radio {
    margin-top: 2px;
  }
}

.radio-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(147, 196, 255, 0.4);
  border-radius: 50%;
  transition: all 0.2s ease;

  &.is-on {
    border-color: var(--card-accent);
    background: radial-gradient(circle, var(--card-accent) 0 4px, transparent 5px);
    box-shadow: 0 0 8px color-mix(in srgb, var(--card-accent) 60%, transparent);
  }
}

.step-form {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.step-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 16px;
  margin-top: auto;
  border-top: 1px solid rgba(25, 95, 176, 0.18);
}

@media (max-width: 900px) {
  .type-grid {
    grid-template-columns: 1fr;
  }
}
</style>
