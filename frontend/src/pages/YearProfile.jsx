import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getYearProfile } from '../api/client'

export default function YearProfile() {
  const { year } = useParams()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState({ conference_id: '', journal_id: '', author_id: '' })

  const load = (f = {}) => {
    const params = Object.fromEntries(Object.entries(f).filter(([,v]) => v))
    setLoading(true)
    getYearProfile(year, params).then(r => { setData(r.data); setLoading(false) })
  }

  useEffect(() => { load() }, [year])

  if (loading) return <p>Loading…</p>
  if (!data)   return <p>Not found.</p>

  const { summary, papers } = data

  return (
    <div>
      <p><Link to="/years">← Years</Link></p>
      <h1>Year {year}</h1>

      <div className="stats-grid">
        {[
          ['Total Papers',    summary?.total_papers?.toLocaleString()],
          ['Conferences',     summary?.distinct_conferences],
          ['Journals',        summary?.distinct_journals],
          ['Distinct Authors',summary?.distinct_authors?.toLocaleString()],
        ].map(([label, value]) => (
          <div className="stat-box" key={label}>
            <div className="value">{value ?? '—'}</div>
            <div className="label">{label}</div>
          </div>
        ))}
      </div>

      <div className="filter-bar">
        <label>Conference ID <input style={{width:100}} value={filter.conference_id}
          onChange={e => setFilter(f => ({...f, conference_id: e.target.value}))} /></label>
        <label>Journal ID <input style={{width:100}} value={filter.journal_id}
          onChange={e => setFilter(f => ({...f, journal_id: e.target.value}))} /></label>
        <label>Author ID <input style={{width:100}} value={filter.author_id}
          onChange={e => setFilter(f => ({...f, author_id: e.target.value}))} /></label>
        <button className="btn" onClick={() => load(filter)}>Filter</button>
        <button className="btn" style={{background:'#888'}} onClick={() => { setFilter({conference_id:'',journal_id:'',author_id:''}); load() }}>Reset</button>
      </div>

      <h2>Papers ({papers.length})</h2>
      <div className="card">
        <table>
          <thead><tr><th>Type</th><th>Venue</th><th>Title</th><th>Authors</th></tr></thead>
          <tbody>
            {papers.map(p => (
              <tr key={p.paper_id}>
                <td><span className="badge">{p.paper_type}</span></td>
                <td>{p.venue}</td>
                <td>{p.url ? <a href={p.url} target="_blank" rel="noreferrer">{p.title}</a> : p.title}</td>
                <td style={{maxWidth:280, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{p.authors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
