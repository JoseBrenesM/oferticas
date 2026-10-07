import express from 'express'
import { productsRouter } from './routes/products.routes.js'
import { getSerpApiAccountStatus } from './services/serpApi.service.js'
import { productsAskRouter } from './routes/products.routes.js'

export const app = express()

app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(express.json({ limit: '10kb' }))

const allowedOrigin = process.env.FRONTEND_ORIGIN
app.use((request, response, next) => {
  if (allowedOrigin && request.headers.origin === allowedOrigin) {
    response.setHeader('Access-Control-Allow-Origin', allowedOrigin)
    response.setHeader('Vary', 'Origin')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  }

  if (request.method === 'OPTIONS') return response.sendStatus(204)
  next()
})

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' })
})

app.get('/api/serpapi/status', async (_request, response, next) => {
  try {
    response.json(await getSerpApiAccountStatus())
  } catch (error) {
    next(error)
  }
})

app.use('/api/products', productsRouter)
app.use('/api/products', productsAskRouter)

app.use((error, _request, response, _next) => {
  console.error('Unhandled API error:', error.message)
  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500
  const message = statusCode >= 500 && statusCode !== 502 && statusCode !== 503 && statusCode !== 504
    ? 'Ocurrió un error al procesar la solicitud.'
    : error.message
  const payload = { error: message }
  if (Number.isInteger(error.questionsRemaining)) payload.questionsRemaining = error.questionsRemaining
  response.status(statusCode).json(payload)
})
