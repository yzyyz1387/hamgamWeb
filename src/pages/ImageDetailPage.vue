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
          <mdui-button v-if="canEditImage" variant="outlined" @click="showEditDialog = true">
            <mdui-icon slot="icon" name="edit--rounded"></mdui-icon>
            编辑
          </mdui-button>
          <mdui-button variant="text" @click="router.push('/')">返回主页</mdui-button>
        </div>

        <div v-if="image.edit_status === 'PENDING'" class="edit-status-banner">
          <mdui-icon name="pending--rounded" style="font-size: 18px"></mdui-icon>
          <span>此图片修改正在审核中</span>
        </div>
        <div v-else-if="image.edit_status === 'REJECTED'" class="edit-status-banner edit-status-banner--rejected">
          <mdui-icon name="error--rounded" style="font-size: 18px"></mdui-icon>
          <span>修改被驳回：{{ image.edit_reason || '无原因' }}</span>
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
          <div v-if="replyingTo" class="reply-indicator">
            <span>回复 <strong>{{ replyingTo.author_display_name }}</strong></span>
            <button type="button" class="reply-cancel-btn" @click="cancelReply">取消</button>
          </div>
          <AppTextField
            v-model="commentText"
            :label="replyingTo ? '发表回复' : '发表评论'"
            :placeholder="replyingTo ? `回复 ${replyingTo.author_display_name}…` : '写点什么吧…'"
            :maxlength="1000"
            :rows="4"
            autosize
            counter
            trim
          ></AppTextField>
        </div>

        <div v-if="auth.isLoggedIn" class="comment-actions-row">
          <mdui-button variant="outlined" @click="showInsertImageDialog = true">
            <mdui-icon slot="icon" name="image--rounded"></mdui-icon>
            插入图片
          </mdui-button>
          <mdui-button variant="text" @click="showInsertHelp = true">如何插入？</mdui-button>
          <mdui-button variant="filled" :loading="submittingComment" :disabled="commentCooldown > 0" @click="submitComment">
            {{ commentCooldown > 0 ? `${commentCooldown}s 后可发送` : '发送评论' }}
          </mdui-button>
        </div>

        <mdui-dialog :open="showInsertImageDialog" @closed="showInsertImageDialog = false">
          <div class="dialog-content">
            <h3>插入本站图片</h3>
            <p class="muted" style="margin-bottom: 12px">粘贴从右键菜单复制的图片地址</p>
            <div class="form-control">
              <AppTextField
                v-model="insertImageUrl"
                label="图片地址"
                placeholder="输入链接..."
                trim
              ></AppTextField>
            </div>
            <div v-if="insertPreviewImage" class="insert-preview">
              <img :src="insertPreviewImage.image_url" :alt="insertPreviewImage.title" />
              <span>{{ insertPreviewImage.title }}</span>
            </div>
            <div v-else-if="insertError" class="insert-error">{{ insertError }}</div>
          </div>
          <mdui-button slot="action" @click="showInsertImageDialog = false">取消</mdui-button>
          <mdui-button slot="action" variant="filled" :disabled="!insertPreviewImage" @click="confirmInsertImage">确认插入</mdui-button>
        </mdui-dialog>

        <mdui-dialog :open="showInsertHelp" @closed="showInsertHelp = false">
          <div class="dialog-content">
            <h3>如何插入图片？</h3>
            <div class="insert-help-content">
              <p>1. 在主页找到想要引用的图片</p>
              <p>2. 点击图片旁边的 <mdui-icon name="link--rounded" style="font-size: 18px; vertical-align: middle; color: #6750a4"></mdui-icon> 引用按钮</p>
              <p>3. 链接会自动复制到剪贴板</p>
              <p>4. 回到评论区，点击"插入图片"，粘贴链接即可</p>
            </div>
          </div>
          <mdui-button slot="action" variant="filled" @click="showInsertHelp = false">我知道了</mdui-button>
        </mdui-dialog>

        <mdui-card v-if="!auth.isLoggedIn" class="section-card" style="margin-bottom: 18px">
          <div class="section-card__header">
            <div>
              <h3>登录后参与评论</h3>
              <p>注册后即可评论、投稿、接收通知，并管理自己的头像与资料。</p>
            </div>
            <mdui-button variant="filled" @click="goToLogin">前往登录</mdui-button>
          </div>
        </mdui-card>

        <CommentList :comments="comments" @reply="handleReply"></CommentList>
      </aside>
    </div>

    <div v-else class="empty-state">
      <p>没有找到这张图片，可能链接已失效。</p>
      <mdui-button variant="filled" @click="router.push('/')">返回主页</mdui-button>
    </div>

    <mdui-dialog :open="showEditDialog" @closed="showEditDialog = false">
      <div class="dialog-content">
        <h3>编辑图片信息</h3>
        <div class="form-control" style="margin-top: 12px">
          <AppTextField
            v-model="editTitle"
            label="标题"
            placeholder="请输入图片标题"
            :maxlength="100"
            counter
            trim
          ></AppTextField>
        </div>
        <div class="form-control" style="margin-top: 12px">
          <AppTextField
            v-model="editDescription"
            label="描述"
            placeholder="请输入图片描述（可选）"
            :maxlength="500"
            :rows="3"
            autosize
            counter
            trim
          ></AppTextField>
        </div>
        <div class="form-control" style="margin-top: 12px">
          <label class="file-upload-label">
            <input type="file" accept="image/*" @change="handleEditFileChange" style="display: none" />
            <mdui-button variant="outlined" type="button">
              <mdui-icon slot="icon" name="upload--rounded"></mdui-icon>
              更换图片（可选）
            </mdui-button>
          </label>
          <span v-if="editFileName" style="margin-left: 8px; font-size: 13px">{{ editFileName }}</span>
        </div>
        <div v-if="editPreviewUrl" class="edit-preview">
          <img :src="editPreviewUrl" alt="预览" />
        </div>
        <p class="muted" style="margin-top: 12px; font-size: 13px">
          提交修改后需要重新审核，审核通过后才会更新。
        </p>
      </div>
      <mdui-button slot="action" @click="showEditDialog = false">取消</mdui-button>
      <mdui-button slot="action" variant="filled" :loading="submittingEdit" :disabled="!editTitle.trim()" @click="submitEdit">
        提交修改
      </mdui-button>
    </mdui-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
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
import { requireSupabase } from '@/lib/supabase'
import { safeInsertAuditLog } from '@/lib/audit'
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
const commentCooldown = ref(0)
const showInsertImageDialog = ref(false)
const showInsertHelp = ref(false)
const insertImageUrl = ref('')
const insertPreviewImage = ref(null)
const insertError = ref('')
const replyingTo = ref(null)
const showEditDialog = ref(false)
const editTitle = ref('')
const editDescription = ref('')
const editFile = ref(null)
const editFileName = ref('')
const editPreviewUrl = ref('')
const submittingEdit = ref(false)
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
watch(() => route.query.edit, (edit) => {
  if (edit === 'true' && canEditImage.value) {
    showEditDialog.value = true
  }
})

const canEditImage = computed(() => {
  if (!auth.user || !image.value) return false
  return image.value.uploader_id === auth.user.id && image.value.edit_status !== 'PENDING'
})

watch(showEditDialog, (open) => {
  if (open && image.value) {
    editTitle.value = image.value.title
    editDescription.value = image.value.description || ''
    editFile.value = null
    editFileName.value = ''
    editPreviewUrl.value = ''
  }
})
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
watch(insertImageUrl, async (url) => {
  insertPreviewImage.value = null
  insertError.value = ''
  if (!url) return
  const slugMatch = url.match(/\/image\/([^\/\?]+)/)
  if (!slugMatch) {
    insertError.value = '请输入有效的图片地址'
    return
  }
  const slug = slugMatch[1]
  try {
    const found = await galleryStore.fetchImageBySlug(slug)
    if (found) {
      insertPreviewImage.value = found
    } else {
      insertError.value = '没有找到这张图片'
    }
  } catch {
    insertError.value = '查询图片失败'
  }
})

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
      imageTitle: image.value.title,
      imageSlug: image.value.slug,
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

function goToLogin() {
  router.push({ path: '/login', query: { redirect: route.fullPath } })
}

async function submitComment() {
  if (!auth.user || !image.value) return
  const trimmed = commentText.value.trim()
  if (!trimmed) { showToast('评论内容不能为空'); return }
  if (trimmed.replace(/[\s\p{P}\p{S}]/gu, '').length < 1 && trimmed.length < 2) {
    showToast('评论内容无效')
    return
  }
  if (commentCooldown.value > 0) {
    showToast(`发送太频繁，请 ${commentCooldown.value} 秒后再试`)
    return
  }
  submittingComment.value = true
  const isReply = !!replyingTo.value
  try {
    const data = await createComment({
      imageId: image.value.id,
      userId: auth.user.id,
      content: trimmed,
      parentId: replyingTo.value?.id || null,
      imageTitle: image.value.title,
      imageSlug: image.value.slug,
      replyToUser: replyingTo.value?.author_display_name || null,
    })
    comments.value = [data, ...comments.value]
    galleryStore.incrementCommentCountLocally(image.value.id, 1)
    image.value = galleryStore.images.find((item) => item.id === image.value.id) || image.value
    commentText.value = ''
    replyingTo.value = null
    showToast(isReply ? '回复已发送' : '评论已发送')
    startCommentCooldown(30)
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    submittingComment.value = false
  }
}

function handleReply(comment) {
  replyingTo.value = comment
  const textField = document.querySelector('.comment-compose-grid textarea, .comment-compose-grid input')
  if (textField) {
    textField.focus()
    textField.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

function cancelReply() {
  replyingTo.value = null
}

async function copyShareLink() {
  if (!image.value) return
  const base = `${window.location.origin}${window.location.pathname}`
  await copyText(`${base}#/image/${image.value.slug}`)
  showToast('已复制分享链接')
}

function confirmInsertImage() {
  if (!insertPreviewImage.value) return
  const img = insertPreviewImage.value
  const insertText = `[img:${img.slug}]`
  commentText.value = commentText.value ? `${commentText.value} ${insertText}` : insertText
  showInsertImageDialog.value = false
  insertImageUrl.value = ''
  insertPreviewImage.value = null
  showToast('图片已插入')
}

function handleEditFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  editFile.value = file
  editFileName.value = file.name
  editPreviewUrl.value = URL.createObjectURL(file)
}

async function submitEdit() {
  if (!image.value || !auth.user) return
  const title = editTitle.value.trim()
  if (!title) {
    showToast('标题不能为空')
    return
  }
  
  submittingEdit.value = true
  try {
    const supabase = requireSupabase()
    
    let newImageUrl = image.value.image_url
    let newStoragePath = null
    let newMimeType = image.value.mime_type
    let newFileSize = 0
    let newFileName = image.value.original_filename || 'edited_image.jpg'
    
    if (editFile.value) {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('submission-images')
        .upload(`${auth.user.id}/${Date.now()}_${editFile.value.name}`, editFile.value)
      
      if (uploadError) throw uploadError
      
      const { data: urlData } = supabase.storage.from('submission-images').getPublicUrl(uploadData.path)
      newImageUrl = urlData.publicUrl
      newStoragePath = uploadData.path
      newMimeType = editFile.value.type
      newFileSize = editFile.value.size
      newFileName = editFile.value.name
    }
    
    const hasChanges = title !== image.value.title || 
                       editDescription.value.trim() !== (image.value.description || '') ||
                       newStoragePath !== null
    
    if (!hasChanges) {
      showToast('没有检测到修改')
      return
    }
    
    const { error } = await supabase
      .from('submissions')
      .insert({
        title,
        description: editDescription.value.trim() || '',
        original_filename: newFileName,
        storage_bucket: newStoragePath ? 'submission-images' : null,
        storage_path: newStoragePath,
        mime_type: newMimeType,
        file_size: newFileSize,
        uploader_id: auth.user.id,
        uploader_display_name: auth.displayName,
        status: 'PENDING',
        metadata: {
          edit_for_image_id: image.value.id,
          edit_for_image_slug: image.value.slug,
          original_image_url: image.value.image_url,
          original_title: image.value.title,
          original_description: image.value.description,
          has_new_file: newStoragePath !== null,
        },
      })
      .select()
      .single()
    
    if (error) throw error
    
    await safeInsertAuditLog({
      action: 'image.edit_requested',
      entityType: 'image',
      entityId: image.value.id,
      details: {
        image_title: title,
        image_slug: image.value.slug,
      },
    })
    
    showToast('修改已提交，等待审核')
    showEditDialog.value = false
    await loadPage()
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    submittingEdit.value = false
  }
}
</script>

<style scoped>
.image-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
  gap: 20px;
  align-items: start;
}

.image-viewer {
  padding: 22px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 18px 40px rgba(17, 24, 39, 0.08);
  position: sticky;
  top: 24px;
  max-height: calc(100vh - 48px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.image-viewer__frame {
  flex-shrink: 0;
  background: rgba(17, 24, 39, 0.03);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 380px;
}

.image-viewer__frame img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.image-reactions-bar {
  flex-shrink: 0;
  padding-top: 12px;
}

.image-viewer .section-card__header {
  flex-shrink: 0;
}

.image-meta-row {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #5f6b76;
}

.image-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.image-meta-sep {
  color: #c0c8d0;
}

.image-viewer .action-row {
  flex-shrink: 0;
}

.edit-status-banner {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 10px 14px;
  background: rgba(245, 158, 11, 0.1);
  border-radius: 10px;
  font-size: 13px;
  color: #b45309;
}

.edit-status-banner--rejected {
  background: rgba(220, 38, 38, 0.1);
  color: #b91c1c;
}

.side-panel {
  padding: 22px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 18px 40px rgba(17, 24, 39, 0.08);
}

.contributor-link {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: #6750a4;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-style: dotted;
}

.contributor-link:hover {
  color: #7965af;
}

.comment-compose-grid {
  margin-bottom: 12px;
}

.reply-indicator {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(103, 80, 164, 0.08);
  border-radius: 8px;
  margin-bottom: 8px;
  font-size: 13px;
}

.reply-cancel-btn {
  background: none;
  border: none;
  color: #6750a4;
  cursor: pointer;
  font-size: 12px;
}

.comment-actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
  align-items: center;
}

.insert-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  padding: 10px;
  background: rgba(17, 24, 39, 0.03);
  border-radius: 10px;
}

.insert-preview img {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  object-fit: cover;
}

.insert-preview span {
  font-size: 13px;
  color: #374151;
}

.insert-error {
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(220, 38, 38, 0.08);
  border-radius: 8px;
  font-size: 13px;
  color: #b91c1c;
}

.insert-help-content {
  font-size: 14px;
  line-height: 1.8;
}

.edit-preview {
  margin-top: 12px;
  border-radius: 10px;
  overflow: hidden;
  background: rgba(17, 24, 39, 0.03);
}

.edit-preview img {
  width: 100%;
  max-height: 200px;
  object-fit: contain;
}

@media (max-width: 768px) {
  .image-layout {
    grid-template-columns: 1fr;
    gap: 16px;
    display: flex;
    flex-direction: column;
  }
  
  .image-viewer {
    position: static;
    max-height: none;
    overflow: visible;
    order: 1;
  }
  
  .image-viewer__frame {
    height: 300px;
  }
  
  .side-panel {
    order: 2;
  }
}
</style>
