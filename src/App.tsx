import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAppStore } from './store/appStore';
import Dashboard from './components/Dashboard';
import ProfilePage from '@/components/ProfilePage';
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
    <BrowserRouter basename="/">
      <div className="app">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/profile/:displayname" element={<ProfilePage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
