import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { loginSchema, type LoginFormData } from '@/lib/validationSchemas';
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
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const login = useAppStore(state => state.login);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setError('');
    setIsLoading(true);

    try {
      await login(data.email, data.password);
      reset();
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
        
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group mb-4">
            <label htmlFor="email">Email</label>
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
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              {...register('password')}
              className="form-input"
              autoComplete="current-password"
            />
            {errors.password && (
              <div className="error-message mt-1">
                {errors.password.message}
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
