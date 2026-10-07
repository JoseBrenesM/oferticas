import { load } from 'cheerio'

const BASE_URL = 'https://www.intelec.co.cr/'

function matchesQuery(query, title) {
  const tokens = query.toLocaleLowerCase('es-CR').match(/[\p{L}\p{N}]+/gu) ?? []
  const titleText = title.toLocaleLowerCase('es-CR')
  const importantTokens = tokens.filter((token) => token.length >= 3 || /^\d+$/.test(token))
  if (importantTokens.length === 0) return true
  return importantTokens.every((token) => titleText.includes(token))
}

function parsePrice(card) {
  const amounts = card.find('span.price bdi').toArray().map((element) => {
    const text = load(element).text().replace(/\s+/g, ' ').trim()
    if (!text.includes('₡') && !text.toUpperCase().includes('CRC')) return null
    const number = Number(text.replace(/[^\d,.-]/g, '').replace(/,(?=\d{3}(?:\D|$))/g, ''))
    return Number.isFinite(number) && number > 0 ? number : null
  }).filter(Boolean)
  return amounts.at(-1) ?? null
}

export async function searchIntelec(query) {
  const url = new URL(BASE_URL)
  url.searchParams.set('s', query)
  url.searchParams.set('post_type', 'product')

  const response = await fetch(url, {
    headers: { 'User-Agent': 'OferticasPriceComparator/0.1 (product search)', Accept: 'text/html' },
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) {
    const error = new Error('No se pudo consultar el catálogo de Intelec en este momento.')
    error.statusCode = 502
    throw error
  }

  const html = await response.text()
  const $ = load(html)
  const offers = []

  $('.wd-product').each((_index, element) => {
    const card = $(element)
    const link = card.find('h3.wd-entities-title a').first()
    const name = link.text().trim()
    const productUrl = link.attr('href')
    const price = parsePrice(card)
    if (!name || !productUrl || !price || !matchesQuery(query, name)) return

    const sku = card.find('.wd-sku').first().text().trim()
    const stock = card.find('.wd-product-stock').first().text().trim()
    const image = card.find('img').first().attr('data-src') || card.find('img').first().attr('src') || ''
    offers.push({
      id: `intelec:${sku || productUrl}`,
      name,
      subtitle: sku ? `SKU: ${sku}${stock ? ` · ${stock}` : ''}` : (stock || 'Catálogo Intelec'),
      category: 'Tecnología',
      price,
      currency: 'CRC',
      store: 'Intelec',
      initials: 'IN',
      storeColor: '#f0f0e7',
      storeText: '#676b45',
      image,
      alt: name,
      rating: null,
      reviews: null,
      url: productUrl,
      availability: /en stock/i.test(stock) ? 'in_stock' : 'unknown',
    })
  })

  return offers.sort((a, b) => a.price - b.price)
}
