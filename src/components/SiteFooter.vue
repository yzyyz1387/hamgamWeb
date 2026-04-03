<template>
  <footer class="site-footer">
    <div class="site-footer__inner container">
      <div class="site-footer__links" v-if="links.length">        
        <span class="site-footer__links-label">友情链接</span>
        <a
          v-for="link in links"
          :key="link.id"
          :href="link.url"
          target="_blank"
          rel="noopener noreferrer"
          :title="link.description || link.title"
          class="site-footer__link"
        >{{ link.title }}</a>
      </div>
      <div class="site-footer__bottom">
        <div class="site-footer__left">
          <span class="site-footer__name">{{ siteConfig.name }}</span>
          <span v-if="siteConfig.icp" class="site-footer__icp">
            <a
              :href="`${siteConfig.icpUrl || 'https://beian.miit.gov.cn/'}${siteConfig.icp}`"
              target="_blank"
              rel="noopener noreferrer"
              class="site-footer__icp-link"
            >{{ siteConfig.icp }}</a>
          </span>
          <a
            v-if="siteConfig.moeIcp"
            :href="`https://icp.gov.moe/?keyword=${siteConfig.moeIcp}`"
            target="_blank"
            rel="noopener noreferrer"
            class="site-footer__moe-icp"
          >
            <img src="/icon120.png" alt="萌ICP" class="site-footer__moe-icp-icon" />
            <span>萌ICP备{{ siteConfig.moeIcp }}号</span>
          </a>
        </div>
        <button class="site-footer__feedback-btn" @click="showSiteFeedback = true">
          <mdui-icon name="feedback--rounded"></mdui-icon>
          <span class="site-footer__feedback-text">提交反馈</span>
        </button>
      </div>
    </div>
    <SiteFeedbackDialog v-model:visible="showSiteFeedback" @submitted="onFeedbackSubmitted" />
  </footer>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { siteConfig } from '@/config/site'
import { supabaseEnabled, requireSupabase } from '@/lib/supabase'
import { showToast } from '@/lib/toast'
import SiteFeedbackDialog from '@/components/feedback/SiteFeedbackDialog.vue'

const links = ref([])
const showSiteFeedback = ref(false)

onMounted(async () => {
  if (!supabaseEnabled) return
  try {
    const supabase = requireSupabase()
    const { data } = await supabase
      .from('friend_links')
      .select('id, title, url, description')
      .eq('is_active', true)
      .order('sort_order')
    links.value = data || []
  } catch {
    // 表不存在时静默失败
  }
})

function onFeedbackSubmitted() {
  showToast('感谢你的反馈！')
}
</script>

<style scoped>
.site-footer__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.site-footer__left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.site-footer__feedback-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  background: rgba(103, 80, 164, 0.08);
  border-radius: 8px;
  font-size: 12px;
  color: #6750a4;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
  flex-shrink: 0;
}
.site-footer__feedback-btn:hover {
  background: rgba(103, 80, 164, 0.15);
}
.site-footer__feedback-btn:active {
  transform: scale(0.96);
}

@media (max-width: 600px) {
  .site-footer__bottom {
    flex-direction: column;
    align-items: center;
    gap: 16px;
    text-align: center;
  }
  
  .site-footer__left {
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: 100%;
  }
  
  .site-footer__name {
    font-size: 13px;
  }
  
  .site-footer__icp,
  .site-footer__moe-icp {
    font-size: 11px;
  }
  
  .site-footer__feedback-btn {
    padding: 8px 16px;
    font-size: 13px;
  }
}
</style>
