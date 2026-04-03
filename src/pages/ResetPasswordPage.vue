<template>
  <section class="auth-page page">
    <mdui-card class="section-card">
      <div class="section-card__header">
        <div>
          <div class="eyebrow">密码重设</div>
          <h1>设置新密码</h1>
          <p>请设置并确认你的新密码。修改成功后，系统会自动退出当前恢复会话并返回登录页。</p>
        </div>
      </div>

      <div v-if="verifying" class="auth-info-banner">
        <span class="auth-banner-icon">⏳</span>
        <span>正在验证重置链接，请稍候…</span>
      </div>

      <div v-else-if="errorMsg" class="auth-error-banner">
        <span class="auth-banner-icon">⚠</span>
        <span>{{ errorMsg }}</span>
      </div>

      <div v-else-if="verified" class="auth-success-banner">
        <span class="auth-banner-icon">✓</span>
        <span>重置链接验证成功，请输入新密码。</span>
      </div>

      <div class="form-grid">
        <div class="form-control" style="grid-column: 1 / -1">
          <AppTextField
            id="reset-password"
            v-model="form.password"
            type="password"
            toggle-password
            label="新密码"
            autocomplete="new-password"
            :disabled="!verified || verifying"
            @enter="submit"
          ></AppTextField>
        </div>
        <div class="form-control" style="grid-column: 1 / -1">
          <AppTextField
            id="reset-password-confirm"
            v-model="form.confirm"
            type="password"
            toggle-password
            label="确认新密码"
            autocomplete="new-password"
            :disabled="!verified || verifying"
            @enter="submit"
          ></AppTextField>
        </div>
      </div>

      <div class="action-row" style="margin-top: 18px">
        <mdui-button variant="filled" :loading="submitting" :disabled="!verified || verifying" @click="submit">
          {{ submitting ? '更新中…' : '确认重设密码' }}
        </mdui-button>
        <mdui-button variant="text" @click="backToLogin">返回登录</mdui-button>
      </div>
    </mdui-card>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppTextField from '@/components/form/AppTextField.vue'
import { getErrorMessage } from '@/lib/errors'
import { requireSupabase } from '@/lib/supabase'
import { showToast } from '@/lib/toast'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const form = reactive({
  password: '',
  confirm: '',
})
const errorMsg = ref('')
const verifying = ref(true)
const verified = ref(false)
const submitting = ref(false)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readQueryValue(value) {
  if (!value) return ''
  return Array.isArray(value) ? (value[0] || '') : String(value)
}

function clearVerificationParams() {
  if (typeof window !== 'undefined') {
    try {
      window.history.replaceState({}, document.title || '', '/reset-password')
    } catch {
      // 忽略
    }
  }
  router.replace({ name: 'reset-password' }).catch(() => {})
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
      // 解析失败时忽略
    }
  }
  
  return { params, raw: hash }
}

function extractTokenHash() {
  const fromQuery = readQueryValue(route.query.token_hash) || readQueryValue(route.query.tokenHash)
  if (fromQuery) return fromQuery
  
  const { params: hashParams } = extractHashParams()
  const fromHash = readQueryValue(hashParams.get('token_hash')) || readQueryValue(hashParams.get('tokenHash'))
  if (fromHash) return fromHash
  
  const rawType = readQueryValue(route.query.type) || ''
  if (rawType.includes('token_hash=')) {
    const match = rawType.match(/token_hash=([a-f0-9]+)/i)
    if (match) return match[1]
  }
  
  const fullPath = window.location.href || ''
  const urlMatch = fullPath.match(/token_hash=([a-f0-9]{10,})/i)
  if (urlMatch) return urlMatch[1]
  
  return null
}

async function verifyRecoveryAccess() {
  verifying.value = true
  verified.value = false
  errorMsg.value = ''

  console.log('[ResetPassword] Starting verification...')
  console.log('[ResetPassword] Full URL:', window.location.href)

  const supabase = requireSupabase()

  try {
    const errorCode = readQueryValue(route.query.error_code)
    const errorDescription = readQueryValue(route.query.error_description)
    
    const { params: hashParams } = extractHashParams()
    const hashErrorCode = readQueryValue(hashParams.get('error_code'))
    const hashErrorDesc = readQueryValue(hashParams.get('error_description'))

    if (errorCode || hashErrorCode) {
      throw new Error(decodeURIComponent(errorDescription || hashErrorDesc || '重置链接无效或已过期，请重新申请一次密码重置。'))
    }

    console.log('[ResetPassword] Query params:', { ...route.query })
    console.log('[ResetPassword] Hash params:', Object.fromEntries(hashParams.entries()))

    let handled = false

    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')

    if (accessToken && refreshToken) {
      for (let i = 0; i < 3; i++) {
        try {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) {
            console.warn('[ResetPassword] setSession attempt', i + 1, 'failed:', error.message)
            if (i < 2) await sleep(300 * (i + 1))
            continue
          }
          await sleep(200)
          handled = true
          break
        } catch (err) {
          console.warn('[ResetPassword] setSession attempt', i + 1, 'error:', err)
          if (i < 2) await sleep(300 * (i + 1))
        }
      }
    }

    if (!handled) {
      const code = readQueryValue(route.query.code)
      if (code) {
        for (let i = 0; i < 3; i++) {
          try {
            const { error } = await supabase.auth.exchangeCodeForSession(code)
            if (error) {
              console.warn('[ResetPassword] exchangeCode attempt', i + 1, 'failed:', error.message)
              if (i < 2) await sleep(300 * (i + 1))
              continue
            }
            await sleep(200)
            handled = true
            break
          } catch (err) {
            console.warn('[ResetPassword] exchangeCode attempt', i + 1, 'error:', err)
            if (i < 2) await sleep(300 * (i + 1))
          }
        }
      }
    }

    if (!handled) {
      const tokenHash = extractTokenHash()
      
      console.log('[ResetPassword] Extracted token_hash:', tokenHash)
      
      if (tokenHash) {
        const otpTypes = ['recovery', 'signup', 'email', 'invite', 'magiclink']
        
        for (const otpType of otpTypes) {
          for (let i = 0; i < 3; i++) {
            try {
              console.log(`[ResetPassword] verifyOtp attempt ${i + 1} with type: ${otpType}`)
              
              const { error } = await supabase.auth.verifyOtp({
                token_hash: tokenHash,
                type: otpType,
              })
              
              if (error) {
                console.warn(`[ResetPassword] verifyOtp (${otpType}) attempt`, i + 1, 'failed:', error.message, error.status)
                if (i < 2) await sleep(300 * (i + 1))
                continue
              }
              
              console.log(`[ResetPassword] verifyOtp (${otpType}) succeeded on attempt`, i + 1)
              await sleep(200)
              handled = true
              break
            } catch (err) {
              console.warn(`[ResetPassword] verifyOtp (${otpType}) attempt`, i + 1, 'error:', err)
              if (i < 2) await sleep(300 * (i + 1))
            }
          }
          
          if (handled) break
        }
      }
    }

    for (let i = 0; i < 4; i++) {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        
        if (session) {
          console.log('[ResetPassword] Session found on attempt', i + 1)
          auth.passwordRecoveryError = false
          auth.setPasswordRecoveryMode(true)
          verified.value = true
          clearVerificationParams()
          return
        }
        
        console.warn('[ResetPassword] getSession attempt', i + 1, ': no session')
        if (i < 3) await sleep(400 * (i + 1))
      } catch (err) {
        console.warn('[ResetPassword] getSession attempt', i + 1, 'error:', err)
        if (i < 3) await sleep(400 * (i + 1))
      }
    }

    if (!handled) {
      throw new Error('重置链接无效、已过期，或当前浏览器未完成恢复登录，请重新申请一次密码重置。')
    }

  } catch (error) {
    console.error('[ResetPassword] Verification failed:', error)
    verified.value = false
    auth.passwordRecoveryError = false
    auth.setPasswordRecoveryMode(false)
    errorMsg.value = getErrorMessage(error)
  } finally {
    verifying.value = false
  }
}

async function backToLogin() {
  try {
    const supabase = requireSupabase()
    await Promise.race([
      supabase.auth.signOut({ scope: 'local' }),
      sleep(2000),
    ]).catch(() => {})
    await auth.finishSignOut({ silent: true, localOnly: true })
  } finally {
    await router.replace('/login')
  }
}

async function submit() {
  if (submitting.value || verifying.value || !verified.value) return

  errorMsg.value = ''
  if (!form.password || form.password.length < 8) {
    errorMsg.value = '新密码至少需要 8 位'
    return
  }
  if (form.password !== form.confirm) {
    errorMsg.value = '两次输入的密码不一致'
    return
  }

  submitting.value = true
  try {
    await auth.changePassword(form.password, { updatedVia: 'password_recovery' })
    form.password = ''
    form.confirm = ''
    showToast('密码已更新，请使用新密码重新登录')

    const supabase = requireSupabase()
    await Promise.race([
      supabase.auth.signOut({ scope: 'local' }),
      sleep(2000),
    ]).catch(() => {})

    await auth.finishSignOut({ silent: true, localOnly: true })
    await router.replace({ path: '/login', query: { passwordUpdated: '1' } })
  } catch (error) {
    errorMsg.value = getErrorMessage(error)
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  console.log('[ResetPassword] Mounted, waiting for auth init...')
  console.log('[ResetPassword] Current URL:', window.location.href)
  console.log('[ResetPassword] Route query:', JSON.stringify(route.query))
  
  await sleep(100)
  
  if (!auth.initialized) {
    console.log('[ResetPassword] Auth not initialized, waiting...')
    await auth.init()
    await sleep(200)
  }
  
  console.log('[ResetPassword] Auth initialized, starting verification')
  
  verifyRecoveryAccess().catch((error) => {
    console.error('[ResetPassword] Unhandled error:', error)
    verifying.value = false
    verified.value = false
    errorMsg.value = getErrorMessage(error)
  })
})
</script>
