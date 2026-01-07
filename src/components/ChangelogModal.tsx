import { useEffect, useState } from 'react';
import '../styles/modals.css';
import './ChangelogModal.css';

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderInline(text: string) {
  // Escape first, then replace simple inline markdown tokens
  let t = escapeHtml(text);
  // Bold: **text**
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic: *text*
  t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Inline code: `code`
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

    // fallback paragraph
    html += `<p>${renderInline(line)}</p>`;
  }

  if (inList) html += '</ul>';
  return html;
}

export default function ChangelogModal({ onClose }: { onClose: () => void }) {
  const [content, setContent] = useState<string>('Loading...');

  useEffect(() => {
    let mounted = true;
    // Fetch changelog from GitHub
    const githubRaw = 'https://raw.githubusercontent.com/henrylay1/ManageDle/main/CHANGELOG.md';

    fetch(githubRaw)
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.text();
      })
      .then(md => {
        if (!mounted) return;
        setContent(parseMarkdown(md));
      })
      .catch(err => {
        console.error('Failed to load changelog:', err);
        if (mounted) setContent('<p style="color: #ef4444;">Unable to load changelog. Please check your connection or visit the <a href="https://github.com/henrylay1/ManageDle/blob/main/CHANGELOG.md" target="_blank" rel="noopener noreferrer">GitHub repository</a>.</p>');
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
