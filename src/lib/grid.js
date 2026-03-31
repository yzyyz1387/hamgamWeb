const FIELD_CHARS = 'ABCDEFGHIJKLMNOPQR'
const SUBSQUARE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWX'

export function normalizeGridLocatorInput(value = '') {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase()
}

export function isValidGridLocator(value = '') {
  const normalized = normalizeGridLocatorInput(value)
  return /^(?:[A-R]{2})(?:\d{2}(?:[A-X]{2}(?:\d{2})?)?)?$/.test(normalized)
}

export function getGridPrecision(value = '') {
  const normalized = normalizeGridLocatorInput(value)
  return isValidGridLocator(normalized) ? normalized.length : 0
}

function clampLatitude(value) {
  const lat = Number(value)
  if (!Number.isFinite(lat)) return 0
  return Math.min(89.999999, Math.max(-89.999999, lat))
}

function wrapLongitude(value) {
  const lng = Number(value)
  if (!Number.isFinite(lng)) return 0
  let wrapped = ((lng + 180) % 360 + 360) % 360 - 180
  if (wrapped === 180) wrapped = 179.999999
  return wrapped
}

function coercePrecision(value) {
  const parsed = Number(value)
  if ([2, 4, 6, 8].includes(parsed)) return parsed
  return 4
}

export function latLngToGrid(lat, lng, precision = 4) {
  const targetPrecision = coercePrecision(precision)
  let lon = wrapLongitude(lng) + 180
  let latitude = clampLatitude(lat) + 90

  const fieldLon = Math.floor(lon / 20)
  const fieldLat = Math.floor(latitude / 10)
  let locator = `${FIELD_CHARS[fieldLon]}${FIELD_CHARS[fieldLat]}`

  if (targetPrecision === 2) return locator

  lon -= fieldLon * 20
  latitude -= fieldLat * 10

  const squareLon = Math.floor(lon / 2)
  const squareLat = Math.floor(latitude / 1)
  locator += `${squareLon}${squareLat}`

  if (targetPrecision === 4) return locator

  lon -= squareLon * 2
  latitude -= squareLat * 1

  const subLonSize = 2 / 24
  const subLatSize = 1 / 24
  const subLon = Math.min(23, Math.floor(lon / subLonSize))
  const subLat = Math.min(23, Math.floor(latitude / subLatSize))
  locator += `${SUBSQUARE_CHARS[subLon]}${SUBSQUARE_CHARS[subLat]}`

  if (targetPrecision === 6) return locator

  lon -= subLon * subLonSize
  latitude -= subLat * subLatSize

  const extLonSize = subLonSize / 10
  const extLatSize = subLatSize / 10
  const extLon = Math.min(9, Math.floor(lon / extLonSize))
  const extLat = Math.min(9, Math.floor(latitude / extLatSize))
  locator += `${extLon}${extLat}`

  return locator
}

export function gridToBounds(grid) {
  const normalized = normalizeGridLocatorInput(grid)
  if (!isValidGridLocator(normalized)) return null

  let west = -180
  let south = -90
  let lonSize = 20
  let latSize = 10

  west += FIELD_CHARS.indexOf(normalized[0]) * lonSize
  south += FIELD_CHARS.indexOf(normalized[1]) * latSize

  if (normalized.length >= 4) {
    lonSize = 2
    latSize = 1
    west += Number(normalized[2]) * lonSize
    south += Number(normalized[3]) * latSize
  }

  if (normalized.length >= 6) {
    lonSize = 2 / 24
    latSize = 1 / 24
    west += SUBSQUARE_CHARS.indexOf(normalized[4]) * lonSize
    south += SUBSQUARE_CHARS.indexOf(normalized[5]) * latSize
  }

  if (normalized.length >= 8) {
    lonSize = (2 / 24) / 10
    latSize = (1 / 24) / 10
    west += Number(normalized[6]) * lonSize
    south += Number(normalized[7]) * latSize
  }

  return {
    locator: normalized,
    precision: normalized.length,
    west,
    south,
    east: west + lonSize,
    north: south + latSize,
    centerLng: west + lonSize / 2,
    centerLat: south + latSize / 2,
    lonSize,
    latSize,
  }
}

export function gridToCenter(grid) {
  const bounds = gridToBounds(grid)
  if (!bounds) return null
  return { lat: bounds.centerLat, lng: bounds.centerLng }
}

export function formatGridAreaHint(grid) {
  const bounds = gridToBounds(grid)
  if (!bounds) return ''
  const lonMinutes = bounds.lonSize * 60
  const latMinutes = bounds.latSize * 60
  if (bounds.precision === 4) {
    return `约 ${bounds.lonSize}° × ${bounds.latSize}° 的网格区域`
  }
  return `约 ${lonMinutes.toFixed(lonMinutes >= 10 ? 0 : 1)}′ × ${latMinutes.toFixed(latMinutes >= 10 ? 0 : 1)}′ 的网格区域`
}
