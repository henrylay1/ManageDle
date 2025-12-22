import React from 'react';
import './GameCard.css';

interface PfpOverlayProps {
  onBackToMenu: () => void;
  onCloseAll: () => void;
  onEmojiSelect: (emoji: string) => void;
  currentEmoji: string;
}

export const PfpOverlay: React.FC<PfpOverlayProps> = ({
  onBackToMenu,
  onCloseAll,
  onEmojiSelect,
  currentEmoji,
}) => {
  const availableEmojis = ['😊', '😢', '😭', '😎', '🤓', '😴', '🤔', '😂', '🥳', '😍'];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onCloseAll}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          width: '100%',
          maxWidth: '24rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          color: 'black',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onBackToMenu}
          className="btn-remove-game"
          style={{
            position: 'absolute',
            top: '1.5rem',
            right: '1.5rem',
          }}
          title="Back"
        >
          ❌
        </button>

        <h2 className="text-2xl font-bold mb-6">Choose Profile Picture</h2>

        <div className="grid grid-cols-5 gap-4 mb-6">
          {availableEmojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onEmojiSelect(emoji)}
              className={`w-16 h-16 text-3xl rounded-lg transition-all flex items-center justify-center ${
                emoji === currentEmoji
                  ? 'bg-blue-500 scale-110 ring-2 ring-blue-600'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
