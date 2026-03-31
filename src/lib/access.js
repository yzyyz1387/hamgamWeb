const DEFAULT_ROLE_CAPABILITIES = {
  USER: [
    'profile.view',
    'submission.create',
    'notification.read',
  ],
  REVIEWER: [
    'profile.view',
    'submission.create',
    'notification.read',
    'admin.dashboard.view',
    'submission.review',
  ],
  SUPER_ADMIN: [
    'profile.view',
    'submission.create',
    'notification.read',
    'admin.dashboard.view',
    'submission.review',
    'user.manage',
    'image.manage',
    'announcement.manage',
    'notification.manage',
    'friend-links.manage',
    'callsign.review',
    'plugin.manage',
    'tools.hash-processor',
  ],
}

export function getRoleCapabilities(role = 'USER') {
  return DEFAULT_ROLE_CAPABILITIES[role] || DEFAULT_ROLE_CAPABILITIES.USER
}

export function getUserCapabilities(profile = {}) {
  const declaredCapabilities = Array.isArray(profile?.capabilities) ? profile.capabilities : []
  return [...new Set([...getRoleCapabilities(profile?.role), ...declaredCapabilities])]
}

export function hasCapabilities(requiredCapabilities = [], profile = {}) {
  if (!requiredCapabilities?.length) return true
  const grantedCapabilities = new Set(getUserCapabilities(profile))
  return requiredCapabilities.every((capability) => grantedCapabilities.has(capability))
}

export function canAccess(meta = {}, auth = {}) {
  const role = auth?.role || auth?.profile?.role || 'USER'
  const profile = auth?.profile || auth || {}

  if (meta.requiresAuth && !auth?.isLoggedIn) {
    return false
  }
  if (meta.roles?.length && !meta.roles.includes(role)) {
    return false
  }
  if (meta.capabilities?.length && !hasCapabilities(meta.capabilities, profile)) {
    return false
  }
  return true
}
