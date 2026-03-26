<template>
  <Teleport to="body">
    <Transition name="notice-fade">
      <div v-if="open" class="notice-backdrop" @click.self="emit('close')">
        <div class="grid-map-dialog grid-map-dialog--preview">
          <div class="grid-map-dialog__header">
            <div>
              <div class="eyebrow">网格地图</div>
              <h3>{{ grid || '未设置网格' }}</h3>
              <p>{{ descriptionText }}</p>
            </div>
            <mdui-button variant="text" @click="emit('close')">关闭</mdui-button>
          </div>

          <div class="grid-map-dialog__map-wrap grid-map-dialog__map-wrap--preview">
            <div v-if="mapError" class="grid-map-dialog__placeholder grid-map-dialog__placeholder--error">
              {{ mapError }}
            </div>
            <div v-else-if="loadingMap" class="grid-map-dialog__placeholder">
              <mdui-circular-progress></mdui-circular-progress>
              <span>正在加载地图…</span>
            </div>
            <div v-show="!mapError && !loadingMap" ref="mapEl" class="grid-map-dialog__map"></div>
          </div>

          <div class="grid-map-dialog__info-list grid-map-dialog__info-list--inline">
            <div class="grid-map-dialog__info-item">
              <span>中心点</span>
              <strong>{{ centerLabel }}</strong>
            </div>
            <div class="grid-map-dialog__info-item">
              <span>区域范围</span>
              <strong>{{ areaHint || '—' }}</strong>
            </div>
          </div>

          <div class="grid-map-dialog__tips">
            <mdui-icon name="visibility--rounded"></mdui-icon>
            <span>地图显示的是网格范围示意，不代表对方的精确位置。</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { loadAmap } from '@/lib/amapLoader'
import { formatGridAreaHint, gridToBounds, isValidGridLocator, normalizeGridLocatorInput } from '@/lib/grid'

const props = defineProps({
  open: Boolean,
  grid: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['close'])

const mapEl = ref(null)
const loadingMap = ref(false)
const mapError = ref('')

let map = null
let marker = null
let rectangle = null

const normalizedGrid = computed(() => normalizeGridLocatorInput(props.grid))
const bounds = computed(() => (isValidGridLocator(normalizedGrid.value) ? gridToBounds(normalizedGrid.value) : null))
const areaHint = computed(() => (bounds.value ? formatGridAreaHint(normalizedGrid.value) : ''))
const centerLabel = computed(() => {
  if (!bounds.value) return '—'
  return `${bounds.value.centerLat.toFixed(4)}, ${bounds.value.centerLng.toFixed(4)}`
})
const descriptionText = computed(() => {
  if (!normalizedGrid.value) return '该用户尚未设置梅登黑德网格。'
  if (!bounds.value) return '当前网格格式无效，无法展示地图。'
  return areaHint.value || '网格区域预览'
})

watch(
  () => props.open,
  async (opened) => {
    if (opened) {
      await nextTick()
      await initMap()
      renderGrid()
      return
    }
    destroyMap()
  },
)

watch(normalizedGrid, () => {
  if (props.open) {
    renderGrid()
  }
})

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
  } catch (error) {
    mapError.value = error?.message || '地图加载失败，请稍后重试。'
  } finally {
    loadingMap.value = false
  }
}

function destroyMap() {
  if (!map) return
  clearOverlays()
  map.destroy()
  map = null
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

function renderGrid() {
  if (!map || !window.AMap) return
  clearOverlays()
  if (!bounds.value) return

  rectangle = new window.AMap.Rectangle({
    bounds: new window.AMap.Bounds([bounds.value.west, bounds.value.south], [bounds.value.east, bounds.value.north]),
    strokeColor: '#006a6a',
    strokeWeight: 2,
    fillColor: '#4db6ac',
    fillOpacity: 0.18,
    zIndex: 20,
  })
  rectangle.setMap(map)

  marker = new window.AMap.Marker({
    position: [bounds.value.centerLng, bounds.value.centerLat],
    title: normalizedGrid.value,
    label: {
      content: `<div style="padding:2px 8px;border-radius:999px;background:#006a6a;color:#fff;font-size:12px;">${normalizedGrid.value}</div>`,
      direction: 'top',
      offset: new window.AMap.Pixel(0, -8),
    },
    offset: new window.AMap.Pixel(-10, -30),
  })
  marker.setMap(map)

  map.setFitView([rectangle, marker], false, [28, 28, 28, 28], bounds.value.precision >= 6 ? 9 : 7)
}
</script>
