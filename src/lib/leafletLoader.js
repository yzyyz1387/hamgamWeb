const LEAFLET_JS_URL = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js'
const LEAFLET_CSS_URL = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_SCRIPT_ID = 'hamgam-leaflet-script'
const LEAFLET_CSS_ID = 'hamgam-leaflet-css'

let leafletPromise = null

function ensureLeafletCss() {
  if (typeof document === 'undefined') return
  if (document.getElementById(LEAFLET_CSS_ID)) return
  const link = document.createElement('link')
  link.id = LEAFLET_CSS_ID
  link.rel = 'stylesheet'
  link.href = LEAFLET_CSS_URL
  document.head.appendChild(link)
}

export function loadLeaflet() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Leaflet 仅能在浏览器环境中加载。'))
  }
  if (window.L) return Promise.resolve(window.L)
  if (leafletPromise) return leafletPromise

  ensureLeafletCss()

  leafletPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(LEAFLET_SCRIPT_ID)
    if (existing) {
      existing.addEventListener('load', () => resolve(window.L), { once: true })
      existing.addEventListener('error', () => reject(new Error('地图脚本加载失败，请稍后重试。')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = LEAFLET_SCRIPT_ID
    script.src = LEAFLET_JS_URL
    script.async = true
    script.onload = () => {
      if (window.L) {
        resolve(window.L)
        return
      }
      reject(new Error('地图脚本已加载，但地图对象不可用。'))
    }
    script.onerror = () => reject(new Error('地图脚本加载失败，请检查网络连接。'))
    document.body.appendChild(script)
  })

  return leafletPromise
}
