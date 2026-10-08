import https from 'node:https'

const BASE_URL = 'https://www.tiendamonge.com'
const SEARCH_INDEX_SUFFIX = '_products'
const CONFIG_TTL_MS = 60 * 60 * 1000
const REQUEST_TIMEOUT_MS = 12000

let cachedSearchConfig = null

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CR')
}

function matchesQuery(query, title) {
  const tokens = normalizeText(query).match(/[\p{L}\p{N}]+/gu) ?? []
  const normalizedTitle = normalizeText(title)
  const importantTokens = tokens.filter((token) => token.length >= 2 || /^\d+$/.test(token))
  return importantTokens.length > 0 && importantTokens.every((token) => normalizedTitle.includes(token))
}

function readConfigValue(html, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`["']${escapedName}["']\\s*:\\s*["']([^"']+)["']`, 'i').exec(html)
  return match?.[1] || null
}

function fetchStoreHtml(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      maxHeaderSize: 64 * 1024,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OferticasPriceComparator/1.0)', Accept: 'text/html' },
    }, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume()
        reject(new Error('Monge no devolvió su página de búsqueda.'))
        return
      }
      response.setEncoding('utf8')
      let html = ''
      response.on('data', (chunk) => { html += chunk })
      response.on('end', () => resolve(html))
      response.on('error', reject)
    })
    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error('La página de Monge tardó demasiado en responder.')))
    request.on('error', reject)
  })
}

async function getSearchConfig() {
  if (cachedSearchConfig && cachedSearchConfig.expiresAt > Date.now()) return cachedSearchConfig.value

  const html = await fetchStoreHtml(`${BASE_URL}/catalogsearch/result/?q=oferticas`)
  const applicationId = readConfigValue(html, 'applicationId')
  const apiKey = readConfigValue(html, 'apiKey')
  const configuredIndex = readConfigValue(html, 'indexName')
  if (!applicationId || !apiKey || !configuredIndex) {
    throw new Error('Monge no publicó su configuración de búsqueda en la página.')
  }

  const indexName = configuredIndex.endsWith(SEARCH_INDEX_SUFFIX)
    ? configuredIndex
    : `${configuredIndex}${SEARCH_INDEX_SUFFIX}`
  const value = {
    applicationId,
    apiKey,
    indexName,
    endpoint: `https://${applicationId.toLocaleLowerCase('en-US')}-dsn.algolia.net/1/indexes/*/queries`,
  }
  cachedSearchConfig = { value, expiresAt: Date.now() + CONFIG_TTL_MS }
  return value
}

function getPrice(hit) {
  const value = hit?.price?.CRC?.default
  const price = typeof value === 'object' && value !== null ? Number(value.value) : Number(value)
  return Number.isFinite(price) && price > 0 ? Math.round(price) : null
}

function getProductUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value, BASE_URL)
    if (url.protocol !== 'https:' || !['www.tiendamonge.com', 'tiendamonge.com'].includes(url.hostname.toLowerCase())) return null
    return url.href
  } catch {
    return null
  }
}

function toOffer(hit, query) {
  const name = typeof hit?.name === 'string' ? hit.name.trim() : ''
  const price = getPrice(hit)
  const url = getProductUrl(hit?.url)
  if (!name || !price || !url || !matchesQuery(query, name)) return null

  const sku = String(hit.sku || '').trim()
  const stock = hit.in_stock
  const availability = stock === 1 || stock === true || stock === '1'
    ? 'in_stock'
    : stock === 0 || stock === false || stock === '0'
      ? 'out_of_stock'
      : 'unknown'

  return {
    id: `monge:${sku || hit.objectID || url}`,
    name,
    subtitle: sku ? `SKU: ${sku} · Catálogo Monge Costa Rica` : 'Catálogo Monge Costa Rica · precio publicado en CRC',
    category: 'Tecnología',
    price,
    currency: 'CRC',
    market: 'cr',
    store: 'Monge Costa Rica',
    initials: 'MO',
    storeColor: '#f4eee7',
    storeText: '#5c4939',
    image: hit.image_url || hit.thumbnail_url || hit.image || '',
    alt: name,
    rating: null,
    reviews: null,
    url,
    availability,
  }
}

export async function searchMonge(query) {
  try {
    const config = await getSearchConfig()
    const params = new URLSearchParams({
      query,
      hitsPerPage: '36',
      page: '0',
      numericFilters: 'visibility_search=1',
    })
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-algolia-application-id': config.applicationId,
        'x-algolia-api-key': config.apiKey,
      },
      body: JSON.stringify({ requests: [{ indexName: config.indexName, params: params.toString() }] }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error('Monge rechazó la consulta de su catálogo.')

    const data = await response.json()
    const hits = data?.results?.[0]?.hits
    if (!Array.isArray(hits)) throw new Error('Monge devolvió una respuesta de catálogo inesperada.')
    return hits.map((hit) => toOffer(hit, query)).filter(Boolean).sort((a, b) => a.price - b.price)
  } catch (cause) {
    const error = new Error('No se pudo consultar el catálogo de Monge Costa Rica en este momento.')
    error.statusCode = 502
    error.cause = cause
    throw error
  }
}
