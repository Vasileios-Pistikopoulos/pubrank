import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getConferences } from '../api/client'

const rankClass = r => r === 'A*' ? 'a-star' : r === 'A' ? 'a' : r === 'B' ? 'b' : r === 'C' ? 'c' : ''

export default function ConferencesPage() {
  const [data, setData]     = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => { getConferences().then(r => setData(r.data)) }, [])

  const filtered = data.filter(c =>
    c.acronym?.toLowerCase().includes(search.toLowerCase()) ||
    c.title?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <h1>Conferences</h1>
      <input className="search-input" placeholder="Search by name or acronym…"
        value={search} onChange={e => setSearch(e.target.value)} />
      <div className="card">
        <table>
          <thead><tr>
            <th>Acronym</th><th>Title</th><th>Rank</th><th>Field of Research</th>
          </tr></thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.conference_id}>
                <td><Link to={`/conferences/${c.conference_id}`}>{c.acronym}</Link></td>
                <td>{c.title}</td>
                <td><span className={`badge ${rankClass(c.rank)}`}>{c.rank || '—'}</span></td>
                <td>{c.for_description || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
