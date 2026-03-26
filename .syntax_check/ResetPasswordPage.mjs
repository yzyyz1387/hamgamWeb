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
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function readQueryValue(value) {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

function clearVerificationParams() {
  router.replace({ name: 'reset-password' }).catch(() => {})
}

async function verifyRecoveryAccess() {
  verifying.value = true
  verified.value = false
  errorMsg.value = ''

  const supabase = requireSupabase()
  const tokenHash = readQueryValue(route.query.token_hash || route.query.tokenHash)
  const errorCode = readQueryValue(route.query.error_code)
  const errorDescription = readQueryValue(route.query.error_description)

  try {
    if (errorCode) {
      throw new Error(decodeURIComponent(errorDescription || '重置链接无效或已过期，请重新申请一次密码重置。'))
    }

    if (tokenHash) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'recovery',
      })
      if (error) throw error
      auth.passwordRecoveryError = false
      auth.setPasswordRecoveryMode(true)
      verified.value = true
      clearVerificationParams()
      return
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session) {
      auth.passwordRecoveryError = false
      auth.setPasswordRecoveryMode(true)
      verified.value = true
      return
    }

    throw new Error('重置链接无效、已过期，或当前浏览器未完成恢复登录，请重新申请一次密码重置。')
  } catch (error) {
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

onMounted(() => {
  verifyRecoveryAccess().catch((error) => {
    verifying.value = false
    verified.value = false
    errorMsg.value = getErrorMessage(error)
  })
})
