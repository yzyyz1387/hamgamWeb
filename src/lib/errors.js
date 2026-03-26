const SUPABASE_ERROR_MAP = {
  'Invalid login credentials': '邮箱或密码不正确，请重新输入。',
  'Email not confirmed': '邮箱尚未验证，请前往邮箱点击确认链接后再登录。',
  'User already registered': '该邮箱已注册，请直接登录。',
  'Password should be at least 6 characters': '密码至少需要 6 位。',
  'signup is disabled': '当前站点暂未开放注册。',
  'User not found': '账户不存在，请检查邮箱是否正确。',
  'Email rate limit exceeded': '操作过于频繁，请稍后再试。',
  'over_email_send_rate_limit': '邮件发送过于频繁，请稍后再试。',
  'Too many requests': '请求过于频繁，请稍后再试。',
  'JWT expired': '登录已过期，请重新登录。',
  'invalid claim: missing sub claim': '登录状态异常，请重新登录。',
  // 新增
  'For security purposes, you can only request this after': '操作过于频繁，请稍后再试。',
  'Password recovery requires an email': '请输入注册邮箱。',
  'Unable to validate email address': '邮箱格式不正确。',
  'New password should be different from the old password': '新密码不能与旧密码相同。',
  'Auth session missing': '登录状态已失效，请重新登录。',
  'refresh_token_not_found': '登录已过期，请重新登录。',
  'invalid_grant': '登录凭证无效，请重新登录。',
}

export function getErrorMessage(error, fallback = '操作失败，请稍后重试。') {
  if (!error) return fallback
  if (typeof error === 'string') return error

  const msg = error.message || ''

  // 精确匹配
  if (SUPABASE_ERROR_MAP[msg]) return SUPABASE_ERROR_MAP[msg]

  // 模糊匹配
  for (const [key, value] of Object.entries(SUPABASE_ERROR_MAP)) {
    if (msg.toLowerCase().includes(key.toLowerCase())) return value
  }

  if (msg) return msg
  return fallback
}
