import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import '../styles/modals.css';
import '../styles/forms.css';
import '../styles/buttons.css';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
  isFromStats?: boolean;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({ 
  isOpen, 
  onClose, 
  onSwitchToLogin,
  isFromStats = false
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showMigrationInfo, setShowMigrationInfo] = useState(false);
  
  const register = useAppStore(state => state.register);
  const user = useAppStore(state => state.user);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      await register(email, password, displayName || undefined);
      
      // Show success message if migrating from guest
      if (user) {
        setShowMigrationInfo(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
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
        <h2>Create Account</h2>
        
        {isFromStats && (
          <div className="info-banner mb-4">
            📊 Please register to sync data to cloud and view stats.
          </div>
        )}
        
        {showMigrationInfo ? (
          <div className="success-message">
            <p className="font-semibold">✅ Account created successfully!</p>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              <div className="form-group mb-4">
                <label htmlFor="displayName">Display Name</label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="form-input"
                  autoComplete="name"
                  placeholder="Optional"
                />
              </div>

              <div className="form-group mb-4">
                <label htmlFor="email">
                  Email <span className="required">*</span>
                </label>
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
                <label htmlFor="password">
                  Password <span className="required">*</span>
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
              </div>

              <div className="form-group mb-4">
                <label htmlFor="confirmPassword">
                  Confirm Password <span className="required">*</span>
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-input"
                  autoComplete="new-password"
                  required
                  minLength={6}
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
                {isLoading ? 'Signing up...' : 'Sign Up'}
              </button>
            </form>

            <div className="auth-modal-footer">
              <p>
                Already have an account?{' '}
                <button
                  onClick={onSwitchToLogin}
                  className="btn-link"
                >
                  Log in
                </button>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
