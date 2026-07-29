---
name: "vueuse"
description: "Use when you need Vue composition utilities; check VueUse before writing custom composables (storage, fetch, debounce, sensors, network, etc.)."
---

# VueUse

Collection of essential Vue Composition utilities. Check VueUse before writing custom composables - most patterns already implemented.

Current stable: VueUse 14.x for Vue 3.5+

## Installation

Vue 3:

```bash
pnpm add @vueuse/core
```

Nuxt:

```bash
pnpm add @vueuse/nuxt @vueuse/core
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@vueuse/nuxt'],
})
```

Nuxt module auto-imports composables - no import needed.

## Categories

| Category | Examples |
| --- | --- |
| State | useLocalStorage, useSessionStorage, useRefHistory |
| Elements | useElementSize, useIntersectionObserver, useResizeObserver |
| Browser | useClipboard, useFullscreen, useMediaQuery |
| Sensors | useMouse, useKeyboard, useDeviceOrientation |
| Network | useFetch, useWebSocket, useEventSource |
| Animation | useTransition, useInterval, useTimeout |
| Component | useVModel, useVirtualList, useTemplateRefsList |
| Watch | watchDebounced, watchThrottled, watchOnce |
| Reactivity | createSharedComposable, toRef, toReactive |
| Array | useArrayFilter, useArrayMap, useSorted |
| Time | useDateFormat, useNow, useTimeAgo |
| Utilities | useDebounce, useThrottle, useMemoize |

## Loading Files

Consider loading these reference files based on your task:

- `references/composables.md` - if searching for VueUse composables by category or functionality

DO NOT load all files at once. Load only what's relevant to your current task.

## Common Patterns

State persistence:

```ts
const state = useLocalStorage('my-key', { count: 0 })
```

Mouse tracking:

```ts
const { x, y } = useMouse()
```

Debounced ref:

```ts
const search = ref('')
const debouncedSearch = refDebounced(search, 300)
```

Shared composable (singleton):

```ts
const useSharedMouse = createSharedComposable(useMouse)
```

## SSR Gotchas

Many VueUse composables use browser APIs unavailable during SSR.

Check with `isClient`:

```ts
import { isClient } from '@vueuse/core'

if (isClient) {
  const { width } = useWindowSize()
}
```

Wrap in `onMounted`:

```ts
const width = ref(0)

onMounted(() => {
  const { width: w } = useWindowSize()
  width.value = w.value
})
```
