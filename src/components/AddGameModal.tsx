import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAppStore } from '@/store/appStore';
import { addGameSchema, type AddGameFormData } from '@/lib/validationSchemas';
import '../styles/modals.css';
import '../styles/forms.css';
import '../styles/buttons.css';
import './AddGameModal.css';

interface AddGameModalProps {
  onClose: () => void;
}

function AddGameModal({ onClose }: AddGameModalProps) {
  const { addGame } = useAppStore();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AddGameFormData>({
    resolver: zodResolver(addGameSchema),
    defaultValues: {
      icon: '🎮',
      isActive: true,
      isFailable: true,
    },
  });

  const onSubmit = async (data: AddGameFormData) => {
    setSubmitError('');
    try {
      await addGame({
        displayName: data.displayName.trim(),
        url: data.url.trim(),
        category: 'misc',
        icon: data.icon || '🎮',
        trackingType: 'automatic',
        isActive: data.isActive,
        isFailable: data.isFailable,
        resetTime: '00:00',
        isAsynchronous: true,
        scoreTypes: { puzzle1: { attempts: 6 } },
      });
      onClose();
    } catch (error) {
      console.error('Error adding game:', error);
      setSubmitError('Failed to add game. Please try again.');
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

        <form onSubmit={handleSubmit(onSubmit)} className="add-game-form">
          {submitError && (
            <div className="error-message" style={{ marginBottom: '1rem' }}>
              {submitError}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="displayName">
              Game Name <span className="required">*</span>
            </label>
            <input
              id="displayName"
              type="text"
              {...register('displayName')}
              placeholder="e.g., Wordle"
            />
            {errors.displayName && (
              <div className="error-message">{errors.displayName.message}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="url">
              Game URL <span className="required">*</span>
            </label>
            <input
              id="url"
              type="url"
              {...register('url')}
              placeholder="https://example.com/game"
            />
            {errors.url && (
              <div className="error-message">{errors.url.message}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="icon">Icon (emoji)</label>
            <input
              id="icon"
              type="text"
              {...register('icon')}
              placeholder="🎮"
              maxLength={4}
            />
          </div>

          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                {...register('isActive')}
              />
              <span>Add to active roster</span>
            </label>
          </div>

          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                {...register('isFailable')}
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
