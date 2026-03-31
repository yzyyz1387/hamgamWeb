<template>
  <section class="auth-page page">
    <mdui-card class="section-card">
      <div class="section-card__header">
        <div>
          <div class="eyebrow">创建账号</div>
          <h1>注册后即可投稿与互动</h1>
          <p>填写昵称、邮箱和密码完成注册，注册后即可参与评论、投稿和表情互动。</p>
        </div>
      </div>

      <div v-if="errorMsg" class="auth-error-banner">
        <span class="auth-banner-icon">⚠</span>
        <span>{{ errorMsg }}</span>
      </div>
      <div v-if="successMsg" class="auth-success-banner">
        <span class="auth-banner-icon">✓</span>
        <span>{{ successMsg }}</span>
      </div>

      <div class="form-grid">
        <div class="form-control" style="grid-column: 1 / -1">
          <AppTextField
            id="reg-nickname"
            v-model="form.nickname"
            trim
            label="昵称"
            :maxlength="40"
            counter
            @enter="submit"
          ></AppTextField>
        </div>
        <div class="form-control" style="grid-column: 1 / -1">
          <AppTextField
            id="reg-email"
            v-model="form.email"
            trim
            type="email"
            label="邮箱"
            autocomplete="email"
            @enter="submit"
          ></AppTextField>
        </div>
        <div class="form-control" style="grid-column: 1 / -1">
          <AppTextField
            id="reg-password"
            v-model="form.password"
            type="password"
            toggle-password
            label="密码（至少 8 位）"
            autocomplete="new-password"
            @enter="submit"
          ></AppTextField>
          <div v-if="form.password" class="pwd-strength">
            <div class="pwd-strength__bar">
              <div class="pwd-strength__fill" :style="{ width: pwdStrength.pct + '%' }" :class="pwdStrength.cls"></div>
            </div>
            <span class="pwd-strength__label" :class="pwdStrength.cls">{{ pwdStrength.label }}</span>
          </div>
        </div>
        <div class="form-control" style="grid-column: 1 / -1">
          <AppTextField
            id="reg-confirm"
            v-model="form.confirm"
            type="password"
            toggle-password
            label="确认密码"
            autocomplete="new-password"
            @enter="submit"
          ></AppTextField>
          <div v-if="form.confirm && form.password !== form.confirm" class="pwd-mismatch">两次密码不一致</div>
        </div>
      </div>

      <div class="form-control" style="grid-column: 1 / -1; margin-top: 16px">
        <div v-if="widgetError && widgetError.trim()" class="auth-error-banner" style="margin-bottom: 8px">
          <span class="auth-banner-icon">⚠</span>
          <span>{{ widgetError }}</span>
        </div>
        <div v-else-if="turnstileError && turnstileError.trim()" class="auth-error-banner" style="margin-bottom: 8px">
          <span class="auth-banner-icon">⚠</span>
          <span>{{ turnstileError }}</span>
        </div>
        <div class="turnstile-container">
          <div v-if="widgetLoading" class="auth-info-banner" style="margin-bottom: 8px">
            <span class="auth-banner-icon">⏳</span>
            <span>请等待验证码加载..</span>
          </div>
          <Turnstile
            v-if="hasSiteKey"
            :key="turnstileKey"
            v-model="token"
            :site-key="SITE_KEY"
            @expired="onExpire"
            @error="onError"
            @load="onWidgetLoaded"
            class="turnstile-widget"
          />
          <div v-else class="auth-error-banner">
            <span class="auth-banner-icon">⚠</span>
            <span>验证码服务未配置，请联系管理员</span>
          </div>
        </div>
      </div>

      <div class="action-row" style="margin-top: 18px">
        <mdui-button variant="filled" :loading="submitting" :disabled="isVerifying || !!successMsg" @click="submit">
          {{ submitting || isVerifying ? '注册中…' : '注册' }}
        </mdui-button>
        <mdui-button variant="text" @click="router.push('/login')">已有账号？去登录</mdui-button>
      </div>
    </mdui-card>
  </section>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppTextField from '@/components/form/AppTextField.vue'
import Turnstile from 'vue-turnstile'
import { siteConfig } from '@/config/site'
import { getErrorMessage } from '@/lib/errors'
import { useAuthStore } from '@/stores/auth'
import { useTurnstile } from '@/composables/useTurnstile'

const router = useRouter()
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
  reset,
  clearToken
} = useTurnstile()

const form = reactive({ nickname: '', email: '', password: '', confirm: '' })
const submitting = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const turnstileKey = ref(0)

function resetTurnstile() {
  reset()
  turnstileKey.value += 1
}

const pwdStrength = computed(() => {
  const p = form.password
  if (!p) return { pct: 0, label: '', cls: '' }
  let score = 0
  if (p.length >= 8) score++
  if (p.length >= 12) score++
  if (/[A-Z]/.test(p)) score++
  if (/[0-9]/.test(p)) score++
  if (/[^A-Za-z0-9]/.test(p)) score++
  if (score <= 1) return { pct: 20, label: '弱', cls: 'pwd-weak' }
  if (score === 2) return { pct: 40, label: '一般', cls: 'pwd-fair' }
  if (score === 3) return { pct: 65, label: '中等', cls: 'pwd-good' }
  if (score === 4) return { pct: 85, label: '强', cls: 'pwd-strong' }
  return { pct: 100, label: '非常强', cls: 'pwd-great' }
})

async function submit() {
  
  if (submitting.value || isVerifying.value) {
    return
  }

  errorMsg.value = ''
  successMsg.value = ''
  
  if (!siteConfig.enableSignup) {
    errorMsg.value = '当前站点暂未开放注册'
    return
  }
  if (!form.nickname || !form.email || !form.password) {
    errorMsg.value = '请完整填写昵称、邮箱和密码'
    return
  }
  if (form.password.length < 8) {
    errorMsg.value = '密码至少需要 8 位'
    return
  }
  if (form.password !== form.confirm) {
    errorMsg.value = '两次输入的密码不一致'
    return
  }
  
  if (widgetError.value && widgetError.value.trim()) {
    errorMsg.value = widgetError.value
    return
  }
  
  const currentToken = token.value
  
  if (!currentToken || typeof currentToken !== 'string' || !currentToken.trim()) {
    errorMsg.value = '请完成验证码验证'
    return
  }
  
  clearToken()
  
  const verificationResult = await verifyToken(currentToken)
  
  if (!verificationResult.ok) {
    errorMsg.value = verificationResult.message || '验证码验证失败，请重试'
    resetTurnstile()
    return
  }
  
  submitting.value = true
  try {
    const data = await auth.signUp(form)
    if (data.session) {
      successMsg.value = '注册成功，已自动登录，即将跳转…'
      setTimeout(() => router.replace('/profile'), 1200)
    } else {
      successMsg.value = '注册成功！请前往邮箱点击确认链接，完成验证后即可登录。'
    }
  } catch (error) {
    errorMsg.value = getErrorMessage(error)
    resetTurnstile()
  } finally {
    submitting.value = false
  }
}
</script>
