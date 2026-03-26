import { requireSupabase, supabaseEnabled } from '@/lib/supabase'
import { parsePublicUid } from '@/lib/uid'

function normalizeCallsign(value = '') {
  return value.trim().toUpperCase()
}

function isMissingRpc(error) {
  const message = error?.message || ''
  const code = error?.code || ''
  return /does not exist|Could not find the function|No function matches/i.test(message) ||
    ['42883', 'PGRST202'].includes(code)
}

function isQueryBlocked(error) {
  const message = error?.message || ''
  return /row-level security|permission denied|permission/i.test(message)
}

function firstRow(data) {
  return Array.isArray(data) ? data[0] || null : data || null
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

function normalizeProfile(raw) {
  if (!raw) return null
  return {
    ...raw,
    certifications: normalizeCertifications(raw.certifications),
  }
}

export async function resolvePublicUserUid({ userId = null, callsign = '' } = {}) {
  if (!supabaseEnabled) return null
  const supabase = requireSupabase()
  const normalizedCallsign = normalizeCallsign(callsign)

  try {
    const { data, error } = await supabase.rpc('find_public_profile_uid', {
      p_user_id: userId,
      p_callsign: normalizedCallsign || null,
    })
    if (error) throw error
    const uid = Array.isArray(data) ? data[0]?.uid ?? data[0] : data
    if (uid) return uid
  } catch (error) {
    if (!isMissingRpc(error)) {
      // ignore and fall through to direct query fallback
    }
  }

  if (userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('uid, is_active')
      .eq('id', userId)
      .maybeSingle()
    if (!error && data?.uid && data.is_active !== false) return data.uid
    if (error && !isQueryBlocked(error)) throw error
  }

  if (normalizedCallsign) {
    const { data, error } = await supabase
      .from('profiles')
      .select('uid, is_active')
      .ilike('callsign', normalizedCallsign)
      .maybeSingle()
    if (!error && data?.uid && data.is_active !== false) return data.uid
    if (error && !isQueryBlocked(error)) throw error
  }

  return null
}

export async function fetchPublicProfileByUid(uid) {
  if (!supabaseEnabled || !uid) return null
  const parsedUid = parsePublicUid(uid)
  if (!parsedUid) return null
  const supabase = requireSupabase()

  try {
    const { data, error } = await supabase.rpc('get_public_profile', {
      p_uid: parsedUid,
    })
    if (error) throw error
    return normalizeProfile(firstRow(data))
  } catch (error) {
    if (!isMissingRpc(error)) {
      // ignore and fall through to direct query fallback
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, nickname, avatar_url, bio, callsign, grid_locator, certifications, role, created_at, uid, is_active')
    .eq('uid', parsedUid)
    .maybeSingle()
  if (error) {
    if (isQueryBlocked(error)) return null
    throw error
  }
  if (!data || data.is_active === false) return null
  return normalizeProfile(data)
}
