export function hasAdapterMethod(adapter, name) {
  return Boolean(adapter && typeof adapter[name] === 'function')
}

export async function callAdapter(adapter, name, ...args) {
  if (!hasAdapterMethod(adapter, name)) return undefined
  return adapter[name](...args)
}

export function ensureArray(value) {
  return Array.isArray(value) ? value : []
}

export function pickKeys(source = {}, keys = []) {
  return Object.fromEntries(keys.map((key) => [key, source?.[key]]))
}

export function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]'
}
