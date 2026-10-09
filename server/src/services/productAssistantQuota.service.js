import { createHash } from 'node:crypto'
import { MongoClient } from 'mongodb'

const COLLECTION_NAME = 'productAssistantUsage'
const MAX_ENTRIES = 5000
const fallbackUsage = new Map()
let clientPromise
let collectionPromise
let indexPromise

function boundedSet(key, value) {
  if (!fallbackUsage.has(key) && fallbackUsage.size >= MAX_ENTRIES) {
    fallbackUsage.delete(fallbackUsage.keys().next().value)
  }
  fallbackUsage.set(key, value)
}

function getCollection() {
  const uri = process.env.MONGODB_URI
  if (!uri) return null
  if (!collectionPromise) {
    if (!clientPromise) {
      const client = new MongoClient(uri, { serverSelectionTimeoutMS: 2500, maxPoolSize: 5, minPoolSize: 0 })
      clientPromise = client.connect()
    }
    collectionPromise = clientPromise.then((client) => {
      const database = process.env.MONGODB_DB_NAME ? client.db(process.env.MONGODB_DB_NAME) : client.db()
      return database.collection(COLLECTION_NAME)
    }).catch((error) => {
      clientPromise = null
      collectionPromise = null
      throw error
    })
  }
  return collectionPromise
}

function storageKey(key) {
  // Do not persist raw IP addresses or session identifiers.
  const secret = process.env.RATE_LIMIT_HASH_SECRET || process.env.OPENAI_API_KEY || 'local-development-rate-limit'
  return createHash('sha256').update(`${secret}:${key}`).digest('hex')
}

async function consumePersistent(key, limit, windowMs) {
  const collection = await getCollection()
  const _id = storageKey(key)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + windowMs)
  if (!indexPromise) {
    indexPromise = collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch((error) => {
      indexPromise = null
      throw error
    })
  }
  await indexPromise

  try {
    await collection.insertOne({ _id, count: 1, expiresAt })
    return true
  } catch (error) {
    if (error.code !== 11000) throw error
  }

  const reset = await collection.updateOne(
    { _id, expiresAt: { $lte: now } },
    { $set: { count: 1, expiresAt } },
  )
  if (reset.matchedCount) return true

  const increment = await collection.updateOne(
    { _id, expiresAt: { $gt: now }, count: { $lt: limit } },
    { $inc: { count: 1 } },
  )
  return increment.matchedCount > 0
}

export async function consumeAssistantQuota(key, limit, windowMs) {
  const collection = await getCollection()
  if (collection) return consumePersistent(key, limit, windowMs)

  const now = Date.now()
  const current = fallbackUsage.get(key)
  if (current && current.expiresAt > now && current.count >= limit) return false
  const next = current && current.expiresAt > now
    ? { count: current.count + 1, expiresAt: current.expiresAt }
    : { count: 1, expiresAt: now + windowMs }
  boundedSet(key, next)
  return true
}

export async function releaseAssistantQuota(key) {
  const collection = await getCollection()
  if (collection) {
    await collection.updateOne({ _id: storageKey(key), count: { $gt: 0 } }, { $inc: { count: -1 } })
    return
  }
  const current = fallbackUsage.get(key)
  if (current) current.count = Math.max(0, current.count - 1)
}
