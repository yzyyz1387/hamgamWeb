import { defineStore } from 'pinia'
import { requireSupabase, supabaseEnabled } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

let pollTimer = null

function safeCount(result) {
  if (result.status !== 'fulfilled') return 0
  const value = result.value
  if (value?.error) return 0
  return value?.count || 0
}

export const useAdminStore = defineStore('admin', {
  state: () => ({
    pendingSubmissions: 0,
    pendingCallsigns: 0,
    loading: false,
  }),
  getters: {
    pendingTotal: (state) => state.pendingSubmissions + state.pendingCallsigns,
  },
  actions: {
    async loadPendingCounts() {
      const auth = useAuthStore()
      if (!supabaseEnabled || !auth.canModerate) {
        this.pendingSubmissions = 0
        this.pendingCallsigns = 0
        return { submissions: 0, callsigns: 0 }
      }

      this.loading = true
      try {
        const supabase = requireSupabase()
        const results = await Promise.allSettled([
          supabase.from('submissions').select('id', { head: true, count: 'exact' }).eq('status', 'PENDING'),
          auth.isSuperAdmin
            ? supabase.from('callsign_applications').select('id', { head: true, count: 'exact' }).eq('status', 'PENDING')
            : Promise.resolve({ count: 0, error: null }),
        ])

        this.pendingSubmissions = safeCount(results[0])
        this.pendingCallsigns = safeCount(results[1])
        return {
          submissions: this.pendingSubmissions,
          callsigns: this.pendingCallsigns,
        }
      } finally {
        this.loading = false
      }
    },
    startPolling() {
      this.stopPolling()
      this.loadPendingCounts().catch(() => {})
      pollTimer = window.setInterval(() => {
        this.loadPendingCounts().catch(() => {})
      }, 60 * 1000)
    },
    stopPolling() {
      if (pollTimer) {
        window.clearInterval(pollTimer)
        pollTimer = null
      }
    },
    reset() {
      this.stopPolling()
      this.pendingSubmissions = 0
      this.pendingCallsigns = 0
      this.loading = false
    },
  },
})
