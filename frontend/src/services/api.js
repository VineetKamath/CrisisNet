import axios from 'axios'

const API_BASE_URL = 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const uploadFile = async (file) => {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

export const analyze = async () => {
  const response = await api.get('/analyze')
  return response.data
}

export const getGraph = async () => {
  const response = await api.get('/graph')
  return response.data
}

export const getSummary = async () => {
  const response = await api.get('/summary')
  return response.data
}

export const getMetrics = async () => {
  const response = await api.get('/metrics')
  return response.data
}

export const getGeoInsights = async () => {
  const response = await api.get('/geo-insights')
  return response.data
}

export const getTextInsights = async () => {
  const response = await api.get('/text-insights')
  return response.data
}

export const getAlerts = async () => {
  const response = await api.get('/alerts')
  return response.data
}

export const getTimeline = async () => {
  const response = await api.get('/timeline')
  return response.data
}

export const startLiveStream = async () => {
  const response = await api.post('/live/start')
  return response.data
}

export const stopLiveStream = async () => {
  const response = await api.post('/live/stop')
  return response.data
}

export const getLiveStatus = async () => {
  const response = await api.get('/live/status')
  return response.data
}

export const downloadResults = async (format = 'csv') => {
  const response = await api.get(`/download?format=${format}`, {
    responseType: 'blob',
  })
  return response.data
}

export default api

