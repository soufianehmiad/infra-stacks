/**
 * Modern login component with JWT authentication
 */
import React, { useState, FormEvent } from 'react';
import { Lock } from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { useWebSocketStore } from '../stores/websocket-store';
import { useUIStore } from '../stores/ui-store';
import axios from 'axios';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { setTokens, setUser } = useAuthStore();
  const { connect } = useWebSocketStore();
  const { addNotification } = useUIStore();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Call login API
      const response = await axios.post('/api/auth/login', {
        username,
        password,
      });

      const { access_token, refresh_token, user } = response.data;

      // Store tokens and user info
      setTokens(access_token, refresh_token);
      setUser(user);

      // Connect WebSocket
      connect(access_token);

      // Show success notification
      addNotification('success', 'Welcome back!', `Logged in as ${user.username}`);
    } catch (err: any) {
      console.error('Login error:', err);

      if (err.response?.status === 401) {
        setError('AUTH_REJECTED');
      } else if (err.response?.status === 403) {
        setError('ACCOUNT_LOCKED');
      } else {
        setError('CONNECTION_FAILED');
      }

      addNotification('error', 'Login failed', err.response?.data?.detail || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-brutalist-bg overflow-hidden flex-row font-sans">
      {/* Left: Artistic Server Visualization */}
      <div className="hidden lg:flex flex-1 bg-white relative items-center justify-center p-20 overflow-hidden border-r-[10px] border-black">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, black 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center text-black text-left">
          <div className="w-[600px] h-[600px] drop-shadow-[20px_20px_0_rgba(0,0,0,0.1)]">
            <img src="/abstract-art.svg" alt="Abstract Infrastructure" className="w-full h-full" />
          </div>
          <div className="mt-16 text-center">
            <div className="inline-block bg-black text-white px-12 py-3 mb-6 shadow-[12px_12px_0_#d97706]">
              <div className="text-5xl font-black uppercase tracking-[0.4em] italic leading-none">
                UNIDASH
              </div>
            </div>
            <p className="text-zinc-500 font-mono text-sm tracking-[0.4em] uppercase font-black opacity-60">
              System_Authenticated_Management
            </p>
          </div>
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 z-10 bg-brutalist-bg text-left">
        <div className="w-full max-w-[400px] bg-white border-[4px] border-black p-10 shadow-[20px_20px_0_#000] gpu-layer relative">
          <div className="absolute -top-6 -left-6 bg-brutalist-accent text-white border-[3px] border-black px-4 py-2 font-black uppercase italic tracking-widest shadow-[-4px_4px_0_#000] rotate-2 text-left">
            NODE_MOUNT
          </div>

          <div className="flex flex-col items-center mb-12">
            <div className="w-16 h-16 bg-black flex items-center justify-center text-white mb-6 transform rotate-3 hover:rotate-0 transition-transform shadow-[4px_4px_0_#d97706]">
              <Lock size={32} strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-black text-center leading-none">
              Authentication
            </h1>
            <p className="mt-3 text-[10px] font-mono font-black uppercase bg-zinc-100 px-3 py-1 border border-black italic tracking-widest text-zinc-500 text-center">
              Identity_Sequence_Required
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 font-sans">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] px-1 text-zinc-400">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                className="w-full bg-zinc-50 border-[3px] border-black p-4 font-mono text-lg text-black focus:outline-none focus:bg-white focus:border-brutalist-accent transition-all placeholder:text-zinc-200 disabled:opacity-50"
                placeholder="USERNAME"
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] px-1 text-zinc-400">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full bg-zinc-50 border-[3px] border-black p-4 font-mono text-lg text-black focus:outline-none focus:bg-white focus:border-brutalist-accent transition-all placeholder:text-zinc-200 disabled:opacity-50"
                placeholder="ENTER PASSWORD"
                required
              />
            </div>

            {error && (
              <div className="text-white text-xs font-mono text-center uppercase font-black bg-brutalist-error border-[3px] border-black py-2 shadow-[4px_4px_0_#000] animate-bounce">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white p-5 text-sm font-black uppercase tracking-[0.2em] hover:bg-brutalist-accent transition-all active:translate-x-2 active:translate-y-2 active:shadow-none shadow-[8px_8px_0_#d97706] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Authorizing...' : 'Authorize Node'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
