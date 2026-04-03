<template>
  <section class="auth-page page">
    <mdui-card class="section-card">
      <div class="section-card__header">
        <div>
          <div class="eyebrow">身份验证</div>
          <h1>{{ statusTitle }}</h1>
          <p>{{ statusDescription }}</p>
        </div>
      </div>

      <div v-if="processing" class="auth-info-banner">
        <span class="auth-banner-icon">⏳</span>
        <span>正在处理验证链接，请稍候…</span>
      </div>

      <div v-else-if="errorMsg" class="auth-error-banner">
        <span class="auth-banner-icon">⚠</span>
        <span>{{ errorMsg }}</span>
      </div>

      <div v-else class="auth-success-banner">
        <span class="auth-banner-icon">✓</span>
        <span>{{ successMsg }}</span>
      </div>

      <div class="action-row" style="margin-top: 18px">
        <mdui-button variant="filled" :disabled="processing" @click="goNext">
          {{ nextButtonText }}
        </mdui-button>
        <mdui-button variant="text" :disabled="processing" @click="router.replace('/login')">返回登录</mdui-button>
      </div>
    </mdui-card>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { requireSupabase } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/errors'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const processing = ref(true)
const errorMsg = ref('')
const successMsg = ref('验证成功。')
const nextPath = ref('/login')
const nextButtonText = ref('继续')

function readParam(value) {
  if (!value) return ''
  return Array.isArray(value) ? (value[0] || '') : String(value)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractHashParams() {
  if (typeof window === 'undefined') return { params: new URLSearchParams(), raw: '' }
  
  let hash = window.location.hash || ''
  if (hash.startsWith('#')) hash = hash.slice(1)
  
  if (!hash) return { params: new URLSearchParams(), raw: '' }
  
  const params = new URLSearchParams()
  
  if (hash.includes('?') || hash.includes('&')) {
    const searchStr = hash.includes('?') ? hash.split('?')[1] : hash
    const pairs = searchStr.split('&')
    for (const pair of pairs) {
      const [key, ...valueParts] = pair.split('=')
      if (key && valueParts.length > 0) {
        params.set(key, decodeURIComponent(valueParts.join('=')))
      }
    }
  } else {
    try {
      const urlParams = new URLSearchParams(hash)
      urlParams.forEach((value, key) => params.set(key, value))
    } catch {
      // 如果解析失败，尝试手动分割
    }
  }
  
  return { params, raw: hash }
}

function parseFlowType(rawType) {
  if (!rawType) return 'general'
  
  const str = String(rawType).toLowerCase().trim()
  
  if (str === 'recovery' || str === 'signup' || str === 'email' || str === 'invite' || str === 'magiclink') {
    return str
  }
  
  if (str.includes('recovery')) return 'recovery'
  if (str.includes('signup')) return 'signup'
  if (str.includes('email')) return 'email'
  if (str.includes('invite')) return 'invite'
  
  if (str.includes('reset') || str.includes('password')) return 'recovery'
  
  return 'general'
}

const flowType = computed(() => {
  const queryType = readParam(route.query.type)
  const queryFlow = readParam(route.query.flow)
  const { params: hashParams } = extractHashParams()
  const hashType = readParam(hashParams.get('type'))
  const hashFlow = readParam(hashParams.get('flow'))
  
  const rawType = queryType || queryFlow || hashType || hashFlow
  
  console.log('[AuthCallback] Raw type values:', {
    queryType,
    queryFlow,
    hashType,
    hashFlow,
    rawType,
  })
  
  return parseFlowType(rawType)
})

const statusTitle = computed(() => (flowType.value === 'recovery' ? '正在恢复账号' : '正在验证邮箱'))
const statusDescription = computed(() =>
  flowType.value === 'recovery'
    ? '验证成功后会自动进入密码重设页面。'
    : '验证成功后会返回登录页。',
)

function resolveNextPath() {
  const next = readParam(route.query.next)
  if (next && next !== '/' && !next.includes('undefined')) return next
  return flowType.value === 'recovery' ? '/reset-password' : '/login'
}

function clearUrlNoise() {
  if (typeof window === 'undefined') return
  try {
    const target = resolveNextPath()
    window.history.replaceState({}, document.title || '', target)
  } catch {
    // 忽略 URL 清理失败
  }
}

function extractTokenHash() {
  const fromQuery = readParam(route.query.token_hash) || readParam(route.query.tokenHash)
  if (fromQuery) return fromQuery
  
  const { params: hashParams } = extractHashParams()
  const fromHash = readParam(hashParams.get('token_hash')) || readParam(hashParams.get('tokenHash'))
  if (fromHash) return fromHash
  
  const rawType = readParam(route.query.type) || ''
  if (rawType.includes('token_hash=')) {
    const match = rawType.match(/token_hash=([a-f0-9]+)/i)
    if (match) return match[1]
  }
  
  const fullPath = window.location.href || ''
  const urlMatch = fullPath.match(/token_hash=([a-f0-9]{10,})/i)
  if (urlMatch) return urlMatch[1]
  
  return null
}

async function attemptSetSessionFromHash(supabase, retryCount = 0) {
  const { params: hashParams } = extractHashParams()
  const accessToken = hashParams.get('access_token')
  const refreshToken = hashParams.get('refresh_token')

  if (!accessToken || !refreshToken) return false

  for (let i = 0; i <= retryCount; i++) {
    try {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      if (error) {
        console.warn('[AuthCallback] setSession attempt', i + 1, 'failed:', error.message)
        if (i < retryCount) await sleep(300 * (i + 1))
        continue
      }
      
      await sleep(200)
      return true
    } catch (err) {
      console.warn('[AuthCallback] setSession attempt', i + 1, 'error:', err)
      if (i < retryCount) await sleep(300 * (i + 1))
    }
  }
  return false
}

async function attemptExchangeCode(supabase, retryCount = 0) {
  const code = readParam(route.query.code)
  if (!code) return false

  for (let i = 0; i <= retryCount; i++) {
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        console.warn('[AuthCallback] exchangeCode attempt', i + 1, 'failed:', error.message)
        if (i < retryCount) await sleep(300 * (i + 1))
        continue
      }
      await sleep(200)
      return true
    } catch (err) {
      console.warn('[AuthCallback] exchangeCode attempt', i + 1, 'error:', err)
      if (i < retryCount) await sleep(300 * (i + 1))
    }
  }
  return false
}

async function attemptVerifyOtp(supabase, retryCount = 0) {
  const tokenHash = extractTokenHash()
  
  console.log('[AuthCallback] Extracted token_hash:', tokenHash)
  console.log('[AuthCallback] Using flowType for OTP:', flowType.value)
  
  if (!tokenHash) {
    console.warn('[AuthCallback] No token_hash found anywhere')
    return false
  }

  const otpTypes = ['recovery', 'signup', 'email', 'invite', 'magiclink']
  
  for (const otpType of otpTypes) {
    for (let i = 0; i <= retryCount; i++) {
      try {
        console.log(`[AuthCallback] verifyOtp attempt ${i + 1} with type: ${otpType}`)
        
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType,
        })
        
        if (error) {
          console.warn(`[AuthCallback] verifyOtp (${otpType}) attempt`, i + 1, 'failed:', error.message, error.status)
          if (i < retryCount) await sleep(300 * (i + 1))
          continue
        }
        
        console.log(`[AuthCallback] verifyOtp (${otpType}) succeeded on attempt`, i + 1)
        await sleep(200)
        return true
      } catch (err) {
        console.warn(`[AuthCallback] verifyOtp (${otpType}) attempt`, i + 1, 'error:', err)
        if (i < retryCount) await sleep(300 * (i + 1))
      }
    }
  }
  
  return false
}

async function checkSessionWithRetry(supabase, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) return session
      
      console.warn('[AuthCallback] getSession attempt', i + 1, ': no session')
      if (i < maxRetries - 1) await sleep(400 * (i + 1))
    } catch (err) {
      console.warn('[AuthCallback] getSession attempt', i + 1, 'error:', err)
      if (i < maxRetries - 1) await sleep(400 * (i + 1))
    }
  }
  return null
}

async function processAuthCallback() {
  processing.value = true
  errorMsg.value = ''
  successMsg.value = ''

  const supabase = requireSupabase()
  nextPath.value = resolveNextPath()
  nextButtonText.value = nextPath.value === '/reset-password' ? '前往重设密码' : '前往登录'

  try {
    const errorCode = readParam(route.query.error_code)
    const errorDescription = readParam(route.query.error_description)
    
    const { params: hashParams } = extractHashParams()
    const hashErrorCode = readParam(hashParams.get('error_code'))
    const hashErrorDesc = readParam(hashParams.get('error_description'))

    const finalErrorCode = errorCode || hashErrorCode
    const finalErrorDesc = errorDescription || hashErrorDesc

    if (finalErrorCode) {
      throw new Error(decodeURIComponent(finalErrorDesc || '验证链接无效或已过期，请重新操作。'))
    }

    console.log('[AuthCallback] Starting process, flowType:', flowType.value)
    console.log('[AuthCallback] Hash params:', Object.fromEntries(extractHashParams().params.entries()))
    console.log('[AuthCallback] Query params:', { ...route.query })
    console.log('[AuthCallback] Full URL:', window.location.href)
    console.log('[AuthCallback] Full hash:', window.location.hash)

    let handled = false

    handled = (await attemptSetSessionFromHash(supabase, 2)) || handled
    console.log('[AuthCallback] After setSession:', { handled })

    if (!handled) {
      handled = (await attemptExchangeCode(supabase, 2)) || handled
      console.log('[AuthCallback] After exchangeCode:', { handled })
    }

    if (!handled) {
      handled = (await attemptVerifyOtp(supabase, 1)) || handled
      console.log('[AuthCallback] After verifyOtp:', { handled })
    }

    const session = await checkSessionWithRetry(supabase, 4)
    console.log('[AuthCallback] Final session check:', !!session)

    if (!session && !handled) {
      throw new Error('验证链接无效或已过期，请重新操作。')
    }

    if (flowType.value === 'recovery') {
      auth.passwordRecoveryError = false
      auth.setPasswordRecoveryMode(true)
      successMsg.value = '验证成功，正在进入密码重设页面。'
    } else {
      auth.passwordRecoveryError = false
      auth.setPasswordRecoveryMode(false)
      successMsg.value = '邮箱验证成功，请继续登录。'
    }

    clearUrlNoise()
    await goNext()
  } catch (error) {
    console.error('[AuthCallback] Error:', error)
    auth.passwordRecoveryError = flowType.value === 'recovery'
    auth.setPasswordRecoveryMode(false)
    errorMsg.value = getErrorMessage(error)
  } finally {
    processing.value = false
  }
}

async function goNext() {
  await router.replace(nextPath.value)
}

onMounted(async () => {
  console.log('[AuthCallback] Mounted, waiting for auth init...')
  console.log('[AuthCallback] Current URL:', window.location.href)
  console.log('[AuthCallback] Route query:', JSON.stringify(route.query))
  console.log('[AuthCallback] Route hash:', window.location.hash)
  
  await sleep(100)
  
  if (!auth.initialized) {
    console.log('[AuthCallback] Auth not initialized, waiting...')
    await auth.init()
    await sleep(200)
  }
  
  console.log('[AuthCallback] Auth initialized, starting callback process')
  
  processAuthCallback().catch((error) => {
    console.error('[AuthCallback] Unhandled error:', error)
    processing.value = false
    errorMsg.value = getErrorMessage(error)
  })
})
</script>
