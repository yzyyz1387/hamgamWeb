<template>
  <Teleport to="body">
    <Transition name="notice-fade">
      <div v-if="open" class="notice-backdrop" @click.self="emit('close')">
        <div class="grid-map-dialog grid-map-dialog--picker">
          <div class="grid-map-dialog__header">
            <div>
              <div class="eyebrow">地图选点</div>
              <h3>选择梅登黑德网格</h3>
              <p>点击地图可自动生成网格。系统仅保存网格，不保存你点击时的精确坐标。</p>
            </div>
            <mdui-button variant="text" @click="emit('close')">关闭</mdui-button>
          </div>

          <div class="grid-map-dialog__controls">
            <div class="grid-map-dialog__precision-group" role="group" aria-label="网格精度">
              <button
                v-for="option in precisionOptions"
                :key="option.value"
                type="button"
                class="grid-map-dialog__chip"
                :class="{ 'grid-map-dialog__chip--active': precision === option.value }"
                @click="setPrecision(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
            <div class="grid-map-dialog__meta" :class="{ 'grid-map-dialog__meta--error': draftGrid && !isDraftValid }">
              <strong>{{ draftGrid || '尚未选择网格' }}</strong>
              <span>{{ helperText }}</span>
            </div>
          </div>

          <div class="grid-map-dialog__body grid-map-dialog__body--split">
            <div class="grid-map-dialog__map-wrap">
              <div v-if="mapError" class="grid-map-dialog__placeholder grid-map-dialog__placeholder--error">
                {{ mapError }}
              </div>
              <div v-else-if="loadingMap" class="grid-map-dialog__placeholder">
                <mdui-circular-progress></mdui-circular-progress>
                <span>正在加载地图…</span>
              </div>
              <div v-show="!mapError && !loadingMap" ref="mapEl" class="grid-map-dialog__map"></div>
            </div>

            <div class="grid-map-dialog__panel">
              <AppTextField
                id="grid-picker-value"
                v-model="draftGrid"
                trim
                label="网格值"
                maxlength="8"
                placeholder="例如：OM44 或 OM44AA"
                :helper="draftGrid ? (isDraftValid ? areaHint : '请输入合法的梅登黑德网格') : '支持 4 / 6 / 8 位网格'"
              ></AppTextField>

              <div class="grid-map-dialog__info-list">
                <div class="grid-map-dialog__info-item">
                  <span>当前精度</span>
                  <strong>{{ precisionLabel }}</strong>
                </div>
                <div class="grid-map-dialog__info-item">
                  <span>中心坐标</span>
                  <strong>{{ centerLabel }}</strong>
                </div>
                <div class="grid-map-dialog__info-item">
                  <span>范围说明</span>
                  <strong>{{ areaHint || '等待选择网格' }}</strong>
                </div>
              </div>

              <div class="grid-map-dialog__tips">
                <mdui-icon name="info--rounded"></mdui-icon>
                <span>你也可以直接输入网格，地图会自动定位到对应区域。</span>
              </div>
            </div>
          </div>

          <div class="grid-map-dialog__actions">
            <mdui-button variant="text" @click="resetToInitial">恢复原值</mdui-button>
            <div class="grid-map-dialog__actions-right">
              <mdui-button variant="text" @click="emit('close')">取消</mdui-button>
              <mdui-button variant="filled" :disabled="!isDraftValid" @click="confirm">使用该网格</mdui-button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import AppTextField from '@/components/form/AppTextField.vue'
import { loadAmap } from '@/lib/amapLoader'
import {
  formatGridAreaHint,
  getGridPrecision,
  gridToBounds,
  isValidGridLocator,
  latLngToGrid,
  normalizeGridLocatorInput,
} from '@/lib/grid'

const props = defineProps({
  open: Boolean,
  value: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['close', 'confirm'])

const mapEl = ref(null)
const loadingMap = ref(false)
const mapError = ref('')
const draftGrid = ref('')
const precision = ref(4)

let map = null
let marker = null
let rectangle = null
let clickHandler = null
let lastSelectedLatLng = null

const precisionOptions = [
  { value: 4, label: '4 位网格' },
  { value: 6, label: '6 位网格' },
  { value: 8, label: '8 位网格' },
]

const isDraftValid = computed(() => isValidGridLocator(draftGrid.value))
const areaHint = computed(() => (isDraftValid.value ? formatGridAreaHint(draftGrid.value) : ''))
const precisionLabel = computed(() => `${precision.value} 位`)
const currentBounds = computed(() => (isDraftValid.value ? gridToBounds(draftGrid.value) : null))
const centerLabel = computed(() => {
  if (!currentBounds.value) return '—'
  return `${currentBounds.value.centerLat.toFixed(4)}, ${currentBounds.value.centerLng.toFixed(4)}`
})
const helperText = computed(() => {
  if (!draftGrid.value) return '点击地图后会自动生成网格'
  if (!isDraftValid.value) return '请输入合法的梅登黑德网格'
  return areaHint.value
})

watch(
  () => props.open,
  async (opened) => {
    if (opened) {
      initDraft()
      await nextTick()
      await initMap()
      syncGridToMap({ fit: true })
      return
    }
    destroyMap()
  },
)

watch(draftGrid, (value) => {
  const normalized = normalizeGridLocatorInput(value)
  if (normalized !== value) {
    draftGrid.value = normalized
    return
  }
  if (!normalized) {
    clearOverlays()
    return
  }
  if (isValidGridLocator(normalized)) {
    precision.value = getGridPrecision(normalized) || precision.value
    const bounds = gridToBounds(normalized)
    lastSelectedLatLng = bounds ? { lat: bounds.centerLat, lng: bounds.centerLng } : null
    syncGridToMap({ fit: false })
  }
})

function initDraft() {
  const normalized = normalizeGridLocatorInput(props.value)
  draftGrid.value = normalized
  precision.value = [4, 6, 8].includes(getGridPrecision(normalized)) ? getGridPrecision(normalized) : 4
  mapError.value = ''
  const bounds = normalized && isValidGridLocator(normalized) ? gridToBounds(normalized) : null
  lastSelectedLatLng = bounds ? { lat: bounds.centerLat, lng: bounds.centerLng } : null
}

async function initMap() {
  if (map || !mapEl.value) return
  loadingMap.value = true
  mapError.value = ''
  try {
    const AMap = await loadAmap()
    map = new AMap.Map(mapEl.value, {
      zoom: 4,
      center: [104, 35],
      resizeEnable: true,
      viewMode: '2D',
    })

    clickHandler = (event) => {
      const lng = event.lnglat.getLng()
      const lat = event.lnglat.getLat()
      lastSelectedLatLng = { lat, lng }
      draftGrid.value = latLngToGrid(lat, lng, precision.value)
    }
    map.on('click', clickHandler)
  } catch (error) {
    mapError.value = error?.message || '地图加载失败，请稍后重试。'
  } finally {
    loadingMap.value = false
  }
}

function destroyMap() {
  if (!map) return
  if (clickHandler) {
    map.off('click', clickHandler)
  }
  clearOverlays()
  map.destroy()
  map = null
  clickHandler = null
}

function clearOverlays() {
  if (marker) {
    marker.setMap(null)
    marker = null
  }
  if (rectangle) {
    rectangle.setMap(null)
    rectangle = null
  }
}

function syncGridToMap({ fit = false } = {}) {
  if (!map || !isDraftValid.value || !window.AMap) return
  const bounds = gridToBounds(draftGrid.value)
  if (!bounds) return

  clearOverlays()

  rectangle = new window.AMap.Rectangle({
    bounds: new window.AMap.Bounds([bounds.west, bounds.south], [bounds.east, bounds.north]),
    strokeColor: '#6750a4',
    strokeWeight: 2,
    fillColor: '#b39ddb',
    fillOpacity: 0.18,
    zIndex: 20,
  })
  rectangle.setMap(map)

  marker = new window.AMap.Marker({
    position: [bounds.centerLng, bounds.centerLat],
    title: bounds.locator,
    label: {
      content: `<div style="padding:2px 8px;border-radius:999px;background:#6750a4;color:#fff;font-size:12px;">${bounds.locator}</div>`,
      direction: 'top',
      offset: new window.AMap.Pixel(0, -8),
    },
    offset: new window.AMap.Pixel(-10, -30),
  })
  marker.setMap(map)

  if (fit) {
    map.setFitView([rectangle, marker], false, [28, 28, 28, 28], bounds.precision >= 6 ? 9 : 7)
    return
  }

  map.setCenter([bounds.centerLng, bounds.centerLat])
}

function setPrecision(nextPrecision) {
  if (precision.value === nextPrecision) return
  precision.value = nextPrecision
  if (lastSelectedLatLng) {
    draftGrid.value = latLngToGrid(lastSelectedLatLng.lat, lastSelectedLatLng.lng, nextPrecision)
    return
  }
  if (isDraftValid.value) {
    const bounds = gridToBounds(draftGrid.value)
    if (bounds) {
      draftGrid.value = latLngToGrid(bounds.centerLat, bounds.centerLng, nextPrecision)
    }
  }
}

function resetToInitial() {
  initDraft()
  syncGridToMap({ fit: true })
}

function confirm() {
  if (!isDraftValid.value) return
  emit('confirm', normalizeGridLocatorInput(draftGrid.value))
}
</script>
