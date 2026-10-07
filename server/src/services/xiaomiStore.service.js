const BASE_URL = 'https://xiaomistore.co.cr'

function matchesQuery(query, title) {
  const tokens = query.toLocaleLowerCase('es-CR').match(/[\p{L}\p{N}]+/gu) ?? []
  const titleTokens = new Set(title.toLocaleLowerCase('es-CR').match(/[\p{L}\p{N}]+/gu) ?? [])
  const importantTokens = tokens.filter((token) => token.length >= 2 || /^\d+$/.test(token))
  return importantTokens.length > 0 && importantTokens.every((token) => titleTokens.has(token))
}

export async function searchXiaomiStore(query) {
  const url = new URL('/search/suggest.json', BASE_URL)
  url.searchParams.set('q', query)
  url.searchParams.set('resources[type]', 'product')
  url.searchParams.set('resources[limit]', '10')
  const response = await fetch(url, {
    headers: { 'User-Agent': 'OferticasPriceComparator/0.1 (product search)', Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  })
  if (!response.ok) {
    const error = new Error('No se pudo consultar el catálogo de Xiaomi Store Costa Rica.')
    error.statusCode = 502
    throw error
  }

  const data = await response.json()
  const products = data.resources?.results?.products ?? []
  return products.flatMap((product) => {
    const name = String(product.title ?? '').trim()
    if (!name || product.available !== true || !matchesQuery(query, name)) return []
    const price = Number(product.price)
    if (!Number.isFinite(price) || price <= 0) return []
    const handle = String(product.handle ?? '').trim()
    if (!handle) return []
    const productUrl = new URL(`/products/${encodeURIComponent(handle)}`, BASE_URL).href
    const image = product.featured_image?.url || product.image || ''
    return [{
      id: `xiaomi:${product.id || handle}`,
      name,
      subtitle: 'Catálogo Xiaomi Store Costa Rica · precio publicado en CRC',
      category: 'Tecnología',
      price,
      currency: 'CRC',
      store: 'Xiaomi Store Costa Rica',
      initials: 'XI',
      storeColor: '#fff0e8',
      storeText: '#e75b1b',
      image,
      alt: name,
      rating: null,
      reviews: null,
      url: productUrl,
      availability: 'in_stock',
    }]
  }).sort((a, b) => a.price - b.price)
}
