import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import ConferencesPage   from './pages/ConferencesPage'
import ConferenceProfile from './pages/ConferenceProfile'
import JournalsPage      from './pages/JournalsPage'
import JournalProfile    from './pages/JournalProfile'
import AuthorsPage       from './pages/AuthorsPage'
import AuthorProfile     from './pages/AuthorProfile'
import YearsPage         from './pages/YearsPage'
import YearProfile       from './pages/YearProfile'
import ChartsPage        from './pages/ChartsPage'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <nav className="navbar">
        <span className="nav-brand">Academic DB</span>
        <NavLink to="/conferences">Conferences</NavLink>
        <NavLink to="/journals">Journals</NavLink>
        <NavLink to="/authors">Authors</NavLink>
        <NavLink to="/years">Years</NavLink>
        <NavLink to="/charts">Charts</NavLink>
      </nav>
      <main className="container">
        <Routes>
          <Route path="/"                element={<ConferencesPage />} />
          <Route path="/conferences"     element={<ConferencesPage />} />
          <Route path="/conferences/:id" element={<ConferenceProfile />} />
          <Route path="/journals"        element={<JournalsPage />} />
          <Route path="/journals/:id"    element={<JournalProfile />} />
          <Route path="/authors"         element={<AuthorsPage />} />
          <Route path="/authors/:id"     element={<AuthorProfile />} />
          <Route path="/years"           element={<YearsPage />} />
          <Route path="/years/:year"     element={<YearProfile />} />
          <Route path="/charts"          element={<ChartsPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
