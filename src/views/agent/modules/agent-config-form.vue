<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import SvgIcon from '@/components/custom/svg-icon.vue';
import type { AgentKey } from './types';
import { fetchDifyAppDetail } from '@/service/api/difyApp';

const props = defineProps<{
  agentKey: AgentKey;
}>();

export interface AgentConfigFormModel {
  id: number;
  name: string;
  type: Api.DifyApp.AppType;
  description: string;
  sort: number;
  status: Api.DifyApp.AppStatus;
}

const emit = defineEmits<{
  submit: [config: AgentConfigFormModel];
}>();

const loading = defineModel<boolean>('loading', { default: false });

const form = reactive<AgentConfigFormModel>({
  id: 0,
  name: '',
  type: 2,
  description: '',
  sort: 0,
  status: 1
});

const typeOptions = [
  { label: '聊天助手', value: 1 },
  { label: '智能体', value: 2 },
  { label: '工作流', value: 3 }
];

async function loadConfig() {
  if (!props.agentKey) return;
  loading.value = true;
  try {
    const res = await fetchDifyAppDetail(Number(props.agentKey));
    const app = res?.data || null;
    if (app) {
      Object.assign(form, {
        id: app.id,
        name: app.name,
        type: app.type,
        description: app.description || '',
        sort: app.sort || 0,
        status: app.status
      });
    }
  } catch {
    window.$message?.error('加载应用配置失败');
  } finally {
    loading.value = false;
  }
}

watch(() => props.agentKey, loadConfig, { immediate: true });

const statusLabel = computed(() => (form.status === 1 ? '启用' : '禁用'));

function handleSubmit() {
  emit('submit', { ...form });
}
</script>

<template>
  <div class="panel-surface">
    <div class="panel-head">
      <SvgIcon icon="mdi:cog-outline" class="panel-head__icon" />
      <span class="panel-head__title">配置表单</span>
    </div>
    <div class="panel-body">
      <NForm label-placement="top" :show-feedback="false">
        <NFormItem label="应用名称">
          <NInput v-model:value="form.name" />
        </NFormItem>
        <div class="grid gap-10px md:grid-cols-2">
          <NFormItem label="应用类型">
            <NSelect v-model:value="form.type" :options="typeOptions" />
          </NFormItem>
          <NFormItem label="排序">
            <NInputNumber v-model:value="form.sort" :min="0" :max="999" />
          </NFormItem>
          <NFormItem label="状态">
            <NSwitch :value="form.status === 1" @update:value="value => (form.status = value ? 1 : 2)" />
            <span class="ml-10px text-12px text-[rgba(147,196,255,0.55)]">{{ statusLabel }}</span>
          </NFormItem>
        </div>
        <NFormItem label="应用描述" class="mt-10px">
          <NInput v-model:value="form.description" type="textarea" :autosize="{ minRows: 4, maxRows: 8 }" />
        </NFormItem>
      </NForm>
      <div class="mt-14px flex justify-end gap-8px">
        <NButton secondary :loading="loading" @click="loadConfig">重置</NButton>
        <NButton type="primary" :loading="loading" @click="handleSubmit">保存配置</NButton>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.field-tip {
  margin-top: 6px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  font-size: 11px;
  color: rgba(147, 196, 255, 0.55);
}
</style>
