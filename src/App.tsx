import { useEffect } from 'react';
import { useAppStore } from './store/appStore';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  const { initialize, isLoading } = useAppStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading ManageDle...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Dashboard />
    </div>
  );
}

export default App;
