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
          <mdui-button variant="text" @click="markAllRead">全部已读</mdui-button>
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

          <div class="rich-text" v-html="textToHtml(activeNotification.content)"></div>

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
import { formatDate, textToHtml, timeAgo } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'
import { normalizeSafeLink, isExternalLink } from '@/lib/safeLink'
import { showToast } from '@/lib/toast'
import { requireSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

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
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error
    notifications.value = data || []
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
    await auth.loadUnreadNotifications()
  } catch (error) {
    showToast(getErrorMessage(error))
  }
}

async function markAllRead() {
  try {
    const supabase = requireSupabase()
    const { error } = await supabase.rpc('mark_all_notifications_read')
    if (error) throw error
    notifications.value = notifications.value.map((item) => ({ ...item, is_read: true }))
    await auth.loadUnreadNotifications()
    showToast('全部通知已标记为已读')
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
  if (item.actor_id) {
    router.push(`/user/${item.actor_id}`)
  }
}

function goSubmission(item) {
  if (item.link) {
    router.push(item.link)
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
    }[type] || 'default'
  )
}
</script>
