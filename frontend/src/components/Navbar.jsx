import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const location = useLocation()

  const isActive = (path) => location.pathname === path

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/graph', label: 'Graph View' },
    { path: '/metrics', label: 'Metrics' },
    { path: '/map', label: 'Geo Map' },
    { path: '/live', label: 'Live' },
    { path: '/insights', label: 'Insights' },
    { path: '/about', label: 'Gov & Data' },
  ]

  return (
    <nav className="bg-navy text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold">🚨 CrisisNet</span>
            <span className="text-sm text-cyan-300 hidden md:inline">
              Mapping the flow of critical information during disasters
            </span>
          </Link>
          <div className="flex space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  isActive(link.path)
                    ? 'bg-cyan text-navy font-semibold'
                    : 'hover:bg-navy-800'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}

