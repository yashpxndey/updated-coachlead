'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  BookOpen, 
  Clock, 
  IndianRupee, 
  Calendar,
  CheckCircle2,
  XCircle,
  X,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';

type Course = Database['public']['Tables']['courses']['Row'];

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [tenants, setTenants] = useState<{ id: string; company_name: string }[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | 'all'>('all');
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const role = localStorage.getItem('role');
    setUserRole(role);
    if (role === 'super_admin') {
      const fetchTenantsList = async () => {
        const { data } = await supabase.from('tenants').select('id, company_name').order('company_name');
        setTenants(data || []);
      };
      fetchTenantsList();
    }
  }, []);

  const fetchCourses = useCallback(async () => {
    try {
      setIsLoading(true);
      const tenantId = localStorage.getItem('tenant_id');
      const role = localStorage.getItem('role');

      if (!role) {
        setIsLoading(false);
        return;
      }

      let query = supabase.from('courses').select('*');

      if (role === 'super_admin') {
        if (selectedTenantId !== 'all') {
          query = query.eq('tenant_id', selectedTenantId);
        } else {
          setCourses([]);
          setIsLoading(false);
          return;
        }
      } else if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      } else {
        setCourses([]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTenantId]);

  useEffect(() => {
    fetchCourses();

    const sub = supabase
      .channel('courses-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, () => {
        fetchCourses();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [fetchCourses, selectedTenantId]);

  const handleSaveCourse = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    const localTenantId = localStorage.getItem('tenant_id');
    const role = localStorage.getItem('role');
    const finalTenantId = role === 'super_admin' ? selectedTenantId : localTenantId;

    if (!finalTenantId || finalTenantId === 'all') {
      alert('Please select a target tenant before saving.');
      setIsSaving(false);
      return;
    }

    const courseData = {
      course_name: formData.get('course_name') as string,
      batch_time: formData.get('batch_time') as string,
      duration: formData.get('duration') as string,
      fees: parseFloat(formData.get('fees') as string),
      description: formData.get('description') as string,
      status: formData.get('status') as 'active' | 'inactive',
      tenant_id: finalTenantId
    };

    try {
      if (editingCourse) {
        const { error } = await supabase
          .from('courses')
          .update(courseData)
          .eq('id', editingCourse.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('courses')
          .insert([courseData]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      setEditingCourse(null);
    } catch (error) {
      console.error('Error saving course:', error);
      alert('Failed to save course');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCourse = async (id: string) => {
    if (!confirm('Are you sure you want to delete this course?')) return;

    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting course:', error);
      alert('Failed to delete course');
    }
  };

  const toggleStatus = async (course: Course) => {
    const newStatus = course.status === 'active' ? 'inactive' : 'active';
    try {
      const { error } = await supabase
        .from('courses')
        .update({ status: newStatus })
        .eq('id', course.id);
      if (error) throw error;
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const filteredCourses = courses.filter(course => 
    course.course_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-24 md:pb-0">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Academic Courses</h2>
              <p className="text-sm text-slate-500 font-medium">Configure departments, batches, and curriculum tiers</p>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-3">
            {userRole === 'super_admin' && (
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
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
            <button
              onClick={() => {
                setEditingCourse(null);
                setIsModalOpen(true);
              }}
              className="btn-primary shadow-lg shadow-indigo-100 font-bold px-8 w-full md:w-auto"
            >
              <Plus className="w-5 h-5" />
              Add New Course
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 group flex items-center">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors pointer-events-none z-10 shrink-0" />
            <input
              type="text"
              placeholder="Search by course descriptor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10 py-3 bg-white border-slate-200 focus:ring-indigo-500 w-full"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="relative">
              <div className="absolute inset-0 border-4 border-indigo-600 rounded-full animate-ping opacity-20" />
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Synchronizing Curriculum...</p>
          </div>
        ) : filteredCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => (
              <motion.div
                key={course.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-geometric p-6 flex flex-col gap-5 bg-white group hover:border-indigo-200 transition-all shadow-sm hover:shadow-md hover:-translate-y-1"
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100 group-hover:bg-indigo-600 transition-colors group-hover:border-indigo-600">
                    <BookOpen className="w-5 h-5 text-indigo-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditingCourse(course);
                        setIsModalOpen(true);
                      }}
                      className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCourse(course.id)}
                      className="p-2 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors tracking-tight">{course.course_name}</h3>
                  <p className="text-sm text-slate-500 line-clamp-2 font-medium mt-1 leading-relaxed">{course.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-y-4 pt-5 border-t border-slate-50">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="uppercase tracking-wider">{course.batch_time}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="uppercase tracking-wider">{course.duration}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                    <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
                    {course.fees.toLocaleString()}
                  </div>
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => toggleStatus(course)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all shadow-sm ${
                        course.status === 'active' 
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100' 
                          : 'bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100'
                      }`}
                    >
                      {course.status === 'active' ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {course.status}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 card-geometric bg-slate-50/50 border-dashed border-slate-200">
            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-100">
              <BookOpen className="w-10 h-10 text-slate-200" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">No courses in registry.</h3>
            <p className="text-slate-500 mb-8 max-w-sm mx-auto font-medium">Start building your academy curriculum by generating your first course record.</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-primary shadow-lg shadow-indigo-100 px-10 font-bold"
            >
              Initialize First Course
            </button>
          </div>
        )}

        {/* Add/Edit Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden card-geometric"
              >
                <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm">
                      <Edit2 className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                        {editingCourse ? 'Modify Course Record' : 'Create Course Record'}
                      </h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Academy Registry System</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveCourse} className="p-8 space-y-6">
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Department Identifier</label>
                      <input
                        name="course_name"
                        required
                        defaultValue={editingCourse?.course_name}
                        placeholder="e.g. Theoretical Physics / Applied Arts"
                        className="input-field w-full px-4 py-3 bg-white border-slate-200 text-slate-900 font-bold placeholder:font-normal"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Session Schedule</label>
                        <input
                          name="batch_time"
                          required
                          defaultValue={editingCourse?.batch_time}
                          placeholder="08:00 - 10:00"
                          className="input-field w-full px-4 py-3 bg-white border-slate-200 text-slate-900 font-medium"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Curriculum Span</label>
                        <input
                          name="duration"
                          required
                          defaultValue={editingCourse?.duration}
                          placeholder="e.g. 12 Weeks"
                          className="input-field w-full px-4 py-3 bg-white border-slate-200 text-slate-900 font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tuition Fees (₹)</label>
                        <input
                          name="fees"
                          type="number"
                          required
                          defaultValue={editingCourse?.fees}
                          placeholder="0.00"
                          className="input-field w-full px-4 py-3 bg-white border-slate-200 text-slate-900 font-black text-emerald-600 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Operational State</label>
                        <select
                          name="status"
                          defaultValue={editingCourse?.status || 'active'}
                          className="input-field w-full px-4 py-3 bg-white border-slate-200 text-slate-900 font-bold appearance-none"
                        >
                          <option value="active">Active Entry</option>
                          <option value="inactive">Archived Entry</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Course Abstract</label>
                      <textarea
                        name="description"
                        rows={3}
                        defaultValue={editingCourse?.description || ''}
                        placeholder="Detailed course description and core objectives..."
                        className="input-field w-full px-4 py-3 bg-white border-slate-200 text-slate-900 resize-none text-sm leading-relaxed"
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="btn-secondary flex-1 py-3.5 shadow-sm font-bold"
                    >
                      Dismiss
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="btn-primary flex-1 py-3.5 shadow-lg shadow-indigo-100 font-bold"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Processing Record...
                        </>
                      ) : (
                        'Commit To Registry'
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
