export function parsePublicUid(value) {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim().toUpperCase()
  if (!normalized) return null
  const body = normalized.startsWith('H') ? normalized.slice(1) : normalized
  if (!/^\d+$/.test(body)) return null
  const parsed = Number(body)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

export function formatPublicUid(value) {
  const parsed = parsePublicUid(value)
  if (!parsed) return ''
  return `H${String(parsed).padStart(3, '0')}`
}

export function toUserProfilePath(value) {
  const formatted = formatPublicUid(value)
  return formatted ? `/user/${formatted}` : ''
}
