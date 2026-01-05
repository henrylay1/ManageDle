import React, { useState } from 'react';
import './Modal.css';
import './Forms.css';
import './Buttons.css';
import './TicketModal.css';

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TicketModal: React.FC<TicketModalProps> = ({ isOpen, onClose }) => {
  const [type, setType] = useState('bug');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issueUrl, setIssueUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitted(true);

    try {
      // Build endpoint respecting Vite `base` (import.meta.env.BASE_URL).
      // When the app is served from a subpath (e.g. `/ManageDle/`),
      // the API endpoint must include that base.
      const base = (import.meta.env.BASE_URL || '/');
      const normalizedBase = base === '/' ? '' : base.replace(/\/$/, '');
      const endpoint = `${normalizedBase}/api/create-ticket`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          description,
          userAgent: navigator.userAgent,
        }),
      });

      // Attempt to parse JSON; if that fails, fall back to plain text
      let data: any = null;
      const raw = await response.text();
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch (e) {
        data = null;
      }

      if (!response.ok) {
        const message = data?.error || data?.message || raw || 'Failed to submit ticket';
        throw new Error(message);
      }

      // Success - prefer JSON `issueUrl`, otherwise use raw text
      const issueLink = data?.issueUrl || raw || null;
      setIssueUrl(issueLink);
      setTimeout(() => {
        setSubmitted(false);
        setDescription('');
        setIssueUrl(null);
        onClose();
      }, 3000);
    } catch (err) {
      console.error('Error submitting ticket:', err);
      // Helpful hint for local development: serverless `/api` endpoints are
      // provided by Vercel at runtime. Running `vercel dev` will serve them locally.
      if (err instanceof Error && /404|Not Found/.test(err.message)) {
        console.info('If you are running locally, try `vercel dev` to serve `/api` endpoints.');
      }
      setError(err instanceof Error ? err.message : 'Failed to submit ticket. Please try again.');
      setSubmitted(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content ticket-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Submit a Ticket</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form className="ticket-form" onSubmit={handleSubmit}>
          <label>
            Type:
            <select value={type} onChange={e => setType(e.target.value)} disabled={submitted}>
              <option value="bug">🐞 Bug</option>
              <option value="feature">✨ Feature</option>
              <option value="question">❓ Question</option>
            </select>
          </label>
          <label>
            Description:
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
              placeholder="Describe your issue or suggestion..."
              rows={4}
              disabled={submitted}
            />
          </label>
          {error && (
            <div style={{ color: '#ef4444', padding: '8px', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}
          {issueUrl && (
            <div style={{ color: '#10b981', padding: '8px', fontSize: '0.9rem' }}>
              ✅ Ticket submitted! <a href={issueUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#10b981', textDecoration: 'underline' }}>View on GitHub</a>
            </div>
          )}
          <button type="submit" className="btn-primary" disabled={submitted || !description.trim()}>
            {submitted ? 'Submitting...' : 'Send Ticket'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TicketModal;
