import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownUp, ArrowRight, ArrowUpRight, BadgeCheck, Check,
  ChevronDown, CircleHelp, Heart, Menu, Search, ShieldCheck, MessageCircle, Send,
  Star, Trash2, X,
} from 'lucide-react'
import { formatPrice } from './data.js'

function readSavedOffers() {
  try {
    const storedOffers = JSON.parse(window.localStorage.getItem('oferticas:saved-offers') || '[]')
    return Array.isArray(storedOffers) ? storedOffers.filter((offer) => offer?.id && offer?.name) : []
  } catch {
    return []
  }
}

function Logo() {
  return (
    <a className="brand" href="#inicio" aria-label="Oferticas, inicio">
      <span className="brand-mark"><span /><span /><span /><span /></span>
      <span>oferti<span className="brand-accent">cas</span></span>
    </a>
  )
}

function SearchBox({ query, setQuery, onSearch, compact = false }) {
  return (
    <form className={`search-box ${compact ? 'search-box-compact' : ''}`} onSubmit={(event) => { event.preventDefault(); onSearch() }}>
      <Search size={19} strokeWidth={2.2} className="search-icon" />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="¿Qué estás buscando?"
        aria-label="Buscar producto"
      />
      {query && <button className="clear-search" type="button" onClick={() => setQuery('')} aria-label="Limpiar búsqueda"><X size={16} /></button>}
      <button className="search-submit" type="submit">Buscar <ArrowRight size={16} /></button>
    </form>
  )
}

function OfferCard({ offer, index, saved, onSave }) {
  return (
    <article className={`offer-card ${offer.featured ? 'offer-card-featured' : ''}`}>
      <div className="offer-image-wrap">
        {offer.image && <img className="offer-image" src={offer.image} alt={offer.alt} loading="lazy" />}
        <button className={`save-button ${saved ? 'saved' : ''}`} type="button" onClick={() => onSave(offer)} aria-label={saved ? 'Quitar de guardados' : 'Guardar oferta'}>
          <Heart size={17} fill={saved ? 'currentColor' : 'none'} />
        </button>
        <span className="rank">0{index + 1}</span>
      </div>
      <div className="offer-body">
        <div className="offer-topline"><span>{offer.category}</span>{offer.rating && <span className="rating"><Star size={13} fill="currentColor" /> {offer.rating} {offer.reviews && <small>({offer.reviews})</small>}</span>}</div>
        <h3>{offer.name}</h3>
        <p className="offer-subtitle">{offer.subtitle}</p>
        <div className="offer-price-block">
          {offer.oldPrice && <span className="old-price">{formatPrice(offer.oldPrice)}</span>}
          <div className="price-row"><strong>{offer.priceIsApproximate ? '≈ ' : ''}{formatPrice(offer.price, offer.currency)}</strong></div>
          {offer.priceIsApproximate && <span className="converted-price-source">{formatPrice(offer.originalPrice, offer.originalCurrency)} en tienda · CRC aproximado</span>}
        </div>
        <div className="offer-footer">
          <div className="store-info">
            <span className="store-avatar" style={{ background: offer.storeColor, color: offer.storeText }}>{offer.initials}</span>
            <span>{offer.store}<BadgeCheck size={13} className="verified" /></span>
          </div>
          {offer.url ? <a className="offer-link" href={offer.url} target="_blank" rel="noopener noreferrer" aria-label={`Ver oferta de ${offer.store}` } title={offer.market === 'us' ? 'Ver resultado en Google Shopping' : 'Ver tienda'}><ArrowUpRight size={17} /></a> : <span className="offer-link offer-link-disabled" aria-label="Enlace de tienda no disponible"><ArrowUpRight size={17} /></span>}
        </div>
      </div>
    </article>
  )
}

function SavedOffersModal({ offers, onClose, onRemove }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div className="saved-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="saved-modal" role="dialog" aria-modal="true" aria-labelledby="saved-modal-title">
        <div className="saved-modal-header">
          <div><span className="saved-modal-kicker">TUS PRODUCTOS</span><h2 id="saved-modal-title">Guardados <span>{offers.length}</span></h2></div>
          <button className="saved-modal-close" type="button" onClick={onClose} aria-label="Cerrar guardados" autoFocus><X size={19} /></button>
        </div>
        {offers.length === 0 ? (
          <div className="saved-empty"><Heart size={25} /><strong>Aún no guardaste ofertas</strong><p>Usa el corazón de cualquier producto y aparecerá aquí.</p></div>
        ) : (
          <div className="saved-offer-list">
            {offers.map((offer) => (
              <article className="saved-offer-row" key={offer.id}>
                <div className="saved-offer-image">{offer.image && <img src={offer.image} alt={offer.alt || offer.name} />}</div>
                <div className="saved-offer-details">
                  <span className="saved-offer-store">{offer.store}</span>
                  <h3>{offer.name}</h3>
                  <strong className="saved-offer-price">{offer.priceIsApproximate ? '≈ ' : ''}{formatPrice(offer.price, offer.currency)}</strong>
                  {offer.priceIsApproximate && <span className="saved-original-price">{formatPrice(offer.originalPrice, offer.originalCurrency)} en tienda · aproximado</span>}
                </div>
                <div className="saved-offer-actions">
                  {offer.url && <a className="saved-open-link" href={offer.url} target="_blank" rel="noopener noreferrer">Ver tienda <ArrowUpRight size={15} /></a>}
                  <button className="saved-remove-button" type="button" onClick={() => onRemove(offer)}><Trash2 size={15} /> Quitar</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ProductChat({ offer, productId, sessionId, onClose }) {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const researchStorageKey = `oferticas:assistant-research:${sessionId}:${productId}`
  const [researchContext, setResearchContext] = useState(() => {
    try { return JSON.parse(window.sessionStorage.getItem(researchStorageKey) || 'null') } catch { return null }
  })
  const remainingKey = `oferticas:assistant-remaining:${sessionId}:${productId}`
  const [remaining, setRemaining] = useState(() => {
    try {
      const saved = window.sessionStorage.getItem(remainingKey)
      return saved === null ? 3 : Math.max(0, Math.min(3, Number(saved) || 0))
    } catch { return 3 }
  })
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const cleanQuestion = question.trim()
    if (!cleanQuestion || loading || cleanQuestion.length > 300 || remaining <= 0) return
    setLoading(true)
    setQuestion('')
    setMessages((items) => [...items, { role: 'user', text: cleanQuestion }])
    try {
      const response = await fetch('/api/products/ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, productName: offer.name, assistantContext: offer.assistantContext, researchContext, question: cleanQuestion, sessionId }),
      })
      const data = await response.json()
      if (Number.isInteger(data.questionsRemaining)) setRemaining(data.questionsRemaining)
      if (!response.ok) throw new Error(data.error || 'No se pudo responder. Inténtalo de nuevo.')
      setRemaining(data.questionsRemaining)
      if (data.researchContext) setResearchContext(data.researchContext)
      setMessages((items) => [...items, { role: 'assistant', text: data.answer, sources: data.sources || [] }])
    } catch (error) {
      setMessages((items) => [...items, { role: 'error', text: error.message || 'No se pudo consultar el asistente.' }])
    } finally { setLoading(false) }
  }

  useEffect(() => {
    try { window.sessionStorage.setItem(remainingKey, String(remaining)) } catch { /* The server still enforces the limit. */ }
  }, [remaining, remainingKey])

  useEffect(() => {
    try {
      if (researchContext) window.sessionStorage.setItem(researchStorageKey, JSON.stringify(researchContext))
      else window.sessionStorage.removeItem(researchStorageKey)
    } catch { /* The server still verifies any research context sent by the client. */ }
  }, [researchContext, researchStorageKey])

  useEffect(() => {
    function handleKey(event) { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return <div className="chat-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="product-chat" role="dialog" aria-modal="true" aria-labelledby="chat-title">
      <header className="product-chat-header"><span className="chat-icon"><MessageCircle size={18} /></span><div><h2 id="chat-title">Sobre este producto</h2><p>{offer.name}</p></div><button type="button" onClick={onClose} aria-label="Cerrar asistente"><X size={18} /></button></header>
      <div className="chat-context-note">Respuestas basadas solo en los datos disponibles de esta oferta.</div>
      <div className="chat-messages" aria-live="polite">
        {messages.length === 0 && <div className="chat-welcome">¿Qué quieres saber sobre este producto?<span>Máximo 3 preguntas · hasta 300 caracteres</span></div>}
        {messages.map((message, index) => <div key={`${index}-${message.role}`} className={`chat-message chat-message-${message.role}`}><p>{message.text}</p>{message.sources?.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">Fuente: {source.name} ↗</a>)}</div>)}
        {loading && <div className="chat-message chat-message-assistant"><span className="loading-spinner" /> Pensando…</div>}
      </div>
      <footer className="chat-footer"><div className="chat-counter">{remaining}/3 preguntas disponibles</div><form onSubmit={submit}><textarea value={question} maxLength={300} onChange={(event) => setQuestion(event.target.value)} placeholder={remaining ? 'Escribe una pregunta…' : 'No quedan preguntas'} disabled={loading || remaining === 0} aria-label="Pregunta sobre el producto" /><div className="chat-compose-bottom"><span>{question.length}/300</span><button type="submit" disabled={loading || !question.trim() || question.length > 300 || remaining === 0} aria-label="Enviar pregunta"><Send size={16} /> Preguntar</button></div></form></footer>
    </section>
  </div>
}

export default function App() {
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [market, setMarket] = useState('cr')
  const [sort, setSort] = useState('Precio: menor a mayor')
  const [showSort, setShowSort] = useState(false)
  const [savedOffers, setSavedOffers] = useState(readSavedOffers)
  const [savedOpen, setSavedOpen] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [notice, setNotice] = useState('')
  const [searchState, setSearchState] = useState('idle')
  const [searchError, setSearchError] = useState('')
  const [offersState, setOffersState] = useState([])
  const [selectedStores, setSelectedStores] = useState([])
  const [unavailableSources, setUnavailableSources] = useState([])
  const [requestId, setRequestId] = useState(0)
  const [lastQuery, setLastQuery] = useState('')
  const [chatOffer, setChatOffer] = useState(null)
  const [assistantPromptDismissed, setAssistantPromptDismissed] = useState(false)
  const [assistantSessionId] = useState(() => {
    const key = 'oferticas:assistant-session'
    let id = window.sessionStorage.getItem(key)
    if (!id) {
      id = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
      window.sessionStorage.setItem(key, id)
    }
    return id
  })

  const availableStores = useMemo(() => {
    const counts = new Map()
    for (const offer of offersState) counts.set(offer.store, (counts.get(offer.store) || 0) + 1)
    return [...counts].sort(([storeA], [storeB]) => storeA.localeCompare(storeB, 'es-CR'))
  }, [offersState])
  const visibleOffers = useMemo(() => [...offersState]
    .filter((offer) => selectedStores.length === 0 || selectedStores.includes(offer.store))
    .sort((a, b) => sort === 'Precio: mayor a menor' ? b.price - a.price : a.price - b.price), [sort, offersState, selectedStores])
  const convertedOffer = visibleOffers.find((offer) => offer.priceIsApproximate)
  const exchangeRateDate = convertedOffer?.exchangeRateDate
    ? new Date(`${convertedOffer.exchangeRateDate}T12:00:00Z`).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : ''

  function submitSearch(nextQuery = query, nextMarket = market) {
    const cleaned = nextQuery.trim()
    if (!cleaned) {
      setNotice('Escribe el nombre de un producto para comenzar.')
      window.setTimeout(() => setNotice(''), 3000)
      return
    }
    setQuery(cleaned)
    setSubmittedQuery(cleaned)
    setLastQuery(cleaned)
    setSelectedStores([])
    setChatOffer(null)
    setAssistantPromptDismissed(false)
    const currentRequestId = requestId + 1
    setRequestId(currentRequestId)
    setSearchState('loading')
    setSearchError('')
    setUnavailableSources([])
    fetch('/api/products/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: cleaned, market: nextMarket, sessionId: assistantSessionId }),
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'No se pudo realizar la búsqueda.')
        if (currentRequestId !== requestId + 1) return
        setOffersState(data.offers || [])
        setUnavailableSources(data.unavailableSources || [])
        setSearchState('success')
      })
      .catch((error) => {
        if (currentRequestId !== requestId + 1) return
        setSearchError(error.message || 'No se pudieron consultar precios en este momento.')
        setSearchState('error')
      })
    window.scrollTo({ top: document.querySelector('#ofertas')?.offsetTop - 20 || 0, behavior: 'smooth' })
  }

  function changeMarket(nextMarket) {
    if (nextMarket === market) return
    setMarket(nextMarket)
    if (lastQuery) submitSearch(lastQuery, nextMarket)
    else {
      setOffersState([])
      setSearchState('idle')
      setSubmittedQuery('')
      setSearchError('')
    }
  }

  const closeSaved = () => setSavedOpen(false)

  function updateSavedOffers(next) {
    setSavedOffers(next)
    try {
      window.localStorage.setItem('oferticas:saved-offers', JSON.stringify(next))
    } catch {
      setNotice('No se pudieron guardar los cambios en este dispositivo.')
      window.setTimeout(() => setNotice(''), 3000)
    }
  }

  function toggleSave(offer) {
    const isSaved = savedOffers.some((item) => item.id === offer.id)
    const next = isSaved
      ? savedOffers.filter((item) => item.id !== offer.id)
      : [...savedOffers, offer]
    updateSavedOffers(next)
    setNotice(isSaved ? 'Oferta quitada de guardados.' : 'Oferta guardada en este dispositivo.')
    window.setTimeout(() => setNotice(''), 2600)
  }

  function removeSavedOffer(offer) {
    updateSavedOffers(savedOffers.filter((item) => item.id !== offer.id))
    setNotice('Oferta quitada de guardados.')
    window.setTimeout(() => setNotice(''), 2600)
  }

  return (
    <div id="inicio" className="app-shell">
      <div className="demo-ribbon"><span className="demo-dot" /> COMPARADOR DE TECNOLOGÍA <span className="ribbon-divider">/</span> COSTA RICA Y ESTADOS UNIDOS</div>
      <header className="site-header">
        <div className="header-inner">
          <Logo />
          <nav className={`main-nav ${mobileMenu ? 'nav-open' : ''}`} aria-label="Navegación principal">
            <a className="nav-active" href="#ofertas" onClick={() => setMobileMenu(false)}>Explorar</a>
            <a href="#como-funciona" onClick={() => setMobileMenu(false)}>Cómo funciona</a>
            <a href="#ofertas" onClick={() => setMobileMenu(false)}>Tiendas</a>
          </nav>
          <div className="header-actions">
          <button className="saved-link" onClick={() => setSavedOpen(true)} type="button"><Heart size={17} /> <span>Guardados</span>{savedOffers.length > 0 && <b>{savedOffers.length}</b>}</button>
            <button className="mobile-menu" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Abrir menú" type="button">{mobileMenu ? <X /> : <Menu />}</button>
            <div className="market-switch" role="group" aria-label="Mercado de búsqueda">
              <button className={market === 'cr' ? 'market-active' : ''} onClick={() => changeMarket('cr')} type="button"><span>🇨🇷</span> Costa Rica</button>
              <button className={market === 'us' ? 'market-active' : ''} onClick={() => changeMarket('us')} type="button"><span>🇺🇸</span> Estados Unidos</button>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-decor hero-decor-one" /><div className="hero-decor hero-decor-two" />
          <div className="hero-inner">
            <div className="hero-copy">
              <div className="hero-kicker"><span className="kicker-spark">✳</span> COMPRAR MEJOR, ASÍ DE SIMPLE</div>
              <h1>El mismo producto.<br /><span>Un mejor precio.</span></h1>
              <p className="hero-description">{market === 'cr' ? 'Comparamos precios de tiendas costarricenses. Si publican en dólares, mostramos una referencia aproximada en colones.' : 'Comparamos precios de tecnología en Estados Unidos, en dólares.'}</p>
              <div className="market-switch hero-market-switch" role="group" aria-label="Mercado de búsqueda">
                <button className={market === 'cr' ? 'market-active' : ''} onClick={() => changeMarket('cr')} type="button"><span>🇨🇷</span> Costa Rica <small>CRC</small></button>
                <button className={market === 'us' ? 'market-active' : ''} onClick={() => changeMarket('us')} type="button"><span>🇺🇸</span> Estados Unidos <small>USD</small></button>
              </div>
              <div className="hero-search"><SearchBox query={query} setQuery={setQuery} onSearch={() => submitSearch()} /></div>
              <div className="hero-trust"><span><ShieldCheck size={15} /> {market === 'cr' ? 'Tiendas costarricenses' : 'Resultados de Google Shopping'}</span><i /><span>{market === 'cr' ? 'CRC y referencia USD→CRC' : 'Precios en USD'}</span></div>
            </div>
            <div className="hero-visual-spacer" aria-hidden="true" />
          </div>
          <div className="hero-bottom"><span>COMPARA CON CONFIANZA</span><span className="hero-bottom-line" /><span>PRECIOS QUE HACEN SENTIDO</span></div>
        </section>

        <section className="results-section" id="ofertas">
          <div className="results-container">
            <div className="results-heading">
              <div>
                {submittedQuery && <><div className="section-kicker"><span /> {market === 'cr' ? 'COSTA RICA · CRC' : 'ESTADOS UNIDOS · USD'}</div>
                <h2>Resultados para <span>“{submittedQuery}”</span></h2>
                <p className="results-subtitle">{visibleOffers.length} resultados encontrados</p>
                {convertedOffer && <p className="conversion-disclaimer">iCon e iShop publican el precio en USD. El CRC es aproximado con la tasa de venta de referencia (₡{convertedOffer.exchangeRate.toFixed(2)} por USD, {exchangeRateDate}); el comercio puede aplicar otra tasa.</p>}</>}
              </div>
              {visibleOffers.length > 0 && <div className="sort-area">
                <span>Ordenar por</span>
                <div className="sort-wrap">
                  <button className="sort-button" onClick={() => setShowSort(!showSort)} type="button"><ArrowDownUp size={15} /> {sort} <ChevronDown size={14} /></button>
                  {showSort && <div className="sort-menu">{['Precio: menor a mayor', 'Precio: mayor a menor'].map((option) => <button key={option} onClick={() => { setSort(option); setShowSort(false) }} type="button">{option}{sort === option && <Check size={14} />}</button>)}</div>}
                </div>
              </div>}
            </div>

            {searchState === 'success' && availableStores.length > 0 && <div className="store-filter" role="group" aria-label="Filtrar resultados por tienda">
              <span className="store-filter-label">Tiendas</span>
              <div className="store-filter-options">
                <button className={`store-filter-chip ${selectedStores.length === 0 ? 'selected' : ''}`} type="button" aria-pressed={selectedStores.length === 0} onClick={() => setSelectedStores([])}>
                  Todas <small>{offersState.length}</small>
                </button>
                {availableStores.map(([store, count]) => {
                  const selected = selectedStores.includes(store)
                  return <button key={store} className={`store-filter-chip ${selected ? 'selected' : ''}`} type="button" aria-pressed={selected} onClick={() => setSelectedStores((current) => selected ? current.filter((item) => item !== store) : [...current, store])}>
                    {store} <small>{count}</small>
                  </button>
                })}
              </div>
            </div>}

            {searchState === 'loading' && <div className="search-state"><span className="loading-spinner" />Buscando precios…</div>}
            {searchState === 'error' && <div className="search-state error-state">{searchError}</div>}
            {searchState === 'success' && unavailableSources.length > 0 && <div className="source-warning">Sin respuesta en esta búsqueda: {unavailableSources.join(', ')}. Se muestran los resultados de las demás tiendas.</div>}
            {searchState !== 'loading' && searchState !== 'error' && visibleOffers.length > 0 && <div className="offer-grid">
              {visibleOffers.map((offer, index) => <OfferCard key={offer.id} offer={offer} index={index} saved={savedOffers.some((item) => item.id === offer.id)} onSave={toggleSave} />)}
            </div>}
            {searchState !== 'loading' && searchState !== 'error' && submittedQuery && visibleOffers.length === 0 && (offersState.length > 0
              ? <div className="search-state">No hay resultados de las tiendas seleccionadas. <button className="store-filter-reset" type="button" onClick={() => setSelectedStores([])}>Mostrar todas las tiendas</button></div>
              : <div className="search-state">No encontramos ofertas con precio y enlace verificables en {market === 'cr' ? 'tiendas costarricenses.' : 'Estados Unidos.'} Prueba otro nombre o modelo.</div>)}

            {submittedQuery && <><div className="more-results"><div className="more-rule" /><span>FIN DE RESULTADOS</span><div className="more-rule" /></div>
            <div className="search-again"><div className="search-again-icon"><CircleHelp size={19} /></div><div><strong>¿No encontraste lo que buscabas?</strong><span>Prueba con otra marca o modelo más específico.</span></div><button onClick={() => { document.querySelector('.hero-search input')?.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }) }} type="button">Nueva búsqueda <ArrowRight size={15} /></button></div></>}
          </div>
        </section>

        <section className="how-section" id="como-funciona">
          <div className="how-container">
            <div className="how-heading"><span className="section-kicker"><span /> SIN COMPLICACIONES</span><h2>Comprar mejor tiene <span>su ciencia.</span></h2><p>Bueno, en realidad es muy fácil.</p></div>
            <div className="steps-grid">
              <div className="step-card"><span className="step-number">01</span><span className="step-icon"><Search size={20} /></span><h3>Busca lo que quieres</h3><p>Escribe el nombre, marca o modelo del producto que tienes en mente.</p><span className="step-arrow">↗</span></div>
              <div className="step-card"><span className="step-number">02</span><span className="step-icon"><ArrowDownUp size={20} /></span><h3>Compara en segundos</h3><p>Reunimos las ofertas y ponemos primero el mejor precio.</p><span className="step-arrow">↗</span></div>
              <div className="step-card"><span className="step-number">03</span><span className="step-icon"><BadgeCheck size={20} /></span><h3>Elige con confianza</h3><p>Revisa la tienda, los detalles y ve directo a la oferta.</p><span className="step-arrow">↗</span></div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer"><div className="footer-inner"><Logo /><p>Menos buscar. Más encontrar.</p><span>HECHO CON <span className="footer-heart">♥</span> EN COSTA RICA · 2026</span></div></footer>
      {savedOpen && <SavedOffersModal offers={savedOffers} onClose={closeSaved} onRemove={removeSavedOffer} />}
      {searchState === 'success' && visibleOffers.length > 0 && !chatOffer && !assistantPromptDismissed && <aside className="assistant-cta" aria-label="Asistente sobre el producto"><button className="assistant-cta-close" type="button" onClick={() => setAssistantPromptDismissed(true)} aria-label="Cerrar sugerencia"><X size={15} /></button><div><span className="assistant-cta-icon"><MessageCircle size={18} /></span><span><strong>¿Tienes dudas?</strong><small>Pregunta sobre {visibleOffers[0].name}.</small></span></div><button className="assistant-cta-action" type="button" onClick={() => setChatOffer(visibleOffers[0])}>Consultar producto <ArrowRight size={15} /></button></aside>}
      {chatOffer && <ProductChat key={`${chatOffer.id}-${submittedQuery}`} offer={chatOffer} productId={`${market}:${submittedQuery}:${chatOffer.id}`} sessionId={assistantSessionId} onClose={() => setChatOffer(null)} />}
      {notice && <div className="toast" role="status"><Check size={16} />{notice}</div>}
    </div>
  )
}
