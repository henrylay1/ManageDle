import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ticketSchema, type TicketFormData } from '@/lib/validationSchemas';
import '../styles/modals.css';
import '../styles/forms.css';
import '../styles/buttons.css';
import './TicketModal.css';

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function TicketModal({ isOpen, onClose }: TicketModalProps) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issueUrl, setIssueUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      category: 'bug',
      subject: '',
      description: '',
    },
  });

  const description = watch('description');

  const onSubmit = async (data: TicketFormData) => {
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
          type: data.category,
          subject: data.subject,
          description: data.description,
          userAgent: navigator.userAgent,
        }),
      });

      // Attempt to parse JSON; if that fails, fall back to plain text
      let responseData: any = null;
      const raw = await response.text();
      try {
        responseData = raw ? JSON.parse(raw) : null;
      } catch (e) {
        responseData = null;
      }

      if (!response.ok) {
        const message = responseData?.error || responseData?.message || raw || 'Failed to submit ticket';
        throw new Error(message);
      }

      // Success - prefer JSON `issueUrl`, otherwise use raw text
      const issueLink = responseData?.issueUrl || raw || null;
      setIssueUrl(issueLink);
      setTimeout(() => {
        setSubmitted(false);
        setIssueUrl(null);
        reset();
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
        <form className="ticket-form" onSubmit={handleSubmit(onSubmit)}>
          <label>
            Type:
            <select {...register('category')} disabled={submitted}>
              <option value="bug">🐞 Bug</option>
              <option value="feature">✨ Feature</option>
              <option value="question">❓ Question</option>
              <option value="other">💬 Other</option>
            </select>
            {errors.category && (
              <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '4px' }}>
                {errors.category.message}
              </div>
            )}
          </label>
          <label>
            Subject:
            <input
              type="text"
              {...register('subject')}
              placeholder="Brief summary of your ticket"
              disabled={submitted}
            />
            {errors.subject && (
              <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '4px' }}>
                {errors.subject.message}
              </div>
            )}
          </label>
          <label>
            Description:
            <textarea
              {...register('description')}
              placeholder="Describe your issue or suggestion in detail..."
              rows={4}
              disabled={submitted}
            />
            {errors.description && (
              <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '4px' }}>
                {errors.description.message}
              </div>
            )}
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
          <button type="submit" className="btn-primary" disabled={isSubmitting || !description?.trim()}>
            {isSubmitting ? 'Submitting...' : 'Send Ticket'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TicketModal;
