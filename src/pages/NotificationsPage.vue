<template>
  <section class="page notifications-page">
    <div v-if="notificationPanels.length" class="notification-plugin-grid">
      <component
        :is="panel.component"
        v-for="panel in notificationPanels"
        :key="panel.id"
        :auth="auth"
        :profile="auth.profile"
        :notifications="notifications"
        :active-notification="activeNotification"
        :config="panel.config"
        :plugin="panel"
        class="notification-plugin-grid__item"
      />
    </div>

    <mdui-card class="section-card notification-center-card">
      <div class="section-card__header section-card__header--wrap">
        <div>
          <div class="eyebrow">通知中心</div>
          <h1>{{ notifications.length }} 条通知</h1>
          <p class="muted">查看全部通知、快速筛选未读，并在当前页查看详细内容。</p>
        </div>
        <div class="notification-center-actions">
          <div class="notification-summary-chip">
            <strong>{{ unreadCount }}</strong>
            <span>未读</span>
          </div>
          <mdui-button variant="text" @click="markAllRead" :disabled="!unreadCount">全部已读</mdui-button>
          <mdui-button variant="text" @click="loadNotifications" :loading="loading">刷新</mdui-button>
        </div>
      </div>

      <div v-if="isCompact" class="notification-mobile-switcher">
        <button
          class="notification-mobile-switcher__btn"
          :class="{ 'notification-mobile-switcher__btn--active': mobilePane === 'list' }"
          @click="mobilePane = 'list'"
        >列表</button>
        <button
          class="notification-mobile-switcher__btn"
          :class="{ 'notification-mobile-switcher__btn--active': mobilePane === 'detail' }"
          :disabled="!activeNotification"
          @click="mobilePane = 'detail'"
        >详情</button>
      </div>

      <div class="notification-layout" :class="{ 'notification-layout--mobile-list': isCompact && mobilePane === 'list', 'notification-layout--mobile-detail': isCompact && mobilePane === 'detail' }">
        <aside class="notification-list-pane">
          <div v-if="loading" class="empty-state notification-pane-empty">
            <mdui-circular-progress></mdui-circular-progress>
            <div>正在加载通知…</div>
          </div>
          <div v-else-if="notifications.length" class="notification-list">
            <article
              v-for="item in notifications"
              :key="item.id"
              class="notification-item"
              :class="{ 'notification-item--active': item.id === activeNotification?.id, 'notification-item--unread': !item.is_read }"
              @click="selectNotification(item)"
            >
              <div class="notification-item__row">
                <div class="notification-item__main">
                  <strong class="notification-item__title">{{ item.title }}</strong>
                  <div class="notification-item__meta">
                    <span class="notification-type-badge" :class="`notification-type-badge--${typeClass(item.type)}`">{{ typeLabel(item.type) }}</span>
                    <span v-if="item.actor_display_name" class="notification-actor">
                      来自 <button type="button" class="actor-link" @click.stop="goActor(item)">{{ item.actor_display_name }}</button>
                    </span>
                    <span class="notification-time">{{ timeAgo(item.created_at) }}</span>
                  </div>
                </div>
                <span v-if="!item.is_read" class="unread-dot"></span>
              </div>
              <p class="notification-item__snippet">{{ buildSnippet(item.content) }}</p>
            </article>
          </div>
          <div v-else class="empty-state notification-pane-empty">当前没有通知。</div>
        </aside>

        <section class="notification-detail-pane">
          <div v-if="activeNotification" class="notification-detail-shell">
            <div class="notification-detail-shell__header">
              <mdui-button v-if="isCompact" variant="text" @click="mobilePane = 'list'">返回列表</mdui-button>
              <div>
                <div class="eyebrow">通知详情</div>
                <h2>{{ activeNotification.title }}</h2>
                <div class="notification-detail-meta">
                  <span class="notification-type-badge" :class="`notification-type-badge--${typeClass(activeNotification.type)}`">{{ typeLabel(activeNotification.type) }}</span>
                  <span>{{ formatDate(activeNotification.created_at, { withTime: true }) }}</span>
                  <span v-if="activeNotification.actor_display_name">
                    来自 <button type="button" class="actor-link" @click="goActor(activeNotification)">{{ activeNotification.actor_display_name }}</button>
                  </span>
                </div>
              </div>
            </div>

            <div class="rich-text notification-detail-shell__content" v-html="renderNotificationContent(activeNotification.content)"></div>

            <div v-if="activeNotification.metadata?.submission_title" class="notification-submission-info">
              <strong>投稿内容：</strong>
              <button type="button" class="submission-link" @click="goSubmission(activeNotification)">{{ activeNotification.metadata.submission_title }}</button>
            </div>

            <div class="action-row" style="margin-top: 20px">
              <mdui-button v-if="safeLink(activeNotification.link)" variant="filled" @click="openLink">打开关联页面</mdui-button>
              <mdui-button variant="text" @click="loadNotifications">刷新列表</mdui-button>
            </div>
          </div>
          <div v-else class="empty-state notification-pane-empty">从左侧选择一条通知查看详细内容。</div>
        </section>
      </div>
    </mdui-card>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatDate, timeAgo, sanitizeHtml } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'
import { normalizeSafeLink, isExternalLink } from '@/lib/safeLink'
import { showToast } from '@/lib/toast'
import { requireSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useGalleryStore } from '@/stores/gallery'
import { safeInsertAuditLog } from '@/lib/audit'
import { getNotificationCenterPanels } from '@/plugins/runtime'

const router = useRouter()
const auth = useAuthStore()
const galleryStore = useGalleryStore()

const notifications = ref([])
const loading = ref(false)
const selectedId = ref('')
const isCompact = ref(typeof window !== 'undefined' ? window.innerWidth <= 768 : false)
const mobilePane = ref('list')

const activeNotification = computed(
  () => notifications.value.find((item) => item.id === selectedId.value) || notifications.value[0] || null,
)
const unreadCount = computed(() => notifications.value.filter((item) => !item.is_read).length)
const notificationPanels = computed(() =>
  getNotificationCenterPanels({
    auth,
    profile: auth.profile,
    notifications: notifications.value,
    activeNotification: activeNotification.value,
    route: { path: '/notifications' },
  }),
)

function handleResize() {
  isCompact.value = window.innerWidth <= 768
  if (!isCompact.value) {
    mobilePane.value = 'list'
  }
}

onMounted(async () => {
  await auth.init()
  await loadNotifications()
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', handleResize)
  }
})

async function loadNotifications() {
  loading.value = true
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        actor:profiles!actor_id(uid)
      `)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error
    notifications.value = (data || []).map((n) => ({
      ...n,
      actor_uid: n.actor?.uid || null,
    }))
    if (!selectedId.value && notifications.value[0]) {
      await selectNotification(notifications.value[0], { silentSwitch: true })
    }
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function selectNotification(item, options = {}) {
  selectedId.value = item.id
  if (isCompact.value && !options.silentSwitch) {
    mobilePane.value = 'detail'
  }
  if (item.is_read) return
  try {
    const supabase = requireSupabase()
    const { error } = await supabase.rpc('mark_notification_read', {
      p_notification_id: item.id,
    })
    if (error) throw error
    item.is_read = true
    item.read_at = new Date().toISOString()
    item.read_type = 'click'
    await auth.loadUnreadNotifications()
    await safeInsertAuditLog({
      action: 'notification.read',
      entityType: 'notification',
      entityId: item.id,
      details: {
        notification_title: item.title,
        read_type: 'click',
      },
    })
  } catch (error) {
    showToast(getErrorMessage(error))
  }
}

async function markAllRead() {
  try {
    const supabase = requireSupabase()
    const { error } = await supabase.rpc('mark_all_notifications_read')
    if (error) throw error
    const unreadItems = notifications.value.filter((item) => !item.is_read)
    notifications.value = notifications.value.map((item) => ({
      ...item,
      is_read: true,
      read_at: new Date().toISOString(),
      read_type: 'bulk',
    }))
    await auth.loadUnreadNotifications()
    showToast('全部通知已标记为已读')
    for (const item of unreadItems) {
      await safeInsertAuditLog({
        action: 'notification.read',
        entityType: 'notification',
        entityId: item.id,
        details: {
          notification_title: item.title,
          read_type: 'bulk',
        },
      })
    }
  } catch (error) {
    showToast(getErrorMessage(error))
  }
}

function buildSnippet(content) {
  return String(content || '').replace(/\s+/g, ' ').trim().slice(0, 88) || '暂无详情内容。'
}

function safeLink(link) {
  return normalizeSafeLink(link)
}

function openLink() {
  const link = safeLink(activeNotification.value?.link)
  if (!link) return
  if (isExternalLink(link)) {
    window.open(link, '_blank', 'noopener,noreferrer')
    return
  }
  router.push(link)
}

function goActor(item) {
  if (item.actor_uid) {
    router.push(`/user/H${String(item.actor_uid).padStart(3, '0')}`)
  }
}

function goSubmission(item) {
  if (item.link) {
    router.push(item.link)
  }
}

function renderNotificationContent(content) {
  if (!content) return ''
  let html = String(content).replace(/\n/g, '<br/>')
  html = html.replace(/\[img:([a-zA-Z0-9-]+)\]/g, (match, slug) => {
    const img = galleryStore.images.find((i) => i.slug === slug)
    if (img) {
      return `<a href="${img.image_url}" target="_blank" rel="noopener noreferrer"><img class="notification-inline-image" src="${img.image_url}" alt="${img.title}" style="max-width:100%;max-height:300px;border-radius:12px;margin:8px 0;cursor:zoom-in" /></a>`
    }
    return `<span class="notification-image-placeholder" style="color:#8a9aaa;font-size:12px">[图片:${slug}]</span>`
  })
  return sanitizeHtml(html, { ADD_ATTR: ['style', 'target', 'rel'] })
}

function typeLabel(type) {
  return ({
    SYSTEM: '系统通知',
    SUBMISSION_CREATED: '新投稿',
    SUBMISSION_PUBLISHED: '审核通过',
    SUBMISSION_REJECTED: '审核驳回',
    COMMENT_CREATED: '新评论',
    ANNOUNCEMENT: '管理公告',
    ROLE_CHANGED: '账号变更',
    ACCOUNT_UPDATED: '账户更新',
    IMAGE_DELETED: '图片删除',
  }[type] || type)
}

function typeClass(type) {
  return ({
    SYSTEM: 'system',
    SUBMISSION_CREATED: 'submission',
    SUBMISSION_PUBLISHED: 'success',
    SUBMISSION_REJECTED: 'error',
    COMMENT_CREATED: 'comment',
    ANNOUNCEMENT: 'announcement',
    ROLE_CHANGED: 'role',
    ACCOUNT_UPDATED: 'account',
    IMAGE_DELETED: 'deleted',
  }[type] || 'default')
}
</script>

<style scoped>
.notifications-page { display: grid; gap: 18px; }
.notification-plugin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}
.notification-center-card { overflow: hidden; }
.notification-center-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.notification-summary-chip {
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(103, 80, 164, 0.08);
  color: #4c1d95;
  display: inline-flex;
  gap: 8px;
  align-items: center;
}
.notification-layout {
  display: grid;
  grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
  gap: 24px;
  margin-top: 18px;
}
.notification-list-pane,
.notification-detail-pane {
  min-height: 420px;
}
.notification-list {
  display: grid;
  gap: 10px;
  max-height: 72vh;
  overflow: auto;
  padding-right: 4px;
}
.notification-item__snippet {
  margin: 10px 0 0;
  font-size: 13px;
  color: #64748b;
  line-height: 1.45;
}
.notification-detail-shell {
  min-height: 100%;
  padding: 20px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.7);
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.14);
}
.notification-detail-shell__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}
.notification-detail-shell__content {
  margin-top: 18px;
}
.notification-pane-empty { min-height: 260px; }
.notification-mobile-switcher {
  display: none;
  margin-top: 18px;
  padding: 4px;
  border-radius: 16px;
  background: rgba(17, 24, 39, 0.05);
}
.notification-mobile-switcher__btn {
  flex: 1;
  border: none;
  background: transparent;
  border-radius: 12px;
  min-height: 40px;
  font-weight: 600;
  color: #64748b;
}
.notification-mobile-switcher__btn--active {
  background: #fff;
  color: #6750a4;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

@media (max-width: 768px) {
  .notification-mobile-switcher { display: flex; }
  .notification-layout { grid-template-columns: 1fr; }
  .notification-layout--mobile-detail .notification-list-pane { display: none; }
  .notification-layout--mobile-list .notification-detail-pane { display: none; }
  .notification-list { max-height: none; }
  .notification-detail-shell { padding: 0; background: transparent; box-shadow: none; }
}
</style>
