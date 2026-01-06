import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { supabase } from '@/lib/supabase';
import { socialService } from '@/services/socialService';
import ActivityHeatmap from './ActivityHeatmap';
import { PfpPicker } from './PfpPicker';
import { UserProfileModal } from './UserProfileModal';
import './ProfilePage.css';

interface SocialConnection {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  isFriend: boolean;
}

export default function ProfilePage() {
  const [showPfpPicker, setShowPfpPicker] = useState(false);
  const [pfpOptions, setPfpOptions] = useState<string[]>([]);
  const updateProfile = useAppStore(state => state.updateProfile);
  const { user, authUser} = useAppStore();
  const [profileUser, setProfileUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);
  const [socialConnections, setSocialConnections] = useState<SocialConnection[]>([]);
  const [nestedProfile, setNestedProfile] = useState<{ userId: string; displayName: string; avatarUrl: string | null } | null>(null);
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
      if (!displayname) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, email, display_name, avatar_url')
        .eq('display_name', displayname)
        .single();
      if (error || !data) {
        setProfileUser(null);
        setCurrentAvatar(null);
        setIsLoading(false);
        return;
      }
      setProfileUser(data);
      setCurrentAvatar(data.avatar_url || null);
      
      // Fetch social connections
      const followingList = await socialService.getFollowingList(data.id, 50, 0);
      const mutualFriends = await socialService.getMutualFriends(data.id, 50, 0);
      console.log('[ProfilePage] Following list:', followingList);
      console.log('[ProfilePage] Mutual friends:', mutualFriends);
      const mutualFriendIds = new Set(mutualFriends.map((f: any) => f.id));
      console.log('[ProfilePage] Mutual friend IDs:', Array.from(mutualFriendIds));
      
      const connections: SocialConnection[] = followingList.map((user: any) => {
        const isFriend = mutualFriendIds.has(user.id);
        console.log(`[ProfilePage] User ${user.display_name} (${user.id}) - isFriend: ${isFriend}`);
        return {
          id: user.id,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          isFriend,
        };
      });
      
      setSocialConnections(connections);
      setIsLoading(false);
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

  if (isLoading) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <div className="profile-empty">
            <div className="loading-spinner"></div>
            <p>Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

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
                    objectFit: 'cover',
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

          {/* Friends & Following Section */}
          <section className="profile-section">
            <h2>Friends & Following</h2>
            {socialConnections.length === 0 ? (
              <div className="profile-social-list">
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>No following</p>
              </div>
            ) : (
              <div className="profile-social-list">
                {socialConnections.map(connection => {
                  const isImage = typeof connection.avatar_url === 'string' && 
                    (connection.avatar_url.startsWith('http://') || connection.avatar_url.startsWith('https://'));
                  return (
                    <div key={connection.id} className="profile-social-item">
                      <button
                        onClick={() => setNestedProfile({
                          userId: connection.id,
                          displayName: connection.display_name || 'Unknown',
                          avatarUrl: connection.avatar_url,
                        })}
                        className="profile-social-avatar-button"
                        title={`View ${connection.display_name || 'Unknown'}'s profile`}
                      >
                        {isImage ? (
                          <img
                            src={connection.avatar_url!}
                            alt={connection.display_name || 'User'}
                            className="profile-social-avatar"
                          />
                        ) : (
                          <div className="profile-social-avatar-placeholder">👤</div>
                        )}
                      </button>
                      <div className="profile-social-info">
                        <span className="profile-social-name">{connection.display_name || 'Unknown'}</span>
                        <span className={`profile-social-badge ${connection.isFriend ? 'friend' : 'following'}`}>
                          {connection.isFriend ? '👥 Friend' : '➡️ Following'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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

      {/* Nested Profile Modal */}
      {nestedProfile && (
        <UserProfileModal
          isOpen={!!nestedProfile}
          onClose={() => setNestedProfile(null)}
          userId={nestedProfile.userId}
          displayName={nestedProfile.displayName}
          avatarUrl={nestedProfile.avatarUrl}
        />
      )}
    </div>
  );
}
