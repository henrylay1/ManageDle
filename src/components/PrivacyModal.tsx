import { useEffect, useState } from 'react';
import { parseMarkdown } from '@/utils/markdownParser';
import '../styles/modals.css';
import './ChangelogModal.css';

interface PrivacyModalProps {
  onClose: () => void;
  onOpenTicket?: () => void;
}

export default function PrivacyModal({ onClose, onOpenTicket }: PrivacyModalProps) {
  const [content, setContent] = useState<string>('Loading...');

  useEffect(() => {
    let mounted = true;
    const localUrl = '/PRIVACY.md';
    const rawUrl = 'https://raw.githubusercontent.com/henrylay1/ManageDle/main/PRIVACY.md';

    const loadPrivacy = async () => {
      try {
        let res = await fetch(localUrl);
        if (!res.ok) {
          res = await fetch(rawUrl);
          if (!res.ok) throw new Error('Not found');
        }
        const md = await res.text();
        if (mounted) setContent(parseMarkdown(md));
      } catch (err) {
        console.error('Failed to load privacy file:', err);
        if (mounted) {
          const embedded = `# Privacy Policy\n\nLast updated: 2026-01-12\n\nManageDle respects your privacy. This version is embedded in the app as a fallback.`;
          setContent(parseMarkdown(embedded));
        }
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
          <div 
            className="changelog-content" 
            dangerouslySetInnerHTML={{ __html: content }}
            onClick={handleContentClick}
          />
        </div>
      </div>
    </div>
  );
}
