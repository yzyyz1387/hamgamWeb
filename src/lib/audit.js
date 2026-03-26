import { requireSupabase, supabaseEnabled } from '@/lib/supabase'

export async function safeInsertAuditLog({ action, entityType, entityId = null, details = {} } = {}) {
  if (!supabaseEnabled || !action || !entityType) return null
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase.rpc('insert_audit_log', {
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_details: details || {},
    })
    if (error) throw error
    return data || null
  } catch {
    return null
  }
}
