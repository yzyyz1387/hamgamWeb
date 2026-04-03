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
  return Array.isArray(value) ? value[0] || '' : value || ''
}

function readHashParams() {
  if (typeof window === 'undefined') return new URLSearchParams()
  const rawHash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
  if (!rawHash) return new URLSearchParams()
  if (rawHash.startsWith('/')) {
    const queryIndex = rawHash.indexOf('?')
    if (queryIndex === -1) return new URLSearchParams()
    return new URLSearchParams(rawHash.slice(queryIndex + 1))
  }
  return new URLSearchParams(rawHash)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const flowType = computed(() => {
  const queryType = readParam(route.query.type)
  const queryFlow = readParam(route.query.flow)
  const hashParams = readHashParams()
  const hashType = readParam(hashParams.get('type'))
  const hashFlow = readParam(hashParams.get('flow'))
  return queryType || queryFlow || hashType || hashFlow || 'general'
})

const statusTitle = computed(() => (flowType.value === 'recovery' ? '正在恢复账号' : '正在验证邮箱'))
const statusDescription = computed(() =>
  flowType.value === 'recovery'
    ? '验证成功后会自动进入密码重设页面。'
    : '验证成功后会返回登录页。',
)

function resolveNextPath() {
  const next = readParam(route.query.next)
  if (next) return next
  return flowType.value === 'recovery' ? '/reset-password' : '/login'
}

function clearUrlNoise() {
  if (typeof window === 'undefined') return
  const target = resolveNextPath()
  window.history.replaceState({}, document.title, target)
}

async function tryEstablishSessionFromHash(supabase) {
  const hashParams = readHashParams()
  const accessToken = hashParams.get('access_token')
  const refreshToken = hashParams.get('refresh_token')

  if (!accessToken || !refreshToken) return false

  try {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (error) throw error
    await sleep(200)
    return true
  } catch {
    return false
  }
}

async function tryExchangeCode(supabase) {
  const code = readParam(route.query.code)
  if (!code) return false

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) throw error
    await sleep(200)
    return true
  } catch {
    return false
  }
}

async function tryVerifyOtp(supabase) {
  const tokenHash = readParam(route.query.token_hash || route.query.tokenHash)
  if (!tokenHash) return false

  const type = flowType.value === 'recovery' ? 'recovery' : 'signup'
  try {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })
    if (error) throw error
    await sleep(200)
    return true
  } catch {
    return false
  }
}

async function checkExistingSession(supabase) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session || null
  } catch {
    return null
  }
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
    if (errorCode) {
      throw new Error(decodeURIComponent(errorDescription || '验证链接无效或已过期，请重新操作。'))
    }

    let handled = false

    handled = (await tryEstablishSessionFromHash(supabase)) || handled

    if (!handled) {
      handled = (await tryExchangeCode(supabase)) || handled
    }

    if (!handled) {
      handled = (await tryVerifyOtp(supabase)) || handled
    }

    let session = await checkExistingSession(supabase)

    if (!session && !handled) {
      await sleep(300)
      session = await checkExistingSession(supabase)
    }

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

onMounted(() => {
  processAuthCallback().catch((error) => {
    processing.value = false
    errorMsg.value = getErrorMessage(error)
  })
})
</script>
