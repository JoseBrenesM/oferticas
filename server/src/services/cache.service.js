const cache = new Map()
const defaultTtlSeconds = 4 * 60 * 60

export function getCachedSearch(key) {
  const item = cache.get(key)
  if (!item) return null
  if (item.expiresAt <= Date.now()) {
    cache.delete(key)
    return null
  }
  return item.value
}

export function setCachedSearch(key, value) {
  const ttlSeconds = Number(process.env.SEARCH_CACHE_TTL_SECONDS) || defaultTtlSeconds
  cache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
}
