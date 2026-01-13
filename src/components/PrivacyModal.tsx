import { useEffect, useState } from 'react';
import '../styles/modals.css';
import './ChangelogModal.css';

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderInline(text: string) {
  let t = escapeHtml(text);
  // Links: [text](url) - process before bold/italic to avoid conflicts
  t = t.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
  t = t.replace(/`(.+?)`/g, '<code>$1</code>');
  return t;
}

function parseMarkdown(md: string) {
  const lines = md.split('\n');
  let html = '';
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    if (line === '') {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += '<p></p>';
      continue;
    }

    if (line.startsWith('### ')) {
      html += `<h3>${renderInline(line.slice(4))}</h3>`;
      continue;
    }
    if (line.startsWith('## ')) {
      html += `<h2>${renderInline(line.slice(3))}</h2>`;
      continue;
    }
    if (line.startsWith('# ')) {
      html += `<h1>${renderInline(line.slice(2))}</h1>`;
      continue;
    }
    if (line === '---') {
      html += '<hr/>';
      continue;
    }
    if (line.startsWith('- ')) {
      if (!inList) {
        inList = true;
        html += '<ul>';
      }
      html += `<li>${renderInline(line.slice(2))}</li>`;
      continue;
    }

    html += `<p>${renderInline(line)}</p>`;
  }

  if (inList) html += '</ul>';
  return html;
}

export default function PrivacyModal({ onClose, onOpenTicket }: { onClose: () => void; onOpenTicket?: () => void }) {
  const [content, setContent] = useState<string>('Loading...');

  useEffect(() => {
    let mounted = true;
    const localUrl = '/PRIVACY.md';
    const rawUrl = 'https://raw.githubusercontent.com/henrylay1/ManageDle/main/PRIVACY.md';

    const load = async () => {
      try {
        let res = await fetch(localUrl);
        if (!res.ok) {
          // try GitHub raw as fallback
          res = await fetch(rawUrl);
          if (!res.ok) throw new Error('Not found');
        }
        const md = await res.text();
        if (!mounted) return;
        setContent(parseMarkdown(md));
      } catch (err) {
        console.error('Failed to load privacy file:', err);
        if (mounted) {
          // Embedded fallback content when remote/local file isn't available
          const embedded = `# Privacy Policy\n\nLast updated: 2026-01-12\n\nManageDle respects your privacy. This version is embedded in the app as a fallback.`;
          setContent(parseMarkdown(embedded));
        }
      }
    };

    load();

    return () => { mounted = false; };
  }, []);

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'A') {
      const href = target.getAttribute('href');
      if (href === '#open-ticket') {
        e.preventDefault();
        onClose();
        onOpenTicket?.();
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Privacy & Terms</h2>
          <button className="modal-close" onClick={onClose}>×</button>
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
