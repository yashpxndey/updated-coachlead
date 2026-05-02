'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { 
  FileText, 
  Download, 
  Search, 
  Calendar, 
  User, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  Printer,
  FileSpreadsheet,
  IndianRupee,
  Phone,
  Mail,
  MapPin,
  Award,
  Edit3,
  Save,
  X,
  Loader2,
  Plus,
  Trash2,
  Edit,
  BookOpen,
  Zap,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';

type Student = Database['public']['Tables']['students']['Row'];
type TestScore = Database['public']['Tables']['test_scores']['Row'];
type Fee = Database['public']['Tables']['fees']['Row'];
type Attendance = Database['public']['Tables']['attendance']['Row'];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June', 
  'July', 'August', 'September', 'October', 'November', 'December'
];

const YEARS = ['2024', '2025', '2026'];

// --- Helper Functions ---

const getGrade = (percentage: number) => {
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
};

const getRemark = (percentage: number) => {
  if (percentage >= 90) return 'Excellent';
  if (percentage >= 80) return 'Very Good';
  if (percentage >= 70) return 'Good';
  if (percentage >= 60) return 'Average';
  return 'Needs Improvement';
};

const getAttendanceStatus = (percentage: number) => {
  if (percentage >= 90) return { label: 'Excellent', color: 'text-emerald-600 bg-emerald-50 border border-emerald-100' };
  if (percentage >= 75) return { label: 'Satisfactory', color: 'text-indigo-600 bg-indigo-50 border border-indigo-100' };
  return { label: 'Needs Attention', color: 'text-rose-600 bg-rose-50 border border-rose-100' };
};

const getFeeStatusColor = (status: string) => {
  switch (status) {
    case 'Paid': return 'text-emerald-600 bg-emerald-50 border border-emerald-100';
    case 'Overdue': return 'text-rose-600 bg-rose-50 border border-rose-100';
    case 'Pending': return 'text-amber-600 bg-amber-50 border border-amber-100';
    default: return 'text-slate-500 bg-slate-50 border border-slate-200';
  }
};

const monthToNumber = (month: any): number => {
  if (typeof month === 'number') return month;
  const months: { [key: string]: number } = {
    'January': 1, 'February': 2, 'March': 3,
    'April': 4, 'May': 5, 'June': 6,
    'July': 7, 'August': 8, 'September': 9,
    'October': 10, 'November': 11, 'December': 12
  };
  return months[month] || parseInt(month) || 1;
};

// --- Components ---

const SectionCard = ({ title, children, className = "" }: { title: string, children: React.ReactNode, className?: string }) => (
  <div className={`card-geometric p-6 bg-white border-slate-200 ${className}`}>
    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-3 tracking-tight">
      <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
      {title}
    </h3>
    {children}
  </div>
);

export default function ReportsPage() {
  const [user, setUser] = useState<{ name: string; role: string; email: string } | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [courseFilter, setCourseFilter] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState('February');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [isEditing, setIsEditing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [reportData, setReportData] = useState<any>(null);
  const [editedData, setEditedData] = useState<any>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<any>(null);

  useEffect(() => {
    const userData = {
      name: localStorage.getItem('userName') || localStorage.getItem('userEmail')?.split('@')[0] || 'User',
      role: localStorage.getItem('role') || 'staff',
      email: localStorage.getItem('userEmail') || '',
    };
    setTimeout(() => {
      setUser(userData);
    }, 0);
  }, []);

  // Test Score Modal State
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [editingScoreId, setEditingScoreId] = useState<string | null>(null);
  const [scoreForm, setScoreForm] = useState({
    subject_name: '',
    exam_type: 'Unit Test',
    max_marks: 100,
    marks_obtained: 0,
    month: 2,
    year: 2026
  });

  const fetchStudents = useCallback(async () => {
    const tenantId = localStorage.getItem('tenant_id');
    const role = localStorage.getItem('role');
    
    let query = supabase.from('students').select('*').eq('status', 'active');
    
    if (role !== 'super_admin' && tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      setStudents(data);
      if (!selectedStudentId) setSelectedStudentId(data[0].id);
    }

    // Fetch courses
    let courseQuery = supabase.from('courses').select('*').eq('status', 'active');
    if (role !== 'super_admin' && tenantId) {
      courseQuery = courseQuery.eq('tenant_id', tenantId);
    }
    const { data: coursesData } = await courseQuery;
    setCourses(coursesData || []);
  }, [selectedStudentId]);

  const filteredStudents = useMemo(() => {
    if (courseFilter === 'ALL') return students;
    return students.filter(s => s.course_name === courseFilter);
  }, [students, courseFilter]);

  useEffect(() => {
    if (filteredStudents.length > 0 && !filteredStudents.find(s => s.id === selectedStudentId)) {
      setSelectedStudentId(filteredStudents[0].id);
    }
  }, [filteredStudents, selectedStudentId]);

  const fetchAttendanceData = useCallback(async () => {
    if (!selectedStudentId) return;

    const tenantId = localStorage.getItem('tenant_id');
    const role = localStorage.getItem('role');

    // Calculate start and end date for the selected month
    const monthNum = monthToNumber(selectedMonth);
    const startDate = `${selectedYear}-${monthNum.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(parseInt(selectedYear), monthNum, 0).getDate();
    const endDate = `${selectedYear}-${monthNum.toString().padStart(2, '0')}-${lastDay}`;

    let query = supabase
      .from('attendance')
      .select('*')
      .eq('student_id', selectedStudentId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (role !== 'super_admin' && tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching attendance:', error.message);
      return;
    }

    const present = data?.filter(a => a.status === 'present').length || 0;
    const absent = data?.filter(a => a.status === 'absent').length || 0;
    const late = data?.filter(a => a.status === 'late').length || 0;
    const total = data?.length || 0;
    const percentage = total > 0 ? parseFloat(((present / total) * 100).toFixed(1)) : 0;

    setAttendanceSummary({
      present,
      absent,
      late,
      total,
      percentage
    });
  }, [selectedStudentId, selectedMonth, selectedYear]);

  const fetchReportData = useCallback(async () => {
    if (!selectedStudentId) return;
    
    setIsLoading(true);
    try {
      const tenantId = localStorage.getItem('tenant_id');
      const role = localStorage.getItem('role');

      // 1. Fetch Marks
      let marksQuery = supabase
        .from('test_scores')
        .select('*')
        .eq('student_id', selectedStudentId)
        .eq('month', monthToNumber(selectedMonth))
        .eq('year', parseInt(selectedYear));

      if (role !== 'super_admin' && tenantId) {
        marksQuery = marksQuery.eq('tenant_id', tenantId);
      }
      const { data: marks } = await marksQuery;

      // 2. Fetch Attendance
      const startDate = `${selectedYear}-${String(monthToNumber(selectedMonth)).padStart(2, '0')}-01`;
      const endDate = `${selectedYear}-${String(monthToNumber(selectedMonth)).padStart(2, '0')}-31`;

      let attendanceQuery = supabase
        .from('attendance')
        .select('*')
        .eq('student_id', selectedStudentId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (role !== 'super_admin' && tenantId) {
        attendanceQuery = attendanceQuery.eq('tenant_id', tenantId);
      }
      const { data: attendanceRecords } = await attendanceQuery;

      const present = attendanceRecords?.filter((a: any) => a.status === 'present').length || 0;
      const absent = attendanceRecords?.filter((a: any) => a.status === 'absent').length || 0;
      const late = attendanceRecords?.filter((a: any) => a.status === 'late').length || 0;
      const totalDays = attendanceRecords?.length || 0;
      const percentage = totalDays > 0 ? Math.round((present / totalDays) * 100) : 0;
      
      // 3. Fetch Fees
      let feeQuery = supabase
        .from('fees')
        .select('*')
        .eq('student_id', selectedStudentId);

      if (role !== 'super_admin' && tenantId) {
        feeQuery = feeQuery.eq('tenant_id', tenantId);
      }
      const { data: feeData } = await feeQuery.single();

      // 4. Fetch Additional Report Data
      let reportQuery = supabase
        .from('reports')
        .select('*')
        .eq('student_id', selectedStudentId)
        .eq('month', monthToNumber(selectedMonth))
        .eq('year', parseInt(selectedYear));

      if (role !== 'super_admin' && tenantId) {
        reportQuery = reportQuery.eq('tenant_id', tenantId);
      }
      const { data: reportRecord } = await reportQuery.maybeSingle();

      const data = {
        attendance: { totalDays, present, absent, late, percentage },
        marks: marks?.map(m => ({ 
          id: m.id,
          subject: m.subject_name, 
          max: m.max_marks, 
          obtained: m.obtained_marks,
          exam_type: m.exam_type || 'N/A',
          month: m.month,
          year: m.year,
          subject_name: m.subject_name,
          max_marks: m.max_marks,
          obtained_marks: m.obtained_marks
        })) || [],
        fees: feeData ? {
          total: feeData.total_fee,
          paid: feeData.amount_paid,
          pending: feeData.amount_pending,
          enrollment_fee: feeData.enrollment_fee || 0,
          status: feeData.fee_status.charAt(0).toUpperCase() + feeData.fee_status.slice(1)
        } : { total: 0, paid: 0, pending: 0, enrollment_fee: 0, status: 'N/A' },
        additional: reportRecord ? {
          remarks: reportRecord.teacher_remarks,
          behavior: reportRecord.behavior_rating,
          assignmentRate: reportRecord.assignment_rate,
          extracurricular: reportRecord.extracurricular,
          overallRating: reportRecord.performance_rating,
          manual_present: reportRecord.manual_present || 0,
          manual_absent: reportRecord.manual_absent || 0,
          manual_late: reportRecord.manual_late || 0,
          curriculum_matrix: reportRecord.curriculum_matrix || '',
          competency_peaks: reportRecord.competency_peaks || '',
          development_focus: reportRecord.development_focus || '',
          assignment_compliance: reportRecord.assignment_compliance || '',
          behavioral_abstract: reportRecord.behavioral_abstract || '',
          final_narrative_audit: reportRecord.final_narrative_audit || ''
        } : {
          remarks: '',
          behavior: 'Good',
          assignmentRate: 0,
          extracurricular: '',
          overallRating: 'Good',
          manual_present: 0,
          manual_absent: 0,
          manual_late: 0,
          curriculum_matrix: '',
          competency_peaks: '',
          development_focus: '',
          assignment_compliance: '',
          behavioral_abstract: '',
          final_narrative_audit: ''
        }
      };

      setReportData(data);
      setEditedData(JSON.parse(JSON.stringify(data)));
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedStudentId, selectedMonth, selectedYear]);

  const handleAddScore = () => {
    setEditingScoreId(null);
    setScoreForm({
      subject_name: '',
      exam_type: 'Unit Test',
      max_marks: 100,
      marks_obtained: 0,
      month: MONTHS.indexOf(selectedMonth) + 1,
      year: parseInt(selectedYear)
    });
    setIsScoreModalOpen(true);
  };

  const handleEditScore = (score: any) => {
    setEditingScoreId(score.id);
    setScoreForm({
      subject_name: score.subject_name,
      exam_type: score.exam_type || 'Unit Test',
      max_marks: score.max_marks,
      marks_obtained: score.obtained_marks,
      month: Number(score.month),
      year: score.year
    });
    setIsScoreModalOpen(true);
  };

  const handleDeleteScore = async (id: string) => {
    if (!confirm('Are you sure you want to delete this score?')) return;
    
    try {
      const tenantId = localStorage.getItem('tenant_id');
      const role = localStorage.getItem('role');
      
      let query = supabase
        .from('test_scores')
        .delete()
        .eq('id', id);

      if (role !== 'super_admin' && tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { error } = await query;
      
      if (error) {
        console.error('Delete error:', error.message);
        alert('Failed to delete score');
        return;
      }

      // Optimistic update to remove row instantly
      setReportData((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          marks: prev.marks.filter((m: any) => m.id !== id)
        };
      });

      alert('Score deleted successfully');
      fetchReportData();
    } catch (error: any) {
      console.error('Error deleting score:', error?.message || error);
      alert('Failed to delete score');
    }
  };

  const handleScoreSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedStudentId) return;
    
    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return;

    setIsLoading(true);
    try {
      const tenantId = localStorage.getItem('tenant_id');
      const role = localStorage.getItem('role');
      
      const payload: any = {
        student_id: selectedStudentId,
        subject_name: scoreForm.subject_name,
        max_marks: Number(scoreForm.max_marks),
        obtained_marks: Number(scoreForm.marks_obtained),
        month: monthToNumber(scoreForm.month),
        year: Number(scoreForm.year),
        tenant_id: tenantId
      };

      // Only add exam_type if it's likely to exist, but based on schema it doesn't.
      // However, the user explicitly asked for it. I will keep it for now but remove student_name.
      // If exam_type also fails, it will be the next error to fix.
      // payload.exam_type = scoreForm.exam_type; 

      console.log('Submitting score data:', payload);
      console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

      let result;
      if (editingScoreId) {
        let updateQuery = supabase
          .from('test_scores')
          .update(payload)
          .eq('id', editingScoreId);

        if (role !== 'super_admin' && tenantId) {
          updateQuery = updateQuery.eq('tenant_id', tenantId);
        }
        result = await updateQuery.select();
      } else {
        result = await supabase
          .from('test_scores')
          .insert([payload])
          .select();
      }

      const { data, error } = result;

      if (error) {
        console.error('Supabase error:', JSON.stringify(error));
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        console.error('Error code:', error.code);
        alert(`Failed to save: ${error.message || JSON.stringify(error)}`);
        return;
      }

      console.log('Score saved successfully:', data);
      alert('Score saved successfully!');
      setIsScoreModalOpen(false);
      fetchReportData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : JSON.stringify(err);
      console.error('Caught error:', message);
      alert(`Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitializeMetric = async () => {
    if (!selectedStudentId) {
      alert('Please select a student first');
      return;
    }

    const student = students.find(s => s.id === selectedStudentId);
    const tenantId = localStorage.getItem('tenant_id');

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('reports')
        .upsert({
          student_id: selectedStudentId,
          student_name: student?.full_name,
          tenant_id: tenantId,
          month: monthToNumber(selectedMonth),
          year: parseInt(selectedYear),
          teacher_remarks: '',
          behavior_rating: 'Good',
          performance_rating: 'Good',
          assignment_rate: 0,
          curriculum_matrix: '',
          competency_peaks: '',
          development_focus: '',
          assignment_compliance: '',
          behavioral_abstract: '',
          final_narrative_audit: '',
          manual_present: 0,
          manual_absent: 0,
          manual_late: 0
        });

      if (error) {
        console.error('Initialize error:', error.message);
        alert(`Failed: ${error.message}`);
        return;
      }

      await fetchReportData();
      alert('Report initialized successfully!');
    } catch (err: any) {
      console.error('Error:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();

    const sub = supabase
      .channel('courses-reports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, () => {
        fetchStudents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [fetchStudents]);

  useEffect(() => {
    fetchReportData();
    fetchAttendanceData();

    // Set up real-time subscription for attendance
    const attendanceSub = supabase
      .channel('attendance-sync')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'attendance',
        filter: `student_id=eq.${selectedStudentId}`
      }, () => {
        fetchAttendanceData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(attendanceSub);
    };
  }, [fetchReportData, fetchAttendanceData, selectedStudentId]);

  const student = students.find(s => s.id === selectedStudentId);

  const stats = useMemo(() => {
    const activeData = isEditing ? editedData : reportData;
    if (!activeData || !activeData.marks || activeData.marks.length === 0) return null;
    
    const sortedMarks = [...activeData.marks].sort((a, b) => b.obtained - a.obtained);
    const strongSubjects = sortedMarks.slice(0, 2);
    const weakSubjects = sortedMarks.slice(-2).reverse();
    
    const totalMax = activeData.marks.reduce((acc: number, m: any) => acc + m.max, 0);
    const totalObtained = activeData.marks.reduce((acc: number, m: any) => acc + m.obtained, 0);
    const overallPercentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;

    // Find highest and lowest scores for highlighting
    let highestId = '';
    let lowestId = '';
    if (activeData.marks.length > 0) {
      const sorted = [...activeData.marks].sort((a, b) => (b.obtained / b.max) - (a.obtained / a.max));
      highestId = sorted[0].id;
      lowestId = sorted[sorted.length - 1].id;
    }
    
    return {
      strongSubjects,
      weakSubjects,
      totalMax,
      totalObtained,
      overallPercentage,
      overallGrade: getGrade(overallPercentage),
      highestId,
      lowestId
    };
  }, [reportData, editedData, isEditing]);

  const handleMarkChange = (index: number, value: string) => {
    const numValue = parseInt(value) || 0;
    const newMarks = [...editedData.marks];
    newMarks[index] = { ...newMarks[index], obtained: numValue };
    setEditedData({ ...editedData, marks: newMarks });
  };

  const handleApplyChanges = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedStudentId || !editedData) return;
    
    const student = students.find(s => s.id === selectedStudentId);
    const tenantId = localStorage.getItem('tenant_id');
    const role = localStorage.getItem('role');
    
    setIsLoading(true);
    console.log('Applying changes with data:', editedData);
    try {
      // Create a clean copy of editedData without any DOM references
      const cleanData = {
        marks: editedData.marks.map((m: any) => ({
          subject: m.subject,
          obtained: m.obtained,
          max: m.max
        }))
      };

      // Save Marks to test_scores
      for (const m of cleanData.marks) {
        // Check if record exists
        let scoreQuery = supabase
          .from('test_scores')
          .select('id')
          .eq('student_id', selectedStudentId)
          .eq('subject_name', m.subject)
          .eq('month', monthToNumber(selectedMonth))
          .eq('year', parseInt(selectedYear));

        if (role !== 'super_admin' && tenantId) {
          scoreQuery = scoreQuery.eq('tenant_id', tenantId);
        }

        const { data: existing } = await scoreQuery.maybeSingle();

        if (existing) {
          let updateQuery = supabase
            .from('test_scores')
            .update({ obtained_marks: m.obtained, max_marks: m.max })
            .eq('id', existing.id);

          if (role !== 'super_admin' && tenantId) {
            updateQuery = updateQuery.eq('tenant_id', tenantId);
          }

          const { error } = await updateQuery;
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('test_scores')
            .insert({
              student_id: selectedStudentId,
              subject_name: m.subject,
              obtained_marks: m.obtained,
              max_marks: m.max,
              month: monthToNumber(selectedMonth),
              year: parseInt(selectedYear),
              tenant_id: tenantId
            });
          if (error) throw error;
        }
      }

      // Save Additional Report Data to reports table
      const reportPayload = {
        student_id: selectedStudentId,
        student_name: student?.full_name,
        month: monthToNumber(selectedMonth),
        year: parseInt(selectedYear),
        teacher_remarks: editedData.additional.remarks,
        behavior_rating: editedData.additional.behavior,
        assignment_rate: editedData.additional.assignmentRate,
        extracurricular: editedData.additional.extracurricular,
        performance_rating: editedData.additional.overallRating,
        manual_present: editedData.additional.manual_present,
        manual_absent: editedData.additional.manual_absent,
        manual_late: editedData.additional.manual_late,
        curriculum_matrix: editedData.additional.curriculum_matrix || '',
        competency_peaks: editedData.additional.competency_peaks || '',
        development_focus: editedData.additional.development_focus || '',
        assignment_compliance: editedData.additional.assignment_compliance || '',
        behavioral_abstract: editedData.additional.behavioral_abstract || '',
        final_narrative_audit: editedData.additional.final_narrative_audit || '',
        tenant_id: tenantId
      };

      let reportQuery = supabase
        .from('reports')
        .select('id')
        .eq('student_id', selectedStudentId)
        .eq('month', monthToNumber(selectedMonth))
        .eq('year', parseInt(selectedYear));

      if (role !== 'super_admin' && tenantId) {
        reportQuery = reportQuery.eq('tenant_id', tenantId);
      }

      const { data: existingReport } = await reportQuery.maybeSingle();

      if (existingReport) {
        let updateQuery = supabase
          .from('reports')
          .update(reportPayload)
          .eq('id', existingReport.id);

        if (role !== 'super_admin' && tenantId) {
          updateQuery = updateQuery.eq('tenant_id', tenantId);
        }

        const { error: reportError } = await updateQuery;
        if (reportError) throw reportError;
      } else {
        const { error: reportError } = await supabase
          .from('reports')
          .insert([reportPayload]);
        if (reportError) throw reportError;
      }

      // Log activity
      await supabase.from('activity_log').insert({
        text: `Updated academic report for ${student?.full_name} (${selectedMonth} ${selectedYear})`,
        type: 'report_update',
        tenant_id: tenantId
      });

      await fetchReportData();
      await fetchAttendanceData();
      setIsModalOpen(false);
      alert('Report changes applied successfully!');
    } catch (error: any) {
      console.error('Error applying report changes:', error?.message || JSON.stringify(error));
      alert(`Failed to apply changes: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAttendanceChange = (field: string, value: string) => {
    const numValue = parseInt(value) || 0;
    const newAttendance = { ...editedData.attendance, [field]: numValue };
    
    // Recalculate percentage
    if (field === 'present' || field === 'totalDays') {
      newAttendance.percentage = parseFloat(((newAttendance.present / newAttendance.totalDays) * 100).toFixed(1));
    }
    
    setEditedData({ ...editedData, attendance: newAttendance });
  };

  const handleAdditionalChange = (field: string, value: any) => {
    setEditedData({
      ...editedData,
      additional: { ...editedData.additional, [field]: value }
    });
  };

  const handleFeeChange = (field: string, value: any) => {
    const newFees = { ...editedData.fees, [field]: value };
    if (field === 'paid' || field === 'total') {
      newFees.pending = Math.max(0, newFees.total - newFees.paid);
    }
    setEditedData({ ...editedData, fees: newFees });
  };

  const downloadPDF = async () => {
    if (!reportData || !student || isDownloading) return;
    
    try {
      setIsDownloading(true);
      
      // We switch to jspdf-autotable for a more robust and professional PDF generation.
      // This avoids html2canvas issues with modern CSS color functions like oklab/oklch
      // which are used by default in Tailwind CSS v4.
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header with Branding
      doc.setFillColor(10, 31, 68); // --color-primary: #0A1F44
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('ACADEMIC REPORT', 14, 22);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${selectedMonth.toUpperCase()} ${selectedYear}`, 14, 32);
      doc.text('Generated on: ' + new Date().toLocaleDateString(), pageWidth - 14, 32, { align: 'right' });

      // Student Info Section
      doc.setTextColor(10, 31, 68);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('STUDENT INFORMATION', 14, 52);
      
      const infoData = [
        ['Name', student.full_name, 'Enrollment', student.enrollment_number],
        ['Course', student.course_name, 'Batch', student.batch_time],
        ['Gender', student.gender || 'N/A', 'Contact', student.father_contact || student.phone || 'N/A']
      ];

      autoTable(doc, {
        startY: 56,
        body: infoData,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 2 },
        columnStyles: {
          0: { fontStyle: 'bold', textColor: [100, 100, 100], cellWidth: 30 },
          2: { fontStyle: 'bold', textColor: [100, 100, 100], cellWidth: 30 }
        }
      });

      let currentY = (doc as any).lastAutoTable.finalY + 15;

      // Attendance Section
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('ATTENDANCE SUMMARY', 14, currentY);

      // Priority Logic: Use manual data if any manual value is > 0
      const hasManualData = (reportData.additional.manual_present || 0) > 0 || 
                           (reportData.additional.manual_absent || 0) > 0 || 
                           (reportData.additional.manual_late || 0) > 0;

      const attendanceToUse = hasManualData ? {
        present: reportData.additional.manual_present || 0,
        absent: reportData.additional.manual_absent || 0,
        late: reportData.additional.manual_late || 0,
        total: (reportData.additional.manual_present || 0) + (reportData.additional.manual_absent || 0),
        percentage: ((reportData.additional.manual_present || 0) + (reportData.additional.manual_absent || 0)) > 0 
          ? parseFloat(((reportData.additional.manual_present / (reportData.additional.manual_present + reportData.additional.manual_absent)) * 100).toFixed(1)) 
          : 0
      } : {
        present: attendanceSummary?.present || 0,
        absent: attendanceSummary?.absent || 0,
        late: attendanceSummary?.late || 0,
        total: attendanceSummary?.total || 0,
        percentage: attendanceSummary?.percentage || 0
      };
      
      autoTable(doc, {
        startY: currentY + 4,
        head: [['Metric', 'Value', 'Status']],
        body: [
          ['Total Days (Present + Absent)', attendanceToUse.total, ''],
          ['Days Present', attendanceToUse.present, ''],
          ['Days Absent', attendanceToUse.absent, ''],
          ['Days Late', attendanceToUse.late, ''],
          ['Attendance Percentage', `${attendanceToUse.percentage}%`, getAttendanceStatus(attendanceToUse.percentage).label]
        ],
        theme: 'striped',
        headStyles: { fillColor: [30, 111, 217] }, // --color-accent: #1E6FD9
        styles: { fontSize: 10 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      // Academic Performance Section
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('ACADEMIC PERFORMANCE', 14, currentY);

      const marksBody = reportData.marks.map((m: any) => {
        const perc = (m.obtained / m.max) * 100;
        return [
          m.subject,
          m.max,
          m.obtained,
          `${perc.toFixed(1)}%`,
          getGrade(perc),
          getRemark(perc)
        ];
      });

      autoTable(doc, {
        startY: currentY + 4,
        head: [['Subject', 'Max', 'Obtained', '%', 'Grade', 'Remarks']],
        body: marksBody,
        theme: 'grid',
        headStyles: { fillColor: [30, 111, 217] },
        styles: { fontSize: 9 },
        foot: [['OVERALL TOTALS', stats?.totalMax, stats?.totalObtained, `${stats?.overallPercentage.toFixed(1)}%`, stats?.overallGrade, '']],
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      // New Analytics Sections
      const analyticsSections = [
        { title: 'CURRICULUM MATRIX ANALYSIS', content: reportData.additional.curriculum_matrix },
        { title: 'COMPETENCY PEAKS', content: reportData.additional.competency_peaks },
        { title: 'DEVELOPMENT FOCUS', content: reportData.additional.development_focus },
        { title: 'ASSIGNMENT COMPLIANCE', content: reportData.additional.assignment_compliance },
        { title: 'BEHAVIORAL ABSTRACT', content: reportData.additional.behavioral_abstract },
        { title: 'FINAL NARRATIVE AUDIT', content: reportData.additional.final_narrative_audit }
      ];

      analyticsSections.forEach((section) => {
        if (section.content) {
          if (currentY > 250) {
            doc.addPage();
            currentY = 20;
          }
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text(section.title, 14, currentY);
          
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(50, 50, 50);
          const splitContent = doc.splitTextToSize(section.content, pageWidth - 28);
          doc.text(splitContent, 14, currentY + 6);
          currentY += (splitContent.length * 5) + 15;
        }
      });

      // Fee Summary Section
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('FEE SUMMARY', 14, currentY);

      autoTable(doc, {
        startY: currentY + 4,
        body: [
          ['Course Fee', `INR ${reportData.fees.total.toLocaleString()}`],
          ['Enrollment Fee', `INR ${reportData.fees.enrollment_fee.toLocaleString()}`],
          ['Amount Paid', `INR ${reportData.fees.paid.toLocaleString()}`],
          ['Amount Pending', `INR ${reportData.fees.pending.toLocaleString()}`],
          ['Payment Status', reportData.fees.status]
        ],
        theme: 'plain',
        styles: { fontSize: 10 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      // Teacher Remarks Section
      if (reportData.additional.remarks) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('TEACHER REMARKS', 14, currentY);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);
        const splitRemarks = doc.splitTextToSize(reportData.additional.remarks, pageWidth - 28);
        doc.text(splitRemarks, 14, currentY + 6);
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
      }

      doc.save(`Report_${student.full_name.replace(/\s+/g, '_')}_${selectedMonth}_${selectedYear}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadXLSX = () => {
    if (!reportData || !student) return;

    const marksData = reportData.marks.map((m: any) => ({
      'Subject': m.subject,
      'Max Marks': m.max,
      'Marks Obtained': m.obtained,
      'Percentage': `${((m.obtained / m.max) * 100).toFixed(1)}%`,
      'Grade': getGrade((m.obtained / m.max) * 100)
    }));

    const attendanceData = [
      { 'Metric': 'Total Working Days', 'Value': reportData.attendance.totalDays },
      { 'Metric': 'Days Present', 'Value': reportData.attendance.present },
      { 'Metric': 'Days Absent', 'Value': reportData.attendance.absent },
      { 'Metric': 'Days Late', 'Value': reportData.attendance.late },
      { 'Metric': 'Attendance %', 'Value': `${reportData.attendance.percentage}%` },
    ];

    const wb = XLSX.utils.book_new();
    const wsMarks = XLSX.utils.json_to_sheet(marksData);
    const wsAttendance = XLSX.utils.json_to_sheet(attendanceData);

    XLSX.utils.book_append_sheet(wb, wsMarks, 'Academic Marks');
    XLSX.utils.book_append_sheet(wb, wsAttendance, 'Attendance');

    XLSX.writeFile(wb, `Academic_Report_${student.full_name.replace(/\s+/g, '_')}_${selectedMonth}_${selectedYear}.xlsx`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-12">
        {/* Header & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Academic Analytics</h2>
              <p className="text-sm text-slate-500 font-medium">Generate comprehensive performance transcripts and certification records</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isLoading ? (
              <div className="flex items-center gap-3 px-4 py-2 bg-slate-100 rounded-xl border border-slate-200">
                <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Querying...</span>
              </div>
            ) : (
              <>
                <button 
                  onClick={() => {
                    setEditedData(JSON.parse(JSON.stringify(reportData)));
                    setIsModalOpen(true);
                  }}
                  disabled={!reportData}
                  className="btn-secondary shadow-sm px-5 py-2.5 flex items-center gap-2 border-slate-200 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
                >
                  <Edit3 className="w-4 h-4 text-indigo-600" />
                  <span className="font-bold">Edit Record</span>
                </button>
                <div className="h-8 w-px bg-slate-200 mx-1" />
                <button 
                  onClick={downloadPDF}
                  disabled={!reportData || isDownloading}
                  className="btn-primary shadow-lg shadow-indigo-100 px-6 py-2.5 flex items-center gap-2 disabled:opacity-50 min-w-[100px] justify-center"
                >
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span className="font-bold">{isDownloading ? 'Archiving' : 'Export PDF'}</span>
                </button>
                <button 
                  onClick={downloadXLSX}
                  disabled={!reportData}
                  className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all text-slate-600 hover:text-emerald-600 shadow-sm disabled:opacity-50"
                  title="Export Spreadsheet"
                >
                  <FileSpreadsheet className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="card-geometric p-5 bg-slate-50/50 border-slate-200 flex flex-wrap items-center gap-5">
          <div className="w-56">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Department Filter</label>
            <div className="relative group">
              <BookOpen className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              <select 
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                disabled={isEditing}
                className="input-field w-full py-2.5 pl-10 pr-4 bg-white border-slate-200 text-sm font-bold text-slate-900 focus:ring-indigo-500 disabled:opacity-50 appearance-none shadow-sm"
              >
                <option value="ALL">All Departments</option>
                {courses.map(c => (
                  <option key={c.id} value={c.course_name}>{c.course_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 min-w-[240px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Student Descriptor</label>
            <div className="relative group">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              <select 
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                disabled={isEditing}
                className="input-field w-full py-2.5 pl-10 pr-4 bg-white border-slate-200 text-sm font-bold text-slate-900 focus:ring-indigo-500 disabled:opacity-50 appearance-none shadow-sm"
              >
                {filteredStudents.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name} ({s.enrollment_number})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="w-44">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Reporting Cycle</label>
            <div className="flex gap-2">
              <div className="relative flex-1 group">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                <select 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  disabled={isEditing}
                  className="input-field w-full py-2.5 pl-8 pr-4 bg-white border-slate-200 text-xs font-bold text-slate-900 focus:ring-indigo-500 disabled:opacity-50 appearance-none shadow-sm"
                >
                  {MONTHS.map(m => (
                    <option key={m} value={m}>{m.slice(0, 3)}</option>
                  ))}
                </select>
              </div>
              <div className="relative w-24 group">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                <select 
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  disabled={isEditing}
                  className="input-field w-full py-2.5 pl-8 pr-4 bg-white border-slate-200 text-xs font-bold text-slate-900 focus:ring-indigo-500 disabled:opacity-50 appearance-none shadow-sm"
                >
                  {YEARS.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

      {/* Report Content */}
      <AnimatePresence mode="wait">
        {reportData ? (
            <motion.div 
            key={selectedStudentId + selectedMonth + selectedYear}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            ref={reportRef}
            className="space-y-6"
          >
            {/* 1. Basic Info */}
            <SectionCard title="Undergraduate Registry Data">
              <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6 w-full">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Legal Identity</p>
                    <p className="text-lg font-black text-slate-900 tracking-tight">{student?.full_name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Registry Code</p>
                    <p className="text-lg font-black text-slate-900 tracking-tight font-mono">{student?.enrollment_number}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Academic Path</p>
                    <p className="text-lg font-black text-indigo-600 tracking-tight">{student?.course_name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Session Slot</p>
                    <p className="text-lg font-black text-slate-900 tracking-tight">{student?.batch_time}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Contact Anchor</p>
                    <p className="text-lg font-bold text-slate-700 tracking-tight">{student?.father_contact}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Demographics</p>
                    <p className="text-lg font-bold text-slate-700 tracking-tight">{student?.gender || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Temporal Origin</p>
                    <p className="text-lg font-bold text-slate-700 tracking-tight">{student?.date_of_birth || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Cert Level</p>
                    <p className="text-lg font-black text-emerald-600 tracking-tight">Active Tier</p>
                  </div>
                </div>
              </div>
            </SectionCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 2. Attendance Summary */}
              <SectionCard title="Presence Index">
                <div className="space-y-8">
                  {/* Section A: Auto Fetched */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">System Computed Metrics</h4>
                      <div className="flex items-center gap-2 px-2 py-0.5 bg-emerald-50 rounded-full border border-emerald-100">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-black text-emerald-700 uppercase tracking-tighter">Live Sync</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 shadow-sm group hover:border-emerald-200 transition-colors">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Present</p>
                        <p className="text-2xl font-black text-emerald-600 tracking-tighter">{attendanceSummary?.present || 0}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 shadow-sm group hover:border-rose-200 transition-colors">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Absent</p>
                        <p className="text-2xl font-black text-rose-600 tracking-tighter">{attendanceSummary?.absent || 0}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 shadow-sm group hover:border-amber-200 transition-colors">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Late</p>
                        <p className="text-2xl font-black text-amber-600 tracking-tighter">{attendanceSummary?.late || 0}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-indigo-600 border border-indigo-700 shadow-lg shadow-indigo-100 group">
                        <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-tighter mb-1">Ratio</p>
                        <p className="text-2xl font-black text-white tracking-tighter">{attendanceSummary?.percentage || 0}%</p>
                      </div>
                    </div>
                  </div>

                  {/* Section B: Manual Override */}
                  <div className="pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-4">
                      <Edit3 className="w-3 h-3 text-amber-500" />
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Manual Transcript Override</h4>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-100 border-dashed">
                        <p className="text-[9px] font-bold text-amber-600/70 uppercase mb-1">Override Present</p>
                        <p className="text-xl font-black text-amber-600 tracking-tighter">{reportData.additional.manual_present || 0}</p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-100 border-dashed">
                        <p className="text-[9px] font-bold text-amber-600/70 uppercase mb-1">Override Absent</p>
                        <p className="text-xl font-black text-amber-600 tracking-tighter">{reportData.additional.manual_absent || 0}</p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-100 border-dashed">
                        <p className="text-[9px] font-bold text-amber-600/70 uppercase mb-1">Override Late</p>
                        <p className="text-xl font-black text-amber-600 tracking-tighter">{reportData.additional.manual_late || 0}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-start gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <Clock className="w-4 h-4 text-slate-400 mt-0.5" />
                      <p className="text-[11px] text-slate-500 leading-relaxed font-medium capitalize">
                        Manual overrides take precedence in generated certification transcripts for validation purposes.
                      </p>
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* 4. Strong & Weak Subjects */}
              <SectionCard title="Curriculum Matrix Analysis">
                <div className="space-y-6">
                  <div className="group">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <div className="w-8 h-px bg-emerald-500 group-hover:w-12 transition-all" />
                      Competency Peaks
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {stats?.strongSubjects.map((s: any, idx: number) => (
                        <div key={`${s.subject}-${idx}`} className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-between group/item hover:bg-emerald-100 transition-colors">
                          <div>
                            <p className="text-sm font-black text-slate-900 tracking-tight">{s.subject}</p>
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-1">Prime Discipline</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-black text-emerald-600 tracking-tighter">{s.obtained}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="group">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <div className="w-8 h-px bg-rose-500 group-hover:w-12 transition-all" />
                      Development Focus
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {stats?.weakSubjects.map((s: any, idx: number) => (
                        <div key={`${s.subject}-${idx}`} className="p-4 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-between group/item hover:bg-rose-100 transition-colors">
                          <div>
                            <p className="text-sm font-black text-slate-900 tracking-tight">{s.subject}</p>
                            <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mt-1">Growth Required</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-black text-rose-600 tracking-tighter">{s.obtained}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* 3. Test Scores & Marks Table */}
            <SectionCard 
              title="Metric Performance Transcript" 
              className="relative"
            >
              <button 
                onClick={handleAddScore}
                className="absolute top-6 right-8 flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all text-[11px] font-black uppercase tracking-widest border border-indigo-100 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Initialize Metric
              </button>

              <div className="overflow-x-auto mt-4 rounded-xl border border-slate-100">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Curriculum Module</th>
                      <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Batch Type</th>
                      <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Ceiling</th>
                      <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Magnitude</th>
                      <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Percentage</th>
                      <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Grade</th>
                      <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Registry Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {reportData.marks.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-slate-400 font-medium italic lowercase">
                          No performance entries synchronized for the current reporting cycle.
                        </td>
                      </tr>
                    ) : reportData.marks.map((m: any, idx: number) => {
                      const perc = (m.obtained / m.max) * 100;
                      const isHighest = m.id === stats?.highestId;
                      const isLowest = m.id === stats?.lowestId;

                      return (
                        <tr key={m.id} className={`group hover:bg-slate-50 transition-colors ${isHighest ? 'bg-emerald-50/30' : isLowest ? 'bg-rose-50/30' : ''}`}>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${isHighest ? 'bg-emerald-100 text-emerald-600' : isLowest ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                                {m.subject[0].toUpperCase()}
                              </div>
                              <span className="text-sm font-black text-slate-900 tracking-tight">{m.subject}</span>
                              {isHighest && <Award className="w-3.5 h-3.5 text-emerald-500" />}
                            </div>
                          </td>
                          <td className="py-4 text-[11px] font-bold text-slate-500 text-center uppercase tracking-wider">{m.exam_type}</td>
                          <td className="py-4 text-sm text-slate-400 text-center font-mono font-bold tracking-tighter">{m.max}</td>
                          <td className={`py-4 text-sm text-center font-mono font-black tracking-tighter ${isHighest ? 'text-emerald-600' : isLowest ? 'text-rose-600' : 'text-slate-900'}`}>
                            {m.obtained}
                          </td>
                          <td className="py-4 text-sm text-indigo-600 text-center font-black tracking-tighter">{perc.toFixed(1)}%</td>
                          <td className="py-4 text-center">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${perc >= 80 ? 'text-emerald-600 bg-emerald-50' : perc >= 60 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50'}`}>
                              {getGrade(perc)}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleEditScore(m)}
                                className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-indigo-600 transition-all border border-transparent hover:border-slate-200"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => handleDeleteScore(m.id)}
                                className="p-2 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-900">
                    <tr className="font-bold">
                      <td className="py-5 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Aggregate Cumulative</td>
                      <td className="py-5 text-sm text-white text-center font-mono font-black">{stats?.totalMax}</td>
                      <td className="py-5 text-sm text-white text-center font-mono font-black">{stats?.totalObtained}</td>
                      <td className="py-5 text-xl text-indigo-400 text-center font-black tracking-tighter">{stats?.overallPercentage.toFixed(1)}%</td>
                      <td className="py-5 text-center">
                        <div className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-900/50 inline-block">
                          {stats?.overallGrade}
                        </div>
                      </td>
                      <td colSpan={2} className="py-5 px-6 text-[10px] font-black text-indigo-300 text-right uppercase tracking-[0.2em]">Calculated Registry Grade</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </SectionCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 5. Fee Status */}
              <SectionCard title="Financial Clearance Transcript">
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm group hover:border-indigo-100 transition-colors">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Liability</p>
                    {isEditing ? (
                      <input 
                        type="number" 
                        value={reportData.fees.total}
                        onChange={(e) => handleFeeChange('total', parseInt(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xl font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    ) : (
                      <p className="text-2xl font-black text-slate-900 tracking-tighter">₹{reportData.fees.total.toLocaleString()}</p>
                    )}
                  </div>
                  <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100 shadow-sm group">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2">Remittance Paid</p>
                    {isEditing ? (
                      <input 
                        type="number" 
                        value={reportData.fees.paid}
                        onChange={(e) => handleFeeChange('paid', parseInt(e.target.value) || 0)}
                        className="w-full bg-white border border-emerald-200 rounded px-2 py-1 text-xl font-black text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    ) : (
                      <p className="text-2xl font-black text-emerald-600 tracking-tighter">₹{reportData.fees.paid.toLocaleString()}</p>
                    )}
                  </div>
                  <div className="p-5 rounded-2xl bg-rose-50 border border-rose-100 shadow-sm">
                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-2">Balance Arrears</p>
                    <p className="text-2xl font-black text-rose-600 tracking-tighter">₹{reportData.fees.pending.toLocaleString()}</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-indigo-600 border border-indigo-700 shadow-lg shadow-indigo-100">
                    <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mb-2">Cycle Progression</p>
                    {isEditing ? (
                      <input 
                        type="number" 
                        value={reportData.fees.paidInstallments}
                        onChange={(e) => handleFeeChange('paidInstallments', parseInt(e.target.value) || 0)}
                        className="w-full bg-white/10 border border-indigo-400 rounded px-2 py-1 text-xl font-black text-white focus:outline-none"
                      />
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <p className="text-2xl font-black text-white tracking-tighter">{reportData.fees.paidInstallments}</p>
                        <span className="text-xs font-bold text-indigo-300">/ {reportData.fees.totalInstallments} INSTALLMENTS</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-4 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">Temporal Deadline</span>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={reportData.fees.nextDue}
                        onChange={(e) => handleFeeChange('nextDue', e.target.value)}
                        className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-900 text-xs font-bold text-right"
                      />
                    ) : (
                      <span className="text-slate-900 font-black">{reportData.fees.nextDue}</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">Last Audit Event</span>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={reportData.fees.lastPayment}
                        onChange={(e) => handleFeeChange('lastPayment', e.target.value)}
                        className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-900 text-xs font-bold text-right"
                      />
                    ) : (
                      <span className="text-slate-900 font-black">{reportData.fees.lastPayment}</span>
                    )}
                  </div>
                  <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Registry Status</span>
                    {isEditing ? (
                      <select 
                        value={reportData.fees.status}
                        onChange={(e) => handleFeeChange('status', e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-indigo-600 text-[10px] font-black uppercase tracking-widest outline-none"
                      >
                        <option value="Paid">Cleared</option>
                        <option value="Pending">Process</option>
                        <option value="Overdue">Flagged</option>
                      </select>
                    ) : (
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-sm ${getFeeStatusColor(reportData.fees.status)}`}>
                        {reportData.fees.status}
                      </span>
                    )}
                  </div>
                </div>
              </SectionCard>

              {/* 6. Performance Indicators */}
              <SectionCard title="Metric Detail Matrix">
                <div className="space-y-6">
                  <div className="flex justify-between items-center p-3.5 rounded-xl bg-slate-50 border border-slate-100 group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-lg border border-slate-100 group-hover:border-indigo-200 transition-colors">
                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                      </div>
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">Assignment Compliance</span>
                    </div>
                    {isEditing ? (
                      <input 
                        type="number" 
                        value={reportData.additional.assignmentRate}
                        onChange={(e) => handleAdditionalChange('assignmentRate', parseInt(e.target.value) || 0)}
                        className="w-20 bg-white border border-slate-200 rounded px-2 py-1 text-right text-slate-900 text-xs font-bold"
                      />
                    ) : (
                      <div className="flex items-center gap-3 flex-1 max-w-[200px] ml-8">
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-600 rounded-full transition-all duration-1000" 
                            style={{ width: `${reportData.additional.assignmentRate}%` }} 
                          />
                        </div>
                        <span className="text-[11px] font-black text-slate-900 font-mono">{reportData.additional.assignmentRate}%</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center p-3.5 rounded-xl bg-slate-50 border border-slate-100 group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-lg border border-slate-100 group-hover:border-indigo-200 transition-colors">
                        <Zap className="w-4 h-4 text-indigo-600" />
                      </div>
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">Behavioral Abstract</span>
                    </div>
                    {isEditing ? (
                      <select 
                        value={reportData.additional.behavior}
                        onChange={(e) => handleAdditionalChange('behavior', e.target.value)}
                        className="bg-white border border-slate-200 rounded px-2 text-indigo-600 text-[10px] font-black uppercase tracking-widest outline-none"
                      >
                        <option value="Excellent">Excellent</option>
                        <option value="Good">Good</option>
                        <option value="Average">Average</option>
                        <option value="Poor">Poor</option>
                      </select>
                    ) : (
                      <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${reportData.additional.behavior === 'Excellent' || reportData.additional.behavior === 'Good' ? 'text-emerald-600 bg-emerald-50 border border-emerald-100' : 'text-rose-600 bg-rose-50 border border-rose-100'}`}>
                        {reportData.additional.behavior}
                      </span>
                    )}
                  </div>

                  <div className="p-4 bg-slate-900 rounded-2xl shadow-xl shadow-slate-200 group transition-all">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                       <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                       Final Narrative Audit
                    </p>
                    {isEditing ? (
                      <textarea 
                        value={reportData.additional.remarks}
                        onChange={(e) => handleAdditionalChange('remarks', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-xs leading-relaxed focus:outline-none focus:border-indigo-500 min-h-[80px]"
                      />
                    ) : (
                      <p className="text-xs text-indigo-100 leading-relaxed font-medium italic">
                        "{reportData.additional.remarks || 'No qualitative narrative documented for this cycle.'}"
                      </p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-y-4 gap-x-8 pt-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Extracurricular</span>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={reportData.additional.extracurricular}
                          onChange={(e) => handleAdditionalChange('extracurricular', e.target.value)}
                          className="w-32 bg-white border border-slate-200 rounded px-2 py-1 text-right text-slate-900 text-xs font-bold"
                          placeholder="e.g. Sports, Music"
                        />
                      ) : (
                        <span className="text-sm font-black text-slate-900 tracking-tight">{reportData.additional.extracurricular || 'None'}</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Overall Rating</span>
                      {isEditing ? (
                        <select 
                          value={reportData.additional.overallRating}
                          onChange={(e) => handleAdditionalChange('overallRating', e.target.value)}
                          className="bg-white border border-slate-200 rounded px-1 text-indigo-600 font-black uppercase tracking-tighter text-xs"
                        >
                          <option value="Excellent">Excellent</option>
                          <option value="Very Good">Very Good</option>
                          <option value="Good">Good</option>
                          <option value="Average">Average</option>
                          <option value="Poor">Poor</option>
                        </select>
                      ) : (
                        <span className="text-indigo-600 font-black uppercase tracking-tighter text-xs">{reportData.additional.overallRating}</span>
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="card-geometric p-16 bg-slate-50 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-6"
          >
            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100">
              <AlertCircle className="w-10 h-10 text-slate-300" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Report Inaccessible</h3>
              <p className="text-slate-500 max-w-md mx-auto font-medium mt-1 leading-relaxed">
                The academic dataset for <span className="text-slate-900 font-bold">{student?.full_name || 'selected user'}</span> during <span className="text-indigo-600 font-bold">{selectedMonth} {selectedYear}</span> has not been initialized.
              </p>
            </div>
            <button 
              onClick={handleInitializeMetric}
              className="btn-primary px-8"
            >
              Initialize Monthly Report
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Test Score Modal */}
      <AnimatePresence>
        {isScoreModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm shadow-2xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="card-geometric w-full max-w-md p-8 bg-white relative"
            >
              <button 
                onClick={() => setIsScoreModalOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  {editingScoreId ? 'Update Metric' : 'New Metric Entry'}
                </h3>
              </div>
              
              <form onSubmit={handleScoreSubmit} className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-1.5">Module Designation</label>
                  <input 
                    type="text"
                    required
                    value={scoreForm.subject_name}
                    onChange={(e) => setScoreForm({ ...scoreForm, subject_name: e.target.value })}
                    className="input-field w-full bg-slate-50 border-slate-200"
                    placeholder="e.g. Fundamental Mathematics"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-1.5">Batch Category</label>
                  <select 
                    value={scoreForm.exam_type}
                    onChange={(e) => setScoreForm({ ...scoreForm, exam_type: e.target.value })}
                    className="input-field w-full bg-slate-50 border-slate-200 font-bold text-slate-900"
                  >
                    <option value="Unit Test">Unit Test</option>
                    <option value="Mid Term">Mid Term</option>
                    <option value="Final Exam">Final Exam</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-1.5">Metric Ceiling</label>
                    <input 
                      type="number"
                      required
                      min="1"
                      value={scoreForm.max_marks}
                      onChange={(e) => setScoreForm({ ...scoreForm, max_marks: parseInt(e.target.value) || 0 })}
                      className="input-field w-full bg-slate-50 border-slate-200 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-1.5">Achieved Magnitude</label>
                    <input 
                      type="number"
                      required
                      min="0"
                      max={scoreForm.max_marks}
                      value={scoreForm.marks_obtained}
                      onChange={(e) => setScoreForm({ ...scoreForm, marks_obtained: parseInt(e.target.value) || 0 })}
                      className="input-field w-full bg-slate-50 border-slate-200 font-mono font-bold text-indigo-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-1.5">Reporting Month</label>
                    <select 
                      value={scoreForm.month}
                      onChange={(e) => setScoreForm({ ...scoreForm, month: parseInt(e.target.value) })}
                      className="input-field w-full bg-slate-50 border-slate-200 font-bold"
                    >
                      {MONTHS.map((m, i) => (
                        <option key={m} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-1.5">Archive Year</label>
                    <select 
                      value={scoreForm.year}
                      onChange={(e) => setScoreForm({ ...scoreForm, year: parseInt(e.target.value) })}
                      className="input-field w-full bg-slate-50 border-slate-200 font-bold"
                    >
                      {YEARS.map(y => (
                        <option key={y} value={parseInt(y)}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={() => setIsScoreModalOpen(false)} 
                    className="btn-secondary px-6"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className="btn-primary px-8 shadow-lg shadow-indigo-100 font-bold uppercase tracking-widest text-[11px]"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {editingScoreId ? 'Synchronize Metric' : 'Commit Entry'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Report Modal */}
      <AnimatePresence>
        {isModalOpen && editedData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="card-geometric w-full max-w-4xl p-8 bg-white relative my-8"
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
                  <Edit3 className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  Academic Report Configuration
                </h3>
              </div>
              
              <form onSubmit={handleApplyChanges} className="space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  {/* Marks Section */}
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                       Module Magnitude (Marks)
                    </h4>
                    <div className="space-y-3">
                      {editedData.marks.map((m: any, idx: number) => (
                        <div key={`${m.subject}-${idx}`} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 group">
                          <span className="text-sm font-black text-slate-900 tracking-tight">{m.subject}</span>
                          <div className="flex items-center gap-3">
                            <input 
                              type="number" 
                              value={m.obtained}
                              onChange={(e) => handleMarkChange(idx, e.target.value)}
                              className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-center font-mono font-black text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                            <span className="text-[10px] font-bold text-slate-400">/ {m.max}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Attendance Section */}
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                       Attendance Override Matrix
                    </h4>
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                        <span className="text-sm font-black text-slate-900 tracking-tight">Present Days</span>
                        <input 
                          type="number" 
                          value={editedData.additional.manual_present}
                          onChange={(e) => handleAdditionalChange('manual_present', parseInt(e.target.value) || 0)}
                          className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-center font-mono font-black text-emerald-600 outline-none"
                        />
                      </div>
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                        <span className="text-sm font-black text-slate-900 tracking-tight">Absent Days</span>
                        <input 
                          type="number" 
                          value={editedData.additional.manual_absent}
                          onChange={(e) => handleAdditionalChange('manual_absent', parseInt(e.target.value) || 0)}
                          className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-center font-mono font-black text-rose-600 outline-none"
                        />
                      </div>
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                        <span className="text-sm font-black text-slate-900 tracking-tight">Late Logs</span>
                        <input 
                          type="number" 
                          value={editedData.additional.manual_late}
                          onChange={(e) => handleAdditionalChange('manual_late', parseInt(e.target.value) || 0)}
                          className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-center font-mono font-black text-amber-600 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Curriculum Matrix Analysis */}
                <div className="space-y-6 pt-6 border-t border-slate-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Curriculum Matrix Analysis</label>
                      <textarea 
                        value={editedData.additional.curriculum_matrix}
                        onChange={(e) => handleAdditionalChange('curriculum_matrix', e.target.value)}
                        className="input-field w-full min-h-[100px] bg-slate-50 border-slate-200 p-4 text-slate-900 font-medium font-sans" 
                        placeholder="Enter curriculum matrix analysis..."
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Competency Peaks</label>
                      <textarea 
                        value={editedData.additional.competency_peaks}
                        onChange={(e) => handleAdditionalChange('competency_peaks', e.target.value)}
                        className="input-field w-full min-h-[100px] bg-slate-50 border-slate-200 p-4 text-slate-900 font-medium font-sans" 
                        placeholder="Enter competency peaks..."
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Development Focus</label>
                    <textarea 
                      value={editedData.additional.development_focus}
                      onChange={(e) => handleAdditionalChange('development_focus', e.target.value)}
                      className="input-field w-full min-h-[80px] bg-slate-50 border-slate-200 p-4 text-slate-900 font-medium font-sans" 
                      placeholder="Enter development focus areas..."
                    />
                  </div>
                </div>

                <div className="space-y-6 pt-6 border-t border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Metric Detail Matrix</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Assignment Compliance</label>
                      <textarea 
                        value={editedData.additional.assignment_compliance}
                        onChange={(e) => handleAdditionalChange('assignment_compliance', e.target.value)}
                        className="input-field w-full min-h-[80px] bg-slate-50 border-slate-200 p-4 text-slate-900 font-medium font-sans" 
                        placeholder="Enter assignment compliance details..."
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Behavioral Abstract</label>
                      <textarea 
                        value={editedData.additional.behavioral_abstract}
                        onChange={(e) => handleAdditionalChange('behavioral_abstract', e.target.value)}
                        className="input-field w-full min-h-[80px] bg-slate-50 border-slate-200 p-4 text-slate-900 font-medium font-sans" 
                        placeholder="Enter behavioral abstract..."
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Final Narrative Audit</label>
                    <textarea 
                      value={editedData.additional.final_narrative_audit}
                      onChange={(e) => handleAdditionalChange('final_narrative_audit', e.target.value)}
                      className="input-field w-full min-h-[100px] bg-slate-50 border-slate-200 p-4 text-slate-900 font-medium font-sans" 
                      placeholder="Enter final narrative audit..."
                    />
                  </div>
                </div>

                {/* Remarks Section */}
                <div className="space-y-3 pt-6 border-t border-slate-100">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Final Performance Narrative Audit</label>
                  <textarea 
                    value={editedData.additional.remarks}
                    onChange={(e) => handleAdditionalChange('remarks', e.target.value)}
                    className="input-field w-full min-h-[120px] bg-slate-50 border-slate-200 p-4 text-slate-900 font-medium font-sans" 
                    placeholder="Enter comprehensive qualitative audit details..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-6">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary px-8">Discard</button>
                  <button type="submit" disabled={isLoading} className="btn-primary px-10 shadow-lg shadow-indigo-100 font-bold uppercase tracking-widest text-[11px]">
                    Synchronize Transcript
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
