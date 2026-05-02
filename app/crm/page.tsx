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

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchLeads = useCallback(async () => {
    try {
      setIsLoading(true);
      const tenantId = localStorage.getItem('tenant_id');
      const role = localStorage.getItem('role');

      let query = supabase.from('leads').select('*');

      if (role !== 'super_admin' && tenantId) {
        query = query.eq('tenant_id', tenantId);
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
  }, []);

  useEffect(() => {
    fetchLeads();

    const sub = supabase
      .channel('leads-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchLeads();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [fetchLeads]);

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
        console.error('Move lead error:', error.message);
        alert(`Failed to move lead: ${error.message}`);
        return;
      }

      // If moving to deal_closed — ask to convert to student
      if (newStatus === 'deal_closed') {
        const convert = confirm('Convert this lead to a student?');
        if (convert) {
          await convertToStudent(leadId);
        }
      }

      fetchLeads();
    } catch (err: any) {
      console.error('Error:', err.message);
    }
  };

  const convertToStudent = async (leadId: string) => {
    try {
      // Fetch lead data first
      const { data: lead, error: fetchError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();
      
      if (fetchError || !lead) {
        alert('Could not find lead data to convert');
        return;
      }

      const tenantId = localStorage.getItem('tenant_id');

      // Insert into students table
      const { error: insertError } = await supabase
        .from('students')
        .insert([{
          full_name: lead.full_name,
          email: lead.email,
          phone: lead.phone,
          course: lead.course_interested,
          tenant_id: tenantId || lead.tenant_id,
          status: 'active',
          join_date: new Date().toISOString().split('T')[0]
        }]);

      if (insertError) {
        console.error('Conversion error:', insertError.message);
        alert(`Failed to convert to student: ${insertError.message}`);
      } else {
        alert('Lead successfully converted to student!');
      }
    } catch (err: any) {
      console.error('Error in convertToStudent:', err.message);
    }
  };

  const deleteLead = async (leadId: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    
    try {
      const tenantId = localStorage.getItem('tenant_id');
      const role = localStorage.getItem('role');

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
    const tenantId = localStorage.getItem('tenant_id');

    const leadData = {
      full_name: formData.get('full_name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      status: formData.get('status') || 'new_enquiry',
      source: formData.get('source'),
      course_interested: formData.get('course'),
      notes: formData.get('notes'),
      tenant_id: tenantId
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
      <div className="h-[calc(100vh-160px)] flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Lead Management</h2>
            <p className="text-slate-500">Track and convert your academy prospects</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search prospects..." 
                className="input-field pl-10 py-2 text-sm w-80 shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-primary shadow-lg shadow-indigo-100"
            >
              <Plus className="w-4 h-4" />
              Add Lead
            </button>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 flex gap-6 overflow-x-auto pb-4">
          {COLUMNS.map((column, index) => (
            <div key={column.id} className="flex-shrink-0 w-80 flex flex-col gap-4">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-secondary/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">{editingLead ? 'Edit Lead Details' : 'Add New Lead'}</h3>
                <button onClick={() => { setIsModalOpen(false); setEditingLead(null); }} className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateLead} className="p-6 space-y-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                  <input name="full_name" required className="input-field w-full" defaultValue={editingLead?.full_name || ''} placeholder="John Doe" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Email</label>
                    <input name="email" type="email" className="input-field w-full" defaultValue={editingLead?.email || ''} placeholder="john@example.com" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Phone</label>
                    <input name="phone" className="input-field w-full" defaultValue={editingLead?.phone || ''} placeholder="+1 234..." />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Source</label>
                    <select name="source" className="input-field w-full bg-slate-50" defaultValue={editingLead?.source || 'Direct'}>
                      <option value="Direct">Direct</option>
                      <option value="Instagram">Instagram</option>
                      <option value="Facebook">Facebook</option>
                      <option value="Referral">Referral</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Interested Course</label>
                    <input name="course" className="input-field w-full" defaultValue={editingLead?.course_interested || ''} placeholder="e.g. Mathematics" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Notes</label>
                  <textarea name="notes" rows={3} className="input-field w-full resize-none" defaultValue={editingLead?.notes || ''} placeholder="Add some context..."></textarea>
                </div>
                {editingLead && (
                  <input type="hidden" name="status" value={editingLead.status} />
                )}

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => { setIsModalOpen(false); setEditingLead(null); }} className="flex-1 px-6 py-3 bg-slate-50 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-all">Cancel</button>
                  <button type="submit" disabled={isSaving} className="flex-1 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50">
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
