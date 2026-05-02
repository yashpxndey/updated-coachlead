'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, Users, UserCheck, CreditCard, Bell, LogOut, Menu, X, ShieldCheck, FileText, BookOpen } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { motion } from 'motion/react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [user, setUser] = useState<{ name: string; role: string; email: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (!isLoggedIn) {
      window.location.href = '/login';
      return;
    }

    const userData = {
      name: localStorage.getItem('userName') || localStorage.getItem('userEmail')?.split('@')[0] || 'User',
      role: localStorage.getItem('role') || 'staff',
      email: localStorage.getItem('userEmail') || '',
    };
    
    setTimeout(() => {
      setUser(userData);
      setIsLoading(false);
    }, 0);

    const fetchUnreadCount = async () => {
      const tenantId = localStorage.getItem('tenant_id');
      const role = localStorage.getItem('role');

      let query = supabase
        .from('announcements')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);

      if (role !== 'super_admin' && tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { count } = await query;
      setUnreadCount(count || 0);
    };

    fetchUnreadCount();

    const sub = supabase
      .channel('announcements-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
        fetchUnreadCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, []);

  if (isLoading || !user) {
    return null;
  }

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', roles: ['super_admin', 'admin', 'staff'] },
    { name: 'Leads', icon: UserCheck, href: '/crm', roles: ['admin', 'staff'] },
    { name: 'Tenants', icon: ShieldCheck, href: '/tenants', roles: ['super_admin'] },
    { name: 'Courses', icon: BookOpen, href: '/courses', roles: ['admin', 'staff'] },
    { name: 'Students', icon: Users, href: '/students', roles: ['admin', 'staff'] },
    { name: 'Attendance', icon: UserCheck, href: '/attendance', roles: ['admin', 'staff'] },
    { name: 'Fees', icon: CreditCard, href: '/fees', roles: ['admin', 'staff'] },
    { name: 'Reports', icon: FileText, href: '/reports', roles: ['admin', 'staff'] },
    { name: 'Announcements', icon: Bell, href: '/messages', roles: ['admin', 'staff'] },
  ].filter(item => item.roles.includes(user.role));

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 80 }}
        className="bg-slate-900 flex flex-col transition-all overflow-hidden z-20 shadow-xl"
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          {isSidebarOpen && (
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xl font-bold text-white tracking-tight"
            >
              CoachLead
            </motion.span>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4">
          {navItems.map((item, index) => {
            const isActive = typeof window !== 'undefined' && window.location.pathname === item.href;
            return (
              <Link
                key={`${item.name}-${index}`}
                href={item.href}
                className={`flex items-center gap-4 p-3 rounded-lg transition-all group ${
                  isActive 
                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20' 
                    : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-indigo-400' : 'bg-slate-600'}`}></div>
                {isSidebarOpen && (
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm font-medium"
                  >
                    {item.name}
                  </motion.span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 mt-auto border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
              <span className="text-white font-bold">{user.name[0].toUpperCase()}</span>
            </div>
            {isSidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <p className="text-sm font-medium text-white line-clamp-1">{user.name}</p>
                <p className="text-xs text-slate-500 capitalize">{user.role.replace('_', ' ')}</p>
              </motion.div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="mt-4 flex items-center gap-2 text-xs text-slate-500 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-3 h-3" />
            {isSidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-400"
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500">
              <span className="hover:text-slate-900 cursor-pointer transition-colors">Projects</span>
              <div className="w-1 h-1 rounded-full bg-slate-300"></div>
              <span className="text-slate-900 font-semibold uppercase tracking-tight">
                {user.role === 'super_admin' ? 'Super Admin Panel' : 'REJVET-COACHLEAD'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Link href="/messages" className="relative p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                    {unreadCount}
                  </span>
                )}
              </Link>
              <button className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-400">
                <LayoutDashboard className="w-5 h-5" />
              </button>
            </div>
            
            <button className="hidden md:flex px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md text-sm font-medium text-white shadow-sm transition-all">
              Quick Actions
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
