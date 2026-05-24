<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';
import { usePreferredReducedMotion } from '@vueuse/core';
import { loginModuleRecord } from '@/constants/app';
import { useThemeStore } from '@/store/modules/theme';
import PwdLogin from './modules/pwd-login.vue';

interface Props {
  /** The login module */
  module?: UnionKey.LoginModule;
}

const props = defineProps<Props>();

const themeStore = useThemeStore();
const reducedMotion = usePreferredReducedMotion();

if (themeStore.themeScheme !== 'dark') {
  themeStore.setThemeScheme('dark');
}

interface LoginModule {
  label: string;
  component: Component;
}

const moduleMap: Record<UnionKey.LoginModule, LoginModule> = {
  'pwd-login': { label: loginModuleRecord['pwd-login'], component: PwdLogin }
};

const activeModule = computed(() => moduleMap[props.module || 'pwd-login']);

const transitionName = computed(() => (reducedMotion.value === 'reduce' ? '' : themeStore.page.animateMode));
</script>

<template>
  <div class="login-root relative min-h-screen w-full overflow-hidden">
    <div class="login-bg absolute-lt size-full"></div>
    <div class="login-orbit absolute-lt size-full"></div>
    <div class="login-grid absolute-lt size-full"></div>
    <div class="relative z-1 min-h-screen w-full flex-center px-16px py-48px lt-sm:py-28px">
      <div class="w-full max-w-420px">
        <div class="mb-18px text-center">
          <h1 class="text-22px text-white font-700">Geo-LLM 辅助决策系统</h1>
        </div>

        <NCard :bordered="false" class="login-card rd-14px">
          <div class="pt-6px">
            <Transition :name="transitionName" mode="out-in" appear>
              <component :is="activeModule.component" />
            </Transition>
          </div>
        </NCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-root {
  background: #0b1220;
}

.login-bg {
  background:
    radial-gradient(900px 520px at 22% 24%, rgba(43, 107, 255, 0.22) 0%, rgba(43, 107, 255, 0) 58%),
    radial-gradient(700px 460px at 82% 32%, rgba(56, 189, 248, 0.1) 0%, rgba(56, 189, 248, 0) 62%),
    linear-gradient(180deg, #07101f 0%, #0b1220 45%, #07101f 100%);
  filter: saturate(1.02);
}

.login-orbit {
  pointer-events: none;
  opacity: 0.9;
}

.login-orbit::before {
  content: '';
  position: absolute;
  inset: -120px;
  pointer-events: none;
  background:
    conic-gradient(from 220deg at 40% 38%, rgba(56, 189, 248, 0), rgba(56, 189, 248, 0.14), rgba(56, 189, 248, 0) 36%),
    conic-gradient(from 40deg at 62% 42%, rgba(43, 107, 255, 0), rgba(43, 107, 255, 0.16), rgba(43, 107, 255, 0) 28%),
    radial-gradient(closest-side at 50% 42%, rgba(255, 255, 255, 0.08) 0 1px, rgba(255, 255, 255, 0) 2px),
    radial-gradient(closest-side at 50% 42%, rgba(255, 255, 255, 0.06) 0 1px, rgba(255, 255, 255, 0) 2px);
  background-size:
    100% 100%,
    100% 100%,
    520px 520px,
    820px 820px;
  background-position:
    0 0,
    0 0,
    center,
    center;
  background-repeat: no-repeat;
  transform: translate3d(0, 0, 0) rotate(0deg);
  animation: orbit-rotate 34s linear infinite;
  mask-image: radial-gradient(ellipse at 50% 35%, black 0%, rgba(0, 0, 0, 0.65) 55%, transparent 78%);
}

.login-grid {
  pointer-events: none;
}

.login-card {
  padding: 8px 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(15, 27, 45, 0.78);
  box-shadow: 0 26px 80px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(10px);
  position: relative;
  overflow: hidden;
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
}

.login-card:focus-within {
  transform: translate3d(0, -2px, 0);
  border-color: rgba(43, 107, 255, 0.35);
  box-shadow: 0 28px 92px rgba(0, 0, 0, 0.52);
}

.login-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  height: 2px;
  pointer-events: none;
  background: linear-gradient(90deg, rgba(43, 107, 255, 0), rgba(43, 107, 255, 0.9), rgba(43, 107, 255, 0));
  opacity: 0.85;
}

.login-card::after {
  content: '';
  position: absolute;
  left: -40%;
  top: -55%;
  width: 180%;
  height: 180%;
  pointer-events: none;
  background:
    radial-gradient(closest-side, rgba(43, 107, 255, 0.22), rgba(43, 107, 255, 0) 68%),
    radial-gradient(closest-side, rgba(56, 189, 248, 0.1), rgba(56, 189, 248, 0) 62%);
  filter: blur(28px);
  opacity: 0.18;
  transform: translate3d(-6%, -4%, 0) scale(1);
  animation: glow-float 9s ease-in-out infinite;
}

.login-grid::before {
  content: '';
  position: absolute;
  inset: -56px;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px);
  background-size: 56px 56px;
  opacity: 0.14;
  transform: translate3d(0, 0, 0);
  animation: grid-drift 22s linear infinite;
  mask-image: radial-gradient(ellipse at 50% 35%, black 0%, rgba(0, 0, 0, 0.55) 55%, transparent 78%);
}

@keyframes grid-drift {
  0% {
    transform: translate3d(0, 0, 0);
  }
  100% {
    transform: translate3d(56px, 56px, 0);
  }
}

@keyframes orbit-rotate {
  0% {
    transform: translate3d(0, 0, 0) rotate(0deg);
  }
  100% {
    transform: translate3d(0, 0, 0) rotate(360deg);
  }
}

@keyframes glow-float {
  0%,
  100% {
    transform: translate3d(-6%, -4%, 0) scale(1);
    opacity: 0.16;
  }
  50% {
    transform: translate3d(3%, 2%, 0) scale(1.03);
    opacity: 0.24;
  }
}

@media (prefers-reduced-motion: reduce) {
  .login-orbit::before,
  .login-grid::before,
  .login-card::after {
    animation: none;
  }
  .login-card {
    transition: none;
  }
}
</style>
