import { load } from 'cheerio'

const BASE_URL = 'https://cyberteamcr.com'
const SEARCH_URL = `${BASE_URL}/search`
const MAX_PAGES = 3
const MAX_OFFERS = 36
const REQUEST_TIMEOUT_MS = 15000

function tokenize(value) {
  return String(value || '').toLocaleLowerCase('es-CR').match(/[\p{L}\p{N}]+/gu) ?? []
}

function matchesQuery(query, title) {
  const titleTokens = new Set(tokenize(title))
  const requiredTokens = tokenize(query).filter((token) => token.length >= 2 || /^\d+$/.test(token))
  return requiredTokens.length > 0 && requiredTokens.every((token) => titleTokens.has(token))
}

function parsePrice(value) {
  const digits = String(value || '').replace(/[^\d]/g, '')
  const price = Number(digits)
  return Number.isSafeInteger(price) && price > 0 ? price : null
}

function parseOffer(card) {
  const link = card.find('a.card-image-wrap[href]').first()
  const title = card.find('.product-title').first().text().trim()
  const productUrl = link.attr('href')
  const url = productUrl ? new URL(productUrl, BASE_URL) : null
  if (!title || !url || url.protocol !== 'https:' || url.hostname !== 'cyberteamcr.com') return null

  const price = parsePrice(card.find('.current-price').first().text())
  if (!price) return null

  const imageSource = card.find('img').first().attr('src') || card.find('img').first().attr('data-src') || ''
  let image = ''
  try {
    const imageUrl = new URL(imageSource, BASE_URL)
    if (imageUrl.protocol === 'https:' && imageUrl.hostname === 'cyberteamcr.com') image = imageUrl.href
  } catch {}

  const productId = card.find('[data-product-id]').first().attr('data-product-id')
    || card.find('[onclick*="toggleCardWishlist"]').first().attr('onclick')?.match(/toggleCardWishlist\((\d+)/)?.[1]
    || url.pathname
  const rating = card.find('.stars .count').first().text().trim()
  const availabilityText = card.text().toLocaleLowerCase('es-CR')
  const unavailable = /agotado|sold\s*out|sin\s*stock|no\s*disponible/.test(availabilityText)

  return {
    id: `cyberteam:${productId}`,
    name: title,
    subtitle: 'Catálogo CyberTeam Costa Rica',
    category: 'Tecnología',
    price,
    currency: 'CRC',
    store: 'CyberTeam',
    initials: 'CY',
    storeColor: '#f5e9ee',
    storeText: '#710f27',
    image,
    alt: title,
    rating: /^\d(?:\.\d)?$/.test(rating) ? rating : null,
    reviews: null,
    url: url.href,
    availability: unavailable ? 'out_of_stock' : 'unknown',
  }
}

async function fetchSearchPage(query, page) {
  const url = new URL(SEARCH_URL)
  url.searchParams.set('q', query)
  if (page > 1) url.searchParams.set('page', String(page))

  const response = await fetch(url, {
    headers: { Accept: 'text/html' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) {
    const error = new Error('No se pudo consultar el catálogo de CyberTeam en este momento.')
    error.statusCode = 502
    throw error
  }

  return load(await response.text())
}

function getPageCount($) {
  const pageNumbers = $('a[href*="page="]')
    .map((_index, element) => {
      try {
        return Number(new URL($(element).attr('href'), BASE_URL).searchParams.get('page')) || 1
      } catch {
        return 1
      }
    })
    .get()
  return Math.min(MAX_PAGES, Math.max(1, ...pageNumbers))
}

export async function searchCyberTeam(query) {
  let firstPage
  try {
    firstPage = await fetchSearchPage(query, 1)
  } catch (cause) {
    if (cause.statusCode) throw cause
    const error = new Error('No se pudo consultar el catálogo de CyberTeam en este momento.')
    error.statusCode = 502
    error.cause = cause
    throw error
  }

  const pageCount = getPageCount(firstPage)
  const pages = [firstPage]
  for (let page = 2; page <= pageCount && pages.length * 16 < MAX_OFFERS; page += 1) {
    try {
      pages.push(await fetchSearchPage(query, page))
    } catch {
      break
    }
  }

  const uniqueOffers = new Map()
  for (const $ of pages) {
    $('.product-card-dark').each((_index, element) => {
      const card = $(element)
      const offer = parseOffer(card)
      if (!offer || !matchesQuery(query, offer.name) || uniqueOffers.has(offer.url)) return
      uniqueOffers.set(offer.url, offer)
    })
  }

  return [...uniqueOffers.values()].sort((a, b) => a.price - b.price).slice(0, MAX_OFFERS)
}
