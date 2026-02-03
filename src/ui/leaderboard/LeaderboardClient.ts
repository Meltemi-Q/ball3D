export type LeaderboardItem = { name: string; score: number }
export type LeaderboardSource = 'online' | 'local'

export class LeaderboardClient {
  private localKey = 'ball3d:leaderboard:v1'

  async getTop(opts: { limit: number }): Promise<
    | { ok: true; source: LeaderboardSource; items: LeaderboardItem[] }
    | { ok: false; source: LeaderboardSource; error: string }
  > {
    try {
      const r = await fetch(`/api/leaderboard?limit=${encodeURIComponent(opts.limit)}`, {
        headers: { accept: 'application/json' },
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = (await r.json()) as { items: LeaderboardItem[] }
      return { ok: true, source: 'online', items: normalizeItems(data.items).slice(0, opts.limit) }
    } catch (e) {
      const local = this.getLocal()
      if (local.length === 0) return { ok: false, source: 'local', error: 'No local scores.' }
      return { ok: true, source: 'local', items: local.slice(0, opts.limit) }
    }
  }

  async submit(opts: { name: string; score: number }): Promise<{ ok: true } | { ok: false; error: string }> {
    const name = sanitizeName(opts.name)
    const score = Math.floor(Number.isFinite(opts.score) ? opts.score : 0)
    if (score <= 0) return { ok: false, error: 'Score must be > 0.' }

    this.addLocal({ name, score })

    try {
      const r = await fetch('/api/score', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ name, score }),
      })
      if (!r.ok) {
        const txt = await r.text().catch(() => '')
        return { ok: false, error: txt || `HTTP ${r.status}` }
      }
      return { ok: true }
    } catch (e) {
      return { ok: false, error: 'Network error. Saved locally.' }
    }
  }

  private getLocal(): LeaderboardItem[] {
    try {
      const raw = localStorage.getItem(this.localKey)
      if (!raw) return []
      const parsed = JSON.parse(raw) as LeaderboardItem[]
      return normalizeItems(parsed)
    } catch {
      return []
    }
  }

  private setLocal(items: LeaderboardItem[]) {
    localStorage.setItem(this.localKey, JSON.stringify(normalizeItems(items).slice(0, 200)))
  }

  private addLocal(item: LeaderboardItem) {
    const items = this.getLocal()
    items.push(item)
    items.sort((a, b) => b.score - a.score)
    this.setLocal(items)
  }
}

function sanitizeName(name: string) {
  const trimmed = name.trim() || 'Anonymous'
  const safe = trimmed.replace(/[^\p{L}\p{N}_\- ]/gu, '').slice(0, 12)
  return safe || 'Anonymous'
}

function normalizeItems(items: any): LeaderboardItem[] {
  if (!Array.isArray(items)) return []
  return items
    .map((it) => ({
      name: sanitizeName(String(it?.name ?? 'Anonymous')),
      score: Math.max(0, Math.floor(Number(it?.score ?? 0))),
    }))
    .filter((it) => it.score > 0)
    .sort((a, b) => b.score - a.score)
}

