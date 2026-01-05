import { Game, GameRecord } from '@/types/models';
import './Modal.css';
import './Buttons.css';
import './RemoveModal.css';

interface RemoveModalProps {
  game: Game;
  record: GameRecord | undefined;
  onClose: () => void;
  onRemoveGame: () => void;
  onDeleteRecord: () => void;
  clearAllMode?: boolean;
}

function RemoveModal({ game, record, onClose, onRemoveGame, onDeleteRecord, clearAllMode }: RemoveModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{clearAllMode ? 'Clear All Games' : `Remove "${game.displayName}"`}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body"> 
          {clearAllMode ? (
            <div className="remove-options">
              <p style={{ marginBottom: '1.5rem', color: '#ccc' }}>
                Are you sure you want to remove all games from your active dailies?
              </p>
              <button 
                className="remove-option-btn remove-from-active"
                onClick={() => {
                  onRemoveGame();
                  onClose();
                }}
              >
                <span className="option-icon">🚫</span>
                <div className="option-text">
                  <strong>Yes, Clear All</strong>
                  <small>Remove all games from today's dailies</small>
                </div>
              </button>
              
              <button 
                className="remove-option-btn cancel"
                onClick={onClose}
              >
                <span className="option-icon">❌</span>
                <div className="option-text">
                  <strong>Cancel</strong>
                  <small>Don't change anything</small>
                </div>
              </button>
            </div>
          ) : (
          <div className="remove-options">
            <button 
              className="remove-option-btn remove-from-active"
              onClick={() => {
                onRemoveGame();
                onClose();
              }}
            >
              <span className="option-icon">🚫</span>
              <div className="option-text">
                <strong>Remove from Today's Games</strong>
                <small>Remove from your dailies, today's entry still exists</small>
              </div>
            </button>
            
            {record && (
              <button 
                className="remove-option-btn delete-entry"
                onClick={() => {
                  onDeleteRecord();
                  onClose();
                }}
              >
                <span className="option-icon">🗑️</span>
                <div className="option-text">
                  <strong>Delete Today's Entry</strong>
                  <small>Remove today's entry, game stays in your dailies</small>
                </div>
              </button>
             )}
            
            {record && (
              <button 
                className="remove-option-btn remove-both"
                onClick={() => {
                  onRemoveGame();
                  onDeleteRecord();
                  onClose();
                }}
              >
                <span className="option-icon">🗑️+🚫</span>
                <div className="option-text">
                  <strong>Remove & Delete Entry</strong>
                  <small>Remove from dailies and delete today's entry</small>
                </div>
              </button>
            )}
            
            <button 
              className="remove-option-btn cancel"
              onClick={onClose}
            >
              <span className="option-icon">❌</span>
              <div className="option-text">
                <strong>Cancel</strong>
                <small>Don't change anything</small>
              </div>
            </button>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RemoveModal;
