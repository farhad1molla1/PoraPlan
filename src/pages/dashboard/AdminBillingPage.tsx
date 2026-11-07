import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getAdminStudentPaymentRecords,
  getAdminMentorPaymentRecords,
  createStudentPaymentRecord,
  updateStudentPaymentRecord,
  softDeleteStudentPaymentRecord,
  createMentorPaymentRecord,
  updateMentorPaymentRecord,
  softDeleteMentorPaymentRecord,
  getPaymentEvents,
  createPaymentEvent,
  getPaymentAdminNotes,
  createPaymentAdminNote,
  overrideBillingStartDate,
  getBillingDateAuditLogs,
} from '../../lib/payments';
import {
  formatCalendarDate,
  computeBillingPeriod,
  toBangladeshDateStr,
} from '../../lib/billingCycles';
import { formatLocalDate } from '../../lib/library';
import {
  getMockEnrollments,
  getMockUsers,
  getMockPrograms,
} from '../../lib/mockAuthStore';
import type {
  StudentPaymentRecord,
  MentorPaymentRecord,
  PaymentEvent,
  PaymentAdminNote,
  BillingDateAuditLog,
  StudentPaymentStatus,
  MentorPaymentStatus,
  PaymentMethod,
  ProgramEnrollmentWithMeta,
  Profile,
  Program,
} from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  Plus,
  Edit2,
  Trash2,
  History,
  Search,
  X,
  ChevronRight,
  ChevronLeft,
  Eye,
  Lock,
} from 'lucide-react';

// ==============================================================================
// HELPERS
// ==============================================================================

function formatBillingMonth(monthStr: string): string {
  if (!monthStr) return 'Not recorded';
  const parts = monthStr.split('-');
  if (parts.length >= 2) {
    const year = parts[0];
    const monthNum = parseInt(parts[1], 10);
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    if (monthNum >= 1 && monthNum <= 12) {
      return `${monthNames[monthNum - 1]} ${year}`;
    }
  }
  return monthStr;
}

function formatPaymentMethod(method?: string | null): string {
  if (!method) return 'Not recorded';
  switch (method.toLowerCase()) {
    case 'bkash':
      return 'bKash';
    case 'nagad':
      return 'Nagad';
    case 'upay':
      return 'Upay';
    case 'cash':
      return 'Cash';
    case 'bank':
      return 'Bank Transfer';
    default:
      return method.charAt(0).toUpperCase() + method.slice(1);
  }
}

function getStudentStatusBadge(status: StudentPaymentStatus) {
  switch (status) {
    case 'paid':
      return (
        <Badge variant="teal" size="sm" className="gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Paid
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="gold" size="sm" className="gap-1">
          <Clock className="w-3 h-3" />
          Pending
        </Badge>
      );
    case 'partial':
      return (
        <Badge variant="paper" size="sm" className="gap-1">
          <Layers className="w-3 h-3" />
          Partial
        </Badge>
      );
    case 'overdue':
      return (
        <Badge variant="danger" size="sm" className="gap-1">
          <AlertTriangle className="w-3 h-3" />
          Overdue
        </Badge>
      );
    case 'waived':
      return (
        <Badge variant="muted" size="sm">
          Waived
        </Badge>
      );
    default:
      return <Badge variant="paper" size="sm">{status}</Badge>;
  }
}

function getMentorStatusBadge(status: MentorPaymentStatus) {
  switch (status) {
    case 'paid':
      return (
        <Badge variant="teal" size="sm" className="gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Paid
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="gold" size="sm" className="gap-1">
          <Clock className="w-3 h-3" />
          Pending
        </Badge>
      );
    case 'partial':
      return (
        <Badge variant="paper" size="sm" className="gap-1">
          <Layers className="w-3 h-3" />
          Partial
        </Badge>
      );
    default:
      return <Badge variant="paper" size="sm">{status}</Badge>;
  }
}

// ==============================================================================
// MAIN COMPONENT
// ==============================================================================

export const AdminBillingPage: React.FC = () => {
  // Workspace Navigation Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'student_payments' | 'mentor_payouts' | 'calendar' | 'audit_notes'>('overview');

  // Core Data
  const [studentRecords, setStudentRecords] = useState<StudentPaymentRecord[]>([]);
  const [mentorRecords, setMentorRecords] = useState<MentorPaymentRecord[]>([]);
  const [enrollments, setEnrollments] = useState<ProgramEnrollmentWithMeta[]>([]);
  const [auditLogs, setAuditLogs] = useState<BillingDateAuditLog[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);

  // Page State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Search & Filters
  const [studentSearch, setStudentSearch] = useState('');
  const [studentStatusFilter, setStudentStatusFilter] = useState<'all' | StudentPaymentStatus>('all');
  const [studentMethodFilter, setStudentMethodFilter] = useState<'all' | PaymentMethod>('all');

  const [mentorSearch, setMentorSearch] = useState('');
  const [mentorStatusFilter, setMentorStatusFilter] = useState<'all' | MentorPaymentStatus>('all');
  const [mentorMethodFilter, setMentorMethodFilter] = useState<'all' | PaymentMethod>('all');

  // Pagination
  const [studentPage, setStudentPage] = useState(1);
  const [mentorPage, setMentorPage] = useState(1);
  const pageSize = 10;

  // Selected Record Drawers
  const [selectedStudentRecord, setSelectedStudentRecord] = useState<StudentPaymentRecord | null>(null);
  const [selectedMentorRecord, setSelectedMentorRecord] = useState<MentorPaymentRecord | null>(null);

  // Modals
  const [isCreateStudentModalOpen, setIsCreateStudentModalOpen] = useState(false);
  const [editingStudentRecord, setEditingStudentRecord] = useState<StudentPaymentRecord | null>(null);
  const [isCreateMentorModalOpen, setIsCreateMentorModalOpen] = useState(false);
  const [editingMentorRecord, setEditingMentorRecord] = useState<MentorPaymentRecord | null>(null);
  const [isAnchorModalOpen, setIsAnchorModalOpen] = useState(false);
  const [activeAnchorEnrollment, setActiveAnchorEnrollment] = useState<ProgramEnrollmentWithMeta | null>(null);

  // Shared Modals for Events & Notes
  const [activeEventRecord, setActiveEventRecord] = useState<{ type: 'student' | 'mentor'; id: string; title: string } | null>(null);
  const [activeNoteTarget, setActiveNoteTarget] = useState<{ recordType: 'student_payment' | 'mentor_payment' | 'enrollment'; id: string; title: string } | null>(null);

  // Calendar State
  const todayBD = toBangladeshDateStr();
  const [calendarYear, setCalendarYear] = useState(() => parseInt(todayBD.split('-')[0], 10));
  const [calendarMonth, setCalendarMonth] = useState(() => parseInt(todayBD.split('-')[1], 10));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(todayBD);

  // Lookup Maps
  const studentsMap = useMemo(() => {
    const map = new Map<string, Profile>();
    profiles.filter((p) => p.role === 'student').forEach((p) => map.set(p.id, p));
    return map;
  }, [profiles]);

  const mentorsMap = useMemo(() => {
    const map = new Map<string, Profile>();
    profiles.filter((p) => p.role === 'mentor').forEach((p) => map.set(p.id, p));
    return map;
  }, [profiles]);

  const programsMap = useMemo(() => {
    const map = new Map<string, Program>();
    programs.forEach((pr) => map.set(pr.id, pr));
    return map;
  }, [programs]);

  const enrollmentsMap = useMemo(() => {
    const map = new Map<string, ProgramEnrollmentWithMeta>();
    enrollments.forEach((e) => map.set(e.id, e));
    return map;
  }, [enrollments]);

  // Load Data
  const loadDeskData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sRes, mRes, aRes] = await Promise.all([
        getAdminStudentPaymentRecords(),
        getAdminMentorPaymentRecords(),
        getBillingDateAuditLogs(),
      ]);

      if (sRes.error) throw sRes.error;
      if (mRes.error) throw mRes.error;
      if (aRes.error) throw aRes.error;

      setStudentRecords(sRes.records);
      setMentorRecords(mRes.records);
      setAuditLogs(aRes.logs);

      setProfiles(getMockUsers());
      setPrograms(getMockPrograms());
      setEnrollments(getMockEnrollments());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load billing records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeskData();
  }, [loadDeskData]);

  // Duplicate Reference Detection (computed across student and mentor records)
  const duplicateReferenceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of studentRecords) {
      if (r.transaction_reference && r.transaction_reference.trim() && r.payment_method !== 'cash') {
        const ref = r.transaction_reference.trim().toUpperCase();
        counts.set(ref, (counts.get(ref) || 0) + 1);
      }
    }
    for (const r of mentorRecords) {
      if (r.transaction_reference && r.transaction_reference.trim() && r.payment_method !== 'cash') {
        const ref = r.transaction_reference.trim().toUpperCase();
        counts.set(ref, (counts.get(ref) || 0) + 1);
      }
    }
    return counts;
  }, [studentRecords, mentorRecords]);

  const duplicateReferencesList = useMemo(() => {
    const list: { ref: string; count: number }[] = [];
    duplicateReferenceCounts.forEach((count, ref) => {
      if (count > 1) list.push({ ref, count });
    });
    return list;
  }, [duplicateReferenceCounts]);

  // Essential Counts
  const counts = useMemo(() => {
    const pendingStudents = studentRecords.filter((r) => r.status === 'pending').length;
    const overdueStudents = studentRecords.filter((r) => r.status === 'overdue').length;
    const pendingMentors = mentorRecords.filter((r) => r.status === 'pending').length;

    // Upcoming renewals within 14 days
    const upcomingRenewals = enrollments.filter((e) => {
      if (e.status !== 'active') return false;
      const anchor = e.billing_start_date || (e.enrolled_at ? e.enrolled_at.substring(0, 10) : todayBD);
      const period = computeBillingPeriod(anchor, 0);
      return period.nextDueDate >= todayBD;
    }).length;

    return {
      pendingStudents,
      overdueStudents,
      upcomingRenewals,
      pendingMentors,
    };
  }, [studentRecords, mentorRecords, enrollments, todayBD]);

  // Recent Activity Streams
  const recentStudentPayments = useMemo(() => {
    return [...studentRecords]
      .sort((a, b) => b.cycle_start_date.localeCompare(a.cycle_start_date))
      .slice(0, 5);
  }, [studentRecords]);

  const recentMentorPayouts = useMemo(() => {
    return [...mentorRecords]
      .sort((a, b) => b.billing_month.localeCompare(a.billing_month))
      .slice(0, 5);
  }, [mentorRecords]);

  // Filtered Student Records
  const filteredStudentRecords = useMemo(() => {
    return studentRecords.filter((r) => {
      if (studentStatusFilter !== 'all' && r.status !== studentStatusFilter) return false;
      if (studentMethodFilter !== 'all' && r.payment_method !== studentMethodFilter) return false;
      if (studentSearch.trim()) {
        const q = studentSearch.trim().toLowerCase();
        const student = studentsMap.get(r.student_id);
        const nameMatch = (student?.full_name || '').toLowerCase().includes(q);
        const idMatch = (student?.poraplan_id || '').toLowerCase().includes(q);
        const refMatch = (r.transaction_reference || '').toLowerCase().includes(q);
        const cycleMatch = r.cycle_start_date.includes(q) || r.cycle_end_date.includes(q);
        if (!nameMatch && !idMatch && !refMatch && !cycleMatch) return false;
      }
      return true;
    });
  }, [studentRecords, studentStatusFilter, studentMethodFilter, studentSearch, studentsMap]);

  // Filtered Mentor Records
  const filteredMentorRecords = useMemo(() => {
    return mentorRecords.filter((r) => {
      if (mentorStatusFilter !== 'all' && r.status !== mentorStatusFilter) return false;
      if (mentorMethodFilter !== 'all' && r.payment_method !== mentorMethodFilter) return false;
      if (mentorSearch.trim()) {
        const q = mentorSearch.trim().toLowerCase();
        const mentor = mentorsMap.get(r.mentor_id);
        const nameMatch = (mentor?.full_name || '').toLowerCase().includes(q);
        const emailMatch = (mentor?.email || '').toLowerCase().includes(q);
        const monthMatch = r.billing_month.includes(q) || formatBillingMonth(r.billing_month).toLowerCase().includes(q);
        const refMatch = (r.transaction_reference || '').toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !monthMatch && !refMatch) return false;
      }
      return true;
    });
  }, [mentorRecords, mentorStatusFilter, mentorMethodFilter, mentorSearch, mentorsMap]);

  // Pagination slices
  const totalStudentPages = Math.max(1, Math.ceil(filteredStudentRecords.length / pageSize));
  const paginatedStudentRecords = useMemo(() => {
    const start = (studentPage - 1) * pageSize;
    return filteredStudentRecords.slice(start, start + pageSize);
  }, [filteredStudentRecords, studentPage, pageSize]);

  const totalMentorPages = Math.max(1, Math.ceil(filteredMentorRecords.length / pageSize));
  const paginatedMentorRecords = useMemo(() => {
    const start = (mentorPage - 1) * pageSize;
    return filteredMentorRecords.slice(start, start + pageSize);
  }, [filteredMentorRecords, mentorPage, pageSize]);

  // Calendar Day Map
  const calendarDaysMap = useMemo(() => {
    const map = new Map<string, { studentDueCount: number; mentorPayoutCount: number }>();
    studentRecords.forEach((r) => {
      if (r.next_due_date) {
        const entry = map.get(r.next_due_date) || { studentDueCount: 0, mentorPayoutCount: 0 };
        entry.studentDueCount++;
        map.set(r.next_due_date, entry);
      }
    });
    mentorRecords.forEach((r) => {
      if (r.payout_date) {
        const dateKey = r.payout_date.split('T')[0];
        const entry = map.get(dateKey) || { studentDueCount: 0, mentorPayoutCount: 0 };
        entry.mentorPayoutCount++;
        map.set(dateKey, entry);
      }
    });
    return map;
  }, [studentRecords, mentorRecords]);

  // Calendar matrix calculation
  const calendarMatrix = useMemo(() => {
    const firstDayOfMonth = new Date(calendarYear, calendarMonth - 1, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate();
    return { firstDayOfMonth, daysInMonth };
  }, [calendarYear, calendarMonth]);

  const calendarMonthLabel = useMemo(() => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[calendarMonth - 1]} ${calendarYear}`;
  }, [calendarMonth, calendarYear]);

  // Handlers for Delete
  const handleDeleteStudent = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this student payment record?')) return;
    try {
      const res = await softDeleteStudentPaymentRecord(id);
      if (res.error) throw res.error;
      setActionSuccess('Student payment record deleted.');
      setSelectedStudentRecord(null);
      loadDeskData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete record.');
    }
  };

  const handleDeleteMentor = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this mentor payout record?')) return;
    try {
      const res = await softDeleteMentorPaymentRecord(id);
      if (res.error) throw res.error;
      setActionSuccess('Mentor payout record deleted.');
      setSelectedMentorRecord(null);
      loadDeskData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete payout record.');
    }
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-brand-dark">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-extrabold text-brand-navy">
            Payment Management
          </h1>
          <p className="text-xs font-sans text-brand-muted mt-0.5">
            Manage student payments, mentor payouts, and billing cycles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDeskData}
            disabled={loading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateStudentModalOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Record Payment
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCreateMentorModalOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Record Payout
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-2.5 bg-teal-50 border border-teal-300 text-teal-900 flex items-center justify-between text-xs">
          <span>{actionSuccess}</span>
          <button type="button" onClick={() => setActionSuccess(null)} className="text-teal-700 hover:text-teal-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-2.5 bg-red-50 border border-red-300 text-red-900 flex items-center justify-between text-xs">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-700 hover:text-red-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-brand-dark/20 overflow-x-auto text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 font-heading font-bold uppercase transition-colors ${
            activeTab === 'overview'
              ? 'bg-brand-navy text-brand-paper'
              : 'text-brand-dark hover:bg-brand-paper-tint'
          }`}
        >
          Overview
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('student_payments')}
          className={`px-3 py-1.5 font-heading font-bold uppercase transition-colors flex items-center gap-1 ${
            activeTab === 'student_payments'
              ? 'bg-brand-navy text-brand-paper'
              : 'text-brand-dark hover:bg-brand-paper-tint'
          }`}
        >
          <span>Student Payments</span>
          <span className="font-mono text-[11px] opacity-80">({studentRecords.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('mentor_payouts')}
          className={`px-3 py-1.5 font-heading font-bold uppercase transition-colors flex items-center gap-1 ${
            activeTab === 'mentor_payouts'
              ? 'bg-brand-navy text-brand-paper'
              : 'text-brand-dark hover:bg-brand-paper-tint'
          }`}
        >
          <span>Mentor Payouts</span>
          <span className="font-mono text-[11px] opacity-80">({mentorRecords.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('calendar')}
          className={`px-3 py-1.5 font-heading font-bold uppercase transition-colors ${
            activeTab === 'calendar'
              ? 'bg-brand-navy text-brand-paper'
              : 'text-brand-dark hover:bg-brand-paper-tint'
          }`}
        >
          Calendar
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit_notes')}
          className={`px-3 py-1.5 font-heading font-bold uppercase transition-colors flex items-center gap-1 ${
            activeTab === 'audit_notes'
              ? 'bg-brand-navy text-brand-paper'
              : 'text-brand-dark hover:bg-brand-paper-tint'
          }`}
        >
          <span>Audit Log</span>
          <span className="font-mono text-[11px] opacity-80">({auditLogs.length})</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: OVERVIEW                                                       */}
      {/* ===================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Compact Essential Counts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-brand-paper border border-brand-dark/20">
              <span className="text-[10px] font-mono uppercase text-brand-muted block">Pending Payments</span>
              <span className="text-xl font-heading font-extrabold text-amber-600 block mt-1">
                {counts.pendingStudents}
              </span>
            </div>

            <div className="p-3 bg-brand-paper border border-brand-dark/20">
              <span className="text-[10px] font-mono uppercase text-brand-muted block">Overdue Payments</span>
              <span className="text-xl font-heading font-extrabold text-rose-600 block mt-1">
                {counts.overdueStudents}
              </span>
            </div>

            <div className="p-3 bg-brand-paper border border-brand-dark/20">
              <span className="text-[10px] font-mono uppercase text-brand-muted block">Upcoming Renewals</span>
              <span className="text-xl font-heading font-extrabold text-brand-navy block mt-1">
                {counts.upcomingRenewals}
              </span>
            </div>

            <div className="p-3 bg-brand-paper border border-brand-dark/20">
              <span className="text-[10px] font-mono uppercase text-brand-muted block">Pending Payouts</span>
              <span className="text-xl font-heading font-extrabold text-amber-600 block mt-1">
                {counts.pendingMentors}
              </span>
            </div>
          </div>

          {/* Duplicate Reference Warning */}
          {duplicateReferencesList.length > 0 && (
            <div className="p-2.5 bg-amber-50 border border-amber-300 text-xs text-amber-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Notice: {duplicateReferencesList.length} duplicate transaction reference(s) found across records.</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStudentSearch(duplicateReferencesList[0].ref);
                  setActiveTab('student_payments');
                }}
                className="underline font-bold text-amber-900"
              >
                View in Student Payments
              </button>
            </div>
          )}

          {/* Side-by-side Recent Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Recent Student Payments */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-heading font-bold text-brand-navy">
                <span>Recent Student Payments</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('student_payments')}
                  className="text-brand-muted hover:text-brand-dark text-[11px]"
                >
                  View All →
                </button>
              </div>

              {recentStudentPayments.length === 0 ? (
                <div className="p-4 bg-brand-paper border border-brand-dark/20 text-center text-xs text-brand-muted">
                  No student payments recorded yet.
                </div>
              ) : (
                <div className="border border-brand-dark/20 bg-brand-paper divide-y divide-brand-dark/10 text-xs">
                  {recentStudentPayments.map((r) => {
                    const student = studentsMap.get(r.student_id);
                    return (
                      <div
                        key={r.id}
                        onClick={() => setSelectedStudentRecord(r)}
                        className="p-2.5 flex items-center justify-between gap-2 hover:bg-brand-paper-tint/60 cursor-pointer"
                      >
                        <div className="truncate">
                          <div className="font-bold text-brand-navy truncate">
                            {student?.full_name || 'Scholar'}
                          </div>
                          <div className="text-[11px] font-mono text-brand-muted">
                            {formatCalendarDate(r.cycle_start_date)} – {formatCalendarDate(r.cycle_end_date)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {getStudentStatusBadge(r.status)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Mentor Payouts */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-heading font-bold text-brand-navy">
                <span>Recent Mentor Payouts</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('mentor_payouts')}
                  className="text-brand-muted hover:text-brand-dark text-[11px]"
                >
                  View All →
                </button>
              </div>

              {recentMentorPayouts.length === 0 ? (
                <div className="p-4 bg-brand-paper border border-brand-dark/20 text-center text-xs text-brand-muted">
                  No mentor payouts recorded yet.
                </div>
              ) : (
                <div className="border border-brand-dark/20 bg-brand-paper divide-y divide-brand-dark/10 text-xs">
                  {recentMentorPayouts.map((r) => {
                    const mentor = mentorsMap.get(r.mentor_id);
                    return (
                      <div
                        key={r.id}
                        onClick={() => setSelectedMentorRecord(r)}
                        className="p-2.5 flex items-center justify-between gap-2 hover:bg-brand-paper-tint/60 cursor-pointer"
                      >
                        <div className="truncate">
                          <div className="font-bold text-brand-navy truncate">
                            {mentor?.full_name || 'Mentor'}
                          </div>
                          <div className="text-[11px] font-mono text-brand-muted">
                            {formatBillingMonth(r.billing_month)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {getMentorStatusBadge(r.status)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: STUDENT PAYMENTS                                               */}
      {/* ===================================================================== */}
      {activeTab === 'student_payments' && (
        <div className="space-y-3">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-brand-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search student or ref..."
                  value={studentSearch}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    setStudentPage(1);
                  }}
                  className="pl-8 pr-2 py-1 text-xs border border-brand-dark/30 bg-brand-paper focus:outline-none w-44 sm:w-56"
                />
                {studentSearch && (
                  <button
                    type="button"
                    onClick={() => setStudentSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-dark"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <select
                value={studentStatusFilter}
                onChange={(e) => {
                  setStudentStatusFilter(e.target.value as 'all' | StudentPaymentStatus);
                  setStudentPage(1);
                }}
                className="py-1 px-2 border border-brand-dark/30 bg-brand-paper"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="overdue">Overdue</option>
                <option value="waived">Waived</option>
              </select>

              <select
                value={studentMethodFilter}
                onChange={(e) => {
                  setStudentMethodFilter(e.target.value as 'all' | PaymentMethod);
                  setStudentPage(1);
                }}
                className="py-1 px-2 border border-brand-dark/30 bg-brand-paper"
              >
                <option value="all">All Methods</option>
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="upay">Upay</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateStudentModalOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Record Payment
            </Button>
          </div>

          {/* Table & Responsive Cards */}
          {filteredStudentRecords.length === 0 ? (
            <div className="p-6 bg-brand-paper border border-brand-dark/20 text-center text-xs text-brand-muted">
              No student payment records found.
            </div>
          ) : (
            <>
              {/* Mobile & Tablet Responsive Cards (< lg: 1024px) */}
              <div className="lg:hidden space-y-3">
                {paginatedStudentRecords.map((rec) => {
                  const student = studentsMap.get(rec.student_id);
                  const enrollment = enrollmentsMap.get(rec.enrollment_id);
                  const program = enrollment ? programsMap.get(enrollment.program_id) : null;
                  const isDuplicate = rec.transaction_reference && (duplicateReferenceCounts.get(rec.transaction_reference.trim().toUpperCase()) || 0) > 1;

                  return (
                    <div
                      key={rec.id}
                      onClick={() => setSelectedStudentRecord(rec)}
                      className="p-4 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs hover:shadow-brutal transition-all cursor-pointer space-y-3"
                    >
                      {/* Header: Student Name + PoraPlan ID + Status Badge */}
                      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-brand-dark/15">
                        <div className="min-w-0">
                          <span className="font-heading font-extrabold text-sm text-brand-navy leading-snug truncate block">
                            {student?.full_name || 'Scholar'}
                          </span>
                          {student?.poraplan_id && (
                            <span className="font-mono text-[11px] text-brand-teal font-bold block mt-0.5">
                              {student.poraplan_id}
                            </span>
                          )}
                        </div>
                        <div className="shrink-0">
                          {getStudentStatusBadge(rec.status)}
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-brand-bg p-2.5 border border-brand-dark/20">
                        <div>
                          <span className="text-[10px] font-mono uppercase text-brand-muted block font-bold">
                            Program
                          </span>
                          <span className="font-heading font-bold text-brand-dark text-[11px] block mt-0.5 truncate">
                            {program?.name || '—'}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-mono uppercase text-brand-muted block font-bold">
                            Billing Period
                          </span>
                          <span className="font-mono text-[11px] text-brand-navy font-bold block mt-0.5">
                            {formatCalendarDate(rec.cycle_start_date)} – {formatCalendarDate(rec.cycle_end_date)}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-mono uppercase text-brand-muted block font-bold">
                            Method & Ref
                          </span>
                          <div className="font-sans font-bold text-brand-dark text-[11px] mt-0.5 flex flex-wrap items-center gap-1.5">
                            <span>{formatPaymentMethod(rec.payment_method)}</span>
                            {rec.transaction_reference && (
                              <span className="font-mono text-[10px] text-brand-muted flex items-center gap-0.5">
                                <span>({rec.transaction_reference})</span>
                                {isDuplicate && (
                                  <span title="Duplicate reference warning">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 inline-block" />
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] font-mono uppercase text-brand-muted block font-bold">
                            Payment Date
                          </span>
                          <span className="font-mono text-[11px] text-brand-muted block mt-0.5">
                            {rec.payment_date ? formatCalendarDate(rec.payment_date) : 'Pending'}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full min-h-[44px] flex items-center justify-center gap-1.5 text-xs font-bold"
                          onClick={() => setSelectedStudentRecord(rec)}
                          leftIcon={<Eye className="w-3.5 h-3.5" />}
                        >
                          Details
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full min-h-[44px] flex items-center justify-center gap-1.5 text-xs font-bold"
                          onClick={() => {
                            setEditingStudentRecord(rec);
                          }}
                          leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table (>= lg: 1024px) */}
              <div className="hidden lg:block border border-brand-dark/30 bg-brand-paper overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-brand-bg border-b border-brand-dark/20 font-heading uppercase text-[11px] text-brand-muted">
                    <tr>
                      <th className="p-2.5">Student</th>
                      <th className="p-2.5">Program</th>
                      <th className="p-2.5">Billing Period</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Method</th>
                      <th className="p-2.5">Payment Date</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-dark/10">
                    {paginatedStudentRecords.map((rec) => {
                      const student = studentsMap.get(rec.student_id);
                      const enrollment = enrollmentsMap.get(rec.enrollment_id);
                      const program = enrollment ? programsMap.get(enrollment.program_id) : null;
                      const isDuplicate = rec.transaction_reference && (duplicateReferenceCounts.get(rec.transaction_reference.trim().toUpperCase()) || 0) > 1;

                      return (
                        <tr
                          key={rec.id}
                          onClick={() => setSelectedStudentRecord(rec)}
                          className="hover:bg-brand-paper-tint/60 transition-colors cursor-pointer"
                        >
                          <td className="p-2.5 font-bold text-brand-navy">
                            <div>{student?.full_name || 'Scholar'}</div>
                            {student?.poraplan_id && (
                              <div className="text-[10px] font-mono text-brand-muted">{student.poraplan_id}</div>
                            )}
                          </td>
                          <td className="p-2.5 text-brand-dark">
                            {program?.name || '—'}
                          </td>
                          <td className="p-2.5 font-mono text-[11px]">
                            {formatCalendarDate(rec.cycle_start_date)} – {formatCalendarDate(rec.cycle_end_date)}
                          </td>
                          <td className="p-2.5">
                            {getStudentStatusBadge(rec.status)}
                          </td>
                          <td className="p-2.5">
                            <div>{formatPaymentMethod(rec.payment_method)}</div>
                            {rec.transaction_reference && (
                              <div className="text-[10px] font-mono text-brand-muted flex items-center gap-1">
                                <span>{rec.transaction_reference}</span>
                                {isDuplicate && (
                                  <span title="Duplicate reference warning">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 inline-block" />
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-brand-muted">
                            {rec.payment_date ? formatCalendarDate(rec.payment_date) : 'Pending'}
                          </td>
                          <td className="p-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="px-2 py-0.5 text-[11px]"
                                onClick={() => setSelectedStudentRecord(rec)}
                                leftIcon={<Eye className="w-3 h-3" />}
                              >
                                Details
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="px-2 py-0.5 text-[11px]"
                                onClick={() => {
                                  setEditingStudentRecord(rec);
                                }}
                                leftIcon={<Edit2 className="w-3 h-3" />}
                              >
                                Edit
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Pagination */}
          {totalStudentPages > 1 && (
            <div className="flex items-center justify-between text-xs font-mono pt-1 text-brand-muted">
              <span>Page {studentPage} of {totalStudentPages}</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={studentPage <= 1}
                  onClick={() => setStudentPage((p) => Math.max(1, p - 1))}
                  className="px-2 py-0.5 text-[11px]"
                  leftIcon={<ChevronLeft className="w-3 h-3" />}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={studentPage >= totalStudentPages}
                  onClick={() => setStudentPage((p) => Math.min(totalStudentPages, p + 1))}
                  className="px-2 py-0.5 text-[11px]"
                  rightIcon={<ChevronRight className="w-3 h-3" />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: MENTOR PAYOUTS                                                 */}
      {/* ===================================================================== */}
      {activeTab === 'mentor_payouts' && (
        <div className="space-y-3">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-brand-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search mentor or ref..."
                  value={mentorSearch}
                  onChange={(e) => {
                    setMentorSearch(e.target.value);
                    setMentorPage(1);
                  }}
                  className="pl-8 pr-2 py-1 text-xs border border-brand-dark/30 bg-brand-paper focus:outline-none w-44 sm:w-56"
                />
                {mentorSearch && (
                  <button
                    type="button"
                    onClick={() => setMentorSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-dark"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <select
                value={mentorStatusFilter}
                onChange={(e) => {
                  setMentorStatusFilter(e.target.value as 'all' | MentorPaymentStatus);
                  setMentorPage(1);
                }}
                className="py-1 px-2 border border-brand-dark/30 bg-brand-paper"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
              </select>

              <select
                value={mentorMethodFilter}
                onChange={(e) => {
                  setMentorMethodFilter(e.target.value as 'all' | PaymentMethod);
                  setMentorPage(1);
                }}
                className="py-1 px-2 border border-brand-dark/30 bg-brand-paper"
              >
                <option value="all">All Methods</option>
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="upay">Upay</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateMentorModalOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Record Payout
            </Button>
          </div>

          {/* Table & Responsive Cards */}
          {filteredMentorRecords.length === 0 ? (
            <div className="p-6 bg-brand-paper border border-brand-dark/20 text-center text-xs text-brand-muted">
              No mentor payout records found.
            </div>
          ) : (
            <>
              {/* Mobile & Tablet Responsive Cards (< lg: 1024px) */}
              <div className="lg:hidden space-y-3">
                {paginatedMentorRecords.map((rec) => {
                  const mentor = mentorsMap.get(rec.mentor_id);
                  const relStudent = rec.related_student_id ? studentsMap.get(rec.related_student_id) : null;
                  const isDuplicate = rec.transaction_reference && (duplicateReferenceCounts.get(rec.transaction_reference.trim().toUpperCase()) || 0) > 1;

                  return (
                    <div
                      key={rec.id}
                      onClick={() => setSelectedMentorRecord(rec)}
                      className="p-4 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs hover:shadow-brutal transition-all cursor-pointer space-y-3"
                    >
                      {/* Header: Mentor Name + Email + Payout Status Badge */}
                      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-brand-dark/15">
                        <div className="min-w-0">
                          <span className="font-heading font-extrabold text-sm text-brand-navy leading-snug truncate block">
                            {mentor?.full_name || 'Mentor'}
                          </span>
                          {mentor?.email && (
                            <span className="font-mono text-[11px] text-brand-muted truncate block mt-0.5">
                              {mentor.email}
                            </span>
                          )}
                        </div>
                        <div className="shrink-0">
                          {getMentorStatusBadge(rec.status)}
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-brand-bg p-2.5 border border-brand-dark/20">
                        <div>
                          <span className="text-[10px] font-mono uppercase text-brand-muted block font-bold">
                            Related Context
                          </span>
                          <span className="font-heading font-bold text-brand-dark text-[11px] block mt-0.5 truncate">
                            {relStudent ? `Scholar: ${relStudent.full_name}` : 'Platform Pool'}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-mono uppercase text-brand-muted block font-bold">
                            Billing Month
                          </span>
                          <span className="font-mono text-[11px] text-brand-navy font-bold block mt-0.5">
                            {formatBillingMonth(rec.billing_month)}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-mono uppercase text-brand-muted block font-bold">
                            Method & Ref
                          </span>
                          <div className="font-sans font-bold text-brand-dark text-[11px] mt-0.5 flex flex-wrap items-center gap-1.5">
                            <span>{formatPaymentMethod(rec.payment_method)}</span>
                            {rec.transaction_reference && (
                              <span className="font-mono text-[10px] text-brand-muted flex items-center gap-0.5">
                                <span>({rec.transaction_reference})</span>
                                {isDuplicate && (
                                  <span title="Duplicate reference warning">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 inline-block" />
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] font-mono uppercase text-brand-muted block font-bold">
                            Payout Date
                          </span>
                          <span className="font-mono text-[11px] text-brand-muted block mt-0.5">
                            {rec.payout_date ? formatCalendarDate(rec.payout_date.split('T')[0]) : 'Pending'}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full min-h-[44px] flex items-center justify-center gap-1.5 text-xs font-bold"
                          onClick={() => setSelectedMentorRecord(rec)}
                          leftIcon={<Eye className="w-3.5 h-3.5" />}
                        >
                          Details
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full min-h-[44px] flex items-center justify-center gap-1.5 text-xs font-bold"
                          onClick={() => setEditingMentorRecord(rec)}
                          leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table (>= lg: 1024px) */}
              <div className="hidden lg:block border border-brand-dark/30 bg-brand-paper overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-brand-bg border-b border-brand-dark/20 font-heading uppercase text-[11px] text-brand-muted">
                    <tr>
                      <th className="p-2.5">Mentor</th>
                      <th className="p-2.5">Related Context</th>
                      <th className="p-2.5">Billing Month</th>
                      <th className="p-2.5">Payout Status</th>
                      <th className="p-2.5">Method</th>
                      <th className="p-2.5">Payout Date</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-dark/10">
                    {paginatedMentorRecords.map((rec) => {
                      const mentor = mentorsMap.get(rec.mentor_id);
                      const relStudent = rec.related_student_id ? studentsMap.get(rec.related_student_id) : null;
                      const isDuplicate = rec.transaction_reference && (duplicateReferenceCounts.get(rec.transaction_reference.trim().toUpperCase()) || 0) > 1;

                      return (
                        <tr
                          key={rec.id}
                          onClick={() => setSelectedMentorRecord(rec)}
                          className="hover:bg-brand-paper-tint/60 transition-colors cursor-pointer"
                        >
                          <td className="p-2.5 font-bold text-brand-navy">
                            <div>{mentor?.full_name || 'Mentor'}</div>
                            {mentor?.email && (
                              <div className="text-[10px] font-mono text-brand-muted">{mentor.email}</div>
                            )}
                          </td>
                          <td className="p-2.5 text-brand-dark">
                            {relStudent ? `Scholar: ${relStudent.full_name}` : 'Platform Pool'}
                          </td>
                          <td className="p-2.5 font-mono text-[11px]">
                            {formatBillingMonth(rec.billing_month)}
                          </td>
                          <td className="p-2.5">
                            {getMentorStatusBadge(rec.status)}
                          </td>
                          <td className="p-2.5">
                            <div>{formatPaymentMethod(rec.payment_method)}</div>
                            {rec.transaction_reference && (
                              <div className="text-[10px] font-mono text-brand-muted flex items-center gap-1">
                                <span>{rec.transaction_reference}</span>
                                {isDuplicate && (
                                  <span title="Duplicate reference warning">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 inline-block" />
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-brand-muted">
                            {rec.payout_date ? formatCalendarDate(rec.payout_date.split('T')[0]) : 'Pending'}
                          </td>
                          <td className="p-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="px-2 py-0.5 text-[11px]"
                                onClick={() => setSelectedMentorRecord(rec)}
                                leftIcon={<Eye className="w-3 h-3" />}
                              >
                                Details
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="px-2 py-0.5 text-[11px]"
                                onClick={() => {
                                  setEditingMentorRecord(rec);
                                }}
                                leftIcon={<Edit2 className="w-3 h-3" />}
                              >
                                Edit
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Pagination */}
          {totalMentorPages > 1 && (
            <div className="flex items-center justify-between text-xs font-mono pt-1 text-brand-muted">
              <span>Page {mentorPage} of {totalMentorPages}</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={mentorPage <= 1}
                  onClick={() => setMentorPage((p) => Math.max(1, p - 1))}
                  className="px-2 py-0.5 text-[11px]"
                  leftIcon={<ChevronLeft className="w-3 h-3" />}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={mentorPage >= totalMentorPages}
                  onClick={() => setMentorPage((p) => Math.min(totalMentorPages, p + 1))}
                  className="px-2 py-0.5 text-[11px]"
                  rightIcon={<ChevronRight className="w-3 h-3" />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: CALENDAR                                                       */}
      {/* ===================================================================== */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs">
            <div className="font-heading font-extrabold text-sm text-brand-navy">
              {calendarMonthLabel}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="px-2 py-0.5 text-[11px]"
                onClick={() => {
                  if (calendarMonth === 1) {
                    setCalendarMonth(12);
                    setCalendarYear((y) => y - 1);
                  } else {
                    setCalendarMonth((m) => m - 1);
                  }
                }}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="px-2 py-0.5 text-[11px]"
                onClick={() => {
                  const parts = todayBD.split('-');
                  setCalendarYear(parseInt(parts[0], 10));
                  setCalendarMonth(parseInt(parts[1], 10));
                  setSelectedCalendarDate(todayBD);
                }}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="px-2 py-0.5 text-[11px]"
                onClick={() => {
                  if (calendarMonth === 12) {
                    setCalendarMonth(1);
                    setCalendarYear((y) => y + 1);
                  } else {
                    setCalendarMonth((m) => m + 1);
                  }
                }}
              >
                Next
              </Button>
            </div>
          </div>

          <div className="border border-brand-dark/20 bg-brand-paper grid grid-cols-7 gap-px text-xs">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="p-2 text-center font-heading font-bold text-brand-muted bg-brand-bg text-[11px]">
                {d}
              </div>
            ))}

            {Array.from({ length: calendarMatrix.firstDayOfMonth }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-14 p-1 bg-brand-bg/30 border border-brand-dark/5" />
            ))}

            {Array.from({ length: calendarMatrix.daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayData = calendarDaysMap.get(dateStr);
              const isSelected = selectedCalendarDate === dateStr;

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedCalendarDate(dateStr)}
                  className={`h-14 p-1 border border-brand-dark/10 cursor-pointer transition-colors flex flex-col justify-between ${
                    isSelected ? 'bg-brand-paper-tint ring-1 ring-brand-navy' : 'hover:bg-brand-paper-tint/50'
                  }`}
                >
                  <span className="font-mono text-[10px] text-brand-dark font-bold">{dayNum}</span>
                  <div className="flex flex-col gap-0.5">
                    {dayData && dayData.studentDueCount > 0 && (
                      <span className="px-1 py-0.2 text-[9px] font-mono bg-rose-100 text-rose-800 truncate">
                        {dayData.studentDueCount} due
                      </span>
                    )}
                    {dayData && dayData.mentorPayoutCount > 0 && (
                      <span className="px-1 py-0.2 text-[9px] font-mono bg-teal-100 text-teal-800 truncate">
                        {dayData.mentorPayoutCount} payout
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Agenda for Selected Date */}
          <div className="p-3 bg-brand-paper border border-brand-dark/20 text-xs space-y-2">
            <div className="font-heading font-bold text-brand-navy">
              Schedule for {formatCalendarDate(selectedCalendarDate)}
            </div>
            {(() => {
              const dueStudents = studentRecords.filter((r) => r.next_due_date === selectedCalendarDate);
              const payouts = mentorRecords.filter((r) => r.payout_date?.startsWith(selectedCalendarDate));

              if (dueStudents.length === 0 && payouts.length === 0) {
                return <p className="text-brand-muted text-xs">No payments or payouts scheduled on this date.</p>;
              }

              return (
                <div className="space-y-1">
                  {dueStudents.map((r) => {
                    const student = studentsMap.get(r.student_id);
                    return (
                      <div key={r.id} className="flex justify-between py-1 border-b border-brand-dark/10">
                        <span>Student Payment Due: {student?.full_name || 'Scholar'}</span>
                        {getStudentStatusBadge(r.status)}
                      </div>
                    );
                  })}
                  {payouts.map((r) => {
                    const mentor = mentorsMap.get(r.mentor_id);
                    return (
                      <div key={r.id} className="flex justify-between py-1 border-b border-brand-dark/10">
                        <span>Mentor Payout: {mentor?.full_name || 'Mentor'}</span>
                        {getMentorStatusBadge(r.status)}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: AUDIT LOG (audit_notes)                                        */}
      {/* ===================================================================== */}
      {activeTab === 'audit_notes' && (
        <div className="space-y-3 text-xs">
          <div className="font-heading font-bold text-brand-navy text-sm">
            Billing Anchor Overrides & Activity
          </div>

          {auditLogs.length === 0 ? (
            <div className="p-6 bg-brand-paper border border-brand-dark/20 text-center text-brand-muted">
              No audit logs recorded yet.
            </div>
          ) : (
            <div className="border border-brand-dark/30 bg-brand-paper overflow-hidden">
              {/* Compact Responsive Table (< lg: 1024px) */}
              <div className="lg:hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-brand-bg border-b border-brand-dark/20 font-heading uppercase text-[10px] sm:text-[11px] text-brand-muted">
                    <tr>
                      <th scope="col" className="p-2 sm:p-2.5">Date &amp; Scholar</th>
                      <th scope="col" className="p-2 sm:p-2.5">Anchor Shift</th>
                      <th scope="col" className="p-2 sm:p-2.5">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-dark/10 text-[11px]">
                    {auditLogs.map((log) => {
                      const enrollment = enrollmentsMap.get(log.enrollment_id);
                      const student = enrollment ? studentsMap.get(enrollment.student_id) : null;
                      return (
                        <tr key={log.id} className="hover:bg-brand-paper-tint/60 transition-colors">
                          <td className="p-2 sm:p-2.5 align-top">
                            <div className="font-sans font-bold text-brand-navy leading-snug">
                              {student?.full_name || log.enrollment_id.slice(0, 8)}
                            </div>
                            <div className="font-mono text-[10px] text-brand-muted mt-0.5">
                              {log.created_at ? formatLocalDate(new Date(log.created_at)) : '—'}
                            </div>
                          </td>
                          <td className="p-2 sm:p-2.5 align-top font-mono">
                            <div className="text-teal-700 dark:text-brand-teal font-bold">
                              {formatCalendarDate(log.new_billing_start_date)}
                            </div>
                            <div className="text-[10px] text-brand-muted mt-0.5">
                              was: {log.old_billing_start_date ? formatCalendarDate(log.old_billing_start_date) : 'Default'}
                            </div>
                          </td>
                          <td className="p-2 sm:p-2.5 align-top font-sans text-brand-dark break-words">
                            {log.reason}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Desktop Table (>= lg: 1024px) */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-brand-bg border-b border-brand-dark/20 font-heading uppercase text-[11px] text-brand-muted">
                    <tr>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Enrollment / Scholar</th>
                      <th className="p-2.5">Previous Anchor</th>
                      <th className="p-2.5">New Anchor</th>
                      <th className="p-2.5">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-dark/10 font-mono text-[11px]">
                    {auditLogs.map((log) => {
                      const enrollment = enrollmentsMap.get(log.enrollment_id);
                      const student = enrollment ? studentsMap.get(enrollment.student_id) : null;
                      return (
                        <tr key={log.id} className="hover:bg-brand-paper-tint/60">
                          <td className="p-2.5 text-brand-muted">
                            {log.created_at ? formatLocalDate(new Date(log.created_at)) : '—'}
                          </td>
                          <td className="p-2.5 font-sans font-bold text-brand-navy">
                            {student?.full_name || log.enrollment_id.slice(0, 8)}
                          </td>
                          <td className="p-2.5">
                            {log.old_billing_start_date ? formatCalendarDate(log.old_billing_start_date) : 'Default'}
                          </td>
                          <td className="p-2.5 font-bold text-teal-700">
                            {formatCalendarDate(log.new_billing_start_date)}
                          </td>
                          <td className="p-2.5 font-sans text-brand-dark">
                            {log.reason}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* STUDENT PAYMENT DRAWER                                                */}
      {/* ===================================================================== */}
      {selectedStudentRecord && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="fixed inset-0 bg-brand-dark/40 backdrop-blur-xs"
            onClick={() => setSelectedStudentRecord(null)}
          />
          <div className="fixed inset-y-0 right-0 max-w-lg w-full bg-brand-paper border-l-2 border-brand-dark shadow-2xl z-50 overflow-y-auto flex flex-col justify-between text-xs">
            {/* Header */}
            <div className="p-4 border-b-2 border-brand-dark flex items-center justify-between gap-2 sticky top-0 bg-brand-paper z-10">
              <div>
                <span className="text-[10px] font-mono uppercase text-brand-muted font-bold block">Student Payment Details</span>
                <span className="font-heading font-extrabold text-sm text-brand-navy">
                  {studentsMap.get(selectedStudentRecord.student_id)?.full_name || 'Scholar'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {getStudentStatusBadge(selectedStudentRecord.status)}
                <button
                  type="button"
                  onClick={() => setSelectedStudentRecord(null)}
                  className="p-1 text-brand-muted hover:text-brand-dark"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4 flex-1">
              {/* Context */}
              <div className="p-3 bg-brand-bg border border-brand-dark/20 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-brand-muted">Period</span>
                  <span className="font-bold">
                    {formatCalendarDate(selectedStudentRecord.cycle_start_date)} – {formatCalendarDate(selectedStudentRecord.cycle_end_date)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-muted">Due Date</span>
                  <span className="font-bold">{formatCalendarDate(selectedStudentRecord.next_due_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-muted">Method</span>
                  <span className="font-bold">{formatPaymentMethod(selectedStudentRecord.payment_method)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-muted">Reference</span>
                  <span className="font-mono font-bold">{selectedStudentRecord.transaction_reference || 'Not recorded'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-muted">Payment Date</span>
                  <span className="font-bold">{selectedStudentRecord.payment_date ? formatCalendarDate(selectedStudentRecord.payment_date) : 'Pending'}</span>
                </div>
              </div>

              {/* Actions to open Events or Notes */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveEventRecord({
                      type: 'student',
                      id: selectedStudentRecord.id,
                      title: `${studentsMap.get(selectedStudentRecord.student_id)?.full_name || 'Scholar'} - ${selectedStudentRecord.cycle_start_date}`,
                    });
                  }}
                  leftIcon={<History className="w-3.5 h-3.5" />}
                >
                  Payment Events
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveNoteTarget({
                      recordType: 'student_payment',
                      id: selectedStudentRecord.id,
                      title: `${studentsMap.get(selectedStudentRecord.student_id)?.full_name || 'Scholar'} - ${selectedStudentRecord.cycle_start_date}`,
                    });
                  }}
                  leftIcon={<Lock className="w-3.5 h-3.5" />}
                >
                  Admin Notes
                </Button>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t-2 border-brand-dark flex items-center justify-between bg-brand-paper">
              <Button
                variant="outline"
                size="sm"
                className="text-red-700 border-red-300"
                onClick={() => handleDeleteStudent(selectedStudentRecord.id)}
                leftIcon={<Trash2 className="w-3 h-3" />}
              >
                Delete
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const enr = enrollmentsMap.get(selectedStudentRecord.enrollment_id);
                    if (enr) {
                      setActiveAnchorEnrollment(enr);
                      setIsAnchorModalOpen(true);
                    }
                  }}
                >
                  Anchor
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setEditingStudentRecord(selectedStudentRecord);
                  }}
                  leftIcon={<Edit2 className="w-3 h-3" />}
                >
                  Edit Status
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MENTOR PAYOUT DRAWER                                                  */}
      {/* ===================================================================== */}
      {selectedMentorRecord && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="fixed inset-0 bg-brand-dark/40 backdrop-blur-xs"
            onClick={() => setSelectedMentorRecord(null)}
          />
          <div className="fixed inset-y-0 right-0 max-w-lg w-full bg-brand-paper border-l-2 border-brand-dark shadow-2xl z-50 overflow-y-auto flex flex-col justify-between text-xs">
            {/* Header */}
            <div className="p-4 border-b-2 border-brand-dark flex items-center justify-between gap-2 sticky top-0 bg-brand-paper z-10">
              <div>
                <span className="text-[10px] font-mono uppercase text-brand-muted font-bold block">Mentor Payout Details</span>
                <span className="font-heading font-extrabold text-sm text-brand-navy">
                  {mentorsMap.get(selectedMentorRecord.mentor_id)?.full_name || 'Mentor'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {getMentorStatusBadge(selectedMentorRecord.status)}
                <button
                  type="button"
                  onClick={() => setSelectedMentorRecord(null)}
                  className="p-1 text-brand-muted hover:text-brand-dark"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4 flex-1">
              {/* Context */}
              <div className="p-3 bg-brand-bg border border-brand-dark/20 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-brand-muted">Month</span>
                  <span className="font-bold">{formatBillingMonth(selectedMentorRecord.billing_month)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-muted">Scope</span>
                  <span className="font-bold">{selectedMentorRecord.related_student_id ? 'Assigned Scholar' : 'Platform Pool'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-muted">Method</span>
                  <span className="font-bold">{formatPaymentMethod(selectedMentorRecord.payment_method)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-muted">Reference</span>
                  <span className="font-mono font-bold">{selectedMentorRecord.transaction_reference || 'Not recorded'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-muted">Payout Date</span>
                  <span className="font-bold">{selectedMentorRecord.payout_date ? formatCalendarDate(selectedMentorRecord.payout_date.split('T')[0]) : 'Pending'}</span>
                </div>
              </div>

              {/* Actions to open Events or Notes */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveEventRecord({
                      type: 'mentor',
                      id: selectedMentorRecord.id,
                      title: `${mentorsMap.get(selectedMentorRecord.mentor_id)?.full_name || 'Mentor'} - ${formatBillingMonth(selectedMentorRecord.billing_month)}`,
                    });
                  }}
                  leftIcon={<History className="w-3.5 h-3.5" />}
                >
                  Payout Events
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveNoteTarget({
                      recordType: 'mentor_payment',
                      id: selectedMentorRecord.id,
                      title: `${mentorsMap.get(selectedMentorRecord.mentor_id)?.full_name || 'Mentor'} - ${formatBillingMonth(selectedMentorRecord.billing_month)}`,
                    });
                  }}
                  leftIcon={<Lock className="w-3.5 h-3.5" />}
                >
                  Admin Notes
                </Button>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t-2 border-brand-dark flex items-center justify-between bg-brand-paper">
              <Button
                variant="outline"
                size="sm"
                className="text-red-700 border-red-300"
                onClick={() => handleDeleteMentor(selectedMentorRecord.id)}
                leftIcon={<Trash2 className="w-3 h-3" />}
              >
                Delete
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditingMentorRecord(selectedMentorRecord);
                }}
                leftIcon={<Edit2 className="w-3 h-3" />}
              >
                Edit Status
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: CREATE STUDENT PAYMENT RECORD                                  */}
      {/* ===================================================================== */}
      {isCreateStudentModalOpen && (
        <CreateStudentPaymentModal
          enrollments={enrollments}
          studentsMap={studentsMap}
          programsMap={programsMap}
          onClose={() => setIsCreateStudentModalOpen(false)}
          onSuccess={() => {
            setIsCreateStudentModalOpen(false);
            setActionSuccess('Student payment record created.');
            loadDeskData();
          }}
        />
      )}

      {/* ===================================================================== */}
      {/* MODAL: EDIT STUDENT PAYMENT RECORD                                    */}
      {/* ===================================================================== */}
      {editingStudentRecord && (
        <EditStudentPaymentModal
          record={editingStudentRecord}
          onClose={() => setEditingStudentRecord(null)}
          onSuccess={() => {
            setEditingStudentRecord(null);
            setSelectedStudentRecord(null);
            setActionSuccess('Student payment record updated.');
            loadDeskData();
          }}
        />
      )}

      {/* ===================================================================== */}
      {/* MODAL: CREATE MENTOR PAYOUT RECORD                                    */}
      {/* ===================================================================== */}
      {isCreateMentorModalOpen && (
        <CreateMentorPayoutModal
          mentors={profiles.filter((p) => p.role === 'mentor')}
          students={profiles.filter((p) => p.role === 'student')}
          onClose={() => setIsCreateMentorModalOpen(false)}
          onSuccess={() => {
            setIsCreateMentorModalOpen(false);
            setActionSuccess('Mentor payout record created.');
            loadDeskData();
          }}
        />
      )}

      {/* ===================================================================== */}
      {/* MODAL: EDIT MENTOR PAYOUT RECORD                                      */}
      {/* ===================================================================== */}
      {editingMentorRecord && (
        <EditMentorPayoutModal
          record={editingMentorRecord}
          onClose={() => setEditingMentorRecord(null)}
          onSuccess={() => {
            setEditingMentorRecord(null);
            setSelectedMentorRecord(null);
            setActionSuccess('Mentor payout record updated.');
            loadDeskData();
          }}
        />
      )}

      {/* ===================================================================== */}
      {/* MODAL: EVENTS MODAL                                                   */}
      {/* ===================================================================== */}
      {activeEventRecord && (
        <PaymentEventsModal
          recordType={activeEventRecord.type}
          recordId={activeEventRecord.id}
          recordTitle={activeEventRecord.title}
          onClose={() => setActiveEventRecord(null)}
        />
      )}

      {/* ===================================================================== */}
      {/* MODAL: ADMIN NOTES MODAL                                              */}
      {/* ===================================================================== */}
      {activeNoteTarget && (
        <PrivateAdminNotesModal
          recordType={activeNoteTarget.recordType}
          recordId={activeNoteTarget.id}
          recordTitle={activeNoteTarget.title}
          onClose={() => setActiveNoteTarget(null)}
        />
      )}

      {/* ===================================================================== */}
      {/* MODAL: ANCHOR OVERRIDE                                                */}
      {/* ===================================================================== */}
      {isAnchorModalOpen && activeAnchorEnrollment && (
        <ManageBillingAnchorModal
          enrollment={activeAnchorEnrollment}
          studentName={studentsMap.get(activeAnchorEnrollment.student_id)?.full_name || 'Scholar'}
          onClose={() => {
            setIsAnchorModalOpen(false);
            setActiveAnchorEnrollment(null);
          }}
          onSuccess={() => {
            setIsAnchorModalOpen(false);
            setActiveAnchorEnrollment(null);
            setActionSuccess('Billing start date updated.');
            loadDeskData();
          }}
        />
      )}
    </div>
  );
};

// ==============================================================================
// SUB-MODALS
// ==============================================================================

interface CreateStudentPaymentModalProps {
  enrollments: ProgramEnrollmentWithMeta[];
  studentsMap: Map<string, Profile>;
  programsMap: Map<string, Program>;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateStudentPaymentModal: React.FC<CreateStudentPaymentModalProps> = ({
  enrollments,
  studentsMap,
  programsMap,
  onClose,
  onSuccess,
}) => {
  const [enrollmentId, setEnrollmentId] = useState(enrollments[0]?.id || '');
  const [cycleStart, setCycleStart] = useState(() => toBangladeshDateStr());
  const [cycleEnd, setCycleEnd] = useState(() => {
    const period = computeBillingPeriod(toBangladeshDateStr(), 0);
    return period.cycleEndDate;
  });
  const [nextDue, setNextDue] = useState(() => {
    const period = computeBillingPeriod(toBangladeshDateStr(), 0);
    return period.nextDueDate;
  });
  const [status, setStatus] = useState<StudentPaymentStatus>('pending');
  const [method, setMethod] = useState<PaymentMethod>('bkash');
  const [reference, setReference] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const enrollment = enrollments.find((en) => en.id === enrollmentId);
    if (!enrollment) {
      setError('Please select a valid enrollment.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await createStudentPaymentRecord({
        enrollment_id: enrollmentId,
        student_id: enrollment.student_id,
        cycle_start_date: cycleStart,
        cycle_end_date: cycleEnd,
        next_due_date: nextDue,
        status,
        payment_method: status === 'pending' ? null : method,
        transaction_reference: reference.trim() || null,
        payment_date: paymentDate || (status === 'paid' ? toBangladeshDateStr() : null),
      });

      if (res.error) throw res.error;
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create record.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-brand-paper border-2 border-brand-dark shadow-2xl max-w-md w-full p-5 space-y-4 text-xs z-10">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="font-heading font-extrabold text-sm text-brand-navy">Record Student Payment</div>
          <button type="button" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        {error && <div className="p-2 bg-red-50 border border-red-300 text-red-900">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="font-bold block mb-1">Scholar & Enrollment</label>
            <select
              value={enrollmentId}
              onChange={(e) => setEnrollmentId(e.target.value)}
              className="w-full p-1.5 border border-brand-dark/30 bg-brand-paper"
              required
            >
              {enrollments.map((en) => {
                const s = studentsMap.get(en.student_id);
                const p = programsMap.get(en.program_id);
                return (
                  <option key={en.id} value={en.id}>
                    {s?.full_name || 'Scholar'} ({p?.name || 'Program'})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-bold block mb-1">Cycle Start</label>
              <input
                type="date"
                value={cycleStart}
                onChange={(e) => setCycleStart(e.target.value)}
                className="w-full p-1.5 border border-brand-dark/30 bg-brand-paper"
                required
              />
            </div>
            <div>
              <label className="font-bold block mb-1">Cycle End</label>
              <input
                type="date"
                value={cycleEnd}
                onChange={(e) => setCycleEnd(e.target.value)}
                className="w-full p-1.5 border border-brand-dark/30 bg-brand-paper"
                required
              />
            </div>
          </div>

          <div>
            <label className="font-bold block mb-1">Next Due Date</label>
            <input
              type="date"
              value={nextDue}
              onChange={(e) => setNextDue(e.target.value)}
              className="w-full p-1.5 border border-brand-dark/30 bg-brand-paper"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-bold block mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StudentPaymentStatus)}
                className="w-full p-1.5 border border-brand-dark/30 bg-brand-paper"
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="overdue">Overdue</option>
                <option value="waived">Waived</option>
              </select>
            </div>
            <div>
              <label className="font-bold block mb-1">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full p-1.5 border border-brand-dark/30 bg-brand-paper"
              >
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="upay">Upay</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-bold block mb-1">Transaction Reference</label>
              <input
                type="text"
                placeholder="e.g. bKash TrxID"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full p-1.5 border border-brand-dark/30 bg-brand-paper"
              />
            </div>
            <div>
              <label className="font-bold block mb-1">Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full p-1.5 border border-brand-dark/30 bg-brand-paper"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Record'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface EditStudentPaymentModalProps {
  record: StudentPaymentRecord;
  onClose: () => void;
  onSuccess: () => void;
}

const EditStudentPaymentModal: React.FC<EditStudentPaymentModalProps> = ({
  record,
  onClose,
  onSuccess,
}) => {
  const [status, setStatus] = useState<StudentPaymentStatus>(record.status);
  const [method, setMethod] = useState<PaymentMethod>((record.payment_method as PaymentMethod) || 'bkash');
  const [reference, setReference] = useState(record.transaction_reference || '');
  const [paymentDate, setPaymentDate] = useState(record.payment_date || '');
  const [waivedReason, setWaivedReason] = useState(record.waived_reason || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await updateStudentPaymentRecord(record.id, {
        status,
        payment_method: status === 'pending' ? null : method,
        transaction_reference: reference.trim() || null,
        payment_date: paymentDate || (status === 'paid' ? toBangladeshDateStr() : null),
        waived_reason: status === 'waived' ? waivedReason.trim() : null,
      });

      if (res.error) throw res.error;
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update record.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-brand-paper border-2 border-brand-dark shadow-2xl max-w-md w-full p-5 space-y-4 text-xs z-10">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="font-heading font-extrabold text-sm text-brand-navy">Update Payment Status</div>
          <button type="button" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        {error && <div className="p-2 bg-red-50 border border-red-300 text-red-900">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-bold block mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StudentPaymentStatus)}
                className="w-full p-1.5 border border-brand-dark/30 bg-brand-paper"
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="overdue">Overdue</option>
                <option value="waived">Waived</option>
              </select>
            </div>
            <div>
              <label className="font-bold block mb-1">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full p-1.5 border border-brand-dark/30 bg-brand-paper"
              >
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="upay">Upay</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold block mb-1">Transaction Reference</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full p-1.5 border border-brand-dark/30 bg-brand-paper"
            />
          </div>

          <div>
            <label className="font-bold block mb-1">Payment Date</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full p-1.5 border border-brand-dark/30 bg-brand-paper"
            />
          </div>

          {status === 'waived' && (
            <div>
              <label className="font-bold block mb-1">Waiver Reason</label>
              <textarea
                value={waivedReason}
                onChange={(e) => setWaivedReason(e.target.value)}
                className="w-full p-1.5 border border-brand-dark/30 bg-brand-paper h-16"
                required
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={submitting}>
              {submitting ? 'Updating...' : 'Update Record'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface CreateMentorPayoutModalProps {
  mentors: Profile[];
  students: Profile[];
  onClose: () => void;
  onSuccess: () => void;
}

const CreateMentorPayoutModal: React.FC<CreateMentorPayoutModalProps> = ({
  mentors,
  students,
  onClose,
  onSuccess,
}) => {
  const [mentorId, setMentorId] = useState(mentors[0]?.id || '');
  const [relatedStudentId, setRelatedStudentId] = useState('');
  const [billingMonth, setBillingMonth] = useState(() => toBangladeshDateStr().substring(0, 7));
  const [status, setStatus] = useState<MentorPaymentStatus>('pending');
  const [method, setMethod] = useState<PaymentMethod>('bkash');
  const [reference, setReference] = useState('');
  const [payoutDate, setPayoutDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await createMentorPaymentRecord({
        mentor_id: mentorId,
        related_student_id: relatedStudentId || null,
        billing_month: billingMonth,
        status,
        payment_method: status === 'pending' ? null : method,
        transaction_reference: reference.trim() || null,
        payout_date: payoutDate || (status === 'paid' ? toBangladeshDateStr() : null),
      });

      if (res.error) throw res.error;
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record payout.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-brand-paper border-2 border-brand-dark shadow-2xl max-w-md w-full p-5 space-y-4 text-xs z-10">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="font-heading font-extrabold text-sm text-brand-navy">Record Mentor Payout</div>
          <button type="button" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        {error && <div className="p-2 bg-red-50 border border-red-300 text-red-900">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="font-bold block mb-1">Mentor</label>
            <select
              value={mentorId}
              onChange={(e) => setMentorId(e.target.value)}
              className="w-full p-1.5 border border-brand-dark/30 bg-brand-paper"
              required
            >
              {mentors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} ({m.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold block mb-1">Assigned Scholar (Optional)</label>
            <select
              value={relatedStudentId}
              onChange={(e) => setRelatedStudentId(e.target.value)}
              className="w-full p-1.5 border border-brand-dark/30 bg-brand-paper"
            >
              <option value="">Platform Mentorship Pool</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.poraplan_id || ''})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-bold block mb-1">Billing Month</label>
              <input
                type="month"
                value={billingMonth}
                onChange={(e) => setBillingMonth(e.target.value)}
                className="w-full p-1.5 border border-brand-dark/30 bg-brand-paper"
                required
              />
            </div>
            <div>
              <label className="font-bold block mb-1">Payout Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MentorPaymentStatus)}
                className="w-full p-1.5 border border-brand-dark/30 bg-brand-paper"
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-bold block mb-1">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full p-1.5 border border-brand-dark/30 bg-brand-paper"
              >
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="upay">Upay</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>
            <div>
              <label className="font-bold block mb-1">Payout Date</label>
              <input
                type="date"
                value={payoutDate}
                onChange={(e) => setPayoutDate(e.target.value)}
                className="w-full p-1.5 border border-brand-dark/30 bg-brand-paper"
              />
            </div>
          </div>

          <div>
            <label className="font-bold block mb-1">Transaction Reference</label>
            <input
              type="text"
              placeholder="e.g. Bank Transfer ID"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full p-1.5 border border-brand-dark/30 bg-brand-paper"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Payout'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface EditMentorPayoutModalProps {
  record: MentorPaymentRecord;
  onClose: () => void;
  onSuccess: () => void;
}

const EditMentorPayoutModal: React.FC<EditMentorPayoutModalProps> = ({
  record,
  onClose,
  onSuccess,
}) => {
  const [status, setStatus] = useState<MentorPaymentStatus>(record.status);
  const [method, setMethod] = useState<PaymentMethod>((record.payment_method as PaymentMethod) || 'bkash');
  const [reference, setReference] = useState(record.transaction_reference || '');
  const [payoutDate, setPayoutDate] = useState(record.payout_date ? record.payout_date.split('T')[0] : '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await updateMentorPaymentRecord(record.id, {
        status,
        payment_method: status === 'pending' ? null : method,
        transaction_reference: reference.trim() || null,
        payout_date: payoutDate || (status === 'paid' ? toBangladeshDateStr() : null),
      });

      if (res.error) throw res.error;
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update payout.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-brand-paper border-2 border-brand-dark shadow-2xl max-w-md w-full p-5 space-y-4 text-xs z-10">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="font-heading font-extrabold text-sm text-brand-navy">Update Payout Status</div>
          <button type="button" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        {error && <div className="p-2 bg-red-50 border border-red-300 text-red-900">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-bold block mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MentorPaymentStatus)}
                className="w-full p-1.5 border border-brand-dark/30 bg-brand-paper"
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
              </select>
            </div>
            <div>
              <label className="font-bold block mb-1">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full p-1.5 border border-brand-dark/30 bg-brand-paper"
              >
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="upay">Upay</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold block mb-1">Transaction Reference</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full p-1.5 border border-brand-dark/30 bg-brand-paper"
            />
          </div>

          <div>
            <label className="font-bold block mb-1">Payout Date</label>
            <input
              type="date"
              value={payoutDate}
              onChange={(e) => setPayoutDate(e.target.value)}
              className="w-full p-1.5 border border-brand-dark/30 bg-brand-paper"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={submitting}>
              {submitting ? 'Updating...' : 'Update Payout'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface PaymentEventsModalProps {
  recordType: 'student' | 'mentor';
  recordId: string;
  recordTitle: string;
  onClose: () => void;
}

const PaymentEventsModal: React.FC<PaymentEventsModalProps> = ({
  recordType,
  recordId,
  recordTitle,
  onClose,
}) => {
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<PaymentMethod>('bkash');
  const [reference, setReference] = useState('');
  const [eventDate, setEventDate] = useState(() => toBangladeshDateStr());
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPaymentEvents(recordType, recordId);
      setEvents(res.events);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [recordType, recordId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await createPaymentEvent({
        record_type: recordType,
        student_payment_id: recordType === 'student' ? recordId : null,
        mentor_payment_id: recordType === 'mentor' ? recordId : null,
        payment_method: method,
        transaction_reference: reference.trim() || null,
        payment_date: eventDate,
        note: note.trim() || null,
      });
      if (res.error) throw res.error;
      setReference('');
      setNote('');
      loadEvents();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to record event.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-brand-paper border-2 border-brand-dark shadow-2xl max-w-md w-full p-5 space-y-4 text-xs z-10">
        <div className="flex items-center justify-between border-b pb-2">
          <div>
            <div className="font-heading font-extrabold text-sm text-brand-navy">Payment Events & History</div>
            <div className="text-[10px] text-brand-muted truncate max-w-xs">{recordTitle}</div>
          </div>
          <button type="button" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        {/* Existing Events List */}
        <div className="max-h-48 overflow-y-auto space-y-2 border p-2 bg-brand-bg">
          {loading ? (
            <div className="text-center py-4 text-brand-muted">Loading events...</div>
          ) : events.length === 0 ? (
            <div className="text-center py-4 text-brand-muted">No events recorded.</div>
          ) : (
            events.map((evt) => (
              <div key={evt.id} className="p-2 bg-brand-paper border border-brand-dark/15 space-y-1">
                <div className="flex justify-between font-bold">
                  <span>{formatPaymentMethod(evt.payment_method)}</span>
                  <span className="font-mono text-brand-muted">{formatCalendarDate(evt.payment_date.split('T')[0])}</span>
                </div>
                {evt.transaction_reference && (
                  <div className="font-mono text-brand-dark">Ref: {evt.transaction_reference}</div>
                )}
                {evt.note && <div className="text-brand-muted text-[11px] italic">{evt.note}</div>}
              </div>
            ))
          )}
        </div>

        {/* Log New Event Form */}
        <form onSubmit={handleAddEvent} className="space-y-2.5 border-t pt-3">
          <div className="font-bold">Log New Event</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block mb-0.5 text-[10px] text-brand-muted">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full p-1 border border-brand-dark/30 bg-brand-paper"
              >
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="upay">Upay</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
              </select>
            </div>
            <div>
              <label className="block mb-0.5 text-[10px] text-brand-muted">Date</label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full p-1 border border-brand-dark/30 bg-brand-paper"
                required
              />
            </div>
          </div>

          <div>
            <label className="block mb-0.5 text-[10px] text-brand-muted">Reference</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. TrxID"
              className="w-full p-1 border border-brand-dark/30 bg-brand-paper"
            />
          </div>

          <div>
            <label className="block mb-0.5 text-[10px] text-brand-muted">Internal Event Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional admin note"
              className="w-full p-1 border border-brand-dark/30 bg-brand-paper"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              Close
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Event'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface PrivateAdminNotesModalProps {
  recordType: 'student_payment' | 'mentor_payment' | 'enrollment';
  recordId: string;
  recordTitle: string;
  onClose: () => void;
}

const PrivateAdminNotesModal: React.FC<PrivateAdminNotesModalProps> = ({
  recordType,
  recordId,
  recordTitle,
  onClose,
}) => {
  const [notes, setNotes] = useState<PaymentAdminNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPaymentAdminNotes(recordType, recordId);
      setNotes(res.notes);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [recordType, recordId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSubmitting(true);
    try {
      const res = await createPaymentAdminNote({
        recordType,
        recordId,
        note: newNote.trim(),
      });
      if (res.error) throw res.error;
      setNewNote('');
      loadNotes();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save admin note.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-brand-paper border-2 border-brand-dark shadow-2xl max-w-md w-full p-5 space-y-4 text-xs z-10">
        <div className="flex items-center justify-between border-b pb-2">
          <div>
            <div className="font-heading font-extrabold text-sm text-brand-navy flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-brand-teal" />
              Private Admin Notes
            </div>
            <div className="text-[10px] text-brand-muted truncate max-w-xs">{recordTitle}</div>
          </div>
          <button type="button" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        {/* Notes List */}
        <div className="max-h-48 overflow-y-auto space-y-2 border p-2 bg-brand-bg">
          {loading ? (
            <div className="text-center py-4 text-brand-muted">Loading notes...</div>
          ) : notes.length === 0 ? (
            <div className="text-center py-4 text-brand-muted">No private notes recorded.</div>
          ) : (
            notes.map((n) => (
              <div key={n.id} className="p-2 bg-brand-paper border border-brand-dark/15 space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-brand-muted">
                  <span>Admin</span>
                  <span>{n.created_at ? formatLocalDate(new Date(n.created_at)) : ''}</span>
                </div>
                <div className="text-brand-dark font-sans leading-relaxed">{n.note}</div>
              </div>
            ))
          )}
        </div>

        {/* Add Note */}
        <form onSubmit={handleAddNote} className="space-y-2 border-t pt-3">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add internal confidential note..."
            className="w-full p-2 border border-brand-dark/30 bg-brand-paper h-16"
            required
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              Close
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Add Note'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ManageBillingAnchorModalProps {
  enrollment: ProgramEnrollmentWithMeta;
  studentName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ManageBillingAnchorModal: React.FC<ManageBillingAnchorModalProps> = ({
  enrollment,
  studentName,
  onClose,
  onSuccess,
}) => {
  const currentAnchor = enrollment.billing_start_date || (enrollment.enrolled_at ? enrollment.enrolled_at.substring(0, 10) : toBangladeshDateStr());
  const [newAnchor, setNewAnchor] = useState(currentAnchor);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A valid audit reason is required.');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await overrideBillingStartDate({
        enrollmentId: enrollment.id,
        newBillingStartDate: newAnchor,
        reason: reason.trim(),
      });
      if (res.error) throw res.error;
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update billing anchor.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-brand-paper border-2 border-brand-dark shadow-2xl max-w-md w-full p-5 space-y-4 text-xs z-10">
        <div className="flex items-center justify-between border-b pb-2">
          <div>
            <div className="font-heading font-extrabold text-sm text-brand-navy">Override Billing Anchor Date</div>
            <div className="text-[10px] text-brand-muted">{studentName}</div>
          </div>
          <button type="button" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        {error && <div className="p-2 bg-red-50 border border-red-300 text-red-900">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <span className="text-[10px] font-mono uppercase text-brand-muted block">Current Anchor</span>
            <span className="font-bold text-brand-navy">{formatCalendarDate(currentAnchor)}</span>
          </div>

          <div>
            <label className="font-bold block mb-1">New Anchor Date</label>
            <input
              type="date"
              value={newAnchor}
              onChange={(e) => setNewAnchor(e.target.value)}
              className="w-full p-1.5 border border-brand-dark/30 bg-brand-paper"
              required
            />
          </div>

          <div>
            <label className="font-bold block mb-1">Mandatory Audit Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Scholar requested alignment with 1st of month"
              className="w-full p-1.5 border border-brand-dark/30 bg-brand-paper h-16"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={submitting}>
              {submitting ? 'Updating...' : 'Update Anchor'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
