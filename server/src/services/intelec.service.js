import { load } from 'cheerio'

const BASE_URL = 'https://www.intelec.co.cr/'
const MAX_RESULT_PAGES = 4

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
  const searchUrl = new URL(BASE_URL)
  searchUrl.searchParams.set('s', query)
  searchUrl.searchParams.set('post_type', 'product')
  const offers = []
  const seenProducts = new Set()
  let pageUrl = searchUrl

  for (let pageNumber = 0; pageNumber < MAX_RESULT_PAGES && pageUrl; pageNumber += 1) {
    let response
    try {
      response = await fetch(pageUrl, {
        headers: { 'User-Agent': 'OferticasPriceComparator/0.1 (product search)', Accept: 'text/html' },
        signal: AbortSignal.timeout(20000),
      })
      if (!response.ok) throw new Error('Intelec returned a non-success response.')
    } catch (cause) {
      if (pageNumber > 0 && offers.length) break
      const error = new Error('No se pudo consultar el catálogo de Intelec en este momento.')
      error.statusCode = 502
      error.cause = cause
      throw error
    }

    const $ = load(await response.text())
    $('.wd-product').each((_index, element) => {
      const card = $(element)
      const link = card.find('h3.wd-entities-title a').first()
      const name = link.text().trim()
      const productUrl = link.attr('href')
      const price = parsePrice(card)
      if (!name || !productUrl || !price || !matchesQuery(query, name)) return
      const productKey = productUrl.replace(/\/$/, '').toLocaleLowerCase('es-CR')
      if (seenProducts.has(productKey)) return
      seenProducts.add(productKey)

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

    const nextHref = $('.wd-pagination a.next.page-numbers').attr('href')
    if (!nextHref) break
    const nextUrl = new URL(nextHref, pageUrl)
    if (nextUrl.hostname !== new URL(BASE_URL).hostname) break
    pageUrl = nextUrl
  }

  return offers.sort((a, b) => a.price - b.price)
}
