import { createClient } from 'jsr:@supabase/supabase-js@2'
import { Jimp } from 'npm:jimp'
import SparkMD5 from 'npm:spark-md5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

async function computePHash(arrayBuffer: ArrayBuffer) {
  const image = await Jimp.read(new Uint8Array(arrayBuffer))
  const resized = image.resize({ w: 8, h: 8 }).greyscale()
  const pixels: number[] = []
  const bitmap = resized.bitmap
  for (let i = 0; i < bitmap.data.length; i += 4) {
    pixels.push(bitmap.data[i])
  }
  const avg = pixels.reduce((a, b) => a + b, 0) / pixels.length
  let binary = ''
  for (const pixel of pixels) {
    binary += pixel >= avg ? '1' : '0'
  }
  let hex = ''
  for (let i = 0; i < binary.length; i += 4) {
    const nibble = binary.slice(i, i + 4)
    hex += parseInt(nibble, 2).toString(16)
  }
  return hex
}

function computeMD5(arrayBuffer: ArrayBuffer) {
  return SparkMD5.ArrayBuffer.hash(arrayBuffer)
}

function decodeJwtPayload(token: string) {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4)
    const json = atob(padded)
    return JSON.parse(json)
  } catch {
    return null
  }
}

function readStringClaim(payload: Record<string, unknown> | null, key: string) {
  const value = payload?.[key]
  return typeof value === 'string' ? value : null
}

function readBooleanClaim(payload: Record<string, unknown> | null, key: string) {
  const value = payload?.[key]
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value === 'true') return true
    if (value === 'false') return false
  }
  return null
}

async function authenticateSuperAdmin(request: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables.')
  }

  const authHeader = request.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) {
    return { error: jsonResponse({ error: 'Missing or invalid Authorization header' }, 401) }
  }

  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) {
    return { error: jsonResponse({ error: 'Missing access token' }, 401) }
  }

  const payload = decodeJwtPayload(token)
  const userId = typeof payload?.sub === 'string' ? payload.sub : null
  const userRole = readStringClaim(payload, 'user_role')
  const isActive = readBooleanClaim(payload, 'is_active')
  if (!userId) {
    return { error: jsonResponse({ error: 'Unauthorized', detail: 'Invalid JWT payload' }, 401) }
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let resolvedRole = userRole
  let resolvedActive = isActive
  let resolvedNickname = readStringClaim(payload, 'nickname') || readStringClaim(payload, 'email') || 'SUPER_ADMIN'

  if (!resolvedRole || resolvedActive === null) {
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('nickname, role, is_active')
      .eq('id', userId)
      .maybeSingle()

    if (profileError || !profile) {
      return { error: jsonResponse({ error: 'Actor profile not found' }, 403) }
    }

    resolvedRole = resolvedRole || profile.role || null
    resolvedActive = resolvedActive ?? profile.is_active ?? null
    resolvedNickname = profile.nickname || resolvedNickname
  }

  if (resolvedRole !== 'SUPER_ADMIN' || resolvedActive === false) {
    return { error: jsonResponse({ error: 'Forbidden' }, 403) }
  }

  return {
    adminClient,
    actorProfile: {
      id: userId,
      nickname: resolvedNickname,
    },
  }
}

async function downloadRecordBinary(adminClient: ReturnType<typeof createClient>, table: string, record: Record<string, unknown>) {
  const bucket = String(record.storage_bucket || (table === 'images' ? 'gallery-images' : 'submission-images'))
  const storagePath = String(record.storage_path || '')
  if (storagePath) {
    const { data, error } = await adminClient.storage.from(bucket).download(storagePath)
    if (!error && data) {
      return await data.arrayBuffer()
    }
  }

  const fallbackUrl = String(record.image_url || '')
  if (!fallbackUrl) {
    throw new Error('没有可下载的图片地址')
  }
  const response = await fetch(fallbackUrl)
  if (!response.ok) {
    throw new Error(`下载图片失败: HTTP ${response.status}`)
  }
  return await response.arrayBuffer()
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    const auth = await authenticateSuperAdmin(request)
    if ('error' in auth) return auth.error
    const { adminClient, actorProfile } = auth

    let payload: { table?: string; batchSize?: number; forceReprocess?: boolean }
    try {
      payload = await request.json()
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400)
    }

    const table = payload.table === 'submissions' ? 'submissions' : 'images'
    const batchSize = Math.min(100, Math.max(1, Number(payload.batchSize) || 10))
    const forceReprocess = payload.forceReprocess === true

    const selectFields = table === 'images'
      ? 'id, title, image_url, storage_bucket, storage_path, phash, file_md5, created_at'
      : 'id, title, storage_bucket, storage_path, phash, file_md5, created_at'

    let countQuery = adminClient.from(table).select('id', { count: 'exact', head: true })
    let listQuery = adminClient.from(table).select(selectFields).order('created_at', { ascending: false }).limit(batchSize)

    if (!forceReprocess) {
      countQuery = countQuery.or('phash.is.null,file_md5.is.null')
      listQuery = listQuery.or('phash.is.null,file_md5.is.null')
    }

    const [{ count, error: countError }, { data: rows, error: listError }] = await Promise.all([countQuery, listQuery])
    if (countError) return jsonResponse({ error: countError.message }, 500)
    if (listError) return jsonResponse({ error: listError.message }, 500)

    const items = rows || []
    if (!items.length) {
      return jsonResponse({
        ok: true,
        table,
        processed: 0,
        failed: 0,
        remaining: 0,
        message: '没有待处理的记录。',
        failures: [],
      })
    }

    let processed = 0
    let failed = 0
    const failures: Array<{ id: string; error: string }> = []

    for (const row of items) {
      try {
        const arrayBuffer = await downloadRecordBinary(adminClient, table, row)
        const [phash, fileMd5] = await Promise.all([
          computePHash(arrayBuffer),
          Promise.resolve(computeMD5(arrayBuffer)),
        ])

        const { error: updateError } = await adminClient
          .from(table)
          .update({ phash, file_md5: fileMd5 })
          .eq('id', String(row.id))

        if (updateError) throw updateError
        processed += 1
      } catch (error) {
        failed += 1
        failures.push({
          id: String(row.id),
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const remaining = Math.max(0, (count || 0) - processed - failed)

    await adminClient.from('audit_logs').insert({
      actor_id: actorProfile.id,
      action: 'hash.batch_processed',
      entity_type: table,
      entity_id: null,
      level: failed > 0 ? 'warn' : 'info',
      details: {
        table,
        batch_size: batchSize,
        processed,
        failed,
        remaining,
        force_reprocess: forceReprocess,
      },
    }).catch(() => null)

    return jsonResponse({
      ok: true,
      table,
      processed,
      failed,
      remaining,
      message: remaining > 0 ? `本轮处理完成，还剩 ${remaining} 条。` : '全部处理完成。',
      failures,
    })
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Unexpected error',
    }, 500)
  }
})
