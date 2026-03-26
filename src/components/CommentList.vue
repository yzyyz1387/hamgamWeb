<template>
  <div v-if="comments.length" class="comment-list">
    <article v-for="comment in comments" :key="comment.id" class="comment-item">
      <div class="comment-item__head">
        <!-- 左：头像 + 作者信息 -->
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
            <!-- 认证徽标：每个 pill 用标准 inline-flex 结构 -->
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
        <!-- 右：时间 -->
        <time class="comment-time">{{ formatDate(comment.created_at, { withTime: true }) }}</time>
      </div>
      <div class="rich-text comment-body" v-html="textToHtml(comment.content)"></div>
    </article>
  </div>
  <div v-else class="empty-state">还没有评论，来写第一条吧。</div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { formatDate, textToHtml } from '@/lib/format'
import { resolvePublicUserUid } from '@/lib/publicProfiles'
import { toUserProfilePath } from '@/lib/uid'

defineProps({ comments: { type: Array, default: () => [] } })

const router = useRouter()

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
