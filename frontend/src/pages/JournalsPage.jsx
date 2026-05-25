import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJournals } from '../api/client'
import { useInfiniteScroll, ScrollSentinel } from '../components/Pagination'

export default function JournalsPage() {
  const [data, setData]           = useState([])
  const [search, setSearch]       = useState('')
  const [hasPapers, setHasPapers] = useState(false)

  useEffect(() => {
    const params = hasPapers ? { has_papers: 1 } : {}
    getJournals(params).then(r => setData(r.data))
  }, [hasPapers])

  const filtered = data.filter(j =>
    j.title?.toLowerCase().includes(search.toLowerCase()) ||
    j.publisher?.toLowerCase().includes(search.toLowerCase())
  )

  const { visible, sentinelRef, hasMore, showing, total } = useInfiniteScroll(filtered)

  return (
    <div>
      <h1>Journals</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '0.5rem' }}>
        <input className="search-input" style={{ marginBottom: 0 }} placeholder="Search by title or publisher…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={hasPapers} onChange={e => setHasPapers(e.target.checked)} />
          Only journals with papers
        </label>
      </div>
      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
        {total} results{hasMore ? ` — showing ${showing}` : ''}
      </p>
      <div className="card">
        <table>
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
      </div>
      {hasMore && <ScrollSentinel sentinelRef={sentinelRef} />}
    </div>
  )
}
