import { useEffect, useState } from 'react'
import { getGovAlerts } from '../services/api'

export default function About() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await getGovAlerts()
        setData(res)
      } catch (err) {
        setError(err.response?.data?.detail || 'Government alerts not available yet')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const alerts = data?.alerts || []
  const summary = data?.summary
  const crossValidation = data?.cross_validation || {}
  const crossValidationSummary = data?.cross_validation_summary || {}

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold text-navy mb-1">Gov & Official Alerts</h1>
        <p className="text-sm text-gray-600">
          Phase 1: Official alerts from Open-Meteo API • Phase 2: Cross-validation with tweet clusters
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        {loading && (
          <div className="text-center py-8 text-gray-600 text-sm">
            Loading government alerts...
          </div>
        )}
        {!loading && error && (
          <div className="text-center py-8 text-red-600 text-sm">
            {error}
            <p className="mt-2 text-gray-500">
              Make sure you've uploaded a CSV and run analysis to generate government alerts.
            </p>
          </div>
        )}
        {!loading && !error && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <p className="text-xs uppercase text-gray-500">Status</p>
                <p className="text-sm text-gray-700">
                  Government alerts system:{' '}
                  <span className={data?.enabled ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                    {data?.enabled ? 'Active' : 'Inactive'}
                  </span>
                </p>
                {summary && (
                  <p className="text-xs text-gray-500 mt-1">
                    Total alerts: <span className="font-semibold text-navy">{summary.total_alerts}</span>{' '}
                    • Affected locations:{' '}
                    <span className="font-semibold text-navy">{summary.affected_locations}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Phase 2 Cross-Validation Summary */}
            {crossValidationSummary && Object.keys(crossValidationSummary).length > 0 && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="text-sm font-semibold text-navy mb-3">Phase 2: Cross-Validation Results</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Aligned Clusters</p>
                    <p className="text-lg font-bold text-green-600">{crossValidationSummary.aligned_clusters || 0}</p>
                    <p className="text-xs text-gray-500">Tweets match official alerts</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Contradicted Clusters</p>
                    <p className="text-lg font-bold text-red-600">{crossValidationSummary.contradicted_clusters || 0}</p>
                    <p className="text-xs text-gray-500">Flagged for review</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">No Match</p>
                    <p className="text-lg font-bold text-gray-600">{crossValidationSummary.no_match_clusters || 0}</p>
                    <p className="text-xs text-gray-500">No official alert found</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-gray-600">
                  <strong>How it works:</strong> For each tweet cluster, we match it with official alerts by location and time.
                  Aligned clusters get credibility boosts; contradicted ones are flagged for manual review.
                </p>
              </div>
            )}

            {alerts.length === 0 ? (
              <div className="text-center py-8 text-gray-600 text-sm">
                No active official alerts returned for the current dataset locations.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">
                        Location
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">
                        Event
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">
                        Severity
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">
                        From
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">
                        To
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">
                        Provider
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {alerts.slice(0, 20).map((a, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-900">
                          {a.location_name || `${a.lat.toFixed(2)}, ${a.lon.toFixed(2)}`}
                        </td>
                        <td className="px-4 py-2 text-gray-900">{a.event || 'Alert'}</td>
                        <td className="px-4 py-2 text-gray-900 uppercase">{a.severity}</td>
                        <td className="px-4 py-2 text-gray-500">
                          {a.start_time ? new Date(a.start_time).toLocaleString() : '-'}
                        </td>
                        <td className="px-4 py-2 text-gray-500">
                          {a.end_time ? new Date(a.end_time).toLocaleString() : '-'}
                        </td>
                        <td className="px-4 py-2 text-gray-500">{a.provider}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {alerts.length > 20 && (
                  <p className="mt-2 text-xs text-gray-500">
                    Showing first 20 alerts.
                  </p>
                )}
              </div>
            )}

            {/* Phase 2 Detailed Cross-Validation Results */}
            {Object.keys(crossValidation).length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-navy mb-3">Cluster-by-Cluster Cross-Validation</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Cluster ID</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Location</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Matching Alert</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Alignment Score</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Cluster Size</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {Object.entries(crossValidation).slice(0, 15).map(([clusterId, cv]) => (
                        <tr key={clusterId} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-900">#{clusterId}</td>
                          <td className="px-4 py-2 text-gray-700">{cv.location || '-'}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              cv.status === 'aligned' ? 'bg-green-100 text-green-700' :
                              cv.status === 'contradicted' ? 'bg-red-100 text-red-700' :
                              cv.status === 'neutral' ? 'bg-gray-100 text-gray-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {cv.status || 'no_match'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-700">
                            {cv.matching_alert ? (
                              <div>
                                <div className="font-medium">{cv.matching_alert.event}</div>
                                <div className="text-xs text-gray-500">{cv.matching_alert.provider}</div>
                                <div className="text-xs text-gray-500">Severity: {cv.matching_alert.severity}</div>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`font-semibold ${
                              cv.alignment_score > 0.5 ? 'text-green-600' :
                              cv.alignment_score < 0 ? 'text-red-600' :
                              'text-gray-600'
                            }`}>
                              {cv.alignment_score?.toFixed(2) || '0.00'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-700">{cv.cluster_size || 0} tweets</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {Object.keys(crossValidation).length > 15 && (
                    <p className="mt-2 text-xs text-gray-500">
                      Showing first 15 clusters. Total: {Object.keys(crossValidation).length}
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

