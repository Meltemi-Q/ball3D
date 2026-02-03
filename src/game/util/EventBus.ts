type Listener<T> = (event: T) => void

export class EventBus<Events extends Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<Listener<any>>>()

  on<K extends keyof Events>(type: K, listener: Listener<Events[K]>) {
    const existing = this.listeners.get(type) ?? new Set()
    existing.add(listener as Listener<any>)
    this.listeners.set(type, existing)
    return () => this.off(type, listener)
  }

  off<K extends keyof Events>(type: K, listener: Listener<Events[K]>) {
    const existing = this.listeners.get(type)
    existing?.delete(listener as Listener<any>)
  }

  emit<K extends keyof Events>(type: K, event: Events[K]) {
    const existing = this.listeners.get(type)
    if (!existing) return
    for (const listener of existing) listener(event)
  }
}

