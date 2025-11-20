import { useState, useEffect } from 'react'
import Plot from 'react-plotly.js'
import { getMetrics } from '../services/api'

export default function Metrics() {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadMetrics()
  }, [])

  const loadMetrics = async () => {
    try {
      setLoading(true)
      const data = await getMetrics()
      setMetrics(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load metrics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy mx-auto mb-4"></div>
          <p className="text-gray-600">Loading metrics...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
        <p className="font-semibold">Error loading metrics</p>
        <p>{error}</p>
        <button
          onClick={loadMetrics}
          className="mt-4 px-4 py-2 bg-red text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">No metrics available.</p>
        <p className="text-sm text-gray-500">Please upload a file and run analysis from the Home page.</p>
      </div>
    )
  }

  const { metrics: m, top_influencers } = metrics

  // Prepare data for charts
  const influencerIds = top_influencers?.slice(0, 10).map((inf) => `Tweet ${inf.id}`) || []
  const degreeScores = top_influencers?.slice(0, 10).map((inf) => inf.degree_centrality) || []
  const betweennessScores = top_influencers?.slice(0, 10).map((inf) => inf.betweenness_centrality) || []
  const eigenvectorScores = top_influencers?.slice(0, 10).map((inf) => inf.eigenvector_centrality) || []
  const combinedScores = top_influencers?.slice(0, 10).map((inf) => inf.combined_score) || []

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-navy mb-2">Network Metrics</h1>
        <p className="text-gray-600">
          Key statistics and top influencers in the disaster information network
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <p className="text-sm text-gray-600 mb-2">Average Degree</p>
          <p className="text-3xl font-bold text-navy">{m.average_degree?.toFixed(3) || 'N/A'}</p>
          <p className="text-xs text-gray-500 mt-2" title="Average number of connections per node">
            Avg connections per node
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <p className="text-sm text-gray-600 mb-2">Graph Density</p>
          <p className="text-3xl font-bold text-cyan">{m.graph_density?.toFixed(4) || 'N/A'}</p>
          <p className="text-xs text-gray-500 mt-2" title="Ratio of actual edges to possible edges">
            Network connectivity
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <p className="text-sm text-gray-600 mb-2">Communities</p>
          <p className="text-3xl font-bold text-red">{m.num_communities || 'N/A'}</p>
          <p className="text-xs text-gray-500 mt-2" title="Number of detected information clusters">
            Information clusters
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <p className="text-sm text-gray-600 mb-2">Top Keyword</p>
          <p className="text-xl font-bold text-purple-600 truncate">{m.top_keyword || 'N/A'}</p>
          <p className="text-xs text-gray-500 mt-2" title="Most frequently discussed topic">
            Most discussed topic
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <p className="text-sm text-gray-600 mb-2">Average Path Length</p>
          <p className="text-3xl font-bold text-amber-600">{m.average_path_length?.toFixed(2) || 'N/A'}</p>
          <p className="text-xs text-gray-500 mt-2" title="Average hops needed for information to spread">
            Avg hops in network
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <p className="text-sm text-gray-600 mb-2">Network Diameter</p>
          <p className="text-3xl font-bold text-gray-900">{m.diameter ?? 'N/A'}</p>
          <p className="text-xs text-gray-500 mt-2" title="Longest shortest path between any two tweets">
            Maximum spread distance
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <p className="text-sm text-gray-600 mb-2">Avg Clustering</p>
          <p className="text-3xl font-bold text-green-700">{m.average_clustering?.toFixed(3) || 'N/A'}</p>
          <p className="text-xs text-gray-500 mt-2" title="Likelihood that neighbors are interconnected">
            Local cohesion
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <p className="text-sm text-gray-600 mb-2">Components</p>
          <p className="text-3xl font-bold text-indigo-600">{m.num_components ?? 'N/A'}</p>
          <p className="text-xs text-gray-500 mt-2" title="Number of disconnected sub-networks">
            Disconnected clusters
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Combined Score Chart */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-navy mb-4">Top 10 Influencers (Combined Score)</h2>
          <Plot
            data={[
              {
                x: influencerIds,
                y: combinedScores,
                type: 'bar',
                marker: { color: '#1E3A8A' },
              },
            ]}
            layout={{
              height: 400,
              xaxis: { title: 'Tweet ID' },
              yaxis: { title: 'Combined Centrality Score' },
              margin: { l: 60, r: 20, t: 20, b: 100 },
            }}
            config={{ displayModeBar: false }}
          />
        </div>

        {/* Degree Centrality Chart */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-navy mb-4">Degree Centrality</h2>
          <Plot
            data={[
              {
                x: influencerIds,
                y: degreeScores,
                type: 'bar',
                marker: { color: '#06B6D4' },
              },
            ]}
            layout={{
              height: 400,
              xaxis: { title: 'Tweet ID' },
              yaxis: { title: 'Degree Centrality' },
              margin: { l: 60, r: 20, t: 20, b: 100 },
            }}
            config={{ displayModeBar: false }}
          />
        </div>

        {/* Betweenness Centrality Chart */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-navy mb-4">Betweenness Centrality</h2>
          <Plot
            data={[
              {
                x: influencerIds,
                y: betweennessScores,
                type: 'bar',
                marker: { color: '#DC2626' },
              },
            ]}
            layout={{
              height: 400,
              xaxis: { title: 'Tweet ID' },
              yaxis: { title: 'Betweenness Centrality' },
              margin: { l: 60, r: 20, t: 20, b: 100 },
            }}
            config={{ displayModeBar: false }}
          />
        </div>

        {/* Eigenvector Centrality Chart */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-navy mb-4">Eigenvector Centrality</h2>
          <Plot
            data={[
              {
                x: influencerIds,
                y: eigenvectorScores,
                type: 'bar',
                marker: { color: '#10B981' },
              },
            ]}
            layout={{
              height: 400,
              xaxis: { title: 'Tweet ID' },
              yaxis: { title: 'Eigenvector Centrality' },
              margin: { l: 60, r: 20, t: 20, b: 100 },
            }}
            config={{ displayModeBar: false }}
          />
        </div>
      </div>

      {/* Top Influencers Table */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-navy mb-4">Top Influencers Details</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tweet ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Combined Score</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Degree</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Betweenness</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Eigenvector</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Community</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Keyword</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {top_influencers?.slice(0, 10).map((inf, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{inf.id}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{inf.combined_score.toFixed(4)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{inf.degree_centrality.toFixed(4)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{inf.betweenness_centrality.toFixed(4)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{inf.eigenvector_centrality.toFixed(4)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{inf.community}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 truncate max-w-xs">{inf.keyword || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

