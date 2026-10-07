const SERPAPI_ENDPOINT = 'https://serpapi.com/search.json'

export async function getSerpApiAccountStatus() {
  const apiKey = process.env.SERPAPI_API_KEY
  if (!apiKey) return { configured: false, message: 'No hay una clave configurada.' }

  const params = new URLSearchParams({ api_key: apiKey })
  const response = await fetch(`https://serpapi.com/account.json?${params}`)
  const data = await response.json()

  if (!response.ok || data.error) {
    const error = new Error(response.status === 401
      ? 'SerpApi no reconoce la clave configurada. Verifica que copiaste la API key vigente.'
      : 'SerpApi no pudo verificar esta cuenta. Confirma el estado de la cuenta en el panel de SerpApi.')
    error.statusCode = response.status === 401 ? 401 : 502
    throw error
  }

  return {
    configured: true,
    active: data.account_status === 'Active',
    searchesLeft: data.total_searches_left ?? data.plan_searches_left ?? null,
    planName: data.plan_name ?? null,
  }
}

export async function searchSerpApi(query) {
  const params = new URLSearchParams({
    engine: 'google_shopping',
    q: query,
    gl: 'us',
    google_domain: 'google.com',
    hl: process.env.SERPAPI_HL || 'es',
    api_key: process.env.SERPAPI_API_KEY,
  })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45000)

  try {
    const response = await fetch(`${SERPAPI_ENDPOINT}?${params}`, { signal: controller.signal, headers: { Accept: 'application/json' } })
    const data = await response.json()

    if (!response.ok) {
      console.error('SerpApi request failed:', data.error || response.statusText)
      const providerMessage = typeof data.error === 'string' ? data.error : ''
      const safeMessage = response.status === 401 || providerMessage.toLowerCase().includes('invalid api key')
        ? 'SerpApi rechazó la clave. Verifica que copiaste la API key vigente en .env y reiniciaste el servidor.'
        : response.status === 403
          ? 'SerpApi indica que esta cuenta no tiene permiso para hacer búsquedas. Revisa su estado en el panel de cuenta.'
          : response.status === 429
            ? 'SerpApi indica que se agotó la cuota o el límite por hora.'
            : providerMessage.toLowerCase().includes('location')
              ? 'SerpApi no reconoció la ubicación configurada. Revisa SERPAPI_LOCATION.'
              : 'SerpApi rechazó la solicitud. Revisa la configuración de búsqueda.'
      const error = new Error(safeMessage)
      error.statusCode = response.status === 401 ? 401 : response.status === 403 ? 403 : response.status === 429 ? 429 : 502
      throw error
    }

    if (data.error) {
      console.error('SerpApi search error:', data.error)
      const error = new Error('SerpApi no pudo completar la búsqueda. Inténtalo nuevamente en un momento.')
      error.statusCode = 502
      throw error
    }

    return data
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('La búsqueda tardó demasiado. Inténtalo nuevamente.')
      timeoutError.statusCode = 504
      throw timeoutError
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
