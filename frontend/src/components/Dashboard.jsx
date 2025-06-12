import { useState, useEffect, useCallback, memo, Suspense, lazy } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { db, analytics } from '../config/firebase';
import { VirtualList } from 'react-tiny-virtual-list';
import { FixedSizeList as List } from 'react-window';
import { useVirtualization, useDebounce } from '../hooks/useOptimization';
import { PerformanceMetrics } from '../config/performance';
import { VoiceChat } from './VoiceChat';
import { Link } from 'react-router-dom';

// Lazy load sub-pages
const PersonaPage = lazy(() => import('./pages/PersonaPage'));
const KnowledgePage = lazy(() => import('./pages/KnowledgePage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const SetupPage = lazy(() => import('./pages/SetupPage'));

// --- Icon Components ---
const Bot = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>);
const ChevronRight = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>);
const BookUser = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><circle cx="12" cy="10" r="2"/><path d="M12 12v3a2 2 0 0 0 4 0"/></svg>);
const BarChart3 = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>);
const Settings = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l-.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1-1-1.73l-.43-.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73-2.73l-.15-.1a2 2 0 0 1 0 2l.15.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>);

// Add loading skeleton component
const Skeleton = ({ className }) => (
  <div className={`animate-pulse bg-gray-700/50 rounded ${className}`}></div>
);

// Error Fallback component
const ErrorFallback = ({ error, resetErrorBoundary }) => (
  <div className="p-6 bg-red-900/20 rounded-lg">
    <h3 className="text-xl font-bold text-red-400">Something went wrong:</h3>
    <pre className="mt-2 text-sm text-red-300">{error.message}</pre>
    <button 
      onClick={resetErrorBoundary}
      className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
    >
      Try again
    </button>
  </div>
);

// Performance monitoring HOC
const withPerformanceMonitoring = (WrappedComponent, componentName) => {
  return function WithPerformanceMonitoring(props) {
    useEffect(() => {
      const start = performance.now();
      return () => {
        const duration = performance.now() - start;
        logEvent(analytics, 'component_render_time', {
          component: componentName,
          duration_ms: duration
        });
      };
    }, []);

    return <WrappedComponent {...props} />;
  };
};

// Dashboard Content Component
const DashboardContent = memo(({ children }) => {
  const endMeasure = PerformanceMetrics.markAndMeasure('dashboard_render');
  
  useEffect(() => {
    return () => endMeasure();
  }, []);

  return (
    <div className="relative">
      {children}
      <div className="fixed bottom-4 right-4 z-50">
        <FloatingActionButton 
          icon={<Bot className="h-6 w-6 text-white" />}
          onClick={() => setShowHelp(true)}
        />
      </div>
    </div>
  );
});

export default function Dashboard() {
  const [page, setPage] = useState('persona');
  const businessId = "restaurant_123";

  const NavItem = memo(({ icon, label, pageName }) => (
    <button 
      onClick={() => setPage(pageName)} 
      className={`flex items-center w-full px-4 py-3 text-left text-lg rounded-lg transition-all duration-200
        ${page === pageName 
          ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25' 
          : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'}`}
    >
      {icon}
      <span className="ml-4">{label}</span>
      <ChevronRight className={`ml-auto h-5 w-5 transition-transform duration-200 ${page === pageName ? 'rotate-90' : ''}`} />
    </button>
  ));

  const renderPage = () => {
    const PageComponent = {
      persona: PersonaPage,
      knowledge: KnowledgePage,
      analytics: AnalyticsPage,
      setup: SetupPage
    }[page];

    return (
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          {PageComponent && <PageComponent db={db} businessId={businessId} />}
        </Suspense>
      </ErrorBoundary>
    );
  };

  return (
    <div className="flex h-screen w-full bg-gradient-to-br from-gray-900 to-gray-800 text-gray-200 font-sans">
      <aside className="w-80 flex-shrink-0 bg-gray-800/50 backdrop-blur-xl p-6 flex flex-col border-r border-gray-700/50">
        <div className="flex items-center mb-12">
          <div className="p-3 bg-gradient-to-r from-blue-600 to-blue-500 rounded-full shadow-lg">
            <Bot className="h-8 w-8 text-white"/>
          </div>
          <h1 className="text-2xl font-bold ml-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Thalya</h1>
        </div>
        <nav className="flex flex-col space-y-3">
          <NavItem icon={<Bot className="h-6 w-6"/>} label="Persona de l'IA" pageName="persona" />
          <NavItem icon={<BookUser className="h-6 w-6"/>} label="Base de Connaissances" pageName="knowledge" />
          <NavItem icon={<BarChart3 className="h-6 w-6"/>} label="Analyses d'Appels" pageName="analytics" />
          <NavItem icon={<Settings className="h-6 w-6"/>} label="Configuration" pageName="setup" />
          <Link to="/analytics" className="nav-link">
            Analytics
          </Link>
        </nav>
        <div className="mt-auto text-sm text-gray-500"><p>&copy; 2025 Thalya AI</p></div>
      </aside>
      <main className="flex-1 overflow-y-auto p-12 custom-scrollbar">
        <DashboardContent>
          {renderPage()}
        </DashboardContent>
      </main>
      <VoiceChat />
    </div>
  );
}