import { useEffect, useState } from 'react';
import { parseMarkdown } from '@/utils/markdownParser';
import '../styles/modals.css';
import './ChangelogModal.css';

interface PrivacyModalProps {
  onClose: () => void;
  onOpenTicket?: () => void;
}

export default function PrivacyModal({ onClose, onOpenTicket }: PrivacyModalProps) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadPrivacy = async () => {
      try {
        const res = await fetch('/PRIVACY.md');
        if (!res.ok) throw new Error('Not found');
        const md = await res.text();
        if (mounted) setContent(parseMarkdown(md));
      } catch (err) {
        console.error('Failed to load privacy file:', err);
        if (mounted) setError('<p>Cannot find tos</p>');
      }
    };

    loadPrivacy();
    return () => { mounted = false; };
  }, []);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'A' && target.getAttribute('href') === '#open-ticket') {
      e.preventDefault();
      onClose();
      onOpenTicket?.();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>Privacy & Terms</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body changelog-body">
          {content === null && !error ? (
            <div className="changelog-loading">Loading...</div>
          ) : (
            <div 
              className="changelog-content" 
              dangerouslySetInnerHTML={{ __html: error || content || '' }}
              onClick={handleContentClick}
            />
          )}
        </div>
      </div>
    </div>
  );
}
