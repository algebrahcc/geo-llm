<script setup lang="ts">
import { reactive, ref, computed, watch } from 'vue';
import { NDynamicTags } from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import {
  agentCategoryOptions,
  agentIconOptions,
  agentModelOptions,
  agentToolOptions,
  type AgentCreateModel
} from '@/mock/agent';

const emit = defineEmits<{
  submit: [payload: AgentCreateModel];
  cancel: [];
  'update:preview': [snapshot: PreviewSnapshot];
}>();

interface PreviewSnapshot {
  name: string;
  slogan: string;
  description: string;
  category: string;
  icon: string;
  model: string;
  capabilityTags: string[];
  tools: string[];
}

const currentStep = ref(0);

const steps = [
  { label: '基础信息', desc: '名称、描述与图标', icon: 'mdi:card-account-details-outline' },
  { label: '模型与参数', desc: '选择模型并调节参数', icon: 'mdi:tune-variant' },
  { label: '能力配置', desc: '工具链与能力标签', icon: 'mdi:toolbox-outline' },
  { label: '提示词', desc: '系统提示词与默认输入', icon: 'mdi:text-box-edit-outline' }
];

const form = reactive<AgentCreateModel>({
  name: '',
  slogan: '',
  description: '',
  category: '其他',
  icon: 'mdi:robot',
  model: 'Qwen-3.6-Plus',
  temperature: 0.3,
  timeout: 90,
  retry: 1,
  tools: [],
  capabilityTags: [],
  recommendedPrompts: [],
  systemPrompt: '',
  defaultInput: ''
});

const toolCheckboxOptions = agentToolOptions.map(t => ({ label: t, value: t }));

const formValid = computed(() => form.name.trim() && form.slogan.trim() && form.description.trim());

// Emit preview snapshot on any form change
watch(
  () => ({
    name: form.name,
    slogan: form.slogan,
    description: form.description,
    category: form.category,
    icon: form.icon,
    model: form.model,
    capabilityTags: form.capabilityTags,
    tools: form.tools
  }),
  snapshot => {
    emit('update:preview', {
      name: snapshot.name || '未命名智能体',
      slogan: snapshot.slogan || '一句话描述核心能力',
      description: snapshot.description || '智能体功能和应用场景描述',
      category: snapshot.category,
      icon: snapshot.icon,
      model: snapshot.model,
      capabilityTags: [...snapshot.capabilityTags],
      tools: [...snapshot.tools]
    });
  },
  { immediate: true, deep: true }
);

function nextStep() {
  if (currentStep.value < steps.length - 1) currentStep.value++;
}

function prevStep() {
  if (currentStep.value > 0) currentStep.value--;
}

function handleSubmit() {
  if (!form.name.trim()) {
    window.$message?.warning('请填写智能体名称');
    currentStep.value = 0;
    return;
  }
  if (!form.slogan.trim()) {
    window.$message?.warning('请填写智能体标语');
    currentStep.value = 0;
    return;
  }
  if (!form.description.trim()) {
    window.$message?.warning('请填写智能体描述');
    currentStep.value = 0;
    return;
  }
  emit('submit', {
    ...form,
    capabilityTags: [...form.capabilityTags],
    tools: [...form.tools],
    recommendedPrompts: [...form.recommendedPrompts]
  });
}
</script>

<template>
  <div class="create-form">
    <!-- Vertical Step Navigator -->
    <div class="step-nav">
      <div
        v-for="(step, idx) in steps"
        :key="idx"
        class="step-nav__item"
        :class="{
          'step-nav__item--active': idx === currentStep,
          'step-nav__item--done': idx < currentStep
        }"
        @click="idx <= currentStep && (currentStep = idx)"
      >
        <div class="step-nav__indicator">
          <div class="step-nav__dot">
            <SvgIcon v-if="idx < currentStep" icon="mdi:check" class="step-nav__check" />
            <SvgIcon v-else :icon="step.icon" class="step-nav__step-icon" />
          </div>
          <div v-if="idx < steps.length - 1" class="step-nav__line" :class="{ 'step-nav__line--done': idx < currentStep }" />
        </div>
        <div class="step-nav__text">
          <div class="step-nav__label">{{ step.label }}</div>
          <div class="step-nav__desc">{{ step.desc }}</div>
        </div>
      </div>
    </div>

    <!-- Step Content Area -->
    <div class="step-content-area">
      <Transition name="step-fade" mode="out-in">
        <!-- Step 1: 基础信息 -->
        <div v-if="currentStep === 0" key="step-0" class="step-panel">
          <div class="step-panel__header">
            <SvgIcon icon="mdi:card-account-details-outline" class="step-panel__icon" />
            <div>
              <div class="step-panel__title">基础信息</div>
              <div class="step-panel__subtitle">设定智能体的身份标识与基本属性</div>
            </div>
          </div>
          <NForm label-placement="top" :show-feedback="false" class="step-form">
            <div class="form-grid-2">
              <NFormItem label="名称" required>
                <NInput v-model:value="form.name" placeholder="如：气象研判助手" />
              </NFormItem>
              <NFormItem label="标语" required>
                <NInput v-model:value="form.slogan" placeholder="一句话描述核心能力" />
              </NFormItem>
            </div>
            <NFormItem label="描述" required>
              <NInput v-model:value="form.description" type="textarea" :autosize="{ minRows: 3, maxRows: 5 }" placeholder="详细描述智能体的功能和应用场景" />
            </NFormItem>
            <div class="form-grid-2">
              <NFormItem label="分类">
                <NSelect v-model:value="form.category" :options="agentCategoryOptions" />
              </NFormItem>
              <NFormItem label="图标">
                <NSelect v-model:value="form.icon" :options="agentIconOptions" :render-tag="() => undefined" />
              </NFormItem>
            </div>
          </NForm>
        </div>

        <!-- Step 2: 模型与参数 -->
        <div v-else-if="currentStep === 1" key="step-1" class="step-panel">
          <div class="step-panel__header">
            <SvgIcon icon="mdi:tune-variant" class="step-panel__icon" />
            <div>
              <div class="step-panel__title">模型与参数</div>
              <div class="step-panel__subtitle">选择底层模型并调节推理参数</div>
            </div>
          </div>
          <NForm label-placement="top" :show-feedback="false" class="step-form">
            <NFormItem label="模型">
              <NSelect v-model:value="form.model" :options="agentModelOptions" />
            </NFormItem>
            <NFormItem label="温度 (Temperature)">
              <div class="w-full temperature-control">
                <NSlider v-model:value="form.temperature" :min="0" :max="1" :step="0.1" :marks="{ 0: '精确', 0.5: '平衡', 1: '创意' }" />
              </div>
            </NFormItem>
            <div class="form-grid-2">
              <NFormItem label="超时(秒)">
                <NInputNumber v-model:value="form.timeout" :min="10" :max="300" class="w-full" />
              </NFormItem>
              <NFormItem label="重试次数">
                <NInputNumber v-model:value="form.retry" :min="0" :max="5" class="w-full" />
              </NFormItem>
            </div>
          </NForm>
        </div>

        <!-- Step 3: 能力配置 -->
        <div v-else-if="currentStep === 2" key="step-2" class="step-panel">
          <div class="step-panel__header">
            <SvgIcon icon="mdi:toolbox-outline" class="step-panel__icon" />
            <div>
              <div class="step-panel__title">能力配置</div>
              <div class="step-panel__subtitle">挂载工具链并定义能力标签</div>
            </div>
          </div>
          <NForm label-placement="top" :show-feedback="false" class="step-form">
            <NFormItem label="工具链">
              <NCheckboxGroup v-model:value="form.tools">
                <div class="tool-grid">
                  <NCheckbox v-for="tool in toolCheckboxOptions" :key="tool.value" :value="tool.value" :label="tool.label" />
                </div>
              </NCheckboxGroup>
            </NFormItem>
            <NFormItem label="能力标签">
              <NDynamicTags v-model:value="form.capabilityTags" />
            </NFormItem>
            <NFormItem label="推荐提示词">
              <NDynamicTags v-model:value="form.recommendedPrompts" />
            </NFormItem>
          </NForm>
        </div>

        <!-- Step 4: 提示词 -->
        <div v-else-if="currentStep === 3" key="step-3" class="step-panel">
          <div class="step-panel__header">
            <SvgIcon icon="mdi:text-box-edit-outline" class="step-panel__icon" />
            <div>
              <div class="step-panel__title">提示词</div>
              <div class="step-panel__subtitle">定义智能体的角色行为与默认输入</div>
            </div>
          </div>
          <NForm label-placement="top" :show-feedback="false" class="step-form">
            <NFormItem label="系统提示词">
              <NInput v-model:value="form.systemPrompt" type="textarea" :autosize="{ minRows: 6, maxRows: 12 }" placeholder="定义智能体的角色、行为和输出格式要求，例如：&#10;你是一名地理分析助手，需要以结论、依据要点、建议动作三段式返回结果。" />
            </NFormItem>
            <NFormItem label="默认任务输入">
              <NInput v-model:value="form.defaultInput" type="textarea" :autosize="{ minRows: 3, maxRows: 6 }" placeholder="用户运行智能体时的默认输入内容" />
            </NFormItem>
          </NForm>
        </div>
      </Transition>

      <!-- Actions Bar -->
      <div class="step-actions">
        <NButton v-if="currentStep > 0" quaternary @click="prevStep">
          <template #icon>
            <SvgIcon icon="mdi:arrow-left" />
          </template>
          上一步
        </NButton>
        <div class="flex-1" />
        <NButton quaternary @click="emit('cancel')">取消</NButton>
        <NButton v-if="currentStep < steps.length - 1" type="primary" ghost @click="nextStep">
          下一步
          <template #icon>
            <SvgIcon icon="mdi:arrow-right" />
          </template>
        </NButton>
        <NButton v-else type="primary" :disabled="!formValid" @click="handleSubmit">
          <template #icon>
            <SvgIcon icon="mdi:rocket-launch-outline" />
          </template>
          创建智能体
        </NButton>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.create-form {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 24px;
}

/* ── Vertical Step Nav ── */
.step-nav {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-top: 4px;
}

.step-nav__item {
  display: flex;
  gap: 12px;
  cursor: pointer;
  padding: 4px 0;
  position: relative;
}

.step-nav__indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}

.step-nav__dot {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid rgba(25, 95, 176, 0.35);
  background: rgba(6, 20, 38, 0.6);
  color: rgba(147, 196, 255, 0.4);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1;
}

.step-nav__step-icon {
  font-size: 16px;
}

.step-nav__check {
  font-size: 18px;
  color: #fff;
}

.step-nav__item--active .step-nav__dot {
  border-color: var(--accent, #29a3ff);
  background: rgba(41, 163, 255, 0.15);
  color: var(--accent, #29a3ff);
  box-shadow:
    0 0 0 3px rgba(41, 163, 255, 0.08),
    0 0 16px rgba(41, 163, 255, 0.2);
}

.step-nav__item--done .step-nav__dot {
  border-color: var(--accent, #29a3ff);
  background: var(--accent, #29a3ff);
  color: #fff;
}

.step-nav__line {
  width: 2px;
  height: 28px;
  background: rgba(25, 95, 176, 0.25);
  border-radius: 1px;
  transition: background 0.3s ease;
}

.step-nav__line--done {
  background: linear-gradient(180deg, var(--accent, #29a3ff), rgba(41, 163, 255, 0.3));
}

.step-nav__text {
  padding-top: 4px;
  min-width: 0;
}

.step-nav__label {
  font-size: 13px;
  font-weight: 600;
  color: rgba(147, 196, 255, 0.45);
  line-height: 1.3;
  transition: color 0.3s ease;
}

.step-nav__item--active .step-nav__label {
  color: #eaf5ff;
}

.step-nav__item--done .step-nav__label {
  color: rgba(203, 227, 255, 0.72);
}

.step-nav__desc {
  font-size: 11px;
  color: rgba(147, 196, 255, 0.3);
  margin-top: 2px;
  transition: color 0.3s ease;
}

.step-nav__item--active .step-nav__desc {
  color: rgba(147, 196, 255, 0.55);
}

/* ── Step Content Area ── */
.step-content-area {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.step-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
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

.tool-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px 16px;
}

.temperature-control {
  padding: 4px 0;
}

/* ── Step Transition ── */
.step-fade-enter-active {
  transition: all 0.25s ease-out;
}

.step-fade-leave-active {
  transition: all 0.15s ease-in;
}

.step-fade-enter-from {
  opacity: 0;
  transform: translateX(12px);
}

.step-fade-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

/* ── Actions Bar ── */
.step-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 20px;
  margin-top: auto;
  border-top: 1px solid rgba(25, 95, 176, 0.18);
}
</style>
