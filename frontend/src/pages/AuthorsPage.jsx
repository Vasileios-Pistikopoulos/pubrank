import { useState } from 'react'
import { Link } from 'react-router-dom'
import { searchAuthors } from '../api/client'

export default function AuthorsPage() {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [searched, setSearched] = useState(false)

  const search = () => {
    if (!query.trim()) return
    searchAuthors(query).then(r => { setResults(r.data); setSearched(true) })
  }

  return (
    <div>
      <h1>Authors</h1>
      <div className="filter-bar">
        <label>Name
          <input value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="e.g. Smith" style={{width:240}} />
        </label>
        <button className="btn" onClick={search}>Search</button>
      </div>

      {searched && (
        results.length === 0
          ? <p>No results.</p>
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
