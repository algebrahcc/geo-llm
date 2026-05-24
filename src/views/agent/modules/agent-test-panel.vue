<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { AgentDefinition, AgentTestRecord } from '@/mock/agent';

const props = defineProps<{
  agent: AgentDefinition;
  latestRecord?: AgentTestRecord | null;
}>();

const emit = defineEmits<{
  run: [prompt: string];
}>();

const prompt = ref(props.agent.defaultInput);

watch(
  () => props.agent.key,
  () => {
    prompt.value = props.agent.defaultInput;
  },
  { immediate: true }
);

const quickPrompts = computed(() => props.agent.recommendedPrompts);

function handleRun(target?: string) {
  emit('run', (target || prompt.value).trim());
}
</script>

<template>
  <div class="grid gap-16px xl:grid-cols-[1.1fr_0.9fr]">
    <NCard :bordered="false" class="test-card">
      <template #header>
        <div>
          <div class="text-16px font-700 text-[#f8fafc]">智能体测试</div>
          <div class="mt-4px text-12px text-[#8ea3bd]">直接输入 Prompt，验证当前智能体配置和输出效果。</div>
        </div>
      </template>

      <NInput v-model:value="prompt" type="textarea" :autosize="{ minRows: 8, maxRows: 12 }" />
      <div class="mt-12px flex flex-wrap gap-8px">
        <NTag
          v-for="item in quickPrompts"
          :key="item"
          size="small"
          round
          :bordered="false"
          class="quick-tag"
          @click="handleRun(item)"
        >
          {{ item }}
        </NTag>
      </div>
      <div class="mt-18px flex justify-end">
        <NButton type="primary" @click="handleRun()">开始测试</NButton>
      </div>
    </NCard>

    <NCard :bordered="false" class="result-card">
      <template #header>
        <div>
          <div class="text-16px font-700 text-[#f8fafc]">最近结果</div>
          <div class="mt-4px text-12px text-[#8ea3bd]">查看响应摘要、步骤和引用来源。</div>
        </div>
      </template>

      <div v-if="latestRecord" class="flex flex-col gap-12px">
        <div class="rounded-16px bg-[rgba(15,23,42,0.44)] p-14px text-13px leading-22px text-[#dbeafe]">
          {{ latestRecord.response }}
        </div>
        <div class="flex flex-col gap-8px">
          <div
            v-for="step in latestRecord.steps"
            :key="step.label"
            class="rounded-14px bg-[rgba(30,41,59,0.72)] p-12px"
          >
            <div class="text-13px font-600 text-[#f8fafc]">{{ step.label }}</div>
            <div class="mt-6px text-12px leading-20px text-[#94a3b8]">{{ step.detail }}</div>
          </div>
        </div>
        <div class="flex flex-wrap gap-8px">
          <NTag v-for="item in latestRecord.references" :key="item" size="small" round :bordered="false">
            {{ item }}
          </NTag>
        </div>
      </div>

      <NEmpty v-else description="暂无测试结果" class="py-26px" />
    </NCard>
  </div>
</template>

<style scoped>
.test-card,
.result-card {
  border-radius: 20px;
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 28%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.82));
}

.quick-tag {
  cursor: pointer;
  background: rgba(59, 130, 246, 0.14);
  color: #dbeafe;
}
</style>
