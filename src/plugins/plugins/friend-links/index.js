import { definePlugin } from '@/plugins/definePlugin'
import AdminFriendLinksPage from '@/pages/AdminFriendLinksPage.vue'
import FriendLinksDashboardWidget from '@/plugins/widgets/FriendLinksDashboardWidget.vue'

export default definePlugin({
  id: 'friend-links',
  name: '友情链接',
  version: '1.4.1',
  description: '为后台提供友情链接管理能力。',
  schemaVersion: '1.0.0',
  migrationStrategy: 'host-schema',
  migrationIds: [],
  migrationNotes: '当前数据结构跟随宿主 schema.sql，无插件专属迁移。',
  capabilities: ['friend-links.manage'],
  defaultConfig: {
    enablePublicFooterLinks: true,
    footerTitle: '友情链接',
    maxVisibleLinks: 20,
    openInNewTab: true,
    showDashboardWidget: true,
    showAdminQuickActions: true,
  },
  lifecycle: {
    async install({ api }) {
      await api.audit({
        action: 'plugin.friend_links.install',
        details: { plugin: 'friend-links' },
        level: 'info',
      })
    },
    async enable({ api }) {
      await api.audit({
        action: 'plugin.friend_links.enable',
        details: { plugin: 'friend-links' },
        level: 'success',
      })
    },
    async disable({ api }) {
      await api.audit({
        action: 'plugin.friend_links.disable',
        details: { plugin: 'friend-links' },
        level: 'warn',
      })
    },
  },
  configSchema: [
    {
      key: 'enablePublicFooterLinks',
      type: 'boolean',
      label: '前台页脚展示友情链接',
      helper: '关闭后插件仍保留后台管理，但前台页脚不再展示友情链接。',
    },
    {
      key: 'footerTitle',
      type: 'text',
      label: '页脚标题',
      placeholder: '友情链接',
      helper: '显示在前台页脚友情链接区域的标题文案。',
    },
    {
      key: 'maxVisibleLinks',
      type: 'number',
      label: '前台最多显示数量',
      min: 1,
      max: 50,
      helper: '限制前台页脚最多展示多少条启用链接。',
    },
    {
      key: 'openInNewTab',
      type: 'boolean',
      label: '前台点击时新窗口打开',
      helper: '关闭后将在当前窗口打开友情链接。',
    },
    {
      key: 'showDashboardWidget',
      type: 'boolean',
      label: '在后台总览显示插件面板',
      helper: '关闭后，不在后台总览显示友情链接概览卡片。',
    },
    {
      key: 'showAdminQuickActions',
      type: 'boolean',
      label: '在后台顶部快捷区显示插件入口',
      helper: '关闭后，后台总览不再显示友情链接快捷入口。',
    },
  ],

  adminQuickActions: [
    {
      id: 'friend-links-quick-dashboard',
      label: '友情链接管理',
      description: '直接进入友情链接管理页',
      target: 'admin-dashboard',
      icon: 'link--rounded',
      tone: 'secondary',
      order: 410,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['friend-links.manage'],
      },
      when: ({ config }) => config.showAdminQuickActions !== false,
      onClick: ({ router }) => router.push('/admin/friend-links'),
    },
  ],
  dashboardWidgets: [
    {
      id: 'friend-links-overview',
      title: '友情链接概览',
      order: 210,
      span: 'md',
      component: FriendLinksDashboardWidget,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['friend-links.manage'],
      },
      when: ({ config }) => config.showDashboardWidget !== false,
    },
  ],
  routes: [
    {
      path: '/admin/friend-links',
      name: 'admin-friend-links',
      component: AdminFriendLinksPage,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['friend-links.manage'],
      },
      order: 410,
    },
  ],
  menus: [
    {
      id: 'admin-friend-links',
      location: 'admin',
      title: '友情链接',
      to: '/admin/friend-links',
      order: 410,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['friend-links.manage'],
      },
    },
  ],
})
