import { PLUGIN_API_VERSION, PLUGIN_HOST_VERSION } from '@/plugins/api'
import { normalizeMigrationStrategy } from '@/plugins/upgradePolicy'

function normalizeSettingField(field = {}) {
  return {
    type: 'text',
    key: '',
    label: '',
    helper: '',
    placeholder: '',
    ...field,
  }
}

function normalizeDashboardWidget(widget = {}) {
  return {
    id: '',
    title: '',
    order: 500,
    span: 'md',
    component: null,
    meta: {},
    ...widget,
  }
}

function normalizeProfilePanel(panel = {}) {
  return {
    id: '',
    title: '',
    target: 'self',
    order: 500,
    span: 'md',
    component: null,
    meta: {},
    ...panel,
  }
}

function normalizeImageDetailAction(action = {}) {
  return {
    id: '',
    label: '',
    variant: 'outlined',
    meta: {},
    order: 500,
    ...action,
  }
}

function normalizeImageListCardExtra(extra = {}) {
  return {
    id: '',
    title: '',
    order: 500,
    component: null,
    meta: {},
    ...extra,
  }
}

function normalizeUserListItemExtra(extra = {}) {
  return {
    id: '',
    title: '',
    order: 500,
    component: null,
    meta: {},
    ...extra,
  }
}

function normalizeAdminTableRowAction(action = {}) {
  return {
    id: '',
    label: '',
    target: '',
    variant: 'text',
    size: 'small',
    meta: {},
    order: 500,
    ...action,
  }
}

function normalizeAdminListField(field = {}) {
  return {
    id: '',
    title: '',
    target: '',
    order: 500,
    component: null,
    meta: {},
    ...field,
  }
}

function normalizeSubmissionReviewSidebarPanel(panel = {}) {
  return {
    id: '',
    title: '',
    order: 500,
    component: null,
    meta: {},
    ...panel,
  }
}

function normalizeReviewBulkAction(action = {}) {
  return {
    id: '',
    label: '',
    target: '',
    variant: 'filled-tonal',
    appearance: 'secondary',
    icon: '',
    menuOnly: false,
    requiresSelection: true,
    confirmTitle: '',
    confirmText: '',
    group: 'general',
    summary: '',
    templateKind: 'custom',
    meta: {},
    order: 500,
    ...action,
  }
}

function normalizeAdminQuickAction(action = {}) {
  return {
    id: '',
    label: '',
    description: '',
    target: '',
    icon: '',
    badge: null,
    tone: 'secondary',
    order: 500,
    meta: {},
    ...action,
  }
}

function normalizeTopbarAction(action = {}) {
  return {
    id: '',
    label: '',
    icon: '',
    order: 500,
    meta: {},
    ...action,
  }
}

function normalizeNotificationCenterPanel(panel = {}) {
  return {
    id: '',
    title: '',
    order: 500,
    span: 'md',
    component: null,
    meta: {},
    ...panel,
  }
}

function normalizeNotificationTemplate(template = {}) {
  return {
    id: '',
    title: '',
    description: '',
    category: 'general',
    icon: 'campaign--rounded',
    tone: 'secondary',
    tags: [],
    target: 'all',
    order: 500,
    values: {},
    variables: {},
    meta: {},
    ...template,
    tags: Array.isArray(template?.tags) ? template.tags.filter(Boolean) : [],
    values: { ...(template?.values || {}) },
    variables: { ...(template?.variables || {}) },
    meta: { ...(template?.meta || {}) },
  }
}

function normalizeAuditLogPanel(panel = {}) {
  return {
    id: '',
    title: '',
    order: 500,
    span: 'md',
    component: null,
    meta: {},
    ...panel,
  }
}

function normalizeEventHook(hook = {}) {
  return {
    id: '',
    event: '',
    order: 500,
    handler: null,
    ...hook,
  }
}

function normalizeLifecycle(lifecycle = {}) {
  return {
    install: null,
    enable: null,
    disable: null,
    upgrade: null,
    uninstall: null,
    ...lifecycle,
  }
}

export function definePlugin(plugin) {
  return {
    enabled: true,
    apiVersion: PLUGIN_API_VERSION,
    hostVersionRange: `^${PLUGIN_HOST_VERSION}`,
    schemaVersion: '1.0.0',
    migrationStrategy: 'host-schema',
    migrationIds: [],
    migrationNotes: '',
    migrationScript: '',
    capabilities: [],
    routes: [],
    menus: [],
    defaultConfig: {},
    configSchema: [],
    lifecycle: normalizeLifecycle(),
    imageDetailActions: [],
    dashboardWidgets: [],
    topbarActions: [],
    notificationCenterPanels: [],
    notificationTemplates: [],
    auditLogPanels: [],
    profilePanels: [],
    imageListCardExtras: [],
    userListItemExtras: [],
    adminTableRowActions: [],
    adminListFields: [],
    submissionReviewSidebarPanels: [],
    reviewBulkActions: [],
    adminQuickActions: [],
    eventHooks: [],
    ...plugin,
    migrationStrategy: normalizeMigrationStrategy(plugin?.migrationStrategy),
    migrationIds: Array.isArray(plugin?.migrationIds) ? plugin.migrationIds.filter(Boolean) : [],
    lifecycle: normalizeLifecycle(plugin?.lifecycle),
    configSchema: Array.isArray(plugin?.configSchema)
      ? plugin.configSchema.map((field) => normalizeSettingField(field))
      : [],
    imageDetailActions: Array.isArray(plugin?.imageDetailActions)
      ? plugin.imageDetailActions.map((action) => normalizeImageDetailAction(action))
      : [],
    dashboardWidgets: Array.isArray(plugin?.dashboardWidgets)
      ? plugin.dashboardWidgets.map((widget) => normalizeDashboardWidget(widget))
      : [],
    topbarActions: Array.isArray(plugin?.topbarActions)
      ? plugin.topbarActions.map((action) => normalizeTopbarAction(action))
      : [],
    notificationCenterPanels: Array.isArray(plugin?.notificationCenterPanels)
      ? plugin.notificationCenterPanels.map((panel) => normalizeNotificationCenterPanel(panel))
      : [],
    notificationTemplates: Array.isArray(plugin?.notificationTemplates)
      ? plugin.notificationTemplates.map((template) => normalizeNotificationTemplate(template))
      : [],
    auditLogPanels: Array.isArray(plugin?.auditLogPanels)
      ? plugin.auditLogPanels.map((panel) => normalizeAuditLogPanel(panel))
      : [],
    profilePanels: Array.isArray(plugin?.profilePanels)
      ? plugin.profilePanels.map((panel) => normalizeProfilePanel(panel))
      : [],
    imageListCardExtras: Array.isArray(plugin?.imageListCardExtras)
      ? plugin.imageListCardExtras.map((extra) => normalizeImageListCardExtra(extra))
      : [],
    userListItemExtras: Array.isArray(plugin?.userListItemExtras)
      ? plugin.userListItemExtras.map((extra) => normalizeUserListItemExtra(extra))
      : [],
    adminTableRowActions: Array.isArray(plugin?.adminTableRowActions)
      ? plugin.adminTableRowActions.map((action) => normalizeAdminTableRowAction(action))
      : [],
    adminListFields: Array.isArray(plugin?.adminListFields)
      ? plugin.adminListFields.map((field) => normalizeAdminListField(field))
      : [],
    submissionReviewSidebarPanels: Array.isArray(plugin?.submissionReviewSidebarPanels)
      ? plugin.submissionReviewSidebarPanels.map((panel) => normalizeSubmissionReviewSidebarPanel(panel))
      : [],
    reviewBulkActions: Array.isArray(plugin?.reviewBulkActions)
      ? plugin.reviewBulkActions.map((action) => normalizeReviewBulkAction(action))
      : [],
    adminQuickActions: Array.isArray(plugin?.adminQuickActions)
      ? plugin.adminQuickActions.map((action) => normalizeAdminQuickAction(action))
      : [],
    eventHooks: Array.isArray(plugin?.eventHooks)
      ? plugin.eventHooks.map((hook) => normalizeEventHook(hook))
      : [],
  }
}
