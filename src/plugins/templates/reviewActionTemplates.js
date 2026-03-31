const DEFAULT_ACTION = {
  id: '',
  label: '',
  target: '',
  variant: 'filled-tonal',
  appearance: 'secondary',
  icon: '',
  menuOnly: false,
  requiresSelection: true,
  confirmTitle: '',
  confirmText: '',
  order: 500,
  group: 'general',
  summary: '',
  templateKind: 'custom',
  meta: {},
}

export function defineReviewBulkActionTemplate(action = {}) {
  return {
    ...DEFAULT_ACTION,
    ...action,
    meta: { ...(action.meta || {}) },
  }
}

export function createCopyFieldReviewAction(options = {}) {
  const field = options.field ?? options.extractor ?? 'id'
  const copiedLabel = options.copiedLabel || options.label || '内容'
  return defineReviewBulkActionTemplate({
    icon: options.icon || 'content_copy--rounded',
    appearance: options.appearance || 'secondary',
    templateKind: 'copy-field',
    group: options.group || 'copy',
    summary: options.summary || `批量复制${copiedLabel}`,
    ...options,
    async onClick({ api }) {
      return api.review.copyField(field, copiedLabel, {
        unique: options.unique !== false,
        separator: options.separator || '\n',
        toast: options.toast,
        toastEmpty: options.toastEmpty,
      })
    },
  })
}

export function createSelectionSummaryReviewAction(options = {}) {
  return defineReviewBulkActionTemplate({
    icon: options.icon || 'checklist_rtl--rounded',
    appearance: options.appearance || 'neutral',
    requiresSelection: false,
    templateKind: 'selection-summary',
    group: options.group || 'inspect',
    summary: options.summary || '查看当前选择概况',
    ...options,
    async onClick({ api }) {
      const count = api.review.count()
      const labels = api.review.values(options.extractor || 'title', { unique: true }).slice(0, options.limit || 8)
      const suffix = labels.length ? `\n${labels.join('\n')}` : ''
      api.toast(`当前已选择 ${count} 项。${suffix}`, options.toastType || 'info')
      return { count, labels }
    },
  })
}
