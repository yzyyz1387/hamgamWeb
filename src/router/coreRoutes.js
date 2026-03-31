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
import UserProfilePage from '@/pages/UserProfilePage.vue'
import AdminImagesPage from '@/pages/AdminImagesPage.vue'
import TeamPage from '@/pages/TeamPage.vue'
import AdminPluginsPage from '@/pages/AdminPluginsPage.vue'

export const coreRoutes = [
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
    path: '/admin/plugins/:pluginId?',
    name: 'admin-plugins',
    component: AdminPluginsPage,
    meta: {
      requiresAuth: true,
      roles: ['SUPER_ADMIN'],
      capabilities: ['plugin.manage'],
    },
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
  { path: '/reset-password', name: 'reset-password', component: ResetPasswordPage },
  { path: '/user/:uid', name: 'user-profile', component: UserProfilePage },
  { path: '/admin/images', name: 'admin-images', component: AdminImagesPage, meta: { requiresAuth: true, roles: ['SUPER_ADMIN'] } },
  { path: '/team', name: 'team', component: TeamPage },
]

export const fallbackRoutes = [
  {
    path: '/:legacyPath(.*)*',
    name: 'legacy-redirect',
    component: LegacyRedirectPage,
  },
]
