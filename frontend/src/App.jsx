import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import GraphView from './pages/GraphView'
import Metrics from './pages/Metrics'
import Insights from './pages/Insights'
import GeoMap from './pages/GeoMap'
import LiveDashboard from './pages/LiveDashboard'
import About from './pages/About'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/graph" element={<GraphView />} />
            <Route path="/metrics" element={<Metrics />} />
            <Route path="/map" element={<GeoMap />} />
            <Route path="/live" element={<LiveDashboard />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App

