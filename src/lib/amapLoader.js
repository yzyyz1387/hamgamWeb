const AMAP_SCRIPT_ID = 'hamgam-amap-script'
let amapPromise = null

function getAmapConfig() {
  const key = import.meta.env.VITE_AMAP_JS_KEY?.trim()
  const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE?.trim()
  return { key, securityJsCode }
}

export function loadAmap() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('高德地图仅能在浏览器环境中加载。'))
  }

  const { key, securityJsCode } = getAmapConfig()
  if (!key) {
    return Promise.reject(new Error('未配置高德地图 Key，请在环境变量中设置 VITE_AMAP_JS_KEY。'))
  }
  if (!securityJsCode) {
    return Promise.reject(new Error('未配置高德地图安全密钥，请在环境变量中设置 VITE_AMAP_SECURITY_JS_CODE。'))
  }

  if (window.AMap?.Map) return Promise.resolve(window.AMap)
  if (amapPromise) return amapPromise

  window._AMapSecurityConfig = {
    ...(window._AMapSecurityConfig || {}),
    securityJsCode,
  }

  amapPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(AMAP_SCRIPT_ID)
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.AMap?.Map) resolve(window.AMap)
        else reject(new Error('高德地图脚本已加载，但地图对象不可用。'))
      }, { once: true })
      existing.addEventListener('error', () => reject(new Error('高德地图脚本加载失败，请检查网络或 Key 配置。')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = AMAP_SCRIPT_ID
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}`
    script.async = true
    script.onload = () => {
      if (window.AMap?.Map) {
        resolve(window.AMap)
        return
      }
      reject(new Error('高德地图脚本已加载，但地图对象不可用。'))
    }
    script.onerror = () => reject(new Error('高德地图脚本加载失败，请检查网络或域名白名单。'))
    document.body.appendChild(script)
  })

  return amapPromise
}
