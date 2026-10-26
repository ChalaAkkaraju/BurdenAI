import React, { useEffect, useState } from 'react';
import { Lock, User, AlertCircle, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

// Sign-in dialog shown on top of the (blurred) landing page.
export default function Login({ onClose }) {
  const { login, users } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showHints, setShowHints] = useState(false);

  // Escape closes the dialog.
  useEffect(() => {
    if (!onClose) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const result = login(username, password);
    if (!result.ok) setError(result.error);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-md overflow-y-auto"
      onMouseDown={(e) => {
        // Click on the backdrop (not the card) closes the dialog.
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-title"
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-teal-500" />

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-5 right-5 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <form onSubmit={handleSubmit} className="p-8 pt-7">
          <h2 id="signin-title" className="text-2xl font-bold text-gray-900">Sign in</h2>
          <p className="mt-1.5 text-gray-500">
            Use the username and password provided by your Burden AI administrator.
          </p>

          <div className="mt-6 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-sm transition-colors"
          >
            Sign in
          </button>

          <button
            type="button"
            onClick={() => setShowHints(!showHints)}
            className="w-full mt-4 text-xs text-gray-500 hover:text-gray-700"
          >
            {showHints ? 'Hide' : 'Show'} demo accounts
          </button>

          {showHints && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-600 space-y-1.5">
              {users.map((u) => (
                <div key={u.username} className="flex justify-between gap-2">
                  <span>
                    <span className="font-mono text-gray-900">{u.username}</span>
                    {' / '}
                    <span className="font-mono text-gray-900">{u.password}</span>
                  </span>
                  <span className="text-gray-500">{u.role}</span>
                </div>
              ))}
            </div>
          )}

          <p className="mt-5 text-sm text-gray-500">
            No account? Access is by invitation — contact your Burden AI administrator.
          </p>
          <p className="mt-2 text-xs text-gray-400">
            Demo only — passwords are stored in client code and not secure for production use.
          </p>
        </form>
      </div>
    </div>
  );
}
