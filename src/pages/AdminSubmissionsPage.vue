<template>
  <section class="page">
    <mdui-card class="section-card">
      <div class="section-card__header">
        <div>
          <div class="eyebrow">投稿审核</div>
          <h1>统一处理上传图片</h1>
          <p class="muted">审核通过后，图片将自动转存到公开图集并对外展示。</p>
        </div>
      </div>
      <div class="submission-tabs">
        <button 
          v-for="tab in tabs" 
          :key="tab.value" 
          class="submission-tab" 
          :class="{ 'submission-tab--active': activeTab === tab.value }"
          @click="switchTab(tab.value)"
        >
          {{ tab.label }}
          <span v-if="tab.count !== undefined" class="submission-tab__count">{{ tab.count }}</span>
        </button>
        <div class="submission-tabs__spacer"></div>
        <div class="submission-view-toggle">
          <button 
            class="view-toggle-btn" 
            :class="{ 'view-toggle-btn--active': viewMode === 'list' }"
            @click="viewMode = 'list'"
            title="列表视图"
          >
            <mdui-icon name="view_list--rounded"></mdui-icon>
          </button>
          <button 
            class="view-toggle-btn" 
            :class="{ 'view-toggle-btn--active': viewMode === 'grid' }"
            @click="viewMode = 'grid'"
            title="网格视图"
          >
            <mdui-icon name="grid_view--rounded"></mdui-icon>
          </button>
        </div>
      </div>
    </mdui-card>

    <AdminQuickActionStrip v-if="pageQuickActions.length" :actions="pageQuickActions" @run="runQuickAction" />

    <mdui-card v-if="submissions.length" class="section-card bulk-toolbar-card">
      <PluginReviewActionBar
        :actions="bulkActions"
        :selected-count="selectedSubmissions.length"
        :all-selected="allSubmissionsSelected"
        @toggle-select-all="toggleSelectAllSubmissions"
        @clear="clearSubmissionSelection"
        @run="runBulkAction"
      />
    </mdui-card>

    <div v-if="loading" class="empty-state">
      <mdui-circular-progress></mdui-circular-progress>
      <div>正在加载投稿列表…</div>
    </div>

    <div v-else-if="submissions.length" class="submission-list" :class="`submission-list--${viewMode}`">
      <mdui-card v-for="item in submissions" :key="item.id" class="section-card submission-card" :class="[`submission-card--${viewMode}`, { 'submission-card--selected': isSubmissionSelected(item.id) }]">
        <template v-if="viewMode === 'grid'">
          <div class="submission-grid-item" :class="{ 'submission-grid-item--selected': isSubmissionSelected(item.id) }" @click="openReviewDialog(item)">
            <label class="bulk-select-pill bulk-select-pill--overlay" @click.stop>
              <input type="checkbox" :checked="isSubmissionSelected(item.id)" @change="toggleSubmissionSelection(item.id)" />
              <span>选择</span>
            </label>
            <div class="submission-grid-item__thumb">
              <template v-if="previewMap[item.id]">
                <img :src="previewMap[item.id]" alt="缩略图" />
              </template>
              <template v-else>
                <div class="submission-thumb__placeholder">
                  <mdui-circular-progress v-if="previewLoadingId === item.id" style="font-size:24px"></mdui-circular-progress>
                  <mdui-icon v-else name="image--rounded" style="font-size:32px;color:#c0c8d0"></mdui-icon>
                </div>
              </template>
            </div>
            <div class="submission-grid-item__info">
              <div class="submission-grid-item__title">{{ item.title }}</div>
              <div class="submission-grid-item__meta">
                <span class="status-pill" :class="statusClass(item.status)">{{ statusLabel(item.status) }}</span>
                <span>{{ formatDate(item.created_at, { withTime: false }) }}</span>
              </div>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="submission-card__layout">
          <div class="submission-thumb" @click="openLightbox(item)">
            <template v-if="previewMap[item.id]">
              <img :src="previewMap[item.id]" alt="缩略图" />
            </template>
            <template v-else>
              <div class="submission-thumb__placeholder">
                <mdui-circular-progress v-if="previewLoadingId === item.id" style="font-size:24px"></mdui-circular-progress>
                <mdui-icon v-else name="image--rounded" style="font-size:32px;color:#c0c8d0"></mdui-icon>
                <span v-if="previewLoadingId !== item.id" style="font-size:11px;color:#8a9aaa;margin-top:4px">点击预览</span>
              </div>
            </template>
          </div>

          <div class="submission-card__content">
            <div class="submission-card__head">
              <label class="bulk-select-pill" @click.stop>
                <input type="checkbox" :checked="isSubmissionSelected(item.id)" @change="toggleSubmissionSelection(item.id)" />
                <span>选择</span>
              </label>
              <div class="submission-card__title-row">
                <strong class="submission-card__title">{{ item.title }}</strong>
                <span class="status-pill" :class="statusClass(item.status)">{{ statusLabel(item.status) }}</span>
              </div>
              <div class="submission-meta">
                <span>{{ item.uploader_display_name }}</span>
                <span class="image-meta-sep">·</span>
                <span>{{ formatDate(item.created_at, { withTime: true }) }}</span>
                <span v-if="item.contributor_name && item.contributor_name !== item.uploader_display_name" class="image-meta-sep">·</span>
                <span v-if="item.contributor_name && item.contributor_name !== item.uploader_display_name">
                  贡献者：{{ item.contributor_name }}
                </span>
              </div>
            </div>

            <p v-if="item.description" class="submission-description">{{ item.description }}</p>

            <div class="submission-file-info">
              <mdui-icon name="insert_drive_file--rounded" style="font-size:14px;color:#8a9aaa"></mdui-icon>
              <span>{{ item.original_filename }}</span>
              <span v-if="item.file_size" class="image-meta-sep">·</span>
              <span v-if="item.file_size">{{ formatFileSize(item.file_size) }}</span>
            </div>

            <div v-if="item.reviewer_note" class="submission-reviewer-note">
              审核备注：{{ item.reviewer_note }}
            </div>

            <div v-if="item.metadata?.edit_for_image_id" class="submission-edit-banner">
              <mdui-icon name="edit--rounded" style="font-size:16px"></mdui-icon>
              <span>已发布图片的重新编辑</span>
              <a v-if="item.metadata?.edit_for_image_slug" :href="`/image/${item.metadata.edit_for_image_slug}`" target="_blank" @click.stop>查看原图</a>
            </div>

            <template v-if="item.status === 'PENDING'">
              <div class="form-control submission-note-input">
                <AppTextField
                  :id="`note-${item.id}`"
                  v-model="reviewNotes[item.id]"
                  trim
                  label="审核备注（可选）"
                  maxlength="500"
                  counter
                  rows="3"
                  autosize
                ></AppTextField>
              </div>
              <div class="review-note-actions">
                <mdui-button variant="text" @click="showInsertImageForSubmission(item.id)">
                  <mdui-icon slot="icon" name="image--rounded"></mdui-icon>
                  插入图片
                </mdui-button>
                <mdui-button variant="text" @click="showInsertHelpSubmission = true">如何插入？</mdui-button>
              </div>
              <div class="action-row submission-actions">
                <mdui-button
                  variant="filled"
                  :disabled="actionBusyId === item.id"
                  :loading="actionBusyId === item.id && actionType === 'publish'"
                  @click="moderate(item, 'publish')"
                >通过并发布</mdui-button>
                <mdui-button
                  variant="filled-tonal"
                  :disabled="actionBusyId === item.id"
                  :loading="actionBusyId === item.id && actionType === 'reject'"
                  @click="moderate(item, 'reject')"
                >驳回</mdui-button>
              </div>
            </template>

            <template v-else-if="item.status === 'PUBLISHED' && item.published_image_slug">
              <div class="action-row submission-actions">
                <mdui-button variant="filled" @click="goToImage(item.published_image_slug)">
                  <mdui-icon slot="icon" name="open_in_new--rounded"></mdui-icon>
                  查看发布页
                </mdui-button>
              </div>
            </template>

            <div v-if="item.reviews && item.reviews.length" class="review-history">
              <div class="review-history__header" @click="toggleReviewHistory(item.id)">
                <span>
                  <mdui-icon name="history--rounded" style="font-size:16px;vertical-align:middle;margin-right:4px"></mdui-icon>
                  审核历史 ({{ item.reviews.length }}次)
                </span>
                <mdui-icon :name="expandedReviews[item.id] ? 'expand_less--rounded' : 'expand_more--rounded'" style="font-size:18px"></mdui-icon>
              </div>
              <div v-if="expandedReviews[item.id]" class="review-history__timeline">
                <div v-for="review in item.reviews" :key="review.id" class="review-history__item">
                  <div class="review-history__dot" :class="review.action === 'APPROVED' ? 'review-history__dot--approved' : 'review-history__dot--rejected'"></div>
                  <div class="review-history__content">
                    <div class="review-history__meta">
                      <strong>{{ review.reviewer_display_name || '审核员' }}</strong>
                      <span class="review-history__action" :class="review.action === 'APPROVED' ? 'review-history__action--approved' : 'review-history__action--rejected'">
                        {{ review.action === 'APPROVED' ? '通过' : '驳回' }}
                      </span>
                      <span class="review-history__time">{{ formatDate(review.created_at, { withTime: true }) }}</span>
                    </div>
                    <div v-if="review.note" class="review-history__note">{{ review.note }}</div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="duplicateImages[item.id]?.length" class="duplicate-images-warning">
              <div class="duplicate-images-warning__header">
                <mdui-icon name="error--rounded" style="color: #dc2626; font-size: 18px"></mdui-icon>
                <span>检测到 {{ duplicateImages[item.id].length }} 张相同图片（MD5完全一致）</span>
              </div>
              <div class="similar-images-list">
                <div v-for="dup in duplicateImages[item.id]" :key="dup.id" class="similar-image-item similar-image-item--danger" @click="goToImage(dup.slug)">
                  <img :src="dup.image_url" :alt="dup.title" class="similar-image-item__thumb" />
                  <div class="similar-image-item__info">
                    <div class="similar-image-item__title">{{ dup.title }}</div>
                    <div v-if="item.status === 'PENDING' && dup.slug" class="similar-image-item__actions">
                      <mdui-button variant="text" size="small" @click.stop="insertImageToTop(item.id, dup.slug)">
                        <mdui-icon slot="icon" name="arrow_upward--rounded"></mdui-icon>
                        插入上方
                      </mdui-button>
                    </div>
                    <div class="similar-image-item__meta">
                      <span>上传者: {{ dup.uploader_display_name }}</span>
                      <a :href="`/image/${dup.slug}`" class="similar-image-item__link" @click.stop>查看详情页</a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="item.phash && similarImages[item.id]?.length" class="similar-images-warning">
              <div class="similar-images-warning__header">
                <mdui-icon name="warning--rounded" style="color: #f59e0b; font-size: 18px"></mdui-icon>
                <span>检测到 {{ similarImages[item.id].length }} 张相似图片</span>
              </div>
              <div class="similar-images-list">
                <div v-for="sim in similarImages[item.id]" :key="sim.id" class="similar-image-item" @click="openLightbox(sim.image_url)">
                  <img :src="sim.image_url" :alt="sim.title" class="similar-image-item__thumb" />
                  <div class="similar-image-item__info">
                    <div class="similar-image-item__title">{{ sim.title }}</div>
                    <div class="similar-image-item__meta">
                      <span>上传者: {{ sim.uploader_display_name }}</span>
                      <span class="similar-image-item__distance">相似度: {{ 100 - sim.hamming_distance }}%</span>
                      <a v-if="sim.slug" :href="`/image/${sim.slug}`" class="similar-image-item__link" @click.stop target="_blank">查看详情页</a>
                    </div>
                    <div v-if="item.status === 'PENDING'" class="similar-image-item__actions">
                      <mdui-button variant="text" size="small" @click.stop="insertImageToTop(item.id, sim.slug)">
                        <mdui-icon slot="icon" name="arrow_upward--rounded"></mdui-icon>
                        插入上方
                      </mdui-button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </template>
      </mdui-card>
    </div>

    <div v-else class="empty-state">当前筛选条件下没有投稿。</div>
  </section>

  <VueEasyLightbox
    teleport="body"
    :visible="lightboxVisible"
    :imgs="lightboxImg ? [lightboxImg] : []"
    :index="0"
    @hide="lightboxVisible = false"
  />

  <mdui-dialog :open="showInsertImageDialog" class="insert-image-dialog" @closed="showInsertImageDialog = false">
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

  <mdui-dialog :open="showInsertHelpSubmission" class="insert-help-dialog" @closed="showInsertHelpSubmission = false">
    <div class="dialog-content">
      <h3>如何插入图片？</h3>
      <div class="insert-help-content">
        <p>1. 在主页找到想要引用的图片</p>
        <p>2. 点击图片旁边的 <mdui-icon name="link--rounded" style="font-size: 18px; vertical-align: middle; color: #6750a4"></mdui-icon> 引用按钮</p>
        <p>3. 链接会自动复制到剪贴板</p>
        <p>4. 回到审核页面，点击"插入图片"，粘贴链接即可</p>
      </div>
    </div>
    <mdui-button slot="action" variant="filled" @click="showInsertHelpSubmission = false">我知道了</mdui-button>
  </mdui-dialog>

  <mdui-dialog :open="showReviewDialog" class="review-dialog" @closed="closeReviewDialog">
    <template v-if="reviewDialogItem">
      <mdui-icon 
        name="close--rounded" 
        class="review-dialog__close" 
        @click="closeReviewDialog"
      ></mdui-icon>
      <div class="review-dialog__header">
        <div class="review-dialog__title-row">
          <strong class="review-dialog__title">{{ reviewDialogItem.title }}</strong>
          <span class="status-pill" :class="statusClass(reviewDialogItem.status)">{{ statusLabel(reviewDialogItem.status) }}</span>
        </div>
        <div class="review-dialog__meta">
          <span class="review-dialog__meta-item">
            <mdui-icon name="person--rounded"></mdui-icon>
            {{ reviewDialogItem.uploader_display_name }}
          </span>
          <span class="review-dialog__meta-item">
            <mdui-icon name="schedule--rounded"></mdui-icon>
            {{ formatDate(reviewDialogItem.created_at, { withTime: true }) }}
          </span>
          <span v-if="reviewDialogItem.file_size" class="review-dialog__meta-item">
            <mdui-icon name="insert_drive_file--rounded"></mdui-icon>
            {{ formatFileSize(reviewDialogItem.file_size) }}
          </span>
        </div>
        <div v-if="reviewDialogItem.metadata?.edit_for_image_id" class="review-dialog__edit-banner">
          <mdui-icon name="edit--rounded"></mdui-icon>
          <span>这是已发布图片的重新编辑</span>
          <a v-if="reviewDialogItem.metadata?.edit_for_image_slug" :href="`/image/${reviewDialogItem.metadata.edit_for_image_slug}`" target="_blank" @click.stop>查看原图</a>
        </div>
      </div>

      <div class="review-dialog__body">
        <div class="review-dialog__preview" @click="openLightbox(reviewDialogItem)">
          <template v-if="previewMap[reviewDialogItem.id]">
            <img :src="previewMap[reviewDialogItem.id]" alt="预览图" />
          </template>
          <template v-else>
            <div class="review-dialog__preview-placeholder">
              <mdui-circular-progress v-if="previewLoadingId === reviewDialogItem.id" style="font-size:32px"></mdui-circular-progress>
              <mdui-icon v-else name="image--rounded" style="font-size:48px;color:#c0c8d0"></mdui-icon>
            </div>
          </template>
        </div>

        <div class="review-dialog__sidebar">
          <div v-if="reviewDialogItem.description" class="review-dialog__section">
            <div class="review-dialog__section-title">描述</div>
            <p class="review-dialog__description">{{ reviewDialogItem.description }}</p>
          </div>

          <div v-if="reviewDialogItem.reviewer_note" class="review-dialog__section">
            <div class="review-dialog__section-title">审核备注</div>
            <div class="review-dialog__note">{{ reviewDialogItem.reviewer_note }}</div>
          </div>

          <div v-if="duplicateImages[reviewDialogItem.id]?.length" class="review-dialog__section review-dialog__section--danger">
            <div class="review-dialog__section-title">
              <mdui-icon name="error--rounded"></mdui-icon>
              相同图片 ({{ duplicateImages[reviewDialogItem.id].length }})
            </div>
            <div class="review-dialog__similar-grid">
              <div v-for="dup in duplicateImages[reviewDialogItem.id]" :key="dup.id" class="review-dialog__similar-item" @click="goToImage(dup.slug)">
                <img :src="dup.image_url" :alt="dup.title" />
                <button v-if="reviewDialogItem.status === 'PENDING' && dup.slug" class="review-dialog__similar-insert" @click.stop="insertImageToTop(reviewDialogItem.id, dup.slug)" title="插入到备注">
                  <mdui-icon name="arrow_upward--rounded"></mdui-icon>
                </button>
              </div>
            </div>
          </div>

          <div v-if="reviewDialogItem.phash && similarImages[reviewDialogItem.id]?.length" class="review-dialog__section review-dialog__section--warning">
            <div class="review-dialog__section-title">
              <mdui-icon name="warning--rounded"></mdui-icon>
              相似图片 ({{ similarImages[reviewDialogItem.id].length }})
            </div>
            <div class="review-dialog__similar-grid">
              <div v-for="sim in similarImages[reviewDialogItem.id]" :key="sim.id" class="review-dialog__similar-item" @click="openLightbox(sim.image_url)">
                <img :src="sim.image_url" :alt="sim.title" />
                <div class="review-dialog__similar-badge">{{ 100 - sim.hamming_distance }}%</div>
                <button v-if="reviewDialogItem.status === 'PENDING'" class="review-dialog__similar-insert" @click.stop="insertImageToTop(reviewDialogItem.id, sim.slug)" title="插入到备注">
                  <mdui-icon name="arrow_upward--rounded"></mdui-icon>
                </button>
              </div>
            </div>
          </div>
          <div v-if="reviewSidebarPanels.length" class="review-dialog__plugin-panels">
            <component
              :is="panel.component"
              v-for="panel in reviewSidebarPanels"
              :key="panel.id"
              :submission="reviewDialogItem"
              :auth="auth"
              :config="panel.config"
              :plugin="panel"
            />
          </div>
        </div>
      </div>

      <div class="review-dialog__footer">
        <template v-if="reviewDialogItem.status === 'PENDING'">
          <div class="review-dialog__input-row">
            <input 
              v-model="reviewNotes[reviewDialogItem.id]"
              type="text" 
              class="review-dialog__input" 
              placeholder="输入审核备注（可选）..."
              maxlength="500"
            />
            <mdui-button variant="text" @click="showInsertPanel = !showInsertPanel" :class="{ 'mdui-button--active': showInsertPanel }" title="插入图片">
              <mdui-icon slot="icon" name="image--rounded"></mdui-icon>
            </mdui-button>
          </div>
          <div v-if="showInsertPanel" class="review-dialog__insert-panel">
            <div class="review-dialog__insert-hint">
              粘贴图片链接，格式如：<code>/image/xxxxx</code>
            </div>
            <div class="review-dialog__insert-row">
              <input 
                v-model="insertImageUrl"
                type="text" 
                class="review-dialog__input review-dialog__input--small"
                placeholder="粘贴图片链接..."
                @keyup.enter="confirmInsertImageInline"
              />
              <mdui-button variant="filled" size="small" :disabled="!insertImageUrl" @click="confirmInsertImageInline">
                插入
              </mdui-button>
            </div>
            <div v-if="insertPreviewImage" class="review-dialog__insert-preview">
              <img :src="insertPreviewImage.image_url" :alt="insertPreviewImage.title" />
              <span>{{ insertPreviewImage.title }}</span>
            </div>
          </div>
          <div class="review-dialog__actions">
            <mdui-button
              variant="filled"
              :disabled="actionBusyId === reviewDialogItem.id"
              :loading="actionBusyId === reviewDialogItem.id && actionType === 'publish'"
              @click="moderateAndClose(reviewDialogItem, 'publish')"
            >
              <mdui-icon slot="icon" name="check--rounded"></mdui-icon>
              通过发布
            </mdui-button>
            <mdui-button
              variant="outlined"
              :disabled="actionBusyId === reviewDialogItem.id"
              :loading="actionBusyId === reviewDialogItem.id && actionType === 'reject'"
              @click="moderateAndClose(reviewDialogItem, 'reject')"
            >
              <mdui-icon slot="icon" name="close--rounded"></mdui-icon>
              驳回
            </mdui-button>
          </div>
        </template>
        <template v-else-if="reviewDialogItem.status === 'PUBLISHED' && reviewDialogItem.published_image_slug">
          <mdui-button variant="filled" @click="goToImage(reviewDialogItem.published_image_slug)">
            <mdui-icon slot="icon" name="open_in_new--rounded"></mdui-icon>
            查看发布页
          </mdui-button>
        </template>
        <template v-else>
          <span class="review-dialog__status-hint">此投稿已被{{ reviewDialogItem.status === 'REJECTED' ? '驳回' : '处理' }}</span>
        </template>
      </div>
    </template>
  </mdui-dialog>

  <mdui-dialog :open="alreadyModeratedDialog" @closed="alreadyModeratedDialog = false">
    <div style="text-align:center;padding:20px 0">
      <mdui-icon name="schedule--rounded" style="font-size:48px;color:#f59e0b;margin-bottom:12px"></mdui-icon>
      <h3 style="margin:0 0 8px;font-size:18px">手慢了！</h3>
      <p style="margin:0;color:#5f6b76">该投稿刚刚已被其他审核员处理</p>
    </div>
    <mdui-button slot="action" variant="filled" @click="alreadyModeratedDialog = false">我知道了</mdui-button>
  </mdui-dialog>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { copyText, formatDate } from '@/lib/format'
import { createSubmissionPreview } from '@/lib/engagement'
import { getErrorMessage } from '@/lib/errors'
import { hammingDistance as rawHammingDistance } from '@/lib/phash'
import { showToast } from '@/lib/toast'
import { requireSupabase } from '@/lib/supabase'
import { useGalleryStore } from '@/stores/gallery'
import { emitPluginEvent, getAdminQuickActions, getReviewBulkActions, getSubmissionReviewSidebarPanels, invokePluginAction, invokePluginBulkAction } from '@/plugins/runtime'
import { useAuthStore } from '@/stores/auth'
import VueEasyLightbox from 'vue-easy-lightbox'
import AppTextField from '@/components/form/AppTextField.vue'
import AdminQuickActionStrip from '@/components/admin/AdminQuickActionStrip.vue'
import PluginReviewActionBar from '@/components/admin/PluginReviewActionBar.vue'

const tabs = [
  { label: '待我处理', value: 'MY_PENDING' },
  { label: '全部待审核', value: 'ALL_PENDING' },
  { label: '我已处理', value: 'MY_REVIEWED' },
  { label: '全站已处理', value: 'ALL_REVIEWED' },
  { label: '已发布', value: 'PUBLISHED' },
  { label: '已驳回', value: 'REJECTED' },
]

const galleryStore = useGalleryStore()
const router = useRouter()
const auth = useAuthStore()

const VIEW_MODE_KEY = 'admin-submissions-view-mode'

const submissions = ref([])
const loading = ref(false)
const activeTab = ref('MY_PENDING')
const viewMode = ref(localStorage.getItem(VIEW_MODE_KEY) || 'list')
const previewMap = reactive({})
const reviewNotes = reactive({})
const actionBusyId = ref('')
const actionType = ref('')
const previewLoadingId = ref('')
const lightboxVisible = ref(false)
const lightboxImg = ref('')
const showInsertImageDialog = ref(false)
const showInsertHelpSubmission = ref(false)
const insertImageUrl = ref('')
const insertPreviewImage = ref(null)
const insertError = ref('')
const currentInsertSubmissionId = ref('')
const expandedReviews = reactive({})
const similarImages = reactive({})
const alreadyModeratedDialog = ref(false)
const duplicateImages = reactive({})
const showReviewDialog = ref(false)
const reviewDialogItem = ref(null)
const reviewSidebarPanels = computed(() => {
  if (!reviewDialogItem.value) return []
  return getSubmissionReviewSidebarPanels({
    auth,
    submission: reviewDialogItem.value,
    row: reviewDialogItem.value,
    route: { path: '/admin/submissions' },
  })
})
const showInsertPanel = ref(false)
const selectedSubmissionIds = ref([])
const selectedSubmissions = computed(() => submissions.value.filter((item) => selectedSubmissionIds.value.includes(item.id)))
const allSubmissionsSelected = computed(() => submissions.value.length > 0 && selectedSubmissions.value.length === submissions.value.length)
const bulkActions = computed(() => getReviewBulkActions({
  target: 'admin-submissions',
  auth,
  router,
  route: { path: '/admin/submissions' },
  rows: selectedSubmissions.value,
  selectedItems: selectedSubmissions.value,
}).filter((action) => action.requiresSelection === false || selectedSubmissions.value.length > 0))

const coreQuickActions = computed(() => [
  {
    id: 'submission-refresh',
    label: '刷新列表',
    description: '重新加载当前筛选结果',
    icon: 'refresh--rounded',
    tone: 'secondary',
    onClick: () => loadSubmissions(),
  },
  {
    id: 'submission-dashboard',
    label: '返回总览',
    description: '回到后台工作台',
    icon: 'space_dashboard--rounded',
    tone: 'neutral',
    to: '/admin',
  },
])

const pluginQuickActions = computed(() => getAdminQuickActions({
  target: 'admin-submissions',
  auth,
  router,
  route: { path: '/admin/submissions' },
  rows: selectedSubmissions.value,
  selectedItems: selectedSubmissions.value,
}))

const pageQuickActions = computed(() => [...coreQuickActions.value, ...pluginQuickActions.value].sort((a, b) => (a.order || 0) - (b.order || 0)))

onMounted(loadSubmissions)

watch(viewMode, (newMode) => {
  localStorage.setItem(VIEW_MODE_KEY, newMode)
})

function switchTab(tabValue) {
  if (activeTab.value !== tabValue) {
    activeTab.value = tabValue
    loadSubmissions()
  }
}

function openReviewDialog(item) {
  reviewDialogItem.value = item
  showReviewDialog.value = true
}

function closeReviewDialog() {
  showReviewDialog.value = false
  reviewDialogItem.value = null
  showInsertPanel.value = false
  insertImageUrl.value = ''
  insertPreviewImage.value = null
}

async function moderateAndClose(item, action) {
  await moderate(item, action)
  closeReviewDialog()
}

function confirmInsertImageInline() {
  if (!insertPreviewImage.value || !reviewDialogItem.value) return
  const slug = insertPreviewImage.value.slug
  const insertText = `[img:${slug}] 已有相同/相似图片：<a href="/image/${slug}">点击进入已有图片页</a>`
  const currentNote = reviewNotes[reviewDialogItem.value.id] || ''
  reviewNotes[reviewDialogItem.value.id] = currentNote ? `${insertText} ${currentNote}` : insertText
  showInsertPanel.value = false
  insertImageUrl.value = ''
  insertPreviewImage.value = null
  showToast('图片已插入')
}

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
    const img = galleryStore.images.find(i => i.slug === slug)
    if (img) {
      insertPreviewImage.value = img
    } else {
      insertError.value = '没有找到这张图片'
    }
  } catch {
    insertError.value = '查询图片失败'
  }
})

async function loadSubmissions() {
  loading.value = true
  try {
    const supabase = requireSupabase()
    let query = supabase
      .from('submissions')
      .select(`
        *,
        published_image:images!published_image_id(slug),
        reviews:submission_reviews(id, reviewer_id, reviewer_display_name, action, note, created_at)
      `)
      .order('created_at', { ascending: false })
    
    const userId = auth.user?.id
    
    switch (activeTab.value) {
      case 'MY_PENDING':
        query = query.eq('status', 'PENDING').eq('assigned_reviewer_id', userId)
        break
      case 'ALL_PENDING':
        query = query.eq('status', 'PENDING')
        break
      case 'MY_REVIEWED':
        query = query.in('status', ['PUBLISHED', 'REJECTED']).eq('reviewer_id', userId)
        break
      case 'ALL_REVIEWED':
        query = query.in('status', ['PUBLISHED', 'REJECTED'])
        break
      case 'PUBLISHED':
        query = query.eq('status', 'PUBLISHED')
        break
      case 'REJECTED':
        query = query.eq('status', 'REJECTED')
        break
    }
    
    const { data, error } = await query
    if (error) throw error
    submissions.value = (data || []).map(item => ({
      ...item,
      published_image_slug: item.published_image?.slug || null,
      reviews: (item.reviews || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }))
    const visibleIds = new Set(submissions.value.map((item) => item.id))
    selectedSubmissionIds.value = selectedSubmissionIds.value.filter((id) => visibleIds.has(id))
    for (const item of submissions.value) {
      if (!previewMap[item.id]) loadThumb(item)
      if (item.phash) loadSimilarImages(item)
      if (item.file_md5) loadDuplicateImages(item)
    }
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function loadThumb(item) {
  if (previewMap[item.id] || previewLoadingId.value === item.id) return
  previewLoadingId.value = item.id
  try {
    previewMap[item.id] = await createSubmissionPreview(item.storage_path, 600)
  } catch {
    // ignore preview errors
  } finally {
    previewLoadingId.value = ''
  }
}

async function openLightbox(itemOrUrl) {
  if (typeof itemOrUrl === 'string') {
    lightboxImg.value = itemOrUrl
    lightboxVisible.value = true
    return
  }
  if (!previewMap[itemOrUrl.id]) await loadThumb(itemOrUrl)
  if (previewMap[itemOrUrl.id]) {
    lightboxImg.value = previewMap[itemOrUrl.id]
    lightboxVisible.value = true
  }
}

async function moderate(item, action) {
  actionBusyId.value = item.id
  actionType.value = action
  try {
    const supabase = requireSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { showToast('请先登录'); return }
    const response = await supabase.functions.invoke('moderate-submission', {
      body: { submissionId: item.id, action, note: reviewNotes[item.id] || '' },
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const { data, error } = response
    if (error) {
      let responseData = {}
      if (error.context && typeof error.context.json === 'function') {
        try {
          responseData = await error.context.json()
        } catch { /* ignore */ }
      }
      const errorMsg = responseData.error || error.message || '操作失败'
      const errorCode = responseData.code
      if (errorCode === 'ALREADY_MODERATED' || errorMsg.includes('已被其他审核员处理')) {
        alreadyModeratedDialog.value = true
        await loadSubmissions()
        return
      }
      showToast(errorMsg)
      return
    }
    if (action === 'publish') {
      const eventName = item?.metadata?.edit_for_image_id ? 'image.edit_approved' : 'submission.published'
      await emitPluginEvent(eventName, { submission: item, response: data, reviewNote: reviewNotes[item.id] || '' })
    } else {
      await emitPluginEvent('submission.rejected', { submission: item, response: data, reviewNote: reviewNotes[item.id] || '' })
    }
    showToast(action === 'publish' ? '投稿已通过并发布' : '投稿已驳回')
    await Promise.all([loadSubmissions(), galleryStore.loadImages(true)])
    return data
  } catch (error) {
    const message = getErrorMessage(error)
    if (message.includes('CORS') || message.includes('fetch') || message.includes('ERR_FAILED')) {
      showToast('审核服务暂不可用，请确认 Edge Function 已部署并配置 SERVICE_ROLE_KEY')
    } else {
      showToast(message)
    }
  } finally {
    actionBusyId.value = ''
    actionType.value = ''
  }
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function statusLabel(status) {
  return { PENDING: '待审核', PUBLISHED: '已发布', REJECTED: '已驳回', WITHDRAWN: '已撤回', IMAGE_DELETED: '已删除' }[status] || status
}
function statusClass(status) {
  return `status-pill--${{ PENDING: 'pending', PUBLISHED: 'published', REJECTED: 'rejected', WITHDRAWN: 'inactive', IMAGE_DELETED: 'deleted' }[status] || 'pending'}`
}

function goToImage(slug) {
  if (slug) {
    window.open(`/image/${slug}`, '_blank')
  }
}

function isSubmissionSelected(submissionId) {
  return selectedSubmissionIds.value.includes(submissionId)
}

function toggleSubmissionSelection(submissionId) {
  if (!submissionId) return
  if (isSubmissionSelected(submissionId)) {
    selectedSubmissionIds.value = selectedSubmissionIds.value.filter((id) => id !== submissionId)
    return
  }
  selectedSubmissionIds.value = [...selectedSubmissionIds.value, submissionId]
}

function toggleSelectAllSubmissions() {
  if (allSubmissionsSelected.value) {
    selectedSubmissionIds.value = []
    return
  }
  selectedSubmissionIds.value = submissions.value.map((item) => item.id)
}

function clearSubmissionSelection() {
  selectedSubmissionIds.value = []
}

async function runQuickAction(action) {
  if (!action) return
  if (action.pluginId) {
    try {
      await invokePluginAction(action, {
        auth,
        router,
        rows: selectedSubmissions.value,
        selectedItems: selectedSubmissions.value,
        showToast,
      })
    } catch (error) {
      showToast(getErrorMessage(error))
    }
    return
  }
  if (typeof action.onClick === 'function') {
    await action.onClick({ auth, router, rows: selectedSubmissions.value, selectedItems: selectedSubmissions.value })
    return
  }
  if (action.to) router.push(action.to)
}

async function runBulkAction(action) {
  if (!selectedSubmissions.value.length) return
  try {
    await invokePluginBulkAction(action, {
      auth,
      copyText,
      showToast,
      rows: selectedSubmissions.value,
      selectedItems: selectedSubmissions.value,
      target: 'admin-submissions',
    })
  } catch (error) {
    showToast(getErrorMessage(error))
  }
}

function toggleReviewHistory(submissionId) {
  expandedReviews[submissionId] = !expandedReviews[submissionId]
}

function isMissingSimilarityRpcError(error) {
  const message = String(error?.message || '')
  const code = String(error?.code || '')
  return ['42883', 'PGRST202', 'PGRST203'].includes(code) ||
    /does not exist/i.test(message) ||
    /Could not find the function/i.test(message) ||
    /Could not choose the best candidate function/i.test(message) ||
    /function overloading can be resolved/i.test(message)
}

function hexBitHammingDistance(hash1, hash2) {
  if (!hash1 || !hash2) return -1
  const left = String(hash1).trim().toLowerCase()
  const right = String(hash2).trim().toLowerCase()
  if (left.length !== right.length) return rawHammingDistance(left, right)
  if (!/^[0-9a-f]+$/.test(left) || !/^[0-9a-f]+$/.test(right)) {
    return rawHammingDistance(left, right)
  }

  let distance = 0
  for (let i = 0; i < left.length; i += 1) {
    const xor = parseInt(left[i], 16) ^ parseInt(right[i], 16)
    distance += xor.toString(2).replace(/0/g, '').length
  }

  return distance
}

async function loadSimilarImagesFallback(item) {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('images')
    .select('id, title, slug, image_url, uploader_display_name, phash')
    .not('phash', 'is', null)
    .limit(300)

  if (error) throw error

  similarImages[item.id] = (data || [])
    .map((row) => ({
      ...row,
      hamming_distance: hexBitHammingDistance(item.phash, row.phash),
    }))
    .filter((row) => row.hamming_distance > 0 && row.hamming_distance <= 10)
    .sort((a, b) => a.hamming_distance - b.hamming_distance)
    .slice(0, 5)
}

async function loadDuplicateImagesFallback(item) {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('images')
    .select('id, title, slug, image_url, uploader_display_name, file_md5')
    .eq('file_md5', item.file_md5)
    .limit(10)

  if (error) throw error
  duplicateImages[item.id] = data || []
}

async function loadSimilarImages(item) {
  if (!item.phash || similarImages[item.id]) return
  
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase.rpc('find_similar_images', {
      p_phash_hex: String(item.phash),
      p_threshold: 10,
      p_limit: 5,
    })
    
    if (error) throw error
    similarImages[item.id] = data || []
  } catch (error) {
    if (isMissingSimilarityRpcError(error)) {
      try {
        await loadSimilarImagesFallback(item)
        return
      } catch (fallbackError) {
        console.error('Failed to load similar images fallback:', fallbackError)
      }
    } else {
      console.error('Failed to load similar images:', error)
    }
    similarImages[item.id] = []
  }
}

async function loadDuplicateImages(item) {
  if (!item.file_md5 || duplicateImages[item.id]) return
  
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase.rpc('find_duplicate_images_by_md5', {
      p_md5: item.file_md5,
    })
    
    if (error) throw error
    duplicateImages[item.id] = data || []
  } catch (error) {
    if (isMissingSimilarityRpcError(error)) {
      try {
        await loadDuplicateImagesFallback(item)
        return
      } catch (fallbackError) {
        console.error('Failed to load duplicate images fallback:', fallbackError)
      }
    } else {
      console.error('Failed to load duplicate images:', error)
    }
    duplicateImages[item.id] = []
  }
}

function showInsertImageForSubmission(submissionId) {
  currentInsertSubmissionId.value = submissionId
  insertImageUrl.value = ''
  insertPreviewImage.value = null
  insertError.value = ''
  showInsertImageDialog.value = true
}

async function confirmInsertImage() {
  if (!insertPreviewImage.value || !currentInsertSubmissionId.value) return
  const img = insertPreviewImage.value
  const insertText = `[img:${img.slug}]`
  const currentNote = reviewNotes[currentInsertSubmissionId.value] || ''
  reviewNotes[currentInsertSubmissionId.value] = currentNote ? `${currentNote} ${insertText}` : insertText
  showInsertImageDialog.value = false
  insertImageUrl.value = ''
  insertPreviewImage.value = null
  currentInsertSubmissionId.value = ''
  showToast('图片已插入')
}

function insertImageToTop(submissionId, slug) {
  if (!slug) return
  const insertText = `[img:${slug}] 已有相同/相似图片：<a href="/image/${slug}">点击进入已有图片页</a>`
  const currentNote = reviewNotes[submissionId] || ''
  reviewNotes[submissionId] = currentNote ? `${insertText}\n${currentNote}` : insertText
  showToast('图片已插入到审核意见框开头')
}
</script>

<style scoped>
.submission-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 0 0;
  border-top: 1px solid rgba(24, 34, 44, 0.08);
  margin-top: 16px;
  flex-wrap: wrap;
}

.submission-tabs__spacer {
  flex: 1;
}

.submission-view-toggle {
  display: flex;
  gap: 4px;
  background: rgba(17, 24, 39, 0.04);
  border-radius: 8px;
  padding: 2px;
}

.view-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: #5f6b76;
  cursor: pointer;
  transition: all 0.15s;
}

.view-toggle-btn:hover {
  background: rgba(103, 80, 164, 0.1);
  color: #6750a4;
}

.view-toggle-btn--active {
  background: #fff;
  color: #6750a4;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.submission-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  background: transparent;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  color: #5f6b76;
  cursor: pointer;
  transition: all 0.2s;
}

.submission-tab:hover {
  background: rgba(103, 80, 164, 0.08);
  color: #6750a4;
}

.submission-tab--active {
  background: #6750a4;
  color: #fff;
}

.submission-tab--active:hover {
  background: #7965af;
  color: #fff;
}

.submission-tab__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.1);
}

.submission-tab--active .submission-tab__count {
  background: rgba(255, 255, 255, 0.2);
}

.submission-list--grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.submission-card--grid {
  margin-bottom: 0;
  overflow: hidden;
}

.submission-grid-item {
  cursor: pointer;
}

.submission-grid-item__thumb {
  width: 100%;
  aspect-ratio: 1;
  background: rgba(17, 24, 39, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.submission-grid-item__thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.submission-grid-item__info {
  padding: 12px;
}

.submission-grid-item__title {
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.submission-grid-item__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
  color: #8a9aaa;
}

.submission-card {
  margin-bottom: 16px;
}

.submission-card__layout {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 0;
}

.submission-thumb {
  width: 200px;
  height: 200px;
  border-radius: 12px 0 0 12px;
  overflow: hidden;
  background: rgba(17, 24, 39, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: sticky;
  top: 80px;
  align-self: start;
}

.submission-thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
}

.submission-thumb__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #8a9aaa;
}

.submission-card__content {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.submission-card__head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.submission-card__title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.submission-card__title {
  font-size: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.submission-description {
  font-size: 13px;
  color: #5f6b76;
  margin: 0;
}

.submission-file-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #8a9aaa;
}

.submission-reviewer-note {
  font-size: 12px;
  color: #5f6b76;
  margin-top: 4px;
}

.submission-edit-banner {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(103, 80, 164, 0.08);
  border-radius: 8px;
  font-size: 12px;
  color: #6750a4;
}

.submission-edit-banner a {
  margin-left: auto;
  color: #6750a4;
  font-weight: 500;
}

.submission-note-input {
  margin-top: 12px;
}

.submission-actions {
  margin-top: 10px;
}

@media (max-width: 720px) {
  .submission-card__layout {
    grid-template-columns: 1fr;
  }
  
  .submission-thumb {
    width: 100%;
    height: 180px;
    border-radius: 12px 12px 0 0;
    position: static;
  }
}

.review-history {
  margin-top: 12px;
  border: 1px solid rgba(24, 34, 44, 0.08);
  border-radius: 12px;
  overflow: hidden;
}

.review-history__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: rgba(17, 24, 39, 0.03);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #5f6b76;
  transition: background 0.15s;
}

.review-history__header:hover {
  background: rgba(17, 24, 39, 0.06);
}

.review-history__timeline {
  padding: 12px;
}

.review-history__item {
  display: flex;
  gap: 12px;
  position: relative;
  padding-bottom: 12px;
}

.review-history__item:last-child {
  padding-bottom: 0;
}

.review-history__item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 14px;
  bottom: 0;
  width: 2px;
  background: rgba(24, 34, 44, 0.08);
}

.review-history__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 2px;
}

.review-history__dot--approved {
  background: #22c55e;
}

.review-history__dot--rejected {
  background: #ef4444;
}

.review-history__content {
  flex: 1;
  min-width: 0;
}

.review-history__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.review-history__action {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.review-history__action--approved {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.review-history__action--rejected {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.review-history__time {
  color: #8a9aaa;
  font-size: 12px;
}

.review-history__note {
  margin-top: 4px;
  font-size: 12px;
  color: #5f6b76;
  padding: 8px;
  background: rgba(17, 24, 39, 0.03);
  border-radius: 8px;
}

.similar-images-warning {
  margin-top: 12px;
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 12px;
  overflow: hidden;
  background: rgba(245, 158, 11, 0.05);
}

.similar-images-warning__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 500;
  color: #b45309;
}

.similar-images-list {
  padding: 8px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.similar-image-item {
  display: flex;
  gap: 10px;
  padding: 8px;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}

.similar-image-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.similar-image-item__thumb {
  width: 60px;
  height: 60px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}

.similar-image-item__info {
  flex: 1;
  min-width: 0;
}

.similar-image-item__title {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.similar-image-item__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
  font-size: 11px;
  color: #8a9aaa;
}

.similar-image-item__distance {
  color: #f59e0b;
  font-weight: 500;
}

.similar-image-item__actions {
  margin-top: 6px;
}

.similar-image-item__actions mdui-button {
  --mdui-comp-button-container-height: 28px;
  font-size: 12px;
}

.duplicate-images-warning {
  margin-top: 12px;
  border: 1px solid rgba(220, 38, 38, 0.3);
  border-radius: 12px;
  overflow: hidden;
  background: rgba(220, 38, 38, 0.05);
}

.duplicate-images-warning__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 500;
  color: #dc2626;
}

.similar-image-item--danger {
  border: 1px solid rgba(220, 38, 38, 0.2);
}

.similar-image-item__link {
  color: #6750a4;
  text-decoration: none;
}

.similar-image-item__link:hover {
  text-decoration: underline;
}

.review-dialog {
  --mdui-dialog-max-width: 900px;
}

.review-dialog__close {
  position: fixed;
  top: 20px;
  right: 20px;
  font-size: 24px;
  color: #8a9aaa;
  cursor: pointer;
  z-index: 100;
  transition: color 0.2s;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  padding: 4px;
}

.review-dialog__close:hover {
  color: #374151;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.insert-image-dialog,
.insert-help-dialog {
  --mdui-z-index-dialog: 2000;
}

.review-dialog__header {
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(24, 34, 44, 0.08);
  margin-bottom: 16px;
  padding-right: 40px;
}

.review-dialog__title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.review-dialog__title {
  font-size: 18px;
  font-weight: 600;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.review-dialog__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 13px;
  color: #5f6b76;
}

.review-dialog__meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.review-dialog__edit-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 10px 14px;
  background: rgba(103, 80, 164, 0.08);
  border-radius: 10px;
  font-size: 13px;
  color: #6750a4;
}

.review-dialog__edit-banner a {
  margin-left: auto;
  color: #6750a4;
  font-weight: 500;
}

.review-dialog__meta-item mdui-icon {
  font-size: 16px;
  color: #8a9aaa;
}

.review-dialog__body {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 20px;
  min-height: 300px;
  max-height: 50vh;
}

.review-dialog__preview {
  background: rgba(17, 24, 39, 0.04);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  min-height: 300px;
}

.review-dialog__preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.review-dialog__preview-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8a9aaa;
}

.review-dialog__sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  padding-right: 8px;
}

.review-dialog__section {
  padding: 12px;
  background: rgba(17, 24, 39, 0.02);
  border-radius: 10px;
  border: 1px solid rgba(24, 34, 44, 0.06);
}

.review-dialog__section--danger {
  background: rgba(220, 38, 38, 0.04);
  border-color: rgba(220, 38, 38, 0.15);
}

.review-dialog__plugin-panels {
  display: grid;
  gap: 12px;
}

.review-dialog__section--warning {
  background: rgba(245, 158, 11, 0.04);
  border-color: rgba(245, 158, 11, 0.2);
}

.review-dialog__section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #5f6b76;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}

.review-dialog__section-title mdui-icon {
  font-size: 16px;
}

.review-dialog__section--danger .review-dialog__section-title {
  color: #dc2626;
}

.review-dialog__section--warning .review-dialog__section-title {
  color: #d97706;
}

.review-dialog__description {
  font-size: 13px;
  color: #374151;
  line-height: 1.6;
  margin: 0;
}

.review-dialog__note {
  font-size: 13px;
  color: #5f6b76;
  line-height: 1.5;
}

.review-dialog__similar-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.review-dialog__similar-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  background: rgba(17, 24, 39, 0.04);
}

.review-dialog__similar-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s;
}

.review-dialog__similar-item:hover img {
  transform: scale(1.05);
}

.review-dialog__similar-badge {
  position: absolute;
  bottom: 4px;
  right: 4px;
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  border-radius: 4px;
}

.review-dialog__similar-insert {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: rgba(103, 80, 164, 0.9);
  color: #fff;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.review-dialog__similar-item:hover .review-dialog__similar-insert {
  opacity: 1;
}

.review-dialog__similar-insert mdui-icon {
  font-size: 14px;
}

.review-dialog__footer {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(24, 34, 44, 0.08);
}

.review-dialog__input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.review-dialog__input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid rgba(24, 34, 44, 0.15);
  border-radius: 8px;
  font-size: 14px;
  background: #fff;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.review-dialog__input:focus {
  outline: none;
  border-color: #6750a4;
  box-shadow: 0 0 0 3px rgba(103, 80, 164, 0.1);
}

.review-dialog__input::placeholder {
  color: #8a9aaa;
}

.review-dialog__insert-panel {
  background: rgba(103, 80, 164, 0.04);
  border: 1px solid rgba(103, 80, 164, 0.15);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 12px;
}

.review-dialog__insert-hint {
  font-size: 12px;
  color: #5f6b76;
  margin-bottom: 10px;
}

.review-dialog__insert-hint code {
  background: rgba(103, 80, 164, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 11px;
}

.review-dialog__insert-row {
  display: flex;
  gap: 8px;
}

.review-dialog__input--small {
  padding: 8px 12px;
  font-size: 13px;
}

.review-dialog__insert-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  padding: 8px;
  background: #fff;
  border-radius: 8px;
}

.review-dialog__insert-preview img {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  object-fit: cover;
}

.review-dialog__insert-preview span {
  font-size: 13px;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mdui-button--active {
  background: rgba(103, 80, 164, 0.1);
  color: #6750a4;
}

.review-dialog__actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.review-dialog__status-hint {
  font-size: 13px;
  color: #8a9aaa;
}

@media (max-width: 700px) {
  .review-dialog__body {
    grid-template-columns: 1fr;
    max-height: none;
  }
  
  .review-dialog__preview {
    min-height: 200px;
    max-height: 250px;
  }
  
  .review-dialog__sidebar {
    max-height: 40vh;
  }
  
  .review-dialog__similar-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.bulk-toolbar-card { margin-bottom: 16px; }
.bulk-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.bulk-toolbar__meta { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.bulk-toolbar__actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.bulk-select-pill { display:inline-flex; align-items:center; gap:6px; font-size:12px; color:#5f6368; }
.bulk-select-pill input { width:16px; height:16px; }
.bulk-select-pill--overlay {
  position:absolute;
  top:12px;
  right:12px;
  z-index:2;
  padding:6px 10px;
  border-radius:999px;
  background:rgba(255,255,255,0.9);
  backdrop-filter: blur(8px);
}
.submission-grid-item { position: relative; }
.submission-grid-item--selected,
.submission-card--selected {
  box-shadow: 0 0 0 2px rgba(103,80,164,0.22);
}

</style>

