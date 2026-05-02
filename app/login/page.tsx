'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Mail, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // If already logged in, redirect to appropriate dashboard
    if (localStorage.getItem('isLoggedIn') === 'true') {
      const role = localStorage.getItem('role');
      if (role === 'super_admin') {
        router.push('/super-admin');
      } else {
        router.push('/dashboard');
      }
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and password required');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);

    try {
      // Super Admin check
      if (email === 'pandeyyash9198@gmail.com' && password === '8422936338Yash') {
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('role', 'super_admin');
        localStorage.setItem('userEmail', email);
        window.location.href = '/super-admin';
        return;
      }

      // Check app_users table
      const { data: user, error: dbError } = await supabase
        .from('app_users')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .eq('status', 'active')
        .single();

      if (dbError || !user) {
        setError('Invalid email or password');
        setIsSubmitting(false);
        return;
      }

      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('role', user.role);
      localStorage.setItem('tenant_id', user.tenant_id || '');
      localStorage.setItem('userName', user.full_name || '');
      localStorage.setItem('userEmail', user.email);
      
      window.location.href = '/dashboard';

    } catch (err: any) {
      console.error('Login error:', err.message);
      setError('Something went wrong. Try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 font-sans">
      <div className="w-full max-w-md space-y-8 relative">
        {/* Abstract geometric background element */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl"></div>

        <div className="text-center relative z-10">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2 tracking-tight">CoachLead</h1>
          <p className="text-slate-500">Sign in to your academy workspace</p>
        </div>

        <div className="card-geometric p-10 bg-white relative z-10">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-4 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 text-sm text-center font-medium">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all placeholder:text-slate-400"
                  placeholder="name@academy.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all placeholder:text-slate-400"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  Sign In 
                  <Lock className="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                </span>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-400 text-sm">
          Managed by <span className="text-slate-900 font-semibold">REVJET</span>
        </p>
      </div>
    </div>
  );
}
