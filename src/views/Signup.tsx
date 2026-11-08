import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, Clock } from 'lucide-react';
import apiClient from '../services/apiClient';

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match. Please try again.');
      return;
    }

    setPasswordError('');
    setApiError(null);
    setIsLoading(true);

    try {
      const response = await apiClient.post('/auth/register', {
        displayName: name,
        email,
        password,
      });

      const token = response.data?.accessToken || response.data?.token;

      if (token) {
        localStorage.setItem('accessToken', token);
        localStorage.setItem('isAuthenticated', 'true');
        navigate('/tasks', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string | string[] } } };
      const msg = errorObj.response?.data?.message;
      setApiError(Array.isArray(msg) ? msg[0] : (msg || 'Registration failed. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-canvas px-4"
      style={{ animation: 'tempoAuthEnter 220ms ease-out both' }}
    >
      <style>{`
        @keyframes tempoAuthEnter {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .tempo-auth-transition { animation: none !important; }
        }
      `}</style>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-11 h-11 rounded-xl bg-primary-500 flex items-center justify-center mb-3">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-semibold text-text">Tempo</span>
        </div>

        <h1 className="text-2xl font-semibold text-text text-center">Create your account</h1>
        <p className="text-sm text-muted-500 text-center mt-1 mb-6">Start planning calmer, more focused days.</p>

        {apiError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600">
            {apiError}
          </div>
        )}

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="signup-name" className="block text-sm font-medium text-text mb-1.5">Name</label>
            <input
              id="signup-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your name"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="signup-email" className="block text-sm font-medium text-text mb-1.5">Email</label>
            <input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="signup-password" className="block text-sm font-medium text-text mb-1.5">Password</label>
            <div className="relative">
              <input
                id="signup-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setPasswordError('');
                }}
                placeholder="Create a password"
                className="w-full px-3.5 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <Eye aria-hidden="true" className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div>
            <label htmlFor="signup-confirm-password" className="block text-sm font-medium text-text mb-1.5">Confirm password</label>
            <div className="relative">
              <input
                id="signup-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setPasswordError('');
                }}
                placeholder="Confirm your password"
                aria-invalid={Boolean(passwordError)}
                aria-describedby={passwordError ? 'signup-password-error' : undefined}
                className="w-full px-3.5 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <Eye aria-hidden="true" className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {passwordError && (
              <p id="signup-password-error" role="alert" className="mt-1.5 text-sm text-red-600">
                {passwordError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm mt-1 cursor-pointer disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creating account...' : 'Sign up'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <p className="text-sm text-center text-muted-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700 transition-colors">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}