<template>
  <section class="page">
    <div v-if="loading" class="empty-state">
      <mdui-circular-progress></mdui-circular-progress>
      <div>正在加载图片详情…</div>
    </div>

    <div v-else-if="image" class="image-layout" :data-image-slug="image.slug" :data-image-id="image.id">
      <div class="image-viewer">
        <div class="image-viewer__frame" @click="lightboxOpen = true" style="cursor: zoom-in">
          <img :src="image.image_url" :alt="image.title" :data-image-slug="image.slug" :data-image-id="image.id" />
        </div>

        <VueEasyLightbox
          :visible="lightboxOpen"
          :imgs="[image.image_url]"
          :index="0"
          @hide="lightboxOpen = false"
        />

        <div class="image-reactions-bar">
          <EmojiBar
            :summary="image.reaction_summary"
            :selected="myReactions"
            :interactive="auth.isLoggedIn"
            :collapse-after="10"
            @toggle="onToggleReaction"
          ></EmojiBar>
          <p v-if="!auth.isLoggedIn" class="muted" style="font-size: 13px; margin-top: 6px">登录后可添加反应</p>
        </div>

        <div class="section-card__header" style="margin-top: 14px">
          <div>
            <h1 style="margin: 0 0 6px">{{ image.title }}</h1>
            <p class="muted">{{ image.description || '暂无描述' }}</p>
          </div>
        </div>

        <div class="image-meta-row">
          <span class="image-meta-item">
            <mdui-icon name="person--rounded" style="font-size: 14px; vertical-align: middle"></mdui-icon>
            <button
              v-if="contributorUid"
              type="button"
              class="contributor-link"
              @click="goContributorProfile"
            >
              {{ image.contributor_name }}
            </button>
            <span v-else>{{ image.contributor_name }}</span>
          </span>
          <span class="image-meta-sep">·</span>
          <span class="image-meta-item">{{ formatDate(image.sort_at, { withTime: true }) }}</span>
          <span class="image-meta-sep">·</span>
          <span class="image-meta-item">{{ comments.length }} 评论</span>
          <span class="image-meta-sep">·</span>
          <span class="image-meta-item">{{ image.reaction_total_count }} 反应</span>
        </div>

        <div class="action-row" style="margin-top: 14px">
          <mdui-button variant="filled" @click="copyShareLink">复制链接</mdui-button>
          <mdui-button variant="filled-tonal" @click="router.push('/random')">随机一张</mdui-button>
          <mdui-button variant="text" @click="router.push('/')">返回主页</mdui-button>
        </div>
      </div>

      <aside class="side-panel">
        <div class="section-card__header">
          <div>
            <div class="eyebrow">评论区</div>
            <h2>{{ comments.length }} 条评论</h2>
          </div>
        </div>

        <div v-if="auth.isLoggedIn" class="form-grid comment-compose-grid">
          <AppTextField
            v-model="commentText"
            label="发表评论"
            placeholder="写点什么吧…"
            :maxlength="1000"
            :rows="4"
            autosize
            counter
            trim
          ></AppTextField>
        </div>

        <div v-if="auth.isLoggedIn" class="action-row" style="margin: 10px 0 18px">
          <mdui-button variant="filled" :loading="submittingComment" :disabled="commentCooldown > 0" @click="submitComment">
            {{ commentCooldown > 0 ? `${commentCooldown}s 后可发送` : '发送评论' }}
          </mdui-button>
        </div>

        <mdui-card v-else class="section-card" style="margin-bottom: 18px">
          <div class="section-card__header">
            <div>
              <h3>登录后参与评论</h3>
              <p>注册后即可评论、投稿、接收通知，并管理自己的头像与资料。</p>
            </div>
            <mdui-button variant="filled" @click="router.push('/login')">前往登录</mdui-button>
          </div>
        </mdui-card>

        <CommentList :comments="comments"></CommentList>
      </aside>
    </div>

    <div v-else class="empty-state">
      <p>没有找到这张图片，可能链接已失效。</p>
      <mdui-button variant="filled" @click="router.push('/')">返回主页</mdui-button>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { copyText, formatDate } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'
import { showToast } from '@/lib/toast'
import {
  createComment,
  fetchMyImageReactions,
  fetchVisibleComments,
  toggleImageReaction,
} from '@/lib/engagement'
import { resolvePublicUserUid } from '@/lib/publicProfiles'
import { toUserProfilePath } from '@/lib/uid'
import { useAuthStore } from '@/stores/auth'
import { useGalleryStore } from '@/stores/gallery'
import AppTextField from '@/components/AppTextField.vue'
import EmojiBar from '@/components/EmojiBar.vue'
import CommentList from '@/components/CommentList.vue'
import VueEasyLightbox from 'vue-easy-lightbox'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const galleryStore = useGalleryStore()

const loading = ref(false)
const image = ref(null)
const comments = ref([])
const myReactions = ref([])
const commentText = ref('')
const reactionBusy = ref(false)
const submittingComment = ref(false)
const lightboxOpen = ref(false)
const contributorUid = ref(null)
// 评论冷却：30 秒内只能发一条
const commentCooldown = ref(0)
let commentCooldownTimer = null

function startCommentCooldown(seconds = 30) {
  commentCooldown.value = seconds
  if (commentCooldownTimer) clearInterval(commentCooldownTimer)
  commentCooldownTimer = setInterval(() => {
    commentCooldown.value -= 1
    if (commentCooldown.value <= 0) {
      clearInterval(commentCooldownTimer)
      commentCooldownTimer = null
    }
  }, 1000)
}

async function loadPage() {
  loading.value = true
  contributorUid.value = null
  try {
    await Promise.all([auth.init(), galleryStore.loadImages()])
    image.value = await galleryStore.fetchImageBySlug(route.params.slug)
    if (!image.value) return

    const [loadedComments, loadedReactions, resolvedUid] = await Promise.all([
      fetchVisibleComments(image.value.id),
      auth.user ? fetchMyImageReactions(image.value.id, auth.user.id) : Promise.resolve([]),
      resolvePublicUserUid({
        userId: image.value.uploader_id,
        callsign: image.value.contributor_name,
      }),
    ])

    comments.value = loadedComments
    myReactions.value = loadedReactions
    contributorUid.value = resolvedUid
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

onMounted(loadPage)
watch(() => route.params.slug, loadPage)
watch(
  () => auth.user?.id,
  async () => {
    if (image.value && auth.user) {
      myReactions.value = await fetchMyImageReactions(image.value.id, auth.user.id)
    } else {
      myReactions.value = []
    }
  },
)

async function onToggleReaction(emoji) {
  if (!auth.user || !image.value || reactionBusy.value) {
    if (!auth.user) showToast('请先登录后再添加反应')
    return
  }
  reactionBusy.value = true
  const active = myReactions.value.includes(emoji)
  try {
    const selected = await toggleImageReaction({
      imageId: image.value.id,
      userId: auth.user.id,
      emoji,
      active,
    })
    myReactions.value = selected
      ? [...myReactions.value, emoji]
      : myReactions.value.filter((item) => item !== emoji)
    galleryStore.updateReactionSummaryLocally(image.value.id, emoji, selected)
    image.value = galleryStore.images.find((item) => item.id === image.value.id) || image.value
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    reactionBusy.value = false
  }
}

function goContributorProfile() {
  const path = toUserProfilePath(contributorUid.value)
  if (path) router.push(path)
}

async function submitComment() {
  if (!auth.user || !image.value) return
  const trimmed = commentText.value.trim()
  if (!trimmed) { showToast('评论内容不能为空'); return }
  // 空白/纯符号检测：去掉空白后至少 2 个有效字符
  if (trimmed.replace(/[\s\p{P}\p{S}]/gu, '').length < 1 && trimmed.length < 2) {
    showToast('评论内容无效')
    return
  }
  if (commentCooldown.value > 0) {
    showToast(`发送太频繁，请 ${commentCooldown.value} 秒后再试`)
    return
  }
  submittingComment.value = true
  try {
    const data = await createComment({
      imageId: image.value.id,
      userId: auth.user.id,
      content: trimmed,
    })
    comments.value = [data, ...comments.value]
    galleryStore.incrementCommentCountLocally(image.value.id, 1)
    image.value = galleryStore.images.find((item) => item.id === image.value.id) || image.value
    commentText.value = ''
    showToast('评论已发送')
    startCommentCooldown(30)
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    submittingComment.value = false
  }
}

async function copyShareLink() {
  if (!image.value) return
  const base = `${window.location.origin}${window.location.pathname}`
  await copyText(`${base}#/image/${image.value.slug}`)
  showToast('已复制分享链接')
}
</script>
