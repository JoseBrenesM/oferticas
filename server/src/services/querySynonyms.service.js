const TERM_GROUPS = [
  {
    terms: ['audifono', 'audifonos', 'auricular', 'auriculares', 'cascos', 'headset', 'headsets', 'headphone', 'headphones', 'earphone', 'earphones'],
    englishTerms: ['headset', 'headsets', 'headphone', 'headphones', 'earphone', 'earphones'],
    spanish: 'audífonos',
    english: 'headset',
  },
  {
    terms: ['raton', 'ratones', 'mouse', 'mice'],
    englishTerms: ['mouse', 'mice'],
    spanish: 'ratón',
    english: 'mouse',
  },
  {
    terms: ['teclado', 'teclados', 'keyboard', 'keyboards'],
    englishTerms: ['keyboard', 'keyboards'],
    spanish: 'teclado',
    english: 'keyboard',
  },
  {
    terms: ['pantalla', 'pantallas', 'monitor', 'monitores', 'display', 'displays', 'screen', 'screens'],
    englishTerms: ['monitor', 'monitores', 'display', 'displays', 'screen', 'screens'],
    spanish: 'pantalla',
    english: 'monitor',
  },
  {
    terms: ['portatil', 'portatiles', 'laptop', 'laptops', 'notebook', 'notebooks'],
    englishTerms: ['laptop', 'laptops', 'notebook', 'notebooks'],
    spanish: 'portátil',
    english: 'laptop',
  },
]

function normalizeTerm(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-CR')
}

export function expandSearchQueries(query) {
  const original = String(query || '').trim()
  const terms = original.match(/[\p{L}\p{N}]+/gu) || []

  for (const group of TERM_GROUPS) {
    const matched = terms.find((term) => group.terms.includes(normalizeTerm(term)))
    if (!matched) continue
    const alternate = group.englishTerms.includes(normalizeTerm(matched)) ? group.spanish : group.english
    const variant = original.replace(matched, alternate)
    return variant.toLocaleLowerCase('es-CR') === original.toLocaleLowerCase('es-CR')
      ? [original]
      : [original, variant]
  }

  return [original]
}
