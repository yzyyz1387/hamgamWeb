import { ref, computed } from 'vue'
import { requireSupabase } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/errors'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY

const TURNSTILE_ERROR_MESSAGES = {
  'timeout-or-duplicate': '验证码已过期或重复使用，请重新验证',
  'missing-input-secret': '验证码服务配置错误，请联系管理员',
  'invalid-input-secret': '验证码服务配置错误，请联系管理员',
  'missing-input-response': '请完成验证码验证',
  'invalid-input-response': '验证码验证失败，请重新验证',
  'bad-request': '验证码请求格式错误，请重试',
  'invalid-already-used': '验证码已被使用，请重新验证',
  'invalid-expired': '验证码已过期，请重新验证'
}

function getTurnstileErrorMessage(errorCodes) {
  if (!errorCodes || errorCodes.length === 0) {
    return '验证码验证失败，请重试'
  }
  
  const messages = errorCodes.map(code => {
    return TURNSTILE_ERROR_MESSAGES[code] || `验证码验证失败: ${code}`
  })
  
  return messages.join('；')
}

export function useTurnstile() {
  const token = ref('')
  const loading = ref(false)
  const error = ref('')
  const widgetLoading = ref(true)
  const widgetError = ref('')
  const isVerifying = ref(false)

  const hasSiteKey = computed(() => !!SITE_KEY)
  const isWidgetLoaded = computed(() => !widgetLoading.value && !widgetError.value)

  function onExpire() {
    token.value = ''
    error.value = '验证码已过期，请重新验证'
  }

  function onError(errorCode) {
    widgetLoading.value = false
    
    if (errorCode === 'timeout-or-duplicate') {
      widgetError.value = '验证码加载超时，请刷新页面重试'
    } else {
      widgetError.value = '验证码加载失败，请检查网络、代理或浏览器插件后重试'
    }
    
    token.value = ''
  }

  function onWidgetLoaded() {
    widgetLoading.value = false
    widgetError.value = ''
  }

  function reset() {
    token.value = ''
    error.value = ''
    widgetError.value = ''
    widgetLoading.value = true
    isVerifying.value = false
  }

  function clearToken() {
    token.value = ''
  }

  async function verifyToken(tokenToVerify) {
    if (isVerifying.value) {
      return { ok: false, message: '验证码正在验证中，请稍候' }
    }

    const tokenStr = String(tokenToVerify || '').trim()
    
    
    if (!tokenStr) {
      error.value = '请完成验证码验证'
      return { ok: false, message: '请完成验证码验证' }
    }

    isVerifying.value = true
    loading.value = true
    error.value = ''
    
    try {
      const supabase = requireSupabase()
      const { data, error: rpcError } = await supabase.functions.invoke('verify-turnstile', {
        body: { token: tokenStr }
      })

      if (rpcError) {
        const errorMsg = getErrorMessage(rpcError, '验证码验证失败，请重试')
        error.value = errorMsg
        return { ok: false, message: errorMsg }
      }
      
      if (!data.success) {
        const errorMsg = getTurnstileErrorMessage(data['error-codes'])
        error.value = errorMsg
        return { ok: false, message: errorMsg }
      }
      
      return { ok: true, message: '验证码验证成功' }
    } catch (err) {
      const errorMsg = getErrorMessage(err, '验证码验证失败，请重试')
      error.value = errorMsg
      return { ok: false, message: errorMsg }
    } finally {
      loading.value = false
      isVerifying.value = false
    }
  }

  return {
    token,
    loading,
    error,
    widgetLoading,
    widgetError,
    hasSiteKey,
    isWidgetLoaded,
    isVerifying,
    SITE_KEY,
    onExpire,
    onError,
    onWidgetLoaded,
    reset,
    clearToken,
    verifyToken
  }
}
