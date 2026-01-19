import { useState, useEffect, useRef, useMemo } from 'react'
import { getGraph } from '../services/api'

// Dynamically import cytoscape + layouts
let cytoscape = null
let coseBilkentRegistered = false

const loadCytoscape = async () => {
  if (typeof window !== 'undefined' && !cytoscape) {
    const cy = await import('cytoscape')
    cytoscape = cy.default
  }
  return cytoscape
}

const ensureCoseBilkent = async () => {
  if (!cytoscape || coseBilkentRegistered) return
  const plugin = await import('cytoscape-cose-bilkent')
  cytoscape.use(plugin.default || plugin)
  coseBilkentRegistered = true
}

export default function GraphView() {
  const [graphData, setGraphData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [minWeight, setMinWeight] = useState(0)
  const [edgeFilters, setEdgeFilters] = useState({
    similarity: true,
    shared_keyword: true,
    shared_location: true,
  })
  const [layoutType, setLayoutType] = useState('cose')
  const cyRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    loadGraph()
  }, [])

  useEffect(() => {
    loadCytoscape().then(async () => {
      if (layoutType === 'cose-bilkent') {
        await ensureCoseBilkent()
      }
      if (graphData && containerRef.current) {
        renderGraph()
      }
    })
  }, [graphData, minWeight, edgeFilters, layoutType])

  const loadGraph = async () => {
    try {
      setLoading(true)
      const data = await getGraph()
      setGraphData(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load graph data')
    } finally {
      setLoading(false)
    }
  }

  const filteredEdges = useMemo(() => {
    if (!graphData) return []
    const activeTypes = Object.entries(edgeFilters)
      .filter(([, enabled]) => enabled)
      .map(([type]) => type)
    return graphData.edges.filter(
      (edge) => activeTypes.includes(edge.type) && (edge.weight || 0) >= minWeight,
    )
  }, [graphData, minWeight, edgeFilters])

  const renderGraph = async () => {
    if (!graphData || !containerRef.current) {
      return
    }

    // Ensure cytoscape is loaded
    const cy = await loadCytoscape()
    if (!cy) {
      return
    }
    cytoscape = cy

    // Destroy existing instance
    if (cyRef.current) {
      cyRef.current.destroy()
    }

    const elements = []
    graphData.nodes.forEach((node) => {
      elements.push({
        data: {
          id: node.id,
          label: node.label,
          keyword: node.keyword,
          location: node.location,
          target: node.target,
          community: node.community,
          degree: node.degree || 0,
          degree_centrality: node.degree_centrality || 0,
          betweenness_centrality: node.betweenness_centrality || 0,
          eigenvector_centrality: node.eigenvector_centrality || 0,
          clustering_coefficient: node.clustering_coefficient || 0,
          average_path_length: node.average_path_length || 0,
          text: node.text,
        },
      })
    })

    filteredEdges.forEach((edge) => {
      elements.push({
        data: {
          id: `${edge.source}-${edge.target}`,
          source: edge.source,
          target: edge.target,
          weight: edge.weight || 0.5,
          type: edge.type || 'similarity',
          path_length: edge.path_length || 1,
          is_direct: edge.is_direct !== undefined ? edge.is_direct : true,
          label: `W:${(edge.weight || 0.5).toFixed(2)}`,
        },
      })
    })

    // Get unique communities for color mapping
    const communities = [...new Set(graphData.nodes.map((n) => n.community))].filter((c) => c !== -1)
    const communityColors = [
      '#1E3A8A', '#06B6D4', '#DC2626', '#10B981', '#F59E0B',
      '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1',
    ]

    const layoutOptions = getLayoutOptions(layoutType)

    // Create Cytoscape instance
    cyRef.current = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': (ele) => {
              const community = ele.data('community')
              if (community === -1 || community === undefined) return '#94A3B8'
              const colorIndex = communities.indexOf(community) % communityColors.length
              return communityColors[colorIndex]
            },
            'label': (ele) => {
              const degree = ele.data('degree') || 0
              return `N${ele.data('id')}\nD:${degree}`
            },
            'width': (ele) => {
              const degree = ele.data('degree') || 0
              return Math.max(30, Math.min(80, 30 + degree * 15))
            },
            'height': (ele) => {
              const degree = ele.data('degree') || 0
              return Math.max(30, Math.min(80, 30 + degree * 15))
            },
            'text-valign': 'center',
            'text-halign': 'center',
            'color': '#ffffff',
            'font-size': '9px',
            'text-wrap': 'wrap',
            'text-max-width': '100px',
            'border-width': 3,
            'border-color': (ele) => {
              const target = ele.data('target')
              return target === 1 ? '#DC2626' : '#10B981'  // Red for disaster, green for non-disaster
            },
          },
        },
        {
          selector: 'edge',
          style: {
            'width': (ele) => Math.max(1, ele.data('weight') * 5),
            'line-color': (ele) => {
              const type = ele.data('type')
              if (type === 'similarity') return '#3B82F6'  // Blue for similarity
              if (type === 'shared_keyword') return '#10B981'  // Green for keyword
              if (type === 'shared_location') return '#F59E0B'  // Orange for location
              return '#94A3B8'
            },
            'opacity': (ele) => Math.max(0.4, Math.min(1.0, ele.data('weight'))),
            'curve-style': 'bezier',
            'label': 'data(label)',
            'text-rotation': 'autorotate',
            'text-margin-y': -10,
            'font-size': '9px',
            'text-background-color': '#ffffff',
            'text-background-opacity': 0.8,
            'text-background-padding': '2px',
            'text-border-color': '#94A3B8',
            'text-border-width': 1,
            'text-border-opacity': 0.5,
            'color': '#1F2937',
            'font-weight': 'bold',
          },
        },
      ],
      layout: layoutOptions,
    })

    // Add hover effects (simplified - tooltip via title attribute)
    cyRef.current.on('mouseover', 'node', (evt) => {
      const node = evt.target
      node.style('border-width', 4)
      node.style('border-color', '#F59E0B')
    })

    cyRef.current.on('mouseout', 'node', (evt) => {
      const node = evt.target
      node.style('border-width', 2)
      node.style('border-color', '#ffffff')
    })

    // Add hover tooltip for edges
    cyRef.current.on('mouseover', 'edge', (evt) => {
      const edge = evt.target
      edge.style('width', Math.max(3, edge.data('weight') * 8))
      edge.style('opacity', 1.0)
    })

    cyRef.current.on('mouseout', 'edge', (evt) => {
      const edge = evt.target
      edge.style('width', Math.max(1, edge.data('weight') * 5))
      edge.style('opacity', Math.max(0.4, Math.min(1.0, edge.data('weight'))))
    })

    // Add click handler to show detailed node info
    cyRef.current.on('tap', 'node', (evt) => {
      const node = evt.target
      const data = node.data()
      const info = `=== NODE DETAILS ===\n` +
        `ID: ${data.id}\n` +
        `Keyword: ${data.keyword || 'N/A'}\n` +
        `Location: ${data.location || 'N/A'}\n` +
        `Type: ${data.target === 1 ? 'Disaster' : 'Non-Disaster'}\n` +
        `Community: ${data.community !== -1 ? data.community : 'N/A'}\n\n` +
        `=== CONNECTIVITY ===\n` +
        `Degree (Connections): ${data.degree || 0}\n` +
        `Degree Centrality: ${(data.degree_centrality || 0).toFixed(4)}\n` +
        `Betweenness Centrality: ${(data.betweenness_centrality || 0).toFixed(4)}\n` +
        `Eigenvector Centrality: ${(data.eigenvector_centrality || 0).toFixed(4)}\n` +
        `Clustering Coefficient: ${(data.clustering_coefficient || 0).toFixed(4)}\n` +
        `Avg Path Length: ${(data.average_path_length || 0).toFixed(2)}\n\n` +
        `Text: ${(data.text || '').substring(0, 200)}`
      alert(info)
    })

    // Add click handler to show edge info
    cyRef.current.on('tap', 'edge', (evt) => {
      const edge = evt.target
      const data = edge.data()
      const info = `=== EDGE DETAILS ===\n` +
        `Source: ${data.source}\n` +
        `Target: ${data.target}\n` +
        `Weight: ${(data.weight || 0.5).toFixed(4)}\n` +
        `Type: ${data.type || 'similarity'}\n` +
        `Path Length: ${data.path_length || 1}\n` +
        `Direct Connection: ${data.is_direct ? 'Yes' : 'No'}`
      alert(info)
    })
  }

  const getLayoutOptions = (type) => {
    switch (type) {
      case 'cose-bilkent':
        return {
          name: 'cose-bilkent',
          fit: true,
          padding: 40,
          idealEdgeLength: 120,
          gravityRangeCompound: 1.2,
          gravityCompound: 1.0,
        }
      case 'concentric':
        return {
          name: 'concentric',
          fit: true,
          padding: 30,
          minNodeSpacing: 20,
          startAngle: (3 / 2) * Math.PI,
        }
      case 'grid':
        return {
          name: 'grid',
          fit: true,
          padding: 20,
          avoidOverlap: true,
        }
      default:
        return {
          name: 'cose',
          idealEdgeLength: 120,
          nodeOverlap: 10,
          refresh: 20,
          fit: true,
          padding: 40,
          randomize: false,
          componentSpacing: 120,
          nodeRepulsion: 800000,
          edgeElasticity: 150,
          gravity: 80,
          numIter: 1000,
          initialTemp: 200,
          coolingFactor: 0.95,
          minTemp: 1.0,
        }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy mx-auto mb-4"></div>
          <p className="text-gray-600">Loading graph data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
        <p className="font-semibold">Error loading graph</p>
        <p>{error}</p>
        <button
          onClick={loadGraph}
          className="mt-4 px-4 py-2 bg-red text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!graphData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">No graph data available.</p>
        <p className="text-sm text-gray-500">Please upload a file and run analysis from the Home page.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-navy mb-2">Graph Visualization</h1>
        <p className="text-gray-600">
          Interactive network graph showing tweet relationships with comprehensive metrics. 
          Nodes display degree, centrality measures, and path lengths. Edges show weights, 
          types, and connection information. Click on nodes or edges to view detailed metrics.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="mb-4 flex justify-between items-center flex-wrap gap-4">
          <div className="text-sm text-gray-600 space-y-1">
            <div>
              <span className="font-semibold">{graphData.nodes.length}</span> nodes,{' '}
              <span className="font-semibold">{graphData.edges.length}</span> edges
            </div>
            <div className="text-xs text-gray-500">
              {graphData.edges.filter(e => e.type === 'similarity').length} similarity edges,{' '}
              {graphData.edges.filter(e => e.type === 'shared_keyword').length} keyword edges,{' '}
              {graphData.edges.filter(e => e.type === 'shared_location').length} location edges
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadGraph}
              className="px-3 py-2 bg-cyan text-navy rounded-lg hover:bg-cyan-600 text-xs font-semibold"
            >
              Refresh
            </button>
            <button
              onClick={renderGraph}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200"
            >
              Re-run layout
            </button>
          </div>
        </div>
        <div className="grid md:grid-cols-[260px_1fr] gap-4">
          <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 space-y-4">
            <div>
              <p className="text-xs uppercase text-gray-500">Edge weight filter</p>
              <div className="flex items-center gap-3 mt-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={minWeight}
                  onChange={(e) => setMinWeight(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-semibold">{minWeight.toFixed(2)}</span>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500">Edge types</p>
              {['similarity', 'shared_keyword', 'shared_location'].map((type) => (
                <label key={type} className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                  <input
                    type="checkbox"
                    checked={edgeFilters[type]}
                    onChange={() =>
                      setEdgeFilters((prev) => ({ ...prev, [type]: !prev[type] }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-cyan focus:ring-cyan"
                  />
                  {type.replace('_', ' ')}
                </label>
              ))}
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500">Layout</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {['cose', 'cose-bilkent', 'concentric', 'grid'].map((layout) => (
                  <button
                    key={layout}
                    onClick={() => setLayoutType(layout)}
                    className={`px-3 py-1 text-xs rounded-full ${
                      layoutType === layout
                        ? 'bg-navy text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {layout}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div
            ref={containerRef}
            className="w-full h-[600px] border border-gray-200 rounded-lg"
            style={{ minHeight: '600px' }}
          ></div>
        </div>
      </div>

      <div className="mt-6 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-navy mb-4">Graph Information & Legend</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="font-semibold mb-2 text-navy">Node Size</p>
            <p className="text-gray-600 mb-1">Larger nodes have more connections (higher degree)</p>
            <p className="text-gray-500 text-xs">Label shows: Node ID and Degree</p>
          </div>
          <div>
            <p className="font-semibold mb-2 text-navy">Node Color</p>
            <p className="text-gray-600 mb-1">Different colors represent different communities</p>
            <p className="text-gray-500 text-xs">Border: Red = Disaster, Green = Non-Disaster</p>
          </div>
          <div>
            <p className="font-semibold mb-2 text-navy">Edge Width</p>
            <p className="text-gray-600 mb-1">Thicker edges indicate stronger weight/similarity</p>
            <p className="text-gray-500 text-xs">Label shows weight value</p>
          </div>
          <div>
            <p className="font-semibold mb-2 text-navy">Edge Colors</p>
            <p className="text-gray-600 mb-1">Blue = Similarity, Green = Shared Keyword, Orange = Shared Location</p>
            <p className="text-gray-500 text-xs">Click nodes/edges for detailed metrics</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-300">
          <p className="font-semibold mb-2 text-navy">Available Metrics</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
            <div>• Degree (Connections)</div>
            <div>• Degree Centrality</div>
            <div>• Betweenness Centrality</div>
            <div>• Eigenvector Centrality</div>
            <div>• Clustering Coefficient</div>
            <div>• Average Path Length</div>
            <div>• Edge Weights</div>
            <div>• Path Lengths</div>
          </div>
        </div>
      </div>
    </div>
  )
}

