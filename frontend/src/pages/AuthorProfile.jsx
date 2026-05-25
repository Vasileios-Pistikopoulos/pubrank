import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Line } from 'react-chartjs-2'
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js'
import { getAuthorProfile } from '../api/client'

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

export default function AuthorProfile() {
  const { id } = useParams()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAuthorProfile(id).then(r => { setData(r.data); setLoading(false) })
  }, [id])

  if (!loading && !data) return <p>Not found.</p>

  const { summary, per_year } = data ?? {}

  const chartData = !loading ? {
    labels: per_year.map(r => r.year),
    datasets: [
      { label: 'Total',     data: per_year.map(r => r.total_papers),   borderColor: '#1a1a2e', tension: 0.3, fill: false },
      { label: 'Conference',data: per_year.map(r => r.conf_papers),    borderColor: '#e94560', tension: 0.3, fill: false },
      { label: 'Journal',   data: per_year.map(r => r.journal_papers), borderColor: '#06b6d4', tension: 0.3, fill: false },
    ],
  } : null

  return (
    <div>
      <p><Link to="/authors">← Authors</Link></p>

      {loading ? (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="spinner-wrap"><div className="spinner" /></div>
        </div>
      ) : (
        <>
          <h1>{summary?.name}</h1>

          <div className="stats-grid">
            {[
              ['First Year',           summary?.first_year],
              ['Last Year',            summary?.last_year],
              ['Total Papers',         summary?.total_papers],
              ['Active Years',         summary?.active_years],
              ['Avg Papers/Active Yr', summary?.avg_papers_per_active_year],
            ].map(([label, value]) => (
              <div className="stat-box" key={label}>
                <div className="value">{value ?? '—'}</div>
                <div className="label">{label}</div>
              </div>
            ))}
          </div>

          <div className="chart-wrap">
            <h2>Papers per year</h2>
            <Line data={chartData} options={{ responsive: true, plugins: { legend: { position: 'top' } } }} />
          </div>
        </>
      )}
    </div>
  )
}
