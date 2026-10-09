import { MongoClient } from 'mongodb'

const COLLECTION_NAME = 'productSpecifications'
const SCHEMA_VERSION = 1
const CONNECTION_TIMEOUT_MS = 2500

// Reuse the client and its connection pool across requests and Vercel warm starts.
let clientPromise
let collectionPromise

function getCollection() {
  const uri = process.env.MONGODB_URI
  if (!uri) return null
  if (!collectionPromise) {
    if (!clientPromise) {
      const client = new MongoClient(uri, {
        serverSelectionTimeoutMS: CONNECTION_TIMEOUT_MS,
        maxPoolSize: 5,
        minPoolSize: 0,
      })
      clientPromise = client.connect()
    }
    collectionPromise = clientPromise.then((client) => {
      const database = process.env.MONGODB_DB_NAME
        ? client.db(process.env.MONGODB_DB_NAME)
        : client.db()
      return database.collection(COLLECTION_NAME)
    }).catch((error) => {
      // A failed initial connect must not poison the process for subsequent requests.
      clientPromise = null
      collectionPromise = null
      throw error
    })
  }
  return collectionPromise
}

export async function findProductKnowledge(productKey) {
  try {
    const collection = await getCollection()
    if (!collection) return null
    const document = await collection.findOne({ _id: productKey })
    if (!document || document.schemaVersion !== SCHEMA_VERSION || !document.facts) return null
    return {
      facts: document.facts,
      sources: Array.isArray(document.sources) ? document.sources : [],
      verifiedAt: document.verifiedAt || null,
    }
  } catch (error) {
    console.error('Mongo product knowledge read failed:', error?.name, error?.message)
    return null
  }
}

export async function mergeProductKnowledge({ productKey, identity, facts, sources }) {
  if (!productKey || !facts || !sources?.length) return false
  try {
    const collection = await getCollection()
    if (!collection) return false
    const now = new Date()
    const factUpdates = Object.fromEntries(Object.entries(facts)
      .filter(([, entries]) => Array.isArray(entries) && entries.length)
      .map(([topic, entries]) => [`facts.${topic}`, { $each: entries }]))
    if (!Object.keys(factUpdates).length) return false

    await collection.updateOne(
      { _id: productKey },
      {
        $set: {
          brand: identity.brand,
          model: identity.model,
          variant: identity.variant,
          schemaVersion: SCHEMA_VERSION,
          verifiedAt: now,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
        $addToSet: {
          ...factUpdates,
          sources: { $each: sources.map(({ name, url }) => ({
            title: name,
            domain: new URL(url).hostname.toLowerCase(),
            url,
          })) },
        },
      },
      { upsert: true },
    )
    return true
  } catch (error) {
    // Persistence is an optional optimization; successful research still answers the user.
    console.error('Mongo product knowledge write failed:', error?.name, error?.message)
    return false
  }
}
