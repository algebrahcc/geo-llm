import type { RouteMeta } from 'vue-router';
import ElegantVueRouter from '@elegant-router/vue/vite';
import type { RouteKey } from '@elegant-router/types';

export function setupElegantRouter() {
  return ElegantVueRouter({
    layouts: {
      base: 'src/layouts/base-layout/index.vue',
      blank: 'src/layouts/blank-layout/index.vue'
    },
    routePathTransformer(routeName, routePath) {
      const key = routeName as RouteKey;

      if (key === 'login') {
        const modules: UnionKey.LoginModule[] = ['pwd-login'];

        const moduleReg = modules.join('|');

        return `/login/:module(${moduleReg})?`;
      }

      return routePath;
    },
    onRouteMetaGen(routeName) {
      const key = routeName as RouteKey;

      const constantRoutes: RouteKey[] = ['login', '403', '404', '500'];

      const meta: Partial<RouteMeta> = {
        title: key
      };

      const routeMetaMap: Partial<Record<RouteKey, Partial<RouteMeta>>> = {
        screen: { title: '统计大屏', order: 1, icon: 'mdi:monitor-dashboard' },
        globe: { title: 'Web球', order: 2, icon: 'mdi:earth' },
        catalog: { title: '数据目录', order: 3, icon: 'mdi:database' },
        building: { title: '楼宇夺控', order: 4, icon: 'mdi:office-building' },
        river: { title: '渡河保障方案', order: 5, icon: 'mdi:ferry' },
        planning: { title: '机动路线规划', order: 6, icon: 'mdi:routes' },
        knowledge: { title: '知识库', order: 7, icon: 'mdi:book-open-variant' },
        agent: { title: 'AI Agent', order: 8, icon: 'mdi:robot' }
      };

      if (routeMetaMap[key]) {
        Object.assign(meta, routeMetaMap[key]);
      }

      if (constantRoutes.includes(key)) {
        meta.constant = true;
      }

      return meta;
    }
  });
}
