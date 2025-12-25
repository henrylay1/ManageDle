import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/appStore';
import './GameCard.css';

interface AccountMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountMenu: React.FC<AccountMenuProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const handleClose = () => {
    onClose();
  };
  
  const authUser = useAppStore(state => state.authUser);
  const isAuthenticated = useAppStore(state => state.isAuthenticated);
  const logout = useAppStore(state => state.logout);
  
  // Show image if avatarUrl is a URL
  const isImage = typeof authUser?.avatarUrl === 'string' && (authUser.avatarUrl.startsWith('http://') || authUser.avatarUrl.startsWith('https://'));

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      onClose();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleViewProfile = () => {
    if (authUser?.displayName) {
      navigate(`/profile/${authUser.displayName}`);
    } else {
      navigate('/profile');
    }
    onClose();
  };

  if (!isOpen || !isAuthenticated || !authUser) return null;



  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }} onClick={handleClose}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '1.5rem',
        width: '100%',
        maxWidth: '28rem',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        color: 'black',
        position: 'relative',
      }} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleClose}
          className="btn-remove-game"
          style={{
            position: 'absolute',
            top: '1.5rem',
            right: '1.5rem',
          }}
          title="Close"
        >
          ❌
        </button>

        <h2 className="text-2xl font-bold mb-4">Account</h2>
        
        <div className="mb-6">
          <div className="flex items-center mb-4">
            <div className="relative mr-4">
              {isImage && (
                <img
                  src={authUser.avatarUrl || undefined}
                  alt="Profile"
                  className="w-16 h-16 rounded-full bg-black flex items-center justify-center text-3xl"
                  style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', background: 'black' }}
                  title="Profile picture"
                />
              )}
              {!isImage && (
                <div
                  className="w-16 h-16 rounded-full bg-black flex items-center justify-center text-3xl"
                  title="Profile picture"
                >
                  <span className="text-gray-400">No Image</span>
                </div>
              )}
            </div>
            
            <div>
              <p className="font-semibold text-lg">{authUser.displayName || 'User'}</p>
              <p className="text-sm text-gray-600">{authUser.email}</p>
            </div>
          </div>

          <div className="p-4 bg-green-100 text-green-700 rounded-md">
            <p className="text-sm">
              ☁️ Your data is synced to the cloud
            </p>
          </div>
        </div>

        <button
          onClick={handleViewProfile}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 mb-3"
        >
          View Profile
        </button>

        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoggingOut ? 'Logging out...' : 'Log Out'}
        </button>
      </div>
    </div>
  );
};
