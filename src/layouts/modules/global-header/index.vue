<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useFullscreen } from '@vueuse/core';
import { GLOBAL_HEADER_MENU_ID } from '@/constants/app';
import { useAppStore } from '@/store/modules/app';
import { useThemeStore } from '@/store/modules/theme';
import GlobalLogo from '../global-logo/index.vue';
import GlobalBreadcrumb from '../global-breadcrumb/index.vue';
import UserAvatar from './components/user-avatar.vue';
import ThemeConfigButton from './components/theme-config-button.vue';

defineOptions({
  name: 'GlobalHeader'
});

interface Props {
  /** Whether to show the logo */
  showLogo?: App.Global.HeaderProps['showLogo'];
  /** Whether to show the menu toggler */
  showMenuToggler?: App.Global.HeaderProps['showMenuToggler'];
  /** Whether to show the menu */
  showMenu?: App.Global.HeaderProps['showMenu'];
}

defineProps<Props>();

const router = useRouter();
const appStore = useAppStore();
const themeStore = useThemeStore();
const { isFullscreen, toggle } = useFullscreen();

function openScreen() {
  const url = router.resolve({ name: 'screen-fullscreen' }).href;
  window.open(url, '_blank');
}

function openGlobe() {
  // eslint-disable-next-line no-underscore-dangle
  const globeUrl = window.__APP_CONFIG__?.VITE_GLOBE_URL || 'http://192.168.12.211:19091/webglobe';
  window.open(globeUrl, '_blank');
}
</script>

<template>
  <DarkModeContainer class="h-full flex-y-center px-12px shadow-header header-bar">
    <GlobalLogo v-if="showLogo" class="h-full" :style="{ width: themeStore.sider.width + 'px' }" />
    <MenuToggler v-if="showMenuToggler" :collapsed="appStore.siderCollapse" @click="appStore.toggleSiderCollapse" />
    <div v-if="showMenu" :id="GLOBAL_HEADER_MENU_ID" class="h-full flex-y-center flex-1-hidden"></div>
    <div v-else class="h-full flex-y-center flex-1-hidden">
      <GlobalBreadcrumb v-if="!appStore.isMobile" class="ml-12px" />
    </div>
    <div class="h-full flex-y-center justify-end header-actions">
      <ButtonIcon icon="mdi:monitor-dashboard" tooltip-content="统计大屏" @click="openScreen" />
      <ButtonIcon icon="mdi:earth" tooltip-content="Web球" @click="openGlobe" />
      <FullScreen v-if="!appStore.isMobile" :full="isFullscreen" @click="toggle" />
      <ThemeSchemaSwitch
        :theme-schema="themeStore.themeScheme"
        :is-dark="themeStore.darkMode"
        @switch="themeStore.toggleThemeScheme"
      />
      <ThemeConfigButton v-if="!appStore.isMobile" />
      <UserAvatar />
    </div>
  </DarkModeContainer>
</template>

<style scoped></style>
