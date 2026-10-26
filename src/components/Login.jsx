import React, { useState } from 'react';
import { Lock, User, AlertCircle, Shield, ArrowLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Login({ onBack }) {
  const { login, users } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showHints, setShowHints] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const result = login(username, password);
    if (!result.ok) setError(result.error);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-md">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </button>
        )}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 items-center justify-center shadow-lg mb-4">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Burden Cost & Rate Platform</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to continue</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8"
        >
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="admin"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-md shadow-sm transition-colors"
          >
            Sign In
          </button>

          <button
            type="button"
            onClick={() => setShowHints(!showHints)}
            className="w-full mt-4 text-xs text-gray-500 hover:text-gray-700"
          >
            {showHints ? 'Hide' : 'Show'} demo accounts
          </button>

          {showHints && (
            <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200 text-xs text-gray-600 space-y-1.5">
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
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Demo only — passwords are stored in client code and not secure for production use.
        </p>
      </div>
    </div>
  );
}
