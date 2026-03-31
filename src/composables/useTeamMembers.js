import { ref, computed } from 'vue'
import { requireSupabase, supabaseEnabled } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/errors'

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
      timestamp: Date.now(),
    }))
  } catch {}
}

function isMissingRpc(error) {
  const message = error?.message || ''
  const code = error?.code || ''
  return /does not exist|Could not find the function|No function matches/i.test(message)
    || ['42883', 'PGRST202'].includes(code)
}

function normalizeCertifications(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function normalizeMember(raw) {
  return {
    ...raw,
    certifications: normalizeCertifications(raw?.certifications),
  }
}

export function useTeamMembers() {
  const members = ref([])
  const loading = ref(false)
  const error = ref(null)

  const admins = computed(() => members.value.filter((u) => u.role === 'SUPER_ADMIN'))
  const reviewers = computed(() => members.value.filter((u) => u.role === 'REVIEWER'))
  const featured = computed(() => members.value.filter((u) => u.role === 'USER' && u.show_in_team_page))

  async function loadMembers() {
    const cachedData = getCachedData()
    if (cachedData) {
      members.value = cachedData.map(normalizeMember)
    }

    loading.value = true
    error.value = null
    try {
      if (!supabaseEnabled) return
      const supabase = requireSupabase()

      try {
        const { data, error: rpcError } = await supabase.rpc('get_public_team_members')
        if (rpcError) throw rpcError
        const list = (data || []).map(normalizeMember)
        members.value = list
        setCachedData(list)
        return
      } catch (rpcError) {
        if (!isMissingRpc(rpcError)) throw rpcError
      }

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, nickname, avatar_url, bio, callsign, certifications, role, uid, show_in_team_page')
        .or('role.in.(SUPER_ADMIN,REVIEWER),show_in_team_page.eq.true')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
      if (fetchError) throw fetchError

      const list = (data || []).map(normalizeMember)
      members.value = list
      setCachedData(list)
    } catch (err) {
      error.value = getErrorMessage(err)
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
    loadMembers,
  }
}
