import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { SignupMode } from '../types/auth';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [mode, setMode] = useState<SignupMode>('personal');
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 10) {
      setError('Password must be at least 10 characters long');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      const user = await signup({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber,
        mode,
        group_name: mode === 'create_group' ? groupName : undefined,
        invite_code: mode === 'join_group' ? inviteCode : undefined,
      });
      if (mode === 'create_group') {
        setCreatedInviteCode(user.workspace.invite_code);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (createdInviteCode) {
    return (
      <div className="auth-page">
        <div className="card auth-card">
          <h2 className="page-title">Group created</h2>
          <p className="page-subtitle">
            Share this invite code with your team so they can join your group and see the same
            properties.
          </p>
          <div className="invite-code-display">{createdInviteCode}</div>
          <button className="btn" onClick={() => navigate('/')} style={{ width: '100%' }}>
            Continue to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h2 className="page-title">Sign Up</h2>
        <p className="page-subtitle">Create an account to start tracking your properties.</p>

        {error && <div className="error-banner">{apiErrorMessage(error)}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>First name</label>
              <input
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Last name</label>
              <input
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Phone number</label>
            <input
              required
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="e.g. 555-123-4567"
            />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Password</label>
            <input
              required
              type="password"
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Retype password</label>
            <input
              required
              type="password"
              minLength={10}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label>Portfolio type</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as SignupMode)}>
              <option value="personal">Just for me (private)</option>
              <option value="create_group">Create a group (shared with a team)</option>
              <option value="join_group">Join an existing group</option>
            </select>
          </div>

          {mode === 'create_group' && (
            <div className="field" style={{ marginBottom: 16 }}>
              <label>Group name</label>
              <input
                required
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Smith Family Rentals"
              />
            </div>
          )}

          {mode === 'join_group' && (
            <div className="field" style={{ marginBottom: 16 }}>
              <label>Invite code</label>
              <input
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="e.g. A1B2C3D4"
              />
            </div>
          )}

          <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
            {submitting ? 'Creating account…' : 'Sign Up'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
