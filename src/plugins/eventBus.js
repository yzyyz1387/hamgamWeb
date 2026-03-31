export function createPluginEventBus() {
  const listeners = new Map()

  return {
    on(event, handler) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set())
      }
      listeners.get(event).add(handler)
      return () => {
        listeners.get(event)?.delete(handler)
      }
    },
    off(event, handler) {
      listeners.get(event)?.delete(handler)
    },
    async emit(event, payload) {
      const handlers = [...(listeners.get(event) || [])]
      await Promise.allSettled(handlers.map((handler) => handler(payload)))
    },
  }
}
