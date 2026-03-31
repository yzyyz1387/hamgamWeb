import DOMPurify from 'dompurify'

export function formatDate(input, options = {}) {
  if (!input) return '未知时间'
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return '未知时间'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(options.withTime
      ? {
          hour: '2-digit',
          minute: '2-digit',
        }
      : {}),
  }).format(date)
}

export function timeAgo(input) {
  if (!input) return '刚刚'
  const date = new Date(input)
  const diff = Date.now() - date.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`
  return formatDate(input)
}

export function sanitizeHtml(content) {
  return DOMPurify.sanitize(content || '', {
    USE_PROFILES: { html: true },
  })
}

export function textToHtml(content) {
  return sanitizeHtml((content || '').replace(/\n/g, '<br/>'))
}

export function filenameExt(filename) {
  const match = (filename || '').match(/\.([a-zA-Z0-9]+)$/)
  return match ? match[1].toLowerCase() : ''
}

export function sanitizeFilename(filename) {
  return (filename || 'file')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

export function createSlug(input, fallback = '') {
  const normalized = (input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
  if (normalized) return normalized
  return `image-${simpleHash(input || fallback || String(Date.now()))}`
}

export function simpleHash(input) {
  let hash = 0
  const value = String(input || '')
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

export function stableShuffle(list, seed = 1) {
  return [...list].sort((a, b) => {
    const aWeight = simpleHash(`${seed}-${a.slug || a.id || JSON.stringify(a)}`)
    const bWeight = simpleHash(`${seed}-${b.slug || b.id || JSON.stringify(b)}`)
    return aWeight.localeCompare(bWeight)
  })
}

export async function copyText(text) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return true
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(textarea)
  return ok
}
