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
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }} onClick={onClose}>
      <div style={{
        background: 'var(--card-bg, white)', borderRadius: 12, padding: 24,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)', minWidth: 320, maxWidth: 480
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ marginBottom: 16 }}>Select a Profile Picture</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {pfps.map((url: string, idx: number) => (
            <img
              key={url + '-' + idx}
              src={url}
              alt="Profile"
              style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: '2px solid var(--border-color)' }}
              onClick={() => onSelect(url)}
            />
          ))}
        </div>
        <button style={{ marginTop: 24 }} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
