import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, Clock } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Mock login logic — replace with real API call when the backend is ready.
    // localStorage.setItem('accessToken', res.data.accessToken);
    localStorage.setItem('isAuthenticated', 'true');
    navigate('/tasks', { replace: true });
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

        <h1 className="text-2xl font-semibold text-text text-center">Welcome back</h1>
        <p className="text-sm text-muted-500 text-center mt-1 mb-6">Log in to plan and schedule your day.</p>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-text mb-1.5">Email</label>
            <input
              id="login-email"
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
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="login-password" className="block text-sm font-medium text-text">Password</label>
            </div>
            <div className="relative">
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="w-full px-3.5 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <Eye aria-hidden="true" className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <div className="flex justify-end mt-2">
              <Link to="#" onClick={(event) => event.preventDefault()} className="text-sm font-medium text-primary-600 hover:text-primary-700">
                Forgot password?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-primary-500 hover:bg-primary-600 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm mt-1"
          >
            Log in
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <p className="text-sm text-center text-muted-600">
          New to Tempo?{' '}
          <Link to="/signup" className="font-medium text-primary-600 hover:text-primary-700 transition-colors">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
