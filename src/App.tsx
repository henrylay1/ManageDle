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
      <header className="app-header">
        <h1>ManageDle</h1>
        <p>Your daily puzzle hub</p>
      </header>
      <main className="app-main">
        <Dashboard />
      </main>
    </div>
  );
}

export default App;
