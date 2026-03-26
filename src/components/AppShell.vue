<template>
  <div class="app-shell">
    <header class="app-shell__header">
      <div class="app-shell__topbar container">
        <div class="app-shell__brand" @click="goTo('/')">{{ siteConfig.name }}</div>
        <nav class="app-shell__actions">
          <div class="nav-desktop-group">
            <mdui-button class="nav-desktop" variant="text" @click="goTo('/')">主页</mdui-button>
            <mdui-button class="nav-desktop" variant="text" @click="goTo('/random')">随机一张</mdui-button>
            <mdui-button class="nav-desktop" variant="text" @click="goTo('/search')">搜索</mdui-button>
            <mdui-button class="nav-desktop" variant="text" @click="goTo('/submit')">投稿</mdui-button>
            <mdui-button class="nav-desktop" variant="text" @click="goTo('/team')">团队</mdui-button>
            <mdui-button class="nav-desktop" variant="text" @click="goTo('/notifications')">
              通知
              <span v-if="auth.unreadNotifications" class="inline-badge">{{ auth.unreadNotifications }}</span>
            </mdui-button>

            <mdui-button
              v-if="!auth.isLoggedIn"
              class="nav-desktop"
              variant="filled-tonal"
              @click="goTo('/login')"
            >登录</mdui-button>

            <div v-if="auth.isLoggedIn" class="user-menu" ref="menuRef">
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
                <button class="user-menu__item" @click="navigate('/notifications')">
                  <span>通知中心</span>
                  <span v-if="auth.unreadNotifications" class="inline-badge inline-badge--end">{{ auth.unreadNotifications }}</span>
                </button>
                <template v-if="auth.canModerate">
                  <div class="user-menu__divider"></div>
                  <button class="user-menu__item" @click="navigate('/admin')">
                    <span>后台总览</span>
                    <span v-if="adminStore.pendingTotal" class="inline-badge inline-badge--end">{{ adminStore.pendingTotal }}</span>
                  </button>
                  <button class="user-menu__item" @click="navigate('/admin/submissions')">
                    <span>投稿审核</span>
                    <span v-if="adminStore.pendingSubmissions" class="inline-badge inline-badge--end">{{ adminStore.pendingSubmissions }}</span>
                  </button>
                  <button v-if="auth.isSuperAdmin" class="user-menu__item" @click="navigate('/admin/users')">用户管理</button>
                  <button v-if="auth.isSuperAdmin" class="user-menu__item" @click="navigate('/admin/images')">图片管理</button>
                  <button v-if="auth.isSuperAdmin" class="user-menu__item" @click="navigate('/admin/announcements')">公告管理</button>
                  <button v-if="auth.isSuperAdmin" class="user-menu__item" @click="navigate('/admin/friend-links')">友情链接</button>
                  <button v-if="auth.isSuperAdmin" class="user-menu__item" @click="navigate('/admin/callsign')">
                    <span>呼号审核</span>
                    <span v-if="adminStore.pendingCallsigns" class="inline-badge inline-badge--end">{{ adminStore.pendingCallsigns }}</span>
                  </button>
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
          <template v-if="!auth.isLoggedIn">
            <button class="mobile-nav-item" @click="mobileGoTo('/login')">登录</button>
            <button class="mobile-nav-item" @click="mobileGoTo('/register')">注册</button>
          </template>
          <template v-else>
            <button class="mobile-nav-item mobile-nav-item--with-badge" @click="mobileGoTo('/notifications')">
              <span>通知</span>
              <span v-if="auth.unreadNotifications" class="inline-badge inline-badge--end">{{ auth.unreadNotifications }}</span>
            </button>
            <button class="mobile-nav-item" @click="mobileGoTo('/profile')">个人资料</button>
            <template v-if="auth.canModerate">
              <button class="mobile-nav-item mobile-nav-item--with-badge" @click="mobileGoTo('/admin')">
                <span>后台总览</span>
                <span v-if="adminStore.pendingTotal" class="inline-badge inline-badge--end">{{ adminStore.pendingTotal }}</span>
              </button>
              <button class="mobile-nav-item mobile-nav-item--with-badge" @click="mobileGoTo('/admin/submissions')">
                <span>投稿审核</span>
                <span v-if="adminStore.pendingSubmissions" class="inline-badge inline-badge--end">{{ adminStore.pendingSubmissions }}</span>
              </button>
              <button
                v-if="auth.isSuperAdmin"
                class="mobile-nav-item"
                @click="mobileGoTo('/admin/images')"
              >图片管理</button>
              <button
                v-if="auth.isSuperAdmin"
                class="mobile-nav-item mobile-nav-item--with-badge"
                @click="mobileGoTo('/admin/callsign')"
              >
                <span>呼号审核</span>
                <span v-if="adminStore.pendingCallsigns" class="inline-badge inline-badge--end">{{ adminStore.pendingCallsigns }}</span>
              </button>
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

    <main class="app-shell__main">
      <router-view></router-view>
    </main>

    <SiteFooter></SiteFooter>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { siteConfig } from '@/config/site'
import { isExternalLink } from '@/lib/safeLink'
import { showToast } from '@/lib/toast'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { useAdminStore } from '@/stores/admin'
import AnnouncementBanner from '@/components/AnnouncementBanner.vue'
import NoticeDialog from '@/components/NoticeDialog.vue'
import SiteFooter from '@/components/SiteFooter.vue'

const router = useRouter()
const auth = useAuthStore()
const appStore = useAppStore()
const adminStore = useAdminStore()
const menuOpen = ref(false)
const menuRef = ref(null)
const mobileMenuOpen = ref(false)

const adminBadgeVisible = computed(() => auth.canModerate && adminStore.pendingTotal > 0)
const adminBadgeText = computed(() => adminStore.pendingTotal > 99 ? '99+' : adminStore.pendingTotal)

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

function navigate(path) {
  menuOpen.value = false
  mobileMenuOpen.value = false
  router.push(path)
}

function mobileGoTo(path) {
  mobileMenuOpen.value = false
  router.push(path)
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

function openLink(link) {
  if (!link) return
  if (isExternalLink(link)) {
    window.open(link, '_blank', 'noopener,noreferrer')
    return
  }
  router.push(link)
}
</script>
