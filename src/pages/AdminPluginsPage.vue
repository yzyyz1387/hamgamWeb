<template>
  <section class="page feature-page">
    <mdui-card class="section-card">
      <div class="section-card__header section-card__header--wrap">
        <div>
          <div class="eyebrow">功能模块</div>
          <h1>管理内置模块的开关与配置</h1>
          <p class="muted">
            这些能力都是内置源码模块，不再经过安装、卸载和注册中心流程，统一通过 feature flags 控制启用状态。
          </p>
        </div>
        <mdui-button variant="text" :loading="refreshing" @click="refreshRuntime">
          <mdui-icon slot="icon" name="refresh--rounded"></mdui-icon>
          刷新
        </mdui-button>
      </div>

      <div class="feature-meta-row">
        <span class="feature-chip feature-chip--light">配置来源：{{ runtimeSourceLabel }}</span>
        <span class="feature-chip feature-chip--light">模块数：{{ featureCards.length }}</span>
        <span class="feature-chip feature-chip--light">已启用：{{ enabledCount }}</span>
        <span v-if="runtimeState.lastLoadedAt" class="feature-chip feature-chip--light">
          最近加载：{{ formatTime(runtimeState.lastLoadedAt) }}
        </span>
        <span v-if="runtimeState.lastSyncedAt" class="feature-chip feature-chip--light">
          最近同步：{{ formatTime(runtimeState.lastSyncedAt) }}
        </span>
      </div>

      <p v-if="runtimeState.error" class="page-tip page-tip--warning">{{ runtimeState.error }}</p>
    </mdui-card>

    <div class="feature-layout">
      <mdui-card class="section-card feature-list-card">
        <div class="section-card__header">
          <div>
            <div class="eyebrow">模块列表</div>
            <h2>选择一个模块</h2>
          </div>
          <div class="muted">{{ filteredCards.length }} 个结果</div>
        </div>

        <label class="feature-search">
          <mdui-icon name="search--rounded"></mdui-icon>
          <input v-model.trim="keyword" type="text" placeholder="搜索模块名称、ID 或描述" />
        </label>

        <div class="feature-list">
          <button
            v-for="feature in filteredCards"
            :key="feature.id"
            type="button"
            class="feature-card"
            :class="{ 'feature-card--active': feature.id === selectedFeatureId }"
            @click="selectFeature(feature)"
          >
            <div class="feature-card__head">
              <div>
                <div class="feature-card__title">{{ feature.name }}</div>
                <div class="feature-card__sub">{{ feature.id }}</div>
              </div>
              <span class="status-pill" :class="feature.enabled ? 'status-pill--published' : 'status-pill--muted'">
                {{ feature.enabled ? '已启用' : '已关闭' }}
              </span>
            </div>
            <p class="feature-card__desc">{{ feature.description || '暂无描述' }}</p>
            <div class="feature-card__meta">
              <span class="feature-chip">版本 {{ feature.version }}</span>
              <span class="feature-chip feature-chip--light">{{ feature.configSchema.length }} 项配置</span>
              <span class="feature-chip" :class="feature.compatibility.compatible ? 'feature-chip--success' : 'feature-chip--danger'">
                {{ feature.compatibility.compatible ? '接口兼容' : '需要检查兼容性' }}
              </span>
            </div>
          </button>
        </div>
      </mdui-card>

      <mdui-card v-if="selectedFeature" class="section-card feature-detail-card">
        <div class="section-card__header section-card__header--wrap">
          <div>
            <div class="eyebrow">模块详情</div>
            <div class="feature-detail-title">
              <h2>{{ selectedFeature.name }}</h2>
              <span class="status-pill" :class="selectedFeature.enabled ? 'status-pill--published' : 'status-pill--muted'">
                {{ selectedFeature.enabled ? '已启用' : '已关闭' }}
              </span>
            </div>
            <p class="muted">ID：{{ selectedFeature.id }} · 版本：{{ selectedFeature.version }}</p>
          </div>
          <div class="feature-detail-actions">
            <mdui-button
              :variant="selectedFeature.enabled ? 'filled-tonal' : 'filled'"
              :loading="savingFeatureId === selectedFeature.id"
              @click="toggleFeature(selectedFeature, !selectedFeature.enabled)"
            >
              {{ selectedFeature.enabled ? '关闭模块' : '启用模块' }}
            </mdui-button>
            <mdui-button v-if="selectedFeature.quickRoute" variant="text" @click="router.push(selectedFeature.quickRoute)">
              打开入口
            </mdui-button>
          </div>
        </div>

        <p class="feature-detail-desc">{{ selectedFeature.description || '暂无描述' }}</p>

        <div class="feature-stats">
          <div class="feature-stat">
            <div class="eyebrow">路由</div>
            <strong>{{ selectedFeature.routes.length }}</strong>
          </div>
          <div class="feature-stat">
            <div class="eyebrow">菜单</div>
            <strong>{{ selectedFeature.menus.length }}</strong>
          </div>
          <div class="feature-stat">
            <div class="eyebrow">能力声明</div>
            <strong>{{ selectedFeature.capabilities.length }}</strong>
          </div>
          <div class="feature-stat">
            <div class="eyebrow">配置项</div>
            <strong>{{ selectedFeature.configSchema.length }}</strong>
          </div>
        </div>

        <div class="feature-section">
          <div class="feature-section__title">兼容与迁移</div>
          <div class="feature-chip-row">
            <span class="feature-chip feature-chip--light">宿主版本 {{ selectedFeature.compatibility.hostVersion }}</span>
            <span class="feature-chip feature-chip--light">要求范围 {{ selectedFeature.compatibility.requiredRange }}</span>
            <span class="feature-chip feature-chip--light">Schema {{ selectedFeature.upgradePolicy?.schemaVersion || '--' }}</span>
          </div>
          <p class="page-tip" style="margin-top: 12px;">
            {{ selectedFeature.compatibility.commandHint || '数据库快照和迁移已经合并到 supabase/schema.sql 与最新 migration。' }}
          </p>
        </div>

        <div class="feature-section">
          <div class="feature-section__title">能力声明</div>
          <div v-if="selectedFeature.capabilities.length" class="feature-chip-row">
            <span v-for="capability in selectedFeature.capabilities" :key="capability" class="feature-chip feature-chip--light">
              {{ capability }}
            </span>
          </div>
          <p v-else class="muted">当前模块没有额外能力声明。</p>
        </div>

        <div class="feature-section">
          <div class="feature-section__title">模块配置</div>
          <PluginConfigEditor
            :schema="selectedFeature.configSchema"
            :model-value="selectedFeature.config"
            :default-value="selectedFeature.defaultConfig"
            :saving="savingConfigFeatureId === selectedFeature.id"
            @save="saveConfig(selectedFeature, $event)"
            @reset="saveConfig(selectedFeature, $event)"
          />
        </div>
      </mdui-card>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabaseEnabled } from '@/lib/supabase'
import { showToast } from '@/lib/toast'
import PluginConfigEditor from '@/components/admin/PluginConfigEditor.vue'
import {
  getAvailablePlugins,
  getPluginCompatibilityReport,
  getPluginConfig,
  getPluginRegistryState,
  getPluginRuntimeState,
  getPluginUpgradePolicy,
  reloadPluginRuntime,
  savePluginConfig,
  setPluginEnabled,
} from '@/plugins/runtime'

const router = useRouter()
const route = useRoute()
const runtimeState = getPluginRuntimeState()
const availablePlugins = getAvailablePlugins()

const refreshing = ref(false)
const savingFeatureId = ref('')
const savingConfigFeatureId = ref('')
const keyword = ref('')
const localSelectedFeatureId = ref('')

const runtimeSourceLabel = computed(() => {
  if (runtimeState.source === 'supabase') return 'Supabase system_settings'
  if (runtimeState.source === 'local') return '浏览器本地缓存'
  return 'Manifest 默认值'
})

const featureCards = computed(() => availablePlugins.map((plugin) => {
  const registry = getPluginRegistryState(plugin.id) || {}
  const enabled = typeof registry.enabled === 'boolean' ? registry.enabled : plugin.enabled !== false
  const routes = plugin.routes || []
  const menus = plugin.menus || []
  return {
    id: plugin.id,
    name: plugin.name,
    version: plugin.version || '0.0.0',
    description: plugin.description || '',
    capabilities: plugin.capabilities || [],
    routes,
    menus,
    enabled,
    config: getPluginConfig(plugin.id),
    defaultConfig: plugin.defaultConfig || {},
    configSchema: plugin.configSchema || [],
    compatibility: getPluginCompatibilityReport(plugin.id),
    upgradePolicy: getPluginUpgradePolicy(plugin.id),
    quickRoute: routes.find((item) => item.path?.startsWith('/admin'))?.path || routes[0]?.path || '',
  }
}))

const filteredCards = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return featureCards.value
  return featureCards.value.filter((feature) =>
    [feature.name, feature.id, feature.description]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(q)),
  )
})

const enabledCount = computed(() => featureCards.value.filter((feature) => feature.enabled).length)

const selectedFeatureId = computed(() => {
  if (filteredCards.value.some((feature) => feature.id === localSelectedFeatureId.value)) {
    return localSelectedFeatureId.value
  }
  const routeFeatureId = typeof route.params.pluginId === 'string' ? route.params.pluginId : ''
  if (filteredCards.value.some((feature) => feature.id === routeFeatureId)) {
    return routeFeatureId
  }
  return filteredCards.value[0]?.id || ''
})

const selectedFeature = computed(() =>
  filteredCards.value.find((feature) => feature.id === selectedFeatureId.value) || null)

watch(() => route.params.pluginId, (value) => {
  if (typeof value === 'string' && value) {
    localSelectedFeatureId.value = value
  }
}, { immediate: true })

watch(filteredCards, (features) => {
  if (!features.length) {
    localSelectedFeatureId.value = ''
    return
  }
  if (!features.some((feature) => feature.id === localSelectedFeatureId.value)) {
    localSelectedFeatureId.value = features[0].id
  }
}, { immediate: true })

function formatTime(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleString()
}

async function refreshRuntime() {
  refreshing.value = true
  try {
    await reloadPluginRuntime({ router })
    showToast(supabaseEnabled ? '功能模块配置已刷新。' : '已刷新本地功能模块配置。')
  } catch (error) {
    showToast(error?.message || '刷新功能模块配置失败。')
  } finally {
    refreshing.value = false
  }
}

async function toggleFeature(feature, enabled) {
  if (!feature?.id) return
  savingFeatureId.value = feature.id
  try {
    await setPluginEnabled(feature.id, enabled, { router })
    showToast(enabled ? `已启用 ${feature.name}` : `已关闭 ${feature.name}`)
  } catch (error) {
    showToast(error?.message || '更新模块状态失败。')
  } finally {
    savingFeatureId.value = ''
  }
}

async function saveConfig(feature, config) {
  if (!feature?.id) return
  savingConfigFeatureId.value = feature.id
  try {
    await savePluginConfig(feature.id, config, { router })
    showToast(`${feature.name} 配置已保存。`)
  } catch (error) {
    showToast(error?.message || '保存模块配置失败。')
  } finally {
    savingConfigFeatureId.value = ''
  }
}

function selectFeature(feature) {
  if (!feature?.id) return
  localSelectedFeatureId.value = feature.id
  if (typeof window !== 'undefined') {
    const targetPath = router.resolve({ name: 'admin-plugins', params: { pluginId: feature.id } }).fullPath
    window.history.replaceState(window.history.state, '', targetPath)
    return
  }
  router.replace({ name: 'admin-plugins', params: { pluginId: feature.id } }).catch(() => {})
}

onMounted(async () => {
  if (!runtimeState.loaded) {
    await refreshRuntime()
  }
})
</script>

<style scoped>
.feature-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.feature-layout {
  display: grid;
  grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
  gap: 20px;
}

.feature-list-card,
.feature-detail-card {
  min-height: 0;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feature-card {
  width: 100%;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  background: #fff;
  padding: 16px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.feature-card:hover,
.feature-card--active {
  border-color: rgba(14, 165, 233, 0.45);
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.feature-card__head,
.feature-detail-title,
.feature-meta-row,
.feature-chip-row,
.feature-detail-actions,
.feature-card__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.feature-card__head {
  justify-content: space-between;
  align-items: flex-start;
}

.feature-card__title {
  font-weight: 700;
}

.feature-card__sub,
.feature-card__desc,
.feature-detail-desc {
  color: var(--mdui-color-on-surface-variant, #64748b);
}

.feature-card__desc,
.feature-detail-desc {
  margin: 12px 0;
}

.feature-chip {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(14, 165, 233, 0.12);
  color: #0f172a;
}

.feature-chip--light {
  background: rgba(148, 163, 184, 0.14);
}

.feature-chip--success {
  background: rgba(34, 197, 94, 0.16);
}

.feature-chip--danger {
  background: rgba(239, 68, 68, 0.14);
}

.feature-search {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding: 0 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.9);
}

.feature-search input {
  flex: 1;
  min-width: 0;
  height: 44px;
  border: 0;
  outline: 0;
  background: transparent;
}

.feature-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 20px 0;
}

.feature-stat {
  padding: 14px;
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.95);
}

.feature-section {
  margin-top: 20px;
}

.feature-section__title {
  margin-bottom: 12px;
  font-weight: 700;
}

@media (max-width: 960px) {
  .feature-layout {
    grid-template-columns: 1fr;
  }

  .feature-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
