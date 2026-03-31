import { defineStore } from 'pinia'
import { requireSupabase, supabaseEnabled } from '@/lib/supabase'
import { normalizeImageRecord } from '@/lib/image'
import { stableShuffle } from '@/lib/format'

const SORT_MODE_KEY = 'hamgam:gallery:sortMode'
const SHUFFLE_SEED_KEY = 'hamgam:gallery:shuffleSeed'
const SHUFFLE_SEED_TIME_KEY = 'hamgam:gallery:shuffleSeedTime'
const VIEWED_IMAGES_KEY = 'hamgam:gallery:viewedImages'

const SHUFFLE_SEED_EXPIRE_MS = 24 * 60 * 60 * 1000

export const useGalleryStore = defineStore('gallery', {
  state: () => ({
    images: [],
    loading: false,
    loadedOnce: false,
    lastLoadedAt: null,
    sortMode: 'shuffle',
    shuffleSeed: null,
    shuffleSeedTime: null,
    viewedImageIds: new Set(),
  }),
  getters: {
    publishedImages: (state) => state.images,
    sortedImages: (state) => {
      const base = state.images
      if (state.sortMode === 'recent') {
        return [...base].sort((a, b) => new Date(b.sort_at || 0) - new Date(a.sort_at || 0))
      }
      return stableShuffle([...base], state.shuffleSeed)
    },
    unviewedImages: (state) => {
      return state.images.filter((img) => !state.viewedImageIds.has(img.id))
    },
    isShuffleSeedExpired: (state) => {
      if (!state.shuffleSeedTime) return true
      return Date.now() - state.shuffleSeedTime > SHUFFLE_SEED_EXPIRE_MS
    },
  },
  actions: {
    initFromStorage() {
      try {
        const savedSortMode = localStorage.getItem(SORT_MODE_KEY)
        if (savedSortMode === 'shuffle' || savedSortMode === 'recent') {
          this.sortMode = savedSortMode
        }
        
        const savedSeed = localStorage.getItem(SHUFFLE_SEED_KEY)
        const savedSeedTime = localStorage.getItem(SHUFFLE_SEED_TIME_KEY)
        const seedTime = savedSeedTime ? parseInt(savedSeedTime, 10) : null
        
        const isExpired = !seedTime || (Date.now() - seedTime > SHUFFLE_SEED_EXPIRE_MS)
        
        if (savedSeed && !isExpired) {
          this.shuffleSeed = parseInt(savedSeed, 10)
          this.shuffleSeedTime = seedTime
        } else {
          this.generateNewShuffleSeed()
        }
        
        if (!this.shuffleSeed || Number.isNaN(this.shuffleSeed)) {
          this.generateNewShuffleSeed()
        }
        
        const viewedStr = sessionStorage.getItem(VIEWED_IMAGES_KEY)
        if (viewedStr) {
          try {
            const viewedArr = JSON.parse(viewedStr)
            if (Array.isArray(viewedArr)) {
              this.viewedImageIds = new Set(viewedArr)
            }
          } catch {}
        }
      } catch {
        this.sortMode = 'shuffle'
        this.generateNewShuffleSeed()
      }
    },
    generateNewShuffleSeed() {
      this.shuffleSeed = Date.now()
      this.shuffleSeedTime = Date.now()
      try {
        localStorage.setItem(SHUFFLE_SEED_KEY, String(this.shuffleSeed))
        localStorage.setItem(SHUFFLE_SEED_TIME_KEY, String(this.shuffleSeedTime))
      } catch {}
    },
    setSortMode(mode) {
      this.sortMode = mode
      try {
        localStorage.setItem(SORT_MODE_KEY, mode)
      } catch {}
    },
    reshuffle() {
      this.generateNewShuffleSeed()
    },
    markAsViewed(imageId) {
      this.viewedImageIds.add(imageId)
      this.saveViewedToStorage()
    },
    clearViewedHistory() {
      this.viewedImageIds.clear()
      try {
        sessionStorage.removeItem(VIEWED_IMAGES_KEY)
      } catch {}
    },
    saveViewedToStorage() {
      try {
        const arr = Array.from(this.viewedImageIds)
        sessionStorage.setItem(VIEWED_IMAGES_KEY, JSON.stringify(arr))
      } catch {}
    },
    async loadImages(force = false) {
      if (this.loadedOnce && !force) return this.images
      if (!supabaseEnabled) {
        this.images = []
        this.loadedOnce = true
        return this.images
      }
      this.loading = true
      try {
        const supabase = requireSupabase()
        const { data, error } = await supabase
          .from('images')
          .select('*')
          .eq('status', 'PUBLISHED')
          .order('published_at', { ascending: false })
          .limit(500)
        if (error) throw error
        this.images = (data || []).map(normalizeImageRecord).filter(Boolean)
        this.loadedOnce = true
        this.lastLoadedAt = new Date().toISOString()
        return this.images
      } finally {
        this.loading = false
      }
    },
    async fetchImageBySlug(slug) {
      await this.loadImages()
      const local = this.images.find((item) => item.slug === slug)
      if (local) return local
      if (!supabaseEnabled) return null
      const supabase = requireSupabase()
      const { data, error } = await supabase
        .from('images')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'PUBLISHED')
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const normalized = normalizeImageRecord(data)
      this.upsertImageLocally(normalized)
      return normalized
    },
    async fetchImageByLegacyPath(legacyPath) {
      await this.loadImages()
      const decoded = decodeURIComponent(legacyPath)
      const local = this.images.find((item) => item.legacy_url === decoded || item.slug === decoded)
      if (local) return local
      if (!supabaseEnabled) return null
      const supabase = requireSupabase()
      const { data, error } = await supabase
        .from('images')
        .select('*')
        .eq('legacy_url', decoded)
        .eq('status', 'PUBLISHED')
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const normalized = normalizeImageRecord(data)
      this.upsertImageLocally(normalized)
      return normalized
    },
    upsertImageLocally(image) {
      const normalized = normalizeImageRecord(image)
      const index = this.images.findIndex((item) => item.id === normalized.id)
      if (index >= 0) {
        this.images.splice(index, 1, normalized)
      } else {
        this.images.unshift(normalized)
      }
    },
    incrementCommentCountLocally(imageId, delta = 1) {
      const target = this.images.find((item) => item.id === imageId)
      if (!target) return
      target.comments_count = Math.max(0, Number(target.comments_count || 0) + delta)
    },
    updateReactionSummaryLocally(imageId, emoji, active) {
      const target = this.images.find((item) => item.id === imageId)
      if (!target) return
      const current = [...(target.reaction_summary || [])]
      const item = current.find((entry) => entry.emoji === emoji)
      if (!item && active) {
        current.push({ emoji, count: 1 })
      } else if (item) {
        item.count += active ? 1 : -1
      }
      target.reaction_summary = current
        .filter((entry) => entry.count > 0)
        .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji))
      target.reaction_total_count = target.reaction_summary.reduce((sum, entry) => sum + entry.count, 0)
    },
  },
})
