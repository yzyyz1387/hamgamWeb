<template>
  <div>
    <div v-if="loading" class="empty-state" style="margin:60px auto;max-width:400px">
      <mdui-circular-progress></mdui-circular-progress>
      <div>正在抽取随机图片…</div>
    </div>

    <section v-else-if="currentImage" class="page">
      <div class="image-layout">
        <div class="image-viewer">
          <div class="image-viewer__frame" @click="lightboxOpen = true" style="cursor:zoom-in">
            <img :src="currentImage.image_url" :alt="currentImage.title" />
          </div>
          <VueEasyLightbox
            teleport="body"
            :visible="lightboxOpen"
            :imgs="[currentImage.image_url]"
            :index="0"
            @hide="lightboxOpen = false"
          />
          <div class="image-reactions-bar">
            <EmojiBar
              :summary="currentImage.reaction_summary"
              :selected="myReactions"
              :interactive="auth.isLoggedIn"
              :collapse-after="10"
              @toggle="onToggleReaction"
            ></EmojiBar>
            <p v-if="!auth.isLoggedIn" class="muted" style="font-size:13px;margin-top:6px">登录后可添加反应</p>
          </div>
          <div style="margin-top:14px">
            <h1 style="margin:0 0 6px">{{ currentImage.title }}</h1>
            <p class="muted">{{ currentImage.description || '暂无描述' }}</p>
          </div>
          <div class="image-meta-row" style="margin-top:10px">
            <span class="image-meta-item">
              <mdui-icon name="person--rounded" style="font-size:14px;vertical-align:middle"></mdui-icon>
              <button v-if="contributorUid" type="button" class="contributor-link" @click="goContributorProfile">
                {{ currentImage.contributor_name }}
              </button>
              <span v-else>{{ currentImage.contributor_name }}</span>
            </span>
            <span class="image-meta-sep">·</span>
            <span class="image-meta-item">{{ formatDate(currentImage.sort_at) }}</span>
          </div>
          <div class="action-row" style="margin-top:14px">
            <mdui-button variant="filled" @click="goDetail">查看完整详情</mdui-button>
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

          <div v-if="auth.isLoggedIn" class="form-grid">
            <div class="form-control" style="grid-column: 1 / -1">
              <AppTextField id="random-comment" v-model="commentText" trim label="发表评论" maxlength="1000" counter rows="4" autosize placeholder="写点什么吧…"></AppTextField>
            </div>
          </div>
          <div v-if="auth.isLoggedIn" class="action-row" style="margin: 10px 0 18px">
            <mdui-button variant="filled" :loading="submittingComment" :disabled="commentCooldown > 0" @click="submitComment">
              {{ commentCooldown > 0 ? `${commentCooldown}s 后可发送` : '发送评论' }}
            </mdui-button>
          </div>
          <mdui-card v-else class="section-card" style="margin-bottom:18px">
            <div class="section-card__header">
              <div>
                <h3>登录后参与评论</h3>
              </div>
              <mdui-button variant="filled" @click="router.push('/login')">前往登录</mdui-button>
            </div>
          </mdui-card>

          <CommentList :comments="comments"></CommentList>
        </aside>
      </div>
    </section>

    <div v-else class="empty-state" style="margin:60px auto;max-width:400px">图库还没有可展示的图片。</div>

    <button class="random-fab" @click="pickRandom" title="再来一张">
      <mdui-icon name="shuffle--rounded"></mdui-icon>
    </button>
    
    <div v-if="viewedCount > 0" class="viewed-info">
      <span>本次会话已浏览 {{ viewedCount }} 张</span>
      <button v-if="viewedCount >= totalImages * 0.8" @click="clearHistory" class="clear-btn">重置</button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { formatDate } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'
import { showToast } from '@/lib/toast'
import { fetchMyImageReactions, fetchVisibleComments, toggleImageReaction, createComment } from '@/lib/engagement'
import { resolvePublicUserUid } from '@/lib/publicProfiles'
import { toUserProfilePath } from '@/lib/uid'
import { useAuthStore } from '@/stores/auth'
import { useGalleryStore } from '@/stores/gallery'
import EmojiBar from '@/components/EmojiBar.vue'
import CommentList from '@/components/CommentList.vue'
import VueEasyLightbox from 'vue-easy-lightbox'
import AppTextField from '@/components/form/AppTextField.vue'

const router = useRouter()
const auth = useAuthStore()
const galleryStore = useGalleryStore()

const loading = ref(false)
const currentImage = ref(null)
const myReactions = ref([])
const comments = ref([])
const commentText = ref('')
const reactionBusy = ref(false)
const lightboxOpen = ref(false)
const submittingComment = ref(false)
const contributorUid = ref(null)
const commentCooldown = ref(0)
let commentCooldownTimer = null

const viewedCount = computed(() => galleryStore.viewedImageIds.size)
const totalImages = computed(() => galleryStore.images.length)

function startCommentCooldown(seconds = 30) {
  commentCooldown.value = seconds
  if (commentCooldownTimer) clearInterval(commentCooldownTimer)
  commentCooldownTimer = setInterval(() => {
    commentCooldown.value -= 1
    if (commentCooldown.value <= 0) { clearInterval(commentCooldownTimer); commentCooldownTimer = null }
  }, 1000)
}

onMounted(async () => {
  galleryStore.initFromStorage()
  loading.value = true
  try {
    await Promise.all([auth.init(), galleryStore.loadImages()])
    await pickRandom()
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    loading.value = false
  }
})

watch(() => auth.user?.id, loadMyReactions)

async function loadMyReactions() {
  if (!auth.user || !currentImage.value) { myReactions.value = []; return }
  try { myReactions.value = await fetchMyImageReactions(currentImage.value.id, auth.user.id) } catch {}
}

async function loadContributorLink() {
  contributorUid.value = currentImage.value
    ? await resolvePublicUserUid({
        userId: currentImage.value.uploader_id,
        callsign: currentImage.value.contributor_name,
      }).catch(() => null)
    : null
}

async function pickRandom() {
  const pool = galleryStore.images
  if (!pool.length) { currentImage.value = null; contributorUid.value = null; return }
  
  const unviewed = galleryStore.unviewedImages
  let candidates = unviewed.length > 0 ? unviewed : pool
  
  if (currentImage.value) {
    candidates = candidates.filter((item) => item.id !== currentImage.value.id)
  }
  
  if (candidates.length === 0) {
    candidates = pool.filter((item) => item.id !== currentImage.value?.id)
  }
  if (candidates.length === 0) {
    candidates = pool
  }
  
  const randomIndex = Math.floor(Math.random() * candidates.length)
  currentImage.value = candidates[randomIndex]
  
  galleryStore.markAsViewed(currentImage.value.id)
  
  comments.value = []
  await Promise.all([loadMyReactions(), loadContributorLink()])
  try { comments.value = await fetchVisibleComments(currentImage.value.id) } catch {}
  
  if (unviewed.length === 0 && pool.length > 0) {
    showToast('已浏览全部图片，重新开始随机')
  }
}

function clearHistory() {
  galleryStore.clearViewedHistory()
  showToast('已重置浏览记录')
}

function goContributorProfile() {
  const path = toUserProfilePath(contributorUid.value)
  if (path) router.push(path)
}

function goDetail() {
  if (currentImage.value) router.push(`/image/${currentImage.value.slug}`)
}

async function submitComment() {
  if (!auth.user || !currentImage.value) return
  const trimmed = commentText.value.trim()
  if (!trimmed) { showToast('评论内容不能为空'); return }
  if (commentCooldown.value > 0) { showToast(`发送太频繁，请 ${commentCooldown.value} 秒后再试`); return }
  submittingComment.value = true
  try {
    const data = await createComment({ imageId: currentImage.value.id, userId: auth.user.id, content: trimmed })
    comments.value = [data, ...comments.value]
    commentText.value = ''
    showToast('评论已发送')
    startCommentCooldown(30)
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    submittingComment.value = false
  }
}

async function onToggleReaction(emoji) {
  if (!auth.user || !currentImage.value || reactionBusy.value) {
    if (!auth.user) showToast('请先登录后再添加反应')
    return
  }
  reactionBusy.value = true
  const active = myReactions.value.includes(emoji)
  try {
    const selected = await toggleImageReaction({ imageId: currentImage.value.id, userId: auth.user.id, emoji, active })
    myReactions.value = selected ? [...myReactions.value, emoji] : myReactions.value.filter((value) => value !== emoji)
    galleryStore.updateReactionSummaryLocally(currentImage.value.id, emoji, selected)
    currentImage.value = galleryStore.images.find((item) => item.id === currentImage.value.id) || currentImage.value
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    reactionBusy.value = false
  }
}
</script>

<style scoped>
.viewed-info {
  position: fixed;
  bottom: 80px;
  right: 24px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 100;
}

.clear-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.clear-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
