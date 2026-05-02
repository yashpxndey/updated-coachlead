'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Camera, 
  QrCode, 
  UserCheck, 
  Calendar, 
  Building,
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Plus, 
  Save, 
  Lock, 
  FileText, 
  Table as TableIcon,
  X,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';

type Student = Database['public']['Tables']['students']['Row'];
type Attendance = Database['public']['Tables']['attendance']['Row'];

export default function AttendancePage() {
  const [activeTab, setActiveTab] = useState<'manual' | 'qr'>('manual');
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const tenantId = localStorage.getItem('tenant_id');
      const role = localStorage.getItem('role');

      // Fetch students
      let studentQuery = supabase.from('students').select('*').eq('status', 'active');
      if (role !== 'super_admin' && tenantId) {
        studentQuery = studentQuery.eq('tenant_id', tenantId);
      }
      const { data: studentsData } = await studentQuery;
      
      setStudents(studentsData || []);

      // Fetch courses
      let courseQuery = supabase.from('courses').select('*').eq('status', 'active');
      if (role !== 'super_admin' && tenantId) {
        courseQuery = courseQuery.eq('tenant_id', tenantId);
      }
      const { data: coursesData } = await courseQuery;
      setCourses(coursesData || []);

      if (coursesData && coursesData.length > 0 && !selectedClass) {
        setSelectedClass(coursesData[0].course_name);
      }

      // Fetch attendance for selected date and class
      let attendanceQuery = supabase.from('attendance').select('*').eq('date', selectedDate).eq('class_name', selectedClass);
      if (role !== 'super_admin' && tenantId) {
        attendanceQuery = attendanceQuery.eq('tenant_id', tenantId);
      }
      const { data: attendanceData } = await attendanceQuery;
      
      setAttendance(attendanceData || []);
      
      // Check if this session is locked
      const locked = attendanceData?.some(a => a.is_locked) || false;
      setIsLocked(locked);
    } catch (error) {
      console.error('Error fetching attendance data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, selectedClass]);

  useEffect(() => {
    fetchData();

    const sub = supabase
      .channel('attendance-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
        fetchData();
      })
      .subscribe();

    const coursesSub = supabase
      .channel('courses-attendance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
      supabase.removeChannel(coursesSub);
    };
  }, [selectedDate, selectedClass, fetchData]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => 
      s.course_name === selectedClass &&
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [students, selectedClass, searchQuery]);

  const handleStatusChange = async (studentId: string, newStatus: string) => {
    if (isLocked) return;

    const tenantId = localStorage.getItem('tenant_id');
    const role = localStorage.getItem('role');
    const existingRecord = attendance.find(a => a.student_id === studentId);

    if (existingRecord) {
      let query = supabase
        .from('attendance')
        .update({ status: newStatus as any })
        .eq('id', existingRecord.id);

      if (role !== 'super_admin' && tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { error } = await query;
      if (error) console.error('Error updating attendance:', error);
    } else {
      const { error } = await supabase
        .from('attendance')
        .insert({
          student_id: studentId,
          date: selectedDate,
          class_name: selectedClass,
          status: newStatus as any,
          is_locked: false,
          tenant_id: tenantId
        });
      if (error) console.error('Error inserting attendance:', error);
    }
    
    // Refresh data to show changes immediately
    fetchData();
  };

  const submitAndLock = async () => {
    if (attendance.length === 0) {
      alert('Please mark attendance for at least one student before locking.');
      return;
    }

    if (confirm('Are you sure you want to submit and lock this attendance? You won\'t be able to make changes after this.')) {
      setIsLoading(true);
      try {
        const tenantId = localStorage.getItem('tenant_id');
        const role = localStorage.getItem('role');

        let query = supabase
          .from('attendance')
          .update({ is_locked: true })
          .eq('date', selectedDate)
          .eq('class_name', selectedClass);

        if (role !== 'super_admin' && tenantId) {
          query = query.eq('tenant_id', tenantId);
        }

        const { error } = await query;
        
        if (error) throw error;
        
        setIsLocked(true);
        alert('Attendance has been locked successfully.');
      } catch (error) {
        console.error('Error locking attendance:', error);
        alert('Failed to lock attendance.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const saveDraft = async () => {
    alert('Attendance is automatically saved as you mark it. "Submit & Lock" will finalize the records.');
  };

  const downloadDailyPDF = () => {
    const doc = new jsPDF();
    const date = selectedDate;
    
    doc.setFontSize(20);
    doc.text('Daily Attendance Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Class: ${selectedClass}`, 14, 30);
    doc.text(`Date: ${date}`, 14, 35);
    
    const tableData = filteredStudents.map(s => {
      const record = attendance.find(a => a.student_id === s.id);
      return [s.full_name, record?.status?.toUpperCase() || 'PENDING', record?.created_at ? new Date(record.created_at).toLocaleTimeString() : 'N/A'];
    });
    
    autoTable(doc, {
      startY: 45,
      head: [['Student Name', 'Status', 'Time Marked']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 111, 217] }
    });
    
    doc.save(`attendance_${selectedClass.replace(/\s+/g, '_')}_${date}.pdf`);
  };

  const downloadMonthlyXLSX = () => {
    // This would ideally be a more complex query to fetch all records for the month
    alert('Monthly XLSX export would require fetching data for the entire month from Supabase.');
  };

  const handleScan = () => {
    setIsScanning(true);
    // Simulate QR scan
    setTimeout(() => {
      setIsScanning(false);
      const randomStudent = filteredStudents[Math.floor(Math.random() * filteredStudents.length)];
      if (randomStudent) {
        setScanResult(randomStudent.full_name);
        handleStatusChange(randomStudent.id, 'present');
        setTimeout(() => setScanResult(null), 3000);
      }
    }, 2000);
  };

  const getStudentStatus = (studentId: string) => {
    return attendance.find(a => a.student_id === studentId)?.status || 'pending';
  };

  const getStudentLastMarked = (studentId: string) => {
    const record = attendance.find(a => a.student_id === studentId);
    if (!record) return 'Never';
    return new Date(record.created_at).toLocaleString();
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <UserCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Attendance Tracking</h2>
              <div className="flex items-center gap-2 mt-1">
                {isLocked ? (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100 uppercase tracking-widest">
                    <Lock className="w-3 h-3" /> Locked Session
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 uppercase tracking-widest text-center">
                    <Clock className="w-3 h-3" /> Live Session
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-sm">
            <button 
              onClick={() => setActiveTab('manual')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'manual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Manual List
            </button>
            <button 
              onClick={() => setActiveTab('qr')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'qr' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              QR Scanner
            </button>
          </div>
        </div>

        {activeTab === 'manual' && (
          <div className="space-y-6">
            <div className="card-geometric p-6 grid grid-cols-1 md:grid-cols-4 gap-6 items-end bg-slate-50/50">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Select Department</label>
                <div className="relative">
                  <select 
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="input-field w-full bg-white text-slate-900 font-medium"
                  >
                    {courses.map(course => (
                      <option key={course.id} value={course.course_name}>{course.course_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Session Date</label>
                <div className="relative">
                  <input 
                    type="date" 
                    className="input-field w-full bg-white text-slate-900" 
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    disabled={isLocked} 
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={fetchData} className="btn-secondary flex-1 shadow-sm font-bold">Refresh Data</button>
              </div>
              <div className="flex gap-2">
                <button onClick={downloadDailyPDF} className="btn-secondary flex-1 shadow-sm font-bold">
                  <FileText className="w-4 h-4" />
                  PDF Report
                </button>
              </div>
            </div>

            <div className="card-geometric overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md flex items-center">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10 shrink-0" />
                  <input 
                    type="text" 
                    placeholder="Search enrolled students..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-field pl-10 py-2 w-full text-sm" 
                  />
                </div>
                <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Total: <span className="text-slate-900">{filteredStudents.length} Students</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="p-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Student Information</th>
                      <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Attendance Status</th>
                      <th className="p-4 pr-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Last Interaction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoading ? (
                      <tr>
                        <td colSpan={3} className="p-16 text-center text-slate-400 font-medium">Synchronizing session records...</td>
                      </tr>
                    ) : filteredStudents.map((student) => {
                      const status = getStudentStatus(student.id);
                      return (
                        <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="p-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs shadow-inner">
                                {student.full_name[0].toUpperCase()}
                              </div>
                              <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{student.full_name}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-3">
                              <AttendanceToggle 
                                status="PRESENT" 
                                active={status === 'present'} 
                                onClick={() => handleStatusChange(student.id, 'present')}
                                disabled={isLocked}
                              />
                              <AttendanceToggle 
                                status="ABSENT" 
                                active={status === 'absent'} 
                                onClick={() => handleStatusChange(student.id, 'absent')}
                                disabled={isLocked}
                              />
                              <AttendanceToggle 
                                status="LATE" 
                                active={status === 'late'} 
                                onClick={() => handleStatusChange(student.id, 'late')}
                                disabled={isLocked}
                              />
                            </div>
                          </td>
                          <td className="p-4 pr-6 text-right text-[11px] font-medium text-slate-400">
                            {getStudentLastMarked(student.id)}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredStudents.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-12 text-center text-slate-400 bg-slate-50/30">
                          <p className="font-medium">No students found matching your search.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end items-center gap-6">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Marked: <span className="text-emerald-600">{attendance.length}</span> / {filteredStudents.length}</p>
                <div className="flex gap-3">
                  <button 
                    onClick={submitAndLock} 
                    disabled={isLocked || isLoading}
                    className={`btn-primary px-8 shadow-lg shadow-indigo-100 font-bold ${isLocked ? 'opacity-50 cursor-not-allowed bg-slate-400 hover:bg-slate-400 shadow-none' : ''}`}
                  >
                    {isLocked ? <Lock className="w-4 h-4" /> : null}
                    {isLocked ? 'Records Finalized' : 'Confirm & Finalize Records'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'qr' && (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="card-geometric p-12 text-center space-y-8 bg-white border-slate-200">
              <div className="relative w-72 h-72 mx-auto">
                {/* Geometric Scanning Frame */}
                <div className={`absolute -inset-4 border-2 rounded-[2rem] transition-all duration-500 ${isScanning ? 'border-indigo-600 border-dashed animate-spin-slow scale-105 opacity-100' : 'border-slate-100 opacity-50'}`} />
                <div className={`absolute inset-0 border-4 rounded-3xl transition-all ${isScanning ? 'border-indigo-600 shadow-[0_0_40px_rgba(79,70,229,0.1)]' : 'border-slate-100'}`} />
                
                <div className="absolute inset-0 flex items-center justify-center bg-slate-50 rounded-3xl overflow-hidden shadow-inner">
                  {isScanning ? (
                    <div className="space-y-6">
                      <div className="relative w-16 h-16 mx-auto">
                        <div className="absolute inset-0 border-4 border-indigo-600 rounded-full animate-ping opacity-20" />
                        <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
                      </div>
                      <p className="text-xs font-bold text-indigo-600 uppercase tracking-[0.2em] animate-pulse">Syncing QR Beam</p>
                    </div>
                  ) : scanResult ? (
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="space-y-4 p-8 bg-emerald-50 w-full h-full flex flex-col items-center justify-center"
                    >
                      <div className="w-20 h-20 bg-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-100 mb-2">
                        <CheckCircle2 className="w-10 h-10 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-slate-900 tracking-tight">{scanResult}</p>
                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mt-1">Attendance Synchronized</p>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-slate-300">
                      <QrCode className="w-32 h-32 opacity-20" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">Scanner Standby</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6 pt-4">
                <div className="max-w-sm mx-auto">
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight">QR Recognition Engine</h3>
                  <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                    Align the student&apos;s digital ID within the frame. Our system will automatically recognize the token and link it to the session ledger.
                  </p>
                </div>
                <button 
                  onClick={handleScan}
                  disabled={isScanning || isLocked}
                  className="btn-primary mx-auto px-12 py-4 rounded-2xl shadow-xl shadow-indigo-100 transition-all hover:scale-105 active:scale-95 group"
                >
                  <Camera className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                  Initialize Camera Scanner
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card-geometric p-6 flex items-center gap-5 bg-emerald-50/30 border-emerald-100">
                <div className="w-14 h-14 rounded-2xl bg-white border border-emerald-100 shadow-sm flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-slate-900 tracking-tight">
                    {attendance.filter(a => a.status === 'present').length}
                  </p>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">Present Verified</p>
                </div>
              </div>
              <div className="card-geometric p-6 flex items-center gap-5 bg-rose-50/30 border-rose-100">
                <div className="w-14 h-14 rounded-2xl bg-white border border-rose-100 shadow-sm flex items-center justify-center text-rose-600">
                  <XCircle className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-slate-900 tracking-tight">
                    {filteredStudents.length - attendance.filter(a => a.status === 'present').length}
                  </p>
                  <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mt-0.5">Pending Records</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function AttendanceToggle({ status, active, onClick, disabled }: { status: string, active: boolean, onClick: () => void, disabled?: boolean }) {
  const colors: any = {
    PRESENT: 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50',
    ABSENT: 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50',
    LATE: 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50',
  };

  const activeColors: any = {
    PRESENT: 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm',
    ABSENT: 'bg-rose-50 text-rose-600 border-rose-200 shadow-sm',
    LATE: 'bg-amber-50 text-amber-600 border-amber-200 shadow-sm',
  };

  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-1.5 rounded-lg border text-[10px] font-bold tracking-widest transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${active ? activeColors[status] : colors[status]}`}
    >
      {status}
    </button>
  );
}
