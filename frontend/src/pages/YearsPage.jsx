import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getYears } from '../api/client'

export default function YearsPage() {
  const [data, setData] = useState([])

  useEffect(() => { getYears().then(r => setData(r.data)) }, [])

  return (
    <div>
      <h1>Years</h1>
      <div className="card">
        <table>
          <thead><tr>
            <th>Year</th><th>Total Papers</th><th>Conferences</th><th>Journals</th><th>Distinct Authors</th>
          </tr></thead>
          <tbody>
            {[...data].reverse().map(y => (
              <tr key={y.year}>
                <td><Link to={`/years/${y.year}`}>{y.year}</Link></td>
                <td>{y.total_papers?.toLocaleString()}</td>
                <td>{y.distinct_conferences}</td>
                <td>{y.distinct_journals}</td>
                <td>{y.distinct_authors?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
