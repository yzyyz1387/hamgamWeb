import { defineStore } from 'pinia'
import { requireSupabase, supabaseEnabled } from '@/lib/supabase'
import { normalizeImageRecord } from '@/lib/image'

export const useGalleryStore = defineStore('gallery', {
  state: () => ({
    images: [],
    loading: false,
    loadedOnce: false,
    lastLoadedAt: null,
  }),
  getters: {
    publishedImages: (state) => state.images,
  },
  actions: {
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
