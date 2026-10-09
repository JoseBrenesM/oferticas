const BASE_URL = 'https://www.ticotek.com'
const PRODUCTS_URL = `${BASE_URL}/wp-json/wc/store/v1/products`
const MAX_RESULTS = 36
const REQUEST_TIMEOUT_MS = 15000

function tokenize(value) {
  return String(value || '').toLocaleLowerCase('es-CR').match(/[\p{L}\p{N}]+/gu) ?? []
}

function matchesQuery(query, title) {
  const titleTokens = new Set(tokenize(title))
  const required = tokenize(query).filter((token) => token.length >= 2 || /^\d+$/.test(token))
  return required.length > 0 && required.every((token) => titleTokens.has(token))
}

function isStoreProductUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && ['www.ticotek.com', 'ticotek.com'].includes(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

function toPrice(product) {
  const rawPrice = Number(product.prices?.price)
  const minorUnit = Number(product.prices?.currency_minor_unit)
  if (!Number.isFinite(rawPrice) || rawPrice <= 0 || !Number.isInteger(minorUnit) || minorUnit < 0 || minorUnit > 4) return null
  return rawPrice / (10 ** minorUnit)
}

function toOffer(product) {
  const url = product.permalink
  const price = toPrice(product)
  if (!product.name || !isStoreProductUrl(url) || !price || product.prices?.currency_code !== 'CRC') return null

  const oldPriceRaw = Number(product.prices?.regular_price)
  const minorUnit = Number(product.prices?.currency_minor_unit)
  const oldPrice = Number.isFinite(oldPriceRaw) && oldPriceRaw > 0 ? oldPriceRaw / (10 ** minorUnit) : null
  const image = product.images?.find((candidate) => typeof candidate.src === 'string' && candidate.src.startsWith('https://'))?.src || ''
  const sku = String(product.sku || '').trim()
  const stockLabel = product.is_in_stock ? 'En stock' : 'Agotado'

  return {
    id: `ticotek:${product.id || sku || url}`,
    name: String(product.name).trim(),
    subtitle: sku ? `SKU: ${sku} · ${stockLabel}` : `Catálogo TicoTek · ${stockLabel}`,
    category: 'Tecnología',
    price,
    ...(oldPrice && oldPrice > price ? { oldPrice } : {}),
    currency: 'CRC',
    store: 'TicoTek',
    initials: 'TT',
    storeColor: '#e9f1fb',
    storeText: '#315a91',
    image,
    alt: String(product.name).trim(),
    rating: Number(product.average_rating) > 0 ? String(product.average_rating) : null,
    reviews: Number(product.review_count) > 0 ? String(product.review_count) : null,
    url,
    availability: product.is_in_stock ? 'in_stock' : 'out_of_stock',
  }
}

export async function searchTicoTek(query) {
  const url = new URL(PRODUCTS_URL)
  url.searchParams.set('search', query)
  url.searchParams.set('per_page', String(MAX_RESULTS))
  url.searchParams.set('catalog_visibility', 'visible')

  let response
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (cause) {
    const error = new Error('No se pudo consultar el catálogo de TicoTek en este momento.')
    error.statusCode = 502
    error.cause = cause
    throw error
  }

  if (!response.ok) {
    const error = new Error('No se pudo consultar el catálogo de TicoTek en este momento.')
    error.statusCode = 502
    throw error
  }

  let products
  try {
    products = await response.json()
  } catch (cause) {
    const error = new Error('TicoTek devolvió una respuesta de catálogo inválida.')
    error.statusCode = 502
    error.cause = cause
    throw error
  }

  if (!Array.isArray(products)) {
    const error = new Error('TicoTek devolvió una respuesta de catálogo inválida.')
    error.statusCode = 502
    throw error
  }

  return products
    .filter((product) => matchesQuery(query, product.name))
    .map(toOffer)
    .filter(Boolean)
    .sort((a, b) => a.price - b.price)
}
