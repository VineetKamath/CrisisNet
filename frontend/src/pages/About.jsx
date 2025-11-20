export default function About() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-navy mb-2">About CrisisNet</h1>
        <p className="text-xl text-cyan font-semibold">
          Mapping the flow of critical information during disasters
        </p>
      </div>

      <div className="space-y-8">
        {/* Project Description */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-semibold text-navy mb-4">Project Overview</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            CrisisNet is a research-grade Social Network Analysis (SNA) platform designed to 
            analyze information flow during disaster events. By processing disaster-related tweets, 
            the system identifies key informers, detects information clusters, and visualizes 
            the connectivity patterns that emerge during crises.
          </p>
          <p className="text-gray-700 leading-relaxed">
            This platform combines advanced natural language processing, graph theory, and 
            network analysis to provide actionable insights into how critical information 
            spreads through social networks during emergency situations.
          </p>
        </div>

        {/* Features */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-semibold text-navy mb-4">Key Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start space-x-3">
              <span className="text-2xl">📊</span>
              <div>
                <h3 className="font-semibold text-navy">Graph Construction</h3>
                <p className="text-sm text-gray-600">
                  Builds semantic networks using TF-IDF embeddings and cosine similarity
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-2xl">🔍</span>
              <div>
                <h3 className="font-semibold text-navy">Centrality Analysis</h3>
                <p className="text-sm text-gray-600">
                  Computes degree, betweenness, and eigenvector centrality metrics
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-2xl">👥</span>
              <div>
                <h3 className="font-semibold text-navy">Community Detection</h3>
                <p className="text-sm text-gray-600">
                  Identifies information clusters using Louvain algorithm
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-2xl">📈</span>
              <div>
                <h3 className="font-semibold text-navy">Visualization</h3>
                <p className="text-sm text-gray-600">
                  Interactive network graphs with Cytoscape.js
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-2xl">💡</span>
              <div>
                <h3 className="font-semibold text-navy">Insights Generation</h3>
                <p className="text-sm text-gray-600">
                  Natural language summaries of network findings
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-2xl">📥</span>
              <div>
                <h3 className="font-semibold text-navy">Export Results</h3>
                <p className="text-sm text-gray-600">
                  Download analysis results as CSV or JSON
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Dataset Info */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-semibold text-navy mb-4">Dataset Information</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            CrisisNet is designed to work with the <strong>Kaggle Disaster Tweets</strong> dataset. 
            The dataset contains tweets that have been classified as either disaster-related or 
            non-disaster related.
          </p>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-navy mb-2">Required CSV Format:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
              <li><strong>id</strong>: Unique tweet identifier</li>
              <li><strong>keyword</strong>: Main topic/keyword of the tweet</li>
              <li><strong>location</strong>: User-reported location</li>
              <li><strong>text</strong>: Tweet content</li>
              <li><strong>target</strong>: 1 for disaster-related, 0 for non-disaster</li>
            </ul>
          </div>
        </div>

        {/* SNA Concepts */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-semibold text-navy mb-4">Social Network Analysis Concepts</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-navy mb-2">What is SNA?</h3>
              <p className="text-gray-700 text-sm leading-relaxed">
                Social Network Analysis is a methodological approach to understanding relationships 
                and interactions between entities in a network. In CrisisNet, tweets are nodes, 
                and relationships (semantic similarity, shared keywords/locations) are edges.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-navy mb-2">Why is it useful for crisis communication?</h3>
              <p className="text-gray-700 text-sm leading-relaxed">
                During disasters, understanding how information flows through social networks helps 
                identify key informers, detect misinformation clusters, and optimize emergency 
                communication strategies. SNA reveals hidden patterns in information dissemination.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-navy mb-2">Key Metrics Explained</h3>
              <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
                <li>
                  <strong>Degree Centrality:</strong> Number of direct connections. 
                  Indicates how many other tweets a tweet is similar to.
                </li>
                <li>
                  <strong>Betweenness Centrality:</strong> Frequency of appearing on shortest paths. 
                  Identifies bridge nodes that connect different communities.
                </li>
                <li>
                  <strong>Eigenvector Centrality:</strong> Influence based on connections to 
                  influential nodes. Measures importance in the network.
                </li>
                <li>
                  <strong>Clustering Coefficient:</strong> Measures how tightly connected a node's 
                  neighbors are. High values indicate tight-knit groups.
                </li>
                <li>
                  <strong>Community Detection:</strong> Identifies groups of nodes that are more 
                  connected to each other than to the rest of the network.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-semibold text-navy mb-4">Technology Stack</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-cyan mb-3">Frontend</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• React 18 with Vite</li>
                <li>• TailwindCSS for styling</li>
                <li>• Cytoscape.js for graph visualization</li>
                <li>• Plotly.js for data charts</li>
                <li>• Axios for API communication</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-cyan mb-3">Backend</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• FastAPI for REST API</li>
                <li>• NetworkX for graph analysis</li>
                <li>• scikit-learn for NLP (TF-IDF)</li>
                <li>• Pandas for data processing</li>
                <li>• python-louvain for community detection</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Use Cases */}
        <div className="bg-cyan-50 rounded-lg p-8 border-l-4 border-cyan">
          <h2 className="text-2xl font-semibold text-navy mb-4">Intended Use Cases</h2>
          <ul className="space-y-2 text-gray-700">
            <li>• Academic research on crisis communication</li>
            <li>• IEEE paper demonstrations</li>
            <li>• Hackathon projects</li>
            <li>• Emergency management training</li>
            <li>• Social media analysis for disaster response</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

