const DEFAULT_TEMPLATE = {
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
}

function interpolateString(input, variables = {}) {
  return String(input ?? '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key) => {
    const value = key.split('.').reduce((current, segment) => current?.[segment], variables)
    return value == null ? '' : String(value)
  })
}

function interpolateValue(value, variables = {}) {
  if (typeof value === 'string') return interpolateString(value, variables)
  if (Array.isArray(value)) return value.map((item) => interpolateValue(item, variables))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, next]) => [key, interpolateValue(next, variables)]))
  }
  return value
}

export function defineNotificationTemplate(template = {}) {
  return {
    ...DEFAULT_TEMPLATE,
    ...template,
    tags: Array.isArray(template.tags) ? template.tags.filter(Boolean) : [],
    values: { ...(template.values || {}) },
    variables: { ...(template.variables || {}) },
    meta: { ...(template.meta || {}) },
  }
}

export function createBroadcastNotificationTemplate(options = {}) {
  const target = options.target || 'all'
  return defineNotificationTemplate({
    category: 'broadcast',
    icon: options.icon || 'campaign--rounded',
    tone: options.tone || 'primary',
    target,
    values: {
      target,
      ...(options.values || {}),
    },
    ...options,
  })
}

export function createRoleNotificationTemplate(options = {}) {
  const target = options.target || options.role || 'USER'
  return defineNotificationTemplate({
    category: 'role',
    icon: options.icon || 'group--rounded',
    tone: options.tone || 'secondary',
    target,
    values: {
      target,
      ...(options.values || {}),
    },
    ...options,
  })
}

export function createDirectNotificationTemplate(options = {}) {
  return defineNotificationTemplate({
    category: 'direct',
    icon: options.icon || 'mark_email_read--rounded',
    tone: options.tone || 'neutral',
    target: 'user',
    values: {
      target: 'user',
      ...(options.values || {}),
    },
    ...options,
  })
}

export function applyNotificationTemplateValues(template, variables = {}) {
  const normalized = defineNotificationTemplate(template)
  const resolvedVariables = {
    ...(normalized.variables || {}),
    ...variables,
  }
  return {
    ...normalized,
    resolvedValues: interpolateValue(normalized.values || {}, resolvedVariables),
  }
}
