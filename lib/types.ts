export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'STAFF';

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  logoUrl?: string;
  plan: 'BASIC' | 'PRO' | 'ENTERPRISE';
  status: 'ACTIVE' | 'SUSPENDED';
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId?: string; // Null for Super Admin
  avatarUrl?: string;
}

export interface Student {
  id: string;
  tenantId: string;
  fullName: string;
  photoUrl?: string;
  dob: string;
  contactNumber: string;
  guardianName: string;
  guardianContact: string;
  email: string;
  address: string;
  enrollmentDate: string;
  course: string;
  status: 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'SUSPENDED';
  assignedStaffId?: string;
}

export interface Attendance {
  id: string;
  studentId: string;
  tenantId: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE';
  markedBy: string;
  sessionId: string;
}

export interface FeePlan {
  id: string;
  tenantId: string;
  name: string;
  amount: number;
  frequency: 'ONE_TIME' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  gracePeriodDays: number;
}

export interface Payment {
  id: string;
  studentId: string;
  tenantId: string;
  amount: number;
  date: string;
  method: 'CASH' | 'BANK_TRANSFER' | 'ONLINE';
  loggedBy: string;
  proofUrl?: string;
  status: 'PAID' | 'PENDING' | 'OVERDUE' | 'WAIVED';
}
