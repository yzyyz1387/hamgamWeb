import { ref } from 'vue'
import { requireSupabase, supabaseEnabled } from '@/lib/supabase'

const CACHE_KEY = 'hamgam:danmaku:users'
const CACHE_TTL = 20 * 60 * 1000 // 20 分钟

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL) return null
    return data
  } catch {
    return null
  }
}

function writeCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }))
  } catch {}
}

export function useDanmakuUsers() {
  const users = ref([])
  const loading = ref(false)

  async function load() {
    // 优先读缓存
    const cached = readCache()
    if (cached) {
      users.value = cached
      return
    }
    if (!supabaseEnabled) return
    loading.value = true
    try {
      const supabase = requireSupabase()
      // 只取有头像或有呼号的用户，控制数量
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nickname, avatar_url, callsign, uid')
        .eq('is_active', true)
        .not('nickname', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      const list = (data || []).filter((u) => u.nickname)
      users.value = list
      writeCache(list)
    } catch {
      // 请求失败时回退旧缓存（不管是否过期）
      try {
        const raw = sessionStorage.getItem(CACHE_KEY)
        if (raw) {
          const { data } = JSON.parse(raw)
          users.value = data || []
        }
      } catch {}
    } finally {
      loading.value = false
    }
  }

  return { users, loading, load }
}
