import { computed, ref, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppTextField from '@/components/form/AppTextField.vue'
import Turnstile from 'vue-turnstile'
import { getErrorMessage } from '@/lib/errors'
import { showToast } from '@/lib/toast'
import { useAuthStore } from '@/stores/auth'
import { requireSupabase } from '@/lib/supabase'
import { useTurnstile } from '@/composables/useTurnstile'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const { 
  token, 
  error: turnstileError, 
  widgetLoading, 
  widgetError, 
  hasSiteKey, 
  isWidgetLoaded, 
  isVerifying,
  SITE_KEY, 
  onExpire, 
  onError, 
  onWidgetLoaded, 
  verifyToken, 
  reset
} = useTurnstile()

const form = ref({ email: '', password: '' })
const submitting = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const turnstileKey = ref(0)

function resetTurnstile() {
  reset()
  turnstileKey.value += 1
}

// 设备确认弹窗状态
const showDeviceAlert = ref(false)
const deviceDialogRef = ref(null)
const pendingLoginData = ref(null)

// 连续失败计数与临时锁定
const failCount = ref(0)
const lockUntil = ref(0)
const lockRemain = ref(0)
let lockTimer = null

const MAX_FAIL = 5
const LOCK_SECONDS = 60

function startLockCountdown() {
  if (lockTimer) clearInterval(lockTimer)
  lockTimer = setInterval(() => {
    const remain = Math.ceil((lockUntil.value - Date.now()) / 1000)
    if (remain <= 0) {
      lockRemain.value = 0
      clearInterval(lockTimer)
      lockTimer = null
    } else {
      lockRemain.value = remain
    }
  }, 500)
}

const showReset = ref(false)
const resetEmail = ref('')
const resetting = ref(false)
const resetSent = ref(false)
const resetCooldown = ref(0)
const resendSent = ref(false)
const resendCooldown = ref(0)

const isUnverifiedError = computed(() =>
  errorMsg.value.includes('邮箱尚未验证') || errorMsg.value.includes('Email not confirmed'),
)

onMounted(() => {
  if (route.query.passwordUpdated === '1') {
    successMsg.value = '密码已更新，请使用新密码重新登录。'
  }
  if (route.query.recoveryError === '1') {
    errorMsg.value = '重置链接无效、已过期，或当前浏览器未完成恢复登录，请重新申请一次密码重置。'
  }
})

/**
 * 步骤1：提交登录表单
 * - 验证表单
 * - 验证 Turnstile token
 * - 检查是否需要设备确认
 */
async function submit() {
  
  if (submitting.value || isVerifying.value) {
    return
  }

  errorMsg.value = ''

  // 检查锁定状态
  if (lockUntil.value > Date.now()) {
    errorMsg.value = `登录尝试过于频繁，请 ${lockRemain.value} 秒后再试`
    return
  }

  // 验证表单
  if (!form.value.email || !form.value.password) {
    errorMsg.value = '请填写邮箱和密码'
    return
  }
  
  // 检查验证码组件错误
  if (widgetError.value && widgetError.value.trim()) {
    errorMsg.value = widgetError.value
    return
  }
  
  // 检查 token 是否存在
  const currentToken = token.value
  
  if (!currentToken || typeof currentToken !== 'string' || !currentToken.trim()) {
    errorMsg.value = '请完成验证码验证'
    return
  }
  
  // 验证 token（不在此处清空 token）
  const verificationResult = await verifyToken(currentToken)
  
  if (!verificationResult.ok) {
    errorMsg.value = verificationResult.message || '验证码验证失败，请重试'
    resetTurnstile()
    return
  }
  
  
  // 进入步骤2：处理会话冲突
  await handleSessionConflict(currentToken)
}

/**
 * 步骤2：处理会话冲突
 * - 检查是否存在其他设备会话
 * - 如果存在，显示确认弹窗
 * - 如果不存在，直接登录
 */
async function handleSessionConflict(verifiedToken) {
  
  // 保存登录数据
  pendingLoginData.value = {
    email: form.value.email,
    password: form.value.password,
    token: verifiedToken
  }
  
  // TODO: 实际检查是否存在其他设备会话
  // 目前简化处理：总是显示确认弹窗
  
  showDeviceAlert.value = true
  
  // 等待 DOM 更新后检查弹窗状态
  await nextTick()
  
  if (deviceDialogRef.value) {
  } else {
  }
}

/**
 * 步骤3a：用户确认强制登录
 */
async function confirmForceLogin() {
  
  showDeviceAlert.value = false
  
  if (!pendingLoginData.value) {
    errorMsg.value = '登录数据丢失，请重试'
    resetTurnstile()
    return
  }
  
  await executeFinalLogin(pendingLoginData.value)
}

/**
 * 步骤3b：用户取消登录
 */
function cancelLogin() {

  showDeviceAlert.value = false
  pendingLoginData.value = null
  resetTurnstile()
}

/**
 * 处理弹窗关闭事件
 */
function handleDialogClosed(event) {

  if (showDeviceAlert.value) {
    showDeviceAlert.value = false
    pendingLoginData.value = null
    resetTurnstile()
  }
}

/**
 * 步骤4：执行最终登录
 */
async function executeFinalLogin(loginData) {
  
  submitting.value = true
  
  try {
    await auth.signIn({ email: loginData.email, password: loginData.password })
    
    // 登录成功
    failCount.value = 0
    showToast('登录成功，已强制断开其他设备的连接')
    
    // 清理状态
    resetTurnstile()
    
    // 跳转
    router.replace(route.query.redirect || '/profile')
    
  } catch (error) {
    
    failCount.value += 1
    
    if (failCount.value >= MAX_FAIL) {
      lockUntil.value = Date.now() + LOCK_SECONDS * 1000
      lockRemain.value = LOCK_SECONDS
      startLockCountdown()
      errorMsg.value = `连续登录失败 ${failCount.value} 次，账号已临时锁定 ${LOCK_SECONDS} 秒`
      failCount.value = 0
    } else {
      errorMsg.value = getErrorMessage(error)
      if (MAX_FAIL - failCount.value <= 2) {
        errorMsg.value += `（还可尝试 ${MAX_FAIL - failCount.value} 次）`
      }
    }
    
    // 登录失败，重置验证码
    resetTurnstile()
    
  } finally {
    submitting.value = false
    pendingLoginData.value = null
  }
}

async function resendVerification() {
  if (resendCooldown.value > 0 || !form.value.email) return
  try {
    const supabase = requireSupabase()
    const { error } = await supabase.auth.resend({ type: 'signup', email: form.value.email })
    if (error) throw error
    resendSent.value = true
    errorMsg.value = ''
    resendCooldown.value = 60
    const timer = setInterval(() => {
      resendCooldown.value -= 1
      if (resendCooldown.value <= 0) clearInterval(timer)
    }, 1000)
  } catch (error) {
    showToast(getErrorMessage(error))
  }
}

async function sendReset() {
  errorMsg.value = ''
  if (!resetEmail.value) {
    errorMsg.value = '请输入注册邮箱'
    return
  }
  if (resetCooldown.value > 0) {
    errorMsg.value = `请 ${resetCooldown.value} 秒后再重新发送`
    return
  }
  resetting.value = true
  try {
    const supabase = requireSupabase()
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.value, {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    })
    if (error) throw error
    resetSent.value = true
    showReset.value = false
    resetCooldown.value = 60
    const t = setInterval(() => {
      resetCooldown.value -= 1
      if (resetCooldown.value <= 0) clearInterval(t)
    }, 1000)
  } catch (error) {
    errorMsg.value = getErrorMessage(error)
  } finally {
    resetting.value = false
  }
}
