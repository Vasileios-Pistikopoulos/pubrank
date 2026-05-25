import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getYearProfile, getConferences, getJournals, searchAuthors } from '../api/client'
import { useInfiniteScroll, ScrollSentinel } from '../components/Pagination'

function VenueSearch({ label, placeholder, onSelect, onClear }) {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState([])
  const [selected, setSelected] = useState(null)
  const [open, setOpen]         = useState(false)
  const ref = useRef()

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = item => {
    setSelected(item)
    setQuery(item.label)
    setOpen(false)
    onSelect(item.id)
  }

  const handleClear = () => {
    setSelected(null)
    setQuery('')
    setResults([])
    onClear()
  }

  return (
    <label style={{ position: 'relative' }} ref={ref}>
      {label}
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          value={query}
          placeholder={placeholder}
          style={{ width: 200 }}
          onChange={e => {
            setQuery(e.target.value)
            setOpen(true)
            if (!e.target.value) { setResults([]); onClear() }
          }}
          onFocus={() => query && setOpen(true)}
        />
        {selected && (
          <button type="button" className="btn" style={{ background: '#888', padding: '0.3rem 0.6rem' }}
            onClick={handleClear}>✕</button>
        )}
      </div>
      {open && results.length > 0 && (
        <ul style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 200,
          background: 'white', border: '1px solid #ccc', borderRadius: 4,
          listStyle: 'none', margin: 0, padding: 0,
          maxHeight: 220, overflowY: 'auto', minWidth: 260, boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          {results.map(item => (
            <li key={item.id}
              style={{ padding: '0.4rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem' }}
              onMouseDown={() => handleSelect(item)}>
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </label>
  )
}

function ConferenceSearch({ onSelect, onClear }) {
  const [all, setAll] = useState([])
  useEffect(() => { getConferences().then(r => setAll(r.data)) }, [])

  return (
    <VenueSearchFiltered
      label="Conference" placeholder="Search conference…"
      items={all.map(c => ({ id: c.conference_id, label: `${c.acronym} — ${c.title}` }))}
      onSelect={onSelect} onClear={onClear}
    />
  )
}

function JournalSearch({ onSelect, onClear }) {
  const [all, setAll] = useState([])
  useEffect(() => { getJournals().then(r => setAll(r.data)) }, [])

  return (
    <VenueSearchFiltered
      label="Journal" placeholder="Search journal…"
      items={all.map(j => ({ id: j.journal_id, label: j.title }))}
      onSelect={onSelect} onClear={onClear}
    />
  )
}

function VenueSearchFiltered({ label, placeholder, items, onSelect, onClear }) {
  const [query, setQuery]       = useState('')
  const [selected, setSelected] = useState(null)
  const [open, setOpen]         = useState(false)
  const ref = useRef()

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = query.length >= 1
    ? items.filter(i => i.label.toLowerCase().includes(query.toLowerCase())).slice(0, 30)
    : []

  const handleSelect = item => {
    setSelected(item)
    setQuery(item.label)
    setOpen(false)
    onSelect(item.id)
  }

  const handleClear = () => {
    setSelected(null)
    setQuery('')
    onClear()
  }

  return (
    <label style={{ position: 'relative' }} ref={ref}>
      {label}
      <div style={{ display: 'flex', gap: 4 }}>
        <input value={query} placeholder={placeholder} style={{ width: 220 }}
          onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) { onClear(); setSelected(null) } }}
          onFocus={() => setOpen(true)} />
        {selected && (
          <button type="button" className="btn" style={{ background: '#888', padding: '0.3rem 0.6rem' }}
            onClick={handleClear}>✕</button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <ul style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 200,
          background: 'white', border: '1px solid #ccc', borderRadius: 4,
          listStyle: 'none', margin: 0, padding: 0,
          maxHeight: 220, overflowY: 'auto', minWidth: 260, boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          {filtered.map(item => (
            <li key={item.id}
              style={{ padding: '0.4rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem' }}
              onMouseDown={() => handleSelect(item)}>
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </label>
  )
}

function AuthorSearch({ onSelect, onClear }) {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState([])
  const [selected, setSelected] = useState(null)
  const [open, setOpen]         = useState(false)
  const ref = useRef()

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const t = setTimeout(() => {
      searchAuthors(query).then(r => setResults(r.data))
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const handleSelect = item => {
    setSelected(item)
    setQuery(item.name)
    setOpen(false)
    onSelect(item.author_id)
  }

  const handleClear = () => {
    setSelected(null)
    setQuery('')
    setResults([])
    onClear()
  }

  return (
    <label style={{ position: 'relative' }} ref={ref}>
      Author
      <div style={{ display: 'flex', gap: 4 }}>
        <input value={query} placeholder="Search author…" style={{ width: 200 }}
          onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) { onClear(); setSelected(null) } }}
          onFocus={() => query.length >= 2 && setOpen(true)} />
        {selected && (
          <button type="button" className="btn" style={{ background: '#888', padding: '0.3rem 0.6rem' }}
            onClick={handleClear}>✕</button>
        )}
      </div>
      {open && results.length > 0 && (
        <ul style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 200,
          background: 'white', border: '1px solid #ccc', borderRadius: 4,
          listStyle: 'none', margin: 0, padding: 0,
          maxHeight: 220, overflowY: 'auto', minWidth: 260, boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          {results.map(a => (
            <li key={a.author_id}
              style={{ padding: '0.4rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem' }}
              onMouseDown={() => handleSelect(a)}>
              {a.name}
            </li>
          ))}
        </ul>
      )}
    </label>
  )
}

export default function YearProfile() {
  const { year } = useParams()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState({ conference_id: '', journal_id: '', author_id: '' })

  const load = (f = filter) => {
    const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v))
    setLoading(true)
    getYearProfile(year, params).then(r => { setData(r.data); setLoading(false) })
  }

  useEffect(() => { load({}) }, [year])

  if (!loading && !data) return <p>Not found.</p>

  const { summary, papers } = data ?? {}
  const { visible: visiblePapers, sentinelRef: paperSentinel, hasMore: papersHasMore } = useInfiniteScroll(papers ?? [])

  return (
    <div>
      <p><Link to="/years">← Years</Link></p>
      <h1>Year {year}</h1>

      {loading ? (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="spinner-wrap"><div className="spinner" /></div>
        </div>
      ) : (
        <>
          <div className="stats-grid">
            {[
              ['Total Papers',     summary?.total_papers?.toLocaleString()],
              ['Conferences',      summary?.distinct_conferences],
              ['Journals',         summary?.distinct_journals],
              ['Total Authors',    summary?.total_author_appearances?.toLocaleString()],
              ['Distinct Authors', summary?.distinct_authors?.toLocaleString()],
            ].map(([label, value]) => (
              <div className="stat-box" key={label}>
                <div className="value">{value ?? '—'}</div>
                <div className="label">{label}</div>
              </div>
            ))}
          </div>

          <div className="filter-bar">
            <ConferenceSearch
              onSelect={id => setFilter(f => ({ ...f, conference_id: id, journal_id: '' }))}
              onClear={() => setFilter(f => ({ ...f, conference_id: '' }))}
            />
            <JournalSearch
              onSelect={id => setFilter(f => ({ ...f, journal_id: id, conference_id: '' }))}
              onClear={() => setFilter(f => ({ ...f, journal_id: '' }))}
            />
            <AuthorSearch
              onSelect={id => setFilter(f => ({ ...f, author_id: id }))}
              onClear={() => setFilter(f => ({ ...f, author_id: '' }))}
            />
            <button className="btn" onClick={() => load(filter)}>Filter</button>
            <button className="btn" style={{ background: '#888' }} onClick={() => {
              setFilter({ conference_id: '', journal_id: '', author_id: '' })
              load({})
            }}>Reset</button>
          </div>

          <h2>Papers ({papers.length})</h2>
          <div className="card">
            <table>
              <thead><tr><th>Type</th><th>Venue</th><th>Title</th><th>Authors</th></tr></thead>
              <tbody>
                {visiblePapers.map(p => (
                  <tr key={p.paper_id}>
                    <td><span className="badge">{p.paper_type}</span></td>
                    <td>{p.venue}</td>
                    <td>{p.url ? <a href={p.url} target="_blank" rel="noreferrer">{p.title}</a> : p.title}</td>
                    <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.authors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {papersHasMore && <ScrollSentinel sentinelRef={paperSentinel} />}
        </>
      )}
    </div>
  )
}
