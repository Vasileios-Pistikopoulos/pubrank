import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Line } from 'react-chartjs-2'
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js'
import { getConferenceProfile, getConferencePapers } from '../api/client'

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

export default function ConferenceProfile() {
  const { id } = useParams()
  const [profile, setProfile] = useState(null)
  const [papers,  setPapers]  = useState([])
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo,   setYearTo]   = useState('')
  const [loading,  setLoading]  = useState(true)

  const load = (yf, yt) => {
    const params = yf && yt ? { year_from: yf, year_to: yt } : {}
    setLoading(true)
    Promise.all([
      getConferenceProfile(id, params),
      getConferencePapers(id, params),
    ]).then(([p, pap]) => {
      setProfile(p.data)
      setPapers(pap.data)
      setLoading(false)
    })
  }

  useEffect(() => { load('', '') }, [id])

  if (loading) return <p>Loading…</p>
  if (!profile) return <p>Not found.</p>

  const { info, stats, per_year } = profile

  const chartData = {
    labels: per_year.map(r => r.year),
    datasets: [
      { label: 'Papers',          data: per_year.map(r => r.paper_count),        borderColor: '#e94560', tension: 0.3, fill: false },
      { label: 'Total Authors',   data: per_year.map(r => r.total_author_appearances), borderColor: '#1a1a2e', tension: 0.3, fill: false },
      { label: 'Distinct Authors',data: per_year.map(r => r.distinct_authors),   borderColor: '#06b6d4', tension: 0.3, fill: false },
    ],
  }

  return (
    <div>
      <p><Link to="/conferences">← Conferences</Link></p>
      <h1>{info?.acronym} — {info?.title}</h1>
      <p style={{ color: '#888', marginBottom: '1rem' }}>
        Rank: <strong>{info?.rank || '—'}</strong> &nbsp;|&nbsp; {info?.for_description || ''}
      </p>

      <div className="stats-grid">
        {[
          ['First Year',          stats?.first_year],
          ['Last Year',           stats?.last_year],
          ['Total Papers',        stats?.total_papers?.toLocaleString()],
          ['Distinct Authors',    stats?.total_distinct_authors?.toLocaleString()],
          ['Avg Authors/Paper',   stats?.avg_authors_per_paper],
          ['Avg Papers/Year',     stats?.avg_papers_per_year],
        ].map(([label, value]) => (
          <div className="stat-box" key={label}>
            <div className="value">{value ?? '—'}</div>
            <div className="label">{label}</div>
          </div>
        ))}
      </div>

      <div className="filter-bar">
        <label>Year from <input type="number" value={yearFrom} onChange={e => setYearFrom(e.target.value)} placeholder="e.g. 2000" style={{width:100}} /></label>
        <label>Year to   <input type="number" value={yearTo}   onChange={e => setYearTo(e.target.value)}   placeholder="e.g. 2020" style={{width:100}} /></label>
        <button className="btn" onClick={() => load(yearFrom, yearTo)}>Apply</button>
        <button className="btn" style={{background:'#888'}} onClick={() => { setYearFrom(''); setYearTo(''); load('','') }}>Reset</button>
      </div>

      <div className="chart-wrap">
        <h2>Publications per year</h2>
        <Line data={chartData} options={{ responsive: true, plugins: { legend: { position: 'top' } } }} />
      </div>

      <h2>Papers ({papers.length})</h2>
      <div className="card">
        <table>
          <thead><tr><th>Year</th><th>Title</th><th>Authors</th><th>Pages</th></tr></thead>
          <tbody>
            {papers.map(p => (
              <tr key={p.paper_id}>
                <td>{p.year}</td>
                <td>{p.url ? <a href={p.url} target="_blank" rel="noreferrer">{p.title}</a> : p.title}</td>
                <td style={{maxWidth:300, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{p.authors}</td>
                <td>{p.pages}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
