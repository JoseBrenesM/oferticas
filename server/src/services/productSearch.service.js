import { offers as demoOffers } from '../../../src/data.js'
import { searchSerpApi } from './serpApi.service.js'
import { normalizeOffer } from './productNormalizer.service.js'
import { searchIntelec } from './intelec.service.js'
import { searchWalmart } from './walmart.service.js'
import { searchGollo } from './gollo.service.js'
import { getUsdToCrcSaleRate } from './exchangeRate.service.js'
import { searchShopifyCostaRica } from './shopifyCostaRica.service.js'
import { searchXiaomiStore } from './xiaomiStore.service.js'
import { searchUnimart } from './unimart.service.js'
import { searchSteren } from './steren.service.js'
import { getCachedSearch, setCachedSearch } from './cache.service.js'
import { expandSearchQueries } from './querySynonyms.service.js'

const ACCESSORY_TERMS = /\b(case|cases|cover|charger|charging|cable|protector|screen|glass|adapter|accessor(?:y|ies)|funda|fundas|estuche|cobertor|cargador|cable|protector|pantalla|adaptador|accesorio|accesorios|soporte|holder|bolsa|game\s*pad|gamepad|controlador|replacement|repuesto|applecare|warranty|garant[ií]a|plan|gift card|tarjeta de regalo|dock|docking|stand)\b|\b(estaci[oó]n\s+de\s+carga|base\s+de\s+carga|charging\s+station|charging\s+dock)\b/i
const MAX_OFFERS_PER_STORE = 36

async function searchWithSynonyms(search, query) {
  const variants = expandSearchQueries(query)
  const settled = await Promise.allSettled(variants.map((variant) => search(variant)))
  const successful = settled.filter((result) => result.status === 'fulfilled')
  if (!successful.length) throw settled[0].reason

  const offers = successful.flatMap((result) => result.value)
  const unique = new Map()
  for (const offer of offers) {
    const key = offer.url?.replace(/\/$/, '').toLocaleLowerCase('es-CR') || offer.id
    if (!unique.has(key)) unique.set(key, offer)
  }
  return [...unique.values()]
}

function matchesRequestedIphoneVariant(query, title) {
  const requested = /\biphone\s*(\d+)\s*(pro\s*max|pro|max|air|e)?\b/i.exec(query)
  if (!requested) return true
  const found = /\biphone\s*(\d+)\s*(pro\s*max|pro|max|air|e)?\b/i.exec(title)
  if (!found) return false
  const requestedVariant = (requested[2] || '').replace(/\s+/g, '').toLowerCase()
  const foundVariant = (found[2] || '').replace(/\s+/g, '').toLowerCase()
  return requested[1] === found[1] && (!requestedVariant || requestedVariant === foundVariant)
}

function isAccessoryQuery(query) {
  return ACCESSORY_TERMS.test(query)
}

export async function searchProducts(query, market = 'cr') {
  const cacheKey = `v2:${market}:${query.toLocaleLowerCase('es-CR').replace(/\s+/g, ' ').trim()}`
  const cached = getCachedSearch(cacheKey)
  if (cached) return { ...cached, cached: true }

  if (market === 'cr') {
    const localSources = [
      ['Intelec', searchIntelec],
      ['Walmart', searchWalmart],
      ['Gollo', searchGollo],
      ['Unimart', searchUnimart],
      ['Xiaomi Store Costa Rica', searchXiaomiStore],
      ['Steren Costa Rica', searchSteren],
    ]
    const rateResult = await getUsdToCrcSaleRate().then((value) => ({ status: 'fulfilled', value }))
      .catch(() => ({ status: 'rejected' }))
    const sources = [...localSources]
    const unavailableSources = []
    if (rateResult.status === 'fulfilled') {
      sources.push(
        ['iCon Costa Rica', (searchQuery) => searchShopifyCostaRica('icon', searchQuery, rateResult.value)],
        ['iShop Costa Rica', (searchQuery) => searchShopifyCostaRica('ishop', searchQuery, rateResult.value)],
      )
    } else {
      unavailableSources.push('iCon Costa Rica (tipo de cambio)', 'iShop Costa Rica (tipo de cambio)')
    }

    const settled = await Promise.allSettled(sources.map(([, search]) => searchWithSynonyms(search, query)))
    const failedSources = settled.flatMap((result, index) => result.status === 'rejected' ? [sources[index][0]] : [])
    unavailableSources.push(...failedSources)
    const successfulSources = settled.filter((result) => result.status === 'fulfilled').length
    if (successfulSources === 0) {
      const error = new Error('No se pudieron consultar las tiendas de Costa Rica. Intenta de nuevo en un momento.')
      error.statusCode = 502
      throw error
    }
    const combined = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
    const uniqueOffers = new Map()
    for (const offer of combined) {
      if (!matchesRequestedIphoneVariant(query, offer.name)) continue
      if (!isAccessoryQuery(query) && ACCESSORY_TERMS.test(offer.name)) continue
      const key = offer.url?.replace(/\/$/, '').toLocaleLowerCase('es-CR') || offer.id
      if (!uniqueOffers.has(key)) uniqueOffers.set(key, offer)
    }
    const offersByStore = new Map()
    for (const offer of uniqueOffers.values()) {
      const source = String(offer.id || '').split(':', 1)[0] || offer.store
      if (!offersByStore.has(source)) offersByStore.set(source, [])
      offersByStore.get(source).push(offer)
    }
    const offers = [...offersByStore.values()]
      // Allow several 12-result UI pages while keeping unusually broad catalogs bounded.
      .flatMap((storeOffers) => storeOffers.sort((a, b) => a.price - b.price).slice(0, MAX_OFFERS_PER_STORE))
      .sort((a, b) => a.price - b.price)
    const response = {
      query,
      market: 'cr',
      totalResults: offers.length,
      bestPrice: offers[0]?.price ?? null,
      currency: 'CRC',
      offers,
      source: 'multiple',
      sources: sources.filter((_, index) => settled[index].status === 'fulfilled').map(([name]) => name),
      unavailableSources,
      exchangeRate: rateResult.status === 'fulfilled' ? rateResult.value.value : null,
      exchangeRateDate: rateResult.status === 'fulfilled' ? rateResult.value.date : null,
      cached: false,
    }
    // A partial response should not hide a temporarily unavailable store for the full cache TTL.
    if (unavailableSources.length === 0) setCachedSearch(cacheKey, response)
    return response
  }

  if (!process.env.SERPAPI_API_KEY) {
    const demoQuery = cacheKey.includes('logitech') || cacheKey.includes('g305')
    const sampleOffers = demoQuery ? demoOffers : []
    const response = {
      query,
      totalResults: sampleOffers.length,
      currency: 'CRC',
      offers: sampleOffers.map((offer) => ({ ...offer, url: null, availability: 'unknown' })),
      source: 'demo',
      cached: false,
    }
    setCachedSearch(cacheKey, response)
    return response
  }

  const data = await searchSerpApi(query)
  const results = (data.shopping_results ?? []).map((result) => normalizeOffer(result, 'us', query)).filter(Boolean)
  const offers = results.sort((a, b) => a.price - b.price).slice(0, 20)
  const response = {
    query,
    market: 'us',
    totalResults: offers.length,
    bestPrice: offers[0]?.price ?? null,
    currency: 'USD',
    offers,
    source: 'serpapi',
    cached: false,
  }

  setCachedSearch(cacheKey, response)
  return response
}
