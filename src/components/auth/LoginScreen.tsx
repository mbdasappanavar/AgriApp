import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest, setAuthToken } from '../../api/client';
import { Sprout, Lock, User as UserIcon, ShieldCheck, ArrowRight } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (usr: string, pwd: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: usr, password: pwd })
      });
      login(res.token, res.user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Invalid username or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin(username, password);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 text-slate-100">
      <div className="w-full max-w-md space-y-6">
        {/* Logo and Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-600/20 border border-emerald-500/30 rounded-2xl mb-1 shadow-inner">
            <Sprout className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">Shri Revanasiddeshwara Agro Center</h1>
          <p className="text-xs text-slate-400">
            Kalaghatagi - Point-of-Sale, Stock Batches & GST Billing
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl text-xs font-semibold text-center">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Username / Mobile Number</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. admin"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center space-x-2"
            >
              <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Portal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Access Buttons */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider text-center">
              Quick One-Click Demo Role Login
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleLogin('admin', 'admin123')}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 font-semibold p-2 rounded-lg text-left transition-colors"
              >
                <div className="font-bold">Super Admin</div>
                <div className="text-[10px] text-slate-400">Full Access</div>
              </button>

              <button
                type="button"
                onClick={() => handleLogin('manager', 'manager123')}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-teal-400 font-semibold p-2 rounded-lg text-left transition-colors"
              >
                <div className="font-bold">Store Manager</div>
                <div className="text-[10px] text-slate-400">Day Closing & Stock</div>
              </button>

              <button
                type="button"
                onClick={() => handleLogin('sales', 'sales123')}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-blue-400 font-semibold p-2 rounded-lg text-left transition-colors"
              >
                <div className="font-bold">Sales Counter</div>
                <div className="text-[10px] text-slate-400">POS & Invoicing</div>
              </button>

              <button
                type="button"
                onClick={() => handleLogin('accountant', 'acc123')}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 font-semibold p-2 rounded-lg text-left transition-colors"
              >
                <div className="font-bold">Accountant</div>
                <div className="text-[10px] text-slate-400">GST & Expenses</div>
              </button>
            </div>
          </div>
        </div>

        <div className="text-center text-[11px] text-slate-500">
          <p>Powered by SQLite ACID Engine | GSTIN Compliant</p>
        </div>
      </div>
    </div>
  );
};
