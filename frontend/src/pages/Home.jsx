import { useState } from 'react'
import { uploadFile, analyze } from '../services/api'

export default function Home() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [uploadStats, setUploadStats] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile && selectedFile.name.endsWith('.csv')) {
      setFile(selectedFile)
      setError(null)
    } else {
      setError('Please select a CSV file')
      setFile(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first')
      return
    }

    setUploading(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await uploadFile(file)
      setUploadStats(result)
      setSuccess('File uploaded successfully!')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

  const handleAnalyze = async () => {
    if (!uploadStats) {
      setError('Please upload a file first')
      return
    }

    setAnalyzing(true)
    setError(null)

    try {
      await analyze()
      setSuccess('Analysis complete! Explore the tabs to view real-time insights.')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to analyze data')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="grid lg:grid-cols-2 gap-8 items-center">
        <div className="bg-gradient-to-br from-navy to-blue-900 text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-10 right-10 w-40 h-40 bg-cyan-300 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-400 rounded-full blur-3xl" />
          </div>
          <div className="relative space-y-6">
            <div className="inline-flex items-center space-x-2 bg-white/10 px-3 py-1 rounded-full text-xs uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span>Live SNA Console</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              See disasters before they trend.
            </h1>
            <p className="text-white/80 text-lg">
              Upload a dataset and let CrisisNet map information pathways, identify misinformation,
              and surface high-risk communities in seconds.
            </p>
            <div className="flex flex-wrap gap-3 text-sm text-white/80">
              <span className="bg-white/10 px-3 py-1 rounded-full">Real-time Graphs</span>
              <span className="bg-white/10 px-3 py-1 rounded-full">Alert Engine</span>
              <span className="bg-white/10 px-3 py-1 rounded-full">Geo Hotspots</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-navy">Upload & Analyze</h2>
              <p className="text-gray-500 text-sm">Secure, local, never leaves your machine.</p>
            </div>
            <span className="text-xs uppercase tracking-wide text-green-600 bg-green-50 px-2 py-1 rounded-full">
              Step 1 of 2
            </span>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dataset (CSV)</label>
              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center hover:border-cyan transition-colors">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan file:text-navy hover:file:bg-cyan-600 cursor-pointer"
                />
                <p className="text-xs text-gray-400 mt-2">
                  Columns required: id, keyword, location, text, target (+ optional timestamp)
                </p>
              </div>
            </div>

            {file && (
              <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between text-sm text-gray-600">
                <div>
                  <p className="font-semibold text-navy">{file.name}</p>
                  <p>{(file.size / 1024).toFixed(1)} KB selected</p>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="text-xs uppercase tracking-wide text-red-500 hover:text-red-600"
                >
                  Clear
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-4">
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="flex-1 min-w-[160px] px-6 py-3 bg-navy text-white rounded-2xl font-semibold hover:bg-navy-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? 'Uploading...' : 'Upload dataset'}
              </button>
              {uploadStats && (
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="flex-1 min-w-[160px] px-6 py-3 bg-cyan text-navy rounded-2xl font-semibold hover:bg-cyan-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {analyzing ? 'Analyzing...' : 'Run AI analysis'}
                </button>
              )}
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-2xl text-sm text-green-700">
                {success}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="grid md:grid-cols-3 gap-6">
        {[
          {
            title: 'Network Graph',
            copy: 'Interactive Cytoscape visualization of similarity, keyword, and location ties.',
          },
          {
            title: 'Alert Engine',
            copy: 'AI blended centrality + sentiment scoring to rank urgent signals instantly.',
          },
          {
            title: 'Geo Map',
            copy: 'Leaflet heatmap showing live disaster hotspots and risk ratios worldwide.',
          },
        ].map((item) => (
          <div key={item.title} className="bg-white rounded-2xl shadow-lg p-5 border border-gray-50">
            <p className="text-xs uppercase tracking-wide text-cyan-600 mb-2">Module</p>
            <h3 className="text-lg font-semibold text-navy">{item.title}</h3>
            <p className="text-sm text-gray-600 mt-2">{item.copy}</p>
          </div>
        ))}
      </section>

      {/* Stats */}
      {uploadStats && (
        <section className="bg-white rounded-3xl shadow-lg p-8 border border-gray-100">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-cyan-600">Dataset snapshot</p>
              <h2 className="text-2xl font-semibold text-navy">Clean. Validated. Ready.</h2>
            </div>
            <span className="text-xs px-3 py-1 bg-cyan-50 text-cyan-700 rounded-full font-semibold">
              Upload complete
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard label="Total Tweets" value={uploadStats.total_rows} color="text-navy" />
            <StatCard label="Disaster" value={uploadStats.disaster_tweets} color="text-red-600" />
            <StatCard
              label="Non-Disaster"
              value={uploadStats.non_disaster_tweets}
              color="text-green-600"
            />
            <StatCard
              label="Unique Keywords"
              value={uploadStats.unique_keywords}
              color="text-purple-600"
            />
          </div>
        </section>
      )}

      {/* Steps and format */}
      <section className="grid lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-3xl shadow-lg p-8 border border-gray-50">
          <h3 className="text-xl font-semibold text-navy mb-4">Launch sequence</h3>
          <ol className="space-y-4 text-sm text-gray-600">
            {[
              'Upload CSV dataset (tweets + metadata)',
              'Run analysis to generate graph + alerts + metrics',
              'Navigate to Graph, Metrics, Geo Map, Alerts tabs',
              'Download executive summary or export influencers',
            ].map((step, idx) => (
              <li key={step} className="flex items-start space-x-3">
                <span className="w-8 h-8 rounded-full bg-cyan text-navy font-semibold flex items-center justify-center">
                  {idx + 1}
                </span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="bg-gray-50 rounded-3xl p-8 border border-dashed border-gray-200">
          <h3 className="text-xl font-semibold text-navy mb-3">CSV blueprint</h3>
          <code className="block bg-white rounded-2xl p-4 border border-gray-100 text-sm text-gray-700">
            id, keyword, location, text, target, timestamp (optional)
          </code>
          <p className="text-sm text-gray-600 mt-4">
            <strong>target</strong>: 1 for disaster, 0 for non-disaster. Include{' '}
            <strong>timestamp</strong> (ISO format) for the temporal trendline. Location can be city,
            state, or region—CrisisNet geocodes it automatically.
          </p>
        </div>
      </section>
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div className="rounded-2xl border border-gray-100 p-5 bg-gradient-to-br from-white to-gray-50">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-2 ${color}`}>{value}</p>
    </div>
  )
}

