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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Send to Supabase or email API
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setDescription('');
      onClose();
    }, 1200);
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
            <select value={type} onChange={e => setType(e.target.value)}>
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
            />
          </label>
          <button type="submit" className="btn-primary" disabled={submitted || !description.trim()}>
            {submitted ? 'Submitted!' : 'Send Ticket'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TicketModal;
