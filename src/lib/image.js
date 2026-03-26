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

export function normalizeImageRecord(record) {
  if (!record) return null
  return {
    ...record,
    reaction_summary: normalizeReactionSummary(record.reaction_summary),
    comments_count: Number(record.comments_count || 0),
    reaction_total_count: Number(record.reaction_total_count || 0),
    contributor_name: record.contributor_name || record.uploader_display_name || '佚名',
    sort_at:
      record.legacy_updated_at || record.published_at || record.created_at || record.updated_at,
  }
}
