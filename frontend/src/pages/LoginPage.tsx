import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { ApiError } from '../services/api';
import { EMAIL_RE, HELP } from '../lib/validators';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Required';
    else if (!EMAIL_RE.test(email)) e.email = 'Enter a valid email address';
    if (!password) e.password = 'Required';
    else if (password.length < 6) e.password = 'At least 6 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setErrors({});
    setLoading(true);
    try {
      await login(email, password);
      navigate('/products');
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      const status = apiErr.response?.status;
      const message =
        status === 401
          ? 'Invalid email or password'
          : apiErr.userMessage ?? 'Unable to sign in. Please try again.';
      setErrors({ ...apiErr.fieldErrors, form: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-paper-soft">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-ink text-paper">
        <div className="flex items-center gap-2">
          <span className="h-8 w-8 rounded-lg bg-gold-400 flex items-center justify-center text-ink font-bold">
            P
          </span>
          <span className="font-serif text-xl">Product Manager</span>
        </div>
        <div>
          <h1 className="text-4xl leading-tight">
            Manage your <span className="text-gold-300">catalog</span> with clarity.
          </h1>
          <p className="mt-4 text-paper/70 max-w-md">
            Barcode-aware search, precise units, and a clean workflow for every SKU.
          </p>
        </div>
        <div className="text-xs text-paper/50">© {new Date().getFullYear()} Product Manager</div>
      </div>

      <div className="flex items-center justify-center p-4 sm:p-8">
        <form onSubmit={onSubmit} noValidate className="card w-full max-w-md p-6 sm:p-8">
          <h2 className="text-2xl text-ink">Sign in</h2>
          <p className="text-sm text-brown-500 mt-1">Welcome back.</p>

          {errors.form && (
            <div
              role="alert"
              className="mt-6 rounded-lg border border-brown-300 bg-brown-50 px-3 py-2 text-sm text-brown-700"
            >
              {errors.form}
            </div>
          )}

          <div className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                className={`input ${errors.email ? 'border-brown-400 focus:ring-brown-300' : ''}`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                aria-invalid={!!errors.email}
                aria-describedby="login-email-help"
              />
              <p id="login-email-help" className="mt-1 text-xs text-brown-500">
                {errors.email ?? HELP.EMAIL}
              </p>
            </div>
            <div>
              <label className="label" htmlFor="login-password">
                Password
              </label>
              <input
                id="login-password"
                className={`input ${errors.password ? 'border-brown-400 focus:ring-brown-300' : ''}`}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                aria-describedby="login-pw-help"
              />
              <p id="login-pw-help" className="mt-1 text-xs text-brown-500">
                {errors.password ?? HELP.PASSWORD}
              </p>
            </div>
          </div>

          <button type="submit" className="btn-gold w-full mt-6" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
