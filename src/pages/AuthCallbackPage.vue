<template>
  <section class="auth-page page">
    <mdui-card class="section-card">
      <div class="section-card__header">
        <div>
          <div class="eyebrow">账户验证</div>
          <h1>{{ title }}</h1>
          <p>{{ description }}</p>
        </div>
      </div>

      <div v-if="loading" class="auth-info-banner">
        <span class="auth-banner-icon">⏳</span>
        <span>正在处理链接，请稍候…</span>
      </div>
      <div v-else-if="errorMsg" class="auth-error-banner">
        <span class="auth-banner-icon">⚠</span>
        <span>{{ errorMsg }}</span>
      </div>
      <div v-else class="auth-success-banner">
        <span class="auth-banner-icon">✓</span>
        <span>验证成功，正在跳转…</span>
      </div>

      <div class="action-row" style="margin-top: 18px">
        <mdui-button variant="filled" @click="goFallback">{{ fallbackLabel }}</mdui-button>
      </div>
    </mdui-card>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getErrorMessage } from '@/lib/errors'
import { requireSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const loading = ref(true)
const errorMsg = ref('')

const flowType = computed(() => {
  const value = readQueryValue(route.query.type || route.query.flow)
  return value || 'general'
})

const title = computed(() => (flowType.value === 'recovery' ? '验证重置链接' : '验证邮箱链接'))
const description = computed(() =>
  flowType.value === 'recovery'
    ? '系统将验证你的密码重置链接，并自动进入设置新密码页面。'
    : '系统将验证链接并完成登录或邮箱确认。',
)
const fallbackLabel = computed(() => (flowType.value === 'recovery' ? '返回登录页重新发送' : '返回登录'))

function readQueryValue(value) {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

function buildTargetPath() {
  const nextPath = readQueryValue(route.query.next)
  if (nextPath) return nextPath
  return flowType.value === 'recovery' ? '/reset-password' : '/login'
}

async function goFallback() {
  await router.replace(flowType.value === 'recovery' ? '/login?recoveryError=1' : '/login')
}

async function handleTokenHash(tokenHash) {
  if (flowType.value === 'recovery') {
    auth.passwordRecoveryError = false
    auth.setPasswordRecoveryMode(true)
    await router.replace({
      path: '/reset-password',
      query: { token_hash: tokenHash, type: 'recovery' },
    })
    return
  }

  const supabase = requireSupabase()
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: flowType.value || 'signup',
  })
  if (error) throw error
  await router.replace(buildTargetPath())
}

async function handleCode(code) {
  const supabase = requireSupabase()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) throw error

  if (flowType.value === 'recovery' || auth.passwordRecoveryMode) {
    auth.passwordRecoveryError = false
    auth.setPasswordRecoveryMode(true)
    await router.replace('/reset-password')
    return
  }

  await router.replace(buildTargetPath())
}

async function processCallback() {
  loading.value = true
  errorMsg.value = ''

  const errorCode = readQueryValue(route.query.error_code)
  const errorDescription = readQueryValue(route.query.error_description)
  const tokenHash = readQueryValue(route.query.token_hash || route.query.tokenHash)
  const code = readQueryValue(route.query.code)

  try {
    if (errorCode) {
      throw new Error(decodeURIComponent(errorDescription || '链接无效或已过期，请重新获取。'))
    }

    if (tokenHash) {
      await handleTokenHash(tokenHash)
      return
    }

    if (code) {
      await handleCode(code)
      return
    }

    const supabase = requireSupabase()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session) {
      if (flowType.value === 'recovery' || auth.passwordRecoveryMode) {
        auth.passwordRecoveryError = false
        auth.setPasswordRecoveryMode(true)
        await router.replace('/reset-password')
        return
      }
      await router.replace(buildTargetPath())
      return
    }

    throw new Error(flowType.value === 'recovery' ? '重置链接无效、已过期，或当前浏览器未完成恢复登录，请重新申请一次密码重置。' : '验证链接无效或已过期，请重新操作。')
  } catch (error) {
    if (flowType.value === 'recovery') {
      auth.passwordRecoveryError = true
      auth.setPasswordRecoveryMode(false)
    }
    errorMsg.value = getErrorMessage(error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  processCallback().catch((error) => {
    loading.value = false
    errorMsg.value = getErrorMessage(error)
  })
})
</script>
