<template>
  <section class="page team-page">
    <!-- 超级管理员 -->
    <div v-if="admins.length" class="team-section">
      <div class="team-section__label eyebrow">超级管理员</div>
      <div class="team-admins">
        <div v-for="u in admins" :key="u.id" class="team-card team-card--admin" @click="goUser(u.uid)">
          <div class="team-card__avatar team-card__avatar--lg">
            <img v-if="u.avatar_url" :src="u.avatar_url" :alt="u.nickname" />
            <span v-else>{{ initial(u.nickname) }}</span>
          </div>
          <div class="team-card__name">{{ u.nickname }}</div>
          <div v-if="u.callsign" class="team-card__callsign">
            <mdui-icon name="settings_input_antenna--rounded" style="font-size:13px"></mdui-icon>
            {{ u.callsign }}
          </div>
          <p v-if="u.bio" class="team-card__bio">{{ u.bio }}</p>
          <div v-if="parsedCerts(u.certifications).length" class="team-card__certs">
            <span
              v-for="cert in parsedCerts(u.certifications)"
              :key="cert.label"
              class="identity-pill identity-pill--cert identity-pill--sm"
              :class="{ 'identity-pill--icon-only': !displayCertLabel(cert.label) }"
              :title="cert.label || ''"
            >
              <mdui-icon :name="certIconName(cert.icon)" class="cert-icon"></mdui-icon>
              <template v-if="displayCertLabel(cert.label)">{{ displayCertLabel(cert.label) }}</template>
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="reviewers.length" class="team-divider"></div>

    <!-- 审核人员 -->
    <div v-if="reviewers.length" class="team-section">
      <div class="team-section__label eyebrow">审核人员</div>
      <div class="team-grid">
        <div v-for="u in reviewers" :key="u.id" class="team-card" @click="goUser(u.uid)">
          <div class="team-card__avatar">
            <img v-if="u.avatar_url" :src="u.avatar_url" :alt="u.nickname" />
            <span v-else>{{ initial(u.nickname) }}</span>
          </div>
          <div class="team-card__name">{{ u.nickname }}</div>
          <div v-if="u.callsign" class="team-card__callsign">
            <mdui-icon name="settings_input_antenna--rounded" style="font-size:13px"></mdui-icon>
            {{ u.callsign }}
          </div>
          <p v-if="u.bio" class="team-card__bio">{{ u.bio }}</p>
          <div v-if="parsedCerts(u.certifications).length" class="team-card__certs">
            <span
              v-for="cert in parsedCerts(u.certifications)"
              :key="cert.label"
              class="identity-pill identity-pill--cert identity-pill--sm"
              :class="{ 'identity-pill--icon-only': !displayCertLabel(cert.label) }"
              :title="cert.label || ''"
            >
              <mdui-icon :name="certIconName(cert.icon)" class="cert-icon"></mdui-icon>
              <template v-if="displayCertLabel(cert.label)">{{ displayCertLabel(cert.label) }}</template>
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="featured.length" class="team-divider"></div>

    <!-- 特邀人员 -->
    <div v-if="featured.length" class="team-section">
      <div class="team-section__label eyebrow">特邀人员</div>
      <div class="team-grid">
        <div v-for="u in featured" :key="u.id" class="team-card" @click="goUser(u.uid)">
          <div class="team-card__avatar">
            <img v-if="u.avatar_url" :src="u.avatar_url" :alt="u.nickname" />
            <span v-else>{{ initial(u.nickname) }}</span>
          </div>
          <div class="team-card__name">{{ u.nickname }}</div>
          <div v-if="u.callsign" class="team-card__callsign">
            <mdui-icon name="settings_input_antenna--rounded" style="font-size:13px"></mdui-icon>
            {{ u.callsign }}
          </div>
          <p v-if="u.bio" class="team-card__bio">{{ u.bio }}</p>
          <div v-if="parsedCerts(u.certifications).length" class="team-card__certs">
            <span
              v-for="cert in parsedCerts(u.certifications)"
              :key="cert.label"
              class="identity-pill identity-pill--cert identity-pill--sm"
              :class="{ 'identity-pill--icon-only': !displayCertLabel(cert.label) }"
              :title="cert.label || ''"
            >
              <mdui-icon :name="certIconName(cert.icon)" class="cert-icon"></mdui-icon>
              <template v-if="displayCertLabel(cert.label)">{{ displayCertLabel(cert.label) }}</template>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 用户统计 + 弹幕 -->
    <div class="team-community section-card">
      <div class="team-community__stat">
        还有你们，网站用户
        <strong class="team-community__count">{{ userCount }}</strong>
        <span v-if="activeCount" class="muted" style="font-size:13px">（活跃用户 {{ activeCount }}）</span>
      </div>

      <div class="team-danmaku-wrap">
        <vue3-danmaku
          v-if="danmakuItems.length"
          ref="danmakuRef"
          :danmus="danmakuItems"
          :speeds="120"
          :channels="3"
          :loop="true"
          :is-suspend="false"
          use-slot
          class="team-danmaku"
        >
          <template #dm="{ danmu }">
            <div class="danmaku-item">
              <div class="danmaku-avatar">
                <img v-if="danmu.avatar_url" :src="danmu.avatar_url" :alt="danmu.nickname" />
                <span v-else>{{ initial(danmu.nickname) }}</span>
              </div>
              <span class="danmaku-name">{{ danmu.nickname }}</span>
              <span v-if="danmu.callsign" class="danmaku-callsign">{{ danmu.callsign }}</span>
            </div>
          </template>
        </vue3-danmaku>
        <div v-else class="muted" style="text-align:center;padding:20px;font-size:13px">弹幕加载中…</div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import vue3Danmaku from 'vue3-danmaku'
import { requireSupabase, supabaseEnabled } from '@/lib/supabase'
import { showToast } from '@/lib/toast'
import { useDanmakuUsers } from '@/composables/useDanmakuUsers'
import { useTeamMembers } from '@/composables/useTeamMembers'
import { toUserProfilePath } from '@/lib/uid'

const router = useRouter()
const userCount = ref(0)
const activeCount = ref(0)
const danmakuRef = ref(null)

const { admins, reviewers, featured, loadMembers } = useTeamMembers()
const { users: danmakuUsers, load: loadDanmaku } = useDanmakuUsers()

const danmakuItems = computed(() =>
  danmakuUsers.value.map((u) => ({ ...u, key: u.id }))
)

onMounted(async () => {
  await Promise.all([loadMembers(), loadStats(), loadDanmaku()])
})

async function loadStats() {
  if (!supabaseEnabled) return
  try {
    const supabase = requireSupabase()
    const [totalRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ])
    userCount.value = totalRes.count || 0
    // 活跃用户口径：有过投稿或评论的用户（近似）
    // 当前简化为：有 callsign 或有 bio 的用户视为活跃
    // 后续可优化为：统计 last_active_at 字段
    const { count: ac } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .or('callsign.not.is.null,bio.not.is.null')
    activeCount.value = ac || 0
  } catch {}
}

function goUser(uid) {
  const path = toUserProfilePath(uid)
  if (path) router.push(path)
}

function initial(name = '') {
  return name.trim().slice(0, 1).toUpperCase() || 'U'
}

function parsedCerts(raw) {
  if (!raw || !Array.isArray(raw)) return []
  return raw.map((c) => typeof c === 'string' ? { label: c, icon: 'award_star' } : c)
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
