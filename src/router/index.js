import { createRouter, createWebHashHistory } from 'vue-router'
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
import AdminDashboardPage from '@/pages/AdminDashboardPage.vue'
import AdminSubmissionsPage from '@/pages/AdminSubmissionsPage.vue'
import AdminUsersPage from '@/pages/AdminUsersPage.vue'
import AdminAnnouncementsPage from '@/pages/AdminAnnouncementsPage.vue'
import AdminNotificationsPage from '@/pages/AdminNotificationsPage.vue'
import LegacyRedirectPage from '@/pages/LegacyRedirectPage.vue'
import SearchPage from '@/pages/SearchPage.vue'
import UserProfilePage from '@/pages/UserProfilePage.vue'
import AdminFriendLinksPage from '@/pages/AdminFriendLinksPage.vue'
import CallsignApplyPage from '@/pages/CallsignApplyPage.vue'
import AdminCallsignPage from '@/pages/AdminCallsignPage.vue'
import AdminImagesPage from '@/pages/AdminImagesPage.vue'
import TeamPage from '@/pages/TeamPage.vue'

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
  { path: '/user/:uid', name: 'user-profile', component: UserProfilePage },
  { path: '/admin/friend-links', name: 'admin-friend-links', component: AdminFriendLinksPage, meta: { requiresAuth: true, roles: ['SUPER_ADMIN'] } },
  { path: '/callsign-apply', name: 'callsign-apply', component: CallsignApplyPage, meta: { requiresAuth: true } },
  { path: '/admin/callsign', name: 'admin-callsign', component: AdminCallsignPage, meta: { requiresAuth: true, roles: ['SUPER_ADMIN'] } },
  { path: '/admin/images', name: 'admin-images', component: AdminImagesPage, meta: { requiresAuth: true, roles: ['SUPER_ADMIN'] } },
  { path: '/team', name: 'team', component: TeamPage },
  {
    path: '/:legacyPath(.*)*',
    name: 'legacy-redirect',
    component: LegacyRedirectPage,
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() {
    return { top: 0, behavior: 'smooth' }
  },
})

router.beforeEach(async (to) => {
  const auth = useAuthStore(pinia)
  await auth.init()
  if (to.meta.guestOnly && auth.isLoggedIn) {
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
