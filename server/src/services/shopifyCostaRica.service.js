const STORES = {
  icon: {
    name: 'iCon Costa Rica',
    host: 'https://icon.co.cr',
    initials: 'IC',
    color: '#f0ebfa',
    textColor: '#6945a1',
  },
  ishop: {
    name: 'iShop Costa Rica',
    host: 'https://cr.tiendasishop.com',
    initials: 'IS',
    color: '#e9f1fb',
    textColor: '#315a91',
  },
}

function tokens(text) {
  return String(text).toLocaleLowerCase('es-CR').match(/[\p{L}\p{N}]+/gu) ?? []
}

function isRelevantProduct(query, product) {
  const title = String(product.title || '').trim()
  const titleTokens = tokens(title)
  const queryTokens = tokens(query).filter((token) => token.length >= 2 || /^\d+$/.test(token))
  if (!title || !queryTokens.every((token) => titleTokens.includes(token))) return false

  const productType = String(product.type || '').toLocaleLowerCase('es-CR')
  const categoryText = `${productType} ${title}`.toLocaleLowerCase('es-CR')
  if (/\b(case|cases|cover|protector|accessor(?:y|ies)|applecare|warranty|garant[ií]a|estuche|funda|cobertor|servicio|plan|gift card|tarjeta de regalo)\b/i.test(categoryText)) return false

  const deviceCategory = [
    [/\biphone\b/i, /iphone/i],
    [/\bipad\b/i, /ipad/i],
    [/\bmacbook\b/i, /mac/i],
    [/\bmac\s*mini\b/i, /mac/i],
    [/\bairpods?\b/i, /airpods?/i],
    [/\bapple\s*watch\b/i, /watch/i],
  ].find(([pattern]) => pattern.test(query))
  if (deviceCategory && !deviceCategory[1].test(productType)) return false

  const requestedIphone = /\biphone\s*(\d+)\s*(pro\s*max|pro|max|air|e)?\b/i.exec(query)
  if (requestedIphone) {
    const resultIphone = /\biphone\s*(\d+)\s*(pro\s*max|pro|max|air|e)?\b/i.exec(title)
    if (!resultIphone) return false
    const requestedModel = requestedIphone[1]
    const resultModel = resultIphone[1]
    const requestedVariant = (requestedIphone[2] || '').replace(/\s+/g, '').toLowerCase()
    const resultVariant = (resultIphone[2] || '').replace(/\s+/g, '').toLowerCase()
    if (requestedModel !== resultModel || (requestedVariant && requestedVariant !== resultVariant)) return false
  }

  return true
}

export async function searchShopifyCostaRica(storeKey, query, exchangeRate) {
  const store = STORES[storeKey]
  if (!store) throw new Error('Tienda de Costa Rica desconocida.')

  const url = new URL('/search/suggest.json', store.host)
  url.searchParams.set('q', query)
  url.searchParams.set('resources[type]', 'product')
  url.searchParams.set('resources[limit]', '10')
  const response = await fetch(url, {
    headers: { 'User-Agent': 'OferticasPriceComparator/0.1 (product search)', Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  })
  if (!response.ok) {
    const error = new Error(`No se pudo consultar el catálogo de ${store.name}.`)
    error.statusCode = 502
    throw error
  }

  const data = await response.json()
  const products = data.resources?.results?.products ?? []
  return products.flatMap((product) => {
    if (product.available !== true || !isRelevantProduct(query, product)) return []
    const priceUsd = Number(product.price)
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) return []
    const productUrl = product.handle ? new URL(`/products/${encodeURIComponent(product.handle)}`, store.host).href : ''
    if (!productUrl || new URL(productUrl).hostname !== new URL(store.host).hostname) return []

    return [{
      id: `${storeKey}:${product.id || product.handle}`,
      name: product.title.trim(),
      subtitle: 'Disponible en tienda costarricense · precio publicado en USD',
      category: 'Tecnología',
      price: Math.round(priceUsd * exchangeRate.value),
      currency: 'CRC',
      originalPrice: priceUsd,
      originalCurrency: 'USD',
      priceIsApproximate: true,
      exchangeRate: exchangeRate.value,
      exchangeRateDate: exchangeRate.date,
      store: store.name,
      initials: store.initials,
      storeColor: store.color,
      storeText: store.textColor,
      image: product.featured_image?.url || product.image || '',
      alt: product.title.trim(),
      rating: null,
      reviews: null,
      url: productUrl,
      availability: 'in_stock',
    }]
  }).sort((a, b) => a.price - b.price)
}
