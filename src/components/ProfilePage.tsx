import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { supabase } from '@/lib/supabase';
import ActivityHeatmap from './ActivityHeatmap';
import { PfpPicker } from './PfpPicker';
import './ProfilePage.css';

export default function ProfilePage() {
  const [showPfpPicker, setShowPfpPicker] = useState(false);
  const [pfpOptions, setPfpOptions] = useState<string[]>([]);
  const updateProfile = useAppStore(state => state.updateProfile);
  const { user, authUser} = useAppStore();
  const [profileUser, setProfileUser] = useState<any>(null);
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);
  const navigate = useNavigate();
  const { displayname } = useParams();

  // Fetch available profile pictures from Supabase Storage
  useEffect(() => {
    async function fetchPfps() { 
      const { data, error } = await supabase.storage.from('profile-pictures').list('');
      if (error) {
        console.error('Error fetching profile pictures:', error);
        setPfpOptions([]);
        return;
      }
      const urls = (data || [])
        .filter(file => file.name.endsWith('.png') || file.name.endsWith('.jpg') || file.name.endsWith('.jpeg'))
        .map(file =>
          supabase.storage.from('profile-pictures').getPublicUrl(file.name).data.publicUrl
        );
      setPfpOptions(urls);
    }
    if (showPfpPicker) fetchPfps();
  }, [showPfpPicker]);

  const handleAvatarClick = () => {
    setShowPfpPicker(true);
  };

  const handlePfpSelect = async (url: string) => {
    setShowPfpPicker(false);
    if (authUser) {
      try {
        await updateProfile(authUser.displayName || authUser.email, url);
        setCurrentAvatar(url);
      } catch (error) {
        console.error('Failed to update profile picture:', error);
      }
    }
  };

  // Fetch profile for displayname from users table
  useEffect(() => {
    async function fetchProfile() {
      if (!displayname) return;
      const { data, error } = await supabase
        .from('users')
        .select('id, email, display_name, avatar_url')
        .eq('display_name', displayname)
        .single();
      if (error || !data) {
        setProfileUser(null);
        setCurrentAvatar(null);
        return;
      }
      setProfileUser(data);
      setCurrentAvatar(data.avatar_url || null);
    }
    fetchProfile();
  }, [displayname]);
  const [theme, setTheme] = useState(() => window.localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    // Sync theme from localStorage on mount (in case user refreshed)
    const storedTheme = window.localStorage.getItem('theme');
    if (storedTheme && storedTheme !== theme) {
      setTheme(storedTheme);
    }
  }, []);

  const handleBackToDashboard = () => {
    navigate('/');
  };

  if (!profileUser) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <div className="profile-empty">
            <h2>Profile Not Found</h2>
            <p>No user found for display name: {displayname}</p>
            <button className="btn-primary" onClick={handleBackToDashboard}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <header className="profile-header">
          <button className="back-button" onClick={handleBackToDashboard}>
            ← Back to Dashboard
          </button>
          
          <div className="profile-info">
            <div className="profile-avatar" style={{ cursor: profileUser.id === authUser?.id ? 'pointer' : 'default' }} onClick={profileUser.id === authUser?.id ? handleAvatarClick : undefined} title={profileUser.id === authUser?.id ? "Change profile picture" : undefined}>
              {currentAvatar ? (
                <img
                  src={currentAvatar}
                  alt="Profile"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '50%',
                  }}
                />
              ) : (
                <span className="text-gray-400">No Image</span>
              )}
            </div>
            {showPfpPicker && profileUser.id === authUser?.id && (
              <PfpPicker
                pfps={pfpOptions}
                onSelect={handlePfpSelect}
                onClose={() => setShowPfpPicker(false)}
              />
            )}
            <div className="profile-details">
              <h1>{profileUser.display_name || 'Anonymous'}</h1>
              {profileUser.id === authUser?.id && user && (
                <div className="profile-meta">
                  <span className="profile-id">ID: {user.userId || user.localId}</span>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="profile-content">
          <section className="profile-section">
            <ActivityHeatmap userId={profileUser.id} />
          </section>

          {/* Future sections can go here */}
          {/* 
          <section className="profile-section">
            <h2>Lifetime Statistics</h2>
            ...
          </section>
          
          <section className="profile-section">
            <h2>Achievements</h2>
            ...
          </section>
          */}
        </div>
      </div>
    </div>
  );
}
