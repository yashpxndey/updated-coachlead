'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Phone, 
  Mail, 
  Calendar, 
  User, 
  ChevronRight, 
  ChevronLeft,
  ChevronDown,
  Filter,
  X,
  Loader2,
  AlertCircle,
  Edit,
  ArrowRight,
  CheckCircle,
  XCircle,
  Trash2,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '@/lib/supabase';

interface Lead {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: 'new_enquiry' | 'follow_up' | 'deal_closed' | 'lost';
  source: string | null;
  course_interested: string | null;
  notes: string | null;
  created_at: string;
  tenant_id: string | null;
}

const COLUMNS = [
  { id: 'new_enquiry', title: 'New Enquiries', color: 'bg-blue-500' },
  { id: 'follow_up', title: 'Follow Up', color: 'bg-amber-500' },
  { id: 'deal_closed', title: 'Deal Closed', color: 'bg-emerald-500' },
  { id: 'lost', title: 'Lost', color: 'bg-red-500' },
];

export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [tenants, setTenants] = useState<{ id: string; company_name: string }[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | 'all'>('all');
  const [userContext, setUserContext] = useState<{ role: string | null, tenantId: string | null }>({ role: null, tenantId: null });

  useEffect(() => {
    const role = localStorage.getItem('role');
    const tenantId = localStorage.getItem('tenant_id');
    setUserContext({ role, tenantId });

    if (role === 'super_admin') {
      const fetchTenantsList = async () => {
        const { data } = await supabase.from('tenants').select('id, company_name').order('company_name');
        setTenants(data || []);
      };
      fetchTenantsList();
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchLeads = useCallback(async () => {
    try {
      setIsLoading(true);
      const { role, tenantId } = userContext;

      if (!role) {
        setIsLoading(false);
        return;
      }

      let query = supabase.from('leads').select('*');

      if (role === 'super_admin') {
        if (selectedTenantId !== 'all') {
          query = query.eq('tenant_id', selectedTenantId);
        } else {
          // If Super Admin has NOT selected a tenant, we show nothing or a specific platform view
          // The user wants: "NOT automatically see tenant-specific leads"
          setLeads([]);
          setIsLoading(false);
          return;
        }
      } else if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      } else {
        // Normal user with no tenant_id - shouldn't happen but safe-guard
        setLeads([]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        // If table doesn't exist, we might need to handle it or show a placeholder
        console.error('Error fetching leads:', error.message);
        setLeads([]);
      } else {
        setLeads(data || []);
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTenantId]);

  useEffect(() => {
    fetchLeads();

    const sub = supabase
      .channel('leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchLeads();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [fetchLeads, selectedTenantId, userContext.role]);

  const moveLead = async (leadId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          status: newStatus as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);

      if (error) {
        alert(`Failed: ${error.message}`);
        return;
      }

      if (newStatus === 'deal_closed') {
        const convert = confirm(
          'Lead moved to Deal Closed! Convert this lead to a student now?'
        );
        if (convert) {
          await convertToStudent(leadId);
          return;
        }
      }

      fetchLeads();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const convertToStudent = async (leadId: string) => {
    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) {
        alert('Lead not found');
        return;
      }

      const { role, tenantId: localTenantId } = userContext;
      const finalTenantId = role === 'super_admin' ? selectedTenantId : localTenantId;
      
      if (!finalTenantId || finalTenantId === 'all') {
        alert('Active tenant context missing. Please select a tenant.');
        return;
      }

      console.log('Converting lead to student:', lead);

      const { data: student, error: studentError } = await supabase
        .from('students')
        .insert([{
          tenant_id: finalTenantId,
          full_name: lead.full_name,
          phone: lead.phone,
          email: lead.email,
          course_name: lead.course_interested,
          enrollment_number: `ENR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          joining_date: new Date().toISOString().split('T')[0],
          status: 'active',
          notes: `Converted from CRM lead. Source: ${lead.source}`
        }])
        .select()
        .single();

      if (studentError) {
        console.error('Student insert error:', studentError.message, studentError.details);
        alert(`Failed to convert: ${studentError.message}`);
        return;
      }

      console.log('Student created:', student);

      // Update lead with converted student id
      const { error: leadError } = await supabase
        .from('leads')
        .update({
          status: 'deal_closed',
          // Note: If you add converted_student_id column to leads table later, it will store here.
          // For now, we just ensure status is set.
        })
        .eq('id', leadId);

      if (leadError) {
        console.error('Lead update error:', leadError.message);
      }

      alert(`✅ ${lead.full_name} converted to student successfully!`);

      // Redirect to students page
      window.location.href = '/students';

    } catch (err: any) {
      console.error('Conversion error:', err.message);
      alert(`Error: ${err.message}`);
    }
  };

  const deleteLead = async (leadId: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    
    try {
      const { role, tenantId } = userContext;

      let query = supabase
        .from('leads')
        .delete()
        .eq('id', leadId);

      if (role !== 'super_admin' && tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { error } = await query;
      if (error) throw error;
      fetchLeads();
    } catch (error) {
      console.error('Error deleting lead:', error);
    }
  };

  const handleCreateLead = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    const { role, tenantId: localTenantId } = userContext;
    const finalTenantId = role === 'super_admin' ? selectedTenantId : localTenantId;

    if (!finalTenantId || finalTenantId === 'all') {
      alert('Please select a target tenant before creating or updating a lead.');
      setIsSaving(false);
      return;
    }

    const leadData = {
      full_name: formData.get('full_name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      status: formData.get('status') || 'new_enquiry',
      source: formData.get('source'),
      course_interested: formData.get('course'),
      notes: formData.get('notes'),
      tenant_id: finalTenantId
    };

    try {
      if (editingLead) {
        const { error } = await supabase.from('leads').update(leadData).eq('id', editingLead.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('leads').insert([leadData]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      setEditingLead(null);
      fetchLeads();
    } catch (error) {
      console.error('Error saving lead:', error);
      alert('Failed to save lead. Make sure the table exists in your Supabase database.');
    } finally {
      setIsSaving(false);
    }
  };

  const getFilteredLeads = (status: string) => {
    return leads.filter(lead => {
      const matchesStatus = lead.status === status;
      const matchesSearch = searchTerm === '' || 
        lead.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.phone?.includes(searchTerm) ||
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.course_interested?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-160px)] flex flex-col gap-8 pb-24 md:pb-0">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Lead Management</h2>
            <p className="text-sm md:text-base text-slate-500">Track and convert your academy prospects</p>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-3">
            {userContext.role === 'super_admin' && (
              <div className="relative w-full md:w-64">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <select 
                  className="input-field pl-10 w-full appearance-none pr-10"
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                >
                  <option value="all">Select Tenant Context...</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.company_name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            )}
            <div className="relative flex items-center w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10 shrink-0" />
              <input 
                type="text" 
                placeholder="Search prospects..." 
                className="input-field pl-10 py-2 text-base md:text-sm w-full shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-primary w-full md:w-auto shadow-lg shadow-indigo-100"
            >
              <Plus className="w-4 h-4" />
              Add Lead
            </button>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 flex gap-4 md:gap-6 overflow-x-auto pb-4 snap-x snap-mandatory">
          {COLUMNS.map((column, index) => (
            <div key={column.id} className="flex-shrink-0 w-[85vw] md:w-80 flex flex-col gap-4 snap-center">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-indigo-400' : index === 1 ? 'bg-amber-400' : index === 2 ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  <h3 className="font-bold text-xs text-slate-500 uppercase tracking-widest">{column.title}</h3>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {getFilteredLeads(column.id).length}
                  </span>
                </div>
              </div>

              <div className="flex-1 bg-slate-100/50 rounded-xl border border-slate-200/60 p-3 space-y-3 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                  </div>
                ) : getFilteredLeads(column.id).length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-white/50">
                    <p className="text-xs text-slate-400 font-medium tracking-tight">No leads in this stage</p>
                  </div>
                ) : (
                  getFilteredLeads(column.id).map((lead) => (
                    <motion.div
                      key={lead.id}
                      layoutId={lead.id}
                      className="card-geometric p-4 space-y-4 group cursor-pointer"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-slate-200 group-hover:bg-indigo-400 transition-colors"></div>
                          <h4 className="font-bold text-sm text-slate-900 line-clamp-1">{lead.full_name}</h4>
                        </div>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === lead.id ? null : lead.id);
                            }}
                            className="p-1 rounded-lg hover:bg-slate-50 text-slate-400"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openMenuId === lead.id && (
                            <div className="absolute right-0 top-8 z-50 bg-white border border-slate-200 rounded-lg shadow-xl w-52 py-1 overflow-hidden">
                              <button
                                onClick={() => { setEditingLead(lead); setIsModalOpen(true); setOpenMenuId(null); }}
                                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                              >
                                <Edit className="w-4 h-4 text-slate-400" /> Edit Details
                              </button>
                              <div className="h-px bg-slate-100 my-1"></div>
                              <button
                                onClick={() => { moveLead(lead.id, 'follow_up'); setOpenMenuId(null); }}
                                className="w-full text-left px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-50 flex items-center gap-2 font-medium"
                              >
                                <ArrowRight className="w-4 h-4" /> Move to Follow Up
                              </button>
                              <button
                                onClick={() => { moveLead(lead.id, 'deal_closed'); setOpenMenuId(null); }}
                                className="w-full text-left px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50 flex items-center gap-2 font-medium"
                              >
                                <CheckCircle className="w-4 h-4" /> Close Deal
                              </button>
                              <button
                                onClick={() => { moveLead(lead.id, 'lost'); setOpenMenuId(null); }}                                className="w-full text-left px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-50 flex items-center gap-2 font-medium"
                              >
                                <XCircle className="w-4 h-4" /> Mark as Lost
                              </button>
                              <div className="h-px bg-slate-100 my-1"></div>
                              <button
                                onClick={() => { deleteLead(lead.id); setOpenMenuId(null); }}
                                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium"
                              >
                                <Trash2 className="w-4 h-4" /> Delete Lead
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {lead.phone && (
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {lead.phone}
                          </div>
                        )}
                        {lead.course_interested && (
                          <div className="inline-flex items-center gap-2 px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold uppercase tracking-wider">
                            <BookOpen className="w-3 h-3" />
                            {lead.course_interested}
                          </div>
                        )}
                      </div>

                      {/* Move buttons */}
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {lead.status !== 'new_enquiry' && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); moveLead(lead.id, 'new_enquiry'); }}
                            className="text-[9px] font-bold px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors uppercase tracking-wider"
                          >
                            ← New
                          </button>
                        )}
                        {lead.status !== 'follow_up' && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); moveLead(lead.id, 'follow_up'); }}
                            className="text-[9px] font-bold px-2 py-1 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors uppercase tracking-wider"
                          >
                            Follow Up →
                          </button>
                        )}
                        {lead.status !== 'deal_closed' && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); moveLead(lead.id, 'deal_closed'); }}
                            className="text-[9px] font-bold px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors uppercase tracking-wider"
                          >
                            Close Deal ✓
                          </button>
                        )}
                        {lead.status !== 'lost' && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); moveLead(lead.id, 'lost'); }}
                            className="text-[9px] font-bold px-2 py-1 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors uppercase tracking-wider"
                          >
                            Lost ✗
                          </button>
                        )}
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          {lead.source || 'Direct'}
                        </span>
                        <div className="w-6 h-6 rounded-full bg-slate-100 border border-white flex items-center justify-center text-[10px] font-bold text-slate-600">
                          {lead.full_name[0].toUpperCase()}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Lead Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex flex-col md:items-center md:justify-center bg-white md:bg-slate-900/40 md:backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white md:border md:border-slate-200 md:rounded-2xl md:shadow-2xl overflow-hidden min-h-screen md:min-h-0"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">{editingLead ? 'Edit Lead Details' : 'Add New Lead'}</h3>
                <button onClick={() => { setIsModalOpen(false); setEditingLead(null); }} className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateLead} className="p-4 md:p-6 space-y-4 md:space-y-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                  <input name="full_name" required className="input-field w-full text-base md:text-sm" defaultValue={editingLead?.full_name || ''} placeholder="John Doe" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Email</label>
                    <input name="email" type="email" className="input-field w-full text-base md:text-sm" defaultValue={editingLead?.email || ''} placeholder="john@example.com" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Phone</label>
                    <input name="phone" className="input-field w-full text-base md:text-sm" defaultValue={editingLead?.phone || ''} placeholder="+1 234..." />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Source</label>
                    <select name="source" className="input-field w-full bg-slate-50 text-base md:text-sm" defaultValue={editingLead?.source || 'Direct'}>
                      <option value="Direct">Direct</option>
                      <option value="Instagram">Instagram</option>
                      <option value="Facebook">Facebook</option>
                      <option value="Referral">Referral</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Interested Course</label>
                    <input name="course" className="input-field w-full text-base md:text-sm" defaultValue={editingLead?.course_interested || ''} placeholder="e.g. Mathematics" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Notes</label>
                  <textarea name="notes" rows={3} className="input-field w-full resize-none text-base md:text-sm" defaultValue={editingLead?.notes || ''} placeholder="Add some context..."></textarea>
                </div>
                {editingLead && (
                  <input type="hidden" name="status" value={editingLead.status} />
                )}

                <div className="pt-4 flex flex-col md:flex-row gap-3">
                  <button type="button" onClick={() => { setIsModalOpen(false); setEditingLead(null); }} className="flex-1 px-6 py-3 bg-slate-50 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-all border border-slate-200 order-2 md:order-1">Cancel</button>
                  <button type="submit" disabled={isSaving} className="flex-1 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50 order-1 md:order-2">
                    {isSaving ? 'Saving...' : editingLead ? 'Update Lead' : 'Create Lead'}
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
