import type { Router } from 'vue-router';
import { useTitle } from '@vueuse/core';

export function createDocumentTitleGuard(router: Router) {
  router.afterEach(to => {
    useTitle(to.meta.title);
  });
}
