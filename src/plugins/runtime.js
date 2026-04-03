import { reactive } from 'vue'
import { createPluginApi, PLUGIN_API_VERSION, PLUGIN_HOST_VERSION, isCompatibleVersionRange } from '@/plugins/api'
import { canAccess } from '@/lib/access'
import { resolveVisibleMenus } from '@/config/navigation'
import { createPluginEventBus } from '@/plugins/eventBus'
import { requireSupabase, supabaseEnabled } from '@/lib/supabase'
import { safeInsertAuditLog } from '@/lib/audit'
import { buildPluginUpgradePolicy } from '@/plugins/upgradePolicy'
import { getPluginCatalogEntries, getPluginCatalogManifestById, getPluginCatalogManifests, getPluginCatalogEntryById } from '@/plugins/registry'

const LEGACY_DISABLED_PLUGIN_STORAGE_KEY = 'hamgam:plugins:disabled'
const PLUGIN_SETTINGS_STORAGE_KEY = 'hamgam:plugins:settings'
const PLUGIN_CONFIG_KEY = 'config'
const PLUGIN_API_HOST_VERSION = PLUGIN_HOST_VERSION
const pluginServices = reactive({})
const BASIC_PLUGIN_COLUMNS = 'id, name, version, description, enabled, default_enabled, updated_at'
const REGISTRY_PLUGIN_COLUMNS = `${BASIC_PLUGIN_COLUMNS}, installed, registration_status, install_source, registered_at, uninstalled_at`
const LIFECYCLE_PLUGIN_COLUMNS = `${REGISTRY_PLUGIN_COLUMNS}, installed_version, api_version, host_version_range, status, installed_at, enabled_at, disabled_at, last_error`
let remoteRegistryColumnsSupported = true
let remoteLifecycleColumnsSupported = true

const pluginCatalogEntries = getPluginCatalogEntries()

const pluginEventBus = createPluginEventBus()
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

const registeredPluginRouteNames = new Set()
const initializedPluginIds = new Set()
const initializedPluginHookIds = new Set()
let runtimeContext = null
let loadSettingsPromise = null

function getPluginId(pluginOrId) {
  if (typeof pluginOrId === 'string') return pluginOrId
  return pluginOrId?.id || ''
}

function getPluginById(pluginId) {
  return getPluginCatalogManifestById(pluginId)
}

function getPluginCatalogEntry(pluginId) {
  return getPluginCatalogEntryById(pluginId)
}

function getPluginCompatibility(pluginOrId) {
  const plugin = typeof pluginOrId === 'string' ? getPluginById(pluginOrId) : pluginOrId
  if (!plugin) {
    return {
      compatible: false,
      hostVersion: PLUGIN_API_HOST_VERSION,
      requiredRange: '*',
      reason: '未找到插件定义。',
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

function getPluginLifecycle(pluginId) {
  return runtimeState.settingsById[pluginId] || getManifestDefaults()[pluginId] || null
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

function getManifestDefaults() {
  return getPluginCatalogManifests().reduce((acc, plugin) => {
    acc[plugin.id] = {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version || '0.0.0',
      description: plugin.description || '',
      installed: true,
      registrationStatus: 'installed',
      installSource: getPluginCatalogEntry(plugin.id)?.source || 'builtin',
      registeredAt: null,
      uninstalledAt: null,
      enabled: plugin.enabled !== false,
      defaultEnabled: plugin.enabled !== false,
      config: buildDefaultPluginConfig(plugin),
      updatedAt: null,
      installedVersion: null,
      apiVersion: plugin.apiVersion || PLUGIN_API_VERSION,
      hostVersionRange: plugin.hostVersionRange || PLUGIN_API_HOST_VERSION,
      lifecycleStatus: plugin.enabled !== false ? 'enabled' : 'disabled',
      installedAt: null,
      enabledAt: plugin.enabled !== false ? new Date().toISOString() : null,
      disabledAt: plugin.enabled === false ? new Date().toISOString() : null,
      lastError: null,
    }
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
    if (legacyDisabledIds.has(pluginId)) {
      defaults[pluginId].enabled = false
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
      if (!defaults[pluginId] || !value || typeof value !== 'object') return
      defaults[pluginId] = {
        ...defaults[pluginId],
        ...value,
        enabled: typeof value.enabled === 'boolean' ? value.enabled : defaults[pluginId].enabled,
        config: normalizePluginConfig(pluginId, value.config),
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

function mergeRemoteSettings(rows = [], configRows = []) {
  const defaults = getManifestDefaults()

  rows.forEach((row) => {
    if (!row?.id || !defaults[row.id]) return
    defaults[row.id] = {
      ...defaults[row.id],
      ...row,
      installed: typeof row.installed === 'boolean' ? row.installed : defaults[row.id].installed,
      registrationStatus: row.registration_status || defaults[row.id].registrationStatus,
      installSource: row.install_source || defaults[row.id].installSource,
      registeredAt: row.registered_at || defaults[row.id].registeredAt,
      uninstalledAt: row.uninstalled_at || defaults[row.id].uninstalledAt,
      enabled: typeof row.enabled === 'boolean' ? row.enabled : defaults[row.id].enabled,
      defaultEnabled: typeof row.default_enabled === 'boolean' ? row.default_enabled : defaults[row.id].defaultEnabled,
      updatedAt: row.updated_at || defaults[row.id].updatedAt,
      installedVersion: row.installed_version || defaults[row.id].installedVersion,
      apiVersion: row.api_version || defaults[row.id].apiVersion,
      hostVersionRange: row.host_version_range || defaults[row.id].hostVersionRange,
      lifecycleStatus: row.status || defaults[row.id].lifecycleStatus,
      installedAt: row.installed_at || defaults[row.id].installedAt,
      enabledAt: row.enabled_at || defaults[row.id].enabledAt,
      disabledAt: row.disabled_at || defaults[row.id].disabledAt,
      lastError: row.last_error || defaults[row.id].lastError,
    }
  })

  configRows.forEach((row) => {
    if (!row?.plugin_id || !defaults[row.plugin_id]) return
    defaults[row.plugin_id] = {
      ...defaults[row.plugin_id],
      config: normalizePluginConfig(row.plugin_id, row.value_json),
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
      config: normalizePluginConfig(pluginId, patch.config ?? current?.config),
    },
  }
  setRuntimeSettings(next, getRuntimeMeta())
  return next[pluginId]
}

function isInstalledSetting(setting) {
  if (typeof setting?.installed === 'boolean') return setting.installed
  return true
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

async function runLifecycleHook(plugin, phase, payload = {}) {
  const handler = plugin?.lifecycle?.[phase]
  const now = new Date().toISOString()
  const current = runtimeState.settingsById[plugin.id] || getManifestDefaults()[plugin.id]
  const compatibility = getPluginCompatibility(plugin)

  if (phase === 'enable' && !compatibility.compatible) {
    const message = compatibility.reason || '插件与当前宿主版本不兼容。'
    patchPluginSettings(plugin.id, {
      lifecycleStatus: 'error',
      lastError: message,
    })
    throw new Error(message)
  }

  const patch = {
    installed: current.installed,
    registrationStatus: current.registrationStatus || 'installed',
    installSource: current.installSource || getPluginCatalogEntry(plugin.id)?.source || 'builtin',
    registeredAt: current.registeredAt || null,
    uninstalledAt: current.uninstalledAt || null,
    installedVersion: plugin.version || current.installedVersion || '0.0.0',
    apiVersion: plugin.apiVersion || PLUGIN_API_VERSION,
    hostVersionRange: plugin.hostVersionRange || PLUGIN_API_HOST_VERSION,
    lastError: null,
  }

  if (phase === 'install') {
    patch.installed = true
    patch.registrationStatus = 'installed'
    patch.registeredAt = current.registeredAt || now
    patch.uninstalledAt = null
    patch.lifecycleStatus = current.enabled ? 'enabled' : 'installed'
    patch.installedAt = current.installedAt || now
  }
  if (phase === 'upgrade') {
    patch.lifecycleStatus = current.enabled ? 'enabled' : 'installed'
  }
  if (phase === 'enable') {
    patch.lifecycleStatus = 'enabled'
    patch.enabledAt = now
    patch.disabledAt = null
  }
  if (phase === 'disable') {
    patch.lifecycleStatus = 'disabled'
    patch.disabledAt = now
  }
  if (phase === 'uninstall') {
    patch.installed = false
    patch.registrationStatus = 'uninstalled'
    patch.enabled = false
    patch.lifecycleStatus = 'disabled'
    patch.uninstalledAt = now
    patch.disabledAt = now
  }

  patchPluginSettings(plugin.id, patch)

  const lifecyclePayload = {
    phase,
    plugin,
    pluginId: plugin.id,
    pluginName: plugin.name,
    currentVersion: plugin.version || '0.0.0',
    previousVersion: payload.previousVersion || current.installedVersion || null,
    config: getPluginConfig(plugin.id),
    compatibility,
    ...payload,
  }

  try {
    const api = createStablePluginApi(plugin, payload)
    if (typeof handler === 'function') {
      await handler({
        ...lifecyclePayload,
        api,
      })
    }

    const lifecycleActionMap = {
      install: 'plugin.installed',
      upgrade: 'plugin.upgraded',
      enable: 'plugin.enabled',
      disable: 'plugin.disabled',
      uninstall: 'plugin.uninstalled',
    }
    const lifecycleLevelMap = {
      install: 'info',
      upgrade: 'info',
      enable: 'success',
      disable: 'warn',
      uninstall: 'warn',
    }

    await safeInsertAuditLog({
      action: lifecycleActionMap[phase] || 'plugin.lifecycle',
      entityType: 'plugin',
      entityId: plugin.id,
      level: lifecycleLevelMap[phase] || 'info',
      details: {
        plugin_id: plugin.id,
        plugin_name: plugin.name,
        phase,
        version: plugin.version || '0.0.0',
        previous_version: payload.previousVersion || current.installedVersion || null,
        compatible: compatibility.compatible,
      },
    })

    return runtimeState.settingsById[plugin.id]
  } catch (error) {
    patchPluginSettings(plugin.id, {
      lifecycleStatus: 'error',
      lastError: error?.message || String(error),
    })
    await safeInsertAuditLog({
      action: 'plugin.lifecycle_failed',
      entityType: 'plugin',
      entityId: plugin.id,
      level: 'error',
      details: {
        plugin_id: plugin.id,
        plugin_name: plugin.name,
        phase,
        message: error?.message || String(error),
      },
    })
    throw error
  }
}

async function reconcilePluginLifecycle() {
  for (const plugin of getInstalledPlugins()) {
    const current = runtimeState.settingsById[plugin.id] || getManifestDefaults()[plugin.id]
    const version = plugin.version || '0.0.0'

    if (!current.installedVersion) {
      await runLifecycleHook(plugin, 'install')
    } else if (current.installedVersion !== version) {
      await runLifecycleHook(plugin, 'upgrade', { previousVersion: current.installedVersion })
    }

    const refreshed = runtimeState.settingsById[plugin.id] || current
    if (refreshed.enabled && refreshed.lifecycleStatus !== 'enabled') {
      await runLifecycleHook(plugin, 'enable')
    }
    if (!refreshed.enabled && refreshed.lifecycleStatus === 'enabled') {
      await runLifecycleHook(plugin, 'disable')
    }
  }
}

async function persistPluginRegistryRow(pluginId) {
  if (!supabaseEnabled) return
  const plugin = getPluginById(pluginId)
  if (!plugin) return
  const current = runtimeState.settingsById[pluginId] || getManifestDefaults()[pluginId]
  await upsertPluginRows([{
    id: plugin.id,
    name: plugin.name,
    version: plugin.version || '0.0.0',
    description: plugin.description || '',
    installed: isInstalledSetting(current),
    registration_status: current.registrationStatus || (isInstalledSetting(current) ? 'installed' : 'uninstalled'),
    install_source: current.installSource || getPluginCatalogEntry(plugin.id)?.source || 'builtin',
    registered_at: current.registeredAt || null,
    uninstalled_at: current.uninstalledAt || null,
    enabled: current.enabled,
    default_enabled: plugin.enabled !== false,
    installed_version: current.installedVersion || plugin.version || '0.0.0',
    api_version: plugin.apiVersion || PLUGIN_API_VERSION,
    host_version_range: plugin.hostVersionRange || PLUGIN_API_HOST_VERSION,
    status: current.lifecycleStatus || (current.enabled ? 'enabled' : 'disabled'),
    installed_at: current.installedAt || null,
    enabled_at: current.enabledAt || null,
    disabled_at: current.disabledAt || null,
    last_error: current.lastError || null,
    updated_at: new Date().toISOString(),
  }], 'id')
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
        if (!isPluginInstalled(plugin.id) || !isPluginEnabled(plugin.id)) return
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

async function fetchRemotePluginRows() {
  const supabase = requireSupabase()
  const selectRows = async (columns) => {
    const { data, error } = await supabase
      .from('plugins')
      .select(columns)
      .order('id', { ascending: true })

    if (error) throw error
    return data || []
  }

  if (remoteLifecycleColumnsSupported) {
    try {
      return await selectRows(LIFECYCLE_PLUGIN_COLUMNS)
    } catch (error) {
      const message = String(error?.message || '')
      const missingLifecycleColumn = error?.code === 'PGRST204' || /installed_version|api_version|host_version_range|enabled_at|disabled_at|last_error|status/i.test(message)
      if (!missingLifecycleColumn) throw error
      remoteLifecycleColumnsSupported = false
      console.warn('[plugins] plugins 表未包含生命周期扩展列，已回退到注册中心兼容模式。', error)
    }
  }

  if (remoteRegistryColumnsSupported) {
    try {
      return await selectRows(REGISTRY_PLUGIN_COLUMNS)
    } catch (error) {
      const message = String(error?.message || '')
      const missingRegistryColumn = error?.code === 'PGRST204' || /installed|registration_status|install_source|registered_at|uninstalled_at/i.test(message)
      if (!missingRegistryColumn) throw error
      remoteRegistryColumnsSupported = false
      console.warn('[plugins] plugins 表未包含注册中心扩展列，已回退到基础兼容模式。', error)
    }
  }

  return selectRows(BASIC_PLUGIN_COLUMNS)
}

async function fetchRemotePluginConfigRows() {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('plugin_settings')
    .select('plugin_id, key, value_json, updated_at')
    .eq('key', PLUGIN_CONFIG_KEY)
    .order('plugin_id', { ascending: true })

  if (error) throw error
  return data || []
}

function buildPluginSyncPayload() {
  return getPluginCatalogManifests().map((plugin) => {
    const current = runtimeState.settingsById[plugin.id] || {}
    const basePayload = {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version || '0.0.0',
      description: plugin.description || '',
      installed: typeof current.installed === 'boolean' ? current.installed : true,
      registration_status: current.registrationStatus || 'installed',
      install_source: current.installSource || getPluginCatalogEntry(plugin.id)?.source || 'builtin',
      registered_at: current.registeredAt || null,
      uninstalled_at: current.uninstalledAt || null,
      enabled: typeof current.enabled === 'boolean' ? current.enabled : plugin.enabled !== false,
      default_enabled: plugin.enabled !== false,
      updated_at: new Date().toISOString(),
    }

    if (!remoteRegistryColumnsSupported && !remoteLifecycleColumnsSupported) {
      return {
        id: basePayload.id,
        name: basePayload.name,
        version: basePayload.version,
        description: basePayload.description,
        enabled: basePayload.enabled,
        default_enabled: basePayload.default_enabled,
        updated_at: basePayload.updated_at,
      }
    }

    if (!remoteLifecycleColumnsSupported) {
      return basePayload
    }

    return {
      ...basePayload,
      installed_version: current.installedVersion || plugin.version || '0.0.0',
      api_version: plugin.apiVersion || PLUGIN_API_VERSION,
      host_version_range: plugin.hostVersionRange || PLUGIN_API_HOST_VERSION,
      status: current.lifecycleStatus || (current.enabled ? 'enabled' : 'disabled'),
      installed_at: current.installedAt || null,
      enabled_at: current.enabledAt || null,
      disabled_at: current.disabledAt || null,
      last_error: current.lastError || null,
    }
  })
}

async function upsertPluginRows(payload, onConflict = 'id') {
  const supabase = requireSupabase()
  if (remoteLifecycleColumnsSupported) {
    const { error } = await supabase.from('plugins').upsert(payload, { onConflict })
    if (!error) return

    const message = String(error?.message || '')
    const missingLifecycleColumn = error?.code === 'PGRST204' || /installed_version|api_version|host_version_range|enabled_at|disabled_at|last_error|status/i.test(message)
    if (!missingLifecycleColumn) throw error

    remoteLifecycleColumnsSupported = false
    console.warn('[plugins] plugins 表缺少生命周期扩展列，已回退到注册中心写入模式。', error)
  }

  if (remoteRegistryColumnsSupported) {
    const registryPayload = payload.map(({ id, name, version, description, installed, registration_status, install_source, registered_at, uninstalled_at, enabled, default_enabled, updated_at }) => ({
      id,
      name,
      version,
      description,
      installed,
      registration_status,
      install_source,
      registered_at,
      uninstalled_at,
      enabled,
      default_enabled,
      updated_at,
    }))
    const { error } = await supabase.from('plugins').upsert(registryPayload, { onConflict })
    if (!error) return

    const message = String(error?.message || '')
    const missingRegistryColumn = error?.code === 'PGRST204' || /installed|registration_status|install_source|registered_at|uninstalled_at/i.test(message)
    if (!missingRegistryColumn) throw error

    remoteRegistryColumnsSupported = false
    console.warn('[plugins] plugins 表缺少注册中心扩展列，已回退到基础兼容写入模式。', error)
  }

  const fallbackPayload = payload.map(({ id, name, version, description, enabled, default_enabled, updated_at }) => ({
    id,
    name,
    version,
    description,
    enabled,
    default_enabled,
    updated_at,
  }))
  const { error } = await supabase.from('plugins').upsert(fallbackPayload, { onConflict })
  if (error) throw error
}

function buildPluginConfigSyncPayload(pluginId = null) {
  return getPluginCatalogManifests()
    .filter((plugin) => !pluginId || plugin.id === pluginId)
    .map((plugin) => ({
      plugin_id: plugin.id,
      key: PLUGIN_CONFIG_KEY,
      value_json: normalizePluginConfig(plugin.id, runtimeState.settingsById[plugin.id]?.config),
      updated_at: new Date().toISOString(),
    }))
}

export function getPluginRuntimeState() {
  return runtimeState
}

export function getAvailablePlugins() {
  return getPluginCatalogManifests().slice()
}

export function getInstalledPlugins() {
  return getPluginCatalogManifests().filter((plugin) => isPluginInstalled(plugin.id))
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
  const pluginId = getPluginId(pluginOrId)
  if (!pluginId) return false
  const setting = runtimeState.settingsById[pluginId]
  if (typeof setting?.installed === 'boolean') return setting.installed
  return Boolean(getPluginById(pluginId))
}

export function isPluginEnabled(pluginOrId) {
  const pluginId = getPluginId(pluginOrId)
  if (!pluginId || !isPluginInstalled(pluginId)) return false
  const setting = runtimeState.settingsById[pluginId]
  if (typeof setting?.enabled === 'boolean') return setting.enabled
  const plugin = getPluginById(pluginId)
  return plugin ? plugin.enabled !== false : false
}

export function getEnabledPlugins() {
  return getInstalledPlugins().filter((plugin) => isPluginEnabled(plugin.id))
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
    .filter((menu) => canAccess(menu.meta, context.auth))

  return resolveVisibleMenus(menus, context)
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



export function getTopbarActions(context = {}) {
  return getEnabledPlugins()
    .flatMap((plugin) => {
      const pluginContext = buildPluginExtensionContext(plugin, context)
      return (plugin.topbarActions || [])
        .filter((action) => canAccess(action.meta || {}, context.auth))
        .filter((action) => {
          if (typeof action.when !== 'function') return true
          try {
            return action.when(pluginContext) !== false
          } catch (error) {
            console.error(`[plugins] Failed to evaluate topbar action for ${plugin.id}`, error)
            return false
          }
        })
        .map((action) => ({
          ...action,
          id: action.id || `${plugin.id}:topbar-action`,
          pluginId: plugin.id,
          pluginName: plugin.name,
          config: getPluginConfig(plugin.id),
        }))
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0))
}

export function getNotificationTemplates(context = {}) {
  return getEnabledPlugins()
    .flatMap((plugin) => {
      const pluginContext = buildPluginExtensionContext(plugin, context)
      return (plugin.notificationTemplates || [])
        .filter((template) => canAccess(template.meta || {}, context.auth))
        .filter((template) => {
          if (typeof template.when !== 'function') return true
          try {
            return template.when(pluginContext) !== false
          } catch (error) {
            console.error(`[plugins] Failed to evaluate notification template for ${plugin.id}`, error)
            return false
          }
        })
        .map((template) => ({
          ...template,
          id: template.id || `${plugin.id}:notification-template`,
          pluginId: plugin.id,
          pluginName: plugin.name,
          config: getPluginConfig(plugin.id),
        }))
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0))
}

export function getNotificationCenterPanels(context = {}) {
  return getEnabledPlugins()
    .flatMap((plugin) => {
      const pluginContext = buildPluginExtensionContext(plugin, context)
      return (plugin.notificationCenterPanels || [])
        .filter((panel) => panel.component)
        .filter((panel) => canAccess(panel.meta || {}, context.auth))
        .filter((panel) => {
          if (typeof panel.when !== 'function') return true
          try {
            return panel.when(pluginContext) !== false
          } catch (error) {
            console.error(`[plugins] Failed to evaluate notification center panel for ${plugin.id}`, error)
            return false
          }
        })
        .map((panel) => ({
          ...panel,
          id: panel.id || `${plugin.id}:notification-center-panel`,
          pluginId: plugin.id,
          pluginName: plugin.name,
          config: getPluginConfig(plugin.id),
        }))
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0))
}

export function getAuditLogPanels(context = {}) {
  return getEnabledPlugins()
    .flatMap((plugin) => {
      const pluginContext = buildPluginExtensionContext(plugin, context)
      return (plugin.auditLogPanels || [])
        .filter((panel) => panel.component)
        .filter((panel) => canAccess(panel.meta || {}, context.auth))
        .filter((panel) => {
          if (typeof panel.when !== 'function') return true
          try {
            return panel.when(pluginContext) !== false
          } catch (error) {
            console.error(`[plugins] Failed to evaluate audit log panel for ${plugin.id}`, error)
            return false
          }
        })
        .map((panel) => ({
          ...panel,
          id: panel.id || `${plugin.id}:audit-log-panel`,
          pluginId: plugin.id,
          pluginName: plugin.name,
          config: getPluginConfig(plugin.id),
        }))
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0))
}

export function getAdminDashboardWidgets(context = {}) {
  return getEnabledPlugins()
    .flatMap((plugin) => {
      const pluginContext = buildPluginExtensionContext(plugin, context)
      return (plugin.dashboardWidgets || [])
        .filter((widget) => widget.component)
        .filter((widget) => canAccess(widget.meta || {}, context.auth))
        .filter((widget) => {
          if (typeof widget.when !== 'function') return true
          try {
            return widget.when(pluginContext) !== false
          } catch (error) {
            console.error(`[plugins] Failed to evaluate dashboard widget for ${plugin.id}`, error)
            return false
          }
        })
        .map((widget) => ({
          ...widget,
          id: widget.id || `${plugin.id}:dashboard-widget`,
          pluginId: plugin.id,
          pluginName: plugin.name,
          config: getPluginConfig(plugin.id),
        }))
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0))
}


export function getProfilePanels(context = {}) {
  const target = context.target || 'self'
  return getEnabledPlugins()
    .flatMap((plugin) => {
      const pluginContext = buildPluginExtensionContext(plugin, context)
      return (plugin.profilePanels || [])
        .filter((panel) => panel.component)
        .filter((panel) => {
          const panelTarget = panel.target || 'self'
          return panelTarget === 'both' || panelTarget === target
        })
        .filter((panel) => canAccess(panel.meta || {}, context.auth))
        .filter((panel) => {
          if (typeof panel.when !== 'function') return true
          try {
            return panel.when(pluginContext) !== false
          } catch (error) {
            console.error(`[plugins] Failed to evaluate profile panel for ${plugin.id}`, error)
            return false
          }
        })
        .map((panel) => ({
          ...panel,
          id: panel.id || `${plugin.id}:profile-panel`,
          pluginId: plugin.id,
          pluginName: plugin.name,
          config: getPluginConfig(plugin.id),
        }))
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0))
}

export function getImageListCardExtras(context = {}) {
  return getEnabledPlugins()
    .flatMap((plugin) => {
      const pluginContext = buildPluginExtensionContext(plugin, context)
      return (plugin.imageListCardExtras || [])
        .filter((extra) => extra.component)
        .filter((extra) => canAccess(extra.meta || {}, context.auth))
        .filter((extra) => {
          if (typeof extra.when !== 'function') return true
          try {
            return extra.when(pluginContext) !== false
          } catch (error) {
            console.error(`[plugins] Failed to evaluate image list card extra for ${plugin.id}`, error)
            return false
          }
        })
        .map((extra) => ({
          ...extra,
          id: extra.id || `${plugin.id}:image-list-card-extra`,
          pluginId: plugin.id,
          pluginName: plugin.name,
          config: getPluginConfig(plugin.id),
        }))
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0))
}

export function getUserListItemExtras(context = {}) {
  return getEnabledPlugins()
    .flatMap((plugin) => {
      const pluginContext = buildPluginExtensionContext(plugin, context)
      return (plugin.userListItemExtras || [])
        .filter((extra) => extra.component)
        .filter((extra) => canAccess(extra.meta || {}, context.auth))
        .filter((extra) => {
          if (typeof extra.when !== 'function') return true
          try {
            return extra.when(pluginContext) !== false
          } catch (error) {
            console.error(`[plugins] Failed to evaluate user list item extra for ${plugin.id}`, error)
            return false
          }
        })
        .map((extra) => ({
          ...extra,
          id: extra.id || `${plugin.id}:user-list-item-extra`,
          pluginId: plugin.id,
          pluginName: plugin.name,
          config: getPluginConfig(plugin.id),
        }))
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0))
}

export function getAdminListFields(context = {}) {
  const target = context.target || ''
  return getEnabledPlugins()
    .flatMap((plugin) => {
      const pluginContext = buildPluginExtensionContext(plugin, context)
      return (plugin.adminListFields || [])
        .filter((field) => !target || field.target === target)
        .filter((field) => field.component)
        .filter((field) => canAccess(field.meta || {}, context.auth))
        .filter((field) => {
          if (typeof field.when !== 'function') return true
          try {
            return field.when(pluginContext) !== false
          } catch (error) {
            console.error(`[plugins] Failed to evaluate admin list field for ${plugin.id}`, error)
            return false
          }
        })
        .map((field) => ({
          ...field,
          id: field.id || `${plugin.id}:${field.title || 'admin-list-field'}`,
          pluginId: plugin.id,
          pluginName: plugin.name,
          config: getPluginConfig(plugin.id),
        }))
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0))
}

export function getSubmissionReviewSidebarPanels(context = {}) {
  return getEnabledPlugins()
    .flatMap((plugin) => {
      const pluginContext = buildPluginExtensionContext(plugin, context)
      return (plugin.submissionReviewSidebarPanels || [])
        .filter((panel) => panel.component)
        .filter((panel) => canAccess(panel.meta || {}, context.auth))
        .filter((panel) => {
          if (typeof panel.when !== 'function') return true
          try {
            return panel.when(pluginContext) !== false
          } catch (error) {
            console.error(`[plugins] Failed to evaluate submission review sidebar panel for ${plugin.id}`, error)
            return false
          }
        })
        .map((panel) => ({
          ...panel,
          id: panel.id || `${plugin.id}:${panel.title || 'submission-review-panel'}`,
          pluginId: plugin.id,
          pluginName: plugin.name,
          config: getPluginConfig(plugin.id),
        }))
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0))
}

export function getAdminTableRowActions(context = {}) {
  const target = context.target || ''
  return getEnabledPlugins()
    .flatMap((plugin) => {
      const pluginContext = buildPluginExtensionContext(plugin, context)
      return (plugin.adminTableRowActions || [])
        .filter((action) => !target || action.target === target)
        .filter((action) => canAccess(action.meta || {}, context.auth))
        .filter((action) => {
          if (typeof action.when !== 'function') return true
          try {
            return action.when(pluginContext) !== false
          } catch (error) {
            console.error(`[plugins] Failed to evaluate admin row action for ${plugin.id}`, error)
            return false
          }
        })
        .map((action) => ({
          ...action,
          id: action.id || `${plugin.id}:${action.label || 'admin-row-action'}`,
          pluginId: plugin.id,
          pluginName: plugin.name,
          config: getPluginConfig(plugin.id),
        }))
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0))
}

export function getAdminQuickActions(context = {}) {
  const target = context.target || ''
  return getEnabledPlugins()
    .flatMap((plugin) => {
      const pluginContext = buildPluginExtensionContext(plugin, context)
      return (plugin.adminQuickActions || [])
        .filter((action) => !target || action.target === target)
        .filter((action) => canAccess(action.meta || {}, context.auth))
        .filter((action) => {
          if (typeof action.when !== 'function') return true
          try {
            return action.when(pluginContext) !== false
          } catch (error) {
            console.error(`[plugins] Failed to evaluate admin quick action for ${plugin.id}`, error)
            return false
          }
        })
        .map((action) => ({
          ...action,
          id: action.id || `${plugin.id}:${action.label || 'admin-quick-action'}`,
          pluginId: plugin.id,
          pluginName: plugin.name,
          config: getPluginConfig(plugin.id),
          badge: typeof action.badge === 'function' ? action.badge(pluginContext) : action.badge,
        }))
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0))
}

export function getReviewBulkActions(context = {}) {
  const target = context.target || ''
  return getEnabledPlugins()
    .flatMap((plugin) => {
      const pluginContext = buildPluginExtensionContext(plugin, context)
      return (plugin.reviewBulkActions || [])
        .filter((action) => !target || action.target === target)
        .filter((action) => canAccess(action.meta || {}, context.auth))
        .filter((action) => {
          if (typeof action.when !== 'function') return true
          try {
            return action.when(pluginContext) !== false
          } catch (error) {
            console.error(`[plugins] Failed to evaluate review bulk action for ${plugin.id}`, error)
            return false
          }
        })
        .map((action) => ({
          ...action,
          id: action.id || `${plugin.id}:${action.label || 'review-bulk-action'}`,
          pluginId: plugin.id,
          pluginName: plugin.name,
          config: getPluginConfig(plugin.id),
        }))
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0))
}

export function getImageDetailActions(context = {}) {
  return getEnabledPlugins()
    .flatMap((plugin) => {
      const pluginContext = buildPluginExtensionContext(plugin, context)
      return (plugin.imageDetailActions || [])
        .filter((action) => canAccess(action.meta || {}, context.auth))
        .filter((action) => {
          if (typeof action.when !== 'function') return true
          try {
            return action.when(pluginContext) !== false
          } catch (error) {
            console.error(`[plugins] Failed to evaluate image detail action for ${plugin.id}`, error)
            return false
          }
        })
        .map((action) => ({
          ...action,
          id: action.id || `${plugin.id}:${action.label}`,
          pluginId: plugin.id,
          pluginName: plugin.name,
        }))
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0))
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

    runtimeState.loading = true

    try {
      const [rows, configRows] = await Promise.all([
        fetchRemotePluginRows(),
        fetchRemotePluginConfigRows(),
      ])
      const remoteSettings = mergeRemoteSettings(rows, configRows)
      setRuntimeSettings(remoteSettings, {
        source: 'supabase',
        remoteCount: rows.length,
      })
    } catch (error) {
      runtimeState.error = error?.message || '插件配置读取失败，已回退到本地配置。'
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
  await reconcilePluginLifecycle()
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
    throw new Error('Supabase 未配置，当前只能使用本地插件配置。')
  }
  await reconcilePluginLifecycle()
  const supabase = requireSupabase()
  const pluginPayload = buildPluginSyncPayload()
  const configPayload = buildPluginConfigSyncPayload()

  await upsertPluginRows(pluginPayload, 'id')

  if (configPayload.length) {
    const { error: configError } = await supabase.from('plugin_settings').upsert(configPayload, { onConflict: 'plugin_id,key' })
    if (configError) throw configError
  }

  runtimeState.lastSyncedAt = new Date().toISOString()
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
  const plugin = getPluginById(pluginId)
  if (!plugin) throw new Error(`未找到插件：${pluginId}`)

  const current = runtimeState.settingsById[pluginId] || getManifestDefaults()[pluginId]
  const targetRouter = options.router || runtimeContext?.router
  const shouldEnable = options.enable ?? (current.enabled ?? plugin.enabled !== false)

  patchPluginSettings(pluginId, {
    installed: true,
    registrationStatus: 'installed',
    installSource: current.installSource || getPluginCatalogEntry(plugin.id)?.source || 'builtin',
    registeredAt: current.registeredAt || new Date().toISOString(),
    uninstalledAt: null,
    enabled: shouldEnable,
  })

  await runLifecycleHook(plugin, 'install', { previousVersion: current.installedVersion || null })
  if (shouldEnable) {
    await runLifecycleHook(plugin, 'enable')
    await ensurePluginSetup(plugin)
  }

  if (targetRouter) syncPluginRoutes(targetRouter)
  if (options.persistRemote !== false && supabaseEnabled) {
    await persistPluginRegistryRow(pluginId)
    runtimeState.source = 'supabase'
    runtimeState.lastSyncedAt = new Date().toISOString()
  }

  return runtimeState.settingsById[pluginId]
}

export async function uninstallPlugin(pluginId, options = {}) {
  const plugin = getPluginById(pluginId)
  if (!plugin) throw new Error(`未找到插件：${pluginId}`)
  if (!isPluginInstalled(pluginId)) return runtimeState.settingsById[pluginId] || null

  const current = runtimeState.settingsById[pluginId] || getManifestDefaults()[pluginId]
  const targetRouter = options.router || runtimeContext?.router

  if (current.enabled) {
    await runLifecycleHook(plugin, 'disable')
  }
  await runLifecycleHook(plugin, 'uninstall')

  patchPluginSettings(pluginId, {
    installed: false,
    enabled: false,
    registrationStatus: 'uninstalled',
    installSource: current.installSource || getPluginCatalogEntry(plugin.id)?.source || 'builtin',
    registeredAt: current.registeredAt || null,
    uninstalledAt: new Date().toISOString(),
    config: options.clearConfig ? buildDefaultPluginConfig(plugin) : current.config,
  })

  initializedPluginIds.delete(pluginId)

  if (targetRouter) syncPluginRoutes(targetRouter)
  if (options.persistRemote !== false && supabaseEnabled) {
    await persistPluginRegistryRow(pluginId)
    if (options.clearConfig) {
      await savePluginConfig(pluginId, buildDefaultPluginConfig(plugin), { persistRemote: true })
    }
    runtimeState.source = 'supabase'
    runtimeState.lastSyncedAt = new Date().toISOString()
  }

  return runtimeState.settingsById[pluginId]
}

export async function reinstallPlugin(pluginId, options = {}) {
  const plugin = getPluginById(pluginId)
  if (!plugin) {
    throw new Error(`未找到插件：${pluginId}`)
  }
  if (!isPluginInstalled(pluginId)) {
    throw new Error('插件尚未安装，无法切换启停状态。')
  }

  const currentSettings = runtimeState.settingsById[pluginId] || getManifestDefaults()[pluginId]
  const targetRouter = options.router || runtimeContext?.router

  await runLifecycleHook(plugin, 'install', {
    previousVersion: currentSettings.installedVersion || null,
    reinstall: true,
  })

  if (currentSettings.enabled) {
    await runLifecycleHook(plugin, 'enable', {
      reinstall: true,
      previousVersion: currentSettings.installedVersion || null,
    })
    await ensurePluginSetup(plugin)
  }

  if (targetRouter) {
    syncPluginRoutes(targetRouter)
  }

  if (options.persistRemote !== false && supabaseEnabled) {
    await persistPluginRegistryRow(pluginId)
    runtimeState.source = 'supabase'
    runtimeState.lastSyncedAt = new Date().toISOString()
  }

  return runtimeState.settingsById[pluginId]
}

export async function setPluginEnabled(pluginId, enabled, options = {}) {
  const plugin = getPluginById(pluginId)
  if (!plugin) {
    throw new Error(`未找到插件：${pluginId}`)
  }

  const currentSettings = runtimeState.settingsById[pluginId] || getManifestDefaults()[pluginId]
  const previousSettings = runtimeState.settingsById
  const previousEnabled = Boolean(currentSettings.enabled)

  patchPluginSettings(pluginId, {
    enabled,
    config: normalizePluginConfig(pluginId, currentSettings.config),
  })

  const targetRouter = options.router || runtimeContext?.router
  if (enabled && !previousEnabled) {
    await runLifecycleHook(plugin, 'enable')
  }
  if (!enabled && previousEnabled) {
    await runLifecycleHook(plugin, 'disable')
    initializedPluginIds.delete(pluginId)
  }

  if (targetRouter) {
    syncPluginRoutes(targetRouter)
  }

  if (enabled) {
    await ensurePluginSetup(plugin)
  }

  if (options.persistRemote === false || !supabaseEnabled) {
    return runtimeState.settingsById[pluginId]
  }

  try {
    await persistPluginRegistryRow(pluginId)
    runtimeState.source = 'supabase'
    runtimeState.lastSyncedAt = new Date().toISOString()
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
    throw new Error(`未找到插件：${pluginId}`)
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

  setRuntimeSettings(nextSettings, {
    source: runtimeState.source,
    remoteCount: runtimeState.remoteCount,
  })

  if (options.persistRemote === false || !supabaseEnabled) {
    return runtimeState.settingsById[pluginId]
  }

  try {
    const supabase = requireSupabase()
    const { error } = await supabase.from('plugin_settings').upsert([
      {
        plugin_id: plugin.id,
        key: PLUGIN_CONFIG_KEY,
        value_json: normalizedConfig,
        updated_at: new Date().toISOString(),
      },
    ], { onConflict: 'plugin_id,key' })

    if (error) throw error

    runtimeState.source = 'supabase'
    runtimeState.lastSyncedAt = new Date().toISOString()
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
  await reconcilePluginLifecycle()
  if (runtimeContext.router) {
    syncPluginRoutes(runtimeContext.router)
  }

  for (const plugin of getEnabledPlugins()) {
    await ensurePluginSetup(plugin)
  }
}
