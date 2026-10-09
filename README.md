# Oferticas

Prototipo responsive de un comparador de precios para Costa Rica y Estados Unidos, con búsqueda local en varias tiendas y Google Shopping mediante SerpApi para Estados Unidos.

## Requisitos

- Node.js 20 o superior
- npm

## Desarrollo local

```bash
npm install
npm run dev
```

Vite y Express arrancan juntos. Abre la dirección local de Vite; Express sirve la API en el puerto 3000.

## Compilar para producción

```bash
npm run build
npm run preview
```

La salida de frontend queda en `dist/`. El backend local se inicia con `npm start`.

## Publicar en Vercel

Importa este repositorio en Vercel. Vercel construye el frontend Vite y publica `api/index.js` como función serverless. `vercel.json` enruta `/api/*` hacia la función y el resto de rutas hacia la SPA.

También puedes desplegar desde la terminal con Vercel CLI:

```bash
npm install
npx vercel
```

## API de búsqueda

`POST /api/products/search` recibe `{ "query": "RTX 5060", "market": "cr" }` y devuelve una lista normalizada. `market: "cr"` consulta Intelec, Walmart Costa Rica, Gollo, Unimart, Xiaomi Store Costa Rica, Steren Costa Rica, Monge Costa Rica, TicoTek, CyberTeam, iCon Costa Rica e iShop Costa Rica; reúne resultados disponibles y conserva enlaces a fichas locales. TicoTek se consulta con la API pública Store API de WooCommerce; CyberTeam se consulta mediante la ruta de búsqueda pública de su tienda. En Walmart se identifica al vendedor cuando es un comercio externo del marketplace. iCon e iShop publican sus precios en USD; la aplicación conserva ese precio y muestra además una referencia aproximada en CRC, calculada con la tasa de venta diaria publicada por el API de indicadores de Hacienda, junto con su fecha. La tasa aplicada por el comercio o el medio de pago puede variar. Si una tienda o el servicio de tipo de cambio no responde, se muestran las ofertas de las otras fuentes disponibles. `market: "us"` consulta Google Shopping mediante SerpApi, fija Estados Unidos (`gl=us`) y devuelve resultados USD de modelo coincidente. Google suele proporcionar un enlace a Google Shopping, no a la página del comercio; la UI lo etiqueta como tal. Las respuestas de búsqueda se cachean en memoria por cuatro horas, separadas por mercado y consulta; el tipo de cambio se cachea por una hora.

Variables opcionales en `.env` (copia `.env.example`): `SERPAPI_API_KEY`, `SERPAPI_HL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `MONGODB_URI`, `MONGODB_DB_NAME`, `MAX_QUESTIONS_PER_PRODUCT`, `MAX_QUESTIONS_PER_IP_HOUR`, `RATE_LIMIT_HASH_SECRET`, `PORT`, `FRONTEND_ORIGIN`, `SEARCH_CACHE_TTL_SECONDS`. SerpApi se usa al buscar en Estados Unidos, OpenAI al responder preguntas y MongoDB Atlas para compartir especificaciones técnicas verificadas y, si está configurado, aplicar límites compartidos de uso de IA entre instancias. El servidor carga `.env` al iniciar. Nunca compartas ni subas ese archivo; está ignorado por Git. Después de modificarlo, reinicia `npm run dev`.

## Asistente contextual de producto

Después de una búsqueda con resultados aparece **Preguntar sobre este producto**. El panel usa la oferta visible de menor precio como contexto y acepta por defecto una pregunta de hasta 300 caracteres por producto y sesión, con un límite adicional de 20 preguntas por IP cada hora. El servidor valida la oferta firmada, busca primero una especificación compartida del modelo exacto y responde con los hechos guardados y sus fuentes oficiales si el tema está cubierto. Cuando falta el dato, consulta una vez la búsqueda web de Responses API en dominios oficiales conocidos de la marca; los hechos estructurados y las URLs/títulos/dominios de sus citas oficiales se agregan al registro del producto para futuras personas. También conserva el resumen firmado durante la sesión actual. La identidad compartida combina marca, modelo y variante. Para el DualSense de PlayStation se normalizan alias conocidos de títulos entre tiendas (por ejemplo, “Control inalámbrico DualSense para PS5” y “Sony DualSense PS5”); DualSense estándar y DualSense Edge usan claves distintas. Los títulos que indiquen una base de carga, funda, repuesto u otro accesorio no usan la clave del control. En productos desconocidos o ambiguos se conserva el título completo normalizado, así que el sistema prefiere crear registros separados antes que unir modelos dudosos. Precios y disponibilidad siguen procediendo de la tienda comparada y nunca se guardan en esta base. No se guardan preguntas, chats, sesiones ni IPs. Para marcas cuyo dominio oficial no esté configurado, no se realiza una búsqueda abierta.

### Configurar MongoDB Atlas

La base de datos es opcional. Sin `MONGODB_URI`, o si Atlas no está disponible, el asistente conserva el flujo actual de investigación por sesión y las búsquedas de productos/precios siguen funcionando. La app usa la colección `productSpecifications` en la base `oferticas` (o el valor de `MONGODB_DB_NAME`) y crea los documentos e índices necesarios para identificar registros mediante su `_id` de modelo exacto.

1. Crea un clúster gratuito o existente en MongoDB Atlas, un usuario de base de datos y una regla de Network Access que permita conexiones desde tu entorno de desarrollo y Vercel.
2. Copia la cadena de conexión privada de Atlas. No la pegues en el chat, el código, `.env.example` ni el repositorio.
3. Agrégala en tu `.env` local como `MONGODB_URI=...`; deja `MONGODB_DB_NAME=oferticas` o elige otro nombre. Reinicia el servidor.
4. En Vercel, agrega `MONGODB_URI` y `MONGODB_DB_NAME` en **Project Settings → Environment Variables** para cada entorno de despliegue y vuelve a desplegar. Estas variables se leen solo en la función del servidor.

MongoDB conserva `brand`, `model`, `variant`, hechos técnicos agrupados por tema, metadatos de las fuentes oficiales y marcas de tiempo de verificación/actualización. Al completar el dato de un tema nuevo, el servidor lo agrega al registro existente. Si no hay fuentes oficiales aceptadas o hechos técnicos, no se persiste investigación vacía o sin cita. El driver reutiliza su pool de conexiones entre solicitudes y arranques cálidos de funciones serverless.

Para habilitar respuestas, copia `.env.example` a `.env` si todavía no tienes el archivo y agrega tu clave a `OPENAI_API_KEY` localmente. No envíes la clave en el chat ni la agregues al código. El modelo se configura con `OPENAI_MODEL` (por defecto `gpt-6-luna`). `MAX_QUESTIONS_PER_PRODUCT` permite configurar el límite por producto hasta un máximo de 3 y por defecto es 1; `MAX_QUESTIONS_PER_IP_HOUR` configura el límite adicional por IP. Con `MONGODB_URI`, ambos contadores se comparten entre instancias; sin MongoDB funcionan en memoria por instancia y pueden reiniciarse al reiniciar el servidor. Configura `RATE_LIMIT_HASH_SECRET` con un secreto aleatorio propio en producción. El endpoint `POST /api/products/ask` usa OpenAI Responses API; limita la investigación web a un llamado por respuesta y a dominios oficiales configurados, y reutiliza hechos compartidos o el resumen firmado de sesión. Las respuestas con una especificación guardada no invocan búsqueda web; si falta el tema, el asistente investiga el dato pendiente. Las consultas con búsqueda tienen timeout de 30 segundos; las respuestas basadas en contexto existente, de 12 segundos. Sin una clave, la búsqueda de ofertas sigue funcionando y el chat devuelve un error de configuración sin afectar los precios.

Con MongoDB configurado, los contadores compartidos usan hashes de sesión/producto e IP, con expiración automática; no se almacena la IP en claro. Sin MongoDB, los límites son locales a cada instancia y no se comparten entre instancias serverless. La caché de contexto de oferta también es temporal y local al proceso.

### Probar el asistente localmente

1. Agrega `OPENAI_API_KEY` en `.env` y ejecuta `npm run dev` (reinicia si el servidor ya estaba activo).
2. Abre Vite, busca un producto hasta obtener resultados y pulsa **Preguntar sobre este producto**.
3. Envía una pregunta técnica que no aparezca en la oferta, como compatibilidad con PC; el asistente busca en un dominio oficial permitido y muestra una fuente clicable. Una pregunta posterior reutiliza el contexto guardado durante la sesión. También puedes probar una pregunta ajena al producto.
4. Sin clave, comprueba que la búsqueda de precios sigue funcionando y que el asistente indica que falta configuración. El contexto firmado se genera en la respuesta de búsqueda y el servidor rechaza preguntas si se altera la oferta, el producto o la sesión.

## Qué contiene el prototipo

- Buscador conectado a los catálogos disponibles según el mercado.
- Ordenamiento por precio, tarjetas de oferta y guardados locales durante la sesión.
- Filtro de resultados por una o varias tiendas.
- Enlaces directos a las fichas de tienda cuando la fuente los ofrece.
- Layout adaptado a móvil, tablet y escritorio.

SerpApi es necesaria solo para búsquedas en Estados Unidos. Las ofertas de Costa Rica se obtienen directamente de los catálogos de tiendas. Las claves de servicios externos solo se leen en el backend y nunca en el frontend.
