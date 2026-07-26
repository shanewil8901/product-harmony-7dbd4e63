import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/products');
    } catch {
      setError('Invalid credentials');
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

      <div className="flex items-center justify-center p-8">
        <form onSubmit={onSubmit} className="card w-full max-w-md p-8">
          <h2 className="text-2xl text-ink">Sign in</h2>
          <p className="text-sm text-brown-500 mt-1">Welcome back.</p>

          {error && (
            <div className="mt-6 rounded-lg border border-brown-200 bg-brown-50 px-3 py-2 text-sm text-brown-600">
              {error}
            </div>
          )}

          <div className="mt-6 space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="current-password"
              />
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
