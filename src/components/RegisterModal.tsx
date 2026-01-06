import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { registerSchema, type RegisterFormData } from '@/lib/validationSchemas';
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
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showMigrationInfo, setShowMigrationInfo] = useState(false);
  
  const registerUser = useAppStore(state => state.register);
  const user = useAppStore(state => state.user);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setError('');
    setIsLoading(true);

    try {
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
            <form onSubmit={handleSubmit(onSubmit)}>
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

              <div className="form-group mb-4">
                <label htmlFor="email">
                  Email <span className="required">*</span>
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

              <div className="form-group mb-4">
                <label htmlFor="password">
                  Password <span className="required">*</span>
                </label>
                <input
                  id="password"
                  type="password"
                  {...register('password')}
                  className="form-input"
                  autoComplete="new-password"
                />
                {errors.password && (
                  <div className="error-message mt-1">
                    {errors.password.message}
                  </div>
                )}
              </div>

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
                {errors.confirmPassword && (
                  <div className="error-message mt-1">
                    {errors.confirmPassword.message}
                  </div>
                )}
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
