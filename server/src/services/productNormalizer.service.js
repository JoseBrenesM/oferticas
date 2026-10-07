function extractUrl(result) {
  const candidates = [result.link, result.tracking_link]
  const candidate = candidates.find((value) => {
    if (!value) return false
    try {
      const host = new URL(value).hostname.toLowerCase()
      return !host.includes('google.') && !host.includes('serpapi.com')
    } catch {
      return false
    }
  })
  if (!candidate) {
    const productLink = result.product_link
    if (productLink && /^https:\/\/www\.google\./i.test(productLink)) return productLink
    return null
  }

  try {
    const url = new URL(candidate)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

function hasCurrencyPrice(result, market) {
  const price = typeof result.price === 'string' ? result.price : ''
  const currency = typeof result.currency === 'string' ? result.currency.toUpperCase() : ''
  if (market === 'us') return currency === 'USD' || /\$|\bUSD\b/i.test(price)
  return currency === 'CRC' || /₡|\bCRC\b|colones?/i.test(price)
}

function looksLikeSubscriptionOrFinancing(result) {
  const text = [
    result.title,
    result.price,
    result.installment?.price,
    result.installment?.period,
    result.delivery,
    result.snippet,
    ...(Array.isArray(result.extensions) ? result.extensions : []),
    ...(Array.isArray(result.tags) ? result.tags : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return /\b(per\s*month|monthly|\/\s*month|\/\s*mo\b|\/mo\b|\bmonth\b|monthly\s*plan|plan\s*mensual|por\s*mes|al\s*mes|mensualidad|financing|financed|financiado|installments?|instalments?|cuotas?|monthly\s*payments?|\d+\s*(?:months?|mos\.?|mo\.?))\b/i.test(text)
}

function matchesUSQuery(result, query) {
  const queryTokens = query.toLocaleLowerCase('en-US').match(/[\p{L}\p{N}]+/gu) ?? []
  const title = String(result.title || '').toLocaleLowerCase('en-US')
  const importantTokens = queryTokens.filter((token) => token.length >= 3 || /^\d+$/.test(token))
  if (!importantTokens.every((token) => title.includes(token))) return false

  const modelMatch = query.match(/\b(rtx|gtx|rx)\s*(\d{3,4})\s*(ti|super|xtx|xt)?\b/i)
  if (modelMatch) {
    const [, family, number, variant = ''] = modelMatch
    const resultModel = new RegExp(`\\b${family}\\s*${number}\\s*(ti|super|xtx|xt)?\\b`, 'i').exec(title)
    if (!resultModel) return false
    const requestedVariant = variant.toLowerCase()
    const resultVariant = (resultModel[1] || '').toLowerCase()
    if (requestedVariant !== resultVariant) return false
  }
  return true
}

function isClearlyUsed(result) {
  const text = [result.title, result.second_hand_condition, result.condition, result.snippet]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return /\b(used|pre-owned|refurbished|renewed|open box|second hand)\b/i.test(text)
}

function isImplausiblePrice(result) {
  const price = Number(result.extracted_price)
  const title = String(result.title || '').toLowerCase()
  const query = String(result.__query || '').toLowerCase()
  if (!Number.isFinite(price) || price <= 0) return true
  if (/\b(laptop|notebook|desktop|computer|pc|bundle|kit)\b/i.test(title) && /\b(gpu|graphics card|video card|rtx|gtx|radeon)\b/i.test(query)) return true
  if (/\b(adapter|cable|cooler|fan|bracket|sticker|manual|box only|replacement part)\b/i.test(title)) return true
  return false
}

export function normalizeOffer(result, market = 'cr', query = '') {
  result = { ...result, __query: query }
  const price = Number(result.extracted_price)
  const url = extractUrl(result)
  if (!Number.isFinite(price) || price <= 0 || !url || !hasCurrencyPrice(result, market) || looksLikeSubscriptionOrFinancing(result)) return null
  if (market === 'us' && (!matchesUSQuery(result, query) || isClearlyUsed(result) || isImplausiblePrice(result) || /\+\s*$/.test(result.price || ''))) return null

  const title = typeof result.title === 'string' ? result.title.trim() : ''
  const store = typeof result.source === 'string' ? result.source.trim() : ''
  if (!title || !store) return null

  const storeInitials = store.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase()
  return {
    id: result.product_id || url,
    name: title,
    subtitle: result.delivery || result.snippet || 'Precio encontrado en Google Shopping',
    category: 'Resultados',
    price,
    oldPrice: Number.isFinite(Number(result.extracted_old_price)) ? Number(result.extracted_old_price) : null,
    currency: market === 'us' ? 'USD' : 'CRC',
    market,
    store: store || (market === 'us' ? 'Google Shopping' : ''),
    initials: storeInitials || 'GS',
    storeColor: '#e9f3ed',
    storeText: '#265940',
    image: result.thumbnail || '',
    alt: title,
    rating: Number.isFinite(Number(result.rating)) ? Number(result.rating).toFixed(1) : null,
    reviews: Number.isFinite(Number(result.reviews)) ? String(result.reviews) : null,
    url,
    availability: 'unknown',
  }
}
