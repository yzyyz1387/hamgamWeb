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
            :class="{ 'notification-item--active': item.id === activeNotification?.id }"
            @click="selectNotification(item)"
          >
            <div class="list-item-card__head">
              <div>
                <strong>{{ item.title }}</strong>
                <div class="muted">{{ timeAgo(item.created_at) }}</div>
              </div>
              <mdui-chip v-if="!item.is_read">未读</mdui-chip>
            </div>
            <div class="muted">{{ item.content }}</div>
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
              <p class="muted">{{ formatDate(activeNotification.created_at, { withTime: true }) }}</p>
            </div>
            <mdui-chip>{{ typeLabel(activeNotification.type) }}</mdui-chip>
          </div>

          <div class="rich-text" v-html="textToHtml(activeNotification.content)"></div>

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

function typeLabel(type) {
  return (
    {
      SYSTEM: '系统消息',
      SUBMISSION_CREATED: '新投稿',
      SUBMISSION_PUBLISHED: '审核通过',
      SUBMISSION_REJECTED: '审核驳回',
      COMMENT_CREATED: '新评论',
      ANNOUNCEMENT: '系统公告',
      ROLE_CHANGED: '账号变更',
      ACCOUNT_UPDATED: '账户信息更新',
    }[type] || type
  )
}
</script>
