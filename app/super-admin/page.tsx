'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import { ShieldAlert, Users, Globe, Settings, IndianRupee, Activity } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function SuperAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; role: string; email: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTenants: 0,
    activeTenants: 0,
    totalStudents: 0,
    totalRevenue: 0
  });
  const [recentTenants, setRecentTenants] = useState<any[]>([]);

  const fetchStats = async () => {
    try {
      // 1. Total Tenants
      const { count: totalTenants } = await supabase
        .from('tenants')
        .select('*', { count: 'exact', head: true });

      // 2. Active Tenants
      const { count: activeTenants } = await supabase
        .from('tenants')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // 3. Total Students (Global)
      const { count: totalStudents } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });

      // 4. Total Revenue (Global)
      const { data: feeData } = await supabase
        .from('fees')
        .select('amount_paid');
      const totalRevenue = feeData?.reduce((sum, f) => sum + (f.amount_paid || 0), 0) || 0;

      // 5. Recent Tenants
      const { data: tenantsData } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      setStats({
        totalTenants: totalTenants || 0,
        activeTenants: activeTenants || 0,
        totalStudents: totalStudents || 0,
        totalRevenue
      });
      setRecentTenants(tenantsData || []);
    } catch (error) {
      console.error('Error fetching super admin stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (!isLoggedIn) {
      window.location.href = '/login';
      return;
    }

    const role = localStorage.getItem('role');
    if (role !== 'super_admin') {
      router.push('/dashboard');
      return;
    }

    const userData = {
      name: localStorage.getItem('userName') || localStorage.getItem('userEmail')?.split('@')[0] || 'User',
      role: role,
      email: localStorage.getItem('userEmail') || '',
    };
    
    setUser(userData);
    fetchStats();

    // Real-time subscriptions
    const tenantsSub = supabase
      .channel('super-admin-tenants')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tenants' }, () => fetchStats())
      .subscribe();

    const studentsSub = supabase
      .channel('super-admin-students')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => fetchStats())
      .subscribe();

    return () => {
      supabase.removeChannel(tenantsSub);
      supabase.removeChannel(studentsSub);
    };
  }, [router]);

  if (isLoading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-900">Loading...</div>;

  if (!user || user.role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-900 p-4">
        <div className="text-center space-y-4">
          <ShieldAlert className="w-16 h-16 text-rose-500 mx-auto" />
          <h1 className="text-3xl font-bold">Access Denied</h1>
          <p className="text-slate-500">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Super Admin Dashboard</h1>
          <p className="text-slate-500">Global system management and tenant oversight</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card-geometric p-6">
            <Globe className="w-8 h-8 text-indigo-600 mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">Total Tenants</h3>
            <p className="text-3xl font-display font-bold text-slate-900">{stats.totalTenants}</p>
            <p className="text-xs text-emerald-600 mt-2 font-medium">{stats.activeTenants} Active</p>
          </div>
          <div className="card-geometric p-6">
            <Users className="w-8 h-8 text-blue-600 mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">Total Students</h3>
            <p className="text-3xl font-display font-bold text-slate-900">{stats.totalStudents.toLocaleString()}</p>
            <p className="text-xs text-blue-500 mt-2 font-medium">Across all academies</p>
          </div>
          <div className="card-geometric p-6">
            <IndianRupee className="w-8 h-8 text-emerald-600 mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">Total Revenue</h3>
            <p className="text-3xl font-display font-bold text-emerald-600">₹{stats.totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-emerald-500 mt-2 font-medium">System-wide collection</p>
          </div>
        </div>

        <div className="card-geometric p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Recent Tenant Activity</h2>
          <div className="space-y-4">
            {recentTenants.length > 0 ? (
              recentTenants.map((tenant) => (
                <div key={tenant.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                  <div>
                    <p className="font-semibold text-slate-900">{tenant.company_name}</p>
                    <p className="text-sm text-slate-500">{tenant.subdomain}.academy • {new Date(tenant.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    tenant.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {tenant.status.toUpperCase()}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-400">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No tenant activity found.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>

  );
}
