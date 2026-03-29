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
        <div><div class="eyebrow">我的投稿</div><h2>{{ filteredSubmissions.length }} 条记录</h2></div>
        <div class="submission-filter-row">
          <AppTextField
            v-model="submissionSearch"
            placeholder="搜索投稿..."
            style="min-width: 200px"
            trim
          >
            <mdui-icon slot="icon" name="search--rounded"></mdui-icon>
          </AppTextField>
          <select v-model="submissionStatusFilter" class="submission-status-select">
            <option value="ALL">全部</option>
            <option value="PENDING">待审核</option>
            <option value="PUBLISHED">已发布</option>
            <option value="REJECTED">已驳回</option>
          </select>
          <mdui-button variant="filled" @click="router.push('/submit')">新建投稿</mdui-button>
        </div>
      </div>
      <div v-if="loadingSubmissions" class="empty-state"><mdui-circular-progress></mdui-circular-progress></div>
      <div v-else-if="filteredSubmissions.length" class="submission-grid">
        <div v-for="item in filteredSubmissions" :key="item.id" class="submission-card">
          <div class="submission-card__thumb" @click="openPreview(item)">
            <img v-if="item.previewUrl" :src="item.previewUrl" alt="预览" />
            <mdui-icon v-else name="image--rounded" style="font-size:32px;color:#c0c8d0"></mdui-icon>
          </div>
          <div class="submission-card__body">
            <div class="submission-card__title">{{ item.title }}</div>
            <div class="submission-card__meta">
              <span class="status-pill" :class="statusClass(item.status)">{{ statusLabel(item.status) }}</span>
              <span>{{ formatDate(item.created_at) }}</span>
            </div>
            <p v-if="item.description" class="submission-card__desc">{{ item.description }}</p>
            <div v-if="item.reviewer_note" class="submission-card__note">
              <strong>审核备注：</strong><span v-html="renderReviewerNote(item.reviewer_note)"></span>
            </div>
            <div v-if="item.status === 'REJECTED'" class="submission-card__actions">
              <mdui-button variant="outlined" size="small" @click="editSubmission(item)">重新编辑</mdui-button>
              <mdui-button variant="text" size="small" style="color: #b91c1c" @click="deleteSubmission(item)">删除</mdui-button>
            </div>
            <div v-if="item.status === 'PUBLISHED' && item.published_image_slug" class="submission-card__actions">
              <mdui-button variant="outlined" size="small" @click="goToImage(item.published_image_slug)">查看发布页</mdui-button>
              <mdui-button variant="text" size="small" @click="editPublishedImage(item)">编辑图片</mdui-button>
            </div>
          </div>
        </div>
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

    <mdui-dialog :open="deleteConfirmDialog.open" @closed="deleteConfirmDialog.open = false">
      <div class="dialog-content">
        <h3>确认删除</h3>
        <p style="font-size:14px;color:#5f6b76;margin-top:8px">
          确定要删除投稿「<strong>{{ deleteConfirmDialog.title }}</strong>」吗？此操作不可恢复。
        </p>
      </div>
      <mdui-button slot="action" @click="deleteConfirmDialog.open = false">取消</mdui-button>
      <mdui-button slot="action" variant="filled" style="--mdui-comp-button-filled-container-color: #dc2626" :loading="deleteConfirmDialog.loading" @click="confirmDeleteSubmission">确认删除</mdui-button>
    </mdui-dialog>

    <VueEasyLightbox
      teleport="body"
      :visible="lightboxVisible"
      :imgs="lightboxImages"
      :index="lightboxIndex"
      @hide="lightboxVisible = false"
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
import { useGalleryStore } from '@/stores/gallery'
import VueEasyLightbox from 'vue-easy-lightbox'

const router = useRouter()
const auth = useAuthStore()
const galleryStore = useGalleryStore()

const profileForm = reactive({ nickname: '', bio: '', callsign: '', grid_locator: '' })
const passwordForm = reactive({ password: '', confirm: '' })
const submissions = ref([])
const submissionSearch = ref('')
const submissionStatusFilter = ref('ALL')
const savingProfile = ref(false)
const savingPassword = ref(false)
const loadingSubmissions = ref(false)
const avatarDialogOpen = ref(false)
const avatarDraftUrl = ref('')
const signingOut = ref(false)
const gridPickerOpen = ref(false)
const gridPreviewOpen = ref(false)
const lightboxVisible = ref(false)
const lightboxImages = ref([])
const lightboxIndex = ref(0)

const pwdErrorDialog = reactive({ open: false, title: '密码更新失败', message: '' })
const deleteConfirmDialog = reactive({ open: false, title: '', id: '', storagePath: '', loading: false })

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

const filteredSubmissions = computed(() => {
  let items = submissions.value
  if (submissionStatusFilter.value !== 'ALL') {
    items = items.filter(s => s.status === submissionStatusFilter.value)
  }
  if (submissionSearch.value.trim()) {
    const q = submissionSearch.value.toLowerCase()
    items = items.filter(s => 
      s.title?.toLowerCase().includes(q) || 
      s.description?.toLowerCase().includes(q)
    )
  }
  return items
})

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
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        *,
        published_image:images!published_image_id(slug)
      `)
      .eq('uploader_id', auth.user.id)
      .is('metadata->edit_for_image_id', null)
      .order('created_at', { ascending: false })
    if (error) throw error
    submissions.value = await Promise.all((data || []).map(async item => {
      try {
        item.previewUrl = await createSubmissionPreview(item.storage_path, 200)
      } catch {
        item.previewUrl = null
      }
      item.published_image_slug = item.published_image?.slug || null
      return item
    }))
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
    if (url) {
      lightboxImages.value = [url]
      lightboxIndex.value = 0
      lightboxVisible.value = true
    }
  } catch (error) { showToast(getErrorMessage(error)) }
}

function goToImage(slug) {
  if (slug) router.push(`/image/${slug}?edit=true`)
}

function editPublishedImage(item) {
  if (item.published_image_slug) {
    router.push(`/image/${item.published_image_slug}?edit=true`)
  }
}

function editSubmission(item) {
  router.push({ path: '/submit', query: { edit: item.id } })
}

function renderReviewerNote(note) {
  if (!note) return ''
  const galleryStore = useGalleryStore()
  let html = note.replace(/\n/g, '<br/>')
  html = html.replace(/\[img:([a-zA-Z0-9-]+)\]/g, (match, slug) => {
    const img = galleryStore.images.find(i => i.slug === slug)
    if (img) {
      return `<img class="reviewer-note-image" src="${img.image_url}" alt="${img.title}" style="max-width:100%;max-height:200px;border-radius:8px;margin:4px 0;cursor:zoom-in" onclick="window.open('${img.image_url}', '_blank')" />`
    }
    return `<span style="color:#8a9aaa;font-size:12px">[图片:${slug}]</span>`
  })
  return html
}

function deleteSubmission(item) {
  deleteConfirmDialog.title = item.title
  deleteConfirmDialog.id = item.id
  deleteConfirmDialog.storagePath = item.storage_path
  deleteConfirmDialog.open = true
}

async function confirmDeleteSubmission() {
  deleteConfirmDialog.loading = true
  try {
    const supabase = requireSupabase()
    const userId = auth.user?.id
    
    if (!userId) {
      showToast('请先登录')
      return
    }
    
    if (deleteConfirmDialog.storagePath) {
      const { error: storageError } = await supabase.storage.from('submission-images').remove([deleteConfirmDialog.storagePath])
      if (storageError) console.warn('Failed to delete storage file:', storageError)
    }
    
    const { error, data } = await supabase
      .from('submissions')
      .delete()
      .eq('id', deleteConfirmDialog.id)
      .eq('uploader_id', userId)
      .select('id')
    
    if (error) throw error
    
    if (!data || data.length === 0) {
      showToast('删除失败：未找到该投稿或无权限删除')
      return
    }
    
    showToast('投稿已删除')
    deleteConfirmDialog.open = false
    submissions.value = submissions.value.filter(s => s.id !== deleteConfirmDialog.id)
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    deleteConfirmDialog.loading = false
  }
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
  return { PENDING: '待审核', PUBLISHED: '已发布', REJECTED: '已驳回', WITHDRAWN: '已撤回', IMAGE_DELETED: '已删除' }[status] || status
}
function statusClass(status) {
  return `status-pill--${{ PENDING: 'pending', PUBLISHED: 'published', REJECTED: 'rejected', WITHDRAWN: 'inactive', IMAGE_DELETED: 'deleted' }[status] || 'pending'}`
}
</script>

<style scoped>
.submission-filter-row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.submission-status-select {
  padding: 8px 12px;
  border: 1px solid rgba(24, 34, 44, 0.12);
  border-radius: 8px;
  background: #fff;
  font-size: 14px;
  cursor: pointer;
}

.submission-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.submission-card {
  border-radius: 18px;
  overflow: hidden;
  background: rgba(17, 24, 39, 0.03);
  border: 1px solid rgba(24, 34, 44, 0.06);
  transition: transform 0.2s, box-shadow 0.2s;
}

.submission-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(17, 24, 39, 0.08);
}

.submission-card__thumb {
  height: 160px;
  background: rgba(17, 24, 39, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
}

.submission-card__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.submission-card__thumb:hover img {
  transform: scale(1.05);
}

.submission-card__body {
  padding: 14px;
}

.submission-card__title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.submission-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #8a9aaa;
}

.submission-card__desc {
  font-size: 13px;
  color: #5f6b76;
  margin: 8px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.submission-card__note {
  font-size: 12px;
  color: #b91c1c;
  margin-top: 8px;
  padding: 8px 10px;
  background: rgba(239, 68, 68, 0.08);
  border-radius: 8px;
}

.submission-card__actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
</style>
