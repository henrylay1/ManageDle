import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useAppStore } from '@/store/appStore';
import '../styles/modals.css';
import '../styles/forms.css';
import '../styles/buttons.css';

const authSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().optional(),
  username: z.string()
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]*$/, 'Username can only contain letters, numbers, and underscores')
    .optional()
    .or(z.literal('')),
});

type AuthFormData = z.infer<typeof authSchema>;

type AuthMode = 'login' | 'register';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: AuthMode;
  isFromStats?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen, 
  onClose, 
  initialMode = 'login',
  isFromStats = false,
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showMigrationInfo, setShowMigrationInfo] = useState(false);
  
  const login = useAppStore(state => state.login);
  const registerUser = useAppStore(state => state.register);
  const user = useAppStore(state => state.user);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    clearErrors,
  } = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      username: '',
    },
  });

  const password = watch('password');
  const confirmPassword = watch('confirmPassword');

  // Reset mode when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError('');
      setShowMigrationInfo(false);
    }
  }, [isOpen, initialMode]);

  // Clear errors when switching modes (but keep form values)
  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError('');
    clearErrors();
  };

  const onSubmit = async (data: AuthFormData) => {
    setError('');

    // Validate confirm password for register mode
    if (mode === 'register') {
      if (!data.confirmPassword) {
        setError('Please confirm your password');
        return;
      }
      if (data.password !== data.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (data.username && data.username.length < 3) {
        setError('Username must be at least 3 characters');
        return;
      }
    }

    setIsLoading(true);

    try {
      if (mode === 'login') {
        await login(data.email, data.password);
        reset();
        onClose();
      } else {
        await registerUser(data.email, data.password, data.username || undefined);
        
        // Show success message if migrating from guest
        if (user) {
          setShowMigrationInfo(true);
          setTimeout(() => {
            reset();
            onClose();
          }, 2000);
        } else {
          reset();
          onClose();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `${mode === 'login' ? 'Login' : 'Registration'} failed`);
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
        
        <h2>{mode === 'login' ? 'Log In' : 'Create Account'}</h2>
        
        {mode === 'register' && isFromStats && (
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
            <form onSubmit={handleSubmit(onSubmit)}>
              {/* Username field - only shown for register */}
              {mode === 'register' && (
                <div className="form-group mb-4">
                  <label htmlFor="username">Username</label>
                  <input
                    id="username"
                    type="text"
                    {...register('username')}
                    className="form-input"
                    autoComplete="username"
                    placeholder="Optional"
                  />
                  {errors.username && (
                    <div className="error-message mt-1">
                      {errors.username.message}
                    </div>
                  )}
                </div>
              )}

              {/* Email field - shared */}
              <div className="form-group mb-4">
                <label htmlFor="email">
                  Email {mode === 'register' && <span className="required">*</span>}
                </label>
                <input
                  id="email"
                  type="email"
                  {...register('email')}
                  className="form-input"
                  autoComplete="email"
                />
                {errors.email && (
                  <div className="error-message mt-1">
                    {errors.email.message}
                  </div>
                )}
              </div>

              {/* Password field - shared */}
              <div className="form-group mb-4">
                <label htmlFor="password">
                  Password {mode === 'register' && <span className="required">*</span>}
                </label>
                <input
                  id="password"
                  type="password"
                  {...register('password')}
                  className="form-input"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                {errors.password && (
                  <div className="error-message mt-1">
                    {errors.password.message}
                  </div>
                )}
              </div>

              {/* Confirm password - only shown for register */}
              {mode === 'register' && (
                <div className="form-group mb-4">
                  <label htmlFor="confirmPassword">
                    Confirm Password <span className="required">*</span>
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    {...register('confirmPassword')}
                    className="form-input"
                    autoComplete="new-password"
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <div className="error-message mt-1">
                      Passwords don't match
                    </div>
                  )}
                </div>
              )}

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
                {isLoading 
                  ? (mode === 'login' ? 'Logging in...' : 'Signing up...') 
                  : (mode === 'login' ? 'Log In' : 'Sign Up')
                }
              </button>
            </form>

            <div className="auth-modal-footer">
              {mode === 'login' ? (
                <p>
                  Don't have an account?{' '}
                  <button
                    onClick={() => switchMode('register')}
                    className="btn-link"
                  >
                    Sign up
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{' '}
                  <button
                    onClick={() => switchMode('login')}
                    className="btn-link"
                  >
                    Log in
                  </button>
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthModal;
