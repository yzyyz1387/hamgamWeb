import { definePlugin } from '@/plugins/definePlugin'
import FeedbackDialog from '@/components/feedback/FeedbackDialog.vue'
import AdminFeedbackPage from '@/pages/AdminFeedbackPage.vue'
import UserFeedbackPage from '@/pages/UserFeedbackPage.vue'
import AdminFeedbackDashboardWidget from '@/plugins/widgets/AdminFeedbackDashboardWidget.vue'
import FeedbackProfilePanel from '@/plugins/panels/FeedbackProfilePanel.vue'
import { createRoleNotificationTemplate, createDirectNotificationTemplate } from '@/plugins/templates/notificationTemplates'

export default definePlugin({
  id: 'image-feedback',
  name: '图片反馈',
  version: '1.0.0',
  description: '提供图片举报和反馈功能，支持用户对图片提交反馈，管理员在后台处理。',
  schemaVersion: '1.0.0',
  migrationStrategy: 'host-schema',
  migrationIds: [],
  migrationNotes: '依赖 Supabase 中已执行的 image_feedbacks / feedback_replies 表。',
  capabilities: ['feedback.manage'],
  defaultConfig: {
    showDashboardWidget: true,
    showImageDetailAction: true,
    showTopbarAction: true,
    showAdminQuickActions: true,
    minContentLength: 10,
  },
  lifecycle: {
    async install({ api }) {
      await api.audit({
        action: 'plugin.installed',
        entityType: 'plugin',
        entityId: 'image-feedback',
        details: { plugin: 'image-feedback' },
        level: 'info',
      })
    },
    async enable({ api }) {
      await api.audit({
        action: 'plugin.enabled',
        entityType: 'plugin',
        entityId: 'image-feedback',
        details: { plugin: 'image-feedback' },
        level: 'success',
      })
    },
    async disable({ api }) {
      await api.audit({
        action: 'plugin.disabled',
        entityType: 'plugin',
        entityId: 'image-feedback',
        details: { plugin: 'image-feedback' },
        level: 'warn',
      })
    },
  },
  configSchema: [
    {
      key: 'showDashboardWidget',
      type: 'boolean',
      label: '在后台总览显示反馈面板',
      helper: '关闭后，后台总览不再显示反馈统计卡片。',
    },
    {
      key: 'showImageDetailAction',
      type: 'boolean',
      label: '在图片详情页显示反馈按钮',
      helper: '关闭后，图片详情页不再显示举报/反馈按钮。',
    },
    {
      key: 'showTopbarAction',
      type: 'boolean',
      label: '在顶栏显示我的反馈入口',
      helper: '关闭后，顶栏不再显示"我的反馈"入口。',
    },
    {
      key: 'showAdminQuickActions',
      type: 'boolean',
      label: '在后台快捷区显示反馈入口',
      helper: '关闭后，后台不再显示反馈快捷入口。',
    },
    {
      key: 'minContentLength',
      type: 'number',
      label: '反馈内容最少字数',
      min: 5,
      max: 100,
      helper: '提交反馈时描述内容的最少字符数。',
    },
  ],

  routes: [
    {
      path: '/admin/feedback',
      name: 'admin-feedback',
      component: AdminFeedbackPage,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['feedback.manage'],
      },
      order: 430,
    },
    {
      path: '/admin/site-feedback',
      name: 'admin-site-feedback',
      component: AdminFeedbackPage,
      props: { tab: 'site' },
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['feedback.manage'],
      },
      order: 431,
    },
    {
      path: '/my-feedback',
      name: 'my-feedback',
      component: UserFeedbackPage,
      meta: { requiresAuth: true },
      order: 432,
    },
  ],

  menus: [
    {
      id: 'admin-feedback-menu',
      location: 'admin',
      title: '反馈管理',
      to: '/admin/feedback',
      order: 430,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['feedback.manage'],
      },
    },
  ],

  adminQuickActions: [
    {
      id: 'feedback-quick-dashboard',
      label: '反馈处理队列',
      description: '查看和处理用户提交的图片反馈',
      target: 'admin-dashboard',
      icon: 'flag--rounded',
      tone: 'warning',
      order: 230,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['feedback.manage'],
      },
      when: ({ config }) => config.showAdminQuickActions !== false,
      onClick: ({ router }) => router.push('/admin/feedback'),
    },
  ],

  topbarActions: [
    {
      id: 'my-feedback-topbar',
      label: '我的反馈',
      icon: 'flag--rounded',
      order: 220,
      meta: { requiresAuth: true },
      when: ({ config, auth }) => Boolean(auth?.isLoggedIn) && config.showTopbarAction !== false,
      onClick: ({ router }) => router.push('/my-feedback'),
    },
  ],

  imageDetailActions: [
    {
      id: 'image-feedback-action',
      label: '反馈',
      icon: 'flag--rounded',
      variant: 'outlined',
      order: 200,
      meta: { requiresAuth: true },
      when: ({ config, auth }) => Boolean(auth?.isLoggedIn) && config.showImageDetailAction !== false,
      onClick: ({ image, emit }) => {
        if (emit) emit('image-feedback:open', { imageId: image?.id, imageTitle: image?.title })
      },
    },
  ],

  dashboardWidgets: [
    {
      id: 'feedback-overview',
      title: '反馈概览',
      order: 230,
      span: 'md',
      component: AdminFeedbackDashboardWidget,
      meta: {
        requiresAuth: true,
        roles: ['SUPER_ADMIN'],
        capabilities: ['feedback.manage'],
      },
      when: ({ config }) => config.showDashboardWidget !== false,
    },
  ],

  profilePanels: [
    {
      id: 'feedback-profile-panel',
      title: '我的反馈',
      target: 'self',
      order: 230,
      span: 'sm',
      component: FeedbackProfilePanel,
      meta: { requiresAuth: true },
    },
  ],

  notificationTemplates: [
    createRoleNotificationTemplate({
      id: 'feedback-submitted-admin-notice',
      title: '新的图片反馈已提交',
      description: '有用户提交了新的图片反馈，请及时处理。',
      role: 'SUPER_ADMIN',
      icon: 'flag--rounded',
      tone: 'warning',
      order: 230,
    }),
    createDirectNotificationTemplate({
      id: 'feedback-status-updated-notice',
      title: '反馈状态已更新',
      description: '你提交的反馈状态已变更。',
      icon: 'check_circle--rounded',
      tone: 'success',
      order: 231,
    }),
  ],
})
