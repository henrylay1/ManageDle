import { useEffect, useState } from 'react';
import './Modal.css';
import './ChangelogModal.css';
import CHANGELOG from '@/content/changelog';

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
      html += `<h3>${escapeHtml(line.slice(4))}</h3>`;
      continue;
    }
    if (line.startsWith('## ')) {
      html += `<h2>${escapeHtml(line.slice(3))}</h2>`;
      continue;
    }
    if (line.startsWith('# ')) {
      html += `<h1>${escapeHtml(line.slice(2))}</h1>`;
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
      html += `<li>${escapeHtml(line.slice(2))}</li>`;
      continue;
    }

    // fallback paragraph
    html += `<p>${escapeHtml(line)}</p>`;
  }

  if (inList) html += '</ul>';
  return html;
}

export default function ChangelogModal({ onClose }: { onClose: () => void }) {
  const [content, setContent] = useState<string>('Loading...');

  useEffect(() => {
    let mounted = true;
    // Try fetching the changelog from the app root
    fetch('/CHANGELOG.md')
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.text();
      })
      .then(md => {
        if (!mounted) return;
        setContent(parseMarkdown(md));
      })
      .catch(() => {
        // Fallback: use bundled changelog content
        if (mounted) setContent(parseMarkdown(CHANGELOG));
      });

    return () => { mounted = false; };
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Changelog</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body changelog-body">
          <div className="changelog-content" dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      </div>
    </div>
  );
}
