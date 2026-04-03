export const siteConfig = {
  name: import.meta.env.VITE_SITE_NAME || '🍔 Hamburger',
  title: import.meta.env.VITE_SITE_TITLE || '汉堡图集 Hamburger - 业余无线电图片分享社区',
  description:
    import.meta.env.VITE_SITE_DESCRIPTION || '汉堡图集 Hamburger 是一个专注于业余无线电、HAM圈的图片分享社区。收录业余电台、无线电软件、无线电表情包、HAM圈趣图等内容。BD8CWG 创建，为业余无线电爱好者提供图片分享平台。',
  keywords: import.meta.env.VITE_SITE_KEYWORDS || '业余无线电,业余电台,无线电软件,无线电表情包,HAM,HAM圈,BD8CWG,业余无线电爱好者,电台图片,无线电社区,无线电图片分享,火腿圈,无线电表情,电台表情包',
  author: import.meta.env.VITE_SITE_AUTHOR || 'BD8CWG',
  url: import.meta.env.VITE_SITE_URL || 'https://g.seeku.site',
  icp: import.meta.env.VITE_SITE_ICP || '',
  moeIcp: import.meta.env.VITE_SITE_MOE_ICP || '202xxxxx',
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
