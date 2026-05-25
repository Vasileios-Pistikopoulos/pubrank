import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { getJournals, searchJournals } from '../api/client'
import { useInfiniteScroll, ScrollSentinel } from '../components/Pagination'
import EmptyState from '../components/EmptyState'

export default function JournalsPage() {
  const [data, setData]           = useState([])
  const [search, setSearch]       = useState('')
  const [hasPapers, setHasPapers] = useState(false)
  const [showSugg,    setShowSugg]    = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const ref = useRef()

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setShowSugg(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    const params = hasPapers ? { has_papers: 1 } : {}
    getJournals(params).then(r => setData(r.data))
  }, [hasPapers])

  useEffect(() => {
    if (!search.trim()) { setSuggestions([]); setShowSugg(false); return }
    const t = setTimeout(() => {
      searchJournals(search).then(r => { setSuggestions(r.data.slice(0, 8)); setShowSugg(true) })
    }, 250)
    return () => clearTimeout(t)
  }, [search])

  const filtered = data.filter(j =>
    j.title?.toLowerCase().includes(search.toLowerCase()) ||
    j.publisher?.toLowerCase().includes(search.toLowerCase())
  )

  const { visible, sentinelRef, hasMore, showing, total } = useInfiniteScroll(filtered)

  return (
    <div>
      <h1>Journals</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '0.5rem' }}>
        <div style={{ position: 'relative' }} ref={ref}>
          <input className="search-input" style={{ marginBottom: 0 }} placeholder="Search by title or publisher…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => suggestions.length && setShowSugg(true)} />
          {showSugg && suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 100,
              background: 'white', border: '1px solid #ccc',
              borderRadius: 6, minWidth: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              maxHeight: 240, overflowY: 'auto',
            }}>
              {suggestions.map(j => (
                <div key={j.journal_id}
                  style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #eee', fontSize: '0.9rem' }}
                  onMouseDown={() => { setSearch(j.title); setShowSugg(false) }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {j.title}
                </div>
              ))}
            </div>
          )}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={hasPapers} onChange={e => setHasPapers(e.target.checked)} />
          Only journals with papers
        </label>
      </div>
      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
        {total} results{hasMore ? ` — showing ${showing}` : ''}
      </p>
      <div className="card">
        {total === 0
          ? <EmptyState message="No journals match your search." />
          : <table>
              <thead><tr>
                <th>Rank</th><th>Title</th><th>Quartile</th><th>Publisher</th><th>Country</th><th>Subject Area</th>
              </tr></thead>
              <tbody>
                {visible.map(j => (
                  <tr key={j.journal_id}>
                    <td>{j.sjr_rank}</td>
                    <td><Link to={`/journals/${j.journal_id}`}>{j.title}</Link></td>
                    <td><span className="badge">{j.best_quartile || '—'}</span></td>
                    <td>{j.publisher || '—'}</td>
                    <td>{j.country || '—'}</td>
                    <td>{j.subject_area || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>
      {hasMore && <ScrollSentinel sentinelRef={sentinelRef} />}
    </div>
  )
}
