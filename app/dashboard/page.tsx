'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/dashboard-layout';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  AlertCircle, 
  IndianRupee, 
  BookOpen, 
  Bell, 
  TrendingUp,
  Clock,
  Globe,
  Plus,
  UserPlus,
  ClipboardList,
  FileText,
  PlusCircle,
  CreditCard
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';

type Announcement = Database['public']['Tables']['announcements']['Row'];
type Activity = Database['public']['Tables']['activity_log']['Row'];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; role: string; email: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (!isLoggedIn) {
      window.location.href = '/login';
      return;
    }

    const role = localStorage.getItem('role');
    if (role === 'super_admin') {
      router.push('/super-admin');
      return;
    }

    const userData = {
      name: localStorage.getItem('userName') || localStorage.getItem('userEmail')?.split('@')[0] || 'User',
      role: role || 'staff',
      email: localStorage.getItem('userEmail') || '',
    };
    setUser(userData);
    setAuthLoading(false);
  }, [router]);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeStudents: 0,
    totalTenants: 0,
    activeTenants: 0,
    totalCollected: 0,
    totalPending: 0,
    activeCourses: 0
  });
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const handleQuickAction = (path: string) => {
    router.push(path);
  };

  const fetchDashboardData = async () => {
    try {
      const tenantId = localStorage.getItem('tenant_id');
      const role = localStorage.getItem('role');

      // 1. Total Students
      let studentQuery = supabase
        .from('students')
        .select('*', { count: 'exact', head: true });
      
      if (role !== 'super_admin' && tenantId) {
        studentQuery = studentQuery.eq('tenant_id', tenantId);
      }
      const { count: totalStudents } = await studentQuery;

      // 2. Active Students
      let activeQuery = supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      
      if (role !== 'super_admin' && tenantId) {
        activeQuery = activeQuery.eq('tenant_id', tenantId);
      }
      const { count: activeStudents } = await activeQuery;

      // 3. Total Tenants (Super Admin only)
      const { count: totalTenants } = await supabase
        .from('tenants')
        .select('*', { count: 'exact', head: true });

      // 4. Active Tenants
      const { count: activeTenants } = await supabase
        .from('tenants')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // 5. Total Fee Collected
      let feeQuery = supabase
        .from('fees')
        .select('amount_paid, enrollment_fee');
      
      if (role !== 'super_admin' && tenantId) {
        feeQuery = feeQuery.eq('tenant_id', tenantId);
      }
      const { data: feeData } = await feeQuery;
      const totalCollected = feeData?.reduce((sum, f) => sum + (f.amount_paid || 0) + (f.enrollment_fee || 0), 0) || 0;

      // 6. Total Fee Pending
      let pendingQuery = supabase
        .from('fees')
        .select('amount_pending');
      
      if (role !== 'super_admin' && tenantId) {
        pendingQuery = pendingQuery.eq('tenant_id', tenantId);
      }
      const { data: pendingData } = await pendingQuery;
      const totalPending = pendingData?.reduce((sum, f) => sum + (f.amount_pending || 0), 0) || 0;

      // 7. Active Courses
      let coursesQuery = supabase.from('courses').select('*', { count: 'exact', head: true }).eq('status', 'active');
      if (role !== 'super_admin' && tenantId) {
        coursesQuery = coursesQuery.eq('tenant_id', tenantId);
      }
      const { count: activeCoursesCount } = await coursesQuery;
      const activeCourses = activeCoursesCount || 0;

      // 8. Fetch Announcements
      let announceQuery = supabase.from('announcements').select('*');
      if (role !== 'super_admin' && tenantId) {
        announceQuery = announceQuery.eq('tenant_id', tenantId);
      }
      const { data: announceData } = await announceQuery.order('created_at', { ascending: false });

      // 9. Fetch Activities (Today only)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let activityQuery = supabase.from('activity_log').select('*').gte('created_at', today.toISOString());
      if (role !== 'super_admin' && tenantId) {
        activityQuery = activityQuery.eq('tenant_id', tenantId);
      }
      const { data: activityData } = await activityQuery.order('created_at', { ascending: false });

      // 10. Fetch Revenue Data for Chart
      const mockRevenueData = [
        { name: new Date().toLocaleString('default', { month: 'short' }), revenue: totalCollected, students: totalStudents || 0 },
      ];

      setStats({
        totalStudents: totalStudents || 0,
        activeStudents: activeStudents || 0,
        totalTenants: totalTenants || 0,
        activeTenants: activeTenants || 0,
        totalCollected,
        totalPending,
        activeCourses
      });
      setAnnouncements(announceData || []);
      setActivities(activityData || []);
      setRevenueData(mockRevenueData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardData();

      // Real-time subscriptions
      const studentsSub = supabase
        .channel('students-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => fetchDashboardData())
        .subscribe();

      const feesSub = supabase
        .channel('fees-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'fees' }, () => fetchDashboardData())
        .subscribe();

      const tenantsSub = supabase
        .channel('tenants-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tenants' }, () => fetchDashboardData())
        .subscribe();

      const announceSub = supabase
        .channel('announcements-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => fetchDashboardData())
        .subscribe();

      return () => {
        supabase.removeChannel(studentsSub);
        supabase.removeChannel(feesSub);
        supabase.removeChannel(tenantsSub);
        supabase.removeChannel(announceSub);
      };
    }
  }, [user]);

  if (authLoading || isLoading) return <div className="min-h-screen bg-secondary flex items-center justify-center">Loading...</div>;
  if (!user) return null;

  const isAdmin = user.role === 'admin' || user.role === 'super_admin';

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header with Announcements Button */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h2>
            <p className="text-slate-500">Welcome back, {user.name}</p>
          </div>
          <Link 
            href="/messages"
            className="relative p-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 shadow-sm transition-all group"
          >
            <Bell className="w-6 h-6 text-indigo-600 group-hover:scale-110 transition-transform" />
            {announcements.some(a => !a.is_read) && (
              <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
            )}
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <button 
            type="button" 
            onClick={() => handleQuickAction('/students')}
            className="flex flex-col items-center gap-3 p-6 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all group shadow-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <UserPlus className="w-6 h-6 text-indigo-600" />
            </div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Add Student</span>
          </button>
          <button 
            type="button" 
            onClick={() => handleQuickAction('/attendance')}
            className="flex flex-col items-center gap-3 p-6 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all group shadow-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ClipboardList className="w-6 h-6 text-amber-600" />
            </div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Mark Attendance</span>
          </button>
          <button 
            type="button" 
            onClick={() => handleQuickAction('/fees')}
            className="flex flex-col items-center gap-3 p-6 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all group shadow-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CreditCard className="w-6 h-6 text-emerald-600" />
            </div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Record Fee</span>
          </button>
          <button 
            type="button" 
            onClick={() => handleQuickAction('/crm')}
            className="flex flex-col items-center gap-3 p-6 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all group shadow-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <PlusCircle className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Add Lead</span>
          </button>
          <button 
            type="button" 
            onClick={() => handleQuickAction('/reports')}
            className="flex flex-col items-center gap-3 p-6 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all group shadow-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText className="w-6 h-6 text-rose-600" />
            </div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">View Reports</span>
          </button>
          <button 
            type="button" 
            onClick={() => handleQuickAction('/courses')}
            className="flex flex-col items-center gap-3 p-6 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all group shadow-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="w-6 h-6 text-orange-600" />
            </div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Add Course</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Total Students" 
            value={stats.totalStudents.toLocaleString()} 
            change={`${stats.activeStudents} Active`} 
            icon={Users} 
            color="indigo" 
          />
          {isAdmin && (
            <StatCard 
              title="Total Collected" 
              value={`₹${stats.totalCollected.toLocaleString()}`} 
              change="Real-time from Supabase" 
              icon={IndianRupee} 
              color="emerald" 
            />
          )}
          <StatCard 
            title={user.role === 'super_admin' ? "Active Tenants" : "Active Courses"} 
            value={user.role === 'super_admin' ? stats.activeTenants.toString() : stats.activeCourses.toString()} 
            change={user.role === 'super_admin' ? "Across global system" : "Across all batches"} 
            icon={user.role === 'super_admin' ? Globe : BookOpen} 
            color="purple" 
          />
          <StatCard 
            title="Total Pending" 
            value={`₹${stats.totalPending.toLocaleString()}`} 
            change="Requires attention" 
            icon={AlertCircle} 
            color="rose" 
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {isAdmin && (
            <div className="card-geometric p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg text-slate-800">Revenue Growth (Admin Only)</h3>
                <select className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-sm text-slate-600">
                  <option>Last 6 Months</option>
                  <option>Last Year</option>
                </select>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: '#1e293b' }}
                      formatter={(value: any, name: any) => name === 'revenue' ? [`₹${value.toLocaleString()}`, 'Revenue'] : [value, name]}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#4f46e5" fillOpacity={1} fill="url(#colorRev)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className={`card-geometric p-6 ${!isAdmin ? 'lg:col-span-2' : ''}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-slate-800">Student Enrollment</h3>
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: '#1e293b' }}
                  />
                  <Bar dataKey="students" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent Activity & Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 card-geometric flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h4 className="font-bold text-slate-800">Recent Activity (Today)</h4>
              <span className="text-xs text-indigo-600 font-bold uppercase cursor-pointer hover:underline">View All</span>
            </div>
            <div className="p-6 space-y-4">
              {activities.length > 0 ? (
                activities.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">{activity.text}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Today
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>No activity today.</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl p-6 text-white shadow-lg overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl -mr-16 -mt-16"></div>
            <h4 className="font-bold text-lg mb-6 relative z-10">Critical Alerts</h4>
            <div className="space-y-4 relative z-10">
              <AlertItem 
                type="fee" 
                title="Overdue Payment" 
                desc="Check Fees section for details" 
                time="Today" 
              />
              <AlertItem 
                type="attendance" 
                title="Low Attendance" 
                desc="Monitor student presence" 
                time="Today" 
              />
              <AlertItem 
                type="system" 
                title="New Announcement" 
                desc={announcements[0]?.title || "No new announcements"} 
                time="Today" 
              />

              <div className="bg-white/5 border border-white/10 p-4 rounded-lg mt-6">
                <p className="text-[11px] font-bold text-indigo-400 uppercase mb-2">System Status</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                  <p className="text-xs text-slate-300">All systems operational</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ title, value, change, icon: Icon, color }: any) {
  const colorMap: any = {
    indigo: 'text-indigo-600 bg-indigo-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    purple: 'text-purple-600 bg-purple-50',
    rose: 'text-rose-600 bg-rose-50',
  };

  return (
    <div className="card-geometric p-6 relative overflow-hidden group">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{title}</p>
      <div className="flex items-end justify-between">
        <h3 className="text-3xl font-bold text-slate-900">{value}</h3>
        <div className={`p-2 rounded-lg ${colorMap[color] || 'bg-slate-100 text-slate-600'}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className={`text-xs font-medium mt-2 ${color === 'rose' ? 'text-rose-500' : 'text-emerald-600'}`}>{change}</p>
    </div>
  );
}

function AlertItem({ type, title, desc, time }: any) {
  const indicatorColors: any = {
    fee: 'bg-rose-400',
    attendance: 'bg-amber-400',
    system: 'bg-indigo-400',
  };

  return (
    <div className="flex items-center justify-between border-b border-slate-800 pb-4 group cursor-pointer hover:bg-white/5 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${indicatorColors[type] || 'bg-slate-500'}`}></div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-[10px] text-slate-500 line-clamp-1">{desc}</p>
        </div>
      </div>
      <p className="text-[10px] text-slate-500 font-bold uppercase">{time}</p>
    </div>
  );
}
