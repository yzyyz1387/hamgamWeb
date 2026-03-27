<template>
  <div v-if="comments.length" class="comment-list">
    <article v-for="comment in comments" :key="comment.id" class="comment-item">
      <div class="comment-item__head">
        <div class="comment-author">
          <button type="button" class="avatar-trigger" :title="comment.author_display_name" @click="goUser(comment)">
            <div class="user-badge__avatar">
              <img v-if="comment.author_avatar_url" :src="comment.author_avatar_url" alt="avatar" />
              <span v-else>{{ initials(comment.author_display_name) }}</span>
            </div>
          </button>
          <div class="comment-author__body">
            <button type="button" class="comment-author-name" @click="goUser(comment)">
              {{ comment.author_display_name }}
            </button>
            <div v-if="parseCerts(comment.author_certifications).length" class="cert-pill-row">
              <span
                v-for="cert in parseCerts(comment.author_certifications)"
                :key="`${cert.label}-${cert.icon}`"
                class="cert-pill"
                :class="{ 'comment-cert-pill--icon-only': !displayCertLabel(cert.label) }"
                :title="cert.label || ''"
              >
                <span class="cert-pill__icon-wrap">
                  <mdui-icon :name="certIconName(cert.icon)"></mdui-icon>
                </span>
                <span v-if="displayCertLabel(cert.label)" class="cert-pill__label">{{ displayCertLabel(cert.label) }}</span>
              </span>
            </div>
          </div>
        </div>
        <time class="comment-time">{{ formatDate(comment.created_at, { withTime: true }) }}</time>
      </div>
      <div class="rich-text comment-body" v-html="renderContent(comment.content)"></div>
    </article>

    <VueEasyLightbox
      :visible="lightboxVisible"
      :imgs="lightboxImages"
      :index="lightboxIndex"
      @hide="lightboxVisible = false"
    />
  </div>
  <div v-else class="empty-state">还没有评论，来写第一条吧。</div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatDate, sanitizeHtml } from '@/lib/format'
import { resolvePublicUserUid } from '@/lib/publicProfiles'
import { toUserProfilePath } from '@/lib/uid'
import { useGalleryStore } from '@/stores/gallery'
import VueEasyLightbox from 'vue-easy-lightbox'

const props = defineProps({ comments: { type: Array, default: () => [] } })

const router = useRouter()
const galleryStore = useGalleryStore()
const lightboxVisible = ref(false)
const lightboxImages = ref([])
const lightboxIndex = ref(0)
const imageCache = ref({})

onMounted(() => {
  document.addEventListener('click', handleImageClick)
})

function handleImageClick(e) {
  const target = e.target
  if (target.classList.contains('comment-inline-image')) {
    const src = target.dataset.src
    if (src) {
      lightboxImages.value = [src]
      lightboxIndex.value = 0
      lightboxVisible.value = true
    }
  }
}

function renderContent(content) {
  if (!content) return ''
  let html = content.replace(/\n/g, '<br/>')
  html = html.replace(/\[img:([a-zA-Z0-9-]+)\]/g, (match, slug) => {
    const img = galleryStore.images.find(i => i.slug === slug)
    if (img) {
      return `<img class="comment-inline-image" src="${img.image_url}" alt="${img.title}" data-src="${img.image_url}" title="点击查看大图" />`
    }
    return `<span class="comment-image-placeholder" title="图片未找到">[图片:${slug}]</span>`
  })
  return sanitizeHtml(html, { ADD_ATTR: ['data-src', 'title'] })
}

function initials(name = '') {
  return name.trim().slice(0, 1).toUpperCase() || 'U'
}

async function goUser(comment) {
  try {
    const uid = await resolvePublicUserUid({ userId: comment.user_id, callsign: comment.author_display_name })
    const path = toUserProfilePath(uid)
    if (path) router.push(path)
  } catch {}
}

function parseCerts(raw) {
  if (!raw || !Array.isArray(raw)) return []
  return raw.map((item) =>
    typeof item === 'string'
      ? { label: item, icon: 'award_star' }
      : { label: item.label || '', icon: item.icon || 'award_star' },
  )
}

function displayCertLabel(label) {
  if (!label) return ''
  return /[\u4e00-\u9fa5]/.test(label) ? label : ''
}

function certIconName(icon) {
  const map = {
    award_star: 'award_star--rounded', beenhere: 'beenhere--rounded',
    face_retouching_natural: 'face_retouching_natural--rounded', hive: 'hive--rounded',
    school: 'school--rounded', yard: 'yard--rounded',
    award: 'award_star--rounded', star: 'beenhere--rounded',
    shield: 'hive--rounded', crown: 'school--rounded', workspace_premium: 'school--rounded',
  }
  return map[icon] || 'beenhere--rounded'
}
</script>
