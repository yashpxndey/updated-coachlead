'use client';

import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { CreditCard, IndianRupee, AlertTriangle, CheckCircle2, Building, FileText, Download, Plus, Search, X, Info, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';

type FeeRecord = Database['public']['Tables']['fees']['Row'] & {
  students?: {
    full_name: string;
    course_name: string;
    batch_time: string;
  } | null;
};

export default function FeesPage() {
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [students, setStudents] = useState<{ id: string; full_name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedStudentStructure, setSelectedStudentStructure] = useState<FeeRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('All Courses');
  const [courses, setCourses] = useState<{ id: string; course_name: string; fees?: number }[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFeeForPayment, setSelectedFeeForPayment] = useState<FeeRecord | null>(null);

  const fetchFees = async () => {
    try {
      const tenantId = localStorage.getItem('tenant_id');
      const role = localStorage.getItem('role');
      
      let query = supabase.from('fees').select(`
          *,
          students (
            full_name,
            course_name,
            batch_time
          )
        `);
      
      if (role !== 'super_admin' && tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
      
      const { data, error } = await query.order('next_due_date', { ascending: true });
      
      if (error) {
        console.error('Fees fetch error:', error.message, error.details, error.hint, error.code);
        alert(`Failed to fetch fees: ${error.message}`);
        return;
      }

      setFees(data || []);
    } catch (err: any) {
      console.error('Caught error:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStudents = async () => {
    const tenantId = localStorage.getItem('tenant_id');
    const role = localStorage.getItem('role');
    
    let query = supabase.from('students').select('id, full_name').eq('status', 'active');
    
    if (role !== 'super_admin' && tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    
    const { data } = await query;
    setStudents(data || []);

    // Fetch courses
    let courseQuery = supabase.from('courses').select('id, course_name, fees').eq('status', 'active');
    if (role !== 'super_admin' && tenantId) {
      courseQuery = courseQuery.eq('tenant_id', tenantId);
    }
    const { data: courseData } = await courseQuery;
    setCourses(courseData || []);
  };

  useEffect(() => {
    fetchFees();
    fetchStudents();

    const sub = supabase
      .channel('fees-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fees' }, () => {
        fetchFees();
      })
      .subscribe();

    const coursesSub = supabase
      .channel('courses-fees')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, () => {
        fetchStudents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
      supabase.removeChannel(coursesSub);
    };
  }, []);

  const filteredFees = useMemo(() => {
    return fees.filter(f => {
      const matchesSearch = f.students?.full_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCourse = selectedCourse === 'All Courses' || (f.students as any)?.course_name === selectedCourse;
      return matchesSearch && matchesCourse;
    });
  }, [fees, searchTerm, selectedCourse]);

  const stats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const next7Days = new Date();
    next7Days.setDate(now.getDate() + 7);

    const collectedMonth = fees
      .filter(f => f.fee_status === 'paid' && f.next_due_date && new Date(f.next_due_date) >= startOfMonth)
      .reduce((sum, f) => sum + (f.amount_paid || 0) + (f.enrollment_fee || 0), 0);

    const pendingDues = fees
      .reduce((sum, f) => sum + (f.amount_pending || 0), 0);

    const overdueCount = fees.filter(f => f.fee_status === 'overdue').length;

    const upcoming7Days = fees
      .filter(f => f.fee_status === 'pending' && f.next_due_date && new Date(f.next_due_date) <= next7Days && new Date(f.next_due_date) >= now)
      .reduce((sum, f) => sum + (f.amount_pending || 0), 0);

    return { collectedMonth, pendingDues, overdueCount, upcoming7Days };
  }, [fees]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    const tenantId = localStorage.getItem('tenant_id');
    const role = localStorage.getItem('role');
    
    let query = supabase
      .from('fees')
      .update({ fee_status: newStatus as any })
      .eq('id', id);

    if (role !== 'super_admin' && tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { error } = await query;
    
    if (error) console.error('Error updating fee status:', error);
  };

  const handleRecordPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    
    const tenantId = localStorage.getItem('tenant_id');
    const role = localStorage.getItem('role');
    const studentId = formData.get('student_id') as string;
    const amount = Number(formData.get('amount'));
    const enrollmentFeeInput = Number(formData.get('enrollment_fee') || 0);
    const totalFeeInput = Number(formData.get('total_fee') || 0);
    const method = formData.get('method') as string;
    const date = formData.get('date') as string;
    const notes = formData.get('notes') as string;

    try {
      // Find existing fee record for this student to update or create new
      let feeQuery = supabase
        .from('fees')
        .select('*')
        .eq('student_id', studentId);

      if (role !== 'super_admin' && tenantId) {
        feeQuery = feeQuery.eq('tenant_id', tenantId);
      }

      const { data: existingFee, error: fetchError } = await feeQuery.single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Fetch error:', fetchError.message, fetchError.details, fetchError.hint, fetchError.code);
        alert(`Failed to fetch fee record: ${fetchError.message}`);
        return;
      }

      const finalTotalFee = totalFeeInput;
      const finalEnrollmentFee = enrollmentFeeInput;
      const finalAmountPaid = (existingFee?.amount_paid || 0) + amount;
      const finalAmountPending = Math.max(0, finalTotalFee - finalEnrollmentFee - finalAmountPaid);

      if (existingFee) {
        const { error } = await supabase
          .from('fees')
          .update({
            total_fee: finalTotalFee,
            enrollment_fee: finalEnrollmentFee,
            amount_paid: finalAmountPaid,
            amount_pending: finalAmountPending,
            installments_paid: (existingFee.installments_paid || 0) + (amount > 0 ? 1 : 0),
            installments_pending: Math.max(0, (existingFee.installments_pending || 0) - (amount > 0 ? 1 : 0)),
            last_payment_date: date,
            payment_mode: method,
            fee_status: finalAmountPending <= 0 ? 'paid' : 'pending',
          })
          .eq('id', existingFee.id);

        if (error) {
          console.error('Payment error:', error.message, error.details, error.hint, error.code);
          alert(`Failed: ${error.message}`);
          return;
        }
      } else {
        // If no record, create one
        const { error } = await supabase
          .from('fees')
          .insert({
            student_id: studentId,
            total_fee: finalTotalFee,
            enrollment_fee: finalEnrollmentFee,
            amount_paid: finalAmountPaid,
            amount_pending: finalAmountPending,
            installments_paid: amount > 0 ? 1 : 0,
            installments_pending: 0,
            fee_status: finalAmountPending <= 0 ? 'paid' : 'pending',
            next_due_date: date,
            last_payment_date: date,
            payment_mode: method,
            tenant_id: tenantId
          });
        
        if (error) {
          console.error('Payment error:', error.message, error.details, error.hint, error.code);
          alert(`Failed: ${error.message}`);
          return;
        }
      }

      // Log activity
      const studentName = students.find(s => s.id === studentId)?.full_name || 'Student';
      await supabase.from('activity_log').insert({
        text: `Fee update/payment recorded for ${studentName}. Total: ₹${finalTotalFee}, Paid: ₹${finalAmountPaid}, Pending: ₹${finalAmountPending}`,
        type: 'payment',
        tenant_id: tenantId
      });

      alert('Payment recorded successfully!');
      setIsRecordModalOpen(false);
      setSelectedFeeForPayment(null);
      fetchFees();
    } catch (err: any) {
      console.error('Caught error:', err.message);
      alert(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const exportReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('CoachLead - Fee Collection Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text('Powered by REVJET', 14, 30);
    
    const tableData = filteredFees.map(f => [
      f.students?.full_name || 'Unknown',
      `Rs. ${f.total_fee}`,
      `Rs. ${f.amount_paid}`,
      `Rs. ${f.amount_pending}`,
      f.next_due_date || 'N/A',
      (f.fee_status || '').toUpperCase()
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Student', 'Total Fee', 'Paid', 'Pending', 'Due Date', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 111, 217] }
    });

    doc.save('coachlead-fee-report.pdf');
  };

  const downloadInvoice = (fee: FeeRecord) => {
    const doc = new jsPDF();
    const studentName = fee.students?.full_name || 'Student';
    
    // Header
    doc.setFillColor(10, 31, 68); // Navy
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('INVOICE', 14, 25);
    
    doc.setFontSize(10);
    doc.text('CoachLead ERP', 160, 20);
    doc.text('Powered by REVJET', 160, 25);

    // Content
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text(`Invoice To:`, 14, 55);
    doc.setFontSize(14);
    doc.text(studentName, 14, 62);
    
    doc.setFontSize(10);
    doc.text(`Invoice Date: ${new Date().toLocaleDateString()}`, 140, 55);
    doc.text(`Due Date: ${fee.next_due_date || 'N/A'}`, 140, 60);
    doc.text(`Invoice ID: #INV-${fee.id.slice(0, 8)}`, 140, 65);

    // Table
    autoTable(doc, {
      startY: 80,
      head: [['Description', 'Amount']],
      body: [
        ['Course Fee', `₹${fee.total_fee}`],
        ['Enrollment Fee', `₹${fee.enrollment_fee || 0}`],
        ['Amount Paid', `₹${fee.amount_paid}`],
        ['Remaining Balance', `₹${fee.amount_pending}`]
      ],
      theme: 'striped',
      headStyles: { fillColor: [30, 111, 217] }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 100;
    
    doc.setFontSize(14);
    doc.text(`Current Status: ${(fee.fee_status || '').toUpperCase()}`, 140, finalY + 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Thank you for your business!', 14, finalY + 40);
    doc.text('For any queries, contact support@coachlead.app', 14, finalY + 45);

    doc.save(`invoice-${studentName.replace(' ', '-')}.pdf`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100/50">
              <IndianRupee className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Fee Monitoring</h2>
              <p className="text-sm text-slate-500 font-medium">Manage student accounts and collection metrics</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={exportReport} className="btn-secondary shadow-sm font-bold flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Download Report
            </button>
            <button onClick={() => setIsRecordModalOpen(true)} className="btn-primary shadow-lg shadow-indigo-100 font-bold flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Record Payment
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeeStat 
            title="Revenue Ledger" 
            value={`₹${stats.collectedMonth.toLocaleString()}`} 
            icon={CheckCircle2} 
            color="text-emerald-600" 
            bg="bg-emerald-50" 
          />
          <FeeStat 
            title="Pending Dues" 
            value={`₹${stats.pendingDues.toLocaleString()}`} 
            icon={IndianRupee} 
            color="text-indigo-600" 
            bg="bg-indigo-50" 
          />
          <FeeStat 
            title="Overdue Alerts" 
            value={stats.overdueCount.toString()} 
            icon={AlertTriangle} 
            color="text-rose-600" 
            bg="bg-rose-50" 
          />
          <FeeStat 
            title="7-Day Projection" 
            value={`₹${stats.upcoming7Days.toLocaleString()}`} 
            icon={CreditCard} 
            color="text-amber-600" 
            bg="bg-amber-50" 
          />
        </div>

        {/* Main Content */}
        <div className="card-geometric overflow-hidden bg-white">
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between gap-6 bg-slate-50/30">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
              <button 
                className="px-6 py-2 rounded-lg text-sm font-bold bg-white text-indigo-600 shadow-sm transition-all"
              >
                All Ledger Entries
              </button>
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative group">
                <select 
                  className="input-field py-2.5 text-sm appearance-none pr-10 bg-white border-slate-200 font-medium"
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                >
                  <option value="All Courses">All Departments</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.course_name}>{course.course_name}</option>
                  ))}
                </select>
              </div>
              <div className="relative group flex items-center">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors pointer-events-none z-10 shrink-0" />
                <input 
                  type="text" 
                  placeholder="Seach by student name..." 
                  className="input-field pl-10 py-2.5 text-sm bg-white border-slate-200 min-w-[240px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="p-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enrolled Student</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fee Allocation</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Outstanding Balance</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Maturity Date</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Payment Status</th>
                  <th className="p-4 pr-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-16 text-center text-slate-400 font-medium">Synchronizing ledger records...</td>
                  </tr>
                ) : filteredFees.map((fee) => (
                  <tr key={fee.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-[10px] shadow-inner border border-slate-200">
                          {fee.students?.full_name[0].toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{fee.students?.full_name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-[11px] space-y-1">
                        <div className="flex justify-between items-center gap-4 max-w-[140px]">
                          <span className="text-slate-400 font-medium">Course:</span>
                          <span className="text-slate-900 font-bold">₹{fee.total_fee}</span>
                        </div>
                        <div className="flex justify-between items-center gap-4 max-w-[140px]">
                          <span className="text-slate-400 font-medium">Settled:</span>
                          <span className="text-emerald-600 font-bold">₹{fee.amount_paid}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`text-sm font-black ${fee.amount_pending > 0 ? 'text-slate-900' : 'text-emerald-600'}`}>
                        ₹{fee.amount_pending}
                      </span>
                    </td>
                    <td className="p-4 text-[11px] font-bold text-slate-500">{fee.next_due_date}</td>
                    <td className="p-4">
                      <div className="flex justify-center">
                        <select 
                          value={fee.fee_status}
                          onChange={(e) => handleStatusChange(fee.id, e.target.value)}
                          className={`text-[9px] font-black px-3 py-1 rounded-full border uppercase tracking-widest cursor-pointer outline-none shadow-sm transition-all ${
                            fee.fee_status === 'paid' ? 'text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100' :
                            fee.fee_status === 'pending' ? 'text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100' :
                            'text-rose-600 border-rose-200 bg-rose-50 hover:bg-rose-100'
                          }`}
                        >
                          <option value="paid">Paid</option>
                          <option value="pending">Pending</option>
                          <option value="overdue">Overdue</option>
                        </select>
                      </div>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => setSelectedStudentStructure(fee)}
                          className="p-2 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-all"
                          title="Structure Analysis"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => downloadInvoice(fee)}
                          className="p-2 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg transition-all"
                          title="Generate Invoice"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Fee Structure Modal */}
      <AnimatePresence>
        {selectedStudentStructure && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="card-geometric w-full max-w-md p-8 relative bg-white border-slate-200 shadow-2xl"
            >
              <button 
                onClick={() => setSelectedStudentStructure(null)}
                className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="mb-8">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
                  <FileText className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Ledger Analysis</h3>
                <p className="text-slate-500 font-medium">{selectedStudentStructure.students?.full_name}</p>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Liability</span>
                  <span className="font-bold text-slate-900 tracking-tight">₹{selectedStudentStructure.total_fee}</span>
                </div>
                <div className="flex justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Enrollment Fee</span>
                  <span className="font-bold text-slate-900 tracking-tight">₹{selectedStudentStructure.enrollment_fee || 0}</span>
                </div>
                <div className="flex justify-between p-4 rounded-xl bg-indigo-50/50 border border-indigo-100">
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Settled Amount</span>
                  <span className="font-bold text-indigo-600 tracking-tight">₹{selectedStudentStructure.amount_paid}</span>
                </div>
                <div className="flex justify-between p-4 rounded-xl bg-rose-50 border border-rose-100">
                  <span className="text-xs font-bold text-rose-600 uppercase tracking-widest">Current Balance</span>
                  <span className="font-bold text-rose-600 tracking-tight">₹{selectedStudentStructure.amount_pending}</span>
                </div>
                <div className="flex justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Installments</span>
                  <span className="font-bold text-slate-900 tracking-tight">{selectedStudentStructure.installments_paid} / {selectedStudentStructure.installments_paid + (selectedStudentStructure.installments_pending || 0)}</span>
                </div>
              </div>
              
              <button 
                onClick={() => setSelectedStudentStructure(null)}
                className="btn-primary w-full mt-8 py-3.5 shadow-lg shadow-indigo-100 font-bold tracking-tight"
              >
                Close Ledger Analysis
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Record Payment Modal */}
      <AnimatePresence>
        {isRecordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="card-geometric w-full max-w-lg p-8 relative bg-white border-slate-200 shadow-2xl"
            >
              <button 
                onClick={() => setIsRecordModalOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="mb-8">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-4">
                  <Plus className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Post Ledger Payment</h3>
                <p className="text-slate-500 font-medium">Record a new payment transaction with geometric precision.</p>
              </div>
              
              <form onSubmit={handleRecordPayment} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Student Beneficiary</label>
                  <select 
                    name="student_id" 
                    required 
                    className="input-field w-full bg-white text-slate-900 font-bold border-slate-200"
                    onChange={(e) => {
                      const studentId = e.target.value;
                      const fee = fees.find(f => f.student_id === studentId);
                      setSelectedFeeForPayment(fee || null);
                    }}
                  >
                    <option value="">Select Student Profile</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Total Liability (₹)</label>
                    <input 
                      name="total_fee" 
                      type="number" 
                      required 
                      className="input-field w-full bg-slate-50 border-slate-200 font-bold" 
                      placeholder="0.00" 
                      defaultValue={selectedFeeForPayment?.total_fee || 0}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Enrollment Fee (₹)</label>
                    <input 
                      name="enrollment_fee" 
                      type="number" 
                      required
                      className="input-field w-full bg-slate-50 border-slate-200 font-bold" 
                      placeholder="0.00" 
                      defaultValue={selectedFeeForPayment?.enrollment_fee || 0}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Transaction Value (₹)</label>
                    <input name="amount" type="number" required className="input-field w-full bg-white border-slate-200 font-bold text-emerald-600 focus:ring-emerald-500" placeholder="0.00" defaultValue={0} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Instrument Date</label>
                    <input name="date" type="date" required className="input-field w-full bg-white border-slate-200" defaultValue={new Date().toISOString().split('T')[0]} />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Settlement Method</label>
                  <select name="method" required className="input-field w-full bg-white text-slate-900 border-slate-200 font-medium">
                    <option value="CASH">Currency / Cash</option>
                    <option value="BANK">Bank Ledger Transfer</option>
                    <option value="ONLINE">Digital Payment Gateway</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Transaction Manifest (Optional)</label>
                  <textarea name="notes" className="input-field w-full h-24 resize-none bg-white border-slate-200 text-sm" placeholder="Add relevant transaction identifiers or notes..."></textarea>
                </div>

                <div className="flex justify-end gap-3 mt-8">
                  <button type="button" onClick={() => setIsRecordModalOpen(false)} className="btn-secondary px-6 font-bold shadow-sm">Cancel</button>
                  <button type="submit" disabled={isSaving} className="btn-primary px-10 font-bold shadow-lg shadow-indigo-100">
                    {isSaving ? 'Processing Ledger...' : 'Post Payment'}
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

function FeeStat({ title, value, icon: Icon, color, bg }: any) {
  return (
    <div className="card-geometric p-6 flex items-center justify-between bg-white border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-indigo-100 group">
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">{title}</p>
        <p className="text-2xl font-bold text-slate-900 tracking-tight">{value}</p>
      </div>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${bg}`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
    </div>
  );
}
