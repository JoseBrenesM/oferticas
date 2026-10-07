import { load } from 'cheerio'

const BASE_URL = 'https://www.unimart.com'
const ACCESSORY_TERMS = /\b(case|cases|cover|charger|charging|cable|protector|screen|glass|adapter|accessor(?:y|ies)|funda|fundas|estuche|cobertor|cargador|protector|pantalla|adaptador|accesorio|accesorios|soporte|holder|bolsa|replacement|repuesto|applecare|warranty|garant[ií]a|plan|gift card|tarjeta de regalo)\b/i

function matchesQuery(query, title) {
  const tokens = query.toLocaleLowerCase('es-CR').match(/[\p{L}\p{N}]+/gu) ?? []
  const titleTokens = new Set(title.toLocaleLowerCase('es-CR').match(/[\p{L}\p{N}]+/gu) ?? [])
  const importantTokens = tokens.filter((token) => token.length >= 2 || /^\d+$/.test(token))
  return importantTokens.length > 0 && importantTokens.every((token) => titleTokens.has(token))
}

function parseCrcPrice(card) {
  const text = card.find('.money').first().text().replace(/\s+/g, ' ').trim()
  if (!text.includes('₡') && !text.toUpperCase().includes('CRC')) return null
  const number = Number(text.replace(/[^\d,.-]/g, '').replace(/,(?=\d{3}(?:\D|$))/g, ''))
  return Number.isFinite(number) && number > 0 ? number : null
}

export async function searchUnimart(query) {
  const url = new URL('/search', BASE_URL)
  url.searchParams.set('q', query)
  const response = await fetch(url, {
    headers: { 'User-Agent': 'OferticasPriceComparator/0.1 (product search)', Accept: 'text/html' },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) {
    const error = new Error('No se pudo consultar el catálogo de Unimart.')
    error.statusCode = 502
    throw error
  }

  const $ = load(await response.text())
  const offers = []
  $('a.product-title-link').each((_index, element) => {
    const link = $(element)
    const name = link.text().trim()
    const productUrl = link.attr('href')
    const card = link.closest('.product-item')
    const brand = card.find('p[class*="uppercase"]').first().text().trim()
    const price = parseCrcPrice(card)
    if (!name || !productUrl || !price || !matchesQuery(query, `${brand} ${name}`)) return
    if (!/\b(logitech|iphone|ipad|macbook|mac mini|airpods|apple watch|samsung|xiaomi|redmi|motorola|huawei|honor|oneplus|google pixel|laptop|computadora|pc gamer|procesador|tarjeta de video|motherboard|placa madre|memoria ram|ssd|disco duro|monitor|teclado|mouse|aud[ií]fonos|headset|parlante|bocina|impresora|router|consola|playstation|xbox|nintendo|tablet|celular|tel[eé]fono|c[aá]mara|smart tv|televisor|televisi[oó]n|reloj inteligente|smartwatch|aspiradora|robot vacuum|cafetera|microondas|refrigeradora|lavadora)\b/i.test(name)) return
    if (!ACCESSORY_TERMS.test(query) && ACCESSORY_TERMS.test(name)) return

    const urlObject = new URL(productUrl, BASE_URL)
    if (urlObject.hostname !== new URL(BASE_URL).hostname || !urlObject.pathname.startsWith('/products/')) return
    const image = card.find('img').first().attr('src') || ''
    const availabilityText = card.text().toLocaleLowerCase('es-CR')
    offers.push({
      id: `unimart:${urlObject.pathname}${urlObject.search}`,
      name,
      subtitle: 'Catálogo Unimart Costa Rica · precio publicado en CRC',
      category: 'Tecnología',
      price,
      currency: 'CRC',
      store: 'Unimart',
      initials: 'UM',
      storeColor: '#eaf5ef',
      storeText: '#247548',
      image,
      alt: name,
      rating: null,
      reviews: null,
      url: urlObject.href,
      availability: /agotado|sin stock|no disponible/.test(availabilityText) ? 'out_of_stock' : 'unknown',
    })
  })
  return offers.sort((a, b) => a.price - b.price)
}
