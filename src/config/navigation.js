import { canAccess } from '@/lib/access'

function resolveBadgeValue(menu, context) {
  if (typeof menu.badge === 'function') {
    return menu.badge(context)
  }
  return menu.badge ?? null
}

export const coreAdminMenuItems = [
  {
    id: 'admin-dashboard',
    location: 'admin',
    title: '后台总览',
    to: '/admin',
    order: 10,
    meta: { requiresAuth: true, roles: ['SUPER_ADMIN', 'REVIEWER'] },
  },
  {
    id: 'admin-plugins',
    location: 'admin',
    title: '插件系统',
    to: '/admin/plugins',
    order: 20,
    meta: { requiresAuth: true, roles: ['SUPER_ADMIN'] },
  },
  {
    id: 'admin-submissions',
    location: 'admin',
    title: '投稿审核',
    to: '/admin/submissions',
    order: 30,
    meta: { requiresAuth: true, roles: ['SUPER_ADMIN', 'REVIEWER'] },
    badge: ({ adminStore }) => adminStore.pendingSubmissions || null,
  },
  {
    id: 'admin-users',
    location: 'admin',
    title: '用户管理',
    to: '/admin/users',
    order: 40,
    meta: { requiresAuth: true, roles: ['SUPER_ADMIN'] },
  },
  {
    id: 'admin-images',
    location: 'admin',
    title: '图片管理',
    to: '/admin/images',
    order: 50,
    meta: { requiresAuth: true, roles: ['SUPER_ADMIN'] },
  },
  {
    id: 'admin-announcements',
    location: 'admin',
    title: '公告管理',
    to: '/admin/announcements',
    order: 60,
    meta: { requiresAuth: true, roles: ['SUPER_ADMIN'] },
  },
]

export function resolveVisibleMenus(menus = [], context = {}) {
  return menus
    .filter((menu) => canAccess(menu.meta, context.auth))
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((menu) => ({
      ...menu,
      badge: resolveBadgeValue(menu, context),
    }))
}
