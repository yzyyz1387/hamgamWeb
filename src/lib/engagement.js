import { siteConfig } from '@/config/site'
import { requireSupabase, supabaseEnabled } from '@/lib/supabase'

export async function fetchMyImageReactions(imageId, userId) {
  if (!supabaseEnabled || !imageId || !userId) return []
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('image_reactions')
    .select('emoji')
    .eq('image_id', imageId)
    .eq('user_id', userId)
  if (error) throw error
  return (data || []).map((item) => item.emoji)
}

export async function toggleImageReaction({ imageId, userId, emoji, active }) {
  const supabase = requireSupabase()
  if (active) {
    const { error } = await supabase
      .from('image_reactions')
      .delete()
      .eq('image_id', imageId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
    if (error) throw error
    return false
  }
  const { error } = await supabase.from('image_reactions').insert({
    image_id: imageId,
    user_id: userId,
    emoji,
  })
  if (error) throw error
  return true
}

export async function fetchVisibleComments(imageId) {
  if (!supabaseEnabled || !imageId) return []
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('image_id', imageId)
    .eq('status', 'VISIBLE')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createComment({ imageId, userId, content }) {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('comments')
    .insert({
      image_id: imageId,
      user_id: userId,
      content,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function createSubmissionPreview(path, expiresIn = 120) {
  if (!supabaseEnabled || !path) return ''
  const supabase = requireSupabase()
  const { data, error } = await supabase.storage
    .from(siteConfig.submissionBucket)
    .createSignedUrl(path, expiresIn)
  if (error) throw error
  return data?.signedUrl || ''
}

/**
 * 根据呼号查找匹配用户的 uid
 * 优先匹配 callsign 字段（已认证呼号），其次匹配 uploader_id
 */
export async function findUserByCallsign(callsign, uploaderId) {
  if (!supabaseEnabled) return null
  const supabase = requireSupabase()

  // 1. 如果图片有 uploader_id，直接用
  if (uploaderId) {
    const { data } = await supabase
      .from('profiles').select('uid').eq('id', uploaderId).maybeSingle()
    if (data?.uid) return data.uid
  }

  // 2. 按呼号匹配（大小写不敏感）
  if (callsign) {
    const { data } = await supabase
      .from('profiles').select('uid')
      .ilike('callsign', callsign).maybeSingle()
    if (data?.uid) return data.uid
  }

  return null
}
