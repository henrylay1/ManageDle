/**
 * Simple markdown parser for rendering changelog and privacy documents.
 * Supports: headings, lists, horizontal rules, bold, italic, code, and links.
 */

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderInline(text: string): string {
  let t = escapeHtml(text);
  // Links: [text](url) - process before bold/italic to avoid conflicts
  t = t.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  // Bold: **text**
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic: *text*
  t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Inline code: `code`
  t = t.replace(/`(.+?)`/g, '<code>$1</code>');
  return t;
}

export function parseMarkdown(md: string): string {
  const lines = md.split('\n');
  let html = '';
  let inList = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    
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
