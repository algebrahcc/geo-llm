<script setup lang="ts">
import { ref, watch } from 'vue';
import { NButton, NInput, NDynamicInput, NSpin, NTag } from 'naive-ui';
import { fetchDifyAppOrchestration, updateDifyAppOrchestration } from '@/service/api/difyApp';
import { fetchDifyParameters } from '@/service/api/dify';

const props = defineProps<{ appId: number | null }>();

const loading = ref(false);
const saving = ref(false);
const proxyMissing = ref(false);

const promptTemplate = ref('');
const openingStatement = ref('');
const suggestedQuestions = ref<string[]>([]);
const variableForm = ref<Array<Record<string, unknown>>>([]);

function varType(v: Record<string, unknown>) {
  return String(Object.keys(v)[0] ?? '');
}
function varLabel(v: Record<string, unknown>) {
  const inner = Object.values(v)[0] as Record<string, unknown> | undefined;
  return String(inner?.label ?? inner?.variable ?? varType(v) ?? '');
}

async function load() {
  if (props.appId == null) return;
  loading.value = true;
  proxyMissing.value = false;
  try {
    const [orchRes, paramRes] = await Promise.all([
      fetchDifyAppOrchestration(props.appId),
      fetchDifyParameters(props.appId)
    ]);
    const cfg = (orchRes?.data ?? null) as Api.Dify.OrchestrationConfig | null;
    promptTemplate.value = String(cfg?.prompt_template ?? cfg?.pre_prompt ?? '');
    openingStatement.value = String(cfg?.opening_statement ?? '');
    suggestedQuestions.value = Array.isArray(cfg?.suggested_questions)
      ? (cfg!.suggested_questions as unknown[]).map(String)
      : [];
    const params = (paramRes?.data ?? null) as Api.Dify.AppParameters | null;
    variableForm.value = Array.isArray(params?.user_input_form)
      ? (params!.user_input_form as Array<Record<string, unknown>>)
      : [];
  } catch {
    proxyMissing.value = true;
    window.$message?.warning('加载提示词编排失败（后端可能未代理 /apps/{id}/model-config）');
  } finally {
    loading.value = false;
  }
}

watch(() => props.appId, load, { immediate: true });

async function save() {
  if (props.appId == null) return;
  saving.value = true;
  try {
    await updateDifyAppOrchestration(props.appId, {
      prompt_template: promptTemplate.value,
      opening_statement: openingStatement.value,
      suggested_questions: suggestedQuestions.value.filter(q => q.trim())
    });
    window.$message?.success('提示词编排已保存');
  } catch {
    window.$message?.error('保存失败，请确认后端已代理 /apps/{id}/model-config');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="prompt-editor">
    <div class="section-desc">
      编辑系统提示词（System Prompt）、开场白与追问问题，并查看该智能体的变量表单。变量表单由 Dify
      应用定义，当前为只读展示。
    </div>

    <NSpin :show="loading">
      <div v-if="proxyMissing" class="section-desc warn">
        后端尚未代理「提示词编排」接口（/apps/{id}/model-config），暂无法读写。
      </div>

      <template v-else>
        <div class="field">
          <div class="field__label">系统提示词（System Prompt）</div>
          <NInput
            v-model:value="promptTemplate"
            type="textarea"
            :autosize="{ minRows: 6, maxRows: 14 }"
            placeholder="例如：你是一名地理空间分析助手，回答需引用知识库中的地理数据……"
          />
        </div>

        <div class="field">
          <div class="field__label">开场白</div>
          <NInput
            v-model:value="openingStatement"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 5 }"
            placeholder="对话开始时向用户展示的引导语"
          />
        </div>

        <div class="field">
          <div class="field__label">追问问题</div>
          <NDynamicInput v-model:value="suggestedQuestions" :min="0" placeholder="输入一个建议追问">
            <template #default="{ value }">
              <NInput v-model:value="suggestedQuestions[suggestedQuestions.indexOf(value)]" />
            </template>
          </NDynamicInput>
        </div>

        <div class="field">
          <div class="field__label">变量表单（只读）</div>
          <div v-if="variableForm.length === 0" class="section-desc">该智能体未定义输入变量。</div>
          <div v-else class="var-list">
            <NTag v-for="(v, i) in variableForm" :key="i" size="small" round class="var-tag">
              {{ varLabel(v) }} · {{ varType(v) }}
            </NTag>
          </div>
        </div>

        <div class="actions">
          <NButton type="primary" :loading="saving" @click="save">保存编排</NButton>
        </div>
      </template>
    </NSpin>
  </div>
</template>

<style scoped lang="scss">
.prompt-editor {
  color: #eaf5ff;
}
.section-desc {
  font-size: 12px;
  color: rgba(203, 227, 255, 0.65);
  margin-bottom: 12px;
}
.section-desc.warn {
  color: #ffce8a;
}
.field {
  margin-bottom: 16px;
}
.field__label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
  color: rgba(203, 227, 255, 0.85);
}
.var-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
</style>
