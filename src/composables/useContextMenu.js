import ContextMenu from '@imengyu/vue3-context-menu'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { showToast } from '@/lib/toast'

export function useContextMenu() {
  const router = useRouter()
  const auth = useAuthStore()

  function showContextMenu(e) {
    e.preventDefault()
    
    const selection = window.getSelection()
    const selectedText = selection?.toString().trim() || ''
    
    const target = e.target
    const isImage = target.tagName === 'IMG' || target.closest('[data-image-slug]')
    const imageElement = target.tagName === 'IMG' ? target : target.closest('[data-image-slug]')
    const imageSlug = imageElement?.dataset?.imageSlug
    const imageId = imageElement?.dataset?.imageId
    const imageSrc = target.tagName === 'IMG' ? target.src : imageElement?.querySelector('img')?.src
    const imageTitle = target.tagName === 'IMG' ? target.alt : imageElement?.querySelector('img')?.alt
    
    if (isImage && imageSlug) {
      showImageMenu(e, imageSrc, imageSlug, imageId, imageTitle)
    } else if (selectedText) {
      showSelectionMenu(e, selectedText)
    } else {
      showDefaultMenu(e)
    }
  }

  function showDefaultMenu(e) {
    ContextMenu.showContextMenu({
      x: e.x,
      y: e.y,
      theme: 'mac',
      items: [
        {
          label: '后退',
          icon: 'mdui-icon:arrow_back',
          disabled: !window.history.state?.back,
          onClick: () => router.back()
        },
        {
          label: '前进',
          icon: 'mdui-icon:arrow_forward',
          disabled: !window.history.state?.forward,
          onClick: () => router.forward()
        },
        {
          label: '刷新',
          icon: 'mdui-icon:refresh',
          onClick: () => window.location.reload()
        },
        {
          divided: true
        },
        {
          label: '主页',
          icon: 'mdui-icon:home',
          onClick: () => router.push('/')
        },
        {
          label: '随机一张',
          icon: 'mdui-icon:shuffle',
          onClick: () => router.push('/random')
        },
        {
          label: '搜索',
          icon: 'mdui-icon:search',
          onClick: () => router.push('/search')
        }
      ]
    })
  }

  function showSelectionMenu(e, text) {
    ContextMenu.showContextMenu({
      x: e.x,
      y: e.y,
      theme: 'mac',
      items: [
        {
          label: '复制',
          icon: 'mdui-icon:content_copy',
          onClick: async () => {
            try {
              await navigator.clipboard.writeText(text)
              showToast('已复制到剪贴板')
            } catch {
              showToast('复制失败')
            }
          }
        },
        {
          label: '搜索',
          icon: 'mdui-icon:search',
          onClick: () => {
            const searchUrl = `/search?q=${encodeURIComponent(text)}`
            router.push(searchUrl)
          }
        },
        {
          divided: true
        },
        {
          label: '后退',
          icon: 'mdui-icon:arrow_back',
          disabled: !window.history.state?.back,
          onClick: () => router.back()
        },
        {
          label: '前进',
          icon: 'mdui-icon:arrow_forward',
          disabled: !window.history.state?.forward,
          onClick: () => router.forward()
        },
        {
          label: '刷新',
          icon: 'mdui-icon:refresh',
          onClick: () => window.location.reload()
        }
      ]
    })
  }

  function showImageMenu(e, imageSrc, imageSlug, imageId, imageTitle) {
    const detailUrl = `${window.location.origin}/image/${imageSlug}`
    
    const items = [
      {
        label: '下载图片',
        icon: 'mdui-icon:download',
        onClick: () => downloadImage(imageSrc, imageTitle)
      },
      {
        label: '复制图片地址',
        icon: 'mdui-icon:link',
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(detailUrl)
            showToast('图片地址已复制')
          } catch {
            showToast('复制失败')
          }
        }
      },
      {
        label: '在新标签页打开',
        icon: 'mdui-icon:open_in_new',
        onClick: () => {
          window.open(`/image/${imageSlug}`, '_blank')
        }
      }
    ]

    if (auth.isLoggedIn && imageId) {
      items.push({
        divided: true
      })

      items.push({
        label: '发表反应',
        icon: 'mdui-icon:emoji_emotions',
        children: [
          { label: '👍 赞', onClick: () => addReaction(imageId, '👍') },
          { label: '❤️ 喜欢', onClick: () => addReaction(imageId, '❤️') },
          { label: '😄 开心', onClick: () => addReaction(imageId, '😄') },
          { label: '😮 惊讶', onClick: () => addReaction(imageId, '😮') },
          { label: '😢 难过', onClick: () => addReaction(imageId, '😢') },
          { label: '🔥 火了', onClick: () => addReaction(imageId, '🔥') },
          { label: '👏 鼓掌', onClick: () => addReaction(imageId, '👏') },
          { label: '🤔 思考', onClick: () => addReaction(imageId, '🤔') }
        ]
      })
    }

    items.push({
      divided: true
    })

    items.push({
      label: '后退',
      icon: 'mdui-icon:arrow_back',
      disabled: !window.history.state?.back,
      onClick: () => router.back()
    })

    items.push({
      label: '前进',
      icon: 'mdui-icon:arrow_forward',
      disabled: !window.history.state?.forward,
      onClick: () => router.forward()
    })

    items.push({
      label: '刷新',
      icon: 'mdui-icon:refresh',
      onClick: () => window.location.reload()
    })

    ContextMenu.showContextMenu({
      x: e.x,
      y: e.y,
      theme: 'mac',
      items
    })
  }

  async function downloadImage(src, title) {
    try {
      const response = await fetch(src)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const ext = src.split('.').pop()?.split('?')[0] || 'jpg'
      const filename = (title || 'image').replace(/[<>:"/\\|?*]/g, '_')
      link.download = `${filename}.${ext}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      showToast('下载已开始')
    } catch {
      window.open(src, '_blank')
      showToast('请右键另存图片')
    }
  }

  async function addReaction(imageId, emoji) {
    try {
      const { requireSupabase } = await import('@/lib/supabase')
      const supabase = requireSupabase()
      
      const { error } = await supabase
        .from('image_reactions')
        .insert({
          image_id: imageId,
          user_id: auth.user.id,
          emoji
        })

      if (error) {
        if (error.code === '23505') {
          showToast(`你已经表达过 ${emoji}`)
        } else {
          throw error
        }
      } else {
        showToast(`已添加反应 ${emoji}`)
      }
    } catch (error) {
      showToast(error.message || '添加反应失败')
    }
  }

  return {
    showContextMenu
  }
}
