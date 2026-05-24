import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJournals } from '../api/client'

export default function JournalsPage() {
  const [data, setData]     = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => { getJournals().then(r => setData(r.data)) }, [])

  const filtered = data.filter(j =>
    j.title?.toLowerCase().includes(search.toLowerCase()) ||
    j.publisher?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <h1>Journals</h1>
      <input className="search-input" placeholder="Search by title or publisher…"
        value={search} onChange={e => setSearch(e.target.value)} />
      <div className="card">
        <table>
          <thead><tr>
            <th>Rank</th><th>Title</th><th>Quartile</th><th>Publisher</th><th>Country</th><th>Subject Area</th>
          </tr></thead>
          <tbody>
            {filtered.map(j => (
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
    </div>
  )
}
