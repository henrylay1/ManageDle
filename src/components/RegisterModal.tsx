import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import './Modal.css';
import './Forms.css';
import './Buttons.css';
import './AuthModal.css';

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
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '1.5rem',
        width: '100%',
        maxWidth: '28rem',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        color: 'black',
        position: 'relative',
      }}>
        {/* Close (X) button top right */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'none',
            border: 'none',
            color: '#c00',
            fontSize: '1.5rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            zIndex: 10,
          }}
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="text-2xl font-bold mb-4">Create Account</h2>
        
        {isFromStats && (
          <div style={{
            backgroundColor: '#e3f2fd',
            border: '1px solid #90caf9',
            borderRadius: '6px',
            padding: '0.75rem 1rem',
            marginBottom: '1.5rem',
            color: '#1565c0',
            fontSize: '0.875rem',
            fontWeight: 500
          }}>
            📊 Please register to sync data to cloud and view stats.
          </div>
        )}
        
        {showMigrationInfo ? (
          <div className="p-4 bg-green-100 text-green-700 rounded-md">
            <p className="font-semibold">✅ Account created successfully!</p>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              <div className="mb-4 form-field-row grid grid-cols-2 gap-x-4 gap-y-2 items-center">
                <label className="text-sm font-medium text-left" htmlFor="displayName">
                  Display Name
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="form-input px-3 py-2 bg-white border border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ backgroundColor: 'white', color: 'black', marginLeft: 'auto' }}
                  autoComplete="name"
                  placeholder="Optional"
                />
              </div>

              <div className="mb-4 form-field-row grid grid-cols-2 gap-x-4 gap-y-2 items-center">
                <label className="text-sm font-medium text-left" htmlFor="email">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input px-3 py-2 bg-white border border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ backgroundColor: 'white', color: 'black', marginLeft: 'auto' }}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="mb-4 form-field-row grid grid-cols-2 gap-x-4 gap-y-2 items-center">
                <label className="text-sm font-medium text-left" htmlFor="password">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input px-3 py-2 bg-white border border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ backgroundColor: 'white', color: 'black', marginLeft: 'auto' }}
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
              </div>

              <div className="mb-4 form-field-row grid grid-cols-2 gap-x-4 gap-y-2 items-center">
                <label className="text-sm font-medium text-left" htmlFor="confirmPassword">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-input px-3 py-2 bg-white border border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ backgroundColor: 'white', color: 'black', marginLeft: 'auto' }}
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-500 text-white py-1.5 px-3 rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                style={{ fontSize: '1rem', marginTop: '0.5rem' }}
              >
                {isLoading ? 'Signing up...' : 'Sign Up'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <button
                  onClick={onSwitchToLogin}
                  className="text-blue-500 hover:underline"
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
