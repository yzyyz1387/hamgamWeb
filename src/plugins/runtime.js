import { reactive } from 'vue'
import { createPluginApi, PLUGIN_API_VERSION, PLUGIN_HOST_VERSION, isCompatibleVersionRange } from '@/plugins/api'
import { canAccess } from '@/lib/access'
import { resolveVisibleMenus } from '@/config/navigation'
import { createPluginEventBus } from '@/plugins/eventBus'
import { requireSupabase, supabaseEnabled } from '@/lib/supabase'
import { safeInsertAuditLog } from '@/lib/audit'
import { buildPluginUpgradePolicy } from '@/plugins/upgradePolicy'
import { getPluginCatalogEntryById, getPluginCatalogManifests } from '@/plugins/registry'

const LEGACY_DISABLED_PLUGIN_STORAGE_KEY = 'hamgam:plugins:disabled'
const PLUGIN_SETTINGS_STORAGE_KEY = 'hamgam:plugins:settings'
const FEATURE_FLAGS_SETTING_KEY = 'feature_flags'
const PLUGIN_API_HOST_VERSION = PLUGIN_HOST_VERSION

const pluginServices = reactive({})
const pluginEventBus = createPluginEventBus()
const registeredPluginRouteNames = new Set()
const initializedPluginIds = new Set()
const initializedPluginHookIds = new Set()

const runtimeState = reactive({
  loaded: false,
  loading: false,
  source: 'manifest',
  error: '',
  remoteCount: 0,
  lastLoadedAt: null,
  lastSyncedAt: null,
  settingsById: {},
})

let runtimeContext = null
let loadSettingsPromise = null

function isMissingSystemSettingsError(error) {
  const message = String(error?.message || '')
  const code = String(error?.code || '')
  return code === 'PGRST205' ||
    /Could not find the table 'public\.system_settings' in the schema cache/i.test(message) ||
    /relation ["']?public\.system_settings["']? does not exist/i.test(message)
}

function createFeatureFlagsSetupError() {
  const error = new Error('数据库尚未创建功能开关表，当前已回退到本地配置。请先执行 20260404_feature_flags_auth_feedbacks.sql，再刷新页面。')
  error.code = 'FEATURE_FLAGS_SETUP_REQUIRED'
  return error
}

function getPluginId(pluginOrId) {
  if (typeof pluginOrId === 'string') return pluginOrId
  return pluginOrId?.id || ''
}

function getPluginById(pluginId) {
  return getPluginCatalogManifests().find((plugin) => plugin.id === pluginId) || null
}

function getPluginCatalogEntry(pluginId) {
  return getPluginCatalogEntryById(pluginId)
}

function buildDefaultPluginConfig(plugin) {
  const defaults = plugin?.defaultConfig
  if (!defaults || typeof defaults !== 'object' || Array.isArray(defaults)) {
    return {}
  }
  return JSON.parse(JSON.stringify(defaults))
}

function normalizePluginConfig(pluginId, value) {
  const plugin = getPluginById(pluginId)
  const defaults = buildDefaultPluginConfig(plugin)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaults
  }
  return {
    ...defaults,
    ...value,
  }
}

function getPluginCompatibility(pluginOrId) {
  const plugin = typeof pluginOrId === 'string' ? getPluginById(pluginOrId) : pluginOrId
  if (!plugin) {
    return {
      compatible: false,
      hostVersion: PLUGIN_API_HOST_VERSION,
      requiredRange: '*',
      reason: '未找到功能模块定义。',
    }
  }

  const requiredRange = plugin.hostVersionRange || PLUGIN_API_HOST_VERSION
  const compatible = isCompatibleVersionRange(requiredRange, PLUGIN_API_HOST_VERSION)
  const upgradePolicy = buildPluginUpgradePolicy(plugin)

  return {
    compatible,
    hostVersion: PLUGIN_API_HOST_VERSION,
    requiredRange,
    pluginApiVersion: plugin.apiVersion || PLUGIN_API_VERSION,
    reason: compatible ? '' : `宿主版本 ${PLUGIN_API_HOST_VERSION} 不满足 ${requiredRange}`,
    schemaVersion: upgradePolicy.schemaVersion,
    migrationStrategy: upgradePolicy.migrationStrategy,
    migrationStrategyLabel: upgradePolicy.migrationStrategyLabel,
    migrationIds: upgradePolicy.migrationIds,
    migrationNotes: upgradePolicy.migrationNotes,
    migrationScript: upgradePolicy.migrationScript,
    commandHint: upgradePolicy.commandHint,
  }
}

function buildManifestSetting(plugin) {
  const enabled = plugin.enabled !== false
  return {
    id: plugin.id,
    name: plugin.name,
    version: plugin.version || '0.0.0',
    description: plugin.description || '',
    installed: true,
    registrationStatus: 'builtin',
    installSource: getPluginCatalogEntry(plugin.id)?.source || 'builtin',
    registeredAt: null,
    uninstalledAt: null,
    enabled,
    defaultEnabled: enabled,
    config: buildDefaultPluginConfig(plugin),
    updatedAt: null,
    installedVersion: plugin.version || '0.0.0',
    apiVersion: plugin.apiVersion || PLUGIN_API_VERSION,
    hostVersionRange: plugin.hostVersionRange || PLUGIN_API_HOST_VERSION,
    lifecycleStatus: enabled ? 'enabled' : 'disabled',
    installedAt: null,
    enabledAt: null,
    disabledAt: null,
    lastError: null,
  }
}

function getManifestDefaults() {
  return getPluginCatalogManifests().reduce((acc, plugin) => {
    acc[plugin.id] = buildManifestSetting(plugin)
    return acc
  }, {})
}

function readLegacyDisabledPluginIds() {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(LEGACY_DISABLED_PLUGIN_STORAGE_KEY)
    const parsed = JSON.parse(raw || '[]')
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed)
  } catch {
    return new Set()
  }
}

function buildLocalFallbackSettings() {
  const defaults = getManifestDefaults()
  const legacyDisabledIds = readLegacyDisabledPluginIds()

  Object.keys(defaults).forEach((pluginId) => {
    if (!legacyDisabledIds.has(pluginId)) return
    defaults[pluginId] = {
      ...defaults[pluginId],
      enabled: false,
      lifecycleStatus: 'disabled',
    }
  })

  return defaults
}

function readPersistedPluginSettings() {
  if (typeof window === 'undefined') return buildLocalFallbackSettings()

  const defaults = buildLocalFallbackSettings()
  try {
    const raw = window.localStorage.getItem(PLUGIN_SETTINGS_STORAGE_KEY)
    const parsed = JSON.parse(raw || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults

    Object.entries(parsed).forEach(([pluginId, value]) => {
      if (!defaults[pluginId] || !value || typeof value !== 'object' || Array.isArray(value)) return
      const enabled = typeof value.enabled === 'boolean' ? value.enabled : defaults[pluginId].enabled
      defaults[pluginId] = {
        ...defaults[pluginId],
        ...value,
        installed: true,
        registrationStatus: 'builtin',
        installSource: 'builtin',
        enabled,
        config: normalizePluginConfig(pluginId, value.config),
        lifecycleStatus: value.lifecycleStatus || (enabled ? 'enabled' : 'disabled'),
        installedVersion: value.installedVersion || defaults[pluginId].installedVersion,
      }
    })

    return defaults
  } catch {
    return defaults
  }
}

function persistPluginSettings(settingsById) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PLUGIN_SETTINGS_STORAGE_KEY, JSON.stringify(settingsById))
  } catch {
    // ignore persistence failures
  }
}

function mergeRemoteSettings(remoteSettings = {}) {
  const defaults = readPersistedPluginSettings()

  Object.entries(remoteSettings || {}).forEach(([pluginId, value]) => {
    if (!defaults[pluginId] || !value || typeof value !== 'object' || Array.isArray(value)) return
    const enabled = typeof value.enabled === 'boolean' ? value.enabled : defaults[pluginId].enabled
    defaults[pluginId] = {
      ...defaults[pluginId],
      ...value,
      installed: true,
      registrationStatus: 'builtin',
      installSource: 'builtin',
      enabled,
      config: normalizePluginConfig(pluginId, value.config),
      lifecycleStatus: value.lifecycleStatus || (enabled ? 'enabled' : 'disabled'),
      installedVersion: value.installedVersion || defaults[pluginId].installedVersion,
    }
  })

  return defaults
}

function setRuntimeSettings(settingsById, meta = {}) {
  runtimeState.settingsById = settingsById
  runtimeState.loaded = true
  runtimeState.loading = false
  runtimeState.source = meta.source || runtimeState.source
  runtimeState.error = meta.error || ''
  runtimeState.remoteCount = meta.remoteCount ?? runtimeState.remoteCount
  runtimeState.lastLoadedAt = new Date().toISOString()
  if (meta.lastSyncedAt) {
    runtimeState.lastSyncedAt = meta.lastSyncedAt
  }
  persistPluginSettings(settingsById)
}

function getRuntimeMeta() {
  return {
    source: runtimeState.source,
    remoteCount: runtimeState.remoteCount,
    lastSyncedAt: runtimeState.lastSyncedAt,
  }
}

function patchPluginSettings(pluginId, patch = {}) {
  const current = runtimeState.settingsById[pluginId] || getManifestDefaults()[pluginId]
  const next = {
    ...runtimeState.settingsById,
    [pluginId]: {
      ...current,
      ...patch,
      installed: true,
      registrationStatus: 'builtin',
      installSource: 'builtin',
      config: normalizePluginConfig(pluginId, patch.config ?? current?.config),
      updatedAt: patch.updatedAt || new Date().toISOString(),
    },
  }
  setRuntimeSettings(next, getRuntimeMeta())
  return next[pluginId]
}

function getPluginLifecycle(pluginId) {
  return runtimeState.settingsById[pluginId] || getManifestDefaults()[pluginId] || null
}

function normalizePluginRoute(route, plugin) {
  return {
    ...route,
    meta: {
      ...(route.meta || {}),
      pluginId: plugin.id,
      pluginName: plugin.name,
    },
  }
}

function getPluginServices() {
  return {
    ...pluginServices,
    supabase: supabaseEnabled ? requireSupabase() : null,
  }
}

function createStablePluginApi(plugin, context = {}) {
  return createPluginApi(plugin, {
    ...context,
    router: context.router || runtimeContext?.router || null,
    auth: context.auth || runtimeContext?.auth || null,
    route: context.route || runtimeContext?.route || null,
    config: getPluginConfig(plugin.id),
  }, {
    router: context.router || runtimeContext?.router || null,
    hostVersion: PLUGIN_API_HOST_VERSION,
    showToast: context.showToast,
    copyText: context.copyText,
    getConfig: (pluginId) => getPluginConfig(pluginId),
    getServices: () => getPluginServices(),
    audit: ({ action, entityType, entityId, details, level } = {}) => safeInsertAuditLog({
      action,
      entityType,
      entityId,
      details,
      level,
    }),
    emit: (event, payload = {}) => emitPluginEvent(event, payload),
    on: pluginEventBus.on,
    off: pluginEventBus.off,
  })
}

async function runPluginPhase(plugin, phase, payload = {}) {
  const handler = plugin?.lifecycle?.[phase]
  if (!plugin || typeof handler !== 'function') return runtimeState.settingsById[plugin.id] || null

  const compatibility = getPluginCompatibility(plugin)
  if (phase === 'enable' && !compatibility.compatible) {
    const message = compatibility.reason || '功能模块与当前宿主版本不兼容。'
    patchPluginSettings(plugin.id, {
      lifecycleStatus: 'error',
      lastError: message,
    })
    throw new Error(message)
  }

  const now = new Date().toISOString()
  patchPluginSettings(plugin.id, {
    installedVersion: plugin.version || '0.0.0',
    apiVersion: plugin.apiVersion || PLUGIN_API_VERSION,
    hostVersionRange: plugin.hostVersionRange || PLUGIN_API_HOST_VERSION,
    lastError: null,
    lifecycleStatus: phase === 'disable' ? 'disabled' : 'enabled',
    enabledAt: phase === 'enable' ? now : payload.enabledAt ?? null,
    disabledAt: phase === 'disable' ? now : payload.disabledAt ?? null,
  })

  try {
    const api = createStablePluginApi(plugin, payload)
    await handler({
      ...payload,
      phase,
      plugin,
      pluginId: plugin.id,
      pluginName: plugin.name,
      config: getPluginConfig(plugin.id),
      compatibility,
      api,
    })

    await safeInsertAuditLog({
      action: phase === 'disable' ? 'feature.disabled' : 'feature.enabled',
      entityType: 'feature',
      entityId: plugin.id,
      level: phase === 'disable' ? 'warn' : 'success',
      details: {
        feature_id: plugin.id,
        feature_name: plugin.name,
        phase,
        version: plugin.version || '0.0.0',
      },
    })

    return runtimeState.settingsById[plugin.id]
  } catch (error) {
    patchPluginSettings(plugin.id, {
      lifecycleStatus: 'error',
      lastError: error?.message || String(error),
    })
    await safeInsertAuditLog({
      action: 'feature.lifecycle_failed',
      entityType: 'feature',
      entityId: plugin.id,
      level: 'error',
      details: {
        feature_id: plugin.id,
        feature_name: plugin.name,
        phase,
        message: error?.message || String(error),
      },
    })
    throw error
  }
}

export function registerPluginService(name, service) {
  if (!name) return
  pluginServices[name] = service
}

export function getPluginService(name, fallback = null) {
  return pluginServices[name] ?? fallback
}

export async function invokePluginAction(action, context = {}) {
  if (!action || typeof action.onClick !== 'function') return null
  const plugin = getPluginById(action.pluginId) || getPluginById(context.pluginId)
  const api = plugin ? createStablePluginApi(plugin, context) : null
  return action.onClick({
    ...context,
    api,
    emit: (event, payload) => emitPluginEvent(event, { ...payload, _source: `action:${action.id}` }),
    plugin,
    pluginId: plugin?.id || action.pluginId || context.pluginId || '',
    pluginName: plugin?.name || action.pluginName || context.pluginName || '',
    config: plugin ? getPluginConfig(plugin.id) : context.config,
  })
}

export async function invokePluginBulkAction(action, context = {}) {
  const result = await invokePluginAction(action, context)
  const selectedCount = Array.isArray(context.selectedItems)
    ? context.selectedItems.length
    : Array.isArray(context.rows)
      ? context.rows.length
      : 0

  await safeInsertAuditLog({
    action: 'plugin.bulk_action_executed',
    entityType: 'plugin',
    entityId: action?.pluginId || context.pluginId || null,
    level: 'info',
    details: {
      plugin_id: action?.pluginId || context.pluginId || null,
      plugin_name: action?.pluginName || context.pluginName || '',
      bulk_action_id: action?.id || '',
      bulk_action_label: action?.label || '',
      target: context.target || action?.target || '',
      selected_count: selectedCount,
    },
  })

  return result
}

async function ensurePluginSetup(plugin) {
  if (!plugin || initializedPluginIds.has(plugin.id)) return

  if (Array.isArray(plugin.eventHooks)) {
    for (const hook of plugin.eventHooks) {
      if (!hook?.event || typeof hook.handler !== 'function') continue
      const hookId = `${plugin.id}:${hook.id || hook.event}`
      if (initializedPluginHookIds.has(hookId)) continue
      pluginEventBus.on(hook.event, async (payload = {}) => {
        if (!isPluginEnabled(plugin.id)) return
        try {
          const api = createStablePluginApi(plugin, payload)
          await hook.handler({
            ...payload,
            plugin,
            pluginId: plugin.id,
            pluginName: plugin.name,
            config: getPluginConfig(plugin.id),
            api,
          })
        } catch (error) {
          console.error(`[plugins] Event hook failed for ${plugin.id} on ${hook.event}`, error)
        }
      })
      initializedPluginHookIds.add(hookId)
    }
  }

  if (typeof plugin.setup === 'function' && runtimeContext) {
    const api = createStablePluginApi(plugin, runtimeContext)
    await plugin.setup({
      plugin,
      pluginId: plugin.id,
      pluginName: plugin.name,
      config: getPluginConfig(plugin.id),
      api,
    })
  }

  initializedPluginIds.add(plugin.id)
}

async function fetchRemoteFeatureSettings() {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('system_settings')
    .select('value_json, updated_at')
    .eq('key', FEATURE_FLAGS_SETTING_KEY)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    if (isMissingSystemSettingsError(error)) {
      throw createFeatureFlagsSetupError()
    }
    throw error
  }
  return {
    settings: data?.value_json && typeof data.value_json === 'object' && !Array.isArray(data.value_json)
      ? data.value_json
      : {},
    updatedAt: data?.updated_at || null,
  }
}

function buildRemoteFeaturePayload(settingsById = runtimeState.settingsById) {
  return getPluginCatalogManifests().reduce((acc, plugin) => {
    const current = settingsById[plugin.id] || getManifestDefaults()[plugin.id]
    acc[plugin.id] = {
      enabled: typeof current?.enabled === 'boolean' ? current.enabled : plugin.enabled !== false,
      config: normalizePluginConfig(plugin.id, current?.config),
      updatedAt: current?.updatedAt || null,
    }
    return acc
  }, {})
}

async function persistFeatureSettingsRemote(settingsById = runtimeState.settingsById) {
  const supabase = requireSupabase()
  const now = new Date().toISOString()
  const { error } = await supabase.from('system_settings').upsert([
    {
      key: FEATURE_FLAGS_SETTING_KEY,
      value_json: buildRemoteFeaturePayload(settingsById),
      updated_at: now,
    },
  ], { onConflict: 'key' })

  if (error) {
    if (isMissingSystemSettingsError(error)) {
      throw createFeatureFlagsSetupError()
    }
    throw error
  }
  runtimeState.source = 'supabase'
  runtimeState.remoteCount = Object.keys(settingsById || {}).length
  runtimeState.lastSyncedAt = now
}

export function getPluginRuntimeState() {
  return runtimeState
}

export function getAvailablePlugins() {
  return getPluginCatalogManifests().slice()
}

export function getInstalledPlugins() {
  return getAvailablePlugins()
}

export function getPluginSettings(pluginId) {
  return runtimeState.settingsById[pluginId] || null
}

export function getPluginConfig(pluginOrId) {
  const pluginId = getPluginId(pluginOrId)
  const plugin = getPluginById(pluginId)
  const current = runtimeState.settingsById[pluginId]
  return normalizePluginConfig(pluginId, current?.config || plugin?.defaultConfig)
}

export function getPluginSettingValue(pluginOrId, key, fallback = null) {
  const config = getPluginConfig(pluginOrId)
  if (!key) return fallback
  return config[key] ?? fallback
}

export function isPluginInstalled(pluginOrId) {
  return Boolean(getPluginById(getPluginId(pluginOrId)))
}

export function isPluginEnabled(pluginOrId) {
  const pluginId = getPluginId(pluginOrId)
  if (!pluginId) return false
  const setting = runtimeState.settingsById[pluginId]
  if (typeof setting?.enabled === 'boolean') return setting.enabled
  const plugin = getPluginById(pluginId)
  return plugin ? plugin.enabled !== false : false
}

export function getEnabledPlugins() {
  return getAvailablePlugins().filter((plugin) => isPluginEnabled(plugin.id))
}

function buildPluginExtensionContext(plugin, context = {}) {
  return {
    ...context,
    plugin,
    config: getPluginConfig(plugin.id),
    pluginEventBus,
    emit: pluginEventBus.emit,
    on: pluginEventBus.on,
    off: pluginEventBus.off,
  }
}

function collectPluginExtensions(key, context = {}, options = {}) {
  const {
    target = '',
    requiresComponent = false,
    filterItem = () => true,
    buildId = (plugin, item) => `${plugin.id}:${item.id || key}`,
    transform = (plugin, item, pluginContext) => ({
      ...item,
      id: item.id || buildId(plugin, item),
      pluginId: plugin.id,
      pluginName: plugin.name,
      config: getPluginConfig(plugin.id),
      badge: typeof item.badge === 'function' ? item.badge(pluginContext) : item.badge,
    }),
  } = options

  return getEnabledPlugins()
    .flatMap((plugin) => {
      const pluginContext = buildPluginExtensionContext(plugin, context)
      return (plugin[key] || [])
        .filter((item) => !target || item.target === target)
        .filter((item) => !requiresComponent || item.component)
        .filter((item) => canAccess(item.meta || {}, context.auth))
        .filter((item) => {
          if (typeof item.when !== 'function') return true
          try {
            return item.when(pluginContext) !== false
          } catch (error) {
            console.error(`[plugins] Failed to evaluate ${key} item for ${plugin.id}`, error)
            return false
          }
        })
        .filter((item) => {
          try {
            return filterItem(item, pluginContext)
          } catch (error) {
            console.error(`[plugins] Failed to filter ${key} item for ${plugin.id}`, error)
            return false
          }
        })
        .map((item) => transform(plugin, item, pluginContext))
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0))
}

export function getPluginRoutes() {
  return getEnabledPlugins()
    .flatMap((plugin) => (plugin.routes || []).map((route) => normalizePluginRoute(route, plugin)))
    .sort((a, b) => (a.order || 0) - (b.order || 0))
}

export function getPluginMenus(location, context = {}) {
  const menus = getEnabledPlugins()
    .flatMap((plugin) =>
      (plugin.menus || [])
        .filter((menu) => menu.location === location)
        .map((menu) => ({
          ...menu,
          pluginId: plugin.id,
          pluginName: plugin.name,
        })),
    )
    .filter((menu) => canAccess(menu.meta || {}, context.auth))

  return resolveVisibleMenus(menus, context)
}

export function getTopbarActions(context = {}) {
  return collectPluginExtensions('topbarActions', context, {
    buildId: (plugin) => `${plugin.id}:topbar-action`,
  })
}

export function getNotificationTemplates(context = {}) {
  return collectPluginExtensions('notificationTemplates', context, {
    buildId: (plugin) => `${plugin.id}:notification-template`,
  })
}

export function getNotificationCenterPanels(context = {}) {
  return collectPluginExtensions('notificationCenterPanels', context, {
    requiresComponent: true,
    buildId: (plugin) => `${plugin.id}:notification-center-panel`,
  })
}

export function getAuditLogPanels(context = {}) {
  return collectPluginExtensions('auditLogPanels', context, {
    requiresComponent: true,
    buildId: (plugin) => `${plugin.id}:audit-log-panel`,
  })
}

export function getAdminDashboardWidgets(context = {}) {
  return collectPluginExtensions('dashboardWidgets', context, {
    requiresComponent: true,
    buildId: (plugin) => `${plugin.id}:dashboard-widget`,
  })
}

export function getProfilePanels(context = {}) {
  const target = context.target || 'self'
  return collectPluginExtensions('profilePanels', context, {
    requiresComponent: true,
    filterItem: (panel) => {
      const panelTarget = panel.target || 'self'
      return panelTarget === 'both' || panelTarget === target
    },
    buildId: (plugin, panel) => `${plugin.id}:${panel.title || 'profile-panel'}`,
  })
}

export function getImageListCardExtras(context = {}) {
  return collectPluginExtensions('imageListCardExtras', context, {
    requiresComponent: true,
    buildId: (plugin) => `${plugin.id}:image-list-card-extra`,
  })
}

export function getUserListItemExtras(context = {}) {
  return collectPluginExtensions('userListItemExtras', context, {
    requiresComponent: true,
    buildId: (plugin) => `${plugin.id}:user-list-item-extra`,
  })
}

export function getAdminListFields(context = {}) {
  return collectPluginExtensions('adminListFields', context, {
    target: context.target || '',
    requiresComponent: true,
    buildId: (plugin, field) => `${plugin.id}:${field.title || 'admin-list-field'}`,
  })
}

export function getSubmissionReviewSidebarPanels(context = {}) {
  return collectPluginExtensions('submissionReviewSidebarPanels', context, {
    requiresComponent: true,
    buildId: (plugin, panel) => `${plugin.id}:${panel.title || 'submission-review-panel'}`,
  })
}

export function getAdminTableRowActions(context = {}) {
  return collectPluginExtensions('adminTableRowActions', context, {
    target: context.target || '',
    buildId: (plugin, action) => `${plugin.id}:${action.label || 'admin-row-action'}`,
  })
}

export function getAdminQuickActions(context = {}) {
  return collectPluginExtensions('adminQuickActions', context, {
    target: context.target || '',
    buildId: (plugin, action) => `${plugin.id}:${action.label || 'admin-quick-action'}`,
  })
}

export function getReviewBulkActions(context = {}) {
  return collectPluginExtensions('reviewBulkActions', context, {
    target: context.target || '',
    buildId: (plugin, action) => `${plugin.id}:${action.label || 'review-bulk-action'}`,
  })
}

export function getImageDetailActions(context = {}) {
  return collectPluginExtensions('imageDetailActions', context, {
    buildId: (plugin, action) => `${plugin.id}:${action.label || 'image-detail-action'}`,
    transform: (plugin, action) => ({
      ...action,
      id: action.id || `${plugin.id}:${action.label || 'image-detail-action'}`,
      pluginId: plugin.id,
      pluginName: plugin.name,
    }),
  })
}

export async function emitPluginEvent(event, payload = {}) {
  if (!event) return
  await pluginEventBus.emit(event, {
    ...payload,
    event,
    emittedAt: new Date().toISOString(),
  })
}

export function onPluginEvent(event, handler) {
  if (!event || typeof handler !== 'function') return () => {}
  pluginEventBus.on(event, handler)
  return () => pluginEventBus.off(event, handler)
}

export function syncPluginRoutes(router) {
  if (!router) return

  for (const routeName of Array.from(registeredPluginRouteNames)) {
    if (router.hasRoute(routeName)) {
      router.removeRoute(routeName)
    }
    registeredPluginRouteNames.delete(routeName)
  }

  for (const route of getPluginRoutes()) {
    router.addRoute(route)
    if (route.name) {
      registeredPluginRouteNames.add(route.name)
    }
  }
}

export async function loadPluginSettings() {
  if (loadSettingsPromise) return loadSettingsPromise

  loadSettingsPromise = (async () => {
    runtimeState.loading = true
    runtimeState.error = ''

    const localSettings = readPersistedPluginSettings()
    setRuntimeSettings(localSettings, {
      source: 'local',
      remoteCount: 0,
    })

    if (!supabaseEnabled) {
      runtimeState.loading = false
      return runtimeState.settingsById
    }

    try {
      const { settings: remoteSettings, updatedAt } = await fetchRemoteFeatureSettings()
      const mergedSettings = mergeRemoteSettings(remoteSettings)
      setRuntimeSettings(mergedSettings, {
        source: 'supabase',
        remoteCount: Object.keys(remoteSettings || {}).length,
        lastSyncedAt: updatedAt,
      })
    } catch (error) {
      runtimeState.error = error?.message || '功能开关读取失败，已回退到本地配置。'
      runtimeState.source = 'local'
      runtimeState.loading = false
    }

    return runtimeState.settingsById
  })()

  try {
    return await loadSettingsPromise
  } finally {
    loadSettingsPromise = null
    runtimeState.loading = false
  }
}

export async function reloadPluginRuntime({ router } = {}) {
  await loadPluginSettings()
  if (router || runtimeContext?.router) {
    syncPluginRoutes(router || runtimeContext.router)
  }
  for (const plugin of getEnabledPlugins()) {
    await ensurePluginSetup(plugin)
  }
  return runtimeState.settingsById
}

export async function syncInstalledPluginsToRemote() {
  if (!supabaseEnabled) {
    throw new Error('Supabase 未配置，当前只能使用本地功能开关配置。')
  }
  await persistFeatureSettingsRemote()
  return reloadPluginRuntime({ router: runtimeContext?.router })
}

export function getPluginCompatibilityReport(pluginId) {
  return getPluginCompatibility(pluginId)
}

export function getPluginLifecycleState(pluginId) {
  return getPluginLifecycle(pluginId)
}

export function getPluginRegistryState(pluginId) {
  return runtimeState.settingsById[pluginId] || null
}

export function getPluginUpgradePolicy(pluginId) {
  const plugin = getPluginById(pluginId)
  if (!plugin) return null
  return buildPluginUpgradePolicy(plugin)
}

export async function installPlugin(pluginId, options = {}) {
  return setPluginEnabled(pluginId, options.enable ?? true, options)
}

export async function uninstallPlugin(pluginId, options = {}) {
  const state = await setPluginEnabled(pluginId, false, options)
  if (options.clearConfig) {
    await savePluginConfig(pluginId, buildDefaultPluginConfig(getPluginById(pluginId)), options)
  }
  return state
}

export async function reinstallPlugin(pluginId, options = {}) {
  const plugin = getPluginById(pluginId)
  if (!plugin) {
    throw new Error(`未找到功能模块：${pluginId}`)
  }

  const wasEnabled = isPluginEnabled(pluginId)
  initializedPluginIds.delete(pluginId)
  await savePluginConfig(pluginId, buildDefaultPluginConfig(plugin), options)
  if (wasEnabled) {
    await setPluginEnabled(pluginId, false, { ...options, persistRemote: false })
    await setPluginEnabled(pluginId, true, options)
  }
  return runtimeState.settingsById[pluginId]
}

export async function setPluginEnabled(pluginId, enabled, options = {}) {
  const plugin = getPluginById(pluginId)
  if (!plugin) {
    throw new Error(`未找到功能模块：${pluginId}`)
  }

  const currentSettings = runtimeState.settingsById[pluginId] || getManifestDefaults()[pluginId]
  const previousSettings = runtimeState.settingsById
  const previousEnabled = Boolean(currentSettings.enabled)

  patchPluginSettings(pluginId, {
    enabled,
    lifecycleStatus: enabled ? 'enabled' : 'disabled',
    config: normalizePluginConfig(pluginId, currentSettings.config),
  })

  const targetRouter = options.router || runtimeContext?.router
  try {
    if (enabled && !previousEnabled) {
      await runPluginPhase(plugin, 'enable', { ...options })
    }
    if (!enabled && previousEnabled) {
      await runPluginPhase(plugin, 'disable', { ...options })
      initializedPluginIds.delete(pluginId)
    }

    if (targetRouter) {
      syncPluginRoutes(targetRouter)
    }

    if (enabled) {
      await ensurePluginSetup(plugin)
    }

    if (options.persistRemote !== false && supabaseEnabled) {
      await persistFeatureSettingsRemote()
    }

    return runtimeState.settingsById[pluginId]
  } catch (error) {
    runtimeState.settingsById = previousSettings
    persistPluginSettings(previousSettings)
    if (targetRouter) {
      syncPluginRoutes(targetRouter)
    }
    throw error
  }
}

export async function savePluginConfig(pluginId, config, options = {}) {
  const plugin = getPluginById(pluginId)
  if (!plugin) {
    throw new Error(`未找到功能模块：${pluginId}`)
  }

  const currentSettings = runtimeState.settingsById[pluginId] || getManifestDefaults()[pluginId]
  const previousSettings = runtimeState.settingsById
  const normalizedConfig = normalizePluginConfig(pluginId, config)
  const nextSettings = {
    ...runtimeState.settingsById,
    [pluginId]: {
      ...currentSettings,
      config: normalizedConfig,
      updatedAt: new Date().toISOString(),
    },
  }

  setRuntimeSettings(nextSettings, getRuntimeMeta())

  if (options.persistRemote === false || !supabaseEnabled) {
    return runtimeState.settingsById[pluginId]
  }

  try {
    await persistFeatureSettingsRemote(nextSettings)
    return runtimeState.settingsById[pluginId]
  } catch (error) {
    runtimeState.settingsById = previousSettings
    persistPluginSettings(previousSettings)
    throw error
  }
}

export async function resetPluginConfig(pluginId, options = {}) {
  return savePluginConfig(pluginId, buildDefaultPluginConfig(getPluginById(pluginId)), options)
}

export async function initializePluginRuntime(context = {}) {
  runtimeContext = {
    ...context,
    pluginEventBus,
    emit: pluginEventBus.emit,
    on: pluginEventBus.on,
    off: pluginEventBus.off,
  }

  await loadPluginSettings()
  if (runtimeContext.router) {
    syncPluginRoutes(runtimeContext.router)
  }

  for (const plugin of getEnabledPlugins()) {
    await ensurePluginSetup(plugin)
  }
}

