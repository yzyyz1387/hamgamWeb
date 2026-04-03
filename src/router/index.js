import { createRouter, createWebHistory } from 'vue-router'
import { pinia } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import HomePage from '@/pages/HomePage.vue'
import RandomPage from '@/pages/RandomPage.vue'
import ImageDetailPage from '@/pages/ImageDetailPage.vue'
import LoginPage from '@/pages/LoginPage.vue'
import RegisterPage from '@/pages/RegisterPage.vue'
import ProfilePage from '@/pages/ProfilePage.vue'
import SubmitPage from '@/pages/SubmitPage.vue'
import NotificationsPage from '@/pages/NotificationsPage.vue'
import MySubmissionsPage from '@/pages/MySubmissionsPage.vue'
import AdminDashboardPage from '@/pages/AdminDashboardPage.vue'
import AdminSubmissionsPage from '@/pages/AdminSubmissionsPage.vue'
import AdminUsersPage from '@/pages/AdminUsersPage.vue'
import AdminAnnouncementsPage from '@/pages/AdminAnnouncementsPage.vue'
import AdminNotificationsPage from '@/pages/AdminNotificationsPage.vue'
import LegacyRedirectPage from '@/pages/LegacyRedirectPage.vue'
import SearchPage from '@/pages/SearchPage.vue'
import ResetPasswordPage from '@/pages/ResetPasswordPage.vue'
import AuthCallbackPage from '@/pages/AuthCallbackPage.vue'
import UserProfilePage from '@/pages/UserProfilePage.vue'
import AdminFriendLinksPage from '@/pages/AdminFriendLinksPage.vue'
import CallsignApplyPage from '@/pages/CallsignApplyPage.vue'
import AdminCallsignPage from '@/pages/AdminCallsignPage.vue'
import AdminImagesPage from '@/pages/AdminImagesPage.vue'
import TeamPage from '@/pages/TeamPage.vue'
import AdminHashProcessorPage from '@/pages/AdminHashProcessorPage.vue'
import AdminPluginsPage from '@/pages/AdminPluginsPage.vue'
import AdminFeedbackPage from '@/pages/AdminFeedbackPage.vue'

const routes = [
  { path: '/', name: 'home', component: HomePage },
  { path: '/random', name: 'random', component: RandomPage },
  { path: '/image/:slug', name: 'image-detail', component: ImageDetailPage },
  { path: '/login', name: 'login', component: LoginPage, meta: { guestOnly: true } },
  { path: '/register', name: 'register', component: RegisterPage, meta: { guestOnly: true } },
  { path: '/profile', name: 'profile', component: ProfilePage, meta: { requiresAuth: true } },
  { path: '/submit', name: 'submit', component: SubmitPage, meta: { requiresAuth: true } },
  {
    path: '/notifications',
    name: 'notifications',
    component: NotificationsPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/my-submissions',
    name: 'my-submissions',
    component: MySubmissionsPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/admin',
    name: 'admin-dashboard',
    component: AdminDashboardPage,
    meta: { requiresAuth: true, roles: ['SUPER_ADMIN', 'REVIEWER'] },
  },
  {
    path: '/admin/submissions',
    name: 'admin-submissions',
    component: AdminSubmissionsPage,
    meta: { requiresAuth: true, roles: ['SUPER_ADMIN', 'REVIEWER'] },
  },
  {
    path: '/admin/users',
    name: 'admin-users',
    component: AdminUsersPage,
    meta: { requiresAuth: true, roles: ['SUPER_ADMIN'] },
  },
  {
    path: '/admin/announcements',
    name: 'admin-announcements',
    component: AdminAnnouncementsPage,
    meta: { requiresAuth: true, roles: ['SUPER_ADMIN'] },
  },
  {
    path: '/admin/notifications',
    name: 'admin-notifications',
    component: AdminNotificationsPage,
    meta: { requiresAuth: true, roles: ['SUPER_ADMIN'] },
  },
  { path: '/search', name: 'search', component: SearchPage },
  { path: '/auth/callback', name: 'auth-callback', component: AuthCallbackPage, meta: { public: true } },
  { path: '/auth/confirm', name: 'auth-confirm', component: AuthCallbackPage, meta: { public: true } },
  { path: '/reset-password', name: 'reset-password', component: ResetPasswordPage },
  { path: '/user/:uid', name: 'user-profile', component: UserProfilePage },
  { path: '/admin/friend-links', name: 'admin-friend-links', component: AdminFriendLinksPage, meta: { requiresAuth: true, roles: ['SUPER_ADMIN'] } },
  { path: '/callsign-apply', name: 'callsign-apply', component: CallsignApplyPage, meta: { requiresAuth: true } },
  { path: '/admin/callsign', name: 'admin-callsign', component: AdminCallsignPage, meta: { requiresAuth: true, roles: ['SUPER_ADMIN'] } },
  { path: '/admin/images', name: 'admin-images', component: AdminImagesPage, meta: { requiresAuth: true, roles: ['SUPER_ADMIN'] } },
  { path: '/team', name: 'team', component: TeamPage },
  {
    path: '/admin/hash-processor',
    name: 'admin-hash-processor',
    component: AdminHashProcessorPage,
    meta: { requiresAuth: true, roles: ['SUPER_ADMIN'] },
  },
  {
    path: '/admin/plugins/:pluginId?',
    name: 'admin-plugins',
    component: AdminPluginsPage,
    meta: { requiresAuth: true, roles: ['SUPER_ADMIN'], capabilities: ['plugin.manage'] },
  },
  {
    path: '/admin/feedback',
    name: 'admin-feedback',
    component: AdminFeedbackPage,
    meta: { requiresAuth: true, roles: ['SUPER_ADMIN'], capabilities: ['reviewer.manage'] },
  },
  {
    path: '/:legacyPath(.*)*',
    name: 'legacy-redirect',
    component: LegacyRedirectPage,
  },
]


function hasIncomingAuthParams(to) {
  const query = to.query || {}
  if (query.code || query.token_hash || query.tokenHash || query.error_code) return true
  if (typeof window === 'undefined') return false
  const rawHash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
  if (!rawHash) return false
  const hash = rawHash.startsWith('/') ? rawHash.slice(rawHash.indexOf('?') + 1) : rawHash
  const params = new URLSearchParams(hash)
  return Boolean(params.get('access_token') || params.get('refresh_token') || params.get('type') || params.get('flow'))
}

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0, behavior: 'smooth' }
  },
})

router.beforeEach(async (to) => {
  const auth = useAuthStore(pinia)
  await auth.init()
  
  if (to.meta.public) {
    return true
  }
  
  if (auth.passwordRecoveryError && !['login', 'auth-callback', 'auth-confirm', 'reset-password', 'admin-plugins', 'admin-feedback'].includes(String(to.name || ''))) {
    auth.passwordRecoveryError = false
    return { name: 'login', query: { recoveryError: '1' } }
  }
  if (auth.passwordRecoveryMode && !['reset-password', 'auth-callback', 'auth-confirm'].includes(String(to.name || ''))) {
    return { name: 'reset-password' }
  }
  if (to.meta.guestOnly && hasIncomingAuthParams(to)) {
    return true
  }
  if (to.meta.guestOnly && auth.isLoggedIn && !auth.passwordRecoveryMode) {
    return { name: 'profile' }
  }
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    }
  }
  if (to.meta.roles && !to.meta.roles.includes(auth.role)) {
    return { name: 'home' }
  }
  return true
})

export default router
