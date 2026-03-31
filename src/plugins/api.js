export const PLUGIN_API_VERSION = '1.1.0'
export const PLUGIN_HOST_VERSION = '1.1.0'

function noop() {}

function parseVersion(value) {
  const match = String(value || '0.0.0').trim().match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) return { major: 0, minor: 0, patch: 0 }
  return {
    major: Number(match[1] || 0),
    minor: Number(match[2] || 0),
    patch: Number(match[3] || 0),
  }
}

function compareVersions(left, right) {
  const a = parseVersion(left)
  const b = parseVersion(right)
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  return a.patch - b.patch
}

export function isCompatibleVersionRange(range, version = PLUGIN_HOST_VERSION) {
  const normalizedRange = String(range || '').trim()
  if (!normalizedRange || normalizedRange === '*' || normalizedRange === 'latest') return true

  if (normalizedRange.startsWith('^')) {
    const base = parseVersion(normalizedRange.slice(1))
    const target = parseVersion(version)
    return target.major === base.major && compareVersions(version, `${base.major}.${base.minor}.${base.patch}`) >= 0
  }

  if (normalizedRange.startsWith('~')) {
    const base = parseVersion(normalizedRange.slice(1))
    const target = parseVersion(version)
    return target.major === base.major && target.minor === base.minor && compareVersions(version, `${base.major}.${base.minor}.${base.patch}`) >= 0
  }

  return compareVersions(version, normalizedRange) === 0
}

function buildSelection(context = {}) {
  if (Array.isArray(context.selectedItems)) return context.selectedItems
  if (Array.isArray(context.rows)) return context.rows
  return []
}

function getValueByPath(source, path) {
  const normalized = String(path || '').trim()
  if (!normalized) return undefined
  return normalized.split('.').reduce((current, segment) => (current == null ? current : current[segment]), source)
}

function collectSelectionValues(selection = [], extractor, options = {}) {
  const values = selection
    .map((item, index) => {
      if (typeof extractor === 'function') return extractor(item, index)
      if (typeof extractor === 'string') return getValueByPath(item, extractor)
      return item
    })
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .map((value) => String(value))

  if (options.unique) {
    return Array.from(new Set(values))
  }

  return values
}

function sanitizeAuditEntry(plugin, entry = {}) {
  return {
    action: entry.action || 'plugin.activity',
    entityType: entry.entityType || 'plugin',
    entityId: entry.entityId ?? plugin.id ?? null,
    details: {
      plugin_id: plugin.id || '',
      plugin_name: plugin.name || '',
      ...(entry.details || {}),
    },
    level: entry.level || null,
  }
}

export function createPluginApi(plugin = {}, context = {}, handlers = {}) {
  const getRouter = () => context.router || handlers.router || null
  const getConfig = () => (typeof handlers.getConfig === 'function' ? handlers.getConfig(plugin.id) : context.config || {})
  const getServices = () => (typeof handlers.getServices === 'function' ? handlers.getServices() : {}) || {}
  const selection = buildSelection(context)
  const hostVersion = handlers.hostVersion || PLUGIN_HOST_VERSION

  const api = {
    version: PLUGIN_API_VERSION,
    hostVersion,
    pluginId: plugin.id || '',
    pluginName: plugin.name || '',
    pluginVersion: plugin.version || '0.0.0',
    auth: context.auth || null,
    route: context.route || null,
    image: context.image || null,
    row: context.row || null,
    profile: context.profile || null,
    submission: context.submission || null,
    application: context.application || null,
    response: context.response || null,
    selectedItems: selection,
    details: context.details || null,
    host: {
      version: hostVersion,
      apiVersion: PLUGIN_API_VERSION,
      supports(range) {
        return isCompatibleVersionRange(range, hostVersion)
      },
    },
    services: {
      get(name, fallback = null) {
        const services = getServices()
        return services?.[name] ?? fallback
      },
      has(name) {
        const services = getServices()
        return Object.prototype.hasOwnProperty.call(services || {}, name)
      },
      list() {
        return Object.keys(getServices())
      },
    },
    getConfig,
    getSetting(key, fallback = null) {
      const config = getConfig()
      return config?.[key] ?? fallback
    },
    getService(name, fallback = null) {
      const services = getServices()
      return services?.[name] ?? fallback
    },
    navigate(to, options = {}) {
      const router = getRouter()
      if (!router || !to) return Promise.resolve(false)
      if (options.replace) return router.replace(to)
      return router.push(to)
    },
    openExternal(url, target = '_blank') {
      if (typeof window === 'undefined' || !url) return
      window.open(url, target, 'noopener,noreferrer')
    },
    toast(message, type = 'info') {
      return (handlers.showToast || noop)(message, type)
    },
    notify(message, type = 'info') {
      return (handlers.showToast || noop)(message, type)
    },
    copy(text) {
      if (typeof handlers.copyText === 'function') return handlers.copyText(String(text ?? ''))
      return Promise.resolve(false)
    },
    emit(event, payload = {}) {
      if (typeof handlers.emit === 'function') return handlers.emit(event, payload)
      return Promise.resolve()
    },
    on(event, handler) {
      if (typeof handlers.on === 'function') return handlers.on(event, handler)
      return noop
    },
    off(event, handler) {
      if (typeof handlers.off === 'function') handlers.off(event, handler)
    },
    audit(entry = {}) {
      if (typeof handlers.audit !== 'function') return Promise.resolve(null)
      return handlers.audit(sanitizeAuditEntry(plugin, entry))
    },
  }

  api.logger = {
    info(message, details = null) {
      console.info(`[plugin:${plugin.id || 'unknown'}]`, message, details)
      return api.audit({
        action: 'plugin.logger.info',
        details: { message, ...(details || {}) },
        level: 'info',
      })
    },
    warn(message, details = null) {
      console.warn(`[plugin:${plugin.id || 'unknown'}]`, message, details)
      return api.audit({
        action: 'plugin.logger.warn',
        details: { message, ...(details || {}) },
        level: 'warn',
      })
    },
    error(message, details = null) {
      console.error(`[plugin:${plugin.id || 'unknown'}]`, message, details)
      return api.audit({
        action: 'plugin.logger.error',
        details: { message, ...(details || {}) },
        level: 'error',
      })
    },
  }

  api.review = {
    selection() {
      return selection.slice()
    },
    count() {
      return selection.length
    },
    values(extractor, options = {}) {
      return collectSelectionValues(selection, extractor, options)
    },
    ids(options = {}) {
      return collectSelectionValues(selection, 'id', options)
    },
    titles(options = {}) {
      return collectSelectionValues(selection, 'title', options)
    },
    async copyField(extractor, label = '内容', options = {}) {
      const values = collectSelectionValues(selection, extractor, options)
      if (!values.length) {
        if (options.toastEmpty !== false) api.toast(`没有可复制的${label}。`, 'warning')
        return []
      }
      await api.copy(values.join(options.separator || '\n'))
      if (options.toast !== false) api.toast(`已复制 ${values.length} 条${label}。`, 'success')
      return values
    },
  }

  return Object.freeze(api)
}
