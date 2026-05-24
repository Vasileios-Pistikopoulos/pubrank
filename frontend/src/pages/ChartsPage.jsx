import { useState } from 'react'
import { Line, Bar, Scatter } from 'react-chartjs-2'
import {
  Chart, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Tooltip, Legend
} from 'chart.js'
import { getLinechart, getBarchart, getScatter } from '../api/client'

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend)

const COLORS = ['#e94560','#1a1a2e','#06b6d4','#f59e0b','#10b981','#8b5cf6','#f43f5e','#0ea5e9']

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
        <label>Conference IDs (comma-sep) <input value={confIds} onChange={e => setConfIds(e.target.value)} style={{width:200}} /></label>
        <label>Journal IDs (comma-sep)    <input value={jourIds} onChange={e => setJourIds(e.target.value)} style={{width:200}} /></label>
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
        <div className="chart-wrap">
          <Line data={chartData} options={{ responsive: true, plugins: { legend: { position: 'top' } } }} />
        </div>
      )}
    </div>
  )
}

// ---- Bar Chart ----
function BarChartPanel() {
  const [type,   setType]   = useState('conferences')
  const [metric, setMetric] = useState('total_papers')
  const [chartData, setChartData] = useState(null)

  const metricOptions = {
    conferences: [['total_papers','Total Papers'],['avg_papers_per_year','Avg Papers/Year'],['avg_authors_per_paper','Avg Authors/Paper']],
    journals:    [['total_papers','Total Papers'],['avg_papers_per_year','Avg Papers/Year'],['avg_authors_per_paper','Avg Authors/Paper']],
    publishers:  [['total_journals','Total Journals'],['q1_count','Q1'],['q2_count','Q2'],['q3_count','Q3'],['q4_count','Q4']],
  }

  const load = () => {
    getBarchart({ type, metric }).then(r => {
      setChartData({
        labels: r.data.map(d => d.label),
        datasets: [{ label: metric, data: r.data.map(d => d.value), backgroundColor: '#1a1a2e99' }],
      })
    })
  }

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
        <div className="chart-wrap">
          <Bar data={chartData} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
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
        <div className="chart-wrap">
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

export default function ChartsPage() {
  return (
    <div>
      <h1>Charts</h1>
      <LineChartPanel />
      <BarChartPanel />
      <ScatterPanel />
    </div>
  )
}
