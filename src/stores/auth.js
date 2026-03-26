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
const SESSION_GUARD_KEY_PREFIX = 'hamgam:auth:session:'
const SESSION_CHANNEL_PREFIX = 'hamgam:auth:session-channel:'
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'mousemove']

let initPromise = null
let attachedStore = null
let sessionCheckTimer = null
let sessionChannel = null
let sessionChannelUserId = ''
let activityListenersBound = false
let storageListenerBound = false
let visibilityListenerBound = false
let lastActivityAt = Date.now()
let lastHealthCheckAt = 0
let authStateChangeQueue = Promise.resolve()
let authStateChangeSeq = 0
let authStateChangeDiscardBeforeSeq = 0

function buildEmailRedirectTo() {
  if (typeof window === 'undefined') return undefined
  return `${window.location.origin}${window.location.pathname}`
}

function safeNow() {
  return Date.now()
}

function isMissingRpc(error) {
  const message = error?.message || ''
  const code = error?.code || ''
  return /does not exist|Could not find the function|No function matches/i.test(message) ||
    ['42883', 'PGRST202'].includes(code)
}

function getSessionClaimStorageKey(userId) {
  return `${SESSION_GUARD_KEY_PREFIX}${userId}`
}

function ensureSessionClaimId(userId) {
  if (typeof window === 'undefined' || !userId) return ''
  const key = getSessionClaimStorageKey(userId)
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const created = `${userId}:${safeNow()}:${Math.random().toString(36).slice(2, 10)}`
  window.localStorage.setItem(key, created)
  return created
}

function readSessionClaimId(userId) {
  if (typeof window === 'undefined' || !userId) return ''
  return window.localStorage.getItem(getSessionClaimStorageKey(userId)) || ''
}

function clearSessionClaimId(userId) {
  if (typeof window === 'undefined' || !userId) return
  window.localStorage.removeItem(getSessionClaimStorageKey(userId))
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

function stopSessionRealtimeWatcher() {
  if (!sessionChannel) {
    sessionChannelUserId = ''
    return
  }
  if (supabaseEnabled) {
    try {
      requireSupabase().removeChannel(sessionChannel)
    } catch {
      // ignore channel cleanup failure
    }
  }
  sessionChannel = null
  sessionChannelUserId = ''
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
    sessionGuardSupported: null,
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.user),
    role: (state) => state.profile?.role || 'USER',
    isSuperAdmin: (state) => state.profile?.role === 'SUPER_ADMIN',
    canModerate: (state) => ['SUPER_ADMIN', 'REVIEWER'].includes(state.profile?.role),
    displayName: (state) =>
      state.profile?.nickname || state.user?.email?.split('@')[0] || siteConfig.name,
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
        const {
          data: { session },
        } = await supabase.auth.getSession()
        await this.applySession(session)
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

    async handleAuthStateChange(event, nextSession) {
      if (event === 'SIGNED_OUT') {
        await this.finishSignOut({ localOnly: true, silent: true })
        return
      }

      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        this.session = nextSession || null
        this.user = nextSession?.user || null
        return
      }

      const nextUserId = nextSession?.user?.id || ''
      const claimSession = event === 'SIGNED_IN' && nextUserId && !readSessionClaimId(nextUserId)
      const skipHealthCheck = event === 'PASSWORD_RECOVERY'
      await this.applySession(nextSession, { claimSession, skipHealthCheck })
    },

    async applySession(session, options = {}) {
      const { claimSession = false, skipHealthCheck = false } = options
      const previousUserId = this.user?.id || ''
      const nextUserId = session?.user?.id || ''

      this.session = session || null
      this.user = session?.user || null

      if (previousUserId && previousUserId !== nextUserId) {
        stopSessionRealtimeWatcher()
        this.clearUserLocalStorage(previousUserId)
      }

      if (this.user) {
        attachedStore = this
        markActivity()
        await this.fetchProfile()
        if (this.profile && this.profile.is_active === false) {
          await this.signOut({ silent: true, reason: '账号已被停用，请联系管理员。', broadcast: false })
          return
        }
        if (claimSession) {
          await this.claimServerSession().catch(() => {})
        }
        await this.ensureSessionRealtimeSubscription().catch(() => {})
        bindActivityListeners()
        startSessionCheckTimer()
        await this.loadUnreadNotifications().catch(() => {})
        if (!skipHealthCheck) {
          await this.runSessionHealthCheck({ force: true }).catch(() => {})
        }
      } else {
        this.profile = null
        this.unreadNotifications = 0
        stopSessionCheckTimer()
        stopSessionRealtimeWatcher()
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

    async ensureSessionRealtimeSubscription() {
      if (!this.user || !supabaseEnabled) return false
      const sessionId = readSessionClaimId(this.user.id)
      if (!sessionId) {
        stopSessionRealtimeWatcher()
        return false
      }
      if (sessionChannel && sessionChannelUserId === this.user.id) {
        return true
      }
      stopSessionRealtimeWatcher()
      const supabase = requireSupabase()
      sessionChannel = supabase
        .channel(`${SESSION_CHANNEL_PREFIX}${this.user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'sessions',
            filter: `user_id=eq.${this.user.id}`,
          },
          () => {
            attachedStore?.runSessionHealthCheck({ force: true }).catch(() => {})
          },
        )
        .subscribe()
      sessionChannelUserId = this.user.id
      return true
    },

    async claimServerSession() {
      if (!this.user || !supabaseEnabled) return false
      const supabase = requireSupabase()
      const sessionId = ensureSessionClaimId(this.user.id)
      if (!sessionId) return false
      try {
        const deviceInfo = navigator.userAgent || 'Unknown Device'
        const { data, error } = await supabase.rpc('claim_active_session', {
          p_session_id: sessionId,
          p_device_info: deviceInfo,
        })
        if (error) throw error
        this.sessionGuardSupported = true
        await this.ensureSessionRealtimeSubscription().catch(() => {})
        return Boolean(data)
      } catch (error) {
        if (isMissingRpc(error)) {
          this.sessionGuardSupported = false
          return false
        }
        throw error
      }
    },

    async releaseServerSession() {
      if (!this.user || !supabaseEnabled) return false
      const sessionId = readSessionClaimId(this.user.id)
      if (!sessionId) return false
      const supabase = requireSupabase()
      try {
        const { data, error } = await supabase.rpc('release_active_session', {
          p_session_id: sessionId,
        })
        if (error) throw error
        this.sessionGuardSupported = true
        return Boolean(data)
      } catch (error) {
        if (isMissingRpc(error)) {
          this.sessionGuardSupported = false
          return false
        }
        throw error
      }
    },

    clearUserLocalStorage(userId) {
      if (typeof window === 'undefined' || !userId) return
      clearSessionClaimId(userId)
    },

    async verifyServerSession() {
      if (!this.user || !supabaseEnabled) return true
      if (this.sessionGuardSupported === false) return true
      const sessionId = readSessionClaimId(this.user.id)
      if (!sessionId) return true
      const supabase = requireSupabase()
      try {
        const { data, error } = await supabase.rpc('is_active_session_valid', {
          p_session_id: sessionId,
        })
        if (error) throw error
        this.sessionGuardSupported = true
        return Boolean(data)
      } catch (error) {
        if (isMissingRpc(error)) {
          this.sessionGuardSupported = false
          return true
        }
        throw error
      }
    },

    async ensureActiveSessionForMutation() {
      if (!this.user || !supabaseEnabled) return true
      if (this.sessionGuardSupported === false) return true
      const sessionId = readSessionClaimId(this.user.id)
      if (!sessionId) return true
      const valid = await this.verifyServerSession()
      if (valid) return true
      await this.signOut({ reason: '你的账号已在其他设备登录，当前设备已自动退出。', broadcast: true, signOutScope: 'local' })
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

      const valid = await this.verifyServerSession()
      if (!valid) {
        await this.signOut({ reason: '你的账号已在其他设备登录，当前设备已自动退出。', broadcast: true, signOutScope: 'local' })
        return
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
        await this.applySession(data.session, { claimSession: true, skipHealthCheck: false })
        await safeInsertAuditLog({
          action: 'auth.signed_in',
          entityType: 'auth',
          entityId: data.user?.id || this.user?.id || null,
          details: {
            email: data.user?.email || email,
            device_info: typeof navigator !== 'undefined' ? navigator.userAgent || null : null,
          },
        })
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
            emailRedirectTo: buildEmailRedirectTo(),
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
      const userId = this.user?.id
      discardQueuedAuthStateChanges()
      stopSessionCheckTimer()
      stopSessionRealtimeWatcher()
      unbindActivityListeners()
      lastHealthCheckAt = 0
      if (!localOnly && supabase) {
        await supabase.auth.signOut({ scope: signOutScope })
      }
      if (userId) {
        clearSessionClaimId(userId)
      }
      this.session = null
      this.user = null
      this.profile = null
      this.unreadNotifications = 0
      if (reason && !silent) {
        showToast(reason)
      }
    },

    async signOut(options = {}) {
      const { reason = '', silent = false, broadcast = true, localOnly = false, signOutScope = 'global' } = options
      if (supabaseEnabled && this.user && !localOnly) {
        await this.releaseServerSession().catch(() => {})
      }
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

    async changePassword(password) {
      await this.ensureActiveSessionForMutation()
      const supabase = requireSupabase()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      safeInsertAuditLog({
        action: 'profile.password_changed',
        entityType: 'profile',
        entityId: this.user?.id || null,
        details: { updated_via: 'profile_page' },
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
