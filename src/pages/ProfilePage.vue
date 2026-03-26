<template>
  <section class="page profile-page">
    <div class="profile-hero-card section-card">
      <div class="profile-cover"></div>
      <div class="profile-hero-body profile-hero-body--social">
        <div class="profile-hero-left profile-hero-left--social">
          <button type="button" class="profile-avatar-btn" @click="avatarDialogOpen = true" title="更换头像">
            <div class="profile-avatar profile-avatar--hero">
              <img v-if="avatarDraftUrl || auth.profile?.avatar_url" :src="avatarDraftUrl || auth.profile?.avatar_url" alt="avatar" />
              <span v-else>{{ (auth.displayName || 'U').slice(0, 1).toUpperCase() }}</span>
            </div>
            <div class="profile-avatar-edit"><mdui-icon name="photo_camera--rounded"></mdui-icon></div>
          </button>

          <div class="profile-hero-aside" aria-label="资料概览">
            <div class="profile-hero-aside__item">
              <span>用户ID</span>
              <strong>{{ auth.profile?.uid ? formatUid(auth.profile.uid) : '未生成' }}</strong>
            </div>
            <div class="profile-hero-aside__item">
              <span>资料完整度</span>
              <strong>{{ profileCompleteness }}%</strong>
            </div>
            <div class="profile-hero-aside__item">
              <span>当前状态</span>
              <strong>{{ auth.profile?.is_active === false ? '已停用' : '正常' }}</strong>
            </div>
          </div>
        </div>

        <div class="profile-hero-right profile-hero-right--social">
          <div class="profile-name-row profile-name-row--dense">
            <h1 class="profile-name">{{ auth.displayName }}</h1>
            <span v-if="auth.profile?.uid" class="uid-badge">{{ formatUid(auth.profile.uid) }}</span>
          </div>

          <div class="profile-subline">
            <span v-if="auth.user?.email || auth.profile?.email" class="profile-subline__item">
              {{ auth.user?.email || auth.profile?.email }}
            </span>
            <span v-if="auth.profile?.created_at" class="profile-subline__item">
              加入于 {{ formatDate(auth.profile.created_at) }}
            </span>
          </div>

          <div class="profile-identity-row">
            <span class="identity-pill identity-pill--role">
              <mdui-icon :name="roleIconName(auth.role)" style="font-size:14px"></mdui-icon>
              {{ roleLabel(auth.role) }}
            </span>
            <span v-if="auth.profile?.callsign" class="identity-pill identity-pill--callsign">
              <mdui-icon name="settings_input_antenna--rounded" style="font-size:14px"></mdui-icon>
              {{ auth.profile.callsign }}
            </span>
            <button
              v-if="auth.profile?.grid_locator"
              type="button"
              class="identity-pill identity-pill--grid identity-pill--interactive"
              @click="gridPreviewOpen = true"
            >
              <mdui-icon name="fmd_good--rounded" style="font-size:14px"></mdui-icon>
              {{ auth.profile.grid_locator }}
            </button>
            <span
              v-for="cert in parsedCerts"
              :key="`${cert.label}-${cert.icon}`"
              class="identity-pill identity-pill--cert"
              :class="{ 'identity-pill--icon-only': !displayCertLabel(cert.label) }"
              :title="cert.label || ''"
            >
              <mdui-icon :name="certIconName(cert.icon)" style="font-size:14px"></mdui-icon>
              <template v-if="displayCertLabel(cert.label)">{{ displayCertLabel(cert.label) }}</template>
            </span>
          </div>

          <p v-if="auth.profile?.bio" class="profile-bio">{{ auth.profile.bio }}</p>
          <p v-else class="profile-bio muted">写一段简介，让其他人更快认识你。</p>

          <div class="profile-hero-toolbar profile-hero-toolbar--social">
            <div class="profile-stats-row profile-stats-row--compact">
              <div class="profile-stat-inline">
                <strong>{{ submissions.length }}</strong>
                <span>投稿</span>
              </div>
              <div class="profile-stat-inline">
                <strong>{{ publishedSubmissionsCount }}</strong>
                <span>已发布</span>
              </div>
              <div class="profile-stat-inline">
                <strong>{{ certificationCount }}</strong>
                <span>认证</span>
              </div>
            </div>
            <div class="action-row profile-hero-action-group">
              <mdui-button variant="filled" :loading="savingProfile" @click="saveProfile">保存资料</mdui-button>
              <mdui-button variant="filled-tonal" @click="router.push('/submit')">投稿</mdui-button>
              <mdui-button variant="text" @click="router.push('/notifications')">通知</mdui-button>
              <mdui-button variant="text" :loading="signingOut" @click="signOut" class="btn-danger">退出登录</mdui-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="hero-grid profile-dashboard-grid">
      <div class="profile-dashboard-main">
        <mdui-card class="section-card">
          <div class="eyebrow" style="margin-bottom:14px">编辑资料</div>
          <div class="form-grid">
            <div class="form-control">
              <AppTextField id="profile-nickname" v-model="profileForm.nickname" trim label="昵称" maxlength="40" counter></AppTextField>
            </div>
            <div class="form-control">
              <label>
                呼号
                <span class="muted" style="font-weight:400;font-size:12px;margin-left:6px">需提交证明文件审核后方可显示</span>
              </label>
              <div class="callsign-field">
                <span class="callsign-value">{{ auth.profile?.callsign || '未设置' }}</span>
                <mdui-button variant="text" @click="router.push('/callsign-apply')" style="font-size:13px">
                  {{ auth.profile?.callsign ? '更新呼号' : '申请呼号认证' }}
                </mdui-button>
              </div>
            </div>
            <div class="form-control">
              <AppTextField
                id="profile-grid"
                v-model="profileForm.grid_locator"
                trim
                label="梅登黑德网格"
                maxlength="8"
                placeholder="例如：OM89 或 OM89AA"
                :helper="gridFieldHelper"
              ></AppTextField>
              <div class="grid-field-actions">
                <mdui-button variant="filled-tonal" @click="gridPickerOpen = true">地图选点</mdui-button>
                <mdui-button variant="text" :disabled="!gridPreviewAvailable" @click="gridPreviewOpen = true">预览网格</mdui-button>
              </div>
            </div>
            <div class="form-control" style="grid-column: 1 / -1">
              <AppTextField
                id="profile-bio"
                v-model="profileForm.bio"
                trim
                label="简介"
                maxlength="300"
                counter
                rows="4"
                autosize
              ></AppTextField>
            </div>
            <div class="form-control" style="grid-column: 1 / -1">
              <label>头像</label>
              <div class="avatar-inline-row">
                <div class="avatar-inline-preview">
                  <img v-if="avatarDraftUrl || auth.profile?.avatar_url" :src="avatarDraftUrl || auth.profile?.avatar_url" alt="avatar preview" />
                  <span v-else>{{ (auth.displayName || 'U').slice(0, 1).toUpperCase() }}</span>
                </div>
                <div style="font-size:14px">
                  <p class="muted">从系统预设头像中选择，或使用昵称首字母。</p>
                  <div class="action-row" style="margin-top:8px">
                    <mdui-button variant="filled-tonal" @click="avatarDialogOpen = true">选择头像</mdui-button>
                    <mdui-button variant="text" @click="clearAvatar">字母头像</mdui-button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </mdui-card>
      </div>

      <div class="profile-dashboard-sidebar">
        <mdui-card class="section-card profile-summary-card">
          <div class="eyebrow">账号概览</div>
          <div class="profile-summary-list">
            <div class="profile-summary-item">
              <span>邮箱</span>
              <strong>{{ auth.user?.email || auth.profile?.email || '未绑定' }}</strong>
            </div>
            <div class="profile-summary-item">
              <span>角色</span>
              <strong>{{ roleLabel(auth.role) }}</strong>
            </div>
            <div class="profile-summary-item">
              <span>呼号</span>
              <strong>{{ auth.profile?.callsign || '未认证' }}</strong>
            </div>
            <div class="profile-summary-item">
              <span>网格</span>
              <strong>
                <button
                  v-if="gridPreviewAvailable"
                  type="button"
                  class="grid-link-button"
                  @click="gridPreviewOpen = true"
                >
                  {{ normalizedGridInput }}
                </button>
                <span v-else>未填写</span>
              </strong>
            </div>
            <div class="profile-summary-item">
              <span>认证数量</span>
              <strong>{{ certificationCount }}</strong>
            </div>
            <div class="profile-summary-item">
              <span>用户ID</span>
              <strong>{{ auth.profile?.uid ? formatUid(auth.profile.uid) : '未生成' }}</strong>
            </div>
          </div>
          <div class="profile-summary-actions">
            <mdui-button v-if="auth.profile?.uid" variant="filled-tonal" @click="goPublicProfile">查看用户页</mdui-button>
            <mdui-button variant="text" @click="router.push('/notifications')">通知中心</mdui-button>
          </div>
        </mdui-card>

        <mdui-card class="section-card">
          <div class="eyebrow" style="margin-bottom:14px">账户安全</div>
          <div class="form-grid">
            <div class="form-control" style="grid-column: 1 / -1">
              <AppTextField
                id="profile-password"
                v-model="passwordForm.password"
                type="password"
                toggle-password
                label="新密码"
                autocomplete="new-password"
              ></AppTextField>
            </div>
            <div class="form-control" style="grid-column: 1 / -1">
              <AppTextField
                id="profile-password-confirm"
                v-model="passwordForm.confirm"
                type="password"
                toggle-password
                label="确认新密码"
                autocomplete="new-password"
              ></AppTextField>
              <div v-if="passwordForm.confirm && passwordForm.password !== passwordForm.confirm" class="pwd-mismatch">两次密码不一致</div>
            </div>
          </div>
          <div class="action-row" style="margin-top:16px">
            <mdui-button variant="filled-tonal" :loading="savingPassword" @click="changePassword">更新密码</mdui-button>
          </div>
        </mdui-card>
      </div>
    </div>

    <mdui-card class="section-card">
      <div class="section-card__header">
        <div><div class="eyebrow">我的投稿</div><h2>{{ submissions.length }} 条记录</h2></div>
        <mdui-button variant="filled" @click="router.push('/submit')">新建投稿</mdui-button>
      </div>
      <div v-if="loadingSubmissions" class="empty-state"><mdui-circular-progress></mdui-circular-progress></div>
      <div v-else-if="submissions.length" class="list-panel">
        <article v-for="item in submissions" :key="item.id" class="list-item-card">
          <div class="list-item-card__head">
            <div>
              <strong>{{ item.title }}</strong>
              <div class="muted" style="font-size:12px">{{ formatDate(item.created_at, { withTime: true }) }}</div>
            </div>
            <div class="chip-row">
              <span class="status-pill" :class="statusClass(item.status)">{{ statusLabel(item.status) }}</span>
              <mdui-button variant="text" @click="openPreview(item)">预览</mdui-button>
            </div>
          </div>
          <p v-if="item.description" class="muted" style="font-size:13px">{{ item.description }}</p>
          <div v-if="item.reviewer_note" class="muted" style="font-size:12px">审核备注：{{ item.reviewer_note }}</div>
        </article>
      </div>
      <div v-else class="empty-state">还没有投稿记录。</div>
    </mdui-card>

    <AvatarPickerDialog v-model="avatarDraftUrl" :open="avatarDialogOpen" @close="avatarDialogOpen = false" @confirm="confirmAvatar" />
    <GridPickerDialog :open="gridPickerOpen" :value="profileForm.grid_locator" @close="gridPickerOpen = false" @confirm="handleGridPicked" />
    <GridMapPreviewDialog :open="gridPreviewOpen" :grid="profileForm.grid_locator" @close="gridPreviewOpen = false" />

    <AlertDialog
      :open="pwdErrorDialog.open"
      type="error"
      :title="pwdErrorDialog.title"
      :message="pwdErrorDialog.message"
      @close="pwdErrorDialog.open = false"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import GridPickerDialog from '@/components/maps/GridPickerDialog.vue'
import GridMapPreviewDialog from '@/components/maps/GridMapPreviewDialog.vue'
import { useRouter } from 'vue-router'
import AvatarPickerDialog from '@/components/AvatarPickerDialog.vue'
import AlertDialog from '@/components/AlertDialog.vue'
import AppTextField from '@/components/form/AppTextField.vue'
import { formatDate } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'
import { showToast } from '@/lib/toast'
import { requireSupabase } from '@/lib/supabase'
import { createSubmissionPreview } from '@/lib/engagement'
import { formatPublicUid, toUserProfilePath } from '@/lib/uid'
import { isValidGridLocator, normalizeGridLocatorInput } from '@/lib/grid'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const profileForm = reactive({ nickname: '', bio: '', callsign: '', grid_locator: '' })
const passwordForm = reactive({ password: '', confirm: '' })
const submissions = ref([])
const savingProfile = ref(false)
const savingPassword = ref(false)
const loadingSubmissions = ref(false)
const avatarDialogOpen = ref(false)
const avatarDraftUrl = ref('')
const signingOut = ref(false)
const gridPickerOpen = ref(false)
const gridPreviewOpen = ref(false)

const pwdErrorDialog = reactive({ open: false, title: '密码更新失败', message: '' })

function showPwdError(msg) {
  pwdErrorDialog.message = msg
  pwdErrorDialog.open = true
}

function displayCertLabel(label) {
  if (!label) return ''
  return /[\u4e00-\u9fa5]/.test(label) ? label : ''
}

function getPasswordUpdateMessage(error) {
  const raw = error?.message || ''
  if (/same.*password|password.*same|different from the old/i.test(raw)) {
    return '新旧密码不能相同'
  }
  if (/at least/i.test(raw) && /password/i.test(raw)) {
    return '新密码至少需要 8 位'
  }
  return getErrorMessage(error)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const parsedCerts = computed(() => {
  const raw = auth.profile?.certifications
  if (!raw || !Array.isArray(raw)) return []
  return raw.map((c) => typeof c === 'string' ? { label: c, icon: 'award_star' } : c)
})

const publishedSubmissionsCount = computed(() =>
  submissions.value.filter((item) => item.status === 'PUBLISHED').length,
)

const certificationCount = computed(() => parsedCerts.value.length)

const profileCompleteness = computed(() => {
  const checks = [
    auth.profile?.nickname,
    auth.profile?.avatar_url,
    auth.profile?.bio,
    auth.profile?.grid_locator,
    auth.profile?.uid,
  ]
  const filled = checks.filter(Boolean).length
  return Math.round((filled / checks.length) * 100)
})

const normalizedGridInput = computed(() => normalizeGridLocatorInput(profileForm.grid_locator))
const gridPreviewAvailable = computed(() => isValidGridLocator(normalizedGridInput.value))
const gridFieldHelper = computed(() => {
  if (!profileForm.grid_locator) return '支持 4 / 6 / 8 位网格，也可以点地图自动生成。'
  return gridPreviewAvailable.value
    ? '当前网格格式有效，点击“预览网格”可查看范围。'
    : '请输入合法的梅登黑德网格，例如 OM89 / OM89AA。'
})

function certIconName(icon) {
  const map = {
    award_star: 'award_star--rounded', beenhere: 'beenhere--rounded',
    face_retouching_natural: 'face_retouching_natural--rounded', hive: 'hive--rounded',
    school: 'school--rounded', yard: 'yard--rounded',
    award: 'award_star--rounded', star: 'beenhere--rounded',
    shield: 'hive--rounded', crown: 'school--rounded', workspace_premium: 'school--rounded',
  }
  return map[icon] || 'beenhere--rounded'
}

watch(() => auth.profile, (profile) => {
  if (!profile) return
  profileForm.nickname = profile.nickname || ''
  profileForm.bio = profile.bio || ''
  profileForm.callsign = profile.callsign || ''
  profileForm.grid_locator = profile.grid_locator || ''
  avatarDraftUrl.value = profile.avatar_url || ''
}, { immediate: true })

watch(
  () => profileForm.grid_locator,
  (value) => {
    const normalized = normalizeGridLocatorInput(value)
    if (normalized !== value) {
      profileForm.grid_locator = normalized
    }
  },
)

onMounted(async () => {
  await auth.init()
  await loadMySubmissions()
})

async function loadMySubmissions() {
  loadingSubmissions.value = true
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase.from('submissions').select('*')
      .eq('uploader_id', auth.user.id).order('created_at', { ascending: false })
    if (error) throw error
    submissions.value = data || []
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    loadingSubmissions.value = false
  }
}

function handleGridPicked(locator) {
  profileForm.grid_locator = normalizeGridLocatorInput(locator)
  gridPickerOpen.value = false
  gridPreviewOpen.value = true
}


async function saveProfile() {
  if (normalizedGridInput.value && !gridPreviewAvailable.value) {
    showToast('请输入合法的梅登黑德网格后再保存。')
    return
  }
  savingProfile.value = true
  try {
    await auth.saveProfile({
      nickname: profileForm.nickname, bio: profileForm.bio,
      callsign: profileForm.callsign,
      grid_locator: normalizedGridInput.value || null,
      avatar_url: avatarDraftUrl.value || null,
    })
    showToast('资料已保存')
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    savingProfile.value = false
  }
}

function clearAvatar() { avatarDraftUrl.value = ''; confirmAvatar() }

async function confirmAvatar() {
  avatarDialogOpen.value = false
  try {
    await auth.updateAvatarUrl(avatarDraftUrl.value)
    showToast(avatarDraftUrl.value ? '头像已更新' : '已改为字母头像')
  } catch (error) { showToast(getErrorMessage(error)) }
}

async function changePassword() {
  if (!passwordForm.password || passwordForm.password.length < 8) {
    showPwdError('新密码至少需要 8 位')
    return
  }
  if (passwordForm.password !== passwordForm.confirm) {
    showPwdError('两次输入的密码不一致')
    return
  }

  savingPassword.value = true
  try {
    await auth.changePassword(passwordForm.password)

    passwordForm.password = ''
    passwordForm.confirm = ''
    showToast('密码已更新，请使用新密码重新登录')

    const supabase = requireSupabase()
    await Promise.race([
      supabase.auth.signOut({ scope: 'local' }),
      sleep(2000),
    ]).catch(() => {})

    await auth.finishSignOut({ silent: true, localOnly: true })
    await router.replace({ path: '/login', query: { passwordUpdated: '1' } })
  } catch (error) {
    showPwdError(getPasswordUpdateMessage(error))
  } finally {
    savingPassword.value = false
  }
}

async function signOut() {
  signingOut.value = true
  try {
    await auth.signOut({ reason: '已退出登录。' })
    router.push('/')
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    signingOut.value = false
  }
}

async function openPreview(item) {
  try {
    const url = await createSubmissionPreview(item.storage_path)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  } catch (error) { showToast(getErrorMessage(error)) }
}

function roleLabel(role) {
  return { SUPER_ADMIN: '超级管理员', REVIEWER: '审核员', USER: '普通用户' }[role] || role
}
function roleIconName(role) {
  return { SUPER_ADMIN: 'admin_panel_settings--rounded', REVIEWER: 'manage_accounts--rounded', USER: 'person--rounded' }[role] || 'person--rounded'
}
function goPublicProfile() {
  const path = toUserProfilePath(auth.profile?.uid)
  if (path) router.push(path)
}
function formatUid(uid) { return formatPublicUid(uid) }
function statusLabel(status) {
  return { PENDING: '待审核', PUBLISHED: '已发布', REJECTED: '已驳回', WITHDRAWN: '已撤回' }[status] || status
}
function statusClass(status) {
  return `status-pill--${{ PENDING: 'pending', PUBLISHED: 'published', REJECTED: 'rejected', WITHDRAWN: 'inactive' }[status] || 'pending'}`
}
</script>
