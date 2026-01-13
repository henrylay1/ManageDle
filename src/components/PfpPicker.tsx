import { useEffect } from 'react';

interface PfpPickerProps {
  pfps: string[];
  onSelect: (url: string) => void;
  onClose: () => void;
}

export function PfpPicker({ pfps, onSelect, onClose }: PfpPickerProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={onClose}>
      <div className="modal-content pfp-picker-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Select a Profile Picture</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">
          <div className="pfp-grid">
            {pfps.map((url: string, idx: number) => (
              <img
                key={url + '-' + idx}
                src={url}
                alt="Profile"
                className="pfp-option"
                onClick={() => onSelect(url)}
              />
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
