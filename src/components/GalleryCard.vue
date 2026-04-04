<template>
  <div class="image-card" :data-image-slug="image.slug" :data-image-id="image.id" @click="goDetail">
    <div class="image-card__media" :style="mediaStyle" :class="{ 'image-card__media--loaded': imageLoaded }">
      <div v-if="!imageLoaded" class="image-card__skeleton" aria-hidden="true"></div>
      <img
        :src="image.image_url"
        :alt="image.title"
        loading="lazy"
        :data-image-slug="image.slug"
        :data-image-id="image.id"
        :class="{ 'image-card__img--loaded': imageLoaded }"
        @load="handleImageLoad"
        @error="handleImageError"
      />
    </div>
    <div class="image-card__body">
      <h3 class="image-card__title">{{ image.title }}</h3>
      <div class="image-card__meta">
        <span>{{ image.contributor_name }}</span>
        <span class="image-card__meta-sep">·</span>
        <span>{{ formatDate(image.sort_at) }}</span>
        <span class="image-card__meta-sep">·</span>
        <span>{{ image.comments_count }} 评论</span>
      </div>
      <EmojiBar v-if="hasReactions" :summary="image.reaction_summary" :limit="4" :interactive="false"></EmojiBar>
      <div v-if="cardExtras.length" class="image-card__plugin-extras" @click.stop>
        <component
          :is="extra.component"
          v-for="extra in cardExtras"
          :key="extra.id"
          :image="image"
          :auth="auth"
          :config="extra.config"
          :plugin="extra"
          class="image-card__plugin-extra"
        />
      </div>
    </div>
    <button type="button" class="image-card__copy-link" title="复制链接" @click.stop="copyLink">
      <mdui-icon name="link--rounded"></mdui-icon>
    </button>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { formatDate, copyText } from '@/lib/format'
import { showToast } from '@/lib/toast'
import { getImageListCardExtras } from '@/plugins/runtime'
import { useAuthStore } from '@/stores/auth'
import EmojiBar from '@/components/EmojiBar.vue'

const props = defineProps({
  image: { type: Object, required: true },
})

const router = useRouter()
const auth = useAuthStore()
const DEFAULT_MEDIA_RATIO = 4 / 3
const aspectRatio = ref(resolveAspectRatio(props.image))
const imageLoaded = ref(false)

const hasReactions = computed(() => props.image.reaction_total_count > 0)
const cardExtras = computed(() =>
  getImageListCardExtras({
    image: props.image,
    auth,
    route: router.currentRoute.value,
    router,
  }),
)
const mediaStyle = computed(() => ({
  aspectRatio: String(aspectRatio.value || DEFAULT_MEDIA_RATIO),
}))

watch(
  () => props.image,
  (nextImage) => {
    aspectRatio.value = resolveAspectRatio(nextImage)
    imageLoaded.value = false
  },
)

function resolveAspectRatio(image) {
  const width = Number(image?.image_width || 0)
  const height = Number(image?.image_height || 0)
  if (width > 0 && height > 0) {
    return width / height
  }
  return DEFAULT_MEDIA_RATIO
}

function handleImageLoad(event) {
  const element = event?.target
  const width = Number(element?.naturalWidth || 0)
  const height = Number(element?.naturalHeight || 0)
  if (width > 0 && height > 0) {
    aspectRatio.value = width / height
  }
  imageLoaded.value = true
}

function handleImageError() {
  imageLoaded.value = true
}

function goDetail() {
  router.push(`/image/${props.image.slug}`)
}

async function copyLink() {
  const url = `${window.location.origin}/image/${props.image.slug}`
  await copyText(url)
  showToast('链接已复制')
}
</script>

<style scoped>
.image-card__media {
  position: relative;
  display: block;
  width: 100%;
  overflow: hidden;
  background:
    linear-gradient(135deg, rgba(236, 240, 245, 0.95), rgba(244, 247, 251, 0.92));
}

.image-card__media img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  opacity: 0;
  transform: scale(1.02);
  transition: opacity 0.24s ease, transform 0.32s ease;
}

.image-card__media--loaded img,
.image-card__img--loaded {
  opacity: 1;
  transform: scale(1);
}

.image-card__skeleton {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.7) 50%,
      rgba(255, 255, 255, 0) 100%
    ),
    linear-gradient(135deg, rgba(214, 223, 233, 0.88), rgba(235, 240, 246, 0.96));
  background-size: 180% 100%, 100% 100%;
  animation: image-card-shimmer 1.2s linear infinite;
}

.image-card__plugin-extras {
  margin-top: 10px;
}

.image-card__plugin-extra {
  min-width: 0;
}

@keyframes image-card-shimmer {
  from {
    background-position: 180% 0, 0 0;
  }

  to {
    background-position: -20% 0, 0 0;
  }
}
</style>
