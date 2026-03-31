<template>
  <section class="page public-profile-page">
    <div v-if="loading" class="empty-state">
      <mdui-circular-progress></mdui-circular-progress>
      <div>正在加载用户信息…</div>
    </div>

    <template v-else-if="profile">
      <mdui-card class="section-card user-profile-card">
        <div class="profile-cover profile-cover--public"></div>
        <div class="user-profile-hero user-profile-hero--social">
          <div class="user-profile-side user-profile-side--social">
            <div class="user-profile-avatar user-profile-avatar--social">
              <img v-if="profile.avatar_url" :src="profile.avatar_url" :alt="profile.nickname" />
              <span v-else>{{ (profile.nickname || 'U').slice(0, 1).toUpperCase() }}</span>
            </div>
            <div class="profile-hero-aside profile-hero-aside--public" aria-label="公开资料概览">
              <div class="profile-hero-aside__item">
                <span>用户ID</span>
                <strong>{{ profile.uid ? formatUid(profile.uid) : '未生成' }}</strong>
              </div>
              <div class="profile-hero-aside__item">
                <span>公开图片</span>
                <strong>{{ images.length }} 张</strong>
              </div>
              <div class="profile-hero-aside__item">
                <span>呼号</span>
                <strong>{{ profile.callsign || '未公开' }}</strong>
              </div>
            </div>
          </div>

          <div class="user-profile-info user-profile-info--social">
            <div class="user-profile-title-row">
              <h1>{{ profile.nickname }}</h1>
              <span v-if="profile.uid" class="uid-badge">{{ formatUid(profile.uid) }}</span>
            </div>

            <div class="profile-subline">
              <span v-if="profile.created_at" class="profile-subline__item">加入于 {{ formatDate(profile.created_at) }}</span>
              <span class="profile-subline__item">{{ images.length }} 张公开图片</span>
            </div>

            <div class="profile-identity-row user-profile-pill-row">
              <span class="identity-pill identity-pill--role">
                <mdui-icon :name="roleIconName(profile.role)" style="font-size: 15px"></mdui-icon>
                {{ roleLabel(profile.role) }}
              </span>
              <span v-if="profile.callsign" class="identity-pill identity-pill--callsign">
                <mdui-icon name="settings_input_antenna--rounded" style="font-size: 15px"></mdui-icon>
                {{ profile.callsign }}
              </span>
              <button
                v-if="profile.grid_locator"
                type="button"
                class="identity-pill identity-pill--grid identity-pill--interactive"
                @click="gridPreviewOpen = true"
              >
                <mdui-icon name="fmd_good--rounded" style="font-size: 15px"></mdui-icon>
                {{ profile.grid_locator }}
              </button>
              <span
                v-for="cert in parsedCerts(profile.certifications)"
                :key="cert.label"
                class="identity-pill identity-pill--cert"
                :class="{ 'identity-pill--icon-only': !displayCertLabel(cert.label) }"
                :title="cert.label || ''"
              >
                <mdui-icon :name="certIconName(cert.icon)" style="font-size: 14px"></mdui-icon>
                <template v-if="displayCertLabel(cert.label)">{{ displayCertLabel(cert.label) }}</template>
              </span>
            </div>

            <p v-if="profile.bio" class="muted user-profile-bio">{{ profile.bio }}</p>
            <p v-else class="muted user-profile-bio">这个人很低调，还没有写个人简介。</p>

            <div class="profile-stats-row profile-stats-row--compact public-profile-stats">
              <div class="profile-stat-inline">
                <strong>{{ images.length }}</strong>
                <span>公开图片</span>
              </div>
              <div class="profile-stat-inline">
                <strong>{{ parsedCerts(profile.certifications).length }}</strong>
                <span>认证</span>
              </div>
              <div class="profile-stat-inline">
                <strong>
                  <button
                    v-if="profile.grid_locator"
                    type="button"
                    class="grid-link-button"
                    @click="gridPreviewOpen = true"
                  >
                    {{ profile.grid_locator }}
                  </button>
                  <span v-else>—</span>
                </strong>
                <span>网格</span>
              </div>
            </div>

            <div v-if="auth.isSuperAdmin && profile.id !== auth.user?.id" class="admin-actions-row">
              <mdui-button variant="outlined" @click="showSendNotification = true">
                <mdui-icon slot="icon" name="notifications_active--rounded"></mdui-icon>
                发送通知
              </mdui-button>
            </div>
          </div>
        </div>
      </mdui-card>

      <div class="user-profile-layout">
        <aside class="user-profile-layout__sidebar">
          <mdui-card class="section-card user-profile-summary">
            <div class="eyebrow">基本信息</div>
            <div class="profile-summary-list">
              <div class="profile-summary-item">
                <span>身份</span>
                <strong>{{ roleLabel(profile.role) }}</strong>
              </div>
              <div class="profile-summary-item">
                <span>呼号</span>
                <strong>{{ profile.callsign || '未公开' }}</strong>
              </div>
              <div class="profile-summary-item">
                <span>网格</span>
                <strong>
                  <button
                    v-if="profile.grid_locator"
                    type="button"
                    class="grid-link-button"
                    @click="gridPreviewOpen = true"
                  >
                    {{ profile.grid_locator }}
                  </button>
                  <span v-else>未填写</span>
                </strong>
              </div>
              <div class="profile-summary-item">
                <span>认证数量</span>
                <strong>{{ parsedCerts(profile.certifications).length }}</strong>
              </div>
              <div class="profile-summary-item">
                <span>用户ID</span>
                <strong>{{ profile.uid ? formatUid(profile.uid) : '未生成' }}</strong>
              </div>
            </div>
          </mdui-card>

          <div v-if="publicProfilePanels.length" class="profile-panel-stack">
            <component
              :is="panel.component"
              v-for="panel in publicProfilePanels"
              :key="panel.id"
              :auth="auth"
              :profile="profile"
              :config="panel.config"
              :plugin="panel"
              class="profile-panel-stack__item"
            />
          </div>
        </aside>

        <div class="user-profile-layout__main">
          <mdui-card class="section-card">
            <div class="section-card__header">
              <div>
                <div class="eyebrow">投稿图集</div>
                <h2>{{ images.length }} 张图片</h2>
              </div>
            </div>
            <div v-if="images.length" class="gallery-grid">
              <GalleryCard v-for="image in images" :key="image.id" :image="image"></GalleryCard>
            </div>
            <div v-else class="empty-state">TA 还没有公开图片。</div>
          </mdui-card>
        </div>
      </div>


      <GridMapPreviewDialog :open="gridPreviewOpen" :grid="profile?.grid_locator" @close="gridPreviewOpen = false" />

      <mdui-dialog :open="showSendNotification" @closed="showSendNotification = false">
        <div class="dialog-content">
          <h3>向 {{ profile?.nickname }} 发送通知</h3>
          <div class="form-control" style="margin-top: 12px">
            <AppTextField
              v-model="notificationTitle"
              label="通知标题"
              placeholder="请输入通知标题"
              :maxlength="100"
              counter
              trim
            ></AppTextField>
          </div>
          <div class="form-control" style="margin-top: 12px">
            <AppTextField
              v-model="notificationContent"
              label="通知内容"
              placeholder="请输入通知内容"
              :maxlength="1000"
              :rows="4"
              autosize
              counter
              trim
            ></AppTextField>
          </div>
        </div>
        <mdui-button slot="action" @click="showSendNotification = false">取消</mdui-button>
        <mdui-button slot="action" variant="filled" :loading="sendingNotification" :disabled="!notificationTitle.trim() || !notificationContent.trim()" @click="sendNotification">
          发送
        </mdui-button>
      </mdui-dialog>
    </template>

    <div v-else class="empty-state">
      <p>找不到该用户。</p>
      <mdui-button variant="filled" @click="router.push('/')">返回主页</mdui-button>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import GridMapPreviewDialog from '@/components/maps/GridMapPreviewDialog.vue'
import { useRoute, useRouter } from 'vue-router'
import { formatDate } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'
import { showToast } from '@/lib/toast'
import { requireSupabase } from '@/lib/supabase'
import { fetchPublicProfileByUid } from '@/lib/publicProfiles'
import { formatPublicUid, parsePublicUid, toUserProfilePath } from '@/lib/uid'
import { normalizeImageRecord } from '@/lib/image'
import { safeInsertAuditLog } from '@/lib/audit'
import { useAuthStore } from '@/stores/auth'
import GalleryCard from '@/components/GalleryCard.vue'
import AppTextField from '@/components/form/AppTextField.vue'
import { getProfilePanels } from '@/plugins/runtime'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const loading = ref(false)
const profile = ref(null)
const images = ref([])
const gridPreviewOpen = ref(false)
const showSendNotification = ref(false)
const notificationTitle = ref('')
const notificationContent = ref('')
const sendingNotification = ref(false)

const publicProfilePanels = computed(() =>
  getProfilePanels({
    target: 'public',
    auth,
    profile: profile.value,
    route,
  }),
)

async function loadUser() {
  const uid = route.params.uid
  if (!uid) return
  const parsedUid = parsePublicUid(uid)
  if (!parsedUid) {
    profile.value = null
    images.value = []
    return
  }
  const canonicalPath = toUserProfilePath(parsedUid)
  if (canonicalPath && route.path !== canonicalPath) {
    await router.replace(canonicalPath)
    return
  }
  loading.value = true
  profile.value = null
  images.value = []
  try {
    const resolvedProfile = await fetchPublicProfileByUid(uid)
    profile.value = resolvedProfile

    if (resolvedProfile?.id) {
      const supabase = requireSupabase()
      const { data: galleryImages, error } = await supabase
        .from('images')
        .select('*')
        .eq('uploader_id', resolvedProfile.id)
        .eq('status', 'PUBLISHED')
        .order('published_at', { ascending: false })
        .limit(50)
      if (error) throw error
      images.value = (galleryImages || []).map(normalizeImageRecord).filter(Boolean)
    }
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

onMounted(loadUser)
watch(() => route.params.uid, loadUser)

function roleLabel(role) {
  return { SUPER_ADMIN: '超级管理员', REVIEWER: '审核员', USER: '普通用户' }[role] || role
}

function roleIconName(role) {
  return {
    SUPER_ADMIN: 'admin_panel_settings--rounded',
    REVIEWER: 'manage_accounts--rounded',
    USER: 'person--rounded',
  }[role] || 'person--rounded'
}

function formatUid(uid) {
  return formatPublicUid(uid)
}

function parsedCerts(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.map((item) => (typeof item === 'string' ? { label: item, icon: 'beenhere' } : item))
  }
  return []
}

function displayCertLabel(label) {
  if (!label) return ''
  return /[\u4e00-\u9fa5]/.test(label) ? label : ''
}

function certIconName(icon) {
  const map = {
    award_star: 'award_star--rounded',
    beenhere: 'beenhere--rounded',
    face_retouching_natural: 'face_retouching_natural--rounded',
    hive: 'hive--rounded',
    school: 'school--rounded',
    yard: 'yard--rounded',
    award: 'award_star--rounded',
    star: 'beenhere--rounded',
    shield: 'hive--rounded',
    crown: 'school--rounded',
    workspace_premium: 'school--rounded',
  }
  return map[icon] || 'beenhere--rounded'
}

async function sendNotification() {
  if (!profile.value || !auth.user) return
  const title = notificationTitle.value.trim()
  const content = notificationContent.value.trim()
  if (!title || !content) return
  
  sendingNotification.value = true
  try {
    const supabase = requireSupabase()
    const { error } = await supabase.from('notifications').insert({
      user_id: profile.value.id,
      title,
      content,
      type: 'SYSTEM',
      actor_id: auth.user.id,
      actor_display_name: auth.displayName,
    })
    if (error) throw error
    
    await safeInsertAuditLog({
      action: 'notification.sent',
      entityType: 'user',
      entityId: profile.value.id,
      details: {
        target_user_id: profile.value.id,
        target_user_name: profile.value.nickname,
        notification_title: title,
      },
    })
    
    showToast('通知已发送')
    showSendNotification.value = false
    notificationTitle.value = ''
    notificationContent.value = ''
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    sendingNotification.value = false
  }
}
</script>


<style scoped>
.user-profile-layout {
  display: grid;
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.user-profile-layout__sidebar,
.user-profile-layout__main {
  display: grid;
  gap: 20px;
  align-content: start;
}

.profile-panel-stack {
  display: grid;
  gap: 16px;
}

.profile-panel-stack__item {
  min-width: 0;
}

@media (max-width: 900px) {
  .user-profile-layout {
    grid-template-columns: 1fr;
  }
}
</style>
