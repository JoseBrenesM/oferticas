const EXCHANGE_RATE_URL = 'https://api.hacienda.go.cr/indicadores/tc/dolar'
const CACHE_TTL_MS = 60 * 60 * 1000
let cachedRate = null
let cachedAt = 0

export async function getUsdToCrcSaleRate() {
  if (cachedRate && Date.now() - cachedAt < CACHE_TTL_MS) return cachedRate

  const response = await fetch(EXCHANGE_RATE_URL, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error('No se pudo consultar el tipo de cambio de referencia.')

  const data = await response.json()
  const value = Number(data.venta?.valor)
  const date = String(data.venta?.fecha || '')
  if (!Number.isFinite(value) || value <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('El tipo de cambio recibido no tiene un formato válido.')
  }

  cachedRate = { value, date, source: 'Ministerio de Hacienda · referencia BCCR' }
  cachedAt = Date.now()
  return cachedRate
}
