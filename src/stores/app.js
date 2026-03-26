import { defineStore } from 'pinia'
import { requireSupabase, supabaseEnabled } from '@/lib/supabase'

export const useAppStore = defineStore('app', {
  state: () => ({
    announcements: [],
    popupVisible: false,
    loadedOnce: false,
  }),
  getters: {
    bannerAnnouncements: (state) => state.announcements.filter((item) => item.kind === 'BANNER'),
    popupAnnouncement: (state) =>
      state.announcements.find((item) => {
        if (item.kind !== 'POPUP') return false
        if (item.dismissible === false) return true
        if (typeof window === 'undefined') return true
        return !window.localStorage.getItem(`hamgam-popup-${item.id}`)
      }) || null,
  },
  actions: {
    async loadAnnouncements(force = false) {
      if (this.loadedOnce && !force) return this.announcements
      if (!supabaseEnabled) {
        this.announcements = []
        this.loadedOnce = true
        return []
      }
      const supabase = requireSupabase()
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .lte('starts_at', now)
        .or(`ends_at.is.null,ends_at.gte.${now}`)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      this.announcements = data || []
      this.loadedOnce = true
      this.popupVisible = Boolean(this.popupAnnouncement)
      return this.announcements
    },
    dismissPopup(id) {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`hamgam-popup-${id}`, '1')
      }
      this.popupVisible = false
    },
    showPopup() {
      this.popupVisible = Boolean(this.popupAnnouncement)
    },
  },
})
