'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { 
  Search, 
  Plus, 
  Filter, 
  MoreVertical, 
  FileText, 
  Mail, 
  Phone, 
  Calendar, 
  Download, 
  FileDown, 
  Edit2, 
  Trash2, 
  X, 
  User, 
  Users,
  Building,
  MapPin, 
  Clock, 
  Droplets, 
  GraduationCap, 
  Hash,
  CheckCircle2,
  AlertCircle,
  Camera,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';

type Student = Database['public']['Tables']['students']['Row'];

export default function StudentsPage() {
  const [user, setUser] = useState<{ name: string; role: string; email: string } | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [courseFilter, setCourseFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [enrollmentNumber, setEnrollmentNumber] = useState('');
  const [tenants, setTenants] = useState<{ id: string; company_name: string }[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | 'all'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateEnrollmentNumber = () => {
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 1000)
    return `ENR-${timestamp}-${random}`
  }

  useEffect(() => {
    const role = localStorage.getItem('role');
    const userData = {
      name: localStorage.getItem('userName') || localStorage.getItem('userEmail')?.split('@')[0] || 'User',
      role: role || 'staff',
      email: localStorage.getItem('userEmail') || '',
    };
    setTimeout(() => {
      setUser(userData);
    }, 0);

    if (role === 'super_admin') {
      const fetchTenantsList = async () => {
        const { data } = await supabase.from('tenants').select('id, company_name').order('company_name');
        setTenants(data || []);
      };
      fetchTenantsList();
    }
  }, []);

  const fetchStudents = useCallback(async () => {
    try {
      setIsLoading(true);
      const tenantId = localStorage.getItem('tenant_id');
      const role = localStorage.getItem('role');
      
      if (!role) {
        setIsLoading(false);
        return;
      }

      let query = supabase.from('students').select('*');
      
      if (role === 'super_admin') {
        if (selectedTenantId !== 'all') {
          query = query.eq('tenant_id', selectedTenantId);
        } else {
          setStudents([]);
          setCourses([]);
          setIsLoading(false);
          return;
        }
      } else if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      } else {
        setStudents([]);
        setIsLoading(false);
        return;
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      setStudents(data || []);

      // Fetch courses for dropdowns
      let courseQuery = supabase.from('courses').select('*').eq('status', 'active');
      if (role === 'super_admin') {
        courseQuery = courseQuery.eq('tenant_id', selectedTenantId);
      } else if (tenantId) {
        courseQuery = courseQuery.eq('tenant_id', tenantId);
      }
      const { data: coursesData } = await courseQuery;
      setCourses(coursesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTenantId]);

  useEffect(() => {
    fetchStudents();

    const sub = supabase
      .channel('students-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => {
        fetchStudents();
      })
      .subscribe();

    const coursesSub = supabase
      .channel('courses-students')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, () => {
        fetchStudents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
      supabase.removeChannel(coursesSub);
    };
  }, [fetchStudents]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchesSearch = s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (s.email?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
                          s.enrollment_number.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || s.status.toUpperCase() === statusFilter;
      const matchesCourse = courseFilter === 'ALL' || s.course_name === courseFilter;
      return matchesSearch && matchesStatus && matchesCourse;
    });
  }, [students, searchTerm, statusFilter, courseFilter]);

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const tenantId = localStorage.getItem('tenant_id');
    const role = localStorage.getItem('role');
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    
    let query = supabase
      .from('students')
      .update({ status: newStatus as any })
      .eq('id', id);

    if (role !== 'super_admin' && tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { error } = await query;
    
    if (error) console.error('Error updating status:', error);
  };

  const handleDeleteStudent = async (id: string) => {
    if (confirm('Are you sure you want to delete this student record? This action cannot be undone.')) {
      const tenantId = localStorage.getItem('tenant_id');
      const role = localStorage.getItem('role');
      
      let query = supabase
        .from('students')
        .delete()
        .eq('id', id);

      if (role !== 'super_admin' && tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { error } = await query;
      
      if (error) {
        console.error('Error deleting student:', error);
      } else {
        setActiveActionMenu(null);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    
    const role = localStorage.getItem('role') || 'staff';
    const tenantId = localStorage.getItem('tenant_id');
    const studentData: any = {
      full_name: formData.get('full_name'),
      email: formData.get('email') || null,
      date_of_birth: formData.get('date_of_birth') || null,
      gender: formData.get('gender') || null,
      blood_group: formData.get('blood_group') || null,
      emergency_contact: formData.get('emergency_contact') || null,
      permanent_address: formData.get('permanent_address') || null,
      temporary_address: formData.get('temporary_address') || null,
      father_name: formData.get('father_name') || null,
      father_contact: formData.get('father_contact') || null,
      mother_name: formData.get('mother_name') || null,
      mother_contact: formData.get('mother_contact') || null,
      course_name: formData.get('course_name'),
      batch_time: formData.get('batch_time'),
      joining_date: formData.get('joining_date') || null,
      enrollment_number: enrollmentNumber || generateEnrollmentNumber(),
      previous_qualification: formData.get('previous_qualification') || null,
      notes: formData.get('notes') || null,
      photo_url: profilePreview || null,
      tenant_id: tenantId
    };

    try {
      if (editingStudent) {
        let query = supabase
          .from('students')
          .update(studentData)
          .eq('id', editingStudent.id);

        if (role !== 'super_admin' && tenantId) {
          query = query.eq('tenant_id', tenantId);
        }

        const { error } = await query;
        
        if (error) {
          console.error('Supabase update error:', error.message, error.details, error.hint);
          throw new Error(error.message);
        }
      } else {
        const { data: newStudent, error: studentError } = await supabase
          .from('students')
          .insert([{ ...studentData, status: 'active' }])
          .select()
          .single();
        
        if (studentError) {
          console.error('Supabase insert error:', studentError.message, studentError.details, studentError.hint);
          throw new Error(studentError.message);
        }

        // Create initial fee record
        const course = courses.find(c => c.course_name === studentData.course_name);
        const totalCourseFee = course?.fees || 0;
        
        await supabase.from('fees').insert({
          student_id: newStudent.id,
          total_fee: totalCourseFee,
          amount_paid: 0,
          amount_pending: totalCourseFee,
          fee_status: 'pending',
          tenant_id: tenantId,
          enrollment_fee: 0
        });
        
        // Log activity (optional, don't block if it fails)
        try {
          await supabase.from('activity_log').insert({
            text: `New student enrolled: ${studentData.full_name}`,
            type: 'enrollment',
            tenant_id: tenantId
          });
        } catch (logError) {
          console.warn('Failed to log activity:', logError);
        }
      }

      setIsModalOpen(false);
      setEditingStudent(null);
      setProfilePreview(null);
      fetchStudents(); // Refresh the list
    } catch (error: any) {
      console.error('Error saving student:', error);
      alert(`Failed to save student record: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(18);
    doc.text('CoachLead - Comprehensive Student Directory', 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()} | Total Records: ${filteredStudents.length}`, 14, 22);
    
    const tableData = filteredStudents.map(s => [
      s.enrollment_number,
      s.full_name,
      s.email,
      s.date_of_birth,
      s.gender,
      s.course_name,
      s.batch_time,
      s.father_name,
      s.father_contact,
      s.emergency_contact,
      s.blood_group,
      s.joining_date,
      s.status
    ]);

    autoTable(doc, {
      startY: 28,
      head: [['Reg No', 'Name', 'Email', 'DOB', 'G', 'Course', 'Batch', 'Father', 'F.Contact', 'Emergency', 'BG', 'Joined', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 111, 217], fontSize: 7 },
      styles: { fontSize: 6, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 25 },
        2: { cellWidth: 35 },
        5: { cellWidth: 25 },
        7: { cellWidth: 20 }
      }
    });

    // Add a second page for addresses if needed, or just append to the table
    // For now, let's keep it to one main table with key fields.
    
    doc.save('coachlead-students-full.pdf');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-24 md:pb-0">
        {/* Header Actions */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Student Directory</h2>
            <p className="text-sm md:text-base text-slate-500">Manage and monitor all students in your academy</p>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-3">
            {user?.role === 'super_admin' && (
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
            <button onClick={exportPDF} className="btn-secondary w-full md:w-auto shadow-sm">
              <FileDown className="w-4 h-4" />
              Export PDF
            </button>
            <button 
              onClick={() => { 
                setEditingStudent(null); 
                setProfilePreview(null); 
                setEnrollmentNumber(generateEnrollmentNumber());
                setIsModalOpen(true); 
              }} 
              className="btn-primary w-full md:w-auto shadow-lg shadow-indigo-100"
            >
              <Plus className="w-4 h-4" />
              Add Student
            </button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="space-y-4">
          <div className="card-geometric p-4 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1 flex items-center">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10 shrink-0" />
              <input 
                type="text" 
                placeholder="Search by name, registration no., or email..." 
                className="input-field w-full pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-secondary ${showFilters ? 'bg-slate-100 border-indigo-600/30' : ''}`}
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
                <div className="card-geometric p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Account Status</label>
                    <select 
                      className="input-field w-full bg-white text-slate-900"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="ALL">All Status</option>
                      <option value="ACTIVE">Active Students</option>
                      <option value="INACTIVE">Archived Students</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Enrolled Course</label>
                    <select 
                      className="input-field w-full bg-white text-slate-900"
                      value={courseFilter}
                      onChange={(e) => setCourseFilter(e.target.value)}
                    >
                      <option value="ALL">All Departments</option>
                      {courses.map(course => (
                        <option key={course.id} value={course.course_name}>{course.course_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Students Table */}
        <div className="card-geometric overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="p-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Student Details</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Registration No.</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Course & Schedule</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Join Date</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                  <th className="p-4 pr-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400 font-medium">Loading records...</td>
                  </tr>
                ) : filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-4 px-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-600 overflow-hidden shadow-sm">
                          {student.photo_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={student.photo_url} alt={student.full_name} className="w-full h-full object-cover" />
                          ) : (
                            student.full_name[0].toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{student.full_name}</p>
                          <p className="text-xs text-slate-500">{student.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">{student.enrollment_number}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-900">{student.course_name}</span>
                        <span className="text-xs text-slate-500 font-medium">{student.batch_time}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
                        <Calendar className="w-3.5 h-3.5 text-slate-300" />
                        {student.joining_date}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => handleToggleStatus(student.id, student.status)}
                        className="focus:outline-none"
                      >
                        <StatusBadge status={student.status} />
                      </button>
                    </td>
                    <td className="p-4 pr-6 text-right relative">
                      <button 
                        onClick={() => setActiveActionMenu(activeActionMenu === student.id ? null : student.id)}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                      >
                        <MoreVertical className="w-5 h-5 text-slate-400 hover:text-slate-600" />
                      </button>
                      
                      <AnimatePresence>
                        {activeActionMenu === student.id && (
                          <>
                            <div 
                              className="fixed inset-0 z-10" 
                              onClick={() => setActiveActionMenu(null)} 
                            />
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -10 }}
                              className="absolute right-6 top-12 w-48 bg-white border border-slate-200 rounded-xl shadow-2xl z-20 py-1.5"
                            >
                              <button 
                                onClick={() => {
                                  setEditingStudent(student);
                                  setProfilePreview(student.photo_url || null);
                                  setEnrollmentNumber(student.enrollment_number);
                                  setIsModalOpen(true);
                                  setActiveActionMenu(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 font-medium"
                              >
                                <Edit2 className="w-4 h-4 text-indigo-600" />
                                Edit Record
                              </button>
                              <div className="h-px bg-slate-100 mx-1 my-1"></div>
                              <button 
                                onClick={() => handleDeleteStudent(student.id)}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-rose-50 flex items-center gap-2.5 text-rose-600 font-medium"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete Student
                              </button>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-20 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-3">
                        <Users className="w-10 h-10 opacity-20" />
                        <p className="font-medium">No students found matching your search</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit Student Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex flex-col md:items-center md:justify-center bg-white md:bg-slate-900/40 md:backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white md:rounded-2xl md:shadow-2xl md:border md:border-slate-200 w-full max-w-4xl relative min-h-screen md:min-h-0 md:my-8 overflow-hidden"
            >
              <div className="sticky top-0 z-20 p-6 border-b border-slate-100 flex items-center justify-between bg-white md:bg-slate-50/50">
                <h3 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
                  {editingStudent ? 'Edit Student Details' : 'Student Enrollment'}
                </h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSaveStudent} className="p-4 md:p-8 space-y-8 md:space-y-10 md:max-h-[80vh] overflow-y-auto custom-scrollbar">
                {/* Section: Profile Photo */}
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="relative group">
                    <div className="w-28 h-28 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden transition-all group-hover:border-indigo-400 group-hover:bg-indigo-50/30">
                      {profilePreview ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={profilePreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-indigo-600 transition-colors">
                          <Camera className="w-8 h-8" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Upload Photo</span>
                        </div>
                      )}
                    </div>
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -right-2 -bottom-2 w-8 h-8 bg-indigo-600 text-white rounded-lg shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept="image/*"
                  />
                </div>

                {/* Section: Personal Info */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                    <div className="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center text-indigo-600">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-900">Personal Information</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                      <input name="full_name" type="text" required defaultValue={editingStudent?.full_name} className="input-field w-full text-base md:text-sm" placeholder="John Doe" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                      <input name="email" type="email" required defaultValue={editingStudent?.email || ''} className="input-field w-full text-base md:text-sm" placeholder="john@example.com" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Date of Birth</label>
                      <div className="relative">
                        <input name="date_of_birth" type="date" required defaultValue={editingStudent?.date_of_birth || ''} className="input-field w-full text-base md:text-sm" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Gender</label>
                      <select name="gender" required defaultValue={editingStudent?.gender || ''} className="input-field w-full bg-slate-50 text-base md:text-sm">
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Blood Group</label>
                      <select name="blood_group" required defaultValue={editingStudent?.blood_group || ''} className="input-field w-full bg-slate-50 text-base md:text-sm">
                        <option value="">Select</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Emergency Contact</label>
                      <input name="emergency_contact" type="text" required defaultValue={editingStudent?.emergency_contact || ''} className="input-field w-full text-base md:text-sm" placeholder="+1 999..." />
                    </div>
                  </div>
                </div>

                {/* Section: Academic Info */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                    <div className="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center text-indigo-600">
                      <GraduationCap className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-900">Academic & Enrollment</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Enrolled Course</label>
                      <div className="relative">
                        <select name="course_name" required defaultValue={editingStudent?.course_name} className="input-field w-full bg-slate-50 text-slate-900 font-medium text-base md:text-sm">
                          <option value="">Select Course</option>
                          {courses.map(course => (
                            <option key={course.id} value={course.course_name}>{course.course_name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Batch Schedule</label>
                      <input name="batch_time" type="text" required defaultValue={editingStudent?.batch_time} className="input-field w-full text-base md:text-sm" placeholder="e.g. 09:00 AM - 11:00 AM" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Join Date</label>
                      <div className="relative">
                        <input name="joining_date" type="date" required defaultValue={editingStudent?.joining_date || ''} className="input-field w-full text-base md:text-sm" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row justify-end gap-3 md:gap-4 md:pt-6 border-t border-slate-100">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary w-full md:w-auto px-8 order-2 md:order-1">Discard</button>
                  <button type="submit" disabled={isSaving} className="btn-primary w-full md:w-auto px-10 shadow-lg shadow-indigo-100 order-1 md:order-2">
                    {isSaving ? 'Processing...' : (editingStudent ? 'Update Details' : 'Complete Enrollment')}
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

function StatusBadge({ status }: { status: string }) {
  const styles: any = {
    active: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    inactive: 'bg-slate-50 text-slate-400 border-slate-100',
  };

  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-widest shadow-sm transition-all hover:scale-105 ${styles[status.toLowerCase()] || styles.inactive}`}>
      {status}
    </span>
  );
}
