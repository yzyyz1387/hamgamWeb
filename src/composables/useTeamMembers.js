import { ref, computed, onMounted } from 'vue'
import { requireSupabase, supabaseEnabled } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/errors'
import { showToast } from '@/lib/toast'

const CACHE_KEY = 'hamgam:team:members'
const CACHE_TTL = 3600000 // 1小时

function getCachedData() {
  if (typeof window === 'undefined') return null
  try {
    const cached = window.localStorage.getItem(CACHE_KEY)
    if (!cached) return null
    const parsed = JSON.parse(cached)
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      window.localStorage.removeItem(CACHE_KEY)
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}

function setCachedData(data) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }))
  } catch {}
}

export function useTeamMembers() {
  const members = ref([])
  const loading = ref(false)
  const error = ref(null)

  const admins = computed(() => members.value.filter((u) => u.role === 'SUPER_ADMIN'))
  const reviewers = computed(() => members.value.filter((u) => u.role === 'REVIEWER'))
  const featured = computed(() => members.value.filter((u) => u.role === 'USER' && u.show_in_team_page))

  async function loadMembers() {
    // 先从缓存读取
    const cachedData = getCachedData()
    if (cachedData) {
      members.value = cachedData
    }

    // 后台静默更新
    loading.value = true
    error.value = null
    try {
      if (!supabaseEnabled) return
      const supabase = requireSupabase()
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, nickname, avatar_url, bio, callsign, certifications, role, uid, show_in_team_page')
        .or('role.in.(SUPER_ADMIN,REVIEWER),show_in_team_page.eq.true')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
      if (fetchError) throw fetchError
      if (data) {
        members.value = data
        setCachedData(data)
      }
    } catch (err) {
      error.value = getErrorMessage(err)
      // 保留旧缓存，不显示错误
    } finally {
      loading.value = false
    }
  }

  return {
    members,
    admins,
    reviewers,
    featured,
    loading,
    error,
    loadMembers
  }
}