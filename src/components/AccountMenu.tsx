import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/appStore';
import '../styles/modals.css';
import '../styles/buttons.css';

interface AccountMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountMenu: React.FC<AccountMenuProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
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

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay account-menu-overlay" onClick={handleOverlayClick}>
      <div className="modal-content">
        <button
          onClick={onClose}
          className="modal-close"
          aria-label="Close"
        >
          ×
        </button>

        <div className="modal-body">
          <h2 className="text-2xl font-bold mb-4">Account</h2>
          
          <div className="mb-6">
            <div className="flex items-center mb-4">
              <div className="relative mr-4">
                {isImage ? (
                  <img
                    src={authUser.avatarUrl || undefined}
                    alt="Profile"
                    className="w-16 h-16 rounded-full bg-black flex items-center justify-center text-3xl"
                    style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', background: 'black' }}
                    title="Profile picture"
                  />
                ) : (
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

          <div className="modal-actions">
            <button
              onClick={handleViewProfile}
              className="btn-primary"
            >
              View Profile
            </button>

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="btn-secondary"
            >
              {isLoggingOut ? 'Logging out...' : 'Log Out'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
