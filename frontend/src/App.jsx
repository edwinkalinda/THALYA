import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import './assets/index.css'
import { initializeMonitoring } from './config/monitoring'

// Preload the Dashboard component
const Dashboard = lazy(() => import('./components/Dashboard'))
const AnalyticsPage = lazy(() => import('./components/pages/AnalyticsPage'))

// Add preload hint
const preloadDashboard = () => {
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'script'
  link.href = './components/Dashboard.jsx'
  document.head.appendChild(link)
}

const LoadingFallback = () => (
  <div className="h-screen w-full flex items-center justify-center bg-gray-900">
    <div className="space-y-4 text-center">
      <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
      <p className="text-gray-400">Chargement de Thalya...</p>
    </div>
  </div>
);

function App() {
  useEffect(() => {
    initializeMonitoring();
    preloadDashboard();
  }, [])

  return (
    <Router>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Routes>
      </Suspense>
    </Router>
  )
}

export default App