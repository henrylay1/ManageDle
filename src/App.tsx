import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAppStore } from './store/appStore';
import Dashboard from './components/Dashboard';
import ProfilePage from '@/components/ProfilePage';
import { supabase } from '@/lib/supabase';
import './App.css';

function App() {
  const { initialize, isLoading } = useAppStore();
  const [verificationComplete, setVerificationComplete] = useState(false);

  useEffect(() => {
    // Handle email verification callback from Supabase
    // When user clicks verification link, Supabase redirects to emailRedirectTo with hash params
    // like #type=email_confirm&token_hash=...
    const handleEmailConfirmation = async () => {
      const hash = window.location.hash.substring(1);
      
      if (!hash) {
        // No hash params, just mark complete to trigger initialize
        setVerificationComplete(true);
        return;
      }

      const params = new URLSearchParams(hash);
      const type = params.get('type');
      const tokenHash = params.get('token_hash');
      
      // Email verification callback
      if (type === 'email_confirm' && tokenHash) {
        try {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'email',
          });
          
          if (error) {
            console.error('Email verification failed:', error.message);
          } else {
            console.log('✓ Email verified successfully!');
            console.log('User logged in:', data.user?.email);
            // Clear the hash to clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } catch (err) {
          console.error('Error verifying email:', err);
        }
      }
      
      // Mark verification as complete to trigger initialize
      setVerificationComplete(true);
    };
    
    handleEmailConfirmation();
  }, []);

  useEffect(() => {
    if (verificationComplete) {
      initialize();
    }
  }, [verificationComplete, initialize]);

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
