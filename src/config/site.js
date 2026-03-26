export const siteConfig = {
  name: import.meta.env.VITE_SITE_NAME || '🍔 Hamburger',
  description:
    import.meta.env.VITE_SITE_DESCRIPTION || '汉堡图集，一个收录 HAM 圈有趣图片的树洞',
  icp: import.meta.env.VITE_SITE_ICP || '',
  galleryBucket: import.meta.env.VITE_PUBLIC_GALLERY_BUCKET || 'gallery-images',
  submissionBucket:
    import.meta.env.VITE_PRIVATE_SUBMISSION_BUCKET || 'submission-images',
  enableSignup: import.meta.env.VITE_ENABLE_SIGNUP !== 'false',
}

export const defaultReactionSet = (
  import.meta.env.VITE_DEFAULT_REACTION_SET || '❤️,👍,😂,😭,🔥,👀,😮,🤔,🥰,👏'
)
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
