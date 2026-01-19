import { useState, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { getGeoInsights, getGovAlerts } from '../services/api'

export default function GeoMap() {
  const [geoData, setGeoData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [minDisasterRatio, setMinDisasterRatio] = useState(0)
  const [showHighRisk, setShowHighRisk] = useState(false)

  const [govAlerts, setGovAlerts] = useState(null)

  useEffect(() => {
    loadGeoData()
  }, [])

  const loadGeoData = async () => {
    try {
      setLoading(true)
      const data = await getGeoInsights()
      setGeoData(data)
      // Phase 1: attempt to load government alerts as an overlay
      try {
        const alerts = await getGovAlerts()
        setGovAlerts(alerts)
      } catch (err) {
        // If /gov-alerts is not ready (400) or fails, keep map usable
        console.warn('Gov alerts not available', err?.response?.data || err)
        setGovAlerts(null)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load geospatial insights')
    } finally {
      setLoading(false)
    }
  }

  const locations = geoData?.locations || []
  const summary = geoData?.summary
  const govAlertList = govAlerts?.alerts || []

  const filteredLocations = useMemo(() => {
    return locations.filter((loc) => {
      const matchesSearch =
        !searchQuery ||
        loc.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loc.top_keywords?.some((kw) => kw.toLowerCase().includes(searchQuery.toLowerCase()))

      const meetsRatio = loc.disaster_ratio >= minDisasterRatio

      const meetsHighRisk = !showHighRisk || loc.disaster_ratio >= 0.6

      return matchesSearch && meetsRatio && meetsHighRisk
    })
  }, [locations, searchQuery, minDisasterRatio, showHighRisk])

  const averageCenter = useMemo(() => {
    if (!filteredLocations.length) {
      return [20.0, 0.0]
    }
    const latAvg =
      filteredLocations.reduce((sum, loc) => sum + loc.lat, 0) / filteredLocations.length
    const lonAvg =
      filteredLocations.reduce((sum, loc) => sum + loc.lon, 0) / filteredLocations.length
    return [latAvg, lonAvg]
  }, [filteredLocations])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy mx-auto" />
          <p className="text-gray-600">Loading geospatial intelligence...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
        <p className="font-semibold">Error loading map data</p>
        <p>{error}</p>
        <button
          onClick={loadGeoData}
          className="mt-4 px-4 py-2 bg-red text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!locations.length) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <p className="text-gray-600 mb-3">No geospatial data available.</p>
        <p className="text-sm text-gray-500">
          Please upload data and run analysis from the Home page first.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-navy">Geospatial Intelligence Hub</h1>
              <p className="text-gray-600">
                Visualize disaster hotspots, risk ratios, and community sentiment worldwide.
              </p>
            </div>
            <div className="text-xs uppercase tracking-wide text-gray-500">
              {filteredLocations.length} locations visible
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase">Search by city or keyword</p>
              <input
                type="text"
                placeholder="e.g., Tokyo or wildfire"
                className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase">Minimum disaster ratio</p>
              <div className="flex items-center space-x-3 mt-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={minDisasterRatio}
                  onChange={(e) => setMinDisasterRatio(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-semibold text-navy">
                  {(minDisasterRatio * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Focus mode</p>
                <p className="text-sm text-gray-700">
                  Highlight extreme-risk locations (≥ 60% disaster)
                </p>
              </div>
              <label className="inline-flex items-center mt-2">
                <input
                  type="checkbox"
                  checked={showHighRisk}
                  onChange={() => setShowHighRisk((prev) => !prev)}
                  className="h-4 w-4 text-cyan border-gray-300 rounded focus:ring-cyan"
                />
                <span className="ml-2 text-sm text-gray-700">High-risk filter</span>
              </label>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden border border-gray-100 h-[520px]">
            <MapContainer
              center={averageCenter}
              zoom={filteredLocations.length > 1 ? 3 : 5}
              scrollWheelZoom={true}
              style={{ height: '100%', width: '100%' }}
              className="z-0"
            >
              <TileLayer
                attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
              />
              {/* Government / official alerts overlay */}
              {govAlertList.map((alert, idx) => (
                <CircleMarker
                  key={`gov-${idx}-${alert.lat}-${alert.lon}`}
                  center={[alert.lat, alert.lon]}
                  radius={10}
                  pathOptions={{
                    color: '#F97316',
                    fillColor: '#F97316',
                    fillOpacity: 0.6,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div className="space-y-1 text-xs text-gray-700">
                      <p className="font-semibold text-navy">
                        {alert.event || 'Official alert'}
                      </p>
                      {alert.location_name && (
                        <p className="text-gray-600">{alert.location_name}</p>
                      )}
                      {alert.severity && (
                        <p>
                          Severity:{' '}
                          <span className="font-semibold uppercase">{alert.severity}</span>
                        </p>
                      )}
                      {alert.start_time && (
                        <p>From: {new Date(alert.start_time).toLocaleString()}</p>
                      )}
                      {alert.end_time && (
                        <p>To: {new Date(alert.end_time).toLocaleString()}</p>
                      )}
                      {alert.provider && (
                        <p className="text-[11px] text-gray-500">
                          Source: {alert.provider}
                        </p>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
              {filteredLocations.map((loc) => (
                <CircleMarker
                  key={`${loc.location}-${loc.lat}-${loc.lon}`}
                  center={[loc.lat, loc.lon]}
                  radius={8 + loc.total_tweets * 0.6}
                  pathOptions={{
                    color:
                      loc.disaster_ratio >= 0.7
                        ? '#DC2626'
                        : loc.disaster_ratio >= 0.4
                          ? '#F97316'
                          : '#2563EB',
                    fillColor:
                      loc.disaster_ratio >= 0.7
                        ? '#DC2626'
                        : loc.disaster_ratio >= 0.4
                          ? '#F97316'
                          : '#2563EB',
                    fillOpacity: 0.45,
                  }}
                >
                  <Popup>
                    <div className="space-y-2">
                      <div>
                        <p className="font-semibold text-navy text-sm">{loc.location}</p>
                        <p className="text-xs text-gray-500">
                          {loc.total_tweets} total |{' '}
                          <span className="text-red-600">{loc.disaster_tweets} disaster</span>
                        </p>
                      </div>
                      <div className="text-xs">
                        <p>
                          Disaster ratio:{' '}
                          <span className="font-semibold">
                            {(loc.disaster_ratio * 100).toFixed(0)}%
                          </span>
                        </p>
                        {typeof loc.average_sentiment === 'number' && (
                          <p>
                            Avg sentiment:{' '}
                            <span
                              className={
                                loc.average_sentiment > 0
                                  ? 'text-green-600 font-semibold'
                                  : loc.average_sentiment < 0
                                    ? 'text-red-600 font-semibold'
                                    : 'text-gray-700 font-semibold'
                              }
                            >
                              {loc.average_sentiment.toFixed(2)}
                            </span>
                          </p>
                        )}
                      </div>
                      {loc.top_keywords?.length > 0 && (
                        <div>
                          <p className="text-[11px] uppercase text-gray-500">Top keywords</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {loc.top_keywords.map((kw) => (
                              <span
                                key={kw}
                                className="px-2 py-1 text-[11px] bg-cyan-50 text-navy rounded-full"
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-navy to-blue-900 text-white rounded-2xl shadow-lg p-6">
            <h3 className="text-lg font-semibold mb-3">Impact Snapshot</h3>
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-white/70">Geocoded locations</span>
                <span className="text-xl font-semibold">{summary?.total_geocoded_locations}</span>
              </div>
              {summary?.highest_activity_location && (
                <div>
                  <p className="text-white/70 text-xs uppercase">Highest activity</p>
                  <p className="text-base font-semibold">
                    {summary.highest_activity_location.location}
                  </p>
                  <p className="text-sm text-white/70">
                    {summary.highest_activity_location.total_tweets} signals
                  </p>
                </div>
              )}
              {summary?.highest_risk_location && (
                <div>
                  <p className="text-white/70 text-xs uppercase">Highest risk ratio</p>
                  <p className="text-base font-semibold">
                    {summary.highest_risk_location.location}
                  </p>
                  <p className="text-sm text-white/70">
                    {(summary.highest_risk_location.disaster_ratio * 100).toFixed(0)}% disaster
                    intensity
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-navy">Heatmap Legend</h3>
              <span className="text-xs uppercase text-gray-500">Circle color & size</span>
            </div>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-red-600 inline-block" />
                <span>Critical risk (≥70% disaster ratio)</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" />
                <span>Elevated risk (40-69%)</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
                <span>Monitoring (≤39%)</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full border border-gray-400 inline-block" />
                <span>Circle size = total tweet volume</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-orange-400 inline-block" />
                <span>Orange rings = official weather / hazard alerts (Open-Meteo API)</span>
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-navy">Priority Watchlist</h3>
              <span className="text-xs text-gray-500">Top 5 risk zones</span>
            </div>
            <div className="space-y-3">
              {locations
                .slice()
                .sort((a, b) => b.disaster_ratio - a.disaster_ratio)
                .slice(0, 5)
                .map((loc, idx) => (
                  <div
                    key={loc.location}
                    className="flex items-center justify-between text-sm border-b border-gray-100 pb-2 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="font-semibold text-navy">
                        {idx + 1}. {loc.location}
                      </p>
                      <p className="text-xs text-gray-500">
                        {loc.disaster_tweets} disaster signals • {loc.total_tweets} total
                      </p>
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        loc.disaster_ratio >= 0.7
                          ? 'text-red-600'
                          : loc.disaster_ratio >= 0.4
                            ? 'text-orange-500'
                            : 'text-blue-600'
                      }`}
                    >
                      {(loc.disaster_ratio * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


