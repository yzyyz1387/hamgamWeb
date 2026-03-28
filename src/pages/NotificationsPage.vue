<template>
  <section class="page">
    <div class="split-view">
      <aside class="split-sidebar">
        <div class="section-card__header">
          <div>
            <div class="eyebrow">通知中心</div>
            <h2>{{ notifications.length }} 条通知</h2>
            <p class="muted">点击通知查看详情，支持单条已读和一键全部已读。</p>
          </div>
          <div class="notification-header-actions">
            <mdui-button variant="text" @click="markAllRead">全部已读</mdui-button>
          </div>
        </div>

        <div v-if="loading" class="empty-state">
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
                  <span class="notification-type-badge" :class="`notification-type-badge--${typeClass(item.type)}`">
                    {{ typeLabel(item.type) }}
                  </span>
                  <span v-if="item.actor_display_name" class="notification-actor">
                    来自 <button type="button" class="actor-link" @click.stop="goActor(item)">{{ item.actor_display_name }}</button>
                  </span>
                  <span class="notification-time">{{ timeAgo(item.created_at) }}</span>
                </div>
              </div>
              <span v-if="!item.is_read" class="unread-dot"></span>
            </div>
          </article>
        </div>

        <div v-else class="empty-state">当前没有通知。</div>
      </aside>

      <div class="split-content">
        <div v-if="activeNotification">
          <div class="section-card__header">
            <div>
              <div class="eyebrow">通知详情</div>
              <h2>{{ activeNotification.title }}</h2>
              <div class="notification-detail-meta">
                <span class="notification-type-badge" :class="`notification-type-badge--${typeClass(activeNotification.type)}`">
                  {{ typeLabel(activeNotification.type) }}
                </span>
                <span>{{ formatDate(activeNotification.created_at, { withTime: true }) }}</span>
                <span v-if="activeNotification.actor_display_name">
                  来自 <button type="button" class="actor-link" @click="goActor(activeNotification)">{{ activeNotification.actor_display_name }}</button>
                </span>
              </div>
            </div>
          </div>

          <div class="rich-text" v-html="renderNotificationContent(activeNotification.content)"></div>

          <div v-if="activeNotification.metadata?.submission_title" class="notification-submission-info">
            <strong>投稿内容：</strong>
            <button type="button" class="submission-link" @click="goSubmission(activeNotification)">
              {{ activeNotification.metadata.submission_title }}
            </button>
          </div>

          <div class="action-row" style="margin-top: 20px">
            <mdui-button v-if="safeLink(activeNotification.link)" variant="filled" @click="openLink">
              打开关联页面
            </mdui-button>
            <mdui-button variant="text" @click="loadNotifications">刷新列表</mdui-button>
          </div>
        </div>

        <div v-else class="empty-state">从左侧选择一条通知查看详细内容。</div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatDate, textToHtml, timeAgo, sanitizeHtml } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'
import { normalizeSafeLink, isExternalLink } from '@/lib/safeLink'
import { showToast } from '@/lib/toast'
import { requireSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useGalleryStore } from '@/stores/gallery'
import { safeInsertAuditLog } from '@/lib/audit'

const router = useRouter()
const auth = useAuthStore()
const galleryStore = useGalleryStore()

const notifications = ref([])
const loading = ref(false)
const selectedId = ref('')

const activeNotification = computed(
  () => notifications.value.find((item) => item.id === selectedId.value) || notifications.value[0] || null,
)

onMounted(async () => {
  await auth.init()
  await loadNotifications()
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
    notifications.value = (data || []).map(n => ({
      ...n,
      actor_uid: n.actor?.uid || null
    }))
    if (!selectedId.value && notifications.value[0]) {
      await selectNotification(notifications.value[0])
    }
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function selectNotification(item) {
  selectedId.value = item.id
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
  let html = content.replace(/\n/g, '<br/>')
  html = html.replace(/\[img:([a-zA-Z0-9-]+)\]/g, (match, slug) => {
    const img = galleryStore.images.find(i => i.slug === slug)
    if (img) {
      return `<img class="notification-inline-image" src="${img.image_url}" alt="${img.title}" style="max-width:100%;max-height:300px;border-radius:12px;margin:8px 0;cursor:zoom-in" @click="openImage('${img.image_url}')" />`
    }
    return `<span class="notification-image-placeholder" style="color:#8a9aaa;font-size:12px">[图片:${slug}]</span>`
  })
  return sanitizeHtml(html, { ADD_ATTR: ['style', '@click'] })
}

function openImage(url) {
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

function typeLabel(type) {
  return (
    {
      SYSTEM: '系统通知',
      SUBMISSION_CREATED: '新投稿',
      SUBMISSION_PUBLISHED: '审核通过',
      SUBMISSION_REJECTED: '审核驳回',
      COMMENT_CREATED: '新评论',
      ANNOUNCEMENT: '管理公告',
      ROLE_CHANGED: '账号变更',
      ACCOUNT_UPDATED: '账户更新',
      IMAGE_DELETED: '图片删除',
    }[type] || type
  )
}

function typeClass(type) {
  return (
    {
      SYSTEM: 'system',
      SUBMISSION_CREATED: 'submission',
      SUBMISSION_PUBLISHED: 'success',
      SUBMISSION_REJECTED: 'error',
      COMMENT_CREATED: 'comment',
      ANNOUNCEMENT: 'announcement',
      ROLE_CHANGED: 'role',
      ACCOUNT_UPDATED: 'account',
      IMAGE_DELETED: 'deleted',
    }[type] || 'default'
  )
}

async function sendNotificationToUser() {
  const uidInput = sendTargetUid.value.trim()
  const title = sendNotificationTitle.value.trim()
  const content = sendNotificationContent.value.trim()
  
  if (!uidInput || !title || !content) return
  
  sendingNotification.value = true
  try {
    const supabase = requireSupabase()
    
    const targetUid = parsePublicUid(uidInput)
    if (!targetUid) {
      showToast('无效的用户ID格式')
      return
    }
    
    const { data: targetUser, error: userError } = await supabase
      .from('user_profiles')
      .select('user_id, nickname')
      .eq('uid', targetUid)
      .single()
    
    if (userError || !targetUser) {
      showToast('找不到该用户')
      return
    }
    
    const { error } = await supabase.from('notifications').insert({
      user_id: targetUser.user_id,
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
      entityId: targetUser.user_id,
      details: {
        target_user_id: targetUser.user_id,
        target_user_name: targetUser.nickname,
        notification_title: title,
      },
    })
    
    showToast('通知已发送')
    showSendNotification.value = false
    sendTargetUid.value = ''
    sendNotificationTitle.value = ''
    sendNotificationContent.value = ''
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    sendingNotification.value = false
  }
}
</script>
