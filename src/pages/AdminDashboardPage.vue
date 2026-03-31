<template>
  <section class="page">
    <mdui-card class="section-card">
      <div class="section-card__header">
        <div>
          <div class="eyebrow">后台总览</div>
          <h1>审核 / 用户 / 公告 / 通知统一入口</h1>
          <p class="muted">审核员可以处理投稿，超级管理员额外拥有用户管理、图片显示控制、呼号审核、日志审计和公告发布权限。</p>
        </div>
        <div class="dashboard-actions">
          <mdui-button variant="text" @click="refreshDashboard" :loading="loading">
            <mdui-icon slot="icon" name="refresh--rounded"></mdui-icon>
            刷新数据
          </mdui-button>
        </div>
      </div>
    </mdui-card>

    <AdminQuickActionStrip v-if="dashboardQuickActions.length" :actions="dashboardQuickActions" @run="runDashboardQuickAction" />

    <div class="stats-grid-enhanced">
      <StatCard
        :value="stats.images"
        label="已发布图片"
        icon="image--rounded"
        color="primary"
        :trend="trends.images"
        clickable
        @click="router.push('/')"
      />
      <StatCard
        :value="stats.pending"
        label="待审核投稿"
        icon="pending--rounded"
        color="warning"
        :trend="trends.pending"
        clickable
        @click="router.push('/admin/submissions')"
      />
      <StatCard
        v-if="callsignPluginEnabled"
        :value="stats.pendingCallsigns"
        label="待审核呼号"
        icon="settings_input_antenna--rounded"
        color="info"
        clickable
        @click="router.push('/admin/callsign')"
      />
      <StatCard
        :value="stats.users"
        label="注册用户"
        icon="people--rounded"
        color="success"
        :trend="trends.users"
        clickable
        @click="router.push('/admin/users')"
      />
    </div>

    <div class="charts-grid">
      <LineChart
        title="投稿趋势（近7天）"
        :labels="chartLabels"
        :datasets="submissionChartDatasets"
      />
      <LineChart
        title="用户增长（近7天）"
        :labels="chartLabels"
        :datasets="userChartDatasets"
      />
    </div>

    <section v-if="dashboardWidgets.length" class="dashboard-section">
      <div class="dashboard-section__header">
        <div>
          <div class="eyebrow">插件面板</div>
          <h2>插件可插入后台总览</h2>
        </div>
        <div class="muted">{{ dashboardWidgets.length }} 个已启用面板</div>
      </div>
      <div class="dashboard-widget-grid">
        <component
          :is="widget.component"
          v-for="widget in dashboardWidgets"
          :key="widget.id"
          :config="widget.config"
          :plugin="widget"
          :refresh-key="widgetRefreshKey"
          class="dashboard-widget-grid__item"
          :class="[`dashboard-widget-grid__item--${widget.span || 'md'}`]"
        />
      </div>
    </section>

    <div class="dashboard-workbench-grid">
      <div class="dashboard-workbench-main">
        <mdui-card class="section-card">
          <div class="section-card__header">
            <div>
              <div class="eyebrow">快捷入口</div>
              <h2>管理动作</h2>
            </div>
          </div>
          <div class="action-row">
            <mdui-button variant="filled" @click="router.push('/admin/submissions')">
              处理投稿
              <span v-if="stats.pending" class="inline-badge">{{ stats.pending }}</span>
            </mdui-button>
            <mdui-button
              v-if="auth.isSuperAdmin && callsignPluginEnabled"
              variant="filled-tonal"
              @click="router.push('/admin/callsign')"
            >
              呼号审核
              <span v-if="stats.pendingCallsigns" class="inline-badge">{{ stats.pendingCallsigns }}</span>
            </mdui-button>
            <mdui-button v-if="auth.isSuperAdmin" variant="filled-tonal" @click="router.push('/admin/images')">
              图片管理
            </mdui-button>
            <mdui-button v-if="auth.isSuperAdmin" variant="filled-tonal" @click="router.push('/admin/announcements')">
              管理公告
            </mdui-button>
            <mdui-button v-if="auth.isSuperAdmin" variant="filled-tonal" @click="router.push('/admin/notifications')">
              发送通知
            </mdui-button>
            <mdui-button v-if="auth.isSuperAdmin" variant="text" @click="router.push('/admin/users')">管理用户</mdui-button>
            <mdui-button v-if="auth.isSuperAdmin && friendLinksPluginEnabled" variant="text" @click="router.push('/admin/friend-links')">友情链接</mdui-button>
          </div>
        </mdui-card>

        <mdui-card class="section-card">
          <div class="section-card__header">
            <div>
              <div class="eyebrow">最近待审</div>
              <h2>{{ recentSubmissions.length }} 条</h2>
            </div>
            <mdui-button v-if="stats.pending > 5" variant="text" @click="router.push('/admin/submissions')">
              查看全部
            </mdui-button>
          </div>
          <div v-if="recentSubmissions.length" class="list-panel">
            <article v-for="item in recentSubmissions" :key="item.id" class="list-item-card list-item-card--clickable" @click="router.push('/admin/submissions')">
              <div class="list-item-card__head">
                <div>
                  <strong>{{ item.title }}</strong>
                  <div class="muted">
                    {{ item.uploader_display_name }} · {{ formatDate(item.created_at, { withTime: true }) }}
                  </div>
                </div>
                <span class="status-pill status-pill--pending">待审核</span>
              </div>
            </article>
          </div>
          <div v-else class="empty-state">
            <mdui-icon name="check_circle--rounded" style="font-size: 32px; color: #22c55e; margin-bottom: 8px"></mdui-icon>
            <p>当前没有待审核投稿</p>
          </div>
        </mdui-card>
      </div>

      <div class="dashboard-workbench-side">
        <mdui-card class="section-card community-pulse-card">
          <div class="section-card__header section-card__header--wrap">
            <div>
              <div class="eyebrow">社区动态</div>
              <h2>最近活跃用户</h2>
              <p class="muted">把最近资料更新的用户收纳成更紧凑的社区脉冲面板。</p>
            </div>
            <mdui-button v-if="auth.isSuperAdmin" variant="text" @click="router.push('/admin/users')">查看用户</mdui-button>
          </div>

          <div class="community-pulse-summary">
            <div class="community-pulse-metric">
              <strong>{{ activeUsers.length }}</strong>
              <span>最近活跃用户</span>
            </div>
            <div class="community-pulse-metric">
              <strong>{{ latestActiveUserLabel }}</strong>
              <span>最近一次资料更新</span>
            </div>
          </div>

          <div v-if="activeUsers.length" class="active-user-compact-grid">
            <button
              v-for="user in activeUsers"
              :key="user.id"
              type="button"
              class="active-user-compact-card"
              @click="goUser(user)"
            >
              <div class="active-user-compact-card__avatar">
                <img v-if="user.avatar_url" :src="user.avatar_url" alt="avatar" />
                <span v-else>{{ (user.nickname || 'U').slice(0, 1).toUpperCase() }}</span>
              </div>
              <div class="active-user-compact-card__info">
                <div class="active-user-compact-card__name-row">
                  <strong>{{ user.nickname || '未命名用户' }}</strong>
                  <span v-if="user.callsign" class="active-user-compact-card__callsign">{{ user.callsign }}</span>
                </div>
                <div class="active-user-compact-card__meta">{{ timeAgo(user.updated_at) }}</div>
              </div>
            </button>
          </div>
          <div v-else class="empty-state">暂无活跃用户数据</div>
        </mdui-card>
      </div>
    </div>

    <AdminAuditLogPanel v-if="auth.isSuperAdmin"></AdminAuditLogPanel>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { formatDate, timeAgo } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'
import { showToast } from '@/lib/toast'
import { requireSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { toUserProfilePath } from '@/lib/uid'
import AdminAuditLogPanel from '@/components/AdminAuditLogPanel.vue'
import AdminQuickActionStrip from '@/components/admin/AdminQuickActionStrip.vue'
import StatCard from '@/components/admin/StatCard.vue'
import LineChart from '@/components/admin/LineChart.vue'
import { getAdminDashboardWidgets, getAdminQuickActions, invokePluginAction, isPluginEnabled } from '@/plugins/runtime'

const router = useRouter()
const auth = useAuthStore()

const loading = ref(false)
const widgetRefreshKey = ref(0)
const stats = reactive({ images: 0, pending: 0, pendingCallsigns: 0, users: 0 })
const trends = reactive({ images: null, pending: null, users: null })
const recentSubmissions = ref([])
const activeUsers = ref([])
const chartData = reactive({
  submissions: { labels: [], pending: [], published: [], rejected: [] },
  users: { labels: [], newUsers: [] },
})

const chartLabels = computed(() => chartData.submissions.labels)
const callsignPluginEnabled = computed(() => isPluginEnabled('callsign-review'))
const friendLinksPluginEnabled = computed(() => isPluginEnabled('friend-links'))
const dashboardWidgets = computed(() =>
  getAdminDashboardWidgets({
    auth,
    router,
  }),
)

const coreDashboardQuickActions = computed(() => {
  const actions = [
    {
      id: 'dashboard-review-submissions',
      label: '处理投稿',
      description: '进入投稿审核队列',
      icon: 'task_alt--rounded',
      tone: 'primary',
      badge: stats.pending || null,
      to: '/admin/submissions',
    },
    auth.isSuperAdmin && callsignPluginEnabled.value ? {
      id: 'dashboard-review-callsigns',
      label: '呼号审核',
      description: '检查最近待处理申请',
      icon: 'settings_input_antenna--rounded',
      tone: 'secondary',
      badge: stats.pendingCallsigns || null,
      to: '/admin/callsign',
    } : null,
    auth.isSuperAdmin ? {
      id: 'dashboard-open-users',
      label: '管理用户',
      description: '查看活跃用户和资料状态',
      icon: 'people--rounded',
      tone: 'secondary',
      to: '/admin/users',
    } : null,
    auth.isSuperAdmin ? {
      id: 'dashboard-open-notifications',
      label: '发送通知',
      description: '打开通知中心与模板',
      icon: 'notifications_active--rounded',
      tone: 'secondary',
      to: '/admin/notifications',
    } : null,
  ]
  return actions.filter(Boolean)
})

const pluginDashboardQuickActions = computed(() =>
  getAdminQuickActions({
    target: 'admin-dashboard',
    auth,
    router,
    route: { path: '/admin' },
    stats,
  }),
)

const dashboardQuickActions = computed(() =>
  [...coreDashboardQuickActions.value, ...pluginDashboardQuickActions.value].sort((a, b) => (a.order || 0) - (b.order || 0)),
)

const latestActiveUserLabel = computed(() => {
  const latest = activeUsers.value[0]?.updated_at
  return latest ? timeAgo(latest) : '暂无'
})

const submissionChartDatasets = computed(() => [
  {
    label: '新投稿',
    data: chartData.submissions.pending,
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  {
    label: '已发布',
    data: chartData.submissions.published,
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  {
    label: '已驳回',
    data: chartData.submissions.rejected,
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
])

const userChartDatasets = computed(() => [
  {
    label: '新注册用户',
    data: chartData.users.newUsers,
    borderColor: '#6750a4',
    backgroundColor: 'rgba(103, 80, 164, 0.1)',
  },
])

onMounted(loadDashboard)

function getLast7DaysLabels() {
  const labels = []
  const today = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    labels.push(`${d.getMonth() + 1}/${d.getDate()}`)
  }
  return labels
}

function getDateRange(daysAgo = 0) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

async function loadDashboard() {
  loading.value = true
  try {
    const supabase = requireSupabase()

    const baseRequests = [
      supabase.from('images').select('id', { head: true, count: 'exact' }),
      supabase.from('submissions').select('id', { head: true, count: 'exact' }).eq('status', 'PENDING'),
      supabase.from('profiles').select('id', { head: true, count: 'exact' }),
      auth.isSuperAdmin
        ? supabase.from('callsign_applications').select('id', { head: true, count: 'exact' }).eq('status', 'PENDING')
        : Promise.resolve({ count: 0, error: null }),
      supabase
        .from('submissions')
        .select('id,title,uploader_display_name,created_at,status')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('profiles')
        .select('id, nickname, avatar_url, callsign, updated_at, uid')
        .order('updated_at', { ascending: false })
        .limit(6),
    ]

    const [imagesRes, pendingRes, usersRes, callsignRes, submissionsRes, usersListRes] = await Promise.all(baseRequests)

    if (imagesRes.error) throw imagesRes.error
    if (pendingRes.error) throw pendingRes.error
    if (usersRes.error) throw usersRes.error
    if (callsignRes?.error) throw callsignRes.error
    if (submissionsRes.error) throw submissionsRes.error
    if (usersListRes.error) throw usersListRes.error

    stats.images = imagesRes.count || 0
    stats.pending = pendingRes.count || 0
    stats.users = usersRes.count || 0
    stats.pendingCallsigns = callsignRes?.count || 0
    recentSubmissions.value = submissionsRes.data || []
    activeUsers.value = usersListRes.data || []

    if (auth.isSuperAdmin) {
      await loadChartData(supabase)
      await loadTrends(supabase)
    }
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function loadChartData(supabase) {
  const labels = getLast7DaysLabels()
  chartData.submissions.labels = labels
  chartData.users.labels = labels

  const pendingCounts = []
  const publishedCounts = []
  const rejectedCounts = []
  const newUserCounts = []

  for (let i = 6; i >= 0; i--) {
    const start = getDateRange(i)
    const end = getDateRange(i - 1)

    const [pendingRes, publishedRes, rejectedRes, newUsersRes] = await Promise.all([
      supabase.from('submissions').select('id', { head: true, count: 'exact' }).gte('created_at', start).lt('created_at', end || new Date().toISOString()),
      supabase.from('submissions').select('id', { head: true, count: 'exact' }).eq('status', 'PUBLISHED').gte('reviewed_at', start).lt('reviewed_at', end || new Date().toISOString()),
      supabase.from('submissions').select('id', { head: true, count: 'exact' }).eq('status', 'REJECTED').gte('reviewed_at', start).lt('reviewed_at', end || new Date().toISOString()),
      supabase.from('profiles').select('id', { head: true, count: 'exact' }).gte('created_at', start).lt('created_at', end || new Date().toISOString()),
    ])

    pendingCounts.push(pendingRes.count || 0)
    publishedCounts.push(publishedRes.count || 0)
    rejectedCounts.push(rejectedRes.count || 0)
    newUserCounts.push(newUsersRes.count || 0)
  }

  chartData.submissions.pending = pendingCounts
  chartData.submissions.published = publishedCounts
  chartData.submissions.rejected = rejectedCounts
  chartData.users.newUsers = newUserCounts
}

async function loadTrends(supabase) {
  const weekAgo = getDateRange(7)
  const twoWeeksAgo = getDateRange(14)

  const [thisWeekImages, lastWeekImages, thisWeekUsers, lastWeekUsers] = await Promise.all([
    supabase.from('images').select('id', { head: true, count: 'exact' }).gte('published_at', weekAgo),
    supabase.from('images').select('id', { head: true, count: 'exact' }).gte('published_at', twoWeeksAgo).lt('published_at', weekAgo),
    supabase.from('profiles').select('id', { head: true, count: 'exact' }).gte('created_at', weekAgo),
    supabase.from('profiles').select('id', { head: true, count: 'exact' }).gte('created_at', twoWeeksAgo).lt('created_at', weekAgo),
  ])

  trends.images = calculateTrend(thisWeekImages.count, lastWeekImages.count)
  trends.users = calculateTrend(thisWeekUsers.count, lastWeekUsers.count)
}

function calculateTrend(thisWeek, lastWeek) {
  if (!lastWeek) return thisWeek > 0 ? 100 : 0
  return Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
}

function refreshDashboard() {
  widgetRefreshKey.value += 1
  loadDashboard()
}

async function runDashboardQuickAction(action) {
  if (!action) return
  if (action.pluginId) {
    try {
      await invokePluginAction(action, { auth, router, stats, showToast })
    } catch (error) {
      showToast(getErrorMessage(error))
    }
    return
  }
  if (typeof action.onClick === 'function') {
    await action.onClick({ auth, router, stats })
    return
  }
  if (action.to) router.push(action.to)
}

function goUser(user) {
  if (user.uid) {
    const path = toUserProfilePath(user.uid)
    if (path) router.push(path)
  }
}
</script>

<style scoped>
.dashboard-actions {
  display: flex;
  gap: 8px;
}

.stats-grid-enhanced {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}

.dashboard-section {
  margin-bottom: 20px;
}

.dashboard-section__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  margin-bottom: 14px;
}

.dashboard-section__header h2 {
  margin: 2px 0 0;
}

.dashboard-widget-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 16px;
}

.dashboard-widget-grid__item {
  min-width: 0;
}

.dashboard-widget-grid__item--md {
  grid-column: span 4;
}

.dashboard-widget-grid__item--lg {
  grid-column: span 8;
}

.dashboard-workbench-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.95fr);
  gap: 20px;
  align-items: start;
}

.dashboard-workbench-main,
.dashboard-workbench-side {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.list-item-card--clickable {
  cursor: pointer;
  transition: background 0.15s;
}

.list-item-card--clickable:hover {
  background: rgba(103, 80, 164, 0.04);
}

.community-pulse-card {
  position: sticky;
  top: 88px;
}

.community-pulse-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.community-pulse-metric {
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(103, 80, 164, 0.06);
  border: 1px solid rgba(103, 80, 164, 0.08);
}

.community-pulse-metric strong {
  display: block;
  font-size: 20px;
  color: #18222c;
}

.community-pulse-metric span {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.active-user-compact-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.active-user-compact-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(24, 34, 44, 0.08);
  background: #fff;
  cursor: pointer;
  text-align: left;
  transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
}

.active-user-compact-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(17, 24, 39, 0.08);
  border-color: rgba(103, 80, 164, 0.18);
}

.active-user-compact-card__avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(103, 80, 164, 0.1);
  color: #6750a4;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  overflow: hidden;
  flex-shrink: 0;
}

.active-user-compact-card__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.active-user-compact-card__info {
  flex: 1;
  min-width: 0;
}

.active-user-compact-card__name-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.active-user-compact-card__name-row strong {
  color: #18222c;
  min-width: 0;
}

.active-user-compact-card__meta {
  margin-top: 4px;
  font-size: 12px;
  color: #8a9aaa;
}

.active-user-compact-card__callsign {
  font-size: 11px;
  font-weight: 600;
  color: #6750a4;
  background: rgba(103, 80, 164, 0.08);
  padding: 2px 8px;
  border-radius: 999px;
}

@media (max-width: 1200px) {
  .dashboard-widget-grid__item--md {
    grid-column: span 6;
  }

  .dashboard-widget-grid__item--lg {
    grid-column: span 12;
  }

  .dashboard-workbench-grid {
    grid-template-columns: 1fr;
  }

  .community-pulse-card {
    position: static;
  }
}

@media (max-width: 900px) {
  .stats-grid-enhanced {
    grid-template-columns: repeat(2, 1fr);
  }

  .charts-grid {
    grid-template-columns: 1fr;
  }

  .dashboard-widget-grid__item--md,
  .dashboard-widget-grid__item--lg {
    grid-column: span 12;
  }
}

@media (max-width: 560px) {
  .stats-grid-enhanced {
    grid-template-columns: 1fr;
  }

  .community-pulse-summary {
    grid-template-columns: 1fr;
  }
}
</style>
