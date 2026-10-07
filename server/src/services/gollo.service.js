import { load } from 'cheerio'

const BASE_URL = 'https://www.gollo.com'

function matchesQuery(query, title) {
  const tokens = query.toLocaleLowerCase('es-CR').match(/[\p{L}\p{N}]+/gu) ?? []
  const titleText = title.toLocaleLowerCase('es-CR')
  const importantTokens = tokens.filter((token) => token.length >= 3 || /^\d+$/.test(token))
  return importantTokens.every((token) => titleText.includes(token))
}

function parsePrice(item) {
  const price = Number(item.find('[data-price-amount]').first().attr('data-price-amount'))
  if (Number.isFinite(price) && price > 0) return price
  const text = item.find('.price').first().text().replace(/\s+/g, ' ').trim()
  if (!text.includes('₡') && !text.toUpperCase().includes('CRC')) return null
  const parsed = Number(text.replace(/[^\d,.-]/g, '').replace(/,(?=\d{3}(?:\D|$))/g, ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export async function searchGollo(query) {
  const url = new URL(`${BASE_URL}/catalogsearch/result/`)
  url.searchParams.set('q', query)
  const response = await fetch(url, {
    headers: { 'User-Agent': 'OferticasPriceComparator/0.1 (product search)', Accept: 'text/html' },
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) {
    const error = new Error('No se pudo consultar el catálogo de Gollo.')
    error.statusCode = 502
    throw error
  }

  const $ = load(await response.text())
  const offers = []
  $('.product-item').each((_index, element) => {
    const item = $(element)
    const link = item.find('.product-item-link').first()
    const name = link.text().trim()
    const productUrl = link.attr('href')
    const price = parsePrice(item)
    if (!name || !productUrl || !price || !matchesQuery(query, name)) return
    const image = item.find('img').first().attr('src') || item.find('img').first().attr('data-src') || ''
    const sku = item.attr('data-product-id') || ''
    offers.push({
      id: `gollo:${sku || productUrl}`,
      name,
      subtitle: sku ? `Código: ${sku}` : 'Catálogo Gollo Costa Rica',
      category: 'Tecnología',
      price,
      currency: 'CRC',
      store: 'Gollo',
      initials: 'GO',
      storeColor: '#fff1ec',
      storeText: '#c74628',
      image,
      alt: name,
      rating: null,
      reviews: null,
      url: productUrl.startsWith('http') ? productUrl : new URL(productUrl, BASE_URL).href,
      availability: 'unknown',
    })
  })
  return offers.sort((a, b) => a.price - b.price)
}
