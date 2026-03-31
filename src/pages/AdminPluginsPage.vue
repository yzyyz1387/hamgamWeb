<template>
  <section class="page">
    <mdui-card class="section-card">
      <div class="section-card__header section-card__header--wrap">
        <div>
          <div class="eyebrow">插件管理</div>
          <h1>管理插件状态、配置和入口</h1>
          <p class="muted">查看可用插件，控制安装、启用和配置。</p>
        </div>
        <div class="dashboard-actions">
          <mdui-button variant="text" :loading="refreshing" @click="refreshRuntime()">
            <mdui-icon slot="icon" name="refresh--rounded"></mdui-icon>
            刷新状态
          </mdui-button>
          <mdui-button variant="filled-tonal" :loading="syncing" :disabled="!canSyncRemote" @click="syncToSupabase">
            同步到 Supabase
          </mdui-button>
        </div>
      </div>
      <div class="plugin-source-row">
        <span class="plugin-chip plugin-chip--light">配置来源：{{ runtimeSourceLabel }}</span>
        <span class="plugin-chip plugin-chip--light">数据库：{{ supabaseEnabled ? '已配置' : '未配置' }}</span>
        <span class="plugin-chip plugin-chip--light">登记记录：{{ runtimeState.remoteCount }}</span>
        <span v-if="runtimeState.lastLoadedAt" class="plugin-chip plugin-chip--light">最近加载：{{ formatTime(runtimeState.lastLoadedAt) }}</span>
        <span v-if="runtimeState.lastSyncedAt" class="plugin-chip plugin-chip--light">最近同步：{{ formatTime(runtimeState.lastSyncedAt) }}</span>
      </div>
      <p v-if="runtimeState.error" class="page-tip page-tip--warning">{{ runtimeState.error }}</p>
      <p class="page-tip">安装后才会接入菜单、路由和扩展点；卸载后仍保留在列表中，便于重新安装。</p>
    </mdui-card>

    <div class="plugin-summary-grid">
      <mdui-card class="section-card plugin-summary-card">
        <div class="eyebrow">可用</div>
        <h2>{{ availablePlugins.length }}</h2>
        <p class="muted">当前项目内置的插件。</p>
      </mdui-card>
      <mdui-card class="section-card plugin-summary-card">
        <div class="eyebrow">已安装</div>
        <h2>{{ installedCount }}</h2>
        <p class="muted">已接入运行时管理。</p>
      </mdui-card>
      <mdui-card class="section-card plugin-summary-card">
        <div class="eyebrow">运行中</div>
        <h2>{{ enabledCount }}</h2>
        <p class="muted">已安装并启用的插件。</p>
      </mdui-card>
      <mdui-card class="section-card plugin-summary-card">
        <div class="eyebrow">当前选择</div>
        <h2>{{ selectedPlugin ? selectedPlugin.name : '—' }}</h2>
        <p class="muted">当前正在查看的插件。</p>
      </mdui-card>
    </div>

    <mdui-card class="section-card plugin-toolbar-card">
      <div class="plugin-toolbar">
        <label class="plugin-search-field">
          <mdui-icon name="search--rounded"></mdui-icon>
          <input v-model.trim="searchKeyword" type="text" class="plugin-search-field__input" placeholder="搜索插件名称、ID 或描述" />
        </label>
        <div class="plugin-filter-group">
          <button
            v-for="option in filterOptions"
            :key="option.value"
            type="button"
            class="plugin-filter-pill"
            :class="{ 'plugin-filter-pill--active': filterMode === option.value }"
            @click="filterMode = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
    </mdui-card>

    <div class="plugin-workspace">
      <mdui-card class="section-card plugin-browser-card">
        <div class="section-card__header">
          <div>
            <div class="eyebrow">插件列表</div>
            <h2>选择要管理的插件</h2>
          </div>
          <div class="muted">{{ filteredPluginCards.length }} 个结果</div>
        </div>

        <div v-if="filteredPluginCards.length" class="plugin-grid">
          <button
            v-for="plugin in filteredPluginCards"
            :key="plugin.id"
            type="button"
            class="plugin-grid-card"
            :class="{ 'plugin-grid-card--active': plugin.id === selectedPluginId }"
            @click="selectPlugin(plugin)"
          >
            <div class="plugin-grid-card__head">
              <div>
                <div class="plugin-grid-card__title">{{ plugin.name }}</div>
                <div class="plugin-grid-card__sub">{{ plugin.id }}</div>
              </div>
              <span class="status-pill" :class="plugin.installed ? (plugin.enabled ? 'status-pill--published' : 'status-pill--draft') : 'status-pill--muted'">
                {{ plugin.installed ? (plugin.enabled ? '运行中' : '已安装') : '未安装' }}
              </span>
            </div>
            <p class="plugin-grid-card__description">{{ plugin.description || '暂无描述' }}</p>
            <div class="plugin-grid-card__meta-row">
              <span class="plugin-chip">版本 {{ plugin.version }}</span>
              <span class="plugin-chip plugin-chip--light">{{ plugin.configSchema.length }} 项配置</span>
              <span class="plugin-chip" :class="registrationStatusClass(plugin.registrationStatus)">{{ registrationStatusLabel(plugin.registrationStatus) }}</span>
              <span class="plugin-chip" :class="compatibilityClass(plugin)">{{ compatibilityLabel(plugin) }}</span>
            </div>
            <div class="plugin-grid-card__stats">
              <div>
                <strong>{{ plugin.activeRoutes.length }}</strong>
                <span>生效路由</span>
              </div>
              <div>
                <strong>{{ plugin.activeMenus.length }}</strong>
                <span>生效菜单</span>
              </div>
              <div>
                <strong>{{ plugin.capabilities.length }}</strong>
                <span>能力声明</span>
              </div>
            </div>
          </button>
        </div>
        <div v-else class="plugin-empty-state">
          <div class="eyebrow">没有匹配结果</div>
          <p class="muted">可以尝试清空搜索词，或切换筛选条件。</p>
        </div>
      </mdui-card>

      <mdui-card v-if="selectedPlugin" class="section-card plugin-detail-card">
        <div class="section-card__header section-card__header--wrap">
          <div>
            <div class="eyebrow">插件详情</div>
            <div class="plugin-detail-title-row">
              <h2>{{ selectedPlugin.name }}</h2>
              <span class="status-pill" :class="selectedPlugin.installed ? (selectedPlugin.enabled ? 'status-pill--published' : 'status-pill--draft') : 'status-pill--muted'">
                {{ selectedPlugin.installed ? (selectedPlugin.enabled ? '运行中' : '已安装') : '未安装' }}
              </span>
            </div>
            <p class="muted">ID：{{ selectedPlugin.id }} · 版本：{{ selectedPlugin.version }}</p>
            <div class="chip-row" style="margin-top:8px">
              <span class="plugin-chip" :class="registrationStatusClass(selectedPlugin.registrationStatus)">{{ registrationStatusLabel(selectedPlugin.registrationStatus) }}</span>
              <span class="plugin-chip" :class="lifecycleStatusClass(selectedPlugin.lifecycle.lifecycleStatus)">{{ lifecycleStatusLabel(selectedPlugin.lifecycle.lifecycleStatus) }}</span>
              <span class="plugin-chip" :class="compatibilityClass(selectedPlugin)">{{ compatibilityLabel(selectedPlugin) }}</span>
            </div>
          </div>
          <div class="plugin-detail-actions">
            <mdui-button
              v-if="!selectedPlugin.installed"
              variant="filled"
              :loading="savingPluginId === selectedPlugin.id && currentAction === 'install'"
              @click="installSelectedPlugin(selectedPlugin)"
            >安装插件</mdui-button>
            <template v-else>
              <mdui-button
                variant="filled"
                :loading="savingPluginId === selectedPlugin.id && currentAction === 'enable'"
                :disabled="selectedPlugin.enabled"
                @click="togglePlugin(selectedPlugin, true)"
              >启用插件</mdui-button>
              <mdui-button
                variant="filled-tonal"
                :loading="savingPluginId === selectedPlugin.id && currentAction === 'disable'"
                :disabled="!selectedPlugin.enabled"
                @click="togglePlugin(selectedPlugin, false)"
              >停用插件</mdui-button>
              <mdui-button
                variant="text"
                :loading="savingPluginId === selectedPlugin.id && currentAction === 'reinstall'"
                @click="reinstallSelectedPlugin(selectedPlugin)"
              >重新安装</mdui-button>
              <mdui-button
                variant="text"
                :loading="savingPluginId === selectedPlugin.id && currentAction === 'uninstall'"
                @click="uninstallSelectedPlugin(selectedPlugin)"
              >卸载插件</mdui-button>
            </template>
            <mdui-button v-if="selectedPluginQuickRoute" variant="text" @click="router.push(selectedPluginQuickRoute)">打开插件页面</mdui-button>
          </div>
        </div>

        <p class="plugin-detail-description">{{ selectedPlugin.description || '暂无描述' }}</p>

        <div class="plugin-detail-stats-grid">
          <div class="plugin-detail-stat">
            <div class="eyebrow">声明路由</div>
            <strong>{{ selectedPlugin.declaredRoutes.length }}</strong>
          </div>
          <div class="plugin-detail-stat">
            <div class="eyebrow">生效路由</div>
            <strong>{{ selectedPlugin.activeRoutes.length }}</strong>
          </div>
          <div class="plugin-detail-stat">
            <div class="eyebrow">菜单</div>
            <strong>{{ selectedPlugin.activeMenus.length }}</strong>
          </div>
          <div class="plugin-detail-stat">
            <div class="eyebrow">配置项</div>
            <strong>{{ selectedPlugin.configSchema.length }}</strong>
          </div>
        </div>

        <div class="plugin-detail-section">
          <div class="plugin-section-header"><strong>注册信息</strong></div>
          <div class="plugin-lifecycle-grid">
            <div class="plugin-detail-stat plugin-detail-stat--compact">
              <div class="eyebrow">安装状态</div>
              <strong class="plugin-detail-stat__value plugin-detail-stat__value--compact">{{ registrationStatusLabel(selectedPlugin.registrationStatus) }}</strong>
            </div>
            <div class="plugin-detail-stat plugin-detail-stat--compact">
              <div class="eyebrow">安装来源</div>
              <strong class="plugin-detail-stat__value plugin-detail-stat__value--compact">{{ selectedPlugin.installSource || 'builtin' }}</strong>
            </div>
            <div class="plugin-detail-stat plugin-detail-stat--compact">
              <div class="eyebrow">注册时间</div>
              <strong class="plugin-detail-stat__value plugin-detail-stat__value--time">{{ formatTime(selectedPlugin.registeredAt) }}</strong>
            </div>
            <div class="plugin-detail-stat plugin-detail-stat--compact">
              <div class="eyebrow">最近卸载</div>
              <strong class="plugin-detail-stat__value plugin-detail-stat__value--time">{{ formatTime(selectedPlugin.uninstalledAt) }}</strong>
            </div>
          </div>
        </div>

        <div class="plugin-detail-section">
          <div class="plugin-section-header"><strong>状态</strong></div>
          <div class="plugin-lifecycle-grid">
            <div class="plugin-detail-stat plugin-detail-stat--compact">
              <div class="eyebrow">运行状态</div>
              <strong class="plugin-detail-stat__value plugin-detail-stat__value--compact">{{ lifecycleStatusLabel(selectedPlugin.lifecycle.lifecycleStatus) }}</strong>
            </div>
            <div class="plugin-detail-stat plugin-detail-stat--compact">
              <div class="eyebrow">安装版本</div>
              <strong class="plugin-detail-stat__value plugin-detail-stat__value--compact">{{ selectedPlugin.lifecycle.installedVersion || selectedPlugin.version || '--' }}</strong>
            </div>
            <div class="plugin-detail-stat plugin-detail-stat--compact">
              <div class="eyebrow">安装时间</div>
              <strong class="plugin-detail-stat__value plugin-detail-stat__value--time">{{ formatTime(selectedPlugin.lifecycle.installedAt) }}</strong>
            </div>
            <div class="plugin-detail-stat plugin-detail-stat--compact">
              <div class="eyebrow">最近启用</div>
              <strong class="plugin-detail-stat__value plugin-detail-stat__value--time">{{ formatTime(selectedPlugin.lifecycle.enabledAt) }}</strong>
            </div>
          </div>
          <p v-if="selectedPlugin.lifecycle.lastError" class="page-tip page-tip--warning" style="margin-top:12px">{{ selectedPlugin.lifecycle.lastError }}</p>
        </div>

        <div class="plugin-detail-section">
          <div class="plugin-section-header"><strong>兼容与迁移</strong></div>
          <div class="plugin-lifecycle-grid">
            <div class="plugin-detail-stat plugin-detail-stat--compact">
              <div class="eyebrow">插件版本</div>
              <strong class="plugin-detail-stat__value plugin-detail-stat__value--compact">{{ selectedPlugin.version }}</strong>
            </div>
            <div class="plugin-detail-stat plugin-detail-stat--compact">
              <div class="eyebrow">数据版本</div>
              <strong class="plugin-detail-stat__value plugin-detail-stat__value--compact">{{ selectedPlugin.upgradePolicy?.schemaVersion || '--' }}</strong>
            </div>
            <div class="plugin-detail-stat plugin-detail-stat--compact">
              <div class="eyebrow">迁移方式</div>
              <strong class="plugin-detail-stat__value plugin-detail-stat__value--compact">{{ selectedPlugin.compatibility?.migrationStrategyLabel || '宿主 schema' }}</strong>
            </div>
            <div class="plugin-detail-stat plugin-detail-stat--compact">
              <div class="eyebrow">迁移文件</div>
              <strong class="plugin-detail-stat__value plugin-detail-stat__value--compact">{{ selectedPlugin.compatibility?.migrationIds?.length || 0 }}</strong>
            </div>
          </div>
          <div class="chip-row" style="margin-top:12px">
            <span class="plugin-chip plugin-chip--light">宿主版本 {{ selectedPlugin.compatibility?.hostVersion || '--' }}</span>
            <span class="plugin-chip plugin-chip--light">要求范围 {{ selectedPlugin.compatibility?.requiredRange || '--' }}</span>
          </div>
          <p class="page-tip" style="margin-top:12px">{{ selectedPlugin.compatibility?.commandHint || '执行宿主 schema.sql 即可。' }}</p>
          <div v-if="selectedPlugin.compatibility?.migrationIds?.length" class="plugin-migration-list">
            <span v-for="migrationId in selectedPlugin.compatibility.migrationIds" :key="migrationId" class="plugin-chip plugin-chip--light">{{ migrationId }}</span>
          </div>
          <p v-if="selectedPlugin.compatibility?.migrationNotes" class="muted" style="margin-top:10px">{{ selectedPlugin.compatibility.migrationNotes }}</p>
        </div>

        <div class="plugin-detail-section">
          <div class="plugin-section-header"><strong>菜单入口</strong></div>
          <div v-if="selectedPlugin.declaredMenus.length" class="chip-row">
            <span v-for="menu in selectedPlugin.declaredMenus" :key="menu.id" class="plugin-chip">{{ menu.title }} · {{ menu.to }}</span>
          </div>
          <div v-else class="muted">当前插件没有声明后台菜单。</div>
        </div>

        <div class="plugin-detail-section">
          <div class="plugin-section-header"><strong>路由注册</strong></div>
          <div v-if="selectedPlugin.declaredRoutes.length" class="chip-row">
            <span v-for="routeItem in selectedPlugin.declaredRoutes" :key="routeItem.name" class="plugin-chip">{{ routeItem.path }}</span>
          </div>
          <div v-else class="muted">当前插件没有声明路由。</div>
        </div>

        <div class="plugin-detail-section">
          <div class="plugin-section-header"><strong>能力声明</strong></div>
          <div v-if="selectedPlugin.capabilities.length" class="chip-row">
            <span v-for="capability in selectedPlugin.capabilities" :key="capability" class="plugin-chip plugin-chip--light">{{ capability }}</span>
          </div>
          <div v-else class="muted">尚未声明额外能力。</div>
        </div>

        <div class="plugin-detail-section">
          <div class="plugin-section-header"><strong>插件配置</strong></div>
          <p v-if="!selectedPlugin.installed" class="page-tip">该插件当前未安装。配置已保留，但不会参与运行时装配。安装后即可再次生效。</p>
          <PluginConfigEditor
            :schema="selectedPlugin.configSchema"
            :model-value="selectedPlugin.config"
            :default-value="selectedPlugin.defaultConfig"
            :saving="savingConfigPluginId === selectedPlugin.id"
            @save="saveConfig(selectedPlugin, $event)"
            @reset="applyDefaultConfig(selectedPlugin, $event)"
          ></PluginConfigEditor>
        </div>
      </mdui-card>

      <mdui-card v-else class="section-card plugin-detail-card plugin-detail-card--empty">
        <div class="eyebrow">插件详情</div>
        <h2>请选择左侧插件</h2>
        <p class="muted">可以通过插件详情路由直达单个插件，也可以在左侧筛选后查看。</p>
      </mdui-card>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabaseEnabled } from '@/lib/supabase'
import { showToast } from '@/lib/toast'
import { useAuthStore } from '@/stores/auth'
import PluginConfigEditor from '@/components/admin/PluginConfigEditor.vue'
import {
  getAvailablePlugins,
  getPluginCompatibilityReport,
  getPluginConfig,
  getPluginLifecycleState,
  getPluginRegistryState,
  getPluginRuntimeState,
  getPluginUpgradePolicy,
  installPlugin,
  reinstallPlugin,
  reloadPluginRuntime,
  resetPluginConfig,
  savePluginConfig,
  setPluginEnabled,
  syncInstalledPluginsToRemote,
  uninstallPlugin,
} from '@/plugins/runtime'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const availablePlugins = getAvailablePlugins()
const runtimeState = getPluginRuntimeState()

const refreshing = ref(false)
const syncing = ref(false)
const savingPluginId = ref('')
const savingConfigPluginId = ref('')
const currentAction = ref('')
const autoSeedTried = ref(false)
const searchKeyword = ref('')
const filterMode = ref('all')
const localSelectedPluginId = ref('')

const filterOptions = [
  { label: '全部', value: 'all' },
  { label: '已安装', value: 'installed' },
  { label: '未安装', value: 'uninstalled' },
  { label: '运行中', value: 'enabled' },
  { label: '已停用', value: 'disabled' },
]

const runtimeSourceLabel = computed(() => {
  if (runtimeState.source === 'supabase') return 'Supabase 注册表'
  if (runtimeState.source === 'local') return '浏览器本地回退'
  return 'Manifest 默认值'
})

const canSyncRemote = computed(() => supabaseEnabled && auth.isSuperAdmin)

const pluginCards = computed(() =>
  availablePlugins.map((plugin) => {
    const registry = getPluginRegistryState(plugin.id) || {}
    const installed = registry.installed !== false
    const enabled = installed && registry.enabled === true
    const declaredRoutes = plugin.routes || []
    const declaredMenus = plugin.menus || []
    return {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version || '0.0.0',
      description: plugin.description || '',
      capabilities: plugin.capabilities || [],
      declaredRoutes,
      declaredMenus,
      activeRoutes: installed && enabled ? declaredRoutes : [],
      activeMenus: installed && enabled ? declaredMenus : [],
      installed,
      enabled,
      registrationStatus: registry.registrationStatus || (installed ? 'installed' : 'uninstalled'),
      installSource: registry.installSource || 'builtin',
      registeredAt: registry.registeredAt || null,
      uninstalledAt: registry.uninstalledAt || null,
      config: getPluginConfig(plugin.id),
      defaultConfig: plugin.defaultConfig || {},
      configSchema: plugin.configSchema || [],
      lifecycle: getPluginLifecycleState(plugin.id) || {},
      compatibility: getPluginCompatibilityReport(plugin.id),
      upgradePolicy: getPluginUpgradePolicy(plugin.id),
    }
  }),
)

const filteredPluginCards = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  return pluginCards.value.filter((plugin) => {
    const passesFilter =
      filterMode.value === 'all'
      || (filterMode.value === 'installed' && plugin.installed)
      || (filterMode.value === 'uninstalled' && !plugin.installed)
      || (filterMode.value === 'enabled' && plugin.enabled)
      || (filterMode.value === 'disabled' && plugin.installed && !plugin.enabled)

    if (!passesFilter) return false
    if (!keyword) return true

    return [plugin.name, plugin.id, plugin.description]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(keyword))
  })
})

const installedCount = computed(() => pluginCards.value.filter((plugin) => plugin.installed).length)
const enabledCount = computed(() => pluginCards.value.filter((plugin) => plugin.enabled).length)

const selectedPluginId = computed(() => {
  if (filteredPluginCards.value.some((plugin) => plugin.id === localSelectedPluginId.value)) return localSelectedPluginId.value
  const routePluginId = typeof route.params.pluginId === 'string' ? route.params.pluginId : ''
  if (filteredPluginCards.value.some((plugin) => plugin.id === routePluginId)) return routePluginId
  return filteredPluginCards.value[0]?.id || ''
})

const selectedPlugin = computed(() => filteredPluginCards.value.find((plugin) => plugin.id === selectedPluginId.value) || null)

const selectedPluginQuickRoute = computed(() => {
  const plugin = selectedPlugin.value
  if (!plugin || !plugin.installed || !plugin.enabled) return ''
  const targetRoute = plugin.declaredRoutes.find((item) => item.path?.startsWith('/admin')) || plugin.declaredRoutes[0]
  return targetRoute?.path || ''
})

watch(() => route.params.pluginId, (value) => {
  if (typeof value === 'string' && value) localSelectedPluginId.value = value
}, { immediate: true })

watch(filteredPluginCards, (plugins) => {
  if (!plugins.length) {
    localSelectedPluginId.value = ''
    return
  }
  if (!plugins.some((plugin) => plugin.id === localSelectedPluginId.value)) {
    localSelectedPluginId.value = plugins[0].id
  }
}, { immediate: true })

function formatTime(value) {
  if (!value) return '--'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date(value)).replace(/\s+/, '\n')
}

function lifecycleStatusLabel(status) {
  return { installed: '已安装', enabled: '运行中', disabled: '已停用', error: '异常' }[status] || '未安装'
}

function lifecycleStatusClass(status) {
  return { installed: 'plugin-chip--light', enabled: 'plugin-chip--success', disabled: 'plugin-chip--muted', error: 'plugin-chip--danger' }[status] || 'plugin-chip--light'
}

function registrationStatusLabel(status) {
  return { installed: '已安装', uninstalled: '已卸载', builtin: '内置', local: '本地' }[status] || status || '未知'
}

function registrationStatusClass(status) {
  return status === 'installed' ? 'plugin-chip--success' : 'plugin-chip--muted'
}

function compatibilityLabel(plugin) {
  if (!plugin?.compatibility) return '兼容性未知'
  return plugin.compatibility.compatible ? '接口兼容' : '接口不兼容'
}

function compatibilityClass(plugin) {
  return plugin?.compatibility?.compatible ? 'plugin-chip--success' : 'plugin-chip--danger'
}

function selectPlugin(plugin) {
  if (!plugin?.id) return
  localSelectedPluginId.value = plugin.id
  if (typeof window !== 'undefined') {
    const targetPath = router.resolve({ name: 'admin-plugins', params: { pluginId: plugin.id } }).fullPath
    window.history.replaceState(window.history.state, '', targetPath)
  }
}

async function maybeAutoSeedRemote() {
  if (autoSeedTried.value || !canSyncRemote.value) return
  if (runtimeState.source !== 'supabase' || runtimeState.remoteCount > 0 || runtimeState.error) return
  autoSeedTried.value = true
  try {
    syncing.value = true
    await syncInstalledPluginsToRemote()
    showToast('已自动初始化插件注册表。', 'success')
  } catch (error) {
    console.error('[plugins] Failed to auto seed remote registry', error)
  } finally {
    syncing.value = false
  }
}

async function refreshRuntime(options = {}) {
  refreshing.value = true
  try {
    await reloadPluginRuntime({ router })
    await maybeAutoSeedRemote()
    if (!options.silent) showToast('插件注册中心状态已刷新。', 'success')
  } catch (error) {
    console.error('[plugins] Failed to refresh runtime', error)
    showToast(error?.message || '刷新插件状态失败。', 'error')
  } finally {
    refreshing.value = false
  }
}

async function syncToSupabase() {
  syncing.value = true
  try {
    await syncInstalledPluginsToRemote()
    showToast('插件注册表与默认配置已同步到 Supabase。', 'success')
  } catch (error) {
    console.error('[plugins] Failed to sync registry', error)
    showToast(error?.message || '同步插件注册表失败。', 'error')
  } finally {
    syncing.value = false
  }
}

async function installSelectedPlugin(plugin) {
  if (!plugin?.id) return
  savingPluginId.value = plugin.id
  currentAction.value = 'install'
  try {
    await installPlugin(plugin.id, { router, persistRemote: supabaseEnabled })
    showToast(`${plugin.name}已安装。`, 'success')
  } catch (error) {
    console.error('[plugins] Failed to install plugin', error)
    showToast(error?.message || '安装插件失败。', 'error')
  } finally {
    savingPluginId.value = ''
    currentAction.value = ''
  }
}

async function uninstallSelectedPlugin(plugin) {
  if (!plugin?.id) return
  savingPluginId.value = plugin.id
  currentAction.value = 'uninstall'
  try {
    await uninstallPlugin(plugin.id, { router, persistRemote: supabaseEnabled, clearConfig: false })
    showToast(`${plugin.name}已卸载。`, 'success')
  } catch (error) {
    console.error('[plugins] Failed to uninstall plugin', error)
    showToast(error?.message || '卸载插件失败。', 'error')
  } finally {
    savingPluginId.value = ''
    currentAction.value = ''
  }
}

async function togglePlugin(plugin, enabled) {
  savingPluginId.value = plugin.id
  currentAction.value = enabled ? 'enable' : 'disable'
  try {
    await setPluginEnabled(plugin.id, enabled, { router, persistRemote: supabaseEnabled })
    showToast(`${plugin.name}已${enabled ? '启用' : '停用'}。`, 'success')
  } catch (error) {
    console.error('[plugins] Failed to update plugin state', error)
    showToast(error?.message || '更新插件状态失败。', 'error')
  } finally {
    savingPluginId.value = ''
    currentAction.value = ''
  }
}

async function reinstallSelectedPlugin(plugin) {
  if (!plugin?.id) return
  savingPluginId.value = plugin.id
  currentAction.value = 'reinstall'
  try {
    await reinstallPlugin(plugin.id, { router, persistRemote: supabaseEnabled })
    showToast(`${plugin.name}已重新执行安装流程。`, 'success')
  } catch (error) {
    console.error('[plugins] Failed to reinstall plugin', error)
    showToast(error?.message || '重新安装插件失败。', 'error')
  } finally {
    savingPluginId.value = ''
    currentAction.value = ''
  }
}

async function saveConfig(plugin, config) {
  savingConfigPluginId.value = plugin.id
  try {
    await savePluginConfig(plugin.id, config, { persistRemote: supabaseEnabled })
    showToast(`${plugin.name}配置已保存。`, 'success')
  } catch (error) {
    console.error('[plugins] Failed to save config', error)
    showToast(error?.message || '保存插件配置失败。', 'error')
  } finally {
    savingConfigPluginId.value = ''
  }
}

async function applyDefaultConfig(plugin, config) {
  try {
    await resetPluginConfig(plugin.id, { persistRemote: false })
    await savePluginConfig(plugin.id, config, { persistRemote: supabaseEnabled })
    showToast(`${plugin.name}配置已恢复默认值。`, 'success')
  } catch (error) {
    console.error('[plugins] Failed to reset config', error)
    showToast(error?.message || '恢复默认配置失败。', 'error')
  }
}

onMounted(async () => {
  await refreshRuntime({ silent: true })
})
</script>

<style scoped>
.plugin-source-row { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
.plugin-summary-grid { display:grid; gap:16px; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); margin-bottom:16px; }
.plugin-summary-card h2 { margin:8px 0 6px; }
.plugin-toolbar-card { margin-bottom:16px; }
.plugin-toolbar { display:flex; flex-wrap:wrap; gap:16px; align-items:center; justify-content:space-between; }
.plugin-search-field { display:flex; align-items:center; gap:10px; padding:0 14px; min-height:44px; border-radius:16px; border:1px solid rgba(15,23,42,0.08); background:rgba(255,255,255,0.85); min-width:min(420px,100%); flex:1 1 320px; }
.plugin-search-field__input { width:100%; border:0; outline:none; background:transparent; font:inherit; color:#0f172a; }
.plugin-filter-group { display:flex; flex-wrap:wrap; gap:8px; }
.plugin-filter-pill { border:0; border-radius:999px; padding:10px 14px; background:rgba(15,23,42,0.06); color:#334155; font:inherit; cursor:pointer; transition:transform .18s ease, background-color .18s ease, color .18s ease; }
.plugin-filter-pill--active { background:rgba(103,80,164,0.14); color:#4c3a7c; }
.plugin-workspace { display:grid; gap:16px; grid-template-columns:minmax(0,1.15fr) minmax(360px,0.95fr); align-items:start; margin-bottom:16px; }
.plugin-browser-card,.plugin-detail-card { min-width:0; }
.plugin-grid { display:grid; gap:14px; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); }
.plugin-grid-card { width:100%; border:1px solid rgba(15,23,42,0.08); border-radius:20px; background:linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.98)); padding:16px; text-align:left; cursor:pointer; transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
.plugin-grid-card:hover { transform:translateY(-2px); box-shadow:0 18px 36px rgba(15,23,42,0.08); }
.plugin-grid-card--active { border-color:rgba(103,80,164,0.42); box-shadow:0 18px 36px rgba(103,80,164,0.12); }
.plugin-grid-card__head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
.plugin-grid-card__title { font-size:18px; font-weight:700; color:#0f172a; }
.plugin-grid-card__sub { font-size:12px; color:#64748b; margin-top:4px; }
.plugin-grid-card__description { margin:12px 0; color:#334155; min-height:42px; }
.plugin-grid-card__meta-row { display:flex; flex-wrap:wrap; gap:8px; }
.plugin-grid-card__stats { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-top:14px; }
.plugin-grid-card__stats div { padding:10px 12px; border-radius:16px; background:rgba(15,23,42,0.04); }
.plugin-grid-card__stats strong { display:block; font-size:18px; color:#0f172a; }
.plugin-grid-card__stats span { display:block; margin-top:4px; font-size:12px; color:#64748b; }
.plugin-empty-state,.plugin-detail-card--empty { min-height:260px; display:flex; flex-direction:column; align-items:flex-start; justify-content:center; }
.plugin-detail-card { position:sticky; top:88px; }
.plugin-detail-title-row { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
.plugin-detail-title-row h2 { margin:0; }
.plugin-detail-actions { display:flex; gap:12px; flex-wrap:wrap; }
.plugin-detail-description { margin:12px 0 0; color:#334155; }
.plugin-detail-stats-grid,.plugin-lifecycle-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-top:16px; }
.plugin-detail-stat { border-radius:18px; padding:14px; background:rgba(15,23,42,0.04); }
.plugin-detail-stat strong { display:block; margin-top:6px; font-size:24px; color:#0f172a; }
.plugin-detail-stat--compact { padding:12px 14px; }
.plugin-detail-stat__value--compact { font-size:18px !important; line-height:1.35; }
.plugin-detail-stat__value--time { font-size:16px !important; line-height:1.5; white-space:pre-line; word-break:break-word; }
.plugin-detail-section { margin-top:18px; }
.plugin-section-header { display:flex; align-items:baseline; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.chip-row,.plugin-migration-list { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
.plugin-chip { display:inline-flex; align-items:center; gap:4px; padding:6px 10px; border-radius:999px; background:rgba(103,80,164,0.08); color:#4c3a7c; font-size:13px; }
.plugin-chip--light { background:rgba(15,23,42,0.06); color:#334155; }
.plugin-chip--success { background:rgba(22,163,74,0.12); color:#166534; }
.plugin-chip--danger { background:rgba(220,38,38,0.12); color:#991b1b; }
.plugin-chip--muted { background:rgba(100,116,139,0.12); color:#475569; }
.status-pill { display:inline-flex; align-items:center; justify-content:center; min-height:28px; padding:0 10px; border-radius:999px; font-size:12px; font-weight:700; }
.status-pill--published { background:rgba(22,163,74,0.12); color:#166534; }
.status-pill--draft { background:rgba(245,158,11,0.12); color:#b45309; }
.status-pill--muted { background:rgba(100,116,139,0.12); color:#475569; }
@media (max-width: 1120px) { .plugin-workspace { grid-template-columns:1fr; } .plugin-detail-card { position:static; } }
@media (max-width: 768px) { .plugin-detail-stats-grid,.plugin-lifecycle-grid,.plugin-grid-card__stats { grid-template-columns:repeat(2,1fr); } }
@media (max-width: 560px) { .plugin-detail-stats-grid,.plugin-lifecycle-grid,.plugin-grid-card__stats { grid-template-columns:1fr; } }
</style>
