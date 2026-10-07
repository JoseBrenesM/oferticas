const BASE_URL = 'https://www.walmart.co.cr'

function matchesQuery(query, title) {
  const tokens = query.toLocaleLowerCase('es-CR').match(/[\p{L}\p{N}]+/gu) ?? []
  const titleText = title.toLocaleLowerCase('es-CR')
  const importantTokens = tokens.filter((token) => token.length >= 3 || /^\d+$/.test(token))
  return importantTokens.every((token) => titleText.includes(token))
}

export async function searchWalmart(query) {
  const url = new URL(`${BASE_URL}/api/catalog_system/pub/products/search/${encodeURIComponent(query)}`)
  url.searchParams.set('_from', '0')
  url.searchParams.set('_to', '49')
  const response = await fetch(url, {
    headers: { 'User-Agent': 'OferticasPriceComparator/0.1 (product search)', Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) {
    const error = new Error('No se pudo consultar el catálogo de Walmart Costa Rica.')
    error.statusCode = 502
    throw error
  }

  const products = await response.json()
  return products.flatMap((product) => {
    const name = product.productName?.trim()
    if (!name || !matchesQuery(query, name)) return []
    const seller = (product.items ?? []).flatMap((item) => item.sellers ?? [])
      .find((entry) => entry.commertialOffer?.AvailableQuantity > 0 && entry.commertialOffer?.Price > 0)
    if (!seller) return []
    const offer = seller.commertialOffer
    const item = (product.items ?? []).find((candidate) => candidate.sellers?.includes(seller))
    const image = item?.images?.[0]?.imageUrl ?? ''
    const storeName = seller.sellerName === 'Walmart Cr' ? 'Walmart' : `Walmart · ${seller.sellerName}`
    const productUrl = product.linkText ? `${BASE_URL}/${product.linkText}/p` : ''
    if (!productUrl) return []

    return [{
      id: `walmart:${product.productId}:${seller.sellerId}`,
      name,
      subtitle: product.productReference ? `Código: ${product.productReference}` : 'Catálogo Walmart Costa Rica',
      category: 'Tecnología',
      price: offer.Price,
      currency: 'CRC',
      store: storeName,
      initials: 'WM',
      storeColor: '#e8f2fc',
      storeText: '#0872ce',
      image,
      alt: name,
      rating: null,
      reviews: null,
      url: productUrl,
      availability: 'in_stock',
    }]
  }).sort((a, b) => a.price - b.price)
}
