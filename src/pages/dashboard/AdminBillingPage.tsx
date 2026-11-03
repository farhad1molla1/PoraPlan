import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getAdminStudentPaymentRecords,
  createStudentPaymentRecord,
  updateStudentPaymentRecord,
  softDeleteStudentPaymentRecord,
  getAdminMentorPaymentRecords,
  createMentorPaymentRecord,
  updateMentorPaymentRecord,
  softDeleteMentorPaymentRecord,
  getPaymentEvents,
  createPaymentEvent,
  getPaymentAdminNotes,
  createPaymentAdminNote,
  getBillingDateAuditLogs,
  overrideBillingStartDate,
} from '../../lib/payments';
import {
  computeBillingPeriod,
  findCycleForReferenceDate,
  formatCalendarDate,
  diffInDays,
  isValidCalendarDate,
  toBangladeshDateStr,
} from '../../lib/billingCycles';
import { getAdminUsers } from '../../lib/profiles';
import { getEnrollments } from '../../lib/applications';
import { getPrograms } from '../../lib/programs';
import { formatLocalDate } from '../../lib/library';
import type {
  StudentPaymentRecord,
  MentorPaymentRecord,
  PaymentEvent,
  PaymentAdminNote,
  BillingDateAuditLog,
  StudentPaymentStatus,
  MentorPaymentStatus,
  PaymentMethod,
  Profile,
  ProgramEnrollmentWithMeta,
  Program,
} from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  CreditCard,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  AlertTriangle,
  Calendar,
  User,
  Plus,
  Edit2,
  Trash2,
  MessageSquare,
  History,
  Search,
  X,
  GraduationCap,
  Check,
} from 'lucide-react';

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
      return <Badge variant="teal" size="sm" className="gap-1"><CheckCircle2 className="w-3 h-3" />Paid</Badge>;
    case 'pending':
      return <Badge variant="gold" size="sm" className="gap-1"><Clock className="w-3 h-3" />Pending</Badge>;
    case 'partial':
      return <Badge variant="paper" size="sm" className="gap-1"><Layers className="w-3 h-3" />Partial</Badge>;
    case 'overdue':
      return <Badge variant="danger" size="sm" className="gap-1"><AlertTriangle className="w-3 h-3" />Overdue</Badge>;
    case 'waived':
      return <Badge variant="muted" size="sm" className="gap-1"><Check className="w-3 h-3" />Waived</Badge>;
    default:
      return <Badge variant="paper" size="sm">{status}</Badge>;
  }
}

function getMentorStatusBadge(status: MentorPaymentStatus) {
  switch (status) {
    case 'paid':
      return <Badge variant="teal" size="sm" className="gap-1"><CheckCircle2 className="w-3 h-3" />Paid</Badge>;
    case 'pending':
      return <Badge variant="gold" size="sm" className="gap-1"><Clock className="w-3 h-3" />Pending</Badge>;
    case 'partial':
      return <Badge variant="paper" size="sm" className="gap-1"><Layers className="w-3 h-3" />Partial</Badge>;
    default:
      return <Badge variant="paper" size="sm">{status}</Badge>;
  }
}

type DeskTab = 'overview' | 'student_payments' | 'mentor_payouts' | 'audit_notes';

export const AdminBillingPage: React.FC = () => {
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const [activeTab, setActiveTab] = useState<DeskTab>('overview');

  // Master Data State
  const [studentRecords, setStudentRecords] = useState<StudentPaymentRecord[]>([]);
  const [mentorRecords, setMentorRecords] = useState<MentorPaymentRecord[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [mentors, setMentors] = useState<Profile[]>([]);
  const [enrollments, setEnrollments] = useState<ProgramEnrollmentWithMeta[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [auditLogs, setAuditLogs] = useState<BillingDateAuditLog[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [studentStatusFilter, setStudentStatusFilter] = useState<'all' | StudentPaymentStatus>('all');
  const [mentorStatusFilter, setMentorStatusFilter] = useState<'all' | MentorPaymentStatus>('all');
  const [programFilter, setProgramFilter] = useState<string>('all');

  // Modals State
  const [isCreateStudentModalOpen, setIsCreateStudentModalOpen] = useState(false);
  const [isEditStudentModalOpen, setIsEditStudentModalOpen] = useState(false);
  const [editingStudentRecord, setEditingStudentRecord] = useState<StudentPaymentRecord | null>(null);

  const [isCreateMentorModalOpen, setIsCreateMentorModalOpen] = useState(false);
  const [isEditMentorModalOpen, setIsEditMentorModalOpen] = useState(false);
  const [editingMentorRecord, setEditingMentorRecord] = useState<MentorPaymentRecord | null>(null);

  const [isEventsModalOpen, setIsEventsModalOpen] = useState(false);
  const [activeEventRecord, setActiveEventRecord] = useState<{ type: 'student' | 'mentor'; id: string; title: string } | null>(null);
  const [recordEvents, setRecordEvents] = useState<PaymentEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [activeNoteTarget, setActiveNoteTarget] = useState<{ recordType: 'student_payment' | 'mentor_payment' | 'enrollment'; id: string; title: string } | null>(null);
  const [activeNotes, setActiveNotes] = useState<PaymentAdminNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');

  const [isBillingAnchorModalOpen, setIsBillingAnchorModalOpen] = useState(false);
  const [activeAnchorEnrollment, setActiveAnchorEnrollment] = useState<ProgramEnrollmentWithMeta | null>(null);
  const [newAnchorDate, setNewAnchorDate] = useState('');
  const [anchorOverrideReason, setAnchorOverrideReason] = useState('');
  const [isOverridingAnchor, setIsOverridingAnchor] = useState(false);

  // Load all desk data
  const loadDeskData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);

    try {
      const [
        studentRecsRes,
        mentorRecsRes,
        studentsUserRes,
        mentorsUserRes,
        enrollmentsRes,
        programsRes,
        auditLogsRes,
      ] = await Promise.all([
        getAdminStudentPaymentRecords({ includeDeleted: false }),
        getAdminMentorPaymentRecords({ includeDeleted: false }),
        getAdminUsers({ role: 'student' }),
        getAdminUsers({ role: 'mentor' }),
        getEnrollments(),
        getPrograms(),
        getBillingDateAuditLogs(),
      ]);

      if (studentRecsRes.error) throw studentRecsRes.error;
      if (mentorRecsRes.error) throw mentorRecsRes.error;

      setStudentRecords(studentRecsRes.records);
      setMentorRecords(mentorRecsRes.records);
      setStudents(studentsUserRes.users || []);
      setMentors(mentorsUserRes.users || []);
      setEnrollments(enrollmentsRes.enrollments || []);
      setPrograms(programsRes.programs || []);
      setAuditLogs(auditLogsRes.logs || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load billing operations data.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadDeskData();
  }, [loadDeskData]);

  // Lookup Maps
  const studentsMap = useMemo(() => {
    const map = new Map<string, Profile>();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  const mentorsMap = useMemo(() => {
    const map = new Map<string, Profile>();
    mentors.forEach((m) => map.set(m.id, m));
    return map;
  }, [mentors]);

  const enrollmentsMap = useMemo(() => {
    const map = new Map<string, ProgramEnrollmentWithMeta>();
    enrollments.forEach((e) => map.set(e.id, e));
    return map;
  }, [enrollments]);

  const programsMap = useMemo(() => {
    const map = new Map<string, Program>();
    programs.forEach((p) => map.set(p.id, p));
    return map;
  }, [programs]);

  // Duplicate Transaction Reference Detection Map
  const allKnownReferences = useMemo(() => {
    const map = new Map<string, { type: 'Student Payment' | 'Mentor Payout'; id: string; date: string }>();
    studentRecords.forEach((r) => {
      if (r.transaction_reference && r.transaction_reference.trim()) {
        map.set(r.transaction_reference.trim().toLowerCase(), {
          type: 'Student Payment',
          id: r.id,
          date: r.cycle_start_date,
        });
      }
    });
    mentorRecords.forEach((r) => {
      if (r.transaction_reference && r.transaction_reference.trim()) {
        map.set(r.transaction_reference.trim().toLowerCase(), {
          type: 'Mentor Payout',
          id: r.id,
          date: r.billing_month,
        });
      }
    });
    return map;
  }, [studentRecords, mentorRecords]);

  // Status Summary Counts (Strictly Record Counts, Absolutely NO Amounts)
  const summaryCounts = useMemo(() => {
    return {
      totalStudent: studentRecords.length,
      studentPending: studentRecords.filter((r) => r.status === 'pending').length,
      studentPartial: studentRecords.filter((r) => r.status === 'partial').length,
      studentPaid: studentRecords.filter((r) => r.status === 'paid').length,
      studentOverdue: studentRecords.filter((r) => r.status === 'overdue').length,
      studentWaived: studentRecords.filter((r) => r.status === 'waived').length,
      totalMentor: mentorRecords.length,
      mentorPending: mentorRecords.filter((r) => r.status === 'pending').length,
      mentorPartial: mentorRecords.filter((r) => r.status === 'partial').length,
      mentorPaid: mentorRecords.filter((r) => r.status === 'paid').length,
    };
  }, [studentRecords, mentorRecords]);

  // Filtered Student Payment Records
  const filteredStudentRecords = useMemo(() => {
    return studentRecords.filter((rec) => {
      if (studentStatusFilter !== 'all' && rec.status !== studentStatusFilter) {
        return false;
      }
      const student = studentsMap.get(rec.student_id);
      const enrollment = enrollmentsMap.get(rec.enrollment_id);

      if (programFilter !== 'all' && enrollment?.program_id !== programFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const studentName = student?.full_name?.toLowerCase() || '';
        const poraplanId = student?.poraplan_id?.toLowerCase() || '';
        const ref = rec.transaction_reference?.toLowerCase() || '';
        if (!studentName.includes(query) && !poraplanId.includes(query) && !ref.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [studentRecords, studentStatusFilter, programFilter, searchQuery, studentsMap, enrollmentsMap]);

  // Filtered Mentor Payout Records
  const filteredMentorRecords = useMemo(() => {
    return mentorRecords.filter((rec) => {
      if (mentorStatusFilter !== 'all' && rec.status !== mentorStatusFilter) {
        return false;
      }
      const mentor = mentorsMap.get(rec.mentor_id);

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const mentorName = mentor?.full_name?.toLowerCase() || '';
        const poraplanId = mentor?.poraplan_id?.toLowerCase() || '';
        const ref = rec.transaction_reference?.toLowerCase() || '';
        const month = rec.billing_month.toLowerCase();
        if (!mentorName.includes(query) && !poraplanId.includes(query) && !ref.includes(query) && !month.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [mentorRecords, mentorStatusFilter, searchQuery, mentorsMap]);

  // Upcoming Student Billing Renewals based on billing_start_date anchor
  const upcomingStudentRenewals = useMemo(() => {
    const todayStr = toBangladeshDateStr();
    return enrollments
      .filter((e) => e.status === 'active' && e.billing_start_date)
      .map((e) => {
        const cycle = findCycleForReferenceDate(e.billing_start_date!, todayStr);
        const daysRemaining = diffInDays(todayStr, cycle.nextDueDate);
        const student = studentsMap.get(e.student_id);
        const program = programsMap.get(e.program_id);
        return {
          enrollmentId: e.id,
          studentName: student?.full_name || 'Scholar',
          poraplanId: student?.poraplan_id || '',
          programName: program?.name || 'Academic Program',
          cycleStartDate: cycle.cycleStartDate,
          cycleEndDate: cycle.cycleEndDate,
          nextDueDate: cycle.nextDueDate,
          daysRemaining,
        };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 5);
  }, [enrollments, studentsMap, programsMap]);

  // Event Modal Handlers
  const openEventsModal = async (type: 'student' | 'mentor', id: string, title: string) => {
    setActiveEventRecord({ type, id, title });
    setIsEventsModalOpen(true);
    setEventsLoading(true);
    try {
      const res = await getPaymentEvents(type, id);
      setRecordEvents(res.events);
    } catch {
      setRecordEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  // Notes Modal Handlers
  const openNotesModal = async (recordType: 'student_payment' | 'mentor_payment' | 'enrollment', id: string, title: string) => {
    setActiveNoteTarget({ recordType, id, title });
    setIsNotesModalOpen(true);
    setNotesLoading(true);
    setNewNoteText('');
    try {
      const res = await getPaymentAdminNotes(recordType, id);
      setActiveNotes(res.notes);
    } catch {
      setActiveNotes([]);
    } finally {
      setNotesLoading(false);
    }
  };

  const handleAddAdminNote = async () => {
    if (!activeNoteTarget || !newNoteText.trim()) return;
    try {
      const res = await createPaymentAdminNote({
        recordType: activeNoteTarget.recordType,
        recordId: activeNoteTarget.id,
        note: newNoteText.trim(),
      });
      if (res.error) throw res.error;
      if (res.note) {
        setActiveNotes((prev) => [res.note!, ...prev]);
        setNewNoteText('');
        setActionSuccess('Admin note saved securely.');
        setTimeout(() => setActionSuccess(null), 3000);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save admin note.');
    }
  };

  // Billing Start Date Override Handlers
  const openBillingAnchorModal = (enrollment: ProgramEnrollmentWithMeta) => {
    setActiveAnchorEnrollment(enrollment);
    setNewAnchorDate(enrollment.billing_start_date || toBangladeshDateStr());
    setAnchorOverrideReason('');
    setIsBillingAnchorModalOpen(true);
  };

  const handleOverrideBillingAnchor = async () => {
    if (!activeAnchorEnrollment || !newAnchorDate || !anchorOverrideReason.trim()) {
      alert('Please provide a valid date and a mandatory reason for this billing anchor change.');
      return;
    }

    setIsOverridingAnchor(true);
    try {
      const res = await overrideBillingStartDate({
        enrollmentId: activeAnchorEnrollment.id,
        newBillingStartDate: newAnchorDate,
        reason: anchorOverrideReason.trim(),
      });

      if (res.error) throw res.error;

      setActionSuccess(`Billing anchor updated for enrollment. Historical payment records remain preserved.`);
      setIsBillingAnchorModalOpen(false);
      loadDeskData();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to override billing start date.');
    } finally {
      setIsOverridingAnchor(false);
    }
  };

  // Soft Delete Handlers
  const handleDeleteStudentPayment = async (id: string) => {
    if (!confirm('Are you sure you want to soft-delete this student payment record? It will be hidden from standard views.')) {
      return;
    }
    try {
      const res = await softDeleteStudentPaymentRecord(id);
      if (res.error) throw res.error;
      setActionSuccess('Student payment record soft-deleted successfully.');
      loadDeskData();
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete record.');
    }
  };

  const handleDeleteMentorPayout = async (id: string) => {
    if (!confirm('Are you sure you want to soft-delete this mentor payout record?')) {
      return;
    }
    try {
      const res = await softDeleteMentorPaymentRecord(id);
      if (res.error) throw res.error;
      setActionSuccess('Mentor payout record soft-deleted successfully.');
      loadDeskData();
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete payout record.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-brand-navy text-brand-paper p-5 sm:p-6 border-2 border-brand-dark shadow-brutal flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-brand-gold text-brand-dark border-2 border-brand-dark shadow-brutal-xs">
              <CreditCard className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-heading font-extrabold tracking-tight text-brand-paper">
              Billing Management
            </h1>
          </div>
          <p className="text-xs sm:text-sm font-sans text-brand-paper/80">
            Admin Operations Desk: Manage student payments, mentor payouts, billing anchors, and audit trails.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDeskData}
            disabled={loading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            className="bg-brand-paper text-brand-dark"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div className="p-3 bg-brand-teal/15 border-2 border-brand-dark text-brand-navy font-bold text-xs sm:text-sm flex items-center justify-between shadow-brutal-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-brand-teal shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button type="button" onClick={() => setActionSuccess(null)} className="hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border-2 border-brand-dark shadow-brutal-sm flex items-start gap-3 text-red-900">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm font-sans">
            <p className="font-bold">Error loading billing desk</p>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadDeskData} className="shrink-0">
            Retry
          </Button>
        </div>
      )}

      {/* Top Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-2 border-brand-dark bg-brand-paper p-1 shadow-brutal-xs">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-3 sm:px-4 py-2 font-heading text-xs sm:text-sm font-bold uppercase transition-colors flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-brand-navy text-brand-paper border border-brand-dark shadow-brutal-xs'
              : 'text-brand-dark hover:bg-brand-bg'
          }`}
        >
          <Layers className="w-4 h-4" />
          Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('student_payments')}
          className={`px-3 sm:px-4 py-2 font-heading text-xs sm:text-sm font-bold uppercase transition-colors flex items-center gap-2 ${
            activeTab === 'student_payments'
              ? 'bg-brand-navy text-brand-paper border border-brand-dark shadow-brutal-xs'
              : 'text-brand-dark hover:bg-brand-bg'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          Student Payments ({summaryCounts.totalStudent})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('mentor_payouts')}
          className={`px-3 sm:px-4 py-2 font-heading text-xs sm:text-sm font-bold uppercase transition-colors flex items-center gap-2 ${
            activeTab === 'mentor_payouts'
              ? 'bg-brand-navy text-brand-paper border border-brand-dark shadow-brutal-xs'
              : 'text-brand-dark hover:bg-brand-bg'
          }`}
        >
          <User className="w-4 h-4" />
          Mentor Payouts ({summaryCounts.totalMentor})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('audit_notes')}
          className={`px-3 sm:px-4 py-2 font-heading text-xs sm:text-sm font-bold uppercase transition-colors flex items-center gap-2 ${
            activeTab === 'audit_notes'
              ? 'bg-brand-navy text-brand-paper border border-brand-dark shadow-brutal-xs'
              : 'text-brand-dark hover:bg-brand-bg'
          }`}
        >
          <History className="w-4 h-4" />
          Audit & History ({auditLogs.length})
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Operational Count Summaries (STRICTLY Record Counts, Absolutely NO Amounts) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs">
              <span className="text-[10px] font-mono uppercase text-brand-muted block">Student Pending</span>
              <span className="text-xl font-heading font-extrabold text-amber-600">{summaryCounts.studentPending}</span>
            </div>
            <div className="p-3 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs">
              <span className="text-[10px] font-mono uppercase text-brand-muted block">Student Partial</span>
              <span className="text-xl font-heading font-extrabold text-blue-600">{summaryCounts.studentPartial}</span>
            </div>
            <div className="p-3 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs">
              <span className="text-[10px] font-mono uppercase text-brand-muted block">Student Paid</span>
              <span className="text-xl font-heading font-extrabold text-teal-600">{summaryCounts.studentPaid}</span>
            </div>
            <div className="p-3 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs">
              <span className="text-[10px] font-mono uppercase text-brand-muted block">Student Overdue</span>
              <span className="text-xl font-heading font-extrabold text-red-600">{summaryCounts.studentOverdue}</span>
            </div>
            <div className="p-3 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs">
              <span className="text-[10px] font-mono uppercase text-brand-muted block">Mentor Pending</span>
              <span className="text-xl font-heading font-extrabold text-amber-600">{summaryCounts.mentorPending}</span>
            </div>
            <div className="p-3 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs">
              <span className="text-[10px] font-mono uppercase text-brand-muted block">Mentor Paid</span>
              <span className="text-xl font-heading font-extrabold text-teal-600">{summaryCounts.mentorPaid}</span>
            </div>
          </div>

          {/* Two-Column Grid: Upcoming Renewals & Operational Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Upcoming Student Billing Renewals (7 cols) */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-heading font-bold text-brand-navy uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-brand-teal" />
                  Upcoming Student Billing Renewals
                </h3>
                <span className="text-xs font-mono text-brand-muted">Calculated via Billing Anchors</span>
              </div>

              {upcomingStudentRenewals.length === 0 ? (
                <div className="p-6 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs text-center text-xs text-brand-muted">
                  No upcoming billing renewals detected for active enrollments.
                </div>
              ) : (
                <div className="space-y-2">
                  {upcomingStudentRenewals.map((r) => (
                    <div
                      key={r.enrollmentId}
                      className="p-3 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs flex items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs sm:text-sm font-heading font-bold text-brand-navy">
                          {r.studentName} {r.poraplanId ? `(${r.poraplanId})` : ''}
                        </div>
                        <div className="text-[11px] font-mono text-brand-muted">
                          {r.programName} • Next Due: {formatCalendarDate(r.nextDueDate)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge
                          variant={r.daysRemaining <= 3 ? 'danger' : r.daysRemaining <= 7 ? 'gold' : 'teal'}
                          size="sm"
                        >
                          {r.daysRemaining < 0
                            ? `${Math.abs(r.daysRemaining)}d Overdue`
                            : r.daysRemaining === 0
                            ? 'Due Today'
                            : `In ${r.daysRemaining} days`}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Billing Date Audit Activity (5 cols) */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-heading font-bold text-brand-navy uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-4 h-4 text-brand-teal" />
                  Recent Billing Date Adjustments
                </h3>
              </div>

              {auditLogs.length === 0 ? (
                <div className="p-6 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs text-center text-xs text-brand-muted">
                  No billing start date adjustments recorded.
                </div>
              ) : (
                <div className="space-y-2">
                  {auditLogs.slice(0, 4).map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs space-y-1 text-xs"
                    >
                      <div className="flex justify-between items-center text-[11px] font-mono text-brand-muted">
                        <span>{formatCalendarDate(log.old_billing_start_date)} → {formatCalendarDate(log.new_billing_start_date)}</span>
                        <span>{log.created_at ? formatLocalDate(new Date(log.created_at)) : '—'}</span>
                      </div>
                      <p className="font-sans text-brand-dark text-[11px] line-clamp-2">
                        <strong>Reason: </strong>{log.reason}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STUDENT PAYMENTS */}
      {activeTab === 'student_payments' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-brand-muted" />
                <input
                  type="text"
                  placeholder="Search student, ID, or reference..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs font-sans border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none"
                />
              </div>

              {/* Status Filter */}
              <select
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value)}
                aria-label="Filter by program"
                className="px-2.5 py-1.5 text-xs font-heading font-bold uppercase border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none"
              >
                <option value="all">All Programs</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              <select
                value={studentStatusFilter}
                onChange={(e) => setStudentStatusFilter(e.target.value as 'all' | StudentPaymentStatus)}
                aria-label="Filter by student payment status"
                className="px-2.5 py-1.5 text-xs font-heading font-bold uppercase border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="waived">Waived</option>
              </select>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateStudentModalOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Record Payment Cycle
            </Button>
          </div>

          {/* Student Records Table / Cards */}
          {filteredStudentRecords.length === 0 ? (
            <div className="p-8 bg-brand-paper border-2 border-brand-dark shadow-brutal-sm text-center text-xs text-brand-muted">
              No student payment records match the current filters.
            </div>
          ) : (
            <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal-sm overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-brand-navy text-brand-paper border-b-2 border-brand-dark font-heading uppercase text-[11px]">
                  <tr>
                    <th className="p-3">Scholar</th>
                    <th className="p-3">Billing Cycle</th>
                    <th className="p-3">Renewal Due</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Method & Reference</th>
                    <th className="p-3">Payment Date</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-dark/15">
                  {filteredStudentRecords.map((rec) => {
                    const student = studentsMap.get(rec.student_id);
                    const enrollment = enrollmentsMap.get(rec.enrollment_id);
                    const program = enrollment ? programsMap.get(enrollment.program_id) : null;

                    return (
                      <tr key={rec.id} className="hover:bg-brand-paper-tint/60 transition-colors">
                        <td className="p-3 font-medium">
                          <div className="font-bold text-brand-navy">
                            {student?.full_name || 'Scholar'}
                          </div>
                          <div className="text-[10px] font-mono text-brand-muted">
                            {student?.poraplan_id || ''} • {program?.name || 'Program'}
                          </div>
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          {formatCalendarDate(rec.cycle_start_date)} – {formatCalendarDate(rec.cycle_end_date)}
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          {formatCalendarDate(rec.next_due_date)}
                        </td>
                        <td className="p-3">
                          {getStudentStatusBadge(rec.status)}
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          <div>{formatPaymentMethod(rec.payment_method)}</div>
                          <div className="text-brand-muted truncate max-w-[140px]" title={rec.transaction_reference || 'Not applicable'}>
                            {rec.transaction_reference || 'Not applicable'}
                          </div>
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          {rec.payment_date ? formatCalendarDate(rec.payment_date) : 'Pending'}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingStudentRecord(rec);
                                setIsEditStudentModalOpen(true);
                              }}
                              title="Update record status & details"
                              className="p-1 hover:bg-brand-navy/10 border border-brand-dark/20 text-brand-navy"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEventsModal('student', rec.id, `Payment Events: ${student?.full_name || 'Scholar'}`)}
                              title="Manage payment events & installments"
                              className="p-1 hover:bg-brand-navy/10 border border-brand-dark/20 text-brand-teal"
                            >
                              <Layers className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openNotesModal('student_payment', rec.id, `Private Notes: ${student?.full_name || 'Scholar'}`)}
                              title="Private admin notes"
                              className="p-1 hover:bg-brand-navy/10 border border-brand-dark/20 text-amber-600"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                            {enrollment && (
                              <button
                                type="button"
                                onClick={() => openBillingAnchorModal(enrollment)}
                                title="Manage enrollment billing anchor"
                                className="p-1 hover:bg-brand-navy/10 border border-brand-dark/20 text-brand-navy"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteStudentPayment(rec.id)}
                              title="Soft delete record"
                              className="p-1 hover:bg-red-500/10 border border-brand-dark/20 text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MENTOR PAYOUTS */}
      {activeTab === 'mentor_payouts' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-brand-muted" />
                <input
                  type="text"
                  placeholder="Search mentor, reference, or month..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs font-sans border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none"
                />
              </div>

              {/* Status Filter */}
              <select
                value={mentorStatusFilter}
                onChange={(e) => setMentorStatusFilter(e.target.value as 'all' | MentorPaymentStatus)}
                aria-label="Filter by mentor payout status"
                className="px-2.5 py-1.5 text-xs font-heading font-bold uppercase border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateMentorModalOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Record Mentor Payout
            </Button>
          </div>

          {/* Mentor Records Table */}
          {filteredMentorRecords.length === 0 ? (
            <div className="p-8 bg-brand-paper border-2 border-brand-dark shadow-brutal-sm text-center text-xs text-brand-muted">
              No mentor payout records match the current filters.
            </div>
          ) : (
            <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal-sm overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-brand-navy text-brand-paper border-b-2 border-brand-dark font-heading uppercase text-[11px]">
                  <tr>
                    <th className="p-3">Mentor</th>
                    <th className="p-3">Billing Month</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Method & Reference</th>
                    <th className="p-3">Payout Date</th>
                    <th className="p-3">Linked Scholar</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-dark/15">
                  {filteredMentorRecords.map((rec) => {
                    const mentor = mentorsMap.get(rec.mentor_id);
                    const relatedStudent = rec.related_student_id ? studentsMap.get(rec.related_student_id) : null;

                    return (
                      <tr key={rec.id} className="hover:bg-brand-paper-tint/60 transition-colors">
                        <td className="p-3 font-medium">
                          <div className="font-bold text-brand-navy">
                            {mentor?.full_name || 'Mentor'}
                          </div>
                          <div className="text-[10px] font-mono text-brand-muted">
                            {mentor?.poraplan_id || ''}
                          </div>
                        </td>
                        <td className="p-3 font-heading font-bold text-brand-navy">
                          {formatBillingMonth(rec.billing_month)}
                        </td>
                        <td className="p-3">
                          {getMentorStatusBadge(rec.status)}
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          <div>{formatPaymentMethod(rec.payment_method)}</div>
                          <div className="text-brand-muted truncate max-w-[140px]" title={rec.transaction_reference || 'Not applicable'}>
                            {rec.transaction_reference || 'Not applicable'}
                          </div>
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          {rec.payout_date ? formatCalendarDate(rec.payout_date.split('T')[0]) : 'Pending'}
                        </td>
                        <td className="p-3 font-sans text-[11px]">
                          {relatedStudent ? (
                            <span className="font-bold text-brand-navy">{relatedStudent.full_name}</span>
                          ) : (
                            <span className="text-brand-muted">Cohort Mentorship</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMentorRecord(rec);
                                setIsEditMentorModalOpen(true);
                              }}
                              title="Update payout details"
                              className="p-1 hover:bg-brand-navy/10 border border-brand-dark/20 text-brand-navy"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEventsModal('mentor', rec.id, `Payout Events: ${mentor?.full_name || 'Mentor'}`)}
                              title="Manage payout events"
                              className="p-1 hover:bg-brand-navy/10 border border-brand-dark/20 text-brand-teal"
                            >
                              <Layers className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openNotesModal('mentor_payment', rec.id, `Private Notes: ${mentor?.full_name || 'Mentor'}`)}
                              title="Private admin notes"
                              className="p-1 hover:bg-brand-navy/10 border border-brand-dark/20 text-amber-600"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMentorPayout(rec.id)}
                              title="Soft delete record"
                              className="p-1 hover:bg-red-500/10 border border-brand-dark/20 text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: AUDIT & NOTES */}
      {activeTab === 'audit_notes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-heading font-extrabold text-brand-navy uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-brand-teal" />
              Immutable Billing Date Adjustment Audit Logs
            </h3>
            <span className="text-xs font-mono text-brand-muted">Total Logs: {auditLogs.length}</span>
          </div>

          {auditLogs.length === 0 ? (
            <div className="p-8 bg-brand-paper border-2 border-brand-dark shadow-brutal-sm text-center text-xs text-brand-muted">
              No billing date overrides have been performed yet.
            </div>
          ) : (
            <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal-sm overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-brand-navy text-brand-paper border-b-2 border-brand-dark font-heading uppercase text-[11px]">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Enrollment</th>
                    <th className="p-3">Previous Date</th>
                    <th className="p-3">New Date</th>
                    <th className="p-3">Adjustment Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-dark/15">
                  {auditLogs.map((log) => {
                    const enrollment = enrollmentsMap.get(log.enrollment_id);
                    const student = enrollment ? studentsMap.get(enrollment.student_id) : null;
                    return (
                      <tr key={log.id} className="hover:bg-brand-paper-tint/60 transition-colors">
                        <td className="p-3 font-mono text-[11px]">
                          {log.created_at ? formatLocalDate(new Date(log.created_at)) : '—'}
                        </td>
                        <td className="p-3 font-medium">
                          {student ? `${student.full_name} (${student.poraplan_id || ''})` : log.enrollment_id.slice(0, 8)}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-red-700">
                          {formatCalendarDate(log.old_billing_start_date)}
                        </td>
                        <td className="p-3 font-mono text-[11px] font-bold text-teal-700">
                          {formatCalendarDate(log.new_billing_start_date)}
                        </td>
                        <td className="p-3 text-[11px]">
                          {log.reason}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE STUDENT PAYMENT RECORD                                     */}
      {/* ========================================================================= */}
      {isCreateStudentModalOpen && (
        <CreateStudentPaymentModal
          enrollments={enrollments}
          studentsMap={studentsMap}
          programsMap={programsMap}
          allKnownReferences={allKnownReferences}
          onClose={() => setIsCreateStudentModalOpen(false)}
          onSuccess={() => {
            setIsCreateStudentModalOpen(false);
            setActionSuccess('Student payment record created successfully.');
            loadDeskData();
            setTimeout(() => setActionSuccess(null), 3000);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT STUDENT PAYMENT RECORD                                       */}
      {/* ========================================================================= */}
      {isEditStudentModalOpen && editingStudentRecord && (
        <EditStudentPaymentModal
          record={editingStudentRecord}
          student={studentsMap.get(editingStudentRecord.student_id)}
          allKnownReferences={allKnownReferences}
          onClose={() => {
            setIsEditStudentModalOpen(false);
            setEditingStudentRecord(null);
          }}
          onSuccess={() => {
            setIsEditStudentModalOpen(false);
            setEditingStudentRecord(null);
            setActionSuccess('Student payment record updated successfully.');
            loadDeskData();
            setTimeout(() => setActionSuccess(null), 3000);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CREATE MENTOR PAYOUT RECORD                                       */}
      {/* ========================================================================= */}
      {isCreateMentorModalOpen && (
        <CreateMentorPayoutModal
          mentors={mentors}
          students={students}
          allKnownReferences={allKnownReferences}
          onClose={() => setIsCreateMentorModalOpen(false)}
          onSuccess={() => {
            setIsCreateMentorModalOpen(false);
            setActionSuccess('Mentor payout record created successfully.');
            loadDeskData();
            setTimeout(() => setActionSuccess(null), 3000);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: EDIT MENTOR PAYOUT RECORD                                         */}
      {/* ========================================================================= */}
      {isEditMentorModalOpen && editingMentorRecord && (
        <EditMentorPayoutModal
          record={editingMentorRecord}
          mentor={mentorsMap.get(editingMentorRecord.mentor_id)}
          allKnownReferences={allKnownReferences}
          onClose={() => {
            setIsEditMentorModalOpen(false);
            setEditingMentorRecord(null);
          }}
          onSuccess={() => {
            setIsEditMentorModalOpen(false);
            setEditingMentorRecord(null);
            setActionSuccess('Mentor payout record updated successfully.');
            loadDeskData();
            setTimeout(() => setActionSuccess(null), 3000);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: PAYMENT EVENTS & ACTIVITY                                         */}
      {/* ========================================================================= */}
      {isEventsModalOpen && activeEventRecord && (
        <PaymentEventsModal
          recordType={activeEventRecord.type}
          recordId={activeEventRecord.id}
          title={activeEventRecord.title}
          events={recordEvents}
          loading={eventsLoading}
          allKnownReferences={allKnownReferences}
          onClose={() => setIsEventsModalOpen(false)}
          onEventCreated={(evt) => {
            setRecordEvents((prev) => [evt, ...prev]);
            setActionSuccess('Payment event recorded.');
            setTimeout(() => setActionSuccess(null), 3000);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: PRIVATE ADMIN NOTES                                               */}
      {/* ========================================================================= */}
      {isNotesModalOpen && activeNoteTarget && (
        <div className="fixed inset-0 z-50 bg-brand-dark/70 flex items-center justify-center p-4">
          <div className="bg-brand-paper border-2 border-brand-dark shadow-brutal p-5 sm:p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
              <h3 className="font-heading font-extrabold text-brand-navy text-sm sm:text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-600" />
                {activeNoteTarget.title}
              </h3>
              <button type="button" onClick={() => setIsNotesModalOpen(false)} className="hover:opacity-75">
                <X className="w-5 h-5 text-brand-dark" />
              </button>
            </div>

            <div className="p-2 bg-amber-50 border border-amber-300 text-amber-900 text-xs font-sans">
              🔒 <strong>Strict Admin Privacy:</strong> These notes are restricted solely to administrators. Students and mentors can never view them.
            </div>

            {/* Existing Notes List */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {notesLoading ? (
                <div className="p-3 text-center text-xs text-brand-muted">Loading private notes...</div>
              ) : activeNotes.length === 0 ? (
                <div className="p-3 text-center text-xs text-brand-muted">No private admin notes recorded yet.</div>
              ) : (
                activeNotes.map((n) => (
                  <div key={n.id} className="p-2.5 bg-brand-bg border border-brand-dark/20 text-xs space-y-1">
                    <p className="font-sans text-brand-dark">{n.note}</p>
                    <span className="font-mono text-[10px] text-brand-muted block">
                      {n.created_at ? formatLocalDate(new Date(n.created_at)) : '—'}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Add Note Form */}
            <div className="space-y-2 pt-2 border-t border-brand-dark/20">
              <label className="text-xs font-heading font-bold uppercase text-brand-navy block">
                Add Private Internal Note:
              </label>
              <textarea
                rows={3}
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Enter internal administrative notes (reconciliation notes, special terms, etc.)..."
                className="w-full p-2.5 text-xs font-sans border-2 border-brand-dark bg-white focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsNotesModalOpen(false)}>
                  Close
                </Button>
                <Button variant="primary" size="sm" onClick={handleAddAdminNote} disabled={!newNoteText.trim()}>
                  Save Note
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: MANAGE STUDENT BILLING ANCHOR (START DATE OVERRIDE)               */}
      {/* ========================================================================= */}
      {isBillingAnchorModalOpen && activeAnchorEnrollment && (
        <div className="fixed inset-0 z-50 bg-brand-dark/70 flex items-center justify-center p-4">
          <div className="bg-brand-paper border-2 border-brand-dark shadow-brutal p-5 sm:p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
              <h3 className="font-heading font-extrabold text-brand-navy text-sm sm:text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-teal" />
                Manage Billing Start Anchor
              </h3>
              <button type="button" onClick={() => setIsBillingAnchorModalOpen(false)} className="hover:opacity-75">
                <X className="w-5 h-5 text-brand-dark" />
              </button>
            </div>

            <div className="space-y-2 text-xs font-sans">
              <div className="p-2 bg-brand-bg border border-brand-dark/20 space-y-1">
                <div>
                  <span className="text-brand-muted font-mono uppercase text-[10px]">Scholar: </span>
                  <strong>{studentsMap.get(activeAnchorEnrollment.student_id)?.full_name || 'Scholar'}</strong>
                </div>
                <div>
                  <span className="text-brand-muted font-mono uppercase text-[10px]">Enrolled At: </span>
                  <span className="font-mono">{formatCalendarDate(activeAnchorEnrollment.enrolled_at.split('T')[0])}</span>
                </div>
                <div>
                  <span className="text-brand-muted font-mono uppercase text-[10px]">Current Billing Start Date: </span>
                  <strong className="font-mono text-teal-700">
                    {activeAnchorEnrollment.billing_start_date
                      ? formatCalendarDate(activeAnchorEnrollment.billing_start_date)
                      : 'None'}
                  </strong>
                </div>
              </div>

              <div className="space-y-1 pt-2">
                <label className="font-heading font-bold text-brand-navy block uppercase text-[11px]">
                  New Effective Billing Start Date (YYYY-MM-DD):
                </label>
                <input
                  type="date"
                  value={newAnchorDate}
                  onChange={(e) => setNewAnchorDate(e.target.value)}
                  className="w-full p-2 text-xs font-mono border-2 border-brand-dark bg-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-heading font-bold text-brand-navy block uppercase text-[11px]">
                  Mandatory Audit Reason:
                </label>
                <textarea
                  rows={2}
                  value={anchorOverrideReason}
                  onChange={(e) => setAnchorOverrideReason(e.target.value)}
                  placeholder="e.g. Granted 1-month onboarding grace period or adjusted for late batch orientation..."
                  className="w-full p-2 text-xs font-sans border-2 border-brand-dark bg-white focus:outline-none"
                />
              </div>

              <div className="p-2 bg-blue-50 border border-blue-200 text-blue-900 text-[11px]">
                🛡️ <strong>Safety Guarantee:</strong> Changing the billing start date will anchor future cycle calculations. Historical payment records remain strictly preserved in the database.
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-brand-dark/20">
              <button
                type="button"
                onClick={() => {
                  setNewAnchorDate(activeAnchorEnrollment.enrolled_at.split('T')[0]);
                  setAnchorOverrideReason('Reset billing start date to original enrollment date.');
                }}
                className="text-[11px] font-heading font-bold text-brand-muted hover:text-brand-dark underline"
              >
                Reset to Enrolled Date
              </button>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsBillingAnchorModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleOverrideBillingAnchor}
                  disabled={isOverridingAnchor}
                >
                  {isOverridingAnchor ? 'Updating...' : 'Save & Audit'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==============================================================================
// SUB-COMPONENT: CREATE STUDENT PAYMENT MODAL
// ==============================================================================
interface CreateStudentModalProps {
  enrollments: ProgramEnrollmentWithMeta[];
  studentsMap: Map<string, Profile>;
  programsMap: Map<string, Program>;
  allKnownReferences: Map<string, { type: string; id: string; date: string }>;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateStudentPaymentModal: React.FC<CreateStudentModalProps> = ({
  enrollments,
  studentsMap,
  programsMap,
  allKnownReferences,
  onClose,
  onSuccess,
}) => {
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState(enrollments[0]?.id || '');
  const [cycleStartDate, setCycleStartDate] = useState(toBangladeshDateStr());
  const [cycleEndDate, setCycleEndDate] = useState(() => {
    const cycle = computeBillingPeriod(toBangladeshDateStr(), 1);
    return cycle.cycleEndDate;
  });
  const [nextDueDate, setNextDueDate] = useState(() => {
    const cycle = computeBillingPeriod(toBangladeshDateStr(), 1);
    return cycle.nextDueDate;
  });
  const [status, setStatus] = useState<StudentPaymentStatus>('pending');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [transactionRef, setTransactionRef] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [waivedReason, setWaivedReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-recalculate cycle end & due date when start date changes
  const handleStartDateChange = (newStart: string) => {
    setCycleStartDate(newStart);
    if (isValidCalendarDate(newStart)) {
      const cycle = computeBillingPeriod(newStart, 1);
      setCycleEndDate(cycle.cycleEndDate);
      setNextDueDate(cycle.nextDueDate);
    }
  };

  // Duplicate Reference Warning Check
  const duplicateWarning = useMemo(() => {
    if (!transactionRef.trim()) return null;
    return allKnownReferences.get(transactionRef.trim().toLowerCase()) || null;
  }, [transactionRef, allKnownReferences]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnrollmentId) {
      setError('Please select an active scholar enrollment.');
      return;
    }
    const enrollment = enrollments.find((en) => en.id === selectedEnrollmentId);
    if (!enrollment) {
      setError('Selected enrollment not found.');
      return;
    }

    if (status === 'waived' && !waivedReason.trim()) {
      setError('A waiver reason is required when status is set to Waived.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await createStudentPaymentRecord({
        enrollment_id: enrollment.id,
        student_id: enrollment.student_id,
        cycle_start_date: cycleStartDate,
        cycle_end_date: cycleEndDate,
        next_due_date: nextDueDate,
        status,
        payment_method: paymentMethod ? (paymentMethod as PaymentMethod) : null,
        transaction_reference: transactionRef.trim() || null,
        payment_date: paymentDate ? paymentDate : status === 'paid' ? toBangladeshDateStr() : null,
        waived_reason: status === 'waived' ? waivedReason.trim() : null,
      });

      if (res.error) throw res.error;
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record student payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-brand-dark/70 flex items-center justify-center p-4">
      <div className="bg-brand-paper border-2 border-brand-dark shadow-brutal p-5 sm:p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
          <h3 className="font-heading font-extrabold text-brand-navy text-sm sm:text-base flex items-center gap-2">
            <Plus className="w-4 h-4 text-brand-teal" />
            Record Student Payment Cycle
          </h3>
          <button type="button" onClick={onClose} className="hover:opacity-75">
            <X className="w-5 h-5 text-brand-dark" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-red-100 border border-red-400 text-red-900 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs font-sans">
          <div>
            <label className="font-heading font-bold text-brand-navy block uppercase text-[11px] mb-1">
              Select Scholar Enrollment:
            </label>
            <select
              value={selectedEnrollmentId}
              onChange={(e) => setSelectedEnrollmentId(e.target.value)}
              className="w-full p-2 border-2 border-brand-dark bg-white text-xs font-sans focus:outline-none"
            >
              {enrollments.map((en) => {
                const s = studentsMap.get(en.student_id);
                const p = programsMap.get(en.program_id);
                return (
                  <option key={en.id} value={en.id}>
                    {s?.full_name || 'Scholar'} ({s?.poraplan_id || ''}) — {p?.name || 'Program'}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-heading font-bold text-brand-navy block uppercase text-[11px] mb-1">
                Cycle Start Date:
              </label>
              <input
                type="date"
                required
                value={cycleStartDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full p-2 border-2 border-brand-dark bg-white font-mono text-xs focus:outline-none"
              />
            </div>
            <div>
              <label className="font-heading font-bold text-brand-navy block uppercase text-[11px] mb-1">
                Cycle End Date:
              </label>
              <input
                type="date"
                required
                value={cycleEndDate}
                onChange={(e) => setCycleEndDate(e.target.value)}
                className="w-full p-2 border-2 border-brand-dark bg-white font-mono text-xs focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-heading font-bold text-brand-navy block uppercase text-[11px] mb-1">
                Next Due Date:
              </label>
              <input
                type="date"
                required
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
                className="w-full p-2 border-2 border-brand-dark bg-white font-mono text-xs focus:outline-none"
              />
            </div>
            <div>
              <label className="font-heading font-bold text-brand-navy block uppercase text-[11px] mb-1">
                Payment Status:
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StudentPaymentStatus)}
                className="w-full p-2 border-2 border-brand-dark bg-white text-xs font-sans focus:outline-none"
              >
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="waived">Waived</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-heading font-bold text-brand-navy block uppercase text-[11px] mb-1">
                Payment Method:
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | '')}
                className="w-full p-2 border-2 border-brand-dark bg-white text-xs font-sans focus:outline-none"
              >
                <option value="">None / Not recorded</option>
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="upay">Upay</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>
            <div>
              <label className="font-heading font-bold text-brand-navy block uppercase text-[11px] mb-1">
                Payment Date:
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full p-2 border-2 border-brand-dark bg-white font-mono text-xs focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="font-heading font-bold text-brand-navy block uppercase text-[11px] mb-1">
              Transaction Reference:
            </label>
            <input
              type="text"
              placeholder="e.g. TRX101928"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              className="w-full p-2 border-2 border-brand-dark bg-white font-mono text-xs focus:outline-none"
            />
            {duplicateWarning && (
              <div className="mt-1 p-2 bg-amber-50 border border-amber-300 text-amber-900 text-[11px] flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Duplicate Warning:</strong> Reference matches existing {duplicateWarning.type} recorded on {duplicateWarning.date}. Please verify to prevent duplicate ledger entries.
                </span>
              </div>
            )}
          </div>

          {status === 'waived' && (
            <div>
              <label className="font-heading font-bold text-brand-navy block uppercase text-[11px] mb-1">
                Waived Reason (Mandatory):
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Merit scholarship waiver or foundation aid"
                value={waivedReason}
                onChange={(e) => setWaivedReason(e.target.value)}
                className="w-full p-2 border-2 border-brand-dark bg-white text-xs focus:outline-none"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-brand-dark/20">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Recording...' : 'Record Payment Cycle'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==============================================================================
// SUB-COMPONENT: EDIT STUDENT PAYMENT MODAL
// ==============================================================================
interface EditStudentModalProps {
  record: StudentPaymentRecord;
  student?: Profile;
  allKnownReferences: Map<string, { type: string; id: string; date: string }>;
  onClose: () => void;
  onSuccess: () => void;
}

const EditStudentPaymentModal: React.FC<EditStudentModalProps> = ({
  record,
  student,
  allKnownReferences,
  onClose,
  onSuccess,
}) => {
  const [status, setStatus] = useState<StudentPaymentStatus>(record.status);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>(record.payment_method || '');
  const [transactionRef, setTransactionRef] = useState(record.transaction_reference || '');
  const [paymentDate, setPaymentDate] = useState(record.payment_date || '');
  const [nextDueDate, setNextDueDate] = useState(record.next_due_date || '');
  const [waivedReason, setWaivedReason] = useState(record.waived_reason || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Duplicate Reference Warning Check (skip self)
  const duplicateWarning = useMemo(() => {
    if (!transactionRef.trim()) return null;
    const match = allKnownReferences.get(transactionRef.trim().toLowerCase());
    if (match && match.id !== record.id) return match;
    return null;
  }, [transactionRef, allKnownReferences, record.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'waived' && !waivedReason.trim()) {
      setError('A waiver reason is required when status is set to Waived.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await updateStudentPaymentRecord(record.id, {
        status,
        payment_method: paymentMethod ? (paymentMethod as PaymentMethod) : null,
        transaction_reference: transactionRef.trim() || null,
        payment_date: paymentDate || null,
        next_due_date: nextDueDate,
        waived_reason: status === 'waived' ? waivedReason.trim() : null,
      });

      if (res.error) throw res.error;
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update payment record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-brand-dark/70 flex items-center justify-center p-4">
      <div className="bg-brand-paper border-2 border-brand-dark shadow-brutal p-5 sm:p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
          <h3 className="font-heading font-extrabold text-brand-navy text-sm sm:text-base flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-brand-teal" />
            Update Student Payment Record
          </h3>
          <button type="button" onClick={onClose} className="hover:opacity-75">
            <X className="w-5 h-5 text-brand-dark" />
          </button>
        </div>

        <div className="p-2 bg-brand-bg border border-brand-dark/20 text-xs">
          <strong>Scholar: </strong>{student?.full_name || 'Scholar'} ({student?.poraplan_id || ''}) •
          Cycle: {formatCalendarDate(record.cycle_start_date)} – {formatCalendarDate(record.cycle_end_date)}
        </div>

        {error && (
          <div className="p-2.5 bg-red-100 border border-red-400 text-red-900 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs font-sans">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-heading font-bold text-brand-navy block uppercase text-[11px] mb-1">
                Status:
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StudentPaymentStatus)}
                className="w-full p-2 border-2 border-brand-dark bg-white text-xs font-sans focus:outline-none"
              >
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="waived">Waived</option>
              </select>
            </div>
            <div>
              <label className="font-heading font-bold text-brand-navy block uppercase text-[11px] mb-1">
                Next Due Date:
              </label>
              <input
                type="date"
                required
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
                className="w-full p-2 border-2 border-brand-dark bg-white font-mono text-xs focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-heading font-bold text-brand-navy block uppercase text-[11px] mb-1">
                Payment Method:
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | '')}
                className="w-full p-2 border-2 border-brand-dark bg-white text-xs font-sans focus:outline-none"
              >
                <option value="">None / Not recorded</option>
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="upay">Upay</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>
            <div>
              <label className="font-heading font-bold text-brand-navy block uppercase text-[11px] mb-1">
                Payment Date:
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full p-2 border-2 border-brand-dark bg-white font-mono text-xs focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="font-heading font-bold text-brand-navy block uppercase text-[11px] mb-1">
              Transaction Reference:
            </label>
            <input
              type="text"
              placeholder="e.g. TRX101928"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              className="w-full p-2 border-2 border-brand-dark bg-white font-mono text-xs focus:outline-none"
            />
            {duplicateWarning && (
              <div className="mt-1 p-2 bg-amber-50 border border-amber-300 text-amber-900 text-[11px] flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Duplicate Warning:</strong> Reference matches existing {duplicateWarning.type} recorded on {duplicateWarning.date}. Please verify to prevent duplicate entries.
                </span>
              </div>
            )}
          </div>

          {status === 'waived' && (
            <div>
              <label className="font-heading font-bold text-brand-navy block uppercase text-[11px] mb-1">
                Waived Reason (Mandatory):
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Special scholarship waiver or family hardship"
                value={waivedReason}
                onChange={(e) => setWaivedReason(e.target.value)}
                className="w-full p-2 border-2 border-brand-dark bg-white text-xs focus:outline-none"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-brand-dark/20">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Updates'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==============================================================================
// SUB-COMPONENT: CREATE MENTOR PAYOUT MODAL
// ==============================================================================
interface CreateMentorModalProps {
  mentors: Profile[];
  students: Profile[];
  allKnownReferences: Map<string, { type: string; id: string; date: string }>;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateMentorPayoutModal: React.FC<CreateMentorModalProps> = ({
  mentors,
  students,
  allKnownReferences,
  onClose,
  onSuccess,
}) => {
  const [selectedMentorId, setSelectedMentorId] = useState(mentors[0]?.id || '');
  const [relatedStudentId, setRelatedStudentId] = useState<string>('');
  const [billingMonth, setBillingMonth] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  const [status, setStatus] = useState<MentorPaymentStatus>('pending');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [transactionRef, setTransactionRef] = useState('');
  const [payoutDate, setPayoutDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Duplicate Reference Warning Check
  const duplicateWarning = useMemo(() => {
    if (!transactionRef.trim()) return null;
    return allKnownReferences.get(transactionRef.trim().toLowerCase()) || null;
  }, [transactionRef, allKnownReferences]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMentorId) {
      setError('Please select a mentor.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await createMentorPaymentRecord({
        mentor_id: selectedMentorId,
        related_student_id: relatedStudentId || null,
        billing_month: billingMonth,
        status,
        payment_method: paymentMethod ? (paymentMethod as PaymentMethod) : null,
        transaction_reference: transactionRef.trim() || null,
        payout_date: payoutDate ? payoutDate : status === 'paid' ? toBangladeshDateStr() : null,
      });

      if (res.error) throw res.error;
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record mentor payout.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-brand-dark/70 flex items-center justify-center p-4">
      <div className="bg-brand-paper border-2 border-brand-dark shadow-brutal p-5 sm:p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
          <h3 className="font-heading font-extrabold text-brand-navy text-sm sm:text-base flex items-center gap-2">
            <Plus className="w-4 h-4 text-brand-teal" />
            Record Mentor Payout
          </h3>
          <button type="button" onClick={onClose} className="hover:opacity-75">
            <X className="w-5 h-5 text-brand-dark" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-red-100 border border-red-400 text-red-900 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs font-sans">
          <div>
            <label className="font-heading font-bold text-brand-navy block uppercase text-[11px] mb-1">
              Select Mentor:
            </label>
            <select
              value={selectedMentorId}
              onChange={(e) => setSelectedMentorId(e.target.value)}
              className="w-full p-2 border-2 border-brand-dark bg-white text-xs font-sans focus:outline-none"
            >
              {mentors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name || 'Mentor'} ({m.poraplan_id || ''})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-heading font-bold text-brand-navy block uppercase text-[11px] mb-1">
                Billing Month (YYYY-MM):
              </label>
              <input
                type="text"
                required
                placeholder="2026-11"
                value={billingMonth}
                onChange={(e) => setBillingMonth(e.target.value)}
                className="w-full p-2 border-2 border-brand-dark bg-white font-mono text-xs focus:outline-none"
              />
            </div>
            <div>
              <label className="font-heading font-bold text-brand-navy block uppercase text-[11px] mb-1">
                Payout Status:
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MentorPaymentStatus)}
                className="w-full p-2 border-2 border-brand-dark bg-white text-xs font-sans focus:outline-none"
              >
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-heading font-bold text-brand-navy block uppercase text-[11px] mb-1">
                Payment Method:
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | '')}
                className="w-full p-2 border-2 border-brand-dark bg-white text-xs font-sans focus:outline-none"
              >
                <option value="">None / Not recorded</option>
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="upay">Upay</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>
            <div>
              <label className="font-heading font-bold text-brand-navy block uppercase text-[11px] mb-1">
                Payout Date:
              </label>
              <input
                type="date"
                value={payoutDate}
                onChange={(e) => setPayoutDate(e.target.value)}
                className="w-full p-2 border-2 border-brand-dark bg-white font-mono text-xs focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="font-heading font-bold text-brand-navy block uppercase text-[11px] mb-1">
              Transaction Reference:
            </label>
            <input
              type="text"
              placeholder="e.g. MPR-EBL-1026"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              className="w-full p-2 border-2 border-brand-dark bg-white font-mono text-xs focus:outline-none"
            />
            {duplicateWarning && (
              <div className="mt-1 p-2 bg-amber-50 border border-amber-300 text-amber-900 text-[11px] flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Duplicate Warning:</strong> Reference matches existing {duplicateWarning.type} recorded on {duplicateWarning.date}.
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="font-heading font-bold text-brand-navy block uppercase text-[11px] mb-1">
              Linked Scholar Context (Optional):
            </label>
            <select
              value={relatedStudentId}
              onChange={(e) => setRelatedStudentId(e.target.value)}
              className="w-full p-2 border-2 border-brand-dark bg-white text-xs font-sans focus:outline-none"
            >
              <option value="">General Cohort Mentorship (None)</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.poraplan_id || ''})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-brand-dark/20">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Recording...' : 'Record Mentor Payout'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==============================================================================
// SUB-COMPONENT: EDIT MENTOR PAYOUT MODAL
// ==============================================================================
interface EditMentorModalProps {
  record: MentorPaymentRecord;
  mentor?: Profile;
  allKnownReferences: Map<string, { type: string; id: string; date: string }>;
  onClose: () => void;
  onSuccess: () => void;
}

const EditMentorPayoutModal: React.FC<EditMentorModalProps> = ({
  record,
  mentor,
  allKnownReferences,
  onClose,
  onSuccess,
}) => {
  const [status, setStatus] = useState<MentorPaymentStatus>(record.status);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>(record.payment_method || '');
  const [transactionRef, setTransactionRef] = useState(record.transaction_reference || '');
  const [payoutDate, setPayoutDate] = useState(record.payout_date || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Duplicate Reference Warning Check (skip self)
  const duplicateWarning = useMemo(() => {
    if (!transactionRef.trim()) return null;
    const match = allKnownReferences.get(transactionRef.trim().toLowerCase());
    if (match && match.id !== record.id) return match;
    return null;
  }, [transactionRef, allKnownReferences, record.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await updateMentorPaymentRecord(record.id, {
        status,
        payment_method: paymentMethod ? (paymentMethod as PaymentMethod) : null,
        transaction_reference: transactionRef.trim() || null,
        payout_date: payoutDate || null,
      });

      if (res.error) throw res.error;
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update payout record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-brand-dark/70 flex items-center justify-center p-4">
      <div className="bg-brand-paper border-2 border-brand-dark shadow-brutal p-5 sm:p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
          <h3 className="font-heading font-extrabold text-brand-navy text-sm sm:text-base flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-brand-teal" />
            Update Mentor Payout Record
          </h3>
          <button type="button" onClick={onClose} className="hover:opacity-75">
            <X className="w-5 h-5 text-brand-dark" />
          </button>
        </div>

        <div className="p-2 bg-brand-bg border border-brand-dark/20 text-xs">
          <strong>Mentor: </strong>{mentor?.full_name || 'Mentor'} ({mentor?.poraplan_id || ''}) •
          Month: {formatBillingMonth(record.billing_month)}
        </div>

        {error && (
          <div className="p-2.5 bg-red-100 border border-red-400 text-red-900 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs font-sans">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-heading font-bold text-brand-navy block uppercase text-[11px] mb-1">
                Status:
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MentorPaymentStatus)}
                className="w-full p-2 border-2 border-brand-dark bg-white text-xs font-sans focus:outline-none"
              >
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div>
              <label className="font-heading font-bold text-brand-navy block uppercase text-[11px] mb-1">
                Payout Date:
              </label>
              <input
                type="date"
                value={payoutDate}
                onChange={(e) => setPayoutDate(e.target.value)}
                className="w-full p-2 border-2 border-brand-dark bg-white font-mono text-xs focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-heading font-bold text-brand-navy block uppercase text-[11px] mb-1">
                Payment Method:
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | '')}
                className="w-full p-2 border-2 border-brand-dark bg-white text-xs font-sans focus:outline-none"
              >
                <option value="">None / Not recorded</option>
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="upay">Upay</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>
            <div>
              <label className="font-heading font-bold text-brand-navy block uppercase text-[11px] mb-1">
                Transaction Reference:
              </label>
              <input
                type="text"
                placeholder="e.g. MPR-EBL-1026"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                className="w-full p-2 border-2 border-brand-dark bg-white font-mono text-xs focus:outline-none"
              />
            </div>
          </div>

          {duplicateWarning && (
            <div className="mt-1 p-2 bg-amber-50 border border-amber-300 text-amber-900 text-[11px] flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Duplicate Warning:</strong> Reference matches existing {duplicateWarning.type} recorded on {duplicateWarning.date}.
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-brand-dark/20">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Updates'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==============================================================================
// SUB-COMPONENT: PAYMENT EVENTS MODAL
// ==============================================================================
interface PaymentEventsModalProps {
  recordType: 'student' | 'mentor';
  recordId: string;
  title: string;
  events: PaymentEvent[];
  loading: boolean;
  allKnownReferences: Map<string, { type: string; id: string; date: string }>;
  onClose: () => void;
  onEventCreated: (evt: PaymentEvent) => void;
}

const PaymentEventsModal: React.FC<PaymentEventsModalProps> = ({
  recordType,
  recordId,
  title,
  events,
  loading,
  allKnownReferences,
  onClose,
  onEventCreated,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('bkash');
  const [ref, setRef] = useState('');
  const [date, setDate] = useState(toBangladeshDateStr());
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const duplicateWarning = useMemo(() => {
    if (!ref.trim()) return null;
    return allKnownReferences.get(ref.trim().toLowerCase()) || null;
  }, [ref, allKnownReferences]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await createPaymentEvent({
        record_type: recordType,
        student_payment_id: recordType === 'student' ? recordId : null,
        mentor_payment_id: recordType === 'mentor' ? recordId : null,
        payment_method: method,
        transaction_reference: ref.trim() || null,
        payment_date: date,
        note: note.trim() || null,
      });

      if (res.error) throw res.error;
      if (res.event) {
        onEventCreated(res.event);
        setIsAdding(false);
        setRef('');
        setNote('');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record event.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-brand-dark/70 flex items-center justify-center p-4">
      <div className="bg-brand-paper border-2 border-brand-dark shadow-brutal p-5 sm:p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
          <h3 className="font-heading font-extrabold text-brand-navy text-sm sm:text-base flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-teal" />
            {title}
          </h3>
          <button type="button" onClick={onClose} className="hover:opacity-75">
            <X className="w-5 h-5 text-brand-dark" />
          </button>
        </div>

        {/* Existing Events List */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-heading font-bold text-brand-muted uppercase">
              Recorded Events ({events.length})
            </span>
            {!isAdding && (
              <Button variant="outline" size="sm" onClick={() => setIsAdding(true)} leftIcon={<Plus className="w-3 h-3" />}>
                Add Event
              </Button>
            )}
          </div>

          {loading ? (
            <div className="p-4 text-center text-xs text-brand-muted">Loading events...</div>
          ) : events.length === 0 ? (
            <div className="p-4 bg-brand-bg border border-brand-dark/20 text-center text-xs text-brand-muted">
              No child payment events recorded for this record yet.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {events.map((evt) => (
                <div key={evt.id} className="p-2.5 bg-brand-bg border border-brand-dark/20 text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-heading font-bold text-brand-navy">{formatPaymentMethod(evt.payment_method)}</span>
                    <span className="font-mono text-[11px] text-brand-muted">{formatCalendarDate(evt.payment_date.split('T')[0])}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] font-mono">
                    <span className="text-brand-muted">Ref: {evt.transaction_reference || 'None'}</span>
                  </div>
                  {evt.note && (
                    <div className="p-1 bg-white border border-brand-dark/10 text-[11px] font-sans text-brand-dark">
                      <strong>Admin Note: </strong>{evt.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Event Form */}
        {isAdding && (
          <form onSubmit={handleCreateEvent} className="p-3 bg-brand-bg border border-brand-dark/30 space-y-2.5 text-xs">
            <h4 className="font-heading font-bold text-brand-navy uppercase text-[11px]">
              Record New Installment / Activity Event
            </h4>

            {error && (
              <div className="p-2 bg-red-100 border border-red-300 text-red-900 text-xs">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-mono text-[10px] uppercase text-brand-muted block">Method:</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  className="w-full p-1.5 border border-brand-dark bg-white text-xs"
                >
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="upay">Upay</option>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                </select>
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase text-brand-muted block">Date:</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-1.5 border border-brand-dark bg-white font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase text-brand-muted block">Transaction Ref:</label>
              <input
                type="text"
                placeholder="e.g. TRX991823"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                className="w-full p-1.5 border border-brand-dark bg-white font-mono text-xs"
              />
              {duplicateWarning && (
                <div className="mt-1 p-1.5 bg-amber-50 border border-amber-300 text-amber-900 text-[10px]">
                  ⚠️ Matches existing {duplicateWarning.type} on {duplicateWarning.date}.
                </div>
              )}
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase text-brand-muted block">Internal Note (Admin only):</label>
              <input
                type="text"
                placeholder="e.g. Received partial advance via bKash"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full p-1.5 border border-brand-dark bg-white text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Event'}
              </Button>
            </div>
          </form>
        )}

        <div className="flex justify-end pt-2 border-t border-brand-dark/20">
          <Button variant="outline" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};
