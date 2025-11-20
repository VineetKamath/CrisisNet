import { useEffect, useMemo, useState, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { startLiveStream, stopLiveStream, getLiveStatus } from '../services/api'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const WS_URL = (API_BASE.startsWith('https') ? API_BASE.replace('https', 'wss') : API_BASE.replace('http', 'ws')) + '/ws/live'

export default function LiveDashboard() {
  const [events, setEvents] = useState([])
  const [summary, setSummary] = useState(null)
  const [running, setRunning] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [wsStatus, setWsStatus] = useState('disconnected')
  const wsRef = useRef(null)

  useEffect(() => {
    loadStatus()
    connectWebSocket()
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  const connectWebSocket = () => {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws
    ws.onopen = () => setWsStatus('connected')
    ws.onclose = () => setWsStatus('disconnected')
    ws.onerror = () => setWsStatus('error')
    ws.onmessage = (msg) => {
      try {
        const payload = JSON.parse(msg.data)
        if (payload.type === 'bootstrap') {
          setEvents(payload.events || [])
          setSummary(payload.summary || null)
          setRunning(payload.running)
        } else if (payload.type === 'event') {
          setEvents((prev) => [...prev, payload.event].slice(-200))
          setSummary(payload.summary || null)
          setRunning(payload.running)
        }
      } catch (err) {
        console.error('WS parse error', err)
      }
    }
  }

  const loadStatus = async () => {
    try {
      setLoading(true)
      const status = await getLiveStatus()
      setRunning(status.running)
      setSummary(status.summary)
      setConfigured(status.configured)
      setEvents(status.summary?.last_event ? status.summary.last_event : [])
    } catch (err) {
      if (err.response?.status !== 400) {
        setError(err.response?.data?.detail || 'Failed to load live status')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleStart = async () => {
    try {
      setError(null)
      await startLiveStream()
      setRunning(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to start live monitoring')
    }
  }

  const handleStop = async () => {
    try {
      setError(null)
      await stopLiveStream()
      setRunning(false)
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to stop live monitoring')
    }
  }

  const liveLocations = useMemo(() => events.filter((evt) => evt.lat && evt.lon), [events])
  const feedItems = useMemo(
    () =>
      [...events].sort(
        (a, b) => new Date(b.created_at || b.timestamp || 0) - new Date(a.created_at || a.timestamp || 0),
      ),
    [events],
  )

  const averageCenter = useMemo(() => {
    if (!liveLocations.length) return [20, 0]
    const lat = liveLocations.reduce((sum, loc) => sum + loc.lat, 0) / liveLocations.length
    const lon = liveLocations.reduce((sum, loc) => sum + loc.lon, 0) / liveLocations.length
    return [lat, lon]
  }, [liveLocations])

  return (
    <div className="space-y-6">
      <header className="bg-white rounded-3xl shadow-lg p-6 border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 bg-cyan-50 px-3 py-1 rounded-full text-xs font-semibold text-cyan-700">
              <span className={`w-2 h-2 rounded-full ${running ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              <span>{running ? 'Live monitoring active' : 'Live mode paused'}</span>
            </div>
            <h1 className="text-3xl font-bold text-navy mt-3">Live Crisis Command Center</h1>
            <p className="text-gray-600">
              Streaming Reddit signals in real time. Track hotspots, analyze sentiment, and surface AI insights.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleStart}
              disabled={!configured || running}
              className="px-4 py-2 rounded-full bg-navy text-white text-sm font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Start Live Mode
            </button>
            <button
              onClick={handleStop}
              disabled={!running}
              className="px-4 py-2 rounded-full bg-red-50 text-red-600 text-sm font-semibold disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              Stop
            </button>
            <div className="text-xs text-gray-500 flex flex-col">
              <span>WebSocket: {wsStatus}</span>
              {!configured && <span className="text-red-500">Missing Reddit API credentials</span>}
            </div>
          </div>
        </div>
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-600">
            {error}
          </div>
        )}
      </header>

      <div className="grid xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Geo intelligence</p>
                <h2 className="text-xl font-semibold text-navy">Live Hotspot Map</h2>
              </div>
              <p className="text-xs text-gray-400">
                Showing {liveLocations.length} geocoded signals (past {events.length} posts)
              </p>
            </div>
            <div className="h-[480px] rounded-3xl overflow-hidden m-4 border border-gray-100">
              <MapContainer center={averageCenter} zoom={liveLocations.length > 1 ? 3 : 4} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {liveLocations.map((loc) => (
                  <CircleMarker
                    key={loc.id}
                    center={[loc.lat, loc.lon]}
                    radius={8}
                    pathOptions={{
                      color:
                        loc.sentiment?.compound < -0.3
                          ? '#DC2626'
                          : loc.sentiment?.compound > 0.3
                            ? '#10B981'
                            : '#2563EB',
                      fillOpacity: 0.5,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <div className="space-y-2 text-sm text-gray-700">
                        <p className="font-semibold text-navy">{loc.location}</p>
                        <p>{loc.title}</p>
                        <p className="text-xs text-gray-500">{new Date(loc.created_at || loc.timestamp).toLocaleString()}</p>
                        <a href={loc.permalink || loc.url} target="_blank" rel="noreferrer" className="text-cyan-600 text-xs">
                          View on Reddit
                        </a>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-lg border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Signal stream</p>
                <h2 className="text-xl font-semibold text-navy">Latest Reddit Alerts</h2>
              </div>
              <span className="text-xs text-gray-400">{feedItems.length} posts tracked</span>
            </div>
            <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-100">
              {feedItems.length === 0 && (
                <div className="p-6 text-center text-gray-500 text-sm">No live signals yet. Start the stream to begin.</div>
              )}
              {feedItems.map((item) => (
                <article key={item.id} className="p-5 flex gap-4">
                  <div className="w-2 rounded-full bg-gradient-to-b from-cyan-400 to-blue-600" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs uppercase tracking-wide text-gray-500">
                        r/{item.subreddit || 'unknown'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(item.created_at || item.timestamp || Date.now()).toLocaleTimeString()}
                      </div>
                    </div>
                    <h3 className="font-semibold text-navy">{item.title}</h3>
                    <p className="text-sm text-gray-600">{item.text}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                      {item.keywords?.map((kw) => (
                        <span key={kw} className="px-2 py-1 bg-gray-100 rounded-full">
                          #{kw}
                        </span>
                      ))}
                      <span>Sentiment {(item.sentiment?.compound || 0).toFixed(2)}</span>
                      <span>⬆ {item.upvotes || 0}</span>
                    </div>
                    <a
                      href={item.permalink || item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-600 text-xs font-semibold"
                    >
                      View post ↗
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="bg-gradient-to-br from-navy to-blue-900 text-white rounded-3xl p-6 shadow-lg">
            <p className="text-xs uppercase tracking-wide text-white/70">AI situational insight</p>
            <h3 className="text-xl font-semibold mt-2">Live Signal Summary</h3>
            <div className="mt-4 space-y-3 text-sm text-white/80">
              <p>Total events: {summary?.total_events || events.length}</p>
              <p>Average sentiment: {(summary?.avg_sentiment || 0).toFixed(2)}</p>
              {summary?.top_locations?.length > 0 && (
                <div>
                  <p className="text-xs uppercase text-white/60 mb-1">Top zones</p>
                  <ul className="space-y-1">
                    {summary.top_locations.map((loc) => (
                      <li key={loc.location}>
                        {loc.location} <span className="text-white/60">({loc.count} signals)</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {summary?.top_keywords?.length > 0 && (
                <div>
                  <p className="text-xs uppercase text-white/60 mb-1">Trending topics</p>
                  <div className="flex flex-wrap gap-2">
                    {summary.top_keywords.map((kw) => (
                      <span key={kw} className="px-2 py-1 bg-white/10 rounded-full text-xs">
                        #{kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-navy mb-4">System health</h3>
            <ul className="space-y-3 text-sm text-gray-600">
              <li className="flex items-center justify-between">
                <span>Reddit credentials</span>
                <span className={configured ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                  {configured ? 'Configured' : 'Missing'}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>Live service</span>
                <span className={running ? 'text-green-600 font-semibold' : 'text-gray-500 font-semibold'}>
                  {running ? 'Running' : 'Idle'}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>WebSocket</span>
                <span className="font-semibold">{wsStatus}</span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}


