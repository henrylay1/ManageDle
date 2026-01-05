import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import './Modal.css';
import './Forms.css';
import './Buttons.css';
import './AuthModal.css';

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
        <h2 className="text-2xl font-bold mb-4">Log In</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4 form-field-row grid grid-cols-2 gap-x-4 gap-y-2 items-center">
            <label className="text-sm font-medium text-left" htmlFor="email">
              Email
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
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input px-3 py-2 bg-white border border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ backgroundColor: 'white', color: 'black', marginLeft: 'auto' }}
              autoComplete="current-password"
              required
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
            {isLoading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <button
              onClick={onSwitchToRegister}
              className="text-blue-500 hover:underline"
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
