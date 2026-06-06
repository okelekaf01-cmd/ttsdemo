interface RateEntry { count: number; resetAt: number }

const LIMIT = 10
const WINDOW_MS = 60_000
let store = new Map<string, RateEntry>()

export function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = store.get(ip)
  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (entry.count >= LIMIT) return false
  entry.count++
  return true
}

export function resetForTesting(): void {
  store = new Map()
}
