import { useState, useEffect, useRef } from 'react'
import { Line, Bar, Scatter } from 'react-chartjs-2'
import {
  Chart, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Tooltip, Legend
} from 'chart.js'
import { getLinechart, getCategoryLinechart, getBarchart, getScatter, getScatterVenueYear,
         searchConferences, searchJournals, getCategories } from '../api/client'
import EmptyState from '../components/EmptyState'

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend)

const COLORS = ['#e94560','#1a1a2e','#06b6d4','#f59e0b','#10b981','#8b5cf6','#f43f5e','#0ea5e9']

// ---- Multi-venue autocomplete select ----
function MultiVenueSelect({ label, fetchFn, getLabel, getId, placeholder, onChange }) {
  const [query,       setQuery]       = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [selected,    setSelected]    = useState([])
  const [open,        setOpen]        = useState(false)
  const ref = useRef()

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (!query.trim()) { setSuggestions([]); setOpen(false); return }
    const t = setTimeout(() => {
      fetchFn(query).then(r => { setSuggestions(r.data.slice(0, 10)); setOpen(true) })
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const add = item => {
    const id = getId(item)
    if (selected.find(s => s.id === id)) { setQuery(''); setOpen(false); return }
    const next = [...selected, { id, label: getLabel(item) }]
    setSelected(next)
    onChange(next.map(s => s.id).join(','))
    setQuery(''); setSuggestions([]); setOpen(false)
  }

  const remove = id => {
    const next = selected.filter(s => s.id !== id)
    setSelected(next)
    onChange(next.map(s => s.id).join(','))
  }

  return (
    <label style={{ position: 'relative' }} ref={ref}>
      {label}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4,
        border: '1px solid #ccc', borderRadius: 4, padding: '4px 6px',
        background: 'white', minWidth: 200, marginTop: 4,
      }}>
        {selected.map(s => (
          <span key={s.id} style={{
            background: '#1a1a2e', color: 'white', borderRadius: 4,
            padding: '2px 8px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {s.label}
            <button type="button" onClick={() => remove(s.id)}
              style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: 0, fontSize: '1rem', lineHeight: 1 }}>×</button>
          </span>
        ))}
        <input value={query} onChange={e => setQuery(e.target.value)}
          onFocus={() => suggestions.length && setOpen(true)}
          placeholder={selected.length === 0 ? placeholder : ''}
          style={{ border: 'none', outline: 'none', background: 'transparent', color: '#222', minWidth: 100, flex: 1, fontSize: '0.9rem' }} />
      </div>
      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 100,
          background: 'white', border: '1px solid #ccc',
          borderRadius: 6, minWidth: 280, boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          maxHeight: 240, overflowY: 'auto',
        }}>
          {suggestions.map(s => (
            <div key={getId(s)} onMouseDown={() => add(s)}
              style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #eee', color: '#222', fontSize: '0.9rem' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {getLabel(s)}
            </div>
          ))}
        </div>
      )}
    </label>
  )
}

// ---- Line Chart ----
function LineChartPanel() {
  const [confIds,  setConfIds]  = useState('')
  const [jourIds,  setJourIds]  = useState('')
  const [metric,   setMetric]   = useState('paper_count')
  const [yearFrom, setYearFrom] = useState('2000')
  const [yearTo,   setYearTo]   = useState('2023')
  const [chartData, setChartData] = useState(null)

  const load = () => {
    getLinechart({ conf_ids: confIds, jour_ids: jourIds, metric, year_from: yearFrom, year_to: yearTo })
      .then(r => {
        const byLabel = {}
        r.data.forEach(row => {
          if (!byLabel[row.label]) byLabel[row.label] = []
          byLabel[row.label].push({ x: row.year, y: row.value })
        })
        const labels = [...new Set(r.data.map(r => r.year))].sort()
        const datasets = Object.entries(byLabel).map(([label, pts], i) => ({
          label,
          data: labels.map(yr => pts.find(p => p.x === yr)?.y ?? null),
          borderColor: COLORS[i % COLORS.length],
          tension: 0.3, fill: false,
        }))
        setChartData({ labels, datasets })
      })
  }

  return (
    <div className="card">
      <h2>Line Chart — Publications over time</h2>
      <div className="filter-bar">
        <MultiVenueSelect label="Conferences"
          fetchFn={searchConferences}
          getLabel={c => c.acronym ? `${c.acronym} — ${c.title}` : c.title}
          getId={c => c.conference_id}
          placeholder="Type to search…"
          onChange={setConfIds} />
        <MultiVenueSelect label="Journals"
          fetchFn={searchJournals}
          getLabel={j => j.title}
          getId={j => j.journal_id}
          placeholder="Type to search…"
          onChange={setJourIds} />
        <label>Metric
          <select value={metric} onChange={e => setMetric(e.target.value)}>
            <option value="paper_count">Papers</option>
            <option value="distinct_authors">Distinct Authors</option>
            <option value="total_author_appearances">Total Author Appearances</option>
            <option value="avg_authors_per_paper">Avg Authors/Paper</option>
          </select>
        </label>
        <label>From <input type="number" value={yearFrom} onChange={e => setYearFrom(e.target.value)} style={{width:80}} /></label>
        <label>To   <input type="number" value={yearTo}   onChange={e => setYearTo(e.target.value)}   style={{width:80}} /></label>
        <button className="btn" onClick={load}>Load</button>
      </div>
      {chartData && (
        chartData.labels.length === 0
          ? <EmptyState message="No data for the selected venues and period." />
          : <div className="chart-wrap">
              <Line data={chartData} options={{ responsive: true, plugins: { legend: { position: 'top' } } }} />
            </div>
      )}
    </div>
  )
}

// ---- Bar Chart ----
const QUARTILE_COLORS = ['#10b981','#06b6d4','#f59e0b','#e94560']

function BarChartPanel() {
  const [type,   setType]   = useState('conferences')
  const [metric, setMetric] = useState('total_papers')
  const [chartData, setChartData] = useState(null)

  const metricOptions = {
    conferences: [['total_papers','Total Papers'],['avg_papers_per_year','Avg Papers/Year'],['avg_authors_per_paper','Avg Authors/Paper']],
    journals:    [['total_papers','Total Papers'],['avg_papers_per_year','Avg Papers/Year'],['avg_authors_per_paper','Avg Authors/Paper']],
    publishers:  [['total_journals','Total Journals'],['quartiles','Journals per Quartile (Q1-Q4)']],
  }

  const load = () => {
    if (type === 'publishers' && metric === 'quartiles') {
      getBarchart({ type: 'publishers', metric: 'total_journals' }).then(r => {
        const labels = r.data.map(d => d.label)
        Promise.all([
          getBarchart({ type: 'publishers', metric: 'q1_count' }),
          getBarchart({ type: 'publishers', metric: 'q2_count' }),
          getBarchart({ type: 'publishers', metric: 'q3_count' }),
          getBarchart({ type: 'publishers', metric: 'q4_count' }),
        ]).then(([q1, q2, q3, q4]) => {
          const byLabel = row => Object.fromEntries(row.data.map(d => [d.label, d.value]))
          const m1 = byLabel(q1), m2 = byLabel(q2), m3 = byLabel(q3), m4 = byLabel(q4)
          setChartData({
            labels,
            datasets: [
              { label: 'Q1', data: labels.map(l => m1[l] ?? 0), backgroundColor: QUARTILE_COLORS[0] },
              { label: 'Q2', data: labels.map(l => m2[l] ?? 0), backgroundColor: QUARTILE_COLORS[1] },
              { label: 'Q3', data: labels.map(l => m3[l] ?? 0), backgroundColor: QUARTILE_COLORS[2] },
              { label: 'Q4', data: labels.map(l => m4[l] ?? 0), backgroundColor: QUARTILE_COLORS[3] },
            ],
          })
        })
      })
    } else {
      getBarchart({ type, metric }).then(r => {
        setChartData({
          labels: r.data.map(d => d.label),
          datasets: [{ label: metric, data: r.data.map(d => d.value), backgroundColor: '#1a1a2e99' }],
        })
      })
    }
  }

  const isMultiSeries = type === 'publishers' && metric === 'quartiles'

  return (
    <div className="card">
      <h2>Bar Chart</h2>
      <div className="filter-bar">
        <label>Type
          <select value={type} onChange={e => { setType(e.target.value); setMetric(metricOptions[e.target.value][0][0]) }}>
            <option value="conferences">Conferences</option>
            <option value="journals">Journals</option>
            <option value="publishers">Publishers</option>
          </select>
        </label>
        <label>Metric
          <select value={metric} onChange={e => setMetric(e.target.value)}>
            {metricOptions[type].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <button className="btn" onClick={load}>Load</button>
      </div>
      {chartData && (
        chartData.labels.length === 0
          ? <EmptyState message="No data available." />
          : <div className="chart-wrap">
              <Bar data={chartData} options={{
                responsive: true,
                plugins: { legend: { display: isMultiSeries, position: 'top' } },
                scales: { x: { stacked: false }, y: { beginAtZero: true } },
              }} />
            </div>
      )}
    </div>
  )
}

// ---- Scatter Plot ----
const SCATTER_FIELDS = [
  ['sjr','SJR'],['cite_score','Cite Score'],['h_index','H-index'],
  ['total_docs','Total Docs'],['total_docs_3y','Total Docs 3y'],
  ['total_refs','Total Refs'],['total_cites_3y','Total Cites 3y'],
  ['cites_per_doc_2y','Cites/Doc 2y'],['refs_per_doc','Refs/Doc'],
]

function ScatterPanel() {
  const [xField, setXField] = useState('sjr')
  const [yField, setYField] = useState('cite_score')
  const [chartData, setChartData] = useState(null)

  const load = () => {
    getScatter({ x: xField, y: yField }).then(r => {
      setChartData({
        datasets: [{
          label: 'Journals',
          data: r.data.map(d => ({ x: d.x, y: d.y })),
          backgroundColor: '#e9456055',
          pointRadius: 3,
        }],
      })
    })
  }

  return (
    <div className="card">
      <h2>Scatter Plot — Journal metrics</h2>
      <div className="filter-bar">
        <label>X axis
          <select value={xField} onChange={e => setXField(e.target.value)}>
            {SCATTER_FIELDS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>Y axis
          <select value={yField} onChange={e => setYField(e.target.value)}>
            {SCATTER_FIELDS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <button className="btn" onClick={load}>Load</button>
      </div>
      {chartData && (
        chartData.datasets[0].data.length === 0
          ? <EmptyState message="No journal data available." />
          : <div className="chart-wrap">
              <Scatter data={chartData} options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                  x: { title: { display: true, text: xField } },
                  y: { title: { display: true, text: yField } },
                },
              }} />
            </div>
      )}
    </div>
  )
}

// ---- Category Line Chart (FoR / SubjectArea) ----
function CategoryLineChartPanel() {
  const [catType,     setCatType]     = useState('for')
  const [filter,      setFilter]      = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSugg,    setShowSugg]    = useState(false)
  const [chartData,   setChartData]   = useState(null)
  const ref = useRef()

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setShowSugg(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (!filter.trim()) { setSuggestions([]); setShowSugg(false); return }
    const t = setTimeout(() => {
      getCategories({ type: catType, q: filter }).then(r => {
        setSuggestions(r.data.slice(0, 10)); setShowSugg(true)
      })
    }, 200)
    return () => clearTimeout(t)
  }, [filter, catType])

  const load = () => {
    const params = { type: catType }
    if (filter) params.category = filter
    getCategoryLinechart(params).then(r => {
      const byLabel = {}
      r.data.forEach(row => {
        if (!byLabel[row.label]) byLabel[row.label] = []
        byLabel[row.label].push({ x: row.year, y: row.value })
      })
      const labels = [...new Set(r.data.map(r => r.year))].sort()
      const datasets = Object.entries(byLabel).map(([label, pts], i) => ({
        label,
        data: labels.map(yr => pts.find(p => p.x === yr)?.y ?? null),
        borderColor: COLORS[i % COLORS.length],
        tension: 0.3, fill: false,
      }))
      setChartData({ labels, datasets })
    })
  }

  return (
    <div className="card">
      <h2>Line Chart — Venues per Category per Year</h2>
      <div className="filter-bar">
        <label>Category type
          <select value={catType} onChange={e => { setCatType(e.target.value); setFilter(''); setSuggestions([]) }}>
            <option value="for">Conference Field of Research (FoR)</option>
            <option value="subject_area">Journal Subject Area</option>
          </select>
        </label>
        <label style={{ position: 'relative' }} ref={ref}>Filter category name
          <input value={filter} onChange={e => { setFilter(e.target.value); setShowSugg(true) }}
            onFocus={() => suggestions.length && setShowSugg(true)}
            placeholder="e.g. Artificial intelligence" style={{width:240}} />
          {showSugg && suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 100,
              background: 'white', border: '1px solid #ccc',
              borderRadius: 6, width: 240, boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              maxHeight: 240, overflowY: 'auto',
            }}>
              {suggestions.map(s => (
                <div key={s.name}
                  style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #eee', fontSize: '0.9rem' }}
                  onMouseDown={() => { setFilter(s.name); setShowSugg(false) }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {s.name}
                </div>
              ))}
            </div>
          )}
        </label>
        <button className="btn" onClick={load}>Load</button>
      </div>
      {chartData && (
        chartData.labels.length === 0
          ? <EmptyState message="No data for the selected category." />
          : <div className="chart-wrap">
              <Line data={chartData} options={{ responsive: true, plugins: { legend: { position: 'top' } } }} />
            </div>
      )}
    </div>
  )
}

// ---- Scatter: avg authors vs papers per year ----
function ScatterVenueYearPanel() {
  const [venueType, setVenueType] = useState('conferences')
  const [chartData, setChartData] = useState(null)

  const load = () => {
    getScatterVenueYear({ type: venueType }).then(r => {
      setChartData({
        datasets: [{
          label: venueType === 'conferences' ? 'Conferences (venue×year)' : 'Journals (venue×year)',
          data: r.data.map(d => ({ x: d.x, y: d.y })),
          backgroundColor: '#1a1a2e55',
          pointRadius: 3,
        }],
      })
    })
  }

  return (
    <div className="card">
      <h2>Scatter Plot — Avg Authors/Paper vs Paper Count (per venue per year)</h2>
      <div className="filter-bar">
        <label>Venue type
          <select value={venueType} onChange={e => setVenueType(e.target.value)}>
            <option value="conferences">Conferences</option>
            <option value="journals">Journals</option>
          </select>
        </label>
        <button className="btn" onClick={load}>Load</button>
      </div>
      {chartData && (
        chartData.datasets[0].data.length === 0
          ? <EmptyState message="No data available." />
          : <div className="chart-wrap">
              <Scatter data={chartData} options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                  x: { beginAtZero: true, title: { display: true, text: 'Papers published' } },
                  y: { beginAtZero: true, title: { display: true, text: 'Avg authors / paper' } },
                },
              }} />
            </div>
      )}
    </div>
  )
}

export default function ChartsPage() {
  return (
    <div>
      <h1>Charts</h1>
      <LineChartPanel />
      <CategoryLineChartPanel />
      <BarChartPanel />
      <ScatterPanel />
      <ScatterVenueYearPanel />
    </div>
  )
}
