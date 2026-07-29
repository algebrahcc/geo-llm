<script setup lang="ts">
import { computed, reactive } from 'vue';
import SvgIcon from '@/components/custom/svg-icon.vue';
import type { AgentCreateModel } from './types';

const emit = defineEmits<{
  submit: [payload: AgentCreateModel];
  cancel: [];
}>();

const typeOptions = [
  { label: '聊天助手', value: 1 },
  { label: '智能体', value: 2 },
  { label: '工作流', value: 3 }
] satisfies Array<{ label: string; value: Api.DifyApp.AppType }>;

const statusOptions = [
  { label: '启用', value: 1 },
  { label: '禁用', value: 2 }
] satisfies Array<{ label: string; value: Api.DifyApp.AppStatus }>;

const form = reactive<AgentCreateModel>({
  name: '',
  type: 2,
  description: '',
  baseUrl: '',
  apiKey: '',
  sort: 100,
  status: 1
});

const formValid = computed(() => Boolean(form.name.trim()));

function handleSubmit() {
  if (!form.name.trim()) {
    window.$message?.warning('请填写应用名称');
    return;
  }

  emit('submit', {
    name: form.name.trim(),
    type: form.type,
    description: form.description.trim(),
    baseUrl: form.baseUrl.trim(),
    apiKey: form.apiKey.trim(),
    sort: form.sort,
    status: form.status
  });
}
</script>

<template>
  <div class="create-form">
    <div class="step-panel">
      <div class="step-panel__header">
        <SvgIcon icon="mdi:plus-box-outline" class="step-panel__icon" />
        <div>
          <div class="step-panel__title">新建应用</div>
          <div class="step-panel__subtitle">仅开放后端已支持的基础配置项，创建后可继续在配置页维护。</div>
        </div>
      </div>

      <NAlert type="info" :show-icon="false" class="mb-16px">
        当前可创建的能力范围与后端保持一致：应用名称、类型、描述、凭据地址、排序和启用状态。
      </NAlert>

      <NForm label-placement="top" :show-feedback="false" class="step-form">
        <div class="form-grid-2">
          <NFormItem label="应用名称" required>
            <NInput v-model:value="form.name" placeholder="请输入应用名称" />
          </NFormItem>
          <NFormItem label="应用类型">
            <NSelect v-model:value="form.type" :options="typeOptions" />
          </NFormItem>
        </div>

        <NFormItem label="应用描述">
          <NInput
            v-model:value="form.description"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 5 }"
            placeholder="请输入应用说明"
          />
        </NFormItem>

        <div class="form-grid-2">
          <NFormItem label="Base URL">
            <NInput v-model:value="form.baseUrl" placeholder="留空则沿用后端默认地址" />
          </NFormItem>
          <NFormItem label="排序">
            <NInputNumber v-model:value="form.sort" class="w-full" :min="0" :max="999" />
          </NFormItem>
        </div>

        <div class="form-grid-2">
          <NFormItem label="API Key">
            <NInput
              v-model:value="form.apiKey"
              type="password"
              show-password-on="mousedown"
              placeholder="留空则沿用后端默认凭据"
            />
          </NFormItem>
          <NFormItem label="启用状态">
            <NSelect v-model:value="form.status" :options="statusOptions" />
          </NFormItem>
        </div>
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

.step-form {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
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
  .form-grid-2 {
    grid-template-columns: 1fr;
  }
}
</style>
