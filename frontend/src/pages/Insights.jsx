import { useState, useEffect } from 'react'
import Plot from 'react-plotly.js'
import {
  getSummary,
  downloadResults,
  getGeoInsights,
  getTextInsights,
  getAlerts,
  getTimeline,
} from '../services/api'

export default function Insights() {
  const [summary, setSummary] = useState(null)
  const [geoData, setGeoData] = useState(null)
  const [textData, setTextData] = useState(null)
  const [alertData, setAlertData] = useState(null)
  const [timelineData, setTimelineData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    loadInsights()
  }, [])

  const loadInsights = async () => {
    try {
      setLoading(true)
      const [summaryRes, geoRes, textRes, alertRes, timelineRes] = await Promise.all([
        getSummary(),
        getGeoInsights(),
        getTextInsights(),
        getAlerts(),
        getTimeline(),
      ])
      setSummary(summaryRes)
      setGeoData(geoRes)
      setTextData(textRes)
      setAlertData(alertRes)
      setTimelineData(timelineRes)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load insights')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (format) => {
    try {
      setDownloading(true)
      const blob = await downloadResults(format)
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `crisisnet_results.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      alert('Failed to download results')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy mx-auto mb-4"></div>
          <p className="text-gray-600">Loading insights...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
        <p className="font-semibold">Error loading insights</p>
        <p>{error}</p>
        <button
          onClick={loadInsights}
          className="mt-4 px-4 py-2 bg-red text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">No insights available.</p>
        <p className="text-sm text-gray-500">Please upload a file and run analysis from the Home page.</p>
      </div>
    )
  }

  const sentimentSummary = textData?.sentiment_summary
  const sentimentCounts = sentimentSummary
    ? [sentimentSummary.positive, sentimentSummary.neutral, sentimentSummary.negative]
    : [0, 0, 0]
  const sentimentLabels = ['Positive', 'Neutral', 'Negative']
  const topics = textData?.topics || []
  const alerts = alertData?.alerts || []
  const alertSummary = alertData?.summary
  const geoLocations = geoData?.locations || []
  const geoSummary = geoData?.summary
  const timelinePoints = timelineData?.timeline || []
  const timelineHasReal = timelineData?.has_real_timestamp
  const geoHoverTexts = geoLocations.map(
    (loc) =>
      `${loc.location}<br>Total: ${loc.total_tweets}<br>Disaster: ${loc.disaster_tweets}<br>` +
      `Keywords: ${loc.top_keywords?.join(', ') || 'N/A'}`
  )
  const timelineTimestamps = timelinePoints.map((pt) => pt.timestamp)
  const timelineDisaster = timelinePoints.map((pt) => pt.disaster)
  const timelineNon = timelinePoints.map((pt) => pt.non_disaster)

  const severityConfig = {
    critical: { container: 'border-red-500 bg-red-50', badge: 'bg-red-100 text-red-700' },
    high: { container: 'border-orange-500 bg-orange-50', badge: 'bg-orange-100 text-orange-700' },
    elevated: { container: 'border-yellow-500 bg-yellow-50', badge: 'bg-yellow-100 text-yellow-700' },
    normal: { container: 'border-green-500 bg-green-50', badge: 'bg-green-100 text-green-700' },
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-navy mb-2">Insights & Summary</h1>
          <p className="text-gray-600">
            Natural language summary of the Social Network Analysis findings
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => handleDownload('csv')}
            disabled={downloading}
            className="px-4 py-2 bg-navy text-white rounded-lg hover:bg-navy-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {downloading ? 'Downloading...' : 'Download CSV'}
          </button>
          <button
            onClick={() => handleDownload('json')}
            disabled={downloading}
            className="px-4 py-2 bg-cyan text-navy rounded-lg hover:bg-cyan-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            {downloading ? 'Downloading...' : 'Download JSON'}
          </button>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
        <h2 className="text-2xl font-semibold text-navy mb-4">Executive Summary</h2>
        <div className="prose max-w-none">
          <p className="text-gray-700 leading-relaxed text-lg">
            {summary.summary}
          </p>
        </div>
      </div>

      {/* Key Insights */}
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-semibold text-navy mb-4">Key Insights</h2>
        <div className="space-y-4">
          {summary.insights?.map((insight, idx) => (
            <div
              key={idx}
              className="flex items-start space-x-4 p-4 bg-cyan-50 rounded-lg border-l-4 border-cyan"
            >
              <div className="flex-shrink-0 w-8 h-8 bg-cyan text-white rounded-full flex items-center justify-center font-semibold">
                {idx + 1}
              </div>
              <p className="text-gray-700 flex-1">{insight}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Alert Center */}
      {alertData && (
        <div className="mt-8 bg-white rounded-lg shadow-lg p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h2 className="text-2xl font-semibold text-navy mb-2">Real-time Alert Center</h2>
              <p className="text-gray-600">
                Combined risk score blending network centrality, sentiment signals, and topic prominence.
              </p>
            </div>
            {alertSummary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full lg:w-auto">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs uppercase text-gray-500">Avg Score</p>
                  <p className="text-2xl font-bold text-navy">
                    {alertSummary.average_alert_score?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-xs uppercase text-red-500">Critical</p>
                  <p className="text-2xl font-bold text-red-600">{alertSummary.critical_alerts}</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <p className="text-xs uppercase text-orange-500">High</p>
                  <p className="text-2xl font-bold text-orange-600">{alertSummary.high_alerts}</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4">
                  <p className="text-xs uppercase text-yellow-600">Elevated</p>
                  <p className="text-2xl font-bold text-yellow-600">{alertSummary.elevated_alerts}</p>
                </div>
              </div>
            )}
          </div>
          <div className="mt-6 space-y-4">
            {alerts.length > 0 ? (
              alerts.slice(0, 3).map((alert) => {
                const severity = severityConfig[alert.severity] || severityConfig.normal
                return (
                  <div
                    key={alert.id}
                    className={`p-4 border-l-4 rounded-lg ${severity.container} shadow-sm`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-navy">Tweet {alert.id}</div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${severity.badge}`}>
                        {alert.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">
                      {alert.text || 'No preview available.'}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                      <div>
                        <span className="font-semibold text-gray-800">Alert:</span>{' '}
                        {alert.alert_score.toFixed(2)}
                      </div>
                      <div>
                        <span className="font-semibold text-gray-800">Sentiment:</span>{' '}
                        {alert.sentiment_label}
                      </div>
                      <div>
                        <span className="font-semibold text-gray-800">Keyword:</span>{' '}
                        {alert.keyword || 'N/A'}
                      </div>
                      <div>
                        <span className="font-semibold text-gray-800">Location:</span>{' '}
                        {alert.location || 'N/A'}
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="text-gray-500 text-sm">No alert signals detected.</p>
            )}
          </div>
        </div>
      )}

      {/* Sentiment & Topic Explorer */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-navy mb-2">Sentiment Overview</h2>
          <p className="text-gray-600 mb-4">
            Average tone score:{' '}
            <span className="font-semibold text-navy">
              {sentimentSummary ? sentimentSummary.average_compound.toFixed(2) : '0.00'}
            </span>
          </p>
          {sentimentSummary ? (
            <Plot
              data={[
                {
                  values: sentimentCounts,
                  labels: sentimentLabels,
                  type: 'pie',
                  hole: 0.45,
                  marker: { colors: ['#10B981', '#CBD5F5', '#DC2626'] },
                },
              ]}
              layout={{
                height: 320,
                showlegend: true,
                margin: { l: 10, r: 10, t: 10, b: 10 },
                legend: { orientation: 'h' },
              }}
              config={{ displayModeBar: false }}
            />
          ) : (
            <p className="text-sm text-gray-500">Sentiment analysis will appear after running analysis.</p>
          )}
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-navy mb-2">Topic Explorer</h2>
          <p className="text-gray-600 mb-4">
            Dominant discussion themes extracted via Latent Dirichlet Allocation (LDA).
          </p>
          <div className="space-y-4 max-h-[360px] overflow-y-auto pr-2">
            {topics.length > 0 ? (
              topics.slice(0, 5).map((topic) => (
                <div key={topic.topic_id} className="border-l-4 border-cyan bg-cyan-50 p-4 rounded-r-lg">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-navy">Topic {topic.topic_id}</p>
                    <span className="text-xs text-gray-500">
                      Confidence: {(topic.average_confidence || 0).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold text-gray-900">Keywords:</span>{' '}
                    {topic.keywords?.slice(0, 6).join(', ')}
                  </p>
                  {topic.representative_text && (
                    <p className="text-xs text-gray-500 mt-2">
                      “{topic.representative_text}
                      {topic.representative_text.length >= 200 ? '...' : ''}”
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">Topic modeling results will appear after analysis.</p>
            )}
          </div>
        </div>
      </div>

      {/* Geo Hotspots */}
      {geoLocations.length > 0 && (
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h2 className="text-xl font-semibold text-navy mb-2">Geospatial Hotspots</h2>
              <p className="text-gray-600">
                Mapped tweet density and disaster ratios across geocoded locations.
              </p>
            </div>
            {geoSummary && geoSummary.highest_activity_location && geoSummary.highest_risk_location && (
              <div className="grid grid-cols-2 gap-3 w-full lg:w-auto">
                <div className="bg-cyan-50 rounded-lg p-3 text-sm">
                  <p className="text-gray-500 uppercase text-xs">Highest Activity</p>
                  <p className="font-semibold text-navy">{geoSummary.highest_activity_location.location}</p>
                  <p className="text-xs text-gray-600">{geoSummary.highest_activity_location.total_tweets} tweets</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-sm">
                  <p className="text-gray-500 uppercase text-xs">Highest Risk</p>
                  <p className="font-semibold text-red-600">{geoSummary.highest_risk_location.location}</p>
                  <p className="text-xs text-gray-600">
                    {(geoSummary.highest_risk_location.disaster_ratio * 100).toFixed(0)}% disaster
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="mt-4">
            <Plot
              data={[
                {
                  type: 'scattergeo',
                  mode: 'markers',
                  lat: geoLocations.map((loc) => loc.lat),
                  lon: geoLocations.map((loc) => loc.lon),
                  marker: {
                    size: geoLocations.map((loc) => 8 + loc.total_tweets * 2),
                    color: geoLocations.map((loc) => loc.disaster_ratio),
                    colorscale: 'Reds',
                    cmin: 0,
                    cmax: 1,
                    colorbar: { title: 'Disaster Ratio' },
                    opacity: 0.85,
                  },
                  text: geoHoverTexts,
                  hoverinfo: 'text',
                },
              ]}
              layout={{
                height: 420,
                margin: { l: 0, r: 0, t: 0, b: 0 },
                geo: {
                  projection: { type: 'natural earth' },
                  showcountries: true,
                  showland: true,
                  landcolor: '#F9FAFB',
                  countrycolor: '#CBD5F5',
                },
              }}
              config={{ displayModeBar: false }}
            />
          </div>
        </div>
      )}

      {/* Temporal Trends */}
      {timelinePoints.length > 0 && (
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-semibold text-navy">Temporal Trendline</h2>
              <p className="text-gray-600 text-sm">
                {timelineHasReal
                  ? 'Actual timestamps detected; trends grouped daily.'
                  : 'No timestamp column found—synthetic timeline generated for pattern exploration.'}
              </p>
            </div>
            <div className="text-xs text-gray-500">
              Frequency: {timelineData?.frequency || 'Daily'}
            </div>
          </div>
          <Plot
            data={[
              {
                x: timelineTimestamps,
                y: timelineDisaster,
                type: 'scatter',
                mode: 'lines',
                name: 'Disaster',
                line: { color: '#DC2626', width: 3 },
                fill: 'tozeroy',
                fillcolor: 'rgba(220,38,38,0.2)',
              },
              {
                x: timelineTimestamps,
                y: timelineNon,
                type: 'scatter',
                mode: 'lines',
                name: 'Non-Disaster',
                line: { color: '#10B981', width: 3 },
                fill: 'tonexty',
                fillcolor: 'rgba(16,185,129,0.15)',
              },
            ]}
            layout={{
              height: 360,
              margin: { l: 40, r: 10, t: 10, b: 60 },
              xaxis: { title: 'Time' },
              yaxis: { title: 'Tweet Count' },
              legend: { orientation: 'h' },
            }}
            config={{ displayModeBar: false }}
          />
        </div>
      )}

      {/* SNA Metrics Explanation */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-navy mb-4">Understanding the Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-white p-4 rounded-lg">
            <h4 className="font-semibold text-navy mb-2">Degree Centrality</h4>
            <p className="text-gray-600">
              Measures the number of direct connections a node has. Higher values indicate 
              tweets that are directly connected to many other tweets.
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg">
            <h4 className="font-semibold text-navy mb-2">Betweenness Centrality</h4>
            <p className="text-gray-600">
              Measures how often a node appears on shortest paths between other nodes. 
              High betweenness indicates a bridge or connector in the network.
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg">
            <h4 className="font-semibold text-navy mb-2">Eigenvector Centrality</h4>
            <p className="text-gray-600">
              Measures influence based on connections to highly connected nodes. 
              A node is important if it's connected to other important nodes.
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg">
            <h4 className="font-semibold text-navy mb-2">Community Detection</h4>
            <p className="text-gray-600">
              Identifies clusters of nodes that are more densely connected to each other 
              than to the rest of the network. Represents information clusters.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

