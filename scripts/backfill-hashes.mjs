import process from 'node:process'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

const require = createRequire(import.meta.url)
const { Jimp } = require('jimp')
const galleryBucket = process.env.VITE_PUBLIC_GALLERY_BUCKET || 'gallery-images'
const submissionBucket = process.env.VITE_PRIVATE_SUBMISSION_BUCKET || 'submission-images'

function parseArgs(argv) {
  const options = {
    table: 'all',
    batchSize: 25,
    limit: 0,
    force: false,
    dryRun: false,
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--table') {
      options.table = String(argv[i + 1] || 'all')
      i += 1
      continue
    }
    if (arg === '--batch-size') {
      options.batchSize = Math.max(1, Math.min(100, Number(argv[i + 1] || 25)))
      i += 1
      continue
    }
    if (arg === '--limit') {
      options.limit = Math.max(0, Number(argv[i + 1] || 0))
      i += 1
      continue
    }
    if (arg === '--force') {
      options.force = true
      continue
    }
    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }
    if (arg === '--supabase-url') {
      options.supabaseUrl = String(argv[i + 1] || '')
      i += 1
      continue
    }
    if (arg === '--service-role-key') {
      options.serviceRoleKey = String(argv[i + 1] || '')
      i += 1
    }
  }

  if (!['images', 'submissions', 'all'].includes(options.table)) {
    throw new Error(`Unsupported --table value: ${options.table}`)
  }

  return options
}

function createSupabase(options) {
  if (!options.supabaseUrl || !options.serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  }

  return createClient(options.supabaseUrl, options.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function getBuckets(table, record) {
  if (table === 'images') {
    return String(record.storage_bucket || galleryBucket)
  }
  return String(record.storage_bucket || submissionBucket)
}

async function downloadBinary(supabase, table, record) {
  const bucket = getBuckets(table, record)
  const storagePath = String(record.storage_path || '')

  if (storagePath) {
    const { data, error } = await supabase.storage.from(bucket).download(storagePath)
    if (!error && data) {
      return Buffer.from(await data.arrayBuffer())
    }
  }

  const fallbackUrl = String(record.image_url || '')
  if (!fallbackUrl) {
    throw new Error('No downloadable image source available')
  }

  const response = await fetch(fallbackUrl)
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

async function computePHash(buffer) {
  const image = await Jimp.read(buffer)
  const resized = image.resize({ w: 8, h: 8 }).greyscale()
  const pixels = []
  const { data } = resized.bitmap

  for (let i = 0; i < data.length; i += 4) {
    pixels.push(data[i])
  }

  const avg = pixels.reduce((sum, value) => sum + value, 0) / pixels.length
  let binary = ''
  for (const pixel of pixels) {
    binary += pixel >= avg ? '1' : '0'
  }

  let hex = ''
  for (let i = 0; i < binary.length; i += 4) {
    hex += parseInt(binary.slice(i, i + 4), 2).toString(16)
  }
  return hex
}

function computeMD5(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex')
}

async function getMissingCount(supabase, table, force) {
  let query = supabase.from(table).select('id', { count: 'exact', head: true })
  if (!force) {
    query = query.or('phash.is.null,file_md5.is.null')
  }
  const { count, error } = await query
  if (error) throw error
  return count || 0
}

async function fetchBatch(supabase, table, options, excludedIds) {
  const selectFields = table === 'images'
    ? 'id, title, image_url, storage_bucket, storage_path, phash, file_md5, created_at'
    : 'id, title, storage_bucket, storage_path, phash, file_md5, created_at'

  let query = supabase
    .from(table)
    .select(selectFields)
    .order('created_at', { ascending: true })
    .limit(options.batchSize)

  if (!options.force) {
    query = query.or('phash.is.null,file_md5.is.null')
  }

  if (excludedIds.size) {
    query = query.not('id', 'in', `(${Array.from(excludedIds).join(',')})`)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

async function processRecord(supabase, table, record, options) {
  const buffer = await downloadBinary(supabase, table, record)
  const [phash, fileMd5] = await Promise.all([
    computePHash(buffer),
    Promise.resolve(computeMD5(buffer)),
  ])

  if (options.dryRun) {
    return { phash, fileMd5, skippedUpdate: true }
  }

  const { error } = await supabase
    .from(table)
    .update({
      phash,
      file_md5: fileMd5,
    })
    .eq('id', record.id)

  if (error) throw error
  return { phash, fileMd5, skippedUpdate: false }
}

async function processTable(supabase, table, options) {
  const title = table === 'images' ? 'images' : 'submissions'
  const initialMissing = await getMissingCount(supabase, table, options.force)
  const excludedIds = new Set()

  console.log(`\n[${title}] start`)
  console.log(`[${title}] missing before: ${initialMissing}`)

  let processed = 0
  let failed = 0
  let rounds = 0

  while (true) {
    if (options.limit > 0 && processed >= options.limit) break
    rounds += 1

    const batch = await fetchBatch(supabase, table, options, excludedIds)
    if (!batch.length) break

    console.log(`[${title}] batch ${rounds}: ${batch.length} record(s)`)

    for (const record of batch) {
      if (options.limit > 0 && processed >= options.limit) break

      try {
        const result = await processRecord(supabase, table, record, options)
        processed += 1
        console.log(
          `[${title}] ok   ${record.id}  ${record.title || '(untitled)'}  phash=${result.phash} md5=${result.fileMd5}${result.skippedUpdate ? ' [dry-run]' : ''}`,
        )
      } catch (error) {
        failed += 1
        excludedIds.add(record.id)
        console.error(`[${title}] fail ${record.id}  ${record.title || '(untitled)'}  ${error.message || error}`)
      }
    }
  }

  const missingAfter = options.dryRun ? initialMissing : await getMissingCount(supabase, table, options.force)
  console.log(`[${title}] done. processed=${processed} failed=${failed} missing after=${missingAfter}`)
  return { processed, failed, missingBefore: initialMissing, missingAfter }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const supabase = createSupabase(options)
  const tables = options.table === 'all' ? ['images', 'submissions'] : [options.table]

  console.log('Hash backfill options:')
  console.log(JSON.stringify({
    table: options.table,
    batchSize: options.batchSize,
    limit: options.limit,
    force: options.force,
    dryRun: options.dryRun,
    supabaseUrl: options.supabaseUrl,
    serviceRoleKeyProvided: Boolean(options.serviceRoleKey),
  }, null, 2))

  const summary = []
  for (const table of tables) {
    summary.push({ table, ...(await processTable(supabase, table, options)) })
  }

  console.log('\nSummary:')
  for (const row of summary) {
    console.log(
      `${row.table}: processed=${row.processed}, failed=${row.failed}, missingBefore=${row.missingBefore}, missingAfter=${row.missingAfter}`,
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
