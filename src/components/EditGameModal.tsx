import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { Game } from '@/types/models';
import './AddGameModal.css';

interface EditGameModalProps {
  game: Game;
  onClose: () => void;
}

function EditGameModal({ game, onClose }: EditGameModalProps) {
  const { updateGame, deleteGame } = useAppStore();
  
  const [displayName, setDisplayName] = useState(game.displayName);
  const [url, setUrl] = useState(game.url);
  const [icon, setIcon] = useState(game.icon || '🎮');
  const [isActive, setIsActive] = useState(game.isActive);
  const [isFailable, setIsFailable] = useState(game.isFailable);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName.trim() || !url.trim()) {
      alert('Please fill in the required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      await updateGame(game.gameId, {
        displayName: displayName.trim(),
        url: url.trim(),
        icon,
        isActive,
        isFailable,
      });

      onClose();
    } catch (error) {
      console.error('Error updating game:', error);
      alert('Failed to update game. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${game.displayName}"? This will also delete all related records.`)) {
      return;
    }

    setIsSubmitting(true);

    try {
      await deleteGame(game.gameId);
      onClose();
    } catch (error) {
      console.error('Error deleting game:', error);
      alert('Failed to delete game. Please try again.');
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
          <h2>✏️ Edit Game</h2>
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
              <span>Add to dailies</span>
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
              className="btn-danger"
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              🗑️ Delete
            </button>
            <div style={{ flex: 1 }}></div>
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
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditGameModal;
