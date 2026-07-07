<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import { fetchCaptchaImage } from '@/service/api';

defineOptions({
  name: 'PwdLogin'
});

const authStore = useAuthStore();
const { formRef, validate } = useNaiveForm();

interface FormModel {
  userName: string;
  password: string;
  captcha: string;
}

const model: FormModel = reactive({
  userName: 'admin',
  password: 'admin123',
  captcha: ''
});

const captchaImg = ref('');
const captchaUuid = ref('');
const captchaEnabled = ref(false);
const captchaLoading = ref(false);

async function refreshCaptcha() {
  captchaLoading.value = true;
  try {
    const { data, error } = await fetchCaptchaImage();
    if (!error && data) {
      captchaEnabled.value = data.isEnabled;
      if (data.isEnabled) {
        captchaImg.value = data.img;
        captchaUuid.value = data.uuid;
        model.captcha = '';
      }
    }
  } finally {
    captchaLoading.value = false;
  }
}

onMounted(() => {
  refreshCaptcha();
});

const rules = computed<Record<keyof FormModel, App.Global.FormRule[]>>(() => {
  const { formRules } = useFormRules();

  return {
    userName: formRules.userName,
    password: [formRules.pwd[0]],
    captcha: captchaEnabled.value ? [formRules.code[0]] : []
  };
});

async function handleSubmit() {
  await validate();
  await authStore.login(
    model.userName,
    model.password,
    captchaEnabled.value ? model.captcha : undefined,
    captchaEnabled.value ? captchaUuid.value : undefined
  );
}
</script>

<template>
  <NForm ref="formRef" :model="model" :rules="rules" size="large" :show-label="false" @keyup.enter="handleSubmit">
    <NFormItem path="userName">
      <NInput
        v-model:value="model.userName"
        placeholder="请输入用户名…"
        :input-props="{
          name: 'username',
          autocomplete: 'username',
          'aria-label': '用户名',
          spellcheck: false,
          autocapitalize: 'none'
        }"
      />
    </NFormItem>
    <NFormItem path="password">
      <NInput
        v-model:value="model.password"
        type="password"
        show-password-on="click"
        placeholder="请输入密码…"
        :input-props="{
          name: 'password',
          autocomplete: 'current-password',
          'aria-label': '密码',
          spellcheck: false,
          autocapitalize: 'none'
        }"
      />
    </NFormItem>
    <NFormItem v-if="captchaEnabled" path="captcha">
      <div class="flex gap-8px">
        <NInput
          v-model:value="model.captcha"
          placeholder="请输入验证码…"
          :input-props="{
            name: 'captcha',
            autocomplete: 'off',
            'aria-label': '验证码',
            spellcheck: false,
            autocapitalize: 'none'
          }"
        />
        <NButton
          :loading="captchaLoading"
          class="h-40px w-120px flex-shrink-0 !p-0"
          @click="refreshCaptcha"
        >
          <img v-if="captchaImg" :src="captchaImg" alt="验证码" class="h-full w-full rounded-4px" />
          <span v-else>获取验证码</span>
        </NButton>
      </div>
    </NFormItem>
    <NSpace vertical :size="24">
      <div class="flex-y-center justify-between">
        <NCheckbox>记住我</NCheckbox>
      </div>
      <NButton type="primary" size="large" round block :loading="authStore.loginLoading" @click="handleSubmit">
        登录
      </NButton>
    </NSpace>
  </NForm>
</template>

<style scoped></style>
