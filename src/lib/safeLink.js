export function normalizeSafeLink(link) {
  if (!link) return ''
  if (link.startsWith('/')) return link
  try {
    const url = new URL(link)
    if (['http:', 'https:'].includes(url.protocol)) {
      return url.toString()
    }
  } catch {
    return ''
  }
  return ''
}

export function isExternalLink(link) {
  return /^https?:\/\//i.test(link || '')
}
