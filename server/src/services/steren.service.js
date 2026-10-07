import { load } from 'cheerio'

const BASE_URL = 'https://www.steren.cr'

function matchesQuery(query, title) {
  const tokens = query.toLocaleLowerCase('es-CR').match(/[\p{L}\p{N}]+/gu) ?? []
  const titleTokens = new Set(title.toLocaleLowerCase('es-CR').match(/[\p{L}\p{N}]+/gu) ?? [])
  const importantTokens = tokens.filter((token) => token.length >= 2 || /^\d+$/.test(token))
  return importantTokens.length > 0 && importantTokens.every((token) => titleTokens.has(token))
}

function parseCrcPrice(card) {
  const amount = Number(card.find('[data-price-type="finalPrice"]').first().attr('data-price-amount'))
  if (Number.isFinite(amount) && amount > 0) return Math.round(amount)

  const text = card.find('.price').first().text().replace(/\s+/g, ' ').trim()
  if (!text.includes('₡') && !text.toUpperCase().includes('CRC')) return null
  const parsed = Number(text.replace(/[^\d,.-]/g, '').replace(/,(?=\d{3}(?:\D|$))/g, ''))
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null
}

export async function searchSteren(query) {
  const url = new URL('/search', BASE_URL)
  url.searchParams.set('q', query)
  const response = await fetch(url, {
    headers: { 'User-Agent': 'OferticasPriceComparator/0.1 (product search)', Accept: 'text/html' },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) {
    const error = new Error('No se pudo consultar el catálogo de Steren Costa Rica.')
    error.statusCode = 502
    throw error
  }

  const $ = load(await response.text())
  const offers = []
  $('.product-item').each((_index, element) => {
    const card = $(element)
    const link = card.find('a.product-item-link').first()
    const name = link.text().trim()
    const price = parseCrcPrice(card)
    if (!name || !price || !matchesQuery(query, name)) return

    const productUrl = link.attr('href') || card.find('a.product-item-photo').first().attr('href')
    if (!productUrl) return
    const destination = new URL(productUrl, BASE_URL)
    if (destination.hostname !== new URL(BASE_URL).hostname) return

    const sku = card.find('.product-item-sku').first().text().trim()
    const image = card.find('img.product-image-photo').first().attr('src') || ''
    const stockText = card.find('.stock').text().toLocaleLowerCase('es-CR')
    offers.push({
      id: `steren:${sku || destination.pathname}`,
      name,
      subtitle: sku ? `SKU: ${sku} · Catálogo Steren Costa Rica` : 'Catálogo Steren Costa Rica · precio publicado en CRC',
      category: 'Tecnología',
      price,
      currency: 'CRC',
      store: 'Steren Costa Rica',
      initials: 'ST',
      storeColor: '#e9f2fb',
      storeText: '#1268a8',
      image,
      alt: name,
      rating: null,
      reviews: null,
      url: destination.href,
      availability: /agotado|sin stock|no disponible/.test(stockText) ? 'out_of_stock' : 'unknown',
    })
  })
  return offers.sort((a, b) => a.price - b.price)
}
