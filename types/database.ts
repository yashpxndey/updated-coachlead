export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      courses: {
        Row: {
          id: string
          tenant_id: string
          course_name: string
          batch_time: string
          duration: string
          fees: number
          description: string | null
          status: 'active' | 'inactive'
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          course_name: string
          batch_time: string
          duration: string
          fees: number
          description?: string | null
          status?: 'active' | 'inactive'
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          course_name?: string
          batch_time?: string
          duration?: string
          fees?: number
          description?: string | null
          status?: 'active' | 'inactive'
          created_at?: string
        }
      }
      students: {
        Row: {
          id: string
          full_name: string
          enrollment_number: string
          course_name: string
          batch_time: string
          email: string | null
          phone: string | null
          father_name: string | null
          father_contact: string | null
          mother_name: string | null
          mother_contact: string | null
          permanent_address: string | null
          temporary_address: string | null
          date_of_birth: string | null
          gender: string | null
          blood_group: string | null
          emergency_contact: string | null
          previous_qualification: string | null
          joining_date: string | null
          status: 'active' | 'inactive'
          photo_url: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          full_name: string
          enrollment_number: string
          course_name: string
          batch_time: string
          email?: string | null
          phone?: string | null
          father_name?: string | null
          father_contact?: string | null
          mother_name?: string | null
          mother_contact?: string | null
          permanent_address?: string | null
          temporary_address?: string | null
          date_of_birth?: string | null
          gender?: string | null
          blood_group?: string | null
          emergency_contact?: string | null
          previous_qualification?: string | null
          joining_date?: string | null
          status?: 'active' | 'inactive'
          photo_url?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          enrollment_number?: string
          course_name?: string
          batch_time?: string
          email?: string | null
          phone?: string | null
          father_name?: string | null
          father_contact?: string | null
          mother_name?: string | null
          mother_contact?: string | null
          permanent_address?: string | null
          temporary_address?: string | null
          date_of_birth?: string | null
          gender?: string | null
          blood_group?: string | null
          emergency_contact?: string | null
          previous_qualification?: string | null
          joining_date?: string | null
          status?: 'active' | 'inactive'
          photo_url?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      fees: {
        Row: {
          id: string
          student_id: string
          total_fee: number
          amount_paid: number
          amount_pending: number
          installments_total: number
          installments_paid: number
          installments_pending: number
          next_due_date: string | null
          last_payment_date: string | null
          payment_mode: string | null
          fee_status: 'paid' | 'pending' | 'overdue'
          enrollment_fee: number
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          total_fee: number
          amount_paid?: number
          amount_pending?: number
          installments_total?: number
          installments_paid?: number
          installments_pending?: number
          next_due_date?: string | null
          last_payment_date?: string | null
          payment_mode?: string | null
          fee_status?: 'paid' | 'pending' | 'overdue'
          enrollment_fee?: number
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          total_fee?: number
          amount_paid?: number
          amount_pending?: number
          installments_total?: number
          installments_paid?: number
          installments_pending?: number
          next_due_date?: string | null
          last_payment_date?: string | null
          payment_mode?: string | null
          fee_status?: 'paid' | 'pending' | 'overdue'
          enrollment_fee?: number
          created_at?: string
        }
      }
      attendance: {
        Row: {
          id: string
          student_id: string
          class_name: string
          date: string
          status: 'present' | 'absent' | 'late'
          marked_by: string | null
          is_locked: boolean
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          class_name: string
          date: string
          status: 'present' | 'absent' | 'late'
          marked_by?: string | null
          is_locked?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          class_name?: string
          date?: string
          status?: 'present' | 'absent' | 'late'
          marked_by?: string | null
          is_locked?: boolean
          created_at?: string
        }
      }
      test_scores: {
        Row: {
          id: string
          student_id: string
          subject_name: string
          max_marks: number
          obtained_marks: number
          month: number
          year: number
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          subject_name: string
          max_marks: number
          obtained_marks: number
          month: number
          year: number
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          subject_name?: string
          max_marks?: number
          obtained_marks?: number
          month?: number
          year?: number
          created_at?: string
        }
      }
      reports: {
        Row: {
          id: string
          student_id: string
          student_name: string
          month: number
          year: number
          teacher_remarks: string | null
          behavior_rating: string | null
          assignment_rate: number | null
          extracurricular: string | null
          performance_rating: string | null
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          student_name: string
          month: number
          year: number
          teacher_remarks?: string | null
          behavior_rating?: string | null
          assignment_rate?: number | null
          extracurricular?: string | null
          performance_rating?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          student_name?: string
          month?: number
          year?: number
          teacher_remarks?: string | null
          behavior_rating?: string | null
          assignment_rate?: number | null
          extracurricular?: string | null
          performance_rating?: string | null
          created_at?: string
        }
      }
      tenants: {
        Row: {
          id: string
          company_name: string
          subdomain: string
          number_of_students: number
          plan: 'basic' | 'pro' | 'enterprise'
          revenue: number
          status: 'active' | 'suspended'
          amount_paid: number
          amount_pending: number
          installments_total: number
          installments_paid: number
          installments_pending: number
          payment_mode: string | null
          payment_date: string | null
          days_past_due: number
          created_at: string
        }
        Insert: {
          id?: string
          company_name: string
          subdomain: string
          number_of_students?: number
          plan?: 'basic' | 'pro' | 'enterprise'
          revenue?: number
          status?: 'active' | 'suspended'
          amount_paid?: number
          amount_pending?: number
          installments_total?: number
          installments_paid?: number
          installments_pending?: number
          payment_mode?: string | null
          payment_date?: string | null
          days_past_due?: number
          created_at?: string
        }
        Update: {
          id?: string
          company_name?: string
          subdomain?: string
          number_of_students?: number
          plan?: 'basic' | 'pro' | 'enterprise'
          revenue?: number
          status?: 'active' | 'suspended'
          amount_paid?: number
          amount_pending?: number
          installments_total?: number
          installments_paid?: number
          installments_pending?: number
          payment_mode?: string | null
          payment_date?: string | null
          days_past_due?: number
          created_at?: string
        }
      }
      tenant_payments: {
        Row: {
          id: string
          tenant_id: string
          amount: number
          payment_date: string
          payment_mode: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          amount: number
          payment_date: string
          payment_mode: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          amount?: number
          payment_date?: string
          payment_mode?: string
          notes?: string | null
          created_at?: string
        }
      }
      announcements: {
        Row: {
          id: string
          title: string
          message: string
          created_by: string
          role: string
          created_at: string
          is_read: boolean
        }
        Insert: {
          id?: string
          title: string
          message: string
          created_by: string
          role: string
          created_at?: string
          is_read?: boolean
        }
        Update: {
          id?: string
          title?: string
          message?: string
          created_by?: string
          role?: string
          created_at?: string
          is_read?: boolean
        }
      }
      activity_log: {
        Row: {
          id: string
          text: string
          type: string
          created_at: string
        }
        Insert: {
          id?: string
          text: string
          type: string
          created_at?: string
        }
        Update: {
          id?: string
          text?: string
          type?: string
          created_at?: string
        }
      }
      chats: {
        Row: {
          id: string
          name: string
          last_msg: string | null
          last_msg_time: string | null
          unread_count: number
          is_online: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          last_msg?: string | null
          last_msg_time?: string | null
          unread_count?: number
          is_online?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          last_msg?: string | null
          last_msg_time?: string | null
          unread_count?: number
          is_online?: boolean
          created_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          chat_id: string
          sender_name: string
          text: string
          is_me: boolean
          created_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          sender_name: string
          text: string
          is_me: boolean
          created_at?: string
        }
        Update: {
          id?: string
          chat_id?: string
          sender_name?: string
          text?: string
          is_me?: boolean
          created_at?: string
        }
      }
    }
  }
}
