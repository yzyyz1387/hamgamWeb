<template>
  <div class="app-shell" @contextmenu="onContextMenu">
    <header class="app-shell__header">
      <div class="app-shell__topbar container">
        <div class="app-shell__brand" @click="goTo('/')">{{ siteConfig.name }}</div>
        <nav class="app-shell__actions">
          <div class="nav-desktop-group">
            <mdui-tooltip content="主页" placement="bottom">
              <button class="nav-icon-btn" @click="goTo('/')">
                <mdui-icon name="home--rounded"></mdui-icon>
              </button>
            </mdui-tooltip>
            <mdui-tooltip content="随机一张" placement="bottom">
              <button class="nav-icon-btn" @click="goTo('/random')">
                <mdui-icon name="shuffle--rounded"></mdui-icon>
              </button>
            </mdui-tooltip>
            <div class="nav-search-box">
              <mdui-icon name="search--rounded" class="nav-search-box__icon"></mdui-icon>
              <input
                v-model="searchKeyword"
                type="text"
                class="nav-search-box__input"
                placeholder="搜索图片..."
                @keydown.enter="doSearch"
              />
            </div>
            <mdui-tooltip content="投稿" placement="bottom">
              <button class="nav-icon-btn" @click="goTo('/submit')">
                <mdui-icon name="add_photo_alternate--rounded"></mdui-icon>
              </button>
            </mdui-tooltip>
            <mdui-tooltip content="团队" placement="bottom">
              <button class="nav-icon-btn" @click="goTo('/team')">
                <mdui-icon name="groups--rounded"></mdui-icon>
              </button>
            </mdui-tooltip>
            <mdui-tooltip content="通知" placement="bottom">
              <button class="nav-icon-btn" @click="goTo('/notifications')">
                <mdui-icon name="notifications--rounded"></mdui-icon>
                <span v-if="auth.unreadNotifications" class="nav-icon-badge">{{ auth.unreadNotifications }}</span>
              </button>
            </mdui-tooltip>
            <template v-for="action in topbarActions" :key="action.id">
              <mdui-tooltip :content="action.label" placement="bottom">
                <button class="nav-icon-btn" @click="executeTopbarAction(action)">
                  <mdui-icon :name="action.icon || 'extension--rounded'"></mdui-icon>
                </button>
              </mdui-tooltip>
            </template>

            <mdui-button
              v-if="!auth.isLoggedIn && !auth.loading"
              class="nav-desktop"
              variant="filled-tonal"
              @click="goToLogin"
            >登录</mdui-button>

            <div v-else-if="auth.loading" class="nav-auth-loading" aria-label="认证处理中">
              <mdui-circular-progress></mdui-circular-progress>
            </div>

            <div v-else-if="auth.isLoggedIn" class="user-menu" ref="menuRef">
              <button type="button" class="user-menu__trigger" @click="menuOpen = !menuOpen">
                <div class="user-menu__avatar user-menu__avatar--trigger">
                  <img v-if="auth.profile?.avatar_url" :src="auth.profile.avatar_url" alt="avatar" />
                  <span v-else>{{ (auth.displayName || 'U').slice(0, 1).toUpperCase() }}</span>
                </div>
                <span class="user-menu__name nav-desktop">{{ auth.displayName }}</span>
                <span class="user-menu__caret nav-desktop" :class="{ 'user-menu__caret--open': menuOpen }">▾</span>
                <span v-if="adminBadgeVisible" class="menu-corner-badge">{{ adminBadgeText }}</span>
              </button>

              <div v-if="menuOpen" class="user-menu__dropdown" @click.stop>
                <div class="user-menu__header">
                  <div class="user-menu__avatar user-menu__avatar--lg">
                    <img v-if="auth.profile?.avatar_url" :src="auth.profile.avatar_url" alt="avatar" />
                    <span v-else>{{ (auth.displayName || 'U').slice(0, 1).toUpperCase() }}</span>
                  </div>
                  <div>
                    <div class="user-menu__display-name">{{ auth.displayName }}</div>
                    <div class="user-menu__email">{{ auth.profile?.email }}</div>
                  </div>
                </div>
                <div class="user-menu__divider"></div>
                <button class="user-menu__item" @click="navigate('/profile')">个人资料</button>
                <button class="user-menu__item" @click="navigate('/my-submissions')">我的投稿</button>
                <button class="user-menu__item" @click="navigate('/notifications')">
                  <span>通知中心</span>
                  <span v-if="auth.unreadNotifications" class="inline-badge inline-badge--end">{{ auth.unreadNotifications }}</span>
                </button>
                <button class="user-menu__item" @click="openSiteFeedback">
                  <span>提交反馈</span>
                </button>
                <template v-if="auth.canModerate">
                  <div class="user-menu__divider"></div>
                  <template v-if="auth.isSuperAdmin">
                    <div class="user-menu__submenu">
                      <button class="user-menu__item user-menu__submenu-trigger" @click="adminMenuOpen = !adminMenuOpen">
                        <span>后台管理</span>
                        <span v-if="adminStore.pendingTotal" class="inline-badge inline-badge--end">{{ adminStore.pendingTotal }}</span>
                        <span class="user-menu__submenu-caret" :class="{ 'user-menu__submenu-caret--open': adminMenuOpen }">▾</span>
                      </button>
                      <div v-if="adminMenuOpen" class="user-menu__submenu-items">
                        <button
                          v-for="item in adminMenuItems"
                          :key="item.id"
                          class="user-menu__item user-menu__item--sub"
                          @click="navigate(item.to)"
                        >
                          <span>{{ item.title }}</span>
                          <span v-if="item.badge" class="inline-badge inline-badge--end">{{ item.badge }}</span>
                        </button>
                      </div>
                    </div>
                  </template>
                  <template v-else>
                    <button
                      v-for="item in reviewerQuickMenuItems"
                      :key="item.id"
                      class="user-menu__item"
                      @click="navigate(item.to)"
                    >
                      <span>{{ item.title }}</span>
                      <span v-if="item.badge" class="inline-badge inline-badge--end">{{ item.badge }}</span>
                    </button>
                  </template>
                </template>
                <div class="user-menu__divider"></div>
                <button class="user-menu__item user-menu__item--danger" @click="signOut">退出登录</button>
              </div>
            </div>
          </div>

          <button class="mobile-menu-btn" @click="mobileMenuOpen = !mobileMenuOpen" aria-label="菜单">
            <mdui-icon :name="mobileMenuOpen ? 'close--rounded' : 'menu--rounded'"></mdui-icon>
          </button>
        </nav>

        <div v-if="mobileMenuOpen" class="mobile-nav-panel">
          <button class="mobile-nav-item" @click="mobileGoTo('/')">主页</button>
          <button class="mobile-nav-item" @click="mobileGoTo('/random')">随机一张</button>
          <button class="mobile-nav-item" @click="mobileGoTo('/search')">搜索</button>
          <button class="mobile-nav-item" @click="mobileGoTo('/submit')">投稿</button>
          <template v-if="!auth.isLoggedIn && !auth.loading">
            <button class="mobile-nav-item" @click="mobileGoToLogin">登录</button>
            <button class="mobile-nav-item" @click="mobileGoTo('/register')">注册</button>
          </template>
          <template v-else-if="auth.loading">
            <div class="mobile-nav-loading">
              <mdui-circular-progress></mdui-circular-progress>
              <span>认证处理中…</span>
            </div>
          </template>
          <template v-else>
            <button class="mobile-nav-item mobile-nav-item--with-badge" @click="mobileGoTo('/notifications')">
              <span>通知</span>
              <span v-if="auth.unreadNotifications" class="inline-badge inline-badge--end">{{ auth.unreadNotifications }}</span>
            </button>
            <button class="mobile-nav-item" @click="mobileGoTo('/profile')">个人资料</button>
            <button class="mobile-nav-item" @click="mobileGoTo('/my-submissions')">我的投稿</button>
            <button class="mobile-nav-item" @click="mobileOpenSiteFeedback">提交反馈</button>
            <button
              v-for="action in topbarActions"
              :key="`mobile-${action.id}`"
              class="mobile-nav-item"
              @click="mobileExecuteTopbarAction(action)"
            >
              {{ action.label }}
            </button>
            <template v-if="auth.canModerate">
              <template v-if="auth.isSuperAdmin">
                <div class="mobile-nav-submenu">
                  <button class="mobile-nav-item mobile-nav-submenu__trigger" @click="mobileAdminMenuOpen = !mobileAdminMenuOpen">
                    <span>后台管理</span>
                    <span v-if="adminStore.pendingTotal" class="inline-badge inline-badge--end">{{ adminStore.pendingTotal }}</span>
                    <span class="mobile-nav-submenu__caret" :class="{ 'mobile-nav-submenu__caret--open': mobileAdminMenuOpen }">▾</span>
                  </button>
                  <div v-if="mobileAdminMenuOpen" class="mobile-nav-submenu__items">
                    <button
                      v-for="item in adminMenuItems"
                      :key="item.id"
                      class="mobile-nav-item mobile-nav-item--sub"
                      @click="mobileGoTo(item.to)"
                    >
                      <span>{{ item.title }}</span>
                      <span v-if="item.badge" class="inline-badge inline-badge--end">{{ item.badge }}</span>
                    </button>
                  </div>
                </div>
              </template>
              <template v-else>
                <button
                  v-for="item in reviewerQuickMenuItems"
                  :key="item.id"
                  class="mobile-nav-item mobile-nav-item--with-badge"
                  @click="mobileGoTo(item.to)"
                >
                  <span>{{ item.title }}</span>
                  <span v-if="item.badge" class="inline-badge inline-badge--end">{{ item.badge }}</span>
                </button>
              </template>
            </template>
            <button class="mobile-nav-item mobile-nav-item--danger" @click="mobileSignOut">退出登录</button>
          </template>
        </div>
      </div>
    </header>

    <AnnouncementBanner :items="appStore.bannerAnnouncements" @open-link="openLink"></AnnouncementBanner>
    <NoticeDialog
      v-model:open="appStore.popupVisible"
      :announcement="appStore.popupAnnouncement"
      @dismiss="appStore.dismissPopup"
      @open-link="openLink"
    ></NoticeDialog>
    <SiteFeedbackDialog v-model:visible="showSiteFeedback" @submitted="onSiteFeedbackSubmitted" />

    <main class="app-shell__main">
      <router-view></router-view>
    </main>

    <SiteFooter></SiteFooter>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { siteConfig } from '@/config/site'
import { coreAdminMenuItems, resolveVisibleMenus } from '@/config/navigation'
import { getPluginMenus, getTopbarActions, invokePluginAction } from '@/plugins/runtime'
import { isExternalLink } from '@/lib/safeLink'
import { showToast } from '@/lib/toast'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { useAdminStore } from '@/stores/admin'
import { useContextMenu } from '@/composables/useContextMenu'
import AnnouncementBanner from '@/components/AnnouncementBanner.vue'
import NoticeDialog from '@/components/NoticeDialog.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import SiteFeedbackDialog from '@/components/feedback/SiteFeedbackDialog.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const appStore = useAppStore()
const adminStore = useAdminStore()
const menuOpen = ref(false)
const menuRef = ref(null)
const mobileMenuOpen = ref(false)
const adminMenuOpen = ref(false)
const mobileAdminMenuOpen = ref(false)
const searchKeyword = ref('')
const showSiteFeedback = ref(false)
const { showContextMenu } = useContextMenu()

const adminBadgeVisible = computed(() => auth.canModerate && adminStore.pendingTotal > 0)
const adminBadgeText = computed(() => adminStore.pendingTotal > 99 ? '99+' : adminStore.pendingTotal)

const menuContext = computed(() => ({
  auth,
  adminStore,
}))

const adminMenuItems = computed(() => {
  const coreMenus = resolveVisibleMenus(coreAdminMenuItems, menuContext.value)
  const pluginMenus = getPluginMenus('admin', menuContext.value)
  const allMenus = [...coreMenus, ...pluginMenus].sort((a, b) => (a.order || 0) - (b.order || 0))
  
  return allMenus.map((item) => {
    if (item.to === '/admin/feedback' && adminStore.pendingFeedbacks > 0) {
      return { ...item, badge: adminStore.pendingFeedbacks }
    }
    return item
  })
})

const reviewerQuickMenuItems = computed(() =>
  adminMenuItems.value.filter((item) => item.meta?.roles?.includes('REVIEWER')),
)

const topbarActions = computed(() =>
  getTopbarActions({
    auth,
    route,
    adminStore,
  }),
)

function onContextMenu(e) {
  showContextMenu(e)
}

onMounted(async () => {
  try {
    await auth.init()
    await appStore.loadAnnouncements()
    syncAdminPolling()
  } catch (error) {
    showToast(error.message || '初始化失败')
  }
  document.addEventListener('click', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
  adminStore.stopPolling()
})

watch(
  () => [auth.isLoggedIn, auth.role],
  () => {
    syncAdminPolling()
  },
)

function syncAdminPolling() {
  if (auth.canModerate) {
    adminStore.startPolling()
  } else {
    adminStore.reset()
  }
}

function onClickOutside(event) {
  if (menuRef.value && !menuRef.value.contains(event.target)) {
    menuOpen.value = false
  }
}

function goTo(path) {
  router.push(path)
}

function doSearch() {
  const keyword = searchKeyword.value.trim()
  if (keyword) {
    router.push({ path: '/search', query: { q: keyword } })
  } else {
    router.push('/search')
  }
}

function goToLogin() {
  router.push({ path: '/login', query: { redirect: route.fullPath } })
}

function navigate(path) {
  menuOpen.value = false
  mobileMenuOpen.value = false
  router.push(path)
}

function mobileGoTo(path) {
  mobileMenuOpen.value = false
  router.push(path)
}

function mobileGoToLogin() {
  mobileMenuOpen.value = false
  router.push({ path: '/login', query: { redirect: route.fullPath } })
}

async function mobileSignOut() {
  mobileMenuOpen.value = false
  try {
    await auth.signOut()
    adminStore.reset()
    router.push('/')
  } catch (error) {
    showToast(error.message || '退出失败')
  }
}

async function signOut() {
  menuOpen.value = false
  try {
    await auth.signOut()
    adminStore.reset()
    router.push('/')
  } catch (error) {
    showToast(error.message || '退出失败')
  }
}

async function executeTopbarAction(action) {
  if (!action) return
  if (typeof action.onClick === 'function') {
    await invokePluginAction(action, { router, route, auth, adminStore, showToast: () => {} })
    return
  }
  if (action.to) {
    router.push(action.to)
  }
}

function mobileExecuteTopbarAction(action) {
  mobileMenuOpen.value = false
  executeTopbarAction(action)
}

function openLink(link) {
  if (!link) return
  if (isExternalLink(link)) {
    window.open(link, '_blank', 'noopener,noreferrer')
    return
  }
  router.push(link)
}

function openSiteFeedback() {
  menuOpen.value = false
  showSiteFeedback.value = true
}

function mobileOpenSiteFeedback() {
  mobileMenuOpen.value = false
  showSiteFeedback.value = true
}

function onSiteFeedbackSubmitted() {
  showToast('感谢你的反馈！')
}
</script>

<style scoped>
.nav-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  color: #5f6b76;
  transition: background 0.15s, color 0.15s;
  position: relative;
}

.nav-icon-btn:hover {
  background: rgba(103, 80, 164, 0.08);
  color: #6750a4;
}

mdui-tooltip {
  --mdui-comp-tooltip-container-color: rgba(30, 30, 30, 0.9);
  --mdui-comp-tooltip-supporting-text-color: #fff;
}

.nav-icon-btn mdui-icon {
  font-size: 22px;
}

.nav-icon-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 10px;
  font-weight: 600;
  background: #ef4444;
  color: #fff;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-search-box {
  display: flex;
  align-items: center;
  background: rgba(17, 24, 39, 0.04);
  border-radius: 20px;
  padding: 0 12px;
  height: 36px;
  min-width: 200px;
  max-width: 280px;
  transition: background 0.15s, box-shadow 0.15s;
}

.nav-search-box:focus-within {
  background: #fff;
  box-shadow: 0 0 0 2px rgba(103, 80, 164, 0.2);
}

.nav-search-box__icon {
  font-size: 18px;
  color: #8a9aaa;
  margin-right: 8px;
}

.nav-search-box__input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 14px;
  color: #18222c;
}

.nav-search-box__input::placeholder {
  color: #8a9aaa;
}

.user-menu__submenu {
  width: 100%;
}

.user-menu__submenu-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.user-menu__submenu-caret {
  font-size: 10px;
  color: #8a9aaa;
  transition: transform 0.2s;
}

.user-menu__submenu-caret--open {
  transform: rotate(180deg);
}

.user-menu__submenu-items {
  background: rgba(17, 24, 39, 0.02);
  border-radius: 8px;
  margin: 4px 0;
  padding: 4px 0;
}

.user-menu__item--sub {
  padding-left: 20px;
  font-size: 13px;
}

.mobile-nav-submenu {
  width: 100%;
}

.mobile-nav-submenu__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mobile-nav-submenu__caret {
  font-size: 12px;
  color: #8a9aaa;
  transition: transform 0.2s;
}

.mobile-nav-submenu__caret--open {
  transform: rotate(180deg);
}

.mobile-nav-submenu__items {
  background: rgba(17, 24, 39, 0.03);
  padding: 4px 0;
}

.mobile-nav-item--sub {
  padding-left: 24px;
  font-size: 14px;
}
</style>

<style scoped>
.nav-auth-loading, .mobile-nav-loading {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #5f6b76;
}
.nav-auth-loading {
  min-width: 44px;
  justify-content: center;
}
.mobile-nav-loading {
  padding: 12px 14px;
  font-size: 14px;
}
</style>
