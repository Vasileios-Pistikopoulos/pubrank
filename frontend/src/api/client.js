import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api' })

export const getConferences        = (params={}) => api.get('/conferences/', { params })
export const searchConferences     = (q)         => api.get('/conferences/', { params: { q } })
export const getConferenceProfile  = (id, params) => api.get(`/conferences/${id}/profile/`, { params })
export const getConferencePapers   = (id, params) => api.get(`/conferences/${id}/papers/`, { params })

export const getJournals           = (params={}) => api.get('/journals/', { params })
export const searchJournals        = (q)         => api.get('/journals/',  { params: { q } })
export const getJournalProfile   = (id, params) => api.get(`/journals/${id}/profile/`, { params })
export const getJournalPapers    = (id, params) => api.get(`/journals/${id}/papers/`, { params })

export const searchAuthors       = (q)        => api.get('/authors/', { params: { q } })
export const getAuthorProfile    = (id)       => api.get(`/authors/${id}/profile/`)

export const getYears            = ()         => api.get('/years/')
export const getYearProfile      = (year, params) => api.get(`/years/${year}/profile/`, { params })

export const getCategories       = (params)    => api.get('/categories/', { params })

export const getLinechart         = (params) => api.get('/charts/linechart/',          { params })
export const getCategoryLinechart = (params) => api.get('/charts/category-linechart/', { params })
export const getBarchart          = (params) => api.get('/charts/barchart/',           { params })
export const getScatter           = (params) => api.get('/charts/scatter/',            { params })
export const getScatterVenueYear  = (params) => api.get('/charts/scatter/venue-year/', { params })
