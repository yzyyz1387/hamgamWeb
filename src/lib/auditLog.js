/**
 * 审计日志格式化工具
 * 输入：原始 audit_logs 行 + 昵称映射表
 * 输出：适合展示的 view model
 */

const ACTION_LABELS = {
  'auth.signed_in': '登录了系统',
  'submission.created': '提交了投稿',
  'submission.published': '通过并发布了投稿',
  'submission.rejected': '驳回了投稿',
  'user.updated': '更新了用户信息',
  'profile.updated': '更新了个人资料',
  'profile.password_changed': '更新了账户密码',
  'notification.broadcast': '广播了系统通知',
  'notification.sent': '发送了通知',
  'notification.read': '阅读了通知',
  'image.hidden': '隐藏了图片',
  'image.shown': '恢复显示图片',
  'image.deleted': '删除了图片',
  'image.edit_requested': '请求编辑图片',
  'image.edit_approved': '批准了图片编辑',
  'image.edit_rejected': '驳回了图片编辑',
  'callsign.approved': '通过了呼号认证',
  'callsign.rejected': '驳回了呼号认证',
  'comment.created': '发表了评论',
  'comment.replied': '回复了评论',
  'reaction.added': '添加了反应',
  'reaction.removed': '移除了反应',
}

const ACTION_LEVEL = {
  'auth.signed_in': 'info',
  'submission.created': 'info',
  'submission.published': 'success',
  'submission.rejected': 'warn',
  'user.updated': 'info',
  'profile.updated': 'info',
  'profile.password_changed': 'warn',
  'notification.broadcast': 'info',
  'notification.sent': 'info',
  'notification.read': 'info',
  'image.hidden': 'warn',
  'image.shown': 'success',
  'image.deleted': 'error',
  'image.edit_requested': 'info',
  'image.edit_approved': 'success',
  'image.edit_rejected': 'warn',
  'callsign.approved': 'success',
  'callsign.rejected': 'warn',
  'comment.created': 'info',
  'comment.replied': 'info',
  'reaction.added': 'info',
  'reaction.removed': 'info',
}

/**
 * 批量提取日志中涉及的所有 UUID，用于预加载昵称
 */
export function extractUuidsFromLogs(logs) {
  const uuids = new Set()
  for (const log of logs) {
    if (log.actor_id) uuids.add(log.actor_id)
    if (log.entity_type === 'profile' && log.entity_id) uuids.add(log.entity_id)
    const d = log.details || {}
    if (d.uploader_id) uuids.add(d.uploader_id)
    if (d.target_user_id) uuids.add(d.target_user_id)
    if (d.user_id) uuids.add(d.user_id)
  }
  return [...uuids]
}

/**
 * 格式化单条日志为 view model
 * @param {object} log - 原始日志行
 * @param {Map<string, {nickname, uid}>} nickMap - uuid -> {nickname, uid}
 */
export function formatAuditLog(log, nickMap = new Map()) {
  const d = log.details || {}
  const action = log.action || ''
  const level = ACTION_LEVEL[action] || 'info'

  function resolveUser(uuid) {
    if (!uuid) return null
    const info = nickMap.get(uuid)
    return info ? { label: info.nickname || uuid, uid: info.uid, uuid } : { label: uuid, uid: null, uuid }
  }

  const actor = resolveUser(log.actor_id)

  let description = ACTION_LABELS[action] || action
  let subject = null
  let extra = null

  switch (action) {
    case 'auth.signed_in':
      description = '登录了系统'
      extra = d.email || d.device_info || null
      break

    case 'submission.created':
      description = '提交了投稿'
      extra = d.title ? `《${d.title}》` : null
      break

    case 'submission.published':
      description = '通过并发布了投稿'
      extra = d.title ? `《${d.title}》` : null
      if (d.reviewer_note) extra += `，备注：${d.reviewer_note}`
      break

    case 'submission.rejected':
      description = '驳回了投稿'
      extra = d.title ? `《${d.title}》` : null
      if (d.reviewer_note) extra += `，原因：${d.reviewer_note}`
      break

    case 'user.updated': {
      description = '更新了用户'
      const targetUuid = log.entity_id || d.target_user_id
      subject = resolveUser(targetUuid)
      const changes = []
      if (d.old_role !== d.new_role && d.new_role) {
        const roleMap = { SUPER_ADMIN: '超级管理员', REVIEWER: '审核员', USER: '普通用户' }
        changes.push(`角色 → ${roleMap[d.new_role] || d.new_role}`)
      }
      if (d.old_active !== d.new_active && d.new_active !== undefined) {
        changes.push(d.new_active ? '账号已启用' : '账号已停用')
      }
      if (d.old_certifications !== undefined && d.new_certifications !== undefined) {
        changes.push('认证信息已更新')
      }
      extra = changes.length ? changes.join('、') : null
      break
    }

    case 'profile.updated': {
      description = '更新了个人资料'
      subject = resolveUser(log.entity_id || actor?.uuid)
      const changedFields = []
      if (d.nickname !== undefined) changedFields.push('昵称')
      if (d.bio !== undefined) changedFields.push('简介')
      if (d.grid_locator !== undefined) changedFields.push('网格')
      if (d.avatar_url !== undefined) changedFields.push('头像')
      extra = changedFields.length ? `字段：${changedFields.join('、')}` : null
      break
    }

    case 'profile.password_changed':
      description = '更新了账户密码'
      subject = resolveUser(log.entity_id || actor?.uuid)
      extra = '密码已修改'
      break

    case 'notification.broadcast':
      description = '广播了系统通知'
      extra = d.title ? `《${d.title}》` : null
      if (d.count !== undefined) extra = (extra || '') + `，共 ${d.count} 人`
      break

    case 'image.hidden':
      description = '隐藏了图片'
      extra = d.title ? `《${d.title}》` : d.slug || null
      break

    case 'image.shown':
      description = '恢复显示图片'
      extra = d.title ? `《${d.title}》` : d.slug || null
      break

    case 'image.deleted':
      description = '删除了图片'
      extra = d.title ? `《${d.title}》` : d.slug || null
      break

    case 'callsign.approved':
      description = '通过了呼号认证'
      subject = resolveUser(d.target_user_id)
      extra = d.callsign || null
      if (d.reviewer_note) extra = `${extra ? `${extra}，` : ''}备注：${d.reviewer_note}`
      break

    case 'callsign.rejected':
      description = '驳回了呼号认证'
      subject = resolveUser(d.target_user_id)
      extra = d.callsign || null
      if (d.reviewer_note) extra = `${extra ? `${extra}，` : ''}原因：${d.reviewer_note}`
      break

    case 'comment.created':
      description = '发表了评论'
      extra = d.content_preview || null
      break

    case 'comment.replied':
      description = '回复了评论'
      extra = d.reply_to_user ? `回复给 ${d.reply_to_user}` : null
      if (d.content_preview) extra = `${extra || ''}：${d.content_preview}`
      break

    case 'reaction.added':
      description = '添加了反应'
      extra = d.emoji || null
      break

    case 'reaction.removed':
      description = '移除了反应'
      extra = d.emoji || null
      break

    case 'notification.sent':
      description = '发送了通知'
      subject = resolveUser(d.target_user_id)
      extra = d.notification_title || null
      break

    case 'notification.read':
      description = '阅读了通知'
      extra = d.notification_title || null
      if (d.read_type) {
        extra = `${extra || ''}（${d.read_type === 'click' ? '点击阅读' : '一键已读'}）`
      }
      break

    case 'image.edit_requested':
      description = '请求编辑图片'
      extra = d.edit_reason || null
      break

    case 'image.edit_approved':
      description = '批准了图片编辑'
      extra = d.image_title ? `《${d.image_title}》` : null
      break

    case 'image.edit_rejected':
      description = '驳回了图片编辑'
      extra = d.edit_reason || null
      break

    default:
      description = action
      break
  }

  const imageSlug = d.image_slug || d.slug || null

  return {
    id: log.id,
    time: log.created_at,
    action,
    level,
    actor,
    description,
    subject,
    extra,
    imageSlug,
    imageTitle: d.image_title || d.title || null,
    raw: log,
  }
}
