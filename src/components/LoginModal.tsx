import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import '../styles/modals.css';
import '../styles/forms.css';
import '../styles/buttons.css';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToRegister: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ 
  isOpen, 
  onClose, 
  onSwitchToRegister
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const login = useAppStore(state => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="auth-modal">
        <button
          onClick={onClose}
          className="modal-close"
          aria-label="Close"
        >
          ×
        </button>
        <h2>Log In</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group mb-4">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group mb-4">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="error-message mb-4">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full"
          >
            {isLoading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <div className="auth-modal-footer">
          <p>
            Don't have an account?{' '}
            <button
              onClick={onSwitchToRegister}
              className="btn-link"
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
