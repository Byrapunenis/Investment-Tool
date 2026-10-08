import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate('/');
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h2 className="page-title">Log In</h2>
        <p className="page-subtitle">Welcome back to Real Estate Optimizer.</p>

        {error && <div className="error-banner">{apiErrorMessage(error)}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Password</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
            {submitting ? 'Logging in…' : 'Log In'}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
