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

function readAnyCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data } = JSON.parse(raw)
    return data || null
  } catch {
    return null
  }
}

function writeCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }))
  } catch {}
}

function isMissingRpc(error) {
  const message = error?.message || ''
  const code = error?.code || ''
  return /does not exist|Could not find the function|No function matches/i.test(message)
    || ['42883', 'PGRST202'].includes(code)
}

export function useDanmakuUsers() {
  const users = ref([])
  const loading = ref(false)

  async function load() {
    const cached = readCache()
    if (cached) {
      users.value = cached
      return
    }
    if (!supabaseEnabled) return
    loading.value = true
    try {
      const supabase = requireSupabase()

      try {
        const { data, error } = await supabase.rpc('get_public_danmaku_users', { p_limit: 200 })
        if (error) throw error
        const list = (data || []).filter((u) => u?.nickname)
        users.value = list
        writeCache(list)
        return
      } catch (rpcError) {
        if (!isMissingRpc(rpcError)) throw rpcError
      }

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
      users.value = readAnyCache() || []
    } finally {
      loading.value = false
    }
  }

  return { users, loading, load }
}
