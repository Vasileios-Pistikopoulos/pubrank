import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { searchAuthors } from '../api/client'
import EmptyState from '../components/EmptyState'

export default function AuthorsPage() {
  const [query,       setQuery]       = useState('')
  const [results,     setResults]     = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [showSugg,    setShowSugg]    = useState(false)
  const [searched,    setSearched]    = useState(false)
  const ref = useRef()

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setShowSugg(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!query.trim()) { setSuggestions([]); setShowSugg(false); return }
    const t = setTimeout(() => {
      searchAuthors(query).then(r => {
        setSuggestions(r.data.slice(0, 8))
        setShowSugg(true)
      })
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const search = () => {
    if (!query.trim()) return
    setShowSugg(false)
    searchAuthors(query).then(r => { setResults(r.data); setSearched(true) })
  }

  return (
    <div>
      <h1>Authors</h1>
      <div className="filter-bar">
        <label>Name
          <div style={{ position: 'relative' }} ref={ref}>
            <input value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              onFocus={() => suggestions.length && setShowSugg(true)}
              placeholder="e.g. Smith" style={{ width: 240 }} />
            {showSugg && suggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 100,
                background: '#1e1e2e', border: '1px solid #3a3a4a',
                borderRadius: 6, width: 240, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                maxHeight: 260, overflowY: 'auto'
              }}>
                {suggestions.map(a => (
                  <Link key={a.author_id} to={`/authors/${a.author_id}`}
                    style={{ display: 'block', padding: '0.5rem 0.75rem', color: '#cdd6f4',
                             textDecoration: 'none', borderBottom: '1px solid #3a3a4a' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#313244'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => setShowSugg(false)}
                  >
                    {a.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </label>
        <button className="btn" onClick={search}>Search</button>
      </div>

      {searched && (
        results.length === 0
          ? <div className="card"><EmptyState message="No authors found for this search." /></div>
          : <div className="card">
              <table>
                <thead><tr><th>Name</th></tr></thead>
                <tbody>
                  {results.map(a => (
                    <tr key={a.author_id}>
                      <td><Link to={`/authors/${a.author_id}`}>{a.name}</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      )}
    </div>
  )
}
