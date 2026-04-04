import { defineStore } from 'pinia'
import { siteConfig } from '@/config/site'
import { requireSupabase, supabaseEnabled } from '@/lib/supabase'
import { showToast } from '@/lib/toast'
import { safeInsertAuditLog } from '@/lib/audit'

const IDLE_TIMEOUT_MS = 30 * 60 * 1000
const SESSION_CHECK_INTERVAL_MS = 15 * 1000
const HEALTHCHECK_THROTTLE_MS = 4 * 1000
const REFRESH_THRESHOLD_SECONDS = 10 * 60
const GLOBAL_SIGNOUT_KEY = 'hamgam:auth:signout'
const PASSWORD_RECOVERY_STORAGE_KEY = 'hamgam:auth:password-recovery'
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'mousemove']

let initPromise = null
let attachedStore = null
let sessionCheckTimer = null
let notificationChannel = null
let notificationChannelUserId = null
let activityListenersBound = false
let storageListenerBound = false
let visibilityListenerBound = false
let lastActivityAt = Date.now()
let lastHealthCheckAt = 0
let authStateChangeQueue = Promise.resolve()
let authStateChangeSeq = 0
let authStateChangeDiscardBeforeSeq = 0

function buildEmailRedirectTo(nextPath = '/login') {
  if (typeof window === 'undefined') return undefined
  const next = encodeURIComponent(nextPath)
  return `${window.location.origin}/auth/callback?next=${next}`
}

function readPasswordRecoveryHashFlag() {
  if (typeof window === 'undefined') return false
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash
  if (!hash) return false

  if (hash.startsWith('/')) {
    const queryIndex = hash.indexOf('?')
    if (queryIndex === -1) return false
    const params = new URLSearchParams(hash.slice(queryIndex + 1))
    return params.get('type') === 'recovery' || params.get('flow') === 'recovery'
  }

  const params = new URLSearchParams(hash)
  return params.get('type') === 'recovery' || params.get('flow') === 'recovery'
}

function readPersistedPasswordRecoveryFlag() {
  if (typeof window === 'undefined') return false
  return window.sessionStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY) === '1'
}

function persistPasswordRecoveryFlag() {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(PASSWORD_RECOVERY_STORAGE_KEY, '1')
}

function clearPersistedPasswordRecoveryFlag() {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY)
}

function readPasswordRecoveryHint() {
  return readPasswordRecoveryHashFlag() || readPersistedPasswordRecoveryFlag()
}

function safeNow() {
  return Date.now()
}

function markActivity() {
  lastActivityAt = safeNow()
}

function markHealthCheck() {
  lastHealthCheckAt = safeNow()
}

function bindActivityListeners() {
  if (typeof window === 'undefined' || activityListenersBound) return
  ACTIVITY_EVENTS.forEach((eventName) => {
    window.addEventListener(eventName, markActivity, { passive: true })
  })
  activityListenersBound = true
}

function unbindActivityListeners() {
  if (typeof window === 'undefined' || !activityListenersBound) return
  ACTIVITY_EVENTS.forEach((eventName) => {
    window.removeEventListener(eventName, markActivity)
  })
  activityListenersBound = false
}

function startSessionCheckTimer() {
  if (typeof window === 'undefined') return
  stopSessionCheckTimer()
  sessionCheckTimer = window.setInterval(() => {
    attachedStore?.runSessionHealthCheck().catch(() => {})
  }, SESSION_CHECK_INTERVAL_MS)
}

function stopSessionCheckTimer() {
  if (typeof window === 'undefined' || !sessionCheckTimer) return
  window.clearInterval(sessionCheckTimer)
  sessionCheckTimer = null
}

function stopNotificationRealtimeWatcher() {
  if (!notificationChannel) {
    notificationChannelUserId = null
    return
  }
  if (supabaseEnabled) {
    try {
      requireSupabase().removeChannel(notificationChannel)
    } catch {
      // ignore channel cleanup failure
    }
  }
  notificationChannel = null
  notificationChannelUserId = null
}

function handleStorageEvent(event) {
  if (!attachedStore || !attachedStore.isLoggedIn) return
  if (event.key !== GLOBAL_SIGNOUT_KEY || !event.newValue) return
  attachedStore.handleRemoteSignOut().catch(() => {})
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    markActivity()
    attachedStore?.runSessionHealthCheck({ force: true }).catch(() => {})
  }
}

function bindGlobalListeners() {
  if (typeof window === 'undefined') return
  if (!storageListenerBound) {
    window.addEventListener('storage', handleStorageEvent)
    storageListenerBound = true
  }
  if (!visibilityListenerBound) {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    visibilityListenerBound = true
  }
}

function enqueueAuthStateChange(handler) {
  const seq = ++authStateChangeSeq
  const run = () => {
    authStateChangeQueue = authStateChangeQueue
      .catch(() => {})
      .then(async () => {
        if (seq <= authStateChangeDiscardBeforeSeq) return
        await handler()
      })
      .catch((error) => {
        console.error('[auth] Failed to process auth state change', error)
      })
  }

  if (typeof window === 'undefined') {
    run()
    return seq
  }

  window.setTimeout(run, 0)
  return seq
}

function discardQueuedAuthStateChanges() {
  authStateChangeDiscardBeforeSeq = authStateChangeSeq
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    session: null,
    user: null,
    profile: null,
    loading: false,
    initialized: false,
    unreadNotifications: 0,
    authSubscription: null,
    passwordRecoveryMode: false,
    passwordRecoveryError: false,
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.user),
    role: (state) => state.profile?.role || 'USER',
    isSuperAdmin: (state) => state.profile?.role === 'SUPER_ADMIN',
    canModerate: (state) => ['SUPER_ADMIN', 'REVIEWER'].includes(state.profile?.role),
    displayName: (state) =>
      state.profile?.nickname || state.user?.user_metadata?.nickname || state.user?.email?.split('@')[0] || siteConfig.name,
  },
  actions: {
    async init() {
      if (this.initialized) return
      if (!supabaseEnabled) {
        this.initialized = true
        return
      }
      if (initPromise) {
        await initPromise
        return
      }
      attachedStore = this
      bindGlobalListeners()
      initPromise = (async () => {
        const supabase = requireSupabase()
        const passwordRecoveryHint = readPasswordRecoveryHint()
        if (passwordRecoveryHint) {
          persistPasswordRecoveryFlag()
        }
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (passwordRecoveryHint && session) {
          this.passwordRecoveryError = false
          this.setPasswordRecoveryMode(true)
        }
        await this.applySession(session, { skipHealthCheck: passwordRecoveryHint || this.passwordRecoveryMode })
        if (!this.authSubscription) {
          const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
            enqueueAuthStateChange(async () => {
              await this.handleAuthStateChange(event, nextSession)
            })
          })
          this.authSubscription = data.subscription
        }
        this.initialized = true
      })()
      await initPromise
      initPromise = null
    },

    setPasswordRecoveryMode(active) {
      this.passwordRecoveryMode = Boolean(active)
      if (this.passwordRecoveryMode) {
        persistPasswordRecoveryFlag()
      } else {
        clearPersistedPasswordRecoveryFlag()
      }
    },

    async handleAuthStateChange(event, nextSession) {
      if (event === 'SIGNED_OUT') {
        await this.finishSignOut({ localOnly: true, silent: true })
        return
      }

      if (event === 'PASSWORD_RECOVERY') {
        this.passwordRecoveryError = false
        this.setPasswordRecoveryMode(true)
      }

      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        this.passwordRecoveryError = false
        this.session = nextSession || null
        this.user = nextSession?.user || null
        return
      }

      if (event === 'SIGNED_IN' && this.loading) {
        return
      }
      const skipHealthCheck = event === 'PASSWORD_RECOVERY'
      await this.applySession(nextSession, { skipHealthCheck, deferNonCritical: event === 'SIGNED_IN' })
    },

    async applySession(session, options = {}) {
      const { skipHealthCheck = false, deferNonCritical = false } = options
      const previousUserId = this.user?.id || ''
      const nextUserId = session?.user?.id || ''

      this.session = session || null
      this.user = session?.user || null

      if (previousUserId && previousUserId !== nextUserId) {
        stopNotificationRealtimeWatcher()
      }

      if (this.user) {
        attachedStore = this
        markActivity()
        await this.fetchProfile()
        if (this.profile && this.profile.is_active === false) {
          await this.signOut({ silent: true, reason: '账号已被停用，请联系管理员。', broadcast: false })
          return
        }

        bindActivityListeners()
        startSessionCheckTimer()

        const runWarmup = async () => {
          await this.loadUnreadNotifications().catch(() => {})
          await this.ensureNotificationRealtimeSubscription().catch(() => {})
          if (!skipHealthCheck) {
            await this.runSessionHealthCheck({ force: true }).catch(() => {})
          }
        }

        if (deferNonCritical) {
          Promise.resolve().then(runWarmup).catch(() => {})
        } else {
          await runWarmup()
        }
      } else {
        this.profile = null
        this.unreadNotifications = 0
        stopSessionCheckTimer()
        stopNotificationRealtimeWatcher()
        unbindActivityListeners()
      }
    },

    async fetchProfile() {
      if (!this.user || !supabaseEnabled) {
        this.profile = null
        return null
      }
      const supabase = requireSupabase()
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', this.user.id)
        .maybeSingle()
      if (error) throw error
      this.profile = data
      return data
    },

    async ensureNotificationRealtimeSubscription() {
      if (!this.user || !supabaseEnabled) return false
      if (notificationChannel && notificationChannelUserId === this.user.id) {
        return true
      }
      stopNotificationRealtimeWatcher()
      const supabase = requireSupabase()
      notificationChannel = supabase
        .channel(`notifications:${this.user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${this.user.id}`,
          },
          () => {
            this.unreadNotifications++
            showToast('您有一条新通知')
          },
        )
        .subscribe()
      notificationChannelUserId = this.user.id
      return true
    },

    async ensureActiveSessionForMutation() {
      if (!this.user || !supabaseEnabled) return true
      const supabase = requireSupabase()
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()
      if (error) throw error
      if (session) return true
      await this.finishSignOut({ localOnly: true, silent: true })
      throw new Error('当前会话已失效，请重新登录。')
    },

    async runSessionHealthCheck(options = {}) {
      if (!this.user || !supabaseEnabled) return
      const { force = false } = options
      if (!force && safeNow() - lastHealthCheckAt < HEALTHCHECK_THROTTLE_MS) {
        return
      }
      markHealthCheck()

      const idleDuration = safeNow() - lastActivityAt
      if (idleDuration >= IDLE_TIMEOUT_MS) {
        await this.signOut({ reason: '你已长时间未操作，系统已自动退出登录。' })
        return
      }

      const supabase = requireSupabase()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        await this.finishSignOut({ localOnly: true })
        return
      }

      const expiresAt = session.expires_at || 0
      const secondsLeft = expiresAt ? expiresAt - Math.floor(Date.now() / 1000) : Number.MAX_SAFE_INTEGER
      if (secondsLeft > 0 && secondsLeft <= REFRESH_THRESHOLD_SECONDS) {
        const { data, error } = await supabase.auth.refreshSession()
        if (!error && data?.session) {
          this.session = data.session
        }
      }

      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData?.user) {
        await this.finishSignOut({ localOnly: true })
      }
    },

    async signIn({ email, password }) {
      const supabase = requireSupabase()
      this.loading = true
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error

        const userId = data.user?.id || null
        const userEmail = data.user?.email || email

        safeInsertAuditLog({
          action: 'auth.signed_in',
          entityType: 'auth',
          entityId: userId,
          details: {
            email: userEmail,
            device_info: typeof navigator !== 'undefined' ? navigator.userAgent || null : null,
          },
        }).catch(() => {})

        await this.applySession(data.session, { skipHealthCheck: false, deferNonCritical: true })
        return data
      } finally {
        this.loading = false
      }
    },

    async signUp({ email, password, nickname }) {
      const supabase = requireSupabase()
      this.loading = true
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              nickname,
            },
            emailRedirectTo: buildEmailRedirectTo('/login'),
          },
        })
        if (error) throw error
        return data
      } finally {
        this.loading = false
      }
    },

    async handleRemoteSignOut() {
      await this.finishSignOut({ localOnly: true, silent: true })
      showToast('当前会话已在其他页面退出。')
    },

    broadcastSignOut() {
      if (typeof window === 'undefined') return
      window.localStorage.setItem(GLOBAL_SIGNOUT_KEY, String(Date.now()))
    },

    async finishSignOut(options = {}) {
      const { localOnly = false, silent = false, reason = '', signOutScope = 'global' } = options
      const supabase = supabaseEnabled ? requireSupabase() : null
      discardQueuedAuthStateChanges()
      stopSessionCheckTimer()
      stopNotificationRealtimeWatcher()
      unbindActivityListeners()
      lastHealthCheckAt = 0
      if (!localOnly && supabase) {
        await supabase.auth.signOut({ scope: signOutScope })
      }
      this.session = null
      this.user = null
      this.profile = null
      this.unreadNotifications = 0
      this.passwordRecoveryError = false
      this.setPasswordRecoveryMode(false)
      if (reason && !silent) {
        showToast(reason)
      }
    },

    async signOut(options = {}) {
      const { reason = '', silent = false, broadcast = true, localOnly = false, signOutScope = 'global' } = options
      if (broadcast) {
        this.broadcastSignOut()
      }
      await this.finishSignOut({ reason, silent, localOnly, signOutScope })
    },

    async saveProfile(payload) {
      if (!this.user) throw new Error('请先登录。')
      await this.ensureActiveSessionForMutation()
      const supabase = requireSupabase()
      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', this.user.id)
        .select('*')
        .single()
      if (error) throw error
      this.profile = data
      markActivity()
      await safeInsertAuditLog({
        action: 'profile.updated',
        entityType: 'profile',
        entityId: this.user.id,
        details: payload,
      })
      return data
    },

    async updateAvatarUrl(avatarUrl) {
      if (!this.user) throw new Error('请先登录。')
      const value = avatarUrl || null
      await this.saveProfile({ avatar_url: value })
      return value
    },

    async changePassword(password, options = {}) {
      await this.ensureActiveSessionForMutation()
      const supabase = requireSupabase()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      const { updatedVia = 'profile_page' } = options
      safeInsertAuditLog({
        action: 'profile.password_changed',
        entityType: 'profile',
        entityId: this.user?.id || null,
        details: { updated_via: updatedVia },
      }).catch(() => {})
      return true
    },

    async loadUnreadNotifications() {
      if (!this.user || !supabaseEnabled) {
        this.unreadNotifications = 0
        return 0
      }
      const supabase = requireSupabase()
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', this.user.id)
        .eq('is_read', false)
      if (error) throw error
      this.unreadNotifications = count || 0
      return this.unreadNotifications
    },
  },
})
