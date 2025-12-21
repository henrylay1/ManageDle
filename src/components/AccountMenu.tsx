import React, { useState } from 'react';
import { useAppStore } from '@/store/appStore';

interface AccountMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountMenu: React.FC<AccountMenuProps> = ({ isOpen, onClose }) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const authUser = useAppStore(state => state.authUser);
  const isAuthenticated = useAppStore(state => state.isAuthenticated);
  const logout = useAppStore(state => state.logout);
  const updateProfile = useAppStore(state => state.updateProfile);
  
  // Use emoji from authUser.avatarUrl or default to smile
  const [selectedEmoji, setSelectedEmoji] = useState(authUser?.avatarUrl || '😊');

  const availableEmojis = ['😊', '😢', '😭', '😎', '🤓', '😴', '🤔', '😂', '🥳', '😍'];

  const handleEmojiSelect = async (emoji: string) => {
    setSelectedEmoji(emoji);
    setShowEmojiPicker(false);
    
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
        color: 'black'
      }} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4">Account</h2>
        
        <div className="mb-6">
          <div className="flex items-center mb-4">
            <div className="relative mr-4">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="w-16 h-16 rounded-full bg-black flex items-center justify-center text-3xl hover:opacity-80 transition-opacity cursor-pointer"
                title="Click to change profile picture"
              >
                {selectedEmoji}
              </button>
              
              {showEmojiPicker && (
                <div className="absolute top-full left-0 mt-2 p-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50 grid grid-cols-5 gap-2">
                  {availableEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleEmojiSelect(emoji)}
                      className="w-10 h-10 text-2xl hover:bg-gray-100 rounded transition-colors flex items-center justify-center"
                    >
                      {emoji}
                    </button>
                  ))}
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
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed mb-2"
        >
          {isLoggingOut ? 'Logging out...' : 'Log Out'}
        </button>

        <button
          onClick={onClose}
          className="w-full text-gray-600 hover:text-gray-800"
        >
          Close
        </button>
      </div>
    </div>
  );
};
