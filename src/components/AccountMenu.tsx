import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { PfpOverlay } from './PfpOverlay';
import './GameCard.css';

interface AccountMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountMenu: React.FC<AccountMenuProps> = ({ isOpen, onClose }) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showPfpOverlay, setShowPfpOverlay] = useState(false);
  
  const authUser = useAppStore(state => state.authUser);
  const isAuthenticated = useAppStore(state => state.isAuthenticated);
  const logout = useAppStore(state => state.logout);
  const updateProfile = useAppStore(state => state.updateProfile);
  
  // Use emoji from authUser.avatarUrl or default to smile
  const [selectedEmoji, setSelectedEmoji] = useState(authUser?.avatarUrl || '😊');

  const handleEmojiSelect = async (emoji: string) => {
    setSelectedEmoji(emoji);
    
    if (authUser) {
      try {
        await updateProfile(authUser.displayName || authUser.email, emoji);
      } catch (error) {
        console.error('Failed to update profile picture:', error);
      }
    }
  };

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

  if (!isOpen || !isAuthenticated || !authUser) return null;

  // Show PfpOverlay instead of AccountMenu when pfp overlay is active
  if (showPfpOverlay) {
    return (
      <PfpOverlay
        onBackToMenu={() => setShowPfpOverlay(false)}
        onCloseAll={onClose}
        onEmojiSelect={handleEmojiSelect}
        currentEmoji={selectedEmoji}
      />
    );
  }

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
    }} onClick={onClose}>
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
          onClick={onClose}
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
              <button
                onClick={() => setShowPfpOverlay(true)}
                className="w-16 h-16 rounded-full bg-black flex items-center justify-center text-3xl hover:opacity-80 transition-opacity cursor-pointer"
                title="Click to change profile picture"
              >
                {selectedEmoji}
              </button>
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
