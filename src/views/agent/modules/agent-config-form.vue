<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { agentDefinitions, getAgentConfigByKey, type AgentConfigModel, type AgentKey } from '@/mock/agent';

const props = defineProps<{
  agentKey: AgentKey;
}>();

const emit = defineEmits<{
  submit: [config: AgentConfigModel];
}>();

const form = reactive<AgentConfigModel>({
  key: props.agentKey,
  systemPrompt: '',
  model: '',
  temperature: 0,
  timeout: 60,
  retry: 1,
  enabledTools: [],
  outputFormat: 'markdown',
  publish: false
});

const toolOptions = computed(
  () =>
    agentDefinitions
      .find(item => item.key === props.agentKey)
      ?.tools.map(item => ({
        label: item,
        value: item
      })) || []
);

const formatOptions = [
  { label: 'Markdown', value: 'markdown' },
  { label: 'JSON', value: 'json' },
  { label: '报告摘要', value: 'report' }
];

function syncForm() {
  const config = getAgentConfigByKey(props.agentKey);
  Object.assign(form, {
    ...config,
    enabledTools: [...config.enabledTools]
  });
}

watch(() => props.agentKey, syncForm, { immediate: true });

function handleSubmit() {
  emit('submit', {
    ...form,
    key: props.agentKey,
    enabledTools: [...form.enabledTools]
  });
}
</script>

<template>
  <NCard :bordered="false" class="config-card">
    <template #header>
      <div>
        <div class="text-16px font-700 text-[#f8fafc]">智能体配置</div>
        <div class="mt-4px text-12px text-[#8ea3bd]">维护模型、系统提示词、工具开关和输出格式。</div>
      </div>
    </template>

    <NForm label-placement="top" :show-feedback="false" class="grid gap-14px md:grid-cols-2">
      <NFormItem label="系统提示词" class="md:col-span-2">
        <NInput v-model:value="form.systemPrompt" type="textarea" :autosize="{ minRows: 4, maxRows: 6 }" />
      </NFormItem>
      <NFormItem label="模型">
        <NInput v-model:value="form.model" />
      </NFormItem>
      <NFormItem label="输出格式">
        <NSelect v-model:value="form.outputFormat" :options="formatOptions" />
      </NFormItem>
      <NFormItem label="温度系数">
        <NInputNumber v-model:value="form.temperature" :min="0" :max="1" :step="0.1" class="w-full" />
      </NFormItem>
      <NFormItem label="超时（秒）">
        <NInputNumber v-model:value="form.timeout" :min="10" :step="10" class="w-full" />
      </NFormItem>
      <NFormItem label="重试次数">
        <NInputNumber v-model:value="form.retry" :min="0" :max="5" class="w-full" />
      </NFormItem>
      <NFormItem label="发布状态">
        <div class="flex h-34px items-center">
          <NSwitch v-model:value="form.publish" />
        </div>
      </NFormItem>
      <NFormItem label="启用工具" class="md:col-span-2">
        <NCheckboxGroup v-model:value="form.enabledTools">
          <NSpace>
            <NCheckbox v-for="item in toolOptions" :key="item.value" :value="item.value" :label="item.label" />
          </NSpace>
        </NCheckboxGroup>
      </NFormItem>
    </NForm>

    <div class="mt-18px flex justify-end">
      <NButton type="primary" @click="handleSubmit">保存配置</NButton>
    </div>
  </NCard>
</template>

<style scoped>
.config-card {
  border-radius: 20px;
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 26%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.82));
}
</style>
