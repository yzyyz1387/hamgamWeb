export async function loadPluginTestAdapter() {
  try {
    const mod = await import('../runtime-adapter.local.js')
    if (typeof mod.getPluginTestAdapter === 'function') {
      return mod.getPluginTestAdapter()
    }
  } catch {
    // noop
  }

  const fallback = await import('../runtime-adapter.example.js')
  return fallback.getPluginTestAdapter()
}
