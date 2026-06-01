<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import SvgIcon from '@/components/custom/svg-icon.vue';
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
      ?.tools.map(item => ({ label: item, value: item })) || []
);

const outputFormatOptions = [
  { label: 'Markdown', value: 'markdown' },
  { label: 'JSON', value: 'json' },
  { label: '纯文本', value: 'text' }
];

watch(
  () => props.agentKey,
  () => {
    const config = getAgentConfigByKey(props.agentKey);
    if (config) {
      Object.assign(form, config);
    }
  },
  { immediate: true }
);

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
        <NFormItem label="系统提示词">
          <NInput v-model:value="form.systemPrompt" type="textarea" :autosize="{ minRows: 4, maxRows: 8 }" />
        </NFormItem>
        <div class="grid gap-10px md:grid-cols-2">
          <NFormItem label="模型">
            <NInput v-model:value="form.model" />
          </NFormItem>
          <NFormItem label="输出格式">
            <NSelect v-model:value="form.outputFormat" :options="outputFormatOptions" />
          </NFormItem>
          <NFormItem label="温度">
            <NSlider v-model:value="form.temperature" :min="0" :max="1" :step="0.1" />
          </NFormItem>
          <NFormItem label="超时(秒)">
            <NInputNumber v-model:value="form.timeout" :min="10" :max="300" />
          </NFormItem>
        </div>
        <NFormItem label="启用工具" class="mt-10px">
          <NCheckboxGroup v-model:value="form.enabledTools">
            <NSpace>
              <NCheckbox v-for="tool in toolOptions" :key="tool.value" :value="tool.value" :label="tool.label" />
            </NSpace>
          </NCheckboxGroup>
        </NFormItem>
        <NFormItem label="重试次数" class="mt-10px">
          <NInputNumber v-model:value="form.retry" :min="0" :max="5" />
        </NFormItem>
        <NFormItem label="发布状态">
          <NSwitch v-model:value="form.publish" />
        </NFormItem>
      </NForm>
      <div class="mt-14px flex justify-end gap-8px">
        <NButton secondary @click="Object.assign(form, getAgentConfigByKey(props.agentKey))">重置</NButton>
        <NButton type="primary" @click="handleSubmit">保存配置</NButton>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.panel-surface {
  background: linear-gradient(180deg, rgba(3, 19, 41, 0.94) 0%, rgba(2, 15, 32, 0.96) 100%);
  border: 1px solid rgba(43, 131, 255, 0.28);
  box-shadow: 0 0 0 1px rgba(32, 111, 202, 0.22), 0 18px 40px rgba(1, 8, 18, 0.45);
  border-radius: 4px;
  position: relative;
}

.panel-surface::before,
.panel-surface::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  pointer-events: none;
  z-index: 2;
  opacity: 0.35;
}

.panel-surface::before {
  top: -1px;
  left: -1px;
  border-top: 2px solid #29a3ff;
  border-left: 2px solid #29a3ff;
  border-radius: 4px 0 0 0;
}

.panel-surface::after {
  bottom: -1px;
  right: -1px;
  border-bottom: 2px solid #29a3ff;
  border-right: 2px solid #29a3ff;
  border-radius: 0 0 4px 0;
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 14px;
  border-bottom: 1px solid rgba(25, 95, 176, 0.35);
  background: linear-gradient(180deg, rgba(10, 38, 72, 0.96) 0%, rgba(5, 25, 47, 0.96) 100%);
  position: relative;
}

.panel-head::before {
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

.panel-head__icon {
  font-size: 16px;
  color: #29a3ff;
  filter: drop-shadow(0 0 4px rgba(41, 163, 255, 0.25));
}

.panel-head__title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: #eaf5ff;
  text-shadow: 0 0 8px rgba(41, 163, 255, 0.12);
}

.panel-body {
  padding: 14px;
}
</style>
