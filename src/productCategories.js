const categoryRules = [
  { label: 'Fundas y protectores', pattern: /\b(fundas?|covers?|protector(?:es)?|screen protector|tempered glass|vidrio templado)\b/i },
  { label: 'Cargadores', pattern: /\b(cargadores?|chargers?|charging|power bank|bater[ií]a port[aá]til)\b/i },
  { label: 'Cables y adaptadores', pattern: /\b(cables?|adaptadores?|adapters?|usb[- ]?c hub|hub usb)\b/i },
  { label: 'Mandos y controles', pattern: /\b(mandos?|control(?:ler)?s?|gamepads?|joysticks?|dualsense|dual sense|joy[ -]?con|kishi|backbone one|razer edge|mobile controller|control para celular)\b/i },
  { label: 'Localizadores', pattern: /\b(localizadores?|rastreador(?:es)?|trackers?|airtag|smarttag|tile mate|tile pro)\b/i },
  { label: 'Gafas inteligentes', pattern: /\b(gafas? inteligentes?|smart glasses|ray[- ]?ban meta|meta quest|vision pro)\b/i },
  { label: 'Accesorios', pattern: /\b(accesorios?|accessor(?:y|ies)|stands?|holders?|soportes?|mounts?|correas?|straps?|docks?)\b/i },
  { label: 'Juegos', pattern: /\b(videojuegos?|juegos? para|games? for|ps[345] game|xbox game|nintendo switch game|ea sports fc|fifa\s*\d*|call of duty|god of war|spider[- ]?man|elden ring|gran turismo|the last of us|horizon forbidden west|mortal kombat|hogwarts legacy|ghost of (?:tsushima|y[oō]tei)|final fantasy|nba 2k\d*|resident evil|assassin(?:'s)? creed|zelda|mario kart|forza horizon|minecraft)\b/i },
  { label: 'Consolas', pattern: /\b(consolas?|consoles?|playstation\s*5\s*(?:slim|pro|digital|disc|edition)|ps5\s*(?:slim|pro|digital|disc|edition)|xbox\s*series\s*(?:x|s)|nintendo switch\s*(?:oled|lite)|cfi[- ]\d{3,})\b/i },
  { label: 'Celulares', pattern: /\b(iphone|smartphones?|celulares?|tel[eé]fonos? celulares?|galaxy\s*s\d+|pixel\s*\d+|redmi\s*(?:note)?\s*\d+|poco\s*[a-z0-9]+)\b/i },
  { label: 'Tabletas', pattern: /\b(tablets?|tabletas?|ipad(?:\s*(?:air|pro|mini))?)\b/i },
  { label: 'Computadoras', pattern: /\b(laptops?|notebooks?|computadoras?|desktops?|pc\s*(?:gaming|gamer)|macbook|chromebook)\b/i },
  { label: 'Monitores', pattern: /\b(monitores?|monitors?)\b/i },
  { label: 'Televisores', pattern: /\b(televisores?|televisions?|smart tv|oled tv|qled tv)\b/i },
  { label: 'Audio', pattern: /\b(aud[ií]fonos?|headphones?|earbuds?|earphones?|airpods?|bocinas?|speakers?|soundbars?|parlantes?)\b/i },
  { label: 'Relojes inteligentes', pattern: /\b(smartwatches?|relojes? inteligentes?|apple watch|galaxy watch|fitbit)\b/i },
  { label: 'Cámaras', pattern: /\b(c[aá]maras?|cameras?|webcams?)\b/i },
  { label: 'Redes', pattern: /\b(routers?|switches? de red|access points?|puntos de acceso|mesh wi-?fi|repetidores? wi-?fi|modems?)\b/i },
  { label: 'Electrodomésticos', pattern: /\b(refrigeradoras?|refrigerators?|lavadoras?|washing machines?|secadoras?|dryers?|microondas?|microwaves?|cafeteras?|coffee makers?|aspiradoras?|vacuum cleaners?|air fryers?|freidoras? de aire|licuadoras?|blenders?|hornos?|ovens?)\b/i },
  { label: 'Hogar inteligente', pattern: /\b(smart home|hogar inteligente|bombillas? inteligentes?|smart bulbs?|enchufes? inteligentes?|smart plugs?|c[aá]maras? de seguridad|video doorbells?|timbres? inteligentes?|alexa|echo dot|google nest|homepod|sensores? inteligentes?)\b/i },
  { label: 'Impresoras', pattern: /\b(impresoras?|printers?|multifuncionales?)\b/i },
  { label: 'Periféricos', pattern: /\b(mouse|mice|ratones?|teclados?|keyboards?|trackpads?|mousepads?|alfombrillas?)\b/i },
  { label: 'Componentes de PC', pattern: /\b(gpu|graphics card|tarjetas? gr[aá]ficas?|ram|ddr[345]|ssd|nvme|hdd|discos? duros?|motherboards?|placas? madre|procesadores?|processors?|cpu|fuentes? de poder|power supplies|coolers?|ventiladores? de pc|gabinetes? de pc)\b/i },
  { label: 'Repuestos', pattern: /\b(repuestos?|replacement parts?|spare parts?|bater[ií]as? de reemplazo|pantallas? de reemplazo)\b/i },
  { label: 'Software', pattern: /\b(software|licencias?|licenses?|antivirus|microsoft 365|office 365|windows 1[01]|digital code|c[oó]digo digital)\b/i },
]

const genericSourceCategories = new Set(['tecnología', 'tecnologia', 'resultados', 'productos', 'electronics'])
const sourceCategoryMap = new Map([
  ['telefonía', 'Celulares'], ['telefonia', 'Celulares'], ['celulares', 'Celulares'], ['smartphones', 'Celulares'],
  ['consolas', 'Consolas'], ['videojuegos', 'Juegos'], ['juegos', 'Juegos'],
  ['audio', 'Audio'], ['computación', 'Computadoras'], ['computacion', 'Computadoras'], ['computadoras', 'Computadoras'],
  ['componentes', 'Componentes de PC'], ['periféricos', 'Periféricos'], ['perifericos', 'Periféricos'],
  ['accesorios', 'Accesorios'], ['electrodomésticos', 'Electrodomésticos'], ['electrodomesticos', 'Electrodomésticos'],
])

/** Classify product titles into a small, shared taxonomy; unknown products stay visible under "Otros". */
export function classifyOffer(offer) {
  const title = `${offer?.name || ''} ${offer?.subtitle || ''}`
  const compatibilityMention = /\b(compatible con|compatible with|para|for|works with|diseñado para)\b.{0,60}\b(iphone|ipad|android|smartphone|celular|galaxy|pixel|tablet)\b/i.test(title)
  const hasMobileDevice = !compatibilityMention && /\b(iphone|ipad|smartphone|celular|galaxy|pixel|tablet)\b/i.test(title)
  const hasCase = /\b(cases?)\b/i.test(title)

  // "Case" also means a computer chassis; use it as a phone accessory only with device context.
  if (hasCase && hasMobileDevice) return 'Fundas y protectores'

  for (const rule of categoryRules) {
    if (rule.label === 'Fundas y protectores' && hasCase && !hasMobileDevice) continue
    if (rule.label === 'Celulares' && compatibilityMention) continue
    if (rule.pattern.test(title)) return rule.label
  }

  const sourceCategory = String(offer?.category || '').trim().toLocaleLowerCase('es-CR')
  if (sourceCategory && !genericSourceCategories.has(sourceCategory)) return sourceCategoryMap.get(sourceCategory) || 'Otros'
  return 'Otros'
}

export const CATEGORY_ORDER = categoryRules.map(({ label }) => label).concat('Otros')

const BASE_CATEGORY_PRIORITY = [
  'Celulares', 'Consolas', 'Tabletas', 'Computadoras', 'Televisores', 'Monitores',
  'Relojes inteligentes', 'Audio', 'Cámaras', 'Impresoras', 'Redes', 'Electrodomésticos',
  'Hogar inteligente', 'Componentes de PC', 'Periféricos', 'Mandos y controles', 'Juegos',
  'Software', 'Fundas y protectores', 'Cargadores', 'Cables y adaptadores', 'Localizadores',
  'Gafas inteligentes', 'Accesorios', 'Repuestos', 'Otros',
]

const QUERY_CATEGORY_PRIORITIES = [
  { pattern: /\b(juegos?|videojuegos?|games?|fifa|call of duty|minecraft|zelda|mario kart)\b/i, categories: ['Juegos', 'Consolas', 'Mandos y controles', 'Accesorios', 'Fundas y protectores', 'Cargadores', 'Cables y adaptadores', 'Audio', 'Otros'] },
  { pattern: /\b(mandos?|controles?|controladores?|gamepads?|joysticks?|kishi|backbone)\b/i, categories: ['Mandos y controles', 'Consolas', 'Juegos'] },
  { pattern: /\b(fundas?|cases?|covers?|protectores?)\b/i, categories: ['Fundas y protectores', 'Celulares', 'Tabletas'] },
  { pattern: /\b(cargadores?|chargers?|power bank)\b/i, categories: ['Cargadores', 'Celulares', 'Tabletas'] },
  { pattern: /\b(cables?|adaptadores?)\b/i, categories: ['Cables y adaptadores', 'Celulares', 'Computadoras'] },
  { pattern: /\b(ps[345]|playstation|xbox|nintendo switch|consola)\b/i, categories: ['Consolas', 'Mandos y controles', 'Juegos', 'Accesorios', 'Fundas y protectores', 'Cargadores', 'Cables y adaptadores', 'Audio', 'Periféricos', 'Componentes de PC', 'Celulares', 'Tabletas', 'Computadoras', 'Televisores', 'Otros'] },
  { pattern: /\b(iphone|smartphone|celular|tel[eé]fono|galaxy s\d|pixel|redmi|poco|motorola|huawei|samsung)\b/i, categories: ['Celulares', 'Fundas y protectores', 'Cargadores', 'Cables y adaptadores', 'Audio', 'Localizadores', 'Gafas inteligentes', 'Mandos y controles', 'Accesorios', 'Repuestos', 'Tabletas', 'Computadoras', 'Televisores', 'Relojes inteligentes', 'Cámaras', 'Redes', 'Periféricos', 'Componentes de PC', 'Otros'] },
  { pattern: /\b(ipad|tablet|tableta|galaxy tab)\b/i, categories: ['Tabletas', 'Fundas y protectores', 'Cargadores', 'Cables y adaptadores'] },
]

/** Put the likely main product type first while keeping all detected categories available. */
export function sortCategoriesByRelevance(categories, query) {
  const queryPriority = QUERY_CATEGORY_PRIORITIES.find(({ pattern }) => pattern.test(query || ''))?.categories || []
  const rank = (category) => {
    if (category === 'Otros') return Number.MAX_SAFE_INTEGER
    const queryRank = queryPriority.indexOf(category)
    if (queryRank >= 0) return queryRank
    const baseRank = BASE_CATEGORY_PRIORITY.indexOf(category)
    return (queryPriority.length || 0) + (baseRank >= 0 ? baseRank : BASE_CATEGORY_PRIORITY.length)
  }
  return [...categories].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, 'es-CR'))
}
