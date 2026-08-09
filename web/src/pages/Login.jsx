import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await register(email, password);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neon-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-black text-neon-cyan tracking-widest mb-2">NEON ALARM</h1>
          <p className="text-gray-500 text-sm font-display">DYNAMIC ALARM MANAGEMENT</p>
        </div>

        <div className="neon-card">
          <h2 className="font-display text-lg text-white mb-6 text-center">
            {isRegister ? 'CREATE ACCOUNT' : 'SIGN IN'}
          </h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-display tracking-wider">EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="neon-input w-full"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-display tracking-wider">PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="neon-input w-full"
                placeholder="••••••••"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="neon-btn-primary w-full font-display tracking-wider">
              {loading ? '...' : isRegister ? 'REGISTER' : 'LOGIN'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button onClick={() => setIsRegister(!isRegister)} className="text-sm text-gray-400 hover:text-neon-cyan transition-colors">
              {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
