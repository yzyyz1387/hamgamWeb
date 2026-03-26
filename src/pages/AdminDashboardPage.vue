<template>
  <section class="page">
    <mdui-card class="section-card">
      <div class="section-card__header">
        <div>
          <div class="eyebrow">后台总览</div>
          <h1>审核 / 用户 / 公告 / 通知统一入口</h1>
          <p class="muted">审核员可以处理投稿，超级管理员额外拥有用户管理、图片显示控制、呼号审核、日志审计和公告发布权限。</p>
        </div>
      </div>
    </mdui-card>

    <div class="stats-grid admin-dashboard-stats">
      <div class="stat-card">
        <strong>{{ stats.images }}</strong>
        <span>已发布图片</span>
      </div>
      <div class="stat-card">
        <strong>{{ stats.pending }}</strong>
        <span>待审核投稿</span>
      </div>
      <div class="stat-card">
        <strong>{{ stats.pendingCallsigns }}</strong>
        <span>待审核呼号</span>
      </div>
      <div class="stat-card">
        <strong>{{ stats.users }}</strong>
        <span>用户数量</span>
      </div>
    </div>

    <div class="admin-grid admin-grid--dashboard-stack">
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
            v-if="auth.isSuperAdmin"
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
          <mdui-button v-if="auth.isSuperAdmin" variant="text" @click="router.push('/admin/friend-links')">友情链接</mdui-button>
        </div>
      </mdui-card>

      <mdui-card class="section-card">
        <div class="section-card__header">
          <div>
            <div class="eyebrow">最近待审</div>
            <h2>{{ recentSubmissions.length }} 条</h2>
          </div>
        </div>
        <div v-if="recentSubmissions.length" class="list-panel">
          <article v-for="item in recentSubmissions" :key="item.id" class="list-item-card">
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
        <div v-else class="empty-state">当前没有待审核投稿。</div>
      </mdui-card>
    </div>

    <AdminAuditLogPanel v-if="auth.isSuperAdmin"></AdminAuditLogPanel>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatDate } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'
import { showToast } from '@/lib/toast'
import { requireSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import AdminAuditLogPanel from '@/components/AdminAuditLogPanel.vue'

const router = useRouter()
const auth = useAuthStore()

const stats = reactive({ images: 0, pending: 0, pendingCallsigns: 0, users: 0 })
const recentSubmissions = ref([])

onMounted(loadDashboard)

async function loadDashboard() {
  try {
    const supabase = requireSupabase()
    const requests = [
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
    ]

    const [imagesRes, pendingRes, usersRes, callsignRes, submissionsRes] = await Promise.all(requests)

    if (imagesRes.error) throw imagesRes.error
    if (pendingRes.error) throw pendingRes.error
    if (usersRes.error) throw usersRes.error
    if (callsignRes?.error) throw callsignRes.error
    if (submissionsRes.error) throw submissionsRes.error

    stats.images = imagesRes.count || 0
    stats.pending = pendingRes.count || 0
    stats.users = usersRes.count || 0
    stats.pendingCallsigns = callsignRes?.count || 0
    recentSubmissions.value = submissionsRes.data || []
  } catch (error) {
    showToast(getErrorMessage(error))
  }
}
</script>
