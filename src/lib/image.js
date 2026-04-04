export function normalizeReactionSummary(summary) {
  if (!summary) return []
  let source = summary
  if (typeof summary === 'string') {
    try {
      source = JSON.parse(summary)
    } catch {
      source = []
    }
  }
  if (!Array.isArray(source)) return []
  return source
    .map((item) => ({
      emoji: item.emoji,
      count: Number(item.count || 0),
    }))
    .filter((item) => item.emoji && item.count > 0)
    .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji))
}

function pickNumericDimension(...values) {
  for (const value of values) {
    const numeric = Number(value)
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric
    }
  }
  return null
}

export function normalizeImageRecord(record) {
  const metadata = record?.metadata && typeof record.metadata === 'object' ? record.metadata : {}
  const metadataDimensions = metadata.dimensions && typeof metadata.dimensions === 'object'
    ? metadata.dimensions
    : {}
  const width = pickNumericDimension(
    record?.image_width,
    record?.width,
    metadata?.image_width,
    metadata?.width,
    metadataDimensions?.width,
  )
  const height = pickNumericDimension(
    record?.image_height,
    record?.height,
    metadata?.image_height,
    metadata?.height,
    metadataDimensions?.height,
  )

  if (!record) return null
  return {
    ...record,
    reaction_summary: normalizeReactionSummary(record.reaction_summary),
    comments_count: Number(record.comments_count || 0),
    reaction_total_count: Number(record.reaction_total_count || 0),
    contributor_name: record.contributor_name || record.uploader_display_name || '佚名',
    sort_at:
      record.legacy_updated_at || record.published_at || record.created_at || record.updated_at,
    edit_status: record.edit_status || 'NONE',
    edit_reason: record.edit_reason || null,
    original_image_url: record.original_image_url || null,
    edit_requested_at: record.edit_requested_at || null,
    edit_requested_by: record.edit_requested_by || null,
    image_width: width,
    image_height: height,
  }
}
