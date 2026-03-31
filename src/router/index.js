import { createRouter, createWebHistory } from 'vue-router'
import { pinia } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import { canAccess } from '@/lib/access'
import { coreRoutes, fallbackRoutes } from '@/router/coreRoutes'

const routes = [
  ...coreRoutes,
  ...fallbackRoutes,
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.name === 'admin-plugins' && from.name === 'admin-plugins') {
      return false
    }
    return { top: 0, behavior: 'smooth' }
  },
})

router.beforeEach(async (to) => {
  const auth = useAuthStore(pinia)
  await auth.init()
  if (auth.passwordRecoveryError && to.name !== 'login') {
    auth.passwordRecoveryError = false
    return { name: 'login', query: { recoveryError: '1' } }
  }
  if (auth.passwordRecoveryMode && to.name !== 'reset-password') {
    return { name: 'reset-password' }
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
  if (!canAccess(to.meta, auth)) {
    return { name: 'home' }
  }
  return true
})

export default router
