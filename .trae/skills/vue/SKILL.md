---
name: "vue"
description: "Use when editing .vue files, creating Vue 3 components/composables, or testing Vue code: Composition API patterns, props/emits, reactivity gotchas."
---

# Vue 3 Development

Reference for Vue 3 Composition API patterns, component architecture, and testing practices.

Current stable: Vue 3.5+ with enhanced reactivity performance, new SSR features, and improved developer experience.

## Overview

Progressive reference system for Vue 3 projects. Load only files relevant to current task.

## When to Use

Use this skill when:

- Writing `.vue` components
- Creating composables (`use*` functions)
- Building client-side utilities
- Testing Vue components/composables

Use nuxt skill instead for:

- Server routes, API endpoints
- File-based routing, middleware
- Nuxt-specific patterns

For VueUse composables: use vueuse skill.

## Quick Reference

| Working on... | Load file |
| --- | --- |
| `.vue` in `components/` | `references/components.md` |
| File in `composables/` | `references/composables.md` |
| File in `utils/` | `references/utils-client.md` |
| `.spec.ts` / `.test.ts` | `references/testing.md` |
| TypeScript patterns | `references/typescript.md` |
| Vue Router typing | `references/router.md` |
| Reactivity (`ref`, `watch`) | `references/reactivity.md` |
| Custom directives | `references/directives.md` |
| Provide/inject | `references/provide-inject.md` |
| Edge cases, vue-tsc | `references/gotchas.md` |

## Loading Files

Consider loading these reference files based on your task:

- `references/components.md` - if working in components/ or writing `.vue` files
- `references/composables.md` - if creating composables (`use*` functions)
- `references/utils-client.md` - if working in utils/ or writing client utilities
- `references/testing.md` - if writing `.spec.ts` or `.test.ts` files
- `references/typescript.md` - if working with Vue TypeScript patterns or generics
- `references/router.md` - if working with Vue Router or route typing
- `references/reactivity.md` - if using `ref`, `reactive`, `computed`, `watch`, or `watchEffect`
- `references/directives.md` - if creating or using custom directives
- `references/provide-inject.md` - if using provide/inject patterns
- `references/gotchas.md` - if debugging edge cases or hydration issues

DO NOT load all files at once. Load only what's relevant to your current task.

## Quick Start

```vue
<script setup lang="ts">
const { count = 0 } = defineProps<{ count?: number }>()
const emit = defineEmits<{ update: [value: number] }>()
</script>

<template>
  <button @click="emit('update', count + 1)">
    Count: {{ count }}
  </button>
</template>
```
