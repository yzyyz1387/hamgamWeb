// 使用 DiceBear API 生成 50 个预设头像（notionists 风格，无需注册，免费使用）
export const presetAvatarUrls = Array.from({ length: 50 }, (_, i) => {
  const seed = String(i + 1).padStart(2, '0')
  return `https://api.dicebear.com/9.x/notionists/svg?seed=HamGam-${seed}`
})

export function isPresetAvatarUrl(value) {
  if (!value) return false
  return value.includes('api.dicebear.com') || value.startsWith('/preset-avatars/')
}
