import { Router } from 'express'
import { searchProducts } from '../services/productSearch.service.js'
import { askAboutProduct, signSearchOffers } from '../services/productAssistant.service.js'

export const productsRouter = Router()

productsRouter.post('/search', async (request, response, next) => {
  try {
    const query = typeof request.body?.query === 'string' ? request.body.query.trim() : ''

    if (!query) {
      return response.status(400).json({ error: 'Escribe el nombre del producto que quieres buscar.' })
    }

    if (query.length > 120) {
      return response.status(400).json({ error: 'La búsqueda no puede superar 120 caracteres.' })
    }

    const market = request.body?.market === 'us' ? 'us' : 'cr'
    const sessionId = typeof request.body?.sessionId === 'string' ? request.body.sessionId.trim().slice(0, 100) : ''

    response.json(signSearchOffers(await searchProducts(query, market), sessionId))
  } catch (error) {
    next(error)
  }
})

export const productsAskRouter = Router()

productsAskRouter.post('/ask', async (request, response, next) => {
  try {
    const result = await askAboutProduct(request, request.body)
    response.json(result)
  } catch (error) {
    next(error)
  }
})
