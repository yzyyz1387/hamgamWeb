import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const legacyInput = process.env.LEGACY_SOURCE || process.env.LEGACY_ROOT || process.argv[2]
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const dryRun = process.argv.includes('--dry-run')

if (!supabaseUrl || !serviceRoleKey || !legacyInput) {
  console.error(
    'Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... LEGACY_SOURCE=/path/to/hamgam-main-or-zip npm run migrate:legacy',
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const manualFilenameFixes = new Map([
  ['恋爱版DMS.jpg', '#U604b#U7231#U7248DMS .jpg'],
  ['暑假去哪儿.jpg', '#U6691#U5047#U53bb#U90a3#U513f.jpg'],
  ['Itx.png', 'ltx.png'],
])

function encodeLegacyFilename(name) {
  return Array.from(name || '')
    .map((char) => {
      const code = char.codePointAt(0)
      if (code >= 0x20 && code <= 0x7e) return char
      return `#U${code.toString(16)}`
    })
    .join('')
}

function guessMime(filename) {
  const ext = path.extname(filename || '').toLowerCase()
  return (
    {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
    }[ext] || 'application/octet-stream'
  )
}

function simpleHash(input) {
  let hash = 0
  const value = String(input || '')
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

function createLegacySlug(title, index, legacyUrl) {
  const normalized = String(title || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

  if (normalized) return `${normalized}-${String(index).padStart(3, '0')}`
  return `legacy-${String(index).padStart(3, '0')}-${simpleHash(legacyUrl || title)}`
}

function normalizeDate(input) {
  if (!input) return new Date().toISOString()
  const parsed = new Date(input)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  return new Date().toISOString()
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function ensureDirectory(targetPath) {
  const stats = await fs.stat(targetPath)
  if (!stats.isDirectory()) {
    throw new Error(`Expected directory but got file: ${targetPath}`)
  }
  return targetPath
}

async function findLegacyRoot(basePath) {
  const directJson = path.join(basePath, 'pic_res.json')
  const directImg = path.join(basePath, 'img')
  if ((await pathExists(directJson)) && (await pathExists(directImg))) {
    return basePath
  }

  const entries = await fs.readdir(basePath, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const candidate = path.join(basePath, entry.name)
    const candidateJson = path.join(candidate, 'pic_res.json')
    const candidateImg = path.join(candidate, 'img')
    if ((await pathExists(candidateJson)) && (await pathExists(candidateImg))) {
      return candidate
    }
  }

  throw new Error(`Could not find pic_res.json and img/ under: ${basePath}`)
}

async function resolveLegacyRoot(inputPath) {
  const absoluteInput = path.resolve(inputPath)
  const stats = await fs.stat(absoluteInput)

  if (stats.isDirectory()) {
    return { legacyRoot: await findLegacyRoot(await ensureDirectory(absoluteInput)), cleanupDir: null }
  }

  if (!absoluteInput.toLowerCase().endsWith('.zip')) {
    throw new Error(`Unsupported legacy source: ${absoluteInput}. Use hamgam-main directory or hamgam-main.zip.`)
  }

  const tempBase = await fs.mkdtemp(path.join(os.tmpdir(), 'hamgam-legacy-'))
  execFileSync('unzip', ['-q', absoluteInput, '-d', tempBase], { stdio: 'inherit' })
  const legacyRoot = await findLegacyRoot(tempBase)
  return { legacyRoot, cleanupDir: tempBase }
}

async function buildFileLookup(imgDir) {
  const filenames = await fs.readdir(imgDir)
  const exactMap = new Map()
  const lowerMap = new Map()
  for (const name of filenames) {
    exactMap.set(name, name)
    lowerMap.set(name.toLowerCase(), name)
  }
  return { filenames, exactMap, lowerMap }
}

function resolveActualFilename(legacyUrl, fileLookup) {
  const attempts = [legacyUrl, encodeLegacyFilename(legacyUrl), manualFilenameFixes.get(legacyUrl)]
    .filter(Boolean)
    .flatMap((item) => [item, item.trim(), item.replace(/\s+\./g, '.')])

  for (const candidate of attempts) {
    if (fileLookup.exactMap.has(candidate)) return fileLookup.exactMap.get(candidate)
    if (fileLookup.lowerMap.has(candidate.toLowerCase())) return fileLookup.lowerMap.get(candidate.toLowerCase())
  }
  return null
}

function printSection(title, rows) {
  console.log(`\n${title}`)
  if (!rows.length) {
    console.log('  (none)')
    return
  }
  for (const row of rows) {
    console.log(`  - ${row}`)
  }
}

async function writeReport(report) {
  const reportPath = path.resolve(process.cwd(), 'legacy-migration-report.json')
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(`\nWrote report: ${reportPath}`)
}

async function main() {
  const { legacyRoot, cleanupDir } = await resolveLegacyRoot(legacyInput)
  const imgDir = path.join(legacyRoot, 'img')
  const jsonPath = path.join(legacyRoot, 'pic_res.json')
  const markdownPath = path.join(legacyRoot, 'pic_res.md')

  console.log(`Legacy source: ${legacyInput}`)
  console.log(`Resolved root: ${legacyRoot}`)
  console.log(`Dry run     : ${dryRun ? 'yes' : 'no'}`)

  const fileLookup = await buildFileLookup(imgDir)
  const rawJson = JSON.parse(await fs.readFile(jsonPath, 'utf8'))
  const records = Object.entries(rawJson).map(([title, info], index) => ({
    index: index + 1,
    title,
    ...info,
  }))

  const missing = []
  const migratedTitles = []
  const usedActualFilenames = new Set()
  const mismatchRows = []
  let migrated = 0

  for (const record of records) {
    const actualFilename = resolveActualFilename(record.url, fileLookup)
    if (!actualFilename) {
      missing.push(record)
      console.warn(`MISS  ${record.index}: ${record.title} -> ${record.url}`)
      continue
    }

    usedActualFilenames.add(actualFilename)
    if (actualFilename !== record.url) {
      mismatchRows.push(`[${record.index}] ${record.url} => ${actualFilename}`)
    }

    const absolutePath = path.join(imgDir, actualFilename)
    const fileBuffer = await fs.readFile(absolutePath)
    const mimeType = guessMime(actualFilename)
    const ext = path.extname(actualFilename).toLowerCase()
    const slug = createLegacySlug(record.title, record.index, record.url)
    const objectPath = `legacy/${String(record.index).padStart(4, '0')}-${slug}${ext}`

    if (!dryRun) {
      const { error: uploadError } = await supabase.storage.from('gallery-images').upload(objectPath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      })
      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('gallery-images').getPublicUrl(objectPath)

      const row = {
        slug,
        legacy_url: record.url,
        title: record.title,
        description: record.dec || '',
        contributor_name: record.contributor || '佚名',
        uploader_display_name: record.contributor || '佚名',
        storage_bucket: 'gallery-images',
        storage_path: objectPath,
        image_url: publicUrl,
        mime_type: mimeType,
        file_size: fileBuffer.length,
        legacy_updated_at: normalizeDate(record.update),
        published_at: normalizeDate(record.update),
        status: 'PUBLISHED',
        metadata: {
          legacy_source: 'hamgam-main',
          legacy_filename: actualFilename,
          legacy_index: record.index,
        },
      }

      const { error: dbError } = await supabase.from('images').upsert(row, {
        onConflict: 'legacy_url',
      })
      if (dbError) throw dbError
    }

    migrated += 1
    migratedTitles.push(record.title)
    console.log(`${dryRun ? 'DRY' : 'OK '}  ${record.index}/${records.length}  ${record.title}`)
  }

  const orphanFiles = fileLookup.filenames.filter((name) => !usedActualFilenames.has(name))
  const report = {
    legacyInput: path.resolve(legacyInput),
    legacyRoot,
    dryRun,
    totals: {
      indexedRecords: records.length,
      imageFiles: fileLookup.filenames.length,
      migrated,
      missing: missing.length,
      mismatchedFilenames: mismatchRows.length,
      orphanFiles: orphanFiles.length,
    },
    files: {
      jsonPath,
      imgDir,
      markdownPath: (await pathExists(markdownPath)) ? markdownPath : null,
    },
    mismatchedFilenames: mismatchRows,
    missingRecords: missing.map((item) => ({ index: item.index, title: item.title, url: item.url })),
    orphanFiles,
    migratedTitles,
  }

  console.log('\nMigration finished')
  console.log(`- indexed records     : ${records.length}`)
  console.log(`- image files         : ${fileLookup.filenames.length}`)
  console.log(`- migrated            : ${migrated}`)
  console.log(`- missing             : ${missing.length}`)
  console.log(`- filename mismatches : ${mismatchRows.length}`)
  console.log(`- orphan files        : ${orphanFiles.length}`)

  printSection('Filename mismatches', mismatchRows)
  printSection(
    'Orphan image files (exist in img/ but not indexed by pic_res.json)',
    orphanFiles,
  )

  if (cleanupDir) {
    await fs.rm(cleanupDir, { recursive: true, force: true })
  }

  await writeReport(report)
}

main().catch((error) => {
  console.error('\nMigration failed:')
  console.error(error)
  process.exit(1)
})
