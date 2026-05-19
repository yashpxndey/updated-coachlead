'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { 
  Shield, 
  Plus, 
  Search, 
  MoreVertical, 
  ExternalLink, 
  Users, 
  CreditCard, 
  CheckCircle2, 
  XCircle, 
  Filter, 
  Download, 
  Edit2, 
  Trash2, 
  X, 
  ChevronDown,
  Activity,
  IndianRupee,
  Calendar,
  FileText,
  Loader2,
  History,
  Receipt
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';

type Tenant = Database['public']['Tables']['tenants']['Row'];

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTab, setActiveTab] = useState<'MANAGEMENT' | 'PAYMENTS'>('MANAGEMENT');
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccountsModalOpen, setIsAccountsModalOpen] = useState(false);
  const [selectedTenantForAccounts, setSelectedTenantForAccounts] = useState<Tenant | null>(null);
  const [tenantAccounts, setTenantAccounts] = useState<any[]>([]);
  const [isAccountEditing, setIsAccountEditing] = useState<string | null>(null);
  const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);
  const [selectedTenantForInstallment, setSelectedTenantForInstallment] = useState<Tenant | null>(null);
  const [expandedHistoryTenantId, setExpandedHistoryTenantId] = useState<string | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const fetchTenants = useCallback(async () => {
    setIsLoading(true);
    const { data } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
    if (data) setTenants(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchTenants();
    };
    init();

    const sub = supabase
      .channel('tenants-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tenants' }, () => {
        fetchTenants();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [fetchTenants]);

  const getPlan = (count: number): 'basic' | 'pro' | 'enterprise' => {
    if (count <= 25) return 'basic';
    if (count <= 50) return 'pro';
    return 'enterprise';
  };

  const filteredTenants = useMemo(() => {
    return tenants.filter(t => {
      const matchesSearch = t.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.subdomain.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPlan = planFilter === 'ALL' || t.plan.toUpperCase() === planFilter.toUpperCase();
      const matchesStatus = statusFilter === 'ALL' || t.status.toUpperCase() === statusFilter.toUpperCase();
      return matchesSearch && matchesPlan && matchesStatus;
    });
  }, [tenants, searchTerm, planFilter, statusFilter]);

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const { error } = await supabase
      .from('tenants')
      .update({ status: newStatus })
      .eq('id', id);
    if (error) console.error('Error toggling status:', error);
  };

  const handleDeleteTenant = async (id: string) => {
    if (confirm('Are you sure you want to delete this tenant? All associated data will be lost.')) {
      const { error } = await supabase.from('tenants').delete().eq('id', id);
      if (error) console.error('Error deleting tenant:', error);
      setActiveActionMenu(null);
    }
  };

  const handleSaveTenant = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const studentCount = Number(formData.get('students'));
    const plan = getPlan(studentCount);

    const tenantData = {
      company_name: formData.get('name') as string,
      subdomain: formData.get('subdomain') as string,
      number_of_students: studentCount,
      revenue: Number(formData.get('revenue')),
      status: formData.get('status') as 'active' | 'suspended',
      amount_paid: Number(formData.get('initialAmountPaid')),
      amount_pending: Number(formData.get('amountPending')),
      installments_total: Number(formData.get('installments')),
      plan: plan,
    };

    if (editingTenant) {
      const { error } = await supabase
        .from('tenants')
        .update(tenantData)
        .eq('id', editingTenant.id);
      if (error) {
        console.error('Tenant update error:', error.message, error.details, error.hint, error.code);
        alert(`Failed to update tenant: ${error.message}`);
        return;
      }
    } else {
      // 1. Insert Tenant
      const { data: newTenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          ...tenantData,
          installments_paid: 1,
          installments_pending: tenantData.installments_total - 1,
          payment_mode: 'UPI',
          payment_date: new Date().toISOString().split('T')[0],
          days_past_due: 0
        })
        .select()
        .single();

      if (tenantError) {
        console.error('Tenant insert error:', tenantError.message, tenantError.details, tenantError.hint, tenantError.code);
        alert(`Failed to save tenant: ${tenantError.message}`);
        return;
      }

      console.log('Tenant saved:', newTenant);

      // 2. Insert Admin and Staff Accounts
      const accounts = [
        {
          tenant_id: newTenant.id,
          full_name: formData.get('adminName') as string,
          email: formData.get('adminEmail') as string,
          password: formData.get('adminPassword') as string,
          role: 'admin',
          status: 'active'
        },
        {
          tenant_id: newTenant.id,
          full_name: formData.get('staff1Name') as string,
          email: formData.get('staff1Email') as string,
          password: formData.get('staff1Password') as string,
          role: 'staff',
          status: 'active'
        },
        {
          tenant_id: newTenant.id,
          full_name: formData.get('staff2Name') as string,
          email: formData.get('staff2Email') as string,
          password: formData.get('staff2Password') as string,
          role: 'staff',
          status: 'active'
        }
      ].filter(acc => acc.full_name && acc.email && acc.password); // Only insert if filled

      if (accounts.length > 0) {
        const { error: accountsError } = await supabase
          .from('app_users')
          .insert(accounts);
        if (accountsError) console.error('Error inserting accounts:', accountsError);
      }
    }

    setIsModalOpen(false);
    setEditingTenant(null);
  };

  const fetchAccounts = async (tenantId: string) => {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('tenant_id', tenantId);
    if (error) console.error('Error fetching accounts:', error);
    else setTenantAccounts(data || []);
  };

  const handleToggleAccountStatus = async (accountId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const { error } = await supabase
      .from('app_users')
      .update({ status: newStatus })
      .eq('id', accountId);
    
    if (error) console.error('Error toggling account status:', error);
    else if (selectedTenantForAccounts) fetchAccounts(selectedTenantForAccounts.id);
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (confirm('Are you sure you want to delete this account?')) {
      const { error } = await supabase
        .from('app_users')
        .delete()
        .eq('id', accountId);
      
      if (error) console.error('Error deleting account:', error);
      else if (selectedTenantForAccounts) fetchAccounts(selectedTenantForAccounts.id);
    }
  };

  const handleUpdateAccount = async (e: React.FormEvent<HTMLFormElement>, accountId: string) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const updateData = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      full_name: formData.get('name') as string,
    };

    const { error } = await supabase
      .from('app_users')
      .update(updateData)
      .eq('id', accountId);

    if (error) console.error('Error updating account:', error);
    else {
      setIsAccountEditing(null);
      if (selectedTenantForAccounts) fetchAccounts(selectedTenantForAccounts.id);
    }
  };

  const fetchPaymentHistory = async (tenantId: string) => {
    setIsHistoryLoading(true);
    const { data, error } = await supabase
      .from('tenant_payments')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('payment_date', { ascending: false });
    
    if (error) console.error('Error fetching payment history:', error);
    else setPaymentHistory(data || []);
    setIsHistoryLoading(false);
  };

  const toggleHistory = (tenantId: string) => {
    if (expandedHistoryTenantId === tenantId) {
      setExpandedHistoryTenantId(null);
    } else {
      setExpandedHistoryTenantId(tenantId);
      fetchPaymentHistory(tenantId);
    }
  };

  const handleSaveInstallment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTenantForInstallment) return;

    const formData = new FormData(e.currentTarget);
    const newAmount = Number(formData.get('amount'));
    const paymentDate = formData.get('date') as string;
    const paymentMode = formData.get('mode') as string;
    const notes = formData.get('notes') as string;

    // 1. Update Tenant record
    const { error: tenantError } = await supabase
      .from('tenants')
      .update({
        amount_paid: selectedTenantForInstallment.amount_paid + newAmount,
        amount_pending: selectedTenantForInstallment.amount_pending - newAmount,
        installments_paid: selectedTenantForInstallment.installments_paid + 1,
        installments_pending: selectedTenantForInstallment.installments_pending - 1,
        payment_mode: paymentMode,
        payment_date: paymentDate,
        days_past_due: 0
      })
      .eq('id', selectedTenantForInstallment.id);

    if (tenantError) {
      console.error('Error updating tenant payment info:', tenantError);
      alert('Failed to update tenant record');
      return;
    }

    // 2. Insert into tenant_payments history
    const { error: historyError } = await supabase
      .from('tenant_payments')
      .insert({
        tenant_id: selectedTenantForInstallment.id,
        amount: newAmount,
        payment_date: paymentDate,
        payment_mode: paymentMode,
        notes: notes
      });

    if (historyError) {
      console.error('Error saving payment history:', historyError);
    }

    setIsInstallmentModalOpen(false);
    setSelectedTenantForInstallment(null);
    fetchTenants(); // Refresh table
  };

  const downloadInvoice = (tenant: Tenant) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text('INVOICE', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text('CoachLead Platform Services', 105, 30, { align: 'center' });
    
    // Tenant Info
    doc.setFontSize(10);
    doc.text(`Company: ${tenant.company_name}`, 20, 50);
    doc.text(`Subdomain: ${tenant.subdomain}.coachlead.app`, 20, 55);
    doc.text(`Plan: ${tenant.plan.toUpperCase()}`, 20, 60);
    doc.text(`Date: ${tenant.payment_date}`, 150, 50);
    
    // Payment Details Table
    autoTable(doc, {
      startY: 70,
      head: [['Description', 'Details']],
      body: [
        ['Status', tenant.status.toUpperCase()],
        ['Total Students', tenant.number_of_students.toString()],
        ['Amount Paid', `INR ${tenant.amount_paid}`],
        ['Amount Pending', `INR ${tenant.amount_pending}`],
        ['Installments Paid', tenant.installments_paid.toString()],
        ['Installments Pending', (tenant.installments_total - tenant.installments_paid).toString()],
        ['Mode of Transaction', tenant.payment_mode || 'N/A'],
        ['Days Past Due', tenant.days_past_due.toString()],
      ],
      theme: 'striped',
      headStyles: { fillColor: [30, 111, 217] }
    });
    
    doc.save(`invoice-${tenant.subdomain}.pdf`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-display font-bold text-slate-900">Super Admin Panel</h2>
            <p className="text-slate-500">Manage platform tenants and financial records</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setActiveTab('MANAGEMENT')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'MANAGEMENT' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
            >
              Tenants
            </button>
            <button 
              onClick={() => setActiveTab('PAYMENTS')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'PAYMENTS' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
            >
              Payments
            </button>
            <button 
              onClick={() => { setEditingTenant(null); setIsModalOpen(true); }} 
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              Onboard New Tenant
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard icon={Shield} label="Total Tenants" value={tenants.length} color="blue" />
          <StatCard icon={Users} label="Total Students" value={tenants.reduce((acc, t) => acc + t.number_of_students, 0)} color="emerald" />
          <StatCard icon={IndianRupee} label="Total Revenue" value={tenants.reduce((acc, t) => acc + t.revenue, 0)} color="purple" />
          <StatCard icon={Activity} label="Active Now" value={tenants.filter(t => t.status === 'active').length} color="orange" />
        </div>

        {/* Search & Filters */}
        <div className="space-y-4">
          <div className="card-geometric p-4 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search by company name or subdomain..." 
                className="input-field w-full pl-11"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-secondary ${showFilters ? 'bg-slate-50 border-indigo-600' : ''}`}
            >
              <Filter className="w-4 h-4" />
              Filters
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="glass-card p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Plan</label>
                    <select 
                      className="input-field w-full"
                      value={planFilter}
                      onChange={(e) => setPlanFilter(e.target.value)}
                    >
                      <option value="ALL">All Plans</option>
                      <option value="Basic">Basic</option>
                      <option value="Pro">Pro</option>
                      <option value="Enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Status</label>
                    <select 
                      className="input-field w-full"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="ALL">All Status</option>
                      <option value="Active">Active</option>
                      <option value="Suspended">Suspended</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Tables */}
        <div className="card-geometric overflow-hidden">
          <div className="overflow-x-auto">
            {activeTab === 'MANAGEMENT' ? (
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-4 font-semibold text-sm text-slate-600">Company</th>
                    <th className="p-4 font-semibold text-sm text-slate-600">Subdomain</th>
                    <th className="p-4 font-semibold text-sm text-slate-600">Plan</th>
                    <th className="p-4 font-semibold text-sm text-slate-600">Students</th>
                    <th className="p-4 font-semibold text-sm text-slate-600">Revenue</th>
                    <th className="p-4 font-semibold text-sm text-slate-600">Status</th>
                    <th className="p-4 font-semibold text-sm text-slate-600 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400">Loading tenants...</td>
                    </tr>
                  ) : filteredTenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center font-bold text-indigo-600">
                            {tenant.company_name[0]}
                          </div>
                          <p className="font-semibold text-slate-900">{tenant.company_name}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <a 
                           href={`https://${tenant.subdomain}.academy`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-indigo-600 hover:underline"
                        >
                          {tenant.subdomain}.academy
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="p-4">
                        <PlanBadge plan={tenant.plan} />
                      </td>
                      <td className="p-4 text-sm text-slate-500 font-medium">{tenant.number_of_students}</td>
                      <td className="p-4 text-sm font-bold text-slate-900">₹{tenant.revenue.toLocaleString()}</td>
                      <td className="p-4">
                        <button 
                          onClick={() => handleToggleStatus(tenant.id, tenant.status)}
                          className="focus:outline-none"
                        >
                          <StatusBadge status={tenant.status} />
                        </button>
                      </td>
                      <td className="p-4 text-right relative">
                        <button 
                          onClick={() => setActiveActionMenu(activeActionMenu === tenant.id ? null : tenant.id)}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-5 h-5 text-slate-400" />
                        </button>
                        
                        <AnimatePresence>
                          {activeActionMenu === tenant.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setActiveActionMenu(null)} />
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                className="absolute right-4 top-12 w-32 bg-white border border-slate-200 rounded-xl shadow-2xl z-20 py-2"
                              >
                                <button 
                                  onClick={() => {
                                    setEditingTenant(tenant);
                                    setIsModalOpen(true);
                                    setActiveActionMenu(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                                >
                                  <Edit2 className="w-4 h-4 text-indigo-600" />
                                  Edit
                                </button>
                                <button 
                                  onClick={() => {
                                    setSelectedTenantForAccounts(tenant);
                                    fetchAccounts(tenant.id);
                                    setIsAccountsModalOpen(true);
                                    setActiveActionMenu(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                                >
                                  <Users className="w-4 h-4 text-emerald-600" />
                                  Accounts
                                </button>
                                <button 
                                  onClick={() => handleDeleteTenant(tenant.id)}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-rose-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </button>
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse min-w-[1100px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-4 font-semibold text-sm text-slate-600">Company</th>
                    <th className="p-4 font-semibold text-sm text-slate-600">Plan</th>
                    <th className="p-4 font-semibold text-sm text-slate-600">Status</th>
                    <th className="p-4 font-semibold text-sm text-slate-600">Paid</th>
                    <th className="p-4 font-semibold text-sm text-slate-600">Pending</th>
                    <th className="p-4 font-semibold text-sm text-slate-600">Inst. (P/T)</th>
                    <th className="p-4 font-semibold text-sm text-slate-600">Mode</th>
                    <th className="p-4 font-semibold text-sm text-slate-600">Date</th>
                    <th className="p-4 font-semibold text-sm text-slate-600">Due</th>
                    <th className="p-4 font-semibold text-sm text-slate-600 text-right">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={10} className="p-12 text-center text-slate-400">Loading payments...</td>
                    </tr>
                  ) : filteredTenants.map((tenant) => (
                    <React.Fragment key={tenant.id}>
                      <tr className="hover:bg-slate-50 transition-colors group">
                      <td className="p-4">
                        <p className="font-semibold text-slate-900">{tenant.company_name}</p>
                        <p className="text-xs text-slate-500">{tenant.number_of_students} Students</p>
                      </td>
                      <td className="p-4">
                        <PlanBadge plan={tenant.plan} />
                      </td>
                      <td className="p-4">
                        <StatusBadge status={tenant.status} />
                      </td>
                      <td className="p-4 text-sm font-bold text-emerald-600">₹{tenant.amount_paid.toLocaleString()}</td>
                      <td className="p-4 text-sm font-bold text-rose-600">₹{tenant.amount_pending.toLocaleString()}</td>
                      <td className="p-4 text-sm text-slate-500">
                        {tenant.installments_paid} / {tenant.installments_total}
                      </td>
                      <td className="p-4 text-sm text-slate-500">{tenant.payment_mode}</td>
                      <td className="p-4 text-sm text-slate-500">{tenant.payment_date}</td>
                      <td className="p-4">
                        <span className={`text-xs font-bold ${tenant.days_past_due > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {tenant.days_past_due} Days
                        </span>
                      </td>
                      <td className="p-4 text-right flex items-center justify-end gap-2">
                        <button 
                          onClick={() => toggleHistory(tenant.id)}
                          className={`p-2 rounded-lg transition-colors ${expandedHistoryTenantId === tenant.id ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-100 text-slate-400'}`}
                          title="Payment History"
                        >
                          <History className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedTenantForInstallment(tenant);
                            setIsInstallmentModalOpen(true);
                          }}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-emerald-600"
                          title="Add Installment"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => downloadInvoice(tenant)}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-indigo-600"
                          title="Download Invoice"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                    {/* Expandable History Section */}
                    <AnimatePresence>
                      {expandedHistoryTenantId === tenant.id && (
                        <tr>
                          <td colSpan={10} className="p-0 border-b border-white/10">
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden bg-white/5"
                            >
                              <div className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                  <h4 className="text-sm font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-2">
                                    <History className="w-4 h-4" /> Payment History - {tenant.company_name}
                                  </h4>
                                </div>
                                {isHistoryLoading ? (
                                  <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                                  </div>
                                ) : paymentHistory.length === 0 ? (
                                  <p className="text-center py-8 text-slate-500 text-sm italic">No payment history found for this tenant.</p>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {paymentHistory.map((payment) => (
                                      <div key={payment.id} className="card-geometric p-4 hover:border-indigo-200 transition-colors">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-lg font-bold text-emerald-600">₹{payment.amount.toLocaleString()}</span>
                                          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600 uppercase tracking-wider">
                                            {payment.payment_mode}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                                          <Calendar className="w-3 h-3" />
                                          {payment.payment_date}
                                        </div>
                                        {payment.notes && (
                                          <div className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded">
                                            &quot;{payment.notes}&quot;
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Onboard/Edit Tenant Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex flex-col md:items-center md:justify-center bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="card-geometric w-full max-w-2xl relative min-h-screen md:min-h-0 md:my-8 p-6 md:p-8"
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-2xl font-display font-bold mb-6 text-slate-900">
                {editingTenant ? 'Edit Tenant Details' : 'Onboard New Tenant'}
              </h3>
              
              <form onSubmit={handleSaveTenant} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-500">Company Name</label>
                    <input name="name" type="text" required defaultValue={editingTenant?.company_name} className="input-field w-full" placeholder="e.g. Revjet Academy" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-500">Subdomain</label>
                    <div className="flex items-center gap-2">
                      <input name="subdomain" type="text" required defaultValue={editingTenant?.subdomain} className="input-field flex-1" placeholder="e.g. revjet" />
                      <span className="text-xs text-slate-500">.coachlead.app</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-500">Number of Students</label>
                    <input name="students" type="number" required defaultValue={editingTenant?.number_of_students} className="input-field w-full" placeholder="e.g. 50" />
                    <p className="text-[10px] text-indigo-600 font-bold">Plan will be auto-assigned based on count</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-500">Revenue (₹)</label>
                    <input name="revenue" type="number" required defaultValue={editingTenant?.revenue} className="input-field w-full" placeholder="e.g. 50000" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-500">Status</label>
                    <select name="status" required defaultValue={editingTenant?.status || 'active'} className="input-field w-full">
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-500">Initial Amount Paid (₹)</label>
                    <input name="initialAmountPaid" type="number" required defaultValue={editingTenant?.amount_paid} className="input-field w-full" placeholder="e.g. 10000" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-500">Amount Pending (₹)</label>
                    <input name="amountPending" type="number" required defaultValue={editingTenant?.amount_pending} className="input-field w-full" placeholder="e.g. 5000" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-500">Number of Installments</label>
                    <input name="installments" type="number" required defaultValue={editingTenant?.installments_total} className="input-field w-full" placeholder="e.g. 3" />
                  </div>
                </div>

                {!editingTenant && (
                  <div className="space-y-6 pt-6 border-t border-slate-100">
                    <h4 className="text-lg font-bold text-slate-900">Account Credentials</h4>
                    
                    <div className="space-y-4">
                      <p className="text-sm font-medium text-indigo-600 uppercase tracking-widest text-[10px]">Admin Account</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input name="adminName" type="text" required className="input-field w-full" placeholder="Admin Full Name" />
                        <input name="adminEmail" type="email" required className="input-field w-full" placeholder="Admin Email" />
                        <input name="adminPassword" type="password" required className="input-field w-full" placeholder="Admin Password" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-sm font-medium text-indigo-600 uppercase tracking-widest text-[10px]">Staff Account 1</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input name="staff1Name" type="text" className="input-field w-full" placeholder="Staff 1 Full Name" />
                        <input name="staff1Email" type="email" className="input-field w-full" placeholder="Staff 1 Email" />
                        <input name="staff1Password" type="password" className="input-field w-full" placeholder="Staff 1 Password" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-sm font-medium text-indigo-600 uppercase tracking-widest text-[10px]">Staff Account 2</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input name="staff2Name" type="text" className="input-field w-full" placeholder="Staff 2 Full Name" />
                        <input name="staff2Email" type="email" className="input-field w-full" placeholder="Staff 2 Email" />
                        <input name="staff2Password" type="password" className="input-field w-full" placeholder="Staff 2 Password" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancel</button>
                  <button type="submit" className="btn-primary">
                    {editingTenant ? 'Update Tenant' : 'Onboard Tenant'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tenant Accounts Modal */}
      <AnimatePresence>
        {isAccountsModalOpen && selectedTenantForAccounts && (
          <div className="fixed inset-0 z-50 flex flex-col md:items-center md:justify-center bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="card-geometric w-full max-w-4xl relative min-h-screen md:min-h-0 md:my-8 p-6 md:p-8"
            >
              <button 
                onClick={() => setIsAccountsModalOpen(false)}
                className="absolute top-4 right-4 p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <h3 className="text-2xl font-display font-bold text-slate-900">
                  Manage Accounts: {selectedTenantForAccounts.company_name}
                </h3>
                <p className="text-slate-500 text-sm font-medium">View and manage Admin/Staff credentials</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-4 font-semibold text-sm text-slate-600">Name</th>
                      <th className="p-4 font-semibold text-sm text-slate-600">Email</th>
                      <th className="p-4 font-semibold text-sm text-slate-600">Password</th>
                      <th className="p-4 font-semibold text-sm text-slate-600">Role</th>
                      <th className="p-4 font-semibold text-sm text-slate-600">Status</th>
                      <th className="p-4 font-semibold text-sm text-slate-600 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tenantAccounts.map((account) => (
                      <tr key={account.id} className="hover:bg-slate-50/50 transition-colors">
                        {isAccountEditing === account.id ? (
                          <td colSpan={6} className="p-4">
                            <form onSubmit={(e) => handleUpdateAccount(e, account.id)} className="flex items-center gap-4">
                              <input name="name" type="text" defaultValue={account.full_name} className="input-field flex-1" required />
                              <input name="email" type="email" defaultValue={account.email} className="input-field flex-1" required />
                              <input name="password" type="text" defaultValue={account.password} className="input-field flex-1" required />
                              <button type="submit" className="btn-primary py-2 px-4">Save</button>
                              <button type="button" onClick={() => setIsAccountEditing(null)} className="btn-secondary py-2 px-4">Cancel</button>
                            </form>
                          </td>
                        ) : (
                          <>
                            <td className="p-4 text-sm text-slate-900 font-semibold">{account.full_name}</td>
                            <td className="p-4 text-sm text-slate-500">{account.email}</td>
                            <td className="p-4 text-sm text-slate-500 font-mono">{account.password}</td>
                            <td className="p-4">
                              <span className={`text-[10px] font-bold px-2 py-1 rounded-md border uppercase tracking-wider ${account.role === 'admin' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                                {account.role}
                              </span>
                            </td>
                            <td className="p-4">
                              <button onClick={() => handleToggleAccountStatus(account.id, account.status)}>
                                <StatusBadge status={account.status} />
                              </button>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button 
                                  onClick={() => setIsAccountEditing(account.id)}
                                  className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-indigo-600"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteAccount(account.id)}
                                  className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-rose-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}
        {/* Add Installment Modal */}
        {isInstallmentModalOpen && selectedTenantForInstallment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card-geometric w-full max-w-md p-8 relative my-8"
            >
              <button 
                onClick={() => {
                  setIsInstallmentModalOpen(false);
                  setSelectedTenantForInstallment(null);
                }}
                className="absolute top-4 right-4 p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-2xl font-display font-bold mb-2 text-slate-900">Add Installment</h3>
              <p className="text-slate-500 text-sm mb-6">Recording payment for {selectedTenantForInstallment.company_name}</p>
              
              <form onSubmit={handleSaveInstallment} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-500">Amount Paid (₹)</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      name="amount" 
                      type="number" 
                      required 
                      className="input-field w-full pl-10" 
                      placeholder="0.00"
                      max={selectedTenantForInstallment.amount_pending}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">Max pending: ₹{selectedTenantForInstallment.amount_pending.toLocaleString()}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-500">Payment Date</label>
                  <input 
                    name="date" 
                    type="date" 
                    required 
                    defaultValue={new Date().toISOString().split('T')[0]} 
                    className="input-field w-full" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-500">Mode of Transaction</label>
                  <select name="mode" required className="input-field w-full">
                    <option value="Cash">Cash</option>
                    <option value="Online">Online</option>
                    <option value="Cheque">Cheque</option>
                    <option value="UPI">UPI</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-500">Notes (Optional)</label>
                  <textarea 
                    name="notes" 
                    className="input-field w-full min-h-[80px]" 
                    placeholder="Transaction ID, bank details, etc."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsInstallmentModalOpen(false);
                      setSelectedTenantForInstallment(null);
                    }} 
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Record Payment
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function StatCard({ icon: Icon, label, value, color }: any) {
  const colors: any = {
    blue: 'bg-blue-500/20 text-blue-500',
    emerald: 'bg-emerald-500/20 text-emerald-500',
    purple: 'bg-purple-500/20 text-purple-500',
    orange: 'bg-orange-500/20 text-orange-500',
  };

  return (
    <div className="card-geometric p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-2xl font-display font-black text-slate-900 leading-none">
          {label.toLowerCase().includes('revenue') ? '₹' : ''}
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</p>
      </div>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const styles: any = {
    basic: 'bg-blue-100 text-blue-700 border-blue-200',
    pro: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    enterprise: 'bg-amber-100 text-amber-700 border-amber-200',
  };

  const p = plan.toLowerCase();

  return (
    <span className={`text-[10px] font-bold px-2 py-1 rounded-md border uppercase tracking-wider ${styles[p] || styles.basic}`}>
      {plan}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const isActive = s === 'active';

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`} />
      <span className={`text-xs font-bold ${isActive ? 'text-emerald-600' : 'text-rose-600'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    </div>
  );
}
