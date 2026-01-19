# 🚨 CrisisNet – Social Network Analysis Platform for Disaster Information Flow

**Tagline:** *"Mapping the flow of critical information during disasters."*

CrisisNet is a research-grade web application that performs Social Network Analysis (SNA) on crisis-related posts (CSV uploads) and supports optional **live monitoring**. The platform identifies information clusters, detects key informers, and visualizes connectivity during emergencies.

---

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Dataset Format](#dataset-format)
- [SNA Metrics](#sna-metrics)
- [Screenshots](#screenshots)
- [Contributing](#contributing)
- [License](#license)

---

## ✨ Features

### 🧠 Data Handling & Graph Construction
- CSV file upload and parsing
- Text preprocessing (lowercase, URL removal, stopword removal)
- TF-IDF embeddings using scikit-learn
- Cosine similarity computation
- Graph construction with nodes (tweets) and edges (similarity/shared attributes)

### 📈 Social Network Analysis
- **Degree Centrality**: Measures direct connections
- **Betweenness Centrality**: Identifies bridge nodes
- **Eigenvector Centrality**: Measures influence through connections
- **Clustering Coefficient**: Measures local connectivity
- **Community Detection**: Louvain method for identifying information clusters

### 💬 Insights Generation
- Disaster vs non-disaster tweet counts
- Number of detected communities
- Top influencer identification with centrality scores
- Natural language summary of findings
- **Text insights**: topic/sentiment analysis utilities (served via API)
- **Geo insights**: hotspot summaries + map-ready data
- **Timeline**: temporal trend aggregation
- **Alert scoring**: risk/priority scoring and cross-validation hooks
- **Gov/official alerts**: normalized external signals + alignment summary (when available)

### ⚡ Live Monitoring (optional)
- Start/stop/status endpoints for live event capture
- WebSocket stream (`/ws/live`) for real-time dashboard updates

### 🌐 REST API (FastAPI)
- `POST /upload` - Upload CSV file
- `GET /analyze` - Build graph and compute metrics
- `GET /graph` - Get graph data (nodes & edges)
- `GET /summary` - Get textual insights
- `GET /metrics` - Get all computed metrics
- `GET /geo-insights` - Geospatial hotspot insights
- `GET /text-insights` - Topic/sentiment results
- `GET /alerts` - Alert scoring output (includes cross-validation fields when available)
- `GET /timeline` - Temporal trend data
- `GET /gov-alerts` - Official/government alert signals + alignment summary (when available)
- `POST /live/start` - Start live monitoring (requires credentials)
- `POST /live/stop` - Stop live monitoring
- `GET /live/status` - Live monitoring status + summary
- `WS /ws/live` - WebSocket for live updates
- `GET /download?format=csv|json` - Export results

### 🎨 Frontend Dashboard
- **Home/Upload**: File upload with dataset statistics
- **Graph View**: Interactive network visualization with Cytoscape.js
- **Metrics**: Bar charts and metric cards with Plotly
- **Insights**: Natural language summary with export functionality
- **Geo Map**: Leaflet-based geographic view
- **Live Dashboard**: real-time event feed and summary (optional; depends on credentials)
- **About**: Project documentation and SNA concepts

---

## 🧰 Tech Stack

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **TailwindCSS** - Utility-first CSS framework
- **Cytoscape.js** - Graph visualization
- **Plotly.js** - Data visualization charts
- **Axios** - HTTP client
- **React Router** - Client-side routing

### Backend
- **FastAPI** - Modern Python web framework
- **NetworkX** - Graph analysis library
- **scikit-learn** - Machine learning (TF-IDF, cosine similarity)
- **Pandas** - Data manipulation
- **python-louvain** - Community detection algorithm
- **Uvicorn** - ASGI server

---

## 📁 Project Structure

```
CrisisNet/
│
├── backend/
│   ├── main.py              # FastAPI application entry point
│   ├── routes.py            # API route handlers
│   ├── models.py            # Pydantic models and state management
│   ├── requirements.txt     # Python dependencies
│   └── utils/
│       └── graph_utils.py   # Graph construction and SNA utilities
│
├── frontend/
│   ├── src/
│   │   ├── pages/           # React page components
│   │   │   ├── Home.jsx
│   │   │   ├── GraphView.jsx
│   │   │   ├── Metrics.jsx
│   │   │   ├── Insights.jsx
│   │   │   └── About.jsx
│   │   ├── components/      # Reusable components
│   │   │   └── Navbar.jsx
│   │   ├── services/        # API service layer
│   │   │   └── api.js
│   │   ├── App.jsx          # Main app component
│   │   ├── main.jsx         # React entry point
│   │   └── index.css        # Global styles
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
│
└── README.md
```

---

## 🚀 Installation

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. (Optional) Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment variables by creating `backend/.env` (optional; needed for live monitoring):
   ```
   # Live monitoring (Twitter/X API)
   TWITTER_BEARER_TOKEN=your_token_here
   # Optional query override (defaults inside the service)
   # TWITTER_QUERY=(flood OR earthquake OR wildfire) lang:en -is:retweet

   # Enable/limit remote geocoding (defaults: true + 75 lookups per analysis)
   ENABLE_REMOTE_GEOCODER=true
   MAX_REMOTE_GEOCODER_LOOKUPS=75
   ```
   > Without `TWITTER_BEARER_TOKEN`, `POST /live/start` returns a 400 error.

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

---

## 💻 Usage

### Starting the Backend

From the `backend` directory:

```bash
python main.py
```

Or using uvicorn directly:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

API documentation (Swagger UI) is available at `http://localhost:8000/docs`

### Starting the Frontend

From the `frontend` directory:

```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Using the Application

1. **Upload Dataset**: Navigate to the Home page and upload a CSV file with the required format
2. **Run Analysis**: Click "Run Analysis" to build the graph and compute SNA metrics
3. **View Graph**: Navigate to "Graph View" to see the interactive network visualization
4. **Explore Metrics**: Check the "Metrics" page for detailed statistics and charts
5. **Read Insights**: Visit "Insights" for natural language summaries and export results
6. **Explore Geo / Live** (optional): Use "Geo Map" and "Live Dashboard" pages

---

## 🔌 API Endpoints

### `POST /upload`
Upload a CSV file for analysis.

**Request**: Multipart form data with `file` field

**Response**:
```json
{
  "message": "File uploaded successfully",
  "total_rows": 1000,
  "unique_keywords": 50,
  "unique_locations": 200,
  "disaster_tweets": 500,
  "non_disaster_tweets": 500
}
```

### `GET /analyze`
Build graph and compute SNA metrics.

**Response**:
```json
{
  "message": "Analysis complete",
  "metrics": {...},
  "top_influencers_count": 10
}
```

### `GET /graph`
Get graph data as JSON.

**Response**:
```json
{
  "nodes": [...],
  "edges": [...]
}
```

### `GET /summary`
Get textual insights and summary.

**Response**:
```json
{
  "summary": "CrisisNet analyzed...",
  "insights": [...]
}
```

### `GET /metrics`
Get all computed metrics and top influencers.

### `GET /download?format=csv|json`
Download analysis results as CSV or JSON.

### Live monitoring (optional)
- `POST /live/start`: start live ingestion (requires `TWITTER_BEARER_TOKEN`)
- `POST /live/stop`: stop ingestion
- `GET /live/status`: current status + summary
- `WS /ws/live`: real-time events for the frontend

---

## 📊 Dataset Format

The CSV file must contain the following columns:

- `id`: Unique tweet identifier
- `keyword`: Main topic/keyword of the tweet (e.g., "flood", "earthquake")
- `location`: User-reported location
- `text`: Tweet content
- `target`: 1 for disaster-related, 0 for non-disaster

**Example CSV:**
```csv
id,keyword,location,text,target
1,flood,New York,"Heavy rain causing flooding in downtown",1
2,fire,California,"Beautiful sunset today",0
```

---

## 📈 SNA Metrics Explained

### Degree Centrality
Measures the number of direct connections a node has. Higher values indicate tweets that are directly connected to many other tweets.

### Betweenness Centrality
Measures how often a node appears on shortest paths between other nodes. High betweenness indicates a bridge or connector in the network.

### Eigenvector Centrality
Measures influence based on connections to highly connected nodes. A node is important if it's connected to other important nodes.

### Clustering Coefficient
Measures how tightly connected a node's neighbors are. High values indicate tight-knit groups.

### Community Detection
Identifies clusters of nodes that are more densely connected to each other than to the rest of the network. Represents information clusters.

---

## 🎨 UI Design

The application uses a clean, modern design with:
- **Color Scheme**: Navy Blue (#1E3A8A), Cyan (#06B6D4), Red (#DC2626)
- **Fonts**: Poppins and Inter
- **Styling**: Rounded cards, soft shadows, clear legends
- **Responsive**: Works on desktop and tablet devices

---

## 🐛 Troubleshooting

### Backend Issues
- Ensure all Python dependencies are installed: `pip install -r requirements.txt`
- Check that port 8000 is not in use
- Verify CSV file format matches requirements

### Frontend Issues
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check that port 5173 is not in use
- Verify backend is running on port 8000

### Graph Visualization Issues
- Large datasets may take time to render. Consider using a sample subset for testing
- Browser performance may vary with very large graphs (>1000 nodes)

---

## 📝 Notes

- The similarity threshold for graph edges is set to 0.3 (configurable in `graph_utils.py`)
- Community detection uses the Louvain algorithm
- TF-IDF vectorization uses max_features=500 and includes bigrams
- Analysis results are stored in memory (not persisted to database)
- This repo ignores `*.csv` by default via `.gitignore`. If you want to commit datasets, remove that rule or add an exception for specific files.

---

## 🎯 Intended Use Cases

- Academic research on crisis communication
- IEEE paper demonstrations
- Hackathon projects
- Emergency management training
- Social media analysis for disaster response

---

## 📄 License

This project is provided as-is for educational and research purposes.

---

## 👥 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 🙏 Acknowledgments

- Kaggle Disaster Tweets dataset
- NetworkX community
- FastAPI and React communities

---

**Built with ❤️ for crisis communication research**

