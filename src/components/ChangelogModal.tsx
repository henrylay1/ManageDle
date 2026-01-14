import { useEffect, useState } from 'react';
import { parseMarkdown } from '@/utils/markdownParser';
import '../styles/modals.css';
import './ChangelogModal.css';

interface ChangelogModalProps {
  onClose: () => void;
}

export default function ChangelogModal({ onClose }: ChangelogModalProps) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const githubRaw = 'https://raw.githubusercontent.com/henrylay1/ManageDle/main/CHANGELOG.md';

    fetch(githubRaw)
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.text();
      })
      .then(md => {
        if (mounted) setContent(parseMarkdown(md));
      })
      .catch(err => {
        console.error('Failed to load changelog:', err);
        if (mounted) {
          setError(
            '<p style="color: #ef4444;">Unable to load changelog. Please check your connection or visit the ' +
            '<a href="https://github.com/henrylay1/ManageDle/blob/main/CHANGELOG.md" target="_blank" rel="noopener noreferrer">GitHub repository</a>.</p>'
          );
        }
      });

    return () => { mounted = false; };
  }, []);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>Changelog</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body changelog-body">
          {content === null && !error ? (
            <div className="changelog-loading">Loading...</div>
          ) : (
            <div className="changelog-content" dangerouslySetInnerHTML={{ __html: error || content || '' }} />
          )}
        </div>
      </div>
    </div>
  );
}
