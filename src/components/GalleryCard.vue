<template>
  <div class="image-card" :data-image-slug="image.slug" :data-image-id="image.id" @click="goDetail">
    <div class="image-card__media">
      <img :src="image.image_url" :alt="image.title" loading="lazy" :data-image-slug="image.slug" :data-image-id="image.id" />
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
    </div>
    <button type="button" class="image-card__copy-link" title="复制链接" @click.stop="copyLink">
      <mdui-icon name="link--rounded"></mdui-icon>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { formatDate, copyText } from '@/lib/format'
import { showToast } from '@/lib/toast'
import EmojiBar from '@/components/EmojiBar.vue'

const props = defineProps({
  image: { type: Object, required: true },
})

const router = useRouter()
const hasReactions = computed(() => props.image.reaction_total_count > 0)

function goDetail() {
  router.push(`/image/${props.image.slug}`)
}

async function copyLink() {
  const url = `${window.location.origin}/image/${props.image.slug}`
  await copyText(url)
  showToast('链接已复制')
}
</script>
