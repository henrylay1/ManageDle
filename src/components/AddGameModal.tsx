import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import '../styles/modals.css';
import '../styles/forms.css';
import '../styles/buttons.css';
import './AddGameModal.css';

interface AddGameModalProps {
  onClose: () => void;
}

function AddGameModal({ onClose }: AddGameModalProps) {
  const { addGame } = useAppStore();
  
  const [displayName, setDisplayName] = useState('');
  const [url, setUrl] = useState('');
  const [icon, setIcon] = useState('🎮');
  const [isActive, setIsActive] = useState(true);
  const [isFailable, setIsFailable] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName.trim() || !url.trim()) {
      alert('Please fill in the required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      await addGame({
        displayName: displayName.trim(),
        url: url.trim(),
        category: 'misc',
        icon,
        trackingType: 'automatic',
        isActive,
        isFailable,
        resetTime: '00:00', // Default to midnight UTC
        isAsynchronous: true,
        scoreTypes: { puzzle1: { attempts: 6 } }, // Default, should be customized as needed
      });

      onClose();
    } catch (error) {
      console.error('Error adding game:', error);
      alert('Failed to add game. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content add-game-modal">
        <div className="modal-header">
          <h2>➕ Add New Game</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="add-game-form">
          <div className="form-group">
            <label htmlFor="displayName">
              Game Name <span className="required">*</span>
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Wordle"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="url">
              Game URL <span className="required">*</span>
            </label>
            <input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/game"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="icon">Icon (emoji)</label>
            <input
              id="icon"
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🎮"
              maxLength={4}
            />
          </div>

          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span>Add to active roster</span>
            </label>
          </div>

          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isFailable}
                onChange={(e) => setIsFailable(e.target.checked)}
              />
              <span>Can be failed (has limited attempts)</span>
            </label>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Adding...' : 'Add Game'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddGameModal;
