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
  isUpcomingReminderDue,
  isCycleOverdue,
  getDaysInMonth,
  parseCalendarDate,
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
  Calendar as CalendarIcon,
  User,
  Plus,
  Edit2,
  Trash2,
  History,
  Search,
  X,
  GraduationCap,
  Check,
  ChevronRight,
  ChevronLeft,
  Eye,
  ShieldCheck,
  ArrowRight,
  Lock,
  Hash,
} from 'lucide-react';

// ==============================================================================
// HELPER FORMATTERS
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
      return <Badge variant="teal" size="sm" className="gap-1 font-bold"><CheckCircle2 className="w-3 h-3" />Paid</Badge>;
    case 'pending':
      return <Badge variant="gold" size="sm" className="gap-1 font-bold"><Clock className="w-3 h-3" />Pending</Badge>;
    case 'partial':
      return <Badge variant="paper" size="sm" className="gap-1 font-bold"><Layers className="w-3 h-3" />Partial</Badge>;
    case 'overdue':
      return <Badge variant="danger" size="sm" className="gap-1 font-bold"><AlertTriangle className="w-3 h-3" />Overdue</Badge>;
    case 'waived':
      return <Badge variant="muted" size="sm" className="gap-1 font-bold"><Check className="w-3 h-3" />Waived</Badge>;
    default:
      return <Badge variant="paper" size="sm">{status}</Badge>;
  }
}

function getMentorStatusBadge(status: MentorPaymentStatus) {
  switch (status) {
    case 'paid':
      return <Badge variant="teal" size="sm" className="gap-1 font-bold"><CheckCircle2 className="w-3 h-3" />Paid</Badge>;
    case 'pending':
      return <Badge variant="gold" size="sm" className="gap-1 font-bold"><Clock className="w-3 h-3" />Pending</Badge>;
    case 'partial':
      return <Badge variant="paper" size="sm" className="gap-1 font-bold"><Layers className="w-3 h-3" />Partial</Badge>;
    default:
      return <Badge variant="paper" size="sm">{status}</Badge>;
  }
}

type DeskTab = 'overview' | 'student_payments' | 'mentor_payouts' | 'calendar' | 'audit_notes';

// ==============================================================================
// MAIN COMPONENT: ADMIN BILLING OPERATIONS DESK
// ==============================================================================

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
  const [studentProgramFilter, setStudentProgramFilter] = useState<string>('all');
  const [studentDueFilter, setStudentDueFilter] = useState<'all' | 'overdue' | 'reminder_due' | 'due_this_month'>('all');
  const [studentMethodFilter, setStudentMethodFilter] = useState<string>('all');

  const [mentorSearchQuery, setMentorSearchQuery] = useState('');
  const [mentorStatusFilter, setMentorStatusFilter] = useState<'all' | MentorPaymentStatus>('all');
  const [mentorMethodFilter, setMentorMethodFilter] = useState<string>('all');

  // Activity Log Filter
  const [activityTypeFilter, setActivityTypeFilter] = useState<'all' | 'overrides' | 'waivers'>('all');

  // Dedicated Record Details Drawers State
  const [selectedStudentRecordForDrawer, setSelectedStudentRecordForDrawer] = useState<StudentPaymentRecord | null>(null);
  const [selectedMentorRecordForDrawer, setSelectedMentorRecordForDrawer] = useState<MentorPaymentRecord | null>(null);

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

  // Calendar View State
  const todayBD = useMemo(() => toBangladeshDateStr(), []);
  const [calendarYear, setCalendarYear] = useState(() => parseCalendarDate(todayBD).year);
  const [calendarMonth, setCalendarMonth] = useState(() => parseCalendarDate(todayBD).month);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(todayBD);

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

      // If drawer is open, keep drawer record synced
      if (selectedStudentRecordForDrawer) {
        const updated = studentRecsRes.records.find((r) => r.id === selectedStudentRecordForDrawer.id);
        if (updated) setSelectedStudentRecordForDrawer(updated);
      }
      if (selectedMentorRecordForDrawer) {
        const updated = mentorRecsRes.records.find((r) => r.id === selectedMentorRecordForDrawer.id);
        if (updated) setSelectedMentorRecordForDrawer(updated);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load billing operations data.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, selectedStudentRecordForDrawer, selectedMentorRecordForDrawer]);

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
          date: r.payment_date ? formatCalendarDate(r.payment_date) : formatCalendarDate(r.cycle_start_date),
        });
      }
    });
    mentorRecords.forEach((r) => {
      if (r.transaction_reference && r.transaction_reference.trim()) {
        map.set(r.transaction_reference.trim().toLowerCase(), {
          type: 'Mentor Payout',
          id: r.id,
          date: r.payout_date ? formatCalendarDate(r.payout_date) : formatBillingMonth(r.billing_month),
        });
      }
    });
    return map;
  }, [studentRecords, mentorRecords]);

  // Duplicate Reference Count Map
  const duplicateReferenceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    studentRecords.forEach((r) => {
      if (r.transaction_reference && r.transaction_reference.trim()) {
        const key = r.transaction_reference.trim().toUpperCase();
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });
    mentorRecords.forEach((r) => {
      if (r.transaction_reference && r.transaction_reference.trim()) {
        const key = r.transaction_reference.trim().toUpperCase();
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });
    return counts;
  }, [studentRecords, mentorRecords]);

  const duplicateReferencesList = useMemo(() => {
    const duplicates: { ref: string; count: number }[] = [];
    duplicateReferenceCounts.forEach((count, ref) => {
      if (count > 1) {
        duplicates.push({ ref, count });
      }
    });
    return duplicates;
  }, [duplicateReferenceCounts]);

  // Metrics Calculation
  const metrics = useMemo(() => {
    const today = toBangladeshDateStr();

    let studentPending = 0;
    let studentPaid = 0;
    let studentOverdue = 0;
    let studentWaived = 0;
    let studentPartial = 0;

    studentRecords.forEach((r) => {
      if (r.status === 'paid') studentPaid++;
      else if (r.status === 'pending') studentPending++;
      else if (r.status === 'overdue') studentOverdue++;
      else if (r.status === 'waived') studentWaived++;
      else if (r.status === 'partial') studentPartial++;
    });

    let mentorPending = 0;
    let mentorPaid = 0;
    let mentorPartial = 0;

    mentorRecords.forEach((r) => {
      if (r.status === 'paid') mentorPaid++;
      else if (r.status === 'pending') mentorPending++;
      else if (r.status === 'partial') mentorPartial++;
    });

    const activeEnrollments = enrollments.filter((e) => e.status === 'active');

    // Upcoming renewals within 14 days
    const upcomingRenewals: {
      enrollment: ProgramEnrollmentWithMeta;
      student: Profile | null;
      program: Program | null;
      cycleStartDate: string;
      cycleEndDate: string;
      nextDueDate: string;
      daysUntilDue: number;
      isReminderDue: boolean;
    }[] = [];

    activeEnrollments.forEach((e) => {
      const anchorDate = e.billing_start_date || (e.enrolled_at ? e.enrolled_at.substring(0, 10) : today);
      const activePeriod = findCycleForReferenceDate(anchorDate, today);
      const daysUntilDue = diffInDays(today, activePeriod.nextDueDate);

      if (daysUntilDue >= 0 && daysUntilDue <= 14) {
        upcomingRenewals.push({
          enrollment: e,
          student: studentsMap.get(e.student_id) || null,
          program: programsMap.get(e.program_id) || null,
          cycleStartDate: activePeriod.cycleStartDate,
          cycleEndDate: activePeriod.cycleEndDate,
          nextDueDate: activePeriod.nextDueDate,
          daysUntilDue,
          isReminderDue: isUpcomingReminderDue(activePeriod.nextDueDate, today),
        });
      }
    });

    upcomingRenewals.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

    const needsAttentionCount = studentOverdue + studentPending + duplicateReferencesList.length;

    return {
      studentPending,
      studentPaid,
      studentOverdue,
      studentWaived,
      studentPartial,
      mentorPending,
      mentorPaid,
      mentorPartial,
      totalStudentRecords: studentRecords.length,
      totalMentorRecords: mentorRecords.length,
      activeEnrollmentsCount: activeEnrollments.length,
      upcomingRenewals,
      needsAttentionCount,
    };
  }, [studentRecords, mentorRecords, enrollments, studentsMap, programsMap, duplicateReferencesList]);

  // Filtered Student Records
  const filteredStudentRecords = useMemo(() => {
    const today = toBangladeshDateStr();

    return studentRecords.filter((r) => {
      const student = studentsMap.get(r.student_id);
      const enrollment = enrollmentsMap.get(r.enrollment_id);

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = student?.full_name?.toLowerCase().includes(q);
        const emailMatch = student?.email?.toLowerCase().includes(q);
        const idMatch = student?.poraplan_id?.toLowerCase().includes(q);
        const refMatch = r.transaction_reference?.toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !idMatch && !refMatch) return false;
      }

      // Status filter
      if (studentStatusFilter !== 'all' && r.status !== studentStatusFilter) {
        return false;
      }

      // Program filter
      if (studentProgramFilter !== 'all' && enrollment?.program_id !== studentProgramFilter) {
        return false;
      }

      // Payment Method filter
      if (studentMethodFilter !== 'all' && r.payment_method !== studentMethodFilter) {
        return false;
      }

      // Due date filter
      if (studentDueFilter === 'overdue') {
        if (!isCycleOverdue(r.next_due_date, today)) return false;
      } else if (studentDueFilter === 'reminder_due') {
        if (!isUpcomingReminderDue(r.next_due_date, today)) return false;
      } else if (studentDueFilter === 'due_this_month') {
        const currentYearMonth = today.substring(0, 7);
        if (!r.next_due_date.startsWith(currentYearMonth)) return false;
      }

      return true;
    });
  }, [studentRecords, searchQuery, studentStatusFilter, studentProgramFilter, studentMethodFilter, studentDueFilter, studentsMap, enrollmentsMap]);

  // Filtered Mentor Records
  const filteredMentorRecords = useMemo(() => {
    return mentorRecords.filter((r) => {
      const mentor = mentorsMap.get(r.mentor_id);

      // Search query
      if (mentorSearchQuery.trim()) {
        const q = mentorSearchQuery.toLowerCase();
        const nameMatch = mentor?.full_name?.toLowerCase().includes(q);
        const emailMatch = mentor?.email?.toLowerCase().includes(q);
        const refMatch = r.transaction_reference?.toLowerCase().includes(q);
        const monthMatch = r.billing_month.toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !refMatch && !monthMatch) return false;
      }

      // Status filter
      if (mentorStatusFilter !== 'all' && r.status !== mentorStatusFilter) {
        return false;
      }

      // Method filter
      if (mentorMethodFilter !== 'all' && r.payment_method !== mentorMethodFilter) {
        return false;
      }

      return true;
    });
  }, [mentorRecords, mentorSearchQuery, mentorStatusFilter, mentorMethodFilter, mentorsMap]);

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
    try {
      const res = await getPaymentAdminNotes(recordType, id);
      setActiveNotes(res.notes);
    } catch {
      setActiveNotes([]);
    } finally {
      setNotesLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
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
      alert(err instanceof Error ? err.message : 'Failed to save note.');
    }
  };

  // Billing Anchor Modal Handlers
  const openBillingAnchorModal = (enrollment: ProgramEnrollmentWithMeta) => {
    setActiveAnchorEnrollment(enrollment);
    setNewAnchorDate(enrollment.billing_start_date || (enrollment.enrolled_at ? enrollment.enrolled_at.substring(0, 10) : toBangladeshDateStr()));
    setAnchorOverrideReason('');
    setIsBillingAnchorModalOpen(true);
  };

  const handleSaveBillingAnchor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAnchorEnrollment) return;
    if (!isValidCalendarDate(newAnchorDate)) {
      alert('Please enter a valid date in YYYY-MM-DD format.');
      return;
    }
    if (!anchorOverrideReason.trim()) {
      alert('A detailed operational reason is required to adjust billing start date.');
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

      setActionSuccess('Billing start date updated and audit log recorded.');
      setIsBillingAnchorModalOpen(false);
      loadDeskData();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to override billing start date.');
    } finally {
      setIsOverridingAnchor(false);
    }
  };

  // Soft-Delete Handlers
  const handleSoftDeleteStudent = async (id: string) => {
    if (!confirm('Are you sure you want to soft-delete this student payment record? It will be removed from all active student views and desk summaries.')) {
      return;
    }
    try {
      const res = await softDeleteStudentPaymentRecord(id);
      if (res.error) throw res.error;
      setActionSuccess('Student payment record soft-deleted successfully.');
      if (selectedStudentRecordForDrawer?.id === id) {
        setSelectedStudentRecordForDrawer(null);
      }
      loadDeskData();
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete record.');
    }
  };

  const handleSoftDeleteMentor = async (id: string) => {
    if (!confirm('Are you sure you want to soft-delete this mentor payout record? It will be removed from active payout summaries.')) {
      return;
    }
    try {
      const res = await softDeleteMentorPaymentRecord(id);
      if (res.error) throw res.error;
      setActionSuccess('Mentor payout record soft-deleted successfully.');
      if (selectedMentorRecordForDrawer?.id === id) {
        setSelectedMentorRecordForDrawer(null);
      }
      loadDeskData();
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete record.');
    }
  };

  // Calendar Helpers
  const daysInMonth = useMemo(() => {
    return getDaysInMonth(calendarYear, calendarMonth);
  }, [calendarYear, calendarMonth]);

  const monthFirstDayWeekday = useMemo(() => {
    // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const d = new Date(Date.UTC(calendarYear, calendarMonth - 1, 1));
    return d.getUTCDay();
  }, [calendarYear, calendarMonth]);

  const calendarEventsByDay = useMemo(() => {
    const map = new Map<string, { renewals: ProgramEnrollmentWithMeta[]; records: StudentPaymentRecord[] }>();
    const monthPrefix = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}`;

    // Map existing student payment records
    studentRecords.forEach((rec) => {
      if (rec.next_due_date.startsWith(monthPrefix)) {
        const list = map.get(rec.next_due_date) || { renewals: [], records: [] };
        list.records.push(rec);
        map.set(rec.next_due_date, list);
      }
    });

    // Map scheduled renewals for active enrollments
    enrollments.filter((e) => e.status === 'active').forEach((enr) => {
      const anchor = enr.billing_start_date || (enr.enrolled_at ? enr.enrolled_at.substring(0, 10) : todayBD);
      // Scan cycles in current calendar window
      for (let k = 0; k < 24; k++) {
        const period = computeBillingPeriod(anchor, k);
        if (period.nextDueDate.startsWith(monthPrefix)) {
          const list = map.get(period.nextDueDate) || { renewals: [], records: [] };
          if (!list.renewals.some((r) => r.id === enr.id)) {
            list.renewals.push(enr);
          }
          map.set(period.nextDueDate, list);
        }
      }
    });

    return map;
  }, [calendarYear, calendarMonth, studentRecords, enrollments, todayBD]);

  const calendarMonthLabel = useMemo(() => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[calendarMonth - 1]} ${calendarYear}`;
  }, [calendarYear, calendarMonth]);

  const handlePrevMonth = () => {
    if (calendarMonth === 1) {
      setCalendarMonth(12);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 12) {
      setCalendarMonth(1);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  const handleTodayCalendar = () => {
    const { year, month } = parseCalendarDate(todayBD);
    setCalendarYear(year);
    setCalendarMonth(month);
    setSelectedCalendarDate(todayBD);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ===================================================================== */}
      {/* TOP DESK HEADER BAR                                                   */}
      {/* ===================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-brand-dark">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-brand-navy text-white border-2 border-brand-dark shadow-brutal-xs inline-flex">
              <CreditCard className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-heading font-extrabold text-brand-navy tracking-tight">
              Billing Operations Desk
            </h1>
            <Badge variant="teal" size="sm" className="hidden sm:inline-flex">
              Admin Ops
            </Badge>
          </div>
          <p className="text-xs sm:text-sm font-sans text-brand-muted">
            Institutional management for scholar payment cycles, mentor disbursements, and calendar anchors.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDeskData}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            disabled={loading}
          >
            Sync Data
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateStudentModalOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Record Cycle
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCreateMentorModalOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Disburse Payout
          </Button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {actionSuccess && (
        <div className="p-3 bg-teal-50 border-2 border-teal-600 shadow-brutal-xs flex items-center justify-between text-teal-900 text-xs font-bold font-sans">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
            <span>{actionSuccess}</span>
          </div>
          <button type="button" onClick={() => setActionSuccess(null)} className="text-teal-700 hover:text-teal-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-red-50 border-2 border-brand-dark shadow-brutal-xs flex items-center justify-between text-red-900 text-xs font-bold font-sans">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadDeskData}>
            Retry
          </Button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5-TAB WORKSPACE NAVIGATION                                            */}
      {/* ===================================================================== */}
      <div className="flex items-center gap-1.5 border-b-2 border-brand-dark overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-xs sm:text-sm font-heading font-extrabold uppercase tracking-wider border-t-2 border-l-2 border-r-2 border-brand-dark transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'overview'
              ? 'bg-brand-paper text-brand-navy shadow-brutal-xs translate-y-0.5'
              : 'bg-brand-paper/50 text-brand-muted hover:bg-brand-paper hover:text-brand-dark'
          }`}
        >
          <Layers className="w-4 h-4 text-brand-teal" />
          <span>Overview</span>
          {metrics.needsAttentionCount > 0 && (
            <span className="px-1.5 py-0.2 bg-rose-500 text-white font-mono font-bold text-[10px] rounded-full">
              {metrics.needsAttentionCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('student_payments')}
          className={`px-4 py-2 text-xs sm:text-sm font-heading font-extrabold uppercase tracking-wider border-t-2 border-l-2 border-r-2 border-brand-dark transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'student_payments'
              ? 'bg-brand-paper text-brand-navy shadow-brutal-xs translate-y-0.5'
              : 'bg-brand-paper/50 text-brand-muted hover:bg-brand-paper hover:text-brand-dark'
          }`}
        >
          <GraduationCap className="w-4 h-4 text-brand-teal" />
          <span>Student Payments</span>
          <span className="font-mono text-xs text-brand-muted">({studentRecords.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('mentor_payouts')}
          className={`px-4 py-2 text-xs sm:text-sm font-heading font-extrabold uppercase tracking-wider border-t-2 border-l-2 border-r-2 border-brand-dark transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'mentor_payouts'
              ? 'bg-brand-paper text-brand-navy shadow-brutal-xs translate-y-0.5'
              : 'bg-brand-paper/50 text-brand-muted hover:bg-brand-paper hover:text-brand-dark'
          }`}
        >
          <User className="w-4 h-4 text-brand-teal" />
          <span>Mentor Payouts</span>
          <span className="font-mono text-xs text-brand-muted">({mentorRecords.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('calendar')}
          className={`px-4 py-2 text-xs sm:text-sm font-heading font-extrabold uppercase tracking-wider border-t-2 border-l-2 border-r-2 border-brand-dark transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'calendar'
              ? 'bg-brand-paper text-brand-navy shadow-brutal-xs translate-y-0.5'
              : 'bg-brand-paper/50 text-brand-muted hover:bg-brand-paper hover:text-brand-dark'
          }`}
        >
          <CalendarIcon className="w-4 h-4 text-brand-teal" />
          <span>Billing Calendar</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit_notes')}
          className={`px-4 py-2 text-xs sm:text-sm font-heading font-extrabold uppercase tracking-wider border-t-2 border-l-2 border-r-2 border-brand-dark transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'audit_notes'
              ? 'bg-brand-paper text-brand-navy shadow-brutal-xs translate-y-0.5'
              : 'bg-brand-paper/50 text-brand-muted hover:bg-brand-paper hover:text-brand-dark'
          }`}
        >
          <History className="w-4 h-4 text-brand-teal" />
          <span>Activity & Audit Log</span>
          <span className="font-mono text-xs text-brand-muted">({auditLogs.length})</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: OPERATIONAL OVERVIEW & ATTENTION                                */}
      {/* ===================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Operations Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="p-3.5 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs">
              <span className="font-mono text-[10px] uppercase text-brand-muted block">Needs Attention</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className={`text-2xl font-heading font-extrabold ${metrics.needsAttentionCount > 0 ? 'text-rose-600' : 'text-brand-navy'}`}>
                  {metrics.needsAttentionCount}
                </span>
                <span className="text-[11px] font-mono text-brand-muted">items</span>
              </div>
              <span className="text-[10px] font-sans text-brand-muted mt-1 block">
                {metrics.studentOverdue} overdue, {duplicateReferencesList.length} duplicate ref
              </span>
            </div>

            <div className="p-3.5 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs">
              <span className="font-mono text-[10px] uppercase text-brand-muted block">Pending Cycles</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-heading font-extrabold text-amber-600">
                  {metrics.studentPending}
                </span>
                <span className="text-[11px] font-mono text-brand-muted">records</span>
              </div>
              <span className="text-[10px] font-sans text-brand-muted mt-1 block">Awaiting confirmation</span>
            </div>

            <div className="p-3.5 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs">
              <span className="font-mono text-[10px] uppercase text-brand-muted block">Paid / Settled</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-heading font-extrabold text-teal-600">
                  {metrics.studentPaid}
                </span>
                <span className="text-[11px] font-mono text-brand-muted">records</span>
              </div>
              <span className="text-[10px] font-sans text-brand-muted mt-1 block">Successfully verified</span>
            </div>

            <div className="p-3.5 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs">
              <span className="font-mono text-[10px] uppercase text-brand-muted block">Mentor Payouts</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-heading font-extrabold text-brand-navy">
                  {metrics.mentorPaid}/{metrics.totalMentorRecords}
                </span>
                <span className="text-[11px] font-mono text-brand-muted">settled</span>
              </div>
              <span className="text-[10px] font-sans text-brand-muted mt-1 block">{metrics.mentorPending} pending payout</span>
            </div>

            <div className="p-3.5 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs col-span-2 sm:col-span-1">
              <span className="font-mono text-[10px] uppercase text-brand-muted block">Active Scholars</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-heading font-extrabold text-brand-teal">
                  {metrics.activeEnrollmentsCount}
                </span>
                <span className="text-[11px] font-mono text-brand-muted">enrolled</span>
              </div>
              <span className="text-[10px] font-sans text-brand-muted mt-1 block">Tracked across programs</span>
            </div>
          </div>

          {/* Needs Attention Panel (Duplicates & Overdue) */}
          {duplicateReferencesList.length > 0 && (
            <div className="p-4 bg-amber-50 border-2 border-amber-500 shadow-brutal-sm space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-heading font-extrabold text-xs sm:text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Attention Required: Duplicate Transaction References Detected</span>
              </div>
              <p className="text-xs font-sans text-amber-800">
                The following transaction references appear multiple times across student payments or payouts. Verify records to ensure no duplicate disbursements or split payments have occurred:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {duplicateReferencesList.map((d) => (
                  <button
                    key={d.ref}
                    type="button"
                    onClick={() => {
                      setSearchQuery(d.ref);
                      setActiveTab('student_payments');
                    }}
                    className="px-2.5 py-1 bg-white border border-amber-600 font-mono text-xs font-bold text-amber-900 hover:bg-amber-100 flex items-center gap-1.5 shadow-brutal-xs"
                    title={`Click to filter Student Payments for ${d.ref}`}
                  >
                    <Hash className="w-3 h-3 text-amber-600" />
                    <span>{d.ref}</span>
                    <span className="px-1.5 py-0.2 bg-amber-600 text-white text-[10px] font-bold rounded-full">{d.count}×</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2-Column Overview Layout: Upcoming Renewals & Recent Operations */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Upcoming Renewals Monitor (7 Cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-extrabold text-sm sm:text-base text-brand-navy uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-teal" />
                  Upcoming Renewals (Next 14 Days)
                </h3>
                <span className="font-mono text-xs text-brand-muted">
                  {metrics.upcomingRenewals.length} scheduled
                </span>
              </div>

              {metrics.upcomingRenewals.length === 0 ? (
                <div className="p-8 bg-brand-paper border-2 border-brand-dark shadow-brutal-sm text-center text-xs text-brand-muted">
                  No student renewals due within the next 14 calendar days.
                </div>
              ) : (
                <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal-sm divide-y divide-brand-dark/15">
                  {metrics.upcomingRenewals.map((item) => (
                    <div
                      key={item.enrollment.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-brand-paper-tint/60 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs sm:text-sm text-brand-navy">
                            {item.student?.full_name || 'Scholar'}
                          </span>
                          <span className="font-mono text-[11px] text-brand-muted">
                            {item.student?.poraplan_id || ''}
                          </span>
                          {item.daysUntilDue <= 3 && (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-400 font-mono text-[10px] font-bold">
                              Reminder Due
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-brand-muted flex flex-wrap gap-2">
                          <span>{item.program?.name || 'Program'}</span>
                          <span>•</span>
                          <span>Renewal Due: <strong>{formatCalendarDate(item.nextDueDate)}</strong></span>
                          <span>•</span>
                          <span>Anchor: {formatCalendarDate(item.enrollment.billing_start_date || item.cycleStartDate)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 text-xs font-mono font-bold ${
                          item.daysUntilDue === 0
                            ? 'bg-rose-100 text-rose-800 border border-rose-400'
                            : item.daysUntilDue <= 3
                            ? 'bg-amber-100 text-amber-800 border border-amber-400'
                            : 'bg-brand-bg text-brand-muted border border-brand-dark/20'
                        }`}>
                          {item.daysUntilDue === 0 ? 'Due Today' : `In ${item.daysUntilDue} days`}
                        </span>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openBillingAnchorModal(item.enrollment)}
                          leftIcon={<Edit2 className="w-3 h-3" />}
                        >
                          Anchor
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Recent Operations & Audit Log (5 Cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-extrabold text-sm sm:text-base text-brand-navy uppercase tracking-wider flex items-center gap-2">
                  <History className="w-4 h-4 text-brand-teal" />
                  Recent Billing Date Adjustments
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('audit_notes')}
                  className="font-mono text-xs text-brand-teal hover:underline flex items-center gap-1"
                >
                  View All ({auditLogs.length}) <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {auditLogs.length === 0 ? (
                <div className="p-8 bg-brand-paper border-2 border-brand-dark shadow-brutal-sm text-center text-xs text-brand-muted">
                  No billing start date adjustments logged yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.slice(0, 4).map((log) => {
                    const enrollment = enrollmentsMap.get(log.enrollment_id);
                    const student = enrollment ? studentsMap.get(enrollment.student_id) : null;
                    return (
                      <div
                        key={log.id}
                        className="p-3 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs space-y-1.5 text-xs"
                      >
                        <div className="flex justify-between items-center text-[11px] font-mono text-brand-muted">
                          <span className="font-bold text-brand-navy">{student?.full_name || 'Scholar'}</span>
                          <span>{log.created_at ? formatLocalDate(new Date(log.created_at)) : '—'}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="text-rose-700 line-through">{formatCalendarDate(log.old_billing_start_date)}</span>
                          <ArrowRight className="w-3 h-3 text-brand-muted" />
                          <span className="text-teal-700 font-bold">{formatCalendarDate(log.new_billing_start_date)}</span>
                        </div>
                        <p className="font-sans text-brand-dark text-[11px] line-clamp-2 bg-brand-bg p-1.5 border border-brand-dark/15">
                          <strong>Reason: </strong>{log.reason}
                        </p>
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
      {/* TAB 2: STUDENT PAYMENTS WORKSPACE                                     */}
      {/* ===================================================================== */}
      {activeTab === 'student_payments' && (
        <div className="space-y-4">
          {/* Filters Toolbar */}
          <div className="p-4 bg-brand-paper border-2 border-brand-dark shadow-brutal-sm space-y-3">
            <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-brand-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by scholar name, email, PoraPlan ID, or transaction reference..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs font-sans border-2 border-brand-dark bg-white focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-dark"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
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

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-brand-dark/15 text-xs font-sans">
              <select
                value={studentProgramFilter}
                onChange={(e) => setStudentProgramFilter(e.target.value)}
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

              <select
                value={studentDueFilter}
                onChange={(e) => setStudentDueFilter(e.target.value as any)}
                aria-label="Filter by due date"
                className="px-2.5 py-1.5 text-xs font-heading font-bold uppercase border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none"
              >
                <option value="all">All Due Dates</option>
                <option value="overdue">Overdue Only</option>
                <option value="reminder_due">Due in ≤ 3 Days</option>
                <option value="due_this_month">Due This Month</option>
              </select>

              <select
                value={studentMethodFilter}
                onChange={(e) => setStudentMethodFilter(e.target.value)}
                aria-label="Filter by payment method"
                className="px-2.5 py-1.5 text-xs font-heading font-bold uppercase border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none"
              >
                <option value="all">All Methods</option>
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="upay">Upay</option>
                <option value="bank">Bank Transfer</option>
                <option value="cash">Cash</option>
              </select>

              {(searchQuery || studentStatusFilter !== 'all' || studentProgramFilter !== 'all' || studentDueFilter !== 'all' || studentMethodFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStudentStatusFilter('all');
                    setStudentProgramFilter('all');
                    setStudentDueFilter('all');
                    setStudentMethodFilter('all');
                  }}
                  className="px-2 py-1 text-xs font-mono font-bold text-rose-700 hover:underline ml-auto"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Student Records Table */}
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
                    const isDuplicate = rec.transaction_reference && (duplicateReferenceCounts.get(rec.transaction_reference.trim().toUpperCase()) || 0) > 1;

                    return (
                      <tr
                        key={rec.id}
                        className="hover:bg-brand-paper-tint/60 transition-colors cursor-pointer"
                        onClick={() => setSelectedStudentRecordForDrawer(rec)}
                      >
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
                          <div className="font-bold text-brand-dark">{formatCalendarDate(rec.next_due_date)}</div>
                          {isCycleOverdue(rec.next_due_date, todayBD) && rec.status !== 'paid' && rec.status !== 'waived' && (
                            <span className="text-[10px] text-rose-600 font-bold block">Overdue</span>
                          )}
                        </td>
                        <td className="p-3">
                          {getStudentStatusBadge(rec.status)}
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          <div>{formatPaymentMethod(rec.payment_method)}</div>
                          {rec.transaction_reference && (
                            <div className="text-[10px] text-brand-muted truncate max-w-[130px] flex items-center gap-1">
                              <span>{rec.transaction_reference}</span>
                              {isDuplicate && (
                                <span className="text-amber-600 font-bold" title="Duplicate reference warning">⚠️</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-brand-muted">
                          {rec.payment_date ? formatCalendarDate(rec.payment_date) : '—'}
                        </td>
                        <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="px-2 py-1 text-[11px]"
                              onClick={() => setSelectedStudentRecordForDrawer(rec)}
                              leftIcon={<Eye className="w-3 h-3" />}
                            >
                              Details
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="px-2 py-1 text-[11px]"
                              onClick={() => {
                                setEditingStudentRecord(rec);
                                setIsEditStudentModalOpen(true);
                              }}
                              leftIcon={<Edit2 className="w-3 h-3" />}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="px-2 py-1 text-[11px]"
                              onClick={() => openEventsModal('student', rec.id, `${student?.full_name || 'Scholar'} - ${rec.cycle_start_date || 'Cycle'}`)}
                              leftIcon={<History className="w-3 h-3" />}
                              title="Event Log"
                            >
                              Events
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="px-2 py-1 text-[11px]"
                              onClick={() => openNotesModal('student_payment', rec.id, `${student?.full_name || 'Scholar'} - ${rec.cycle_start_date || 'Cycle'}`)}
                              leftIcon={<Lock className="w-3 h-3" />}
                              title="Internal Admin Notes"
                            >
                              Notes
                            </Button>
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

      {/* ===================================================================== */}
      {/* TAB 3: MENTOR PAYOUTS WORKSPACE                                       */}
      {/* ===================================================================== */}
      {activeTab === 'mentor_payouts' && (
        <div className="space-y-4">
          {/* Filters Toolbar */}
          <div className="p-4 bg-brand-paper border-2 border-brand-dark shadow-brutal-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-brand-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search mentor by name, email, month, or transaction reference..."
                value={mentorSearchQuery}
                onChange={(e) => setMentorSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs font-sans border-2 border-brand-dark bg-white focus:outline-none"
              />
              {mentorSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMentorSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-dark"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
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

              <select
                value={mentorMethodFilter}
                onChange={(e) => setMentorMethodFilter(e.target.value)}
                aria-label="Filter by payout method"
                className="px-2.5 py-1.5 text-xs font-heading font-bold uppercase border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none"
              >
                <option value="all">All Methods</option>
                <option value="bank">Bank Transfer</option>
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="upay">Upay</option>
                <option value="cash">Cash</option>
              </select>

              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateMentorModalOpen(true)}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Record Mentor Payout
              </Button>
            </div>
          </div>

          {/* Mentor Payouts Table */}
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
                    <th className="p-3">Related Context</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Method & Reference</th>
                    <th className="p-3">Payout Date</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-dark/15">
                  {filteredMentorRecords.map((rec) => {
                    const mentor = mentorsMap.get(rec.mentor_id);
                    const relStudent = rec.related_student_id ? studentsMap.get(rec.related_student_id) : null;
                    const isDuplicate = rec.transaction_reference && (duplicateReferenceCounts.get(rec.transaction_reference.trim().toUpperCase()) || 0) > 1;

                    return (
                      <tr
                        key={rec.id}
                        className="hover:bg-brand-paper-tint/60 transition-colors cursor-pointer"
                        onClick={() => setSelectedMentorRecordForDrawer(rec)}
                      >
                        <td className="p-3 font-medium">
                          <div className="font-bold text-brand-navy">
                            {mentor?.full_name || 'Mentor'}
                          </div>
                          <div className="text-[10px] font-mono text-brand-muted">
                            {mentor?.email || ''}
                          </div>
                        </td>
                        <td className="p-3 font-heading font-bold text-brand-dark">
                          {formatBillingMonth(rec.billing_month)}
                        </td>
                        <td className="p-3 text-brand-muted text-[11px]">
                          {relStudent ? `Scholar: ${relStudent.full_name}` : 'Platform Pool'}
                        </td>
                        <td className="p-3">
                          {getMentorStatusBadge(rec.status)}
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          <div>{formatPaymentMethod(rec.payment_method)}</div>
                          {rec.transaction_reference && (
                            <div className="text-[10px] text-brand-muted truncate max-w-[130px] flex items-center gap-1">
                              <span>{rec.transaction_reference}</span>
                              {isDuplicate && (
                                <span className="text-amber-600 font-bold" title="Duplicate reference warning">⚠️</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-brand-muted">
                          {rec.payout_date ? formatCalendarDate(rec.payout_date) : 'Pending'}
                        </td>
                        <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="px-2 py-1 text-[11px]"
                              onClick={() => setSelectedMentorRecordForDrawer(rec)}
                              leftIcon={<Eye className="w-3 h-3" />}
                            >
                              Details
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="px-2 py-1 text-[11px]"
                              onClick={() => {
                                setEditingMentorRecord(rec);
                                setIsEditMentorModalOpen(true);
                              }}
                              leftIcon={<Edit2 className="w-3 h-3" />}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="px-2 py-1 text-[11px]"
                              onClick={() => openEventsModal('mentor', rec.id, `${mentor?.full_name || 'Mentor'} - ${formatBillingMonth(rec.billing_month)}`)}
                              leftIcon={<History className="w-3 h-3" />}
                              title="Event Log"
                            >
                              Events
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="px-2 py-1 text-[11px]"
                              onClick={() => openNotesModal('mentor_payment', rec.id, `${mentor?.full_name || 'Mentor'} - ${formatBillingMonth(rec.billing_month)}`)}
                              leftIcon={<Lock className="w-3 h-3" />}
                              title="Internal Admin Notes"
                            >
                              Notes
                            </Button>
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

      {/* ===================================================================== */}
      {/* TAB 4: BILLING CALENDAR & RENEWAL SCHEDULE                            */}
      {/* ===================================================================== */}
      {activeTab === 'calendar' && (
        <div className="space-y-6">
          <div className="p-4 bg-brand-paper border-2 border-brand-dark shadow-brutal-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-heading font-extrabold text-base text-brand-navy uppercase flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-brand-teal" />
                {calendarMonthLabel} (Asia/Dhaka)
              </h3>
              <p className="text-xs font-sans text-brand-muted">
                Calendar view of renewal dates, billing anniversaries, and overdue schedules.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrevMonth} leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}>
                Prev
              </Button>
              <Button variant="outline" size="sm" onClick={handleTodayCalendar}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={handleNextMonth} rightIcon={<ChevronRight className="w-3.5 h-3.5" />}>
                Next
              </Button>
            </div>
          </div>

          {/* Calendar Grid & Day Agenda Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Calendar Grid (8 Cols) */}
            <div className="lg:col-span-8 border-2 border-brand-dark bg-brand-paper shadow-brutal p-4">
              <div className="grid grid-cols-7 gap-1 text-center font-heading text-[11px] font-bold uppercase text-brand-navy pb-2 border-b-2 border-brand-dark">
                <span>Sun</span>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
              </div>

              <div className="grid grid-cols-7 gap-1 pt-2">
                {/* Empty cells for leading days */}
                {Array.from({ length: monthFirstDayWeekday }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="h-16 bg-brand-paper-tint/30 border border-brand-dark/10" />
                ))}

                {/* Day Cells */}
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const dayData = calendarEventsByDay.get(dateStr);
                  const isSelected = selectedCalendarDate === dateStr;
                  const isToday = dateStr === todayBD;

                  const hasRenewals = (dayData?.renewals.length || 0) > 0;
                  const hasRecords = (dayData?.records.length || 0) > 0;

                  return (
                    <div
                      key={dateStr}
                      onClick={() => setSelectedCalendarDate(dateStr)}
                      className={`h-16 p-1 border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-2 border-brand-dark bg-brand-teal/20 shadow-brutal-xs font-bold'
                          : isToday
                          ? 'border-2 border-teal-600 bg-teal-50'
                          : 'border-brand-dark/20 bg-brand-bg hover:bg-brand-paper-tint/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-mono ${isToday ? 'font-bold text-teal-700 underline' : 'text-brand-dark'}`}>
                          {dayNum}
                        </span>
                        {isToday && <span className="text-[9px] font-bold text-teal-700">Today</span>}
                      </div>

                      <div className="flex flex-col gap-0.5">
                        {hasRenewals && (
                          <span className="px-1 py-0.2 bg-amber-100 border border-amber-400 text-amber-900 text-[9px] font-mono leading-none truncate">
                            {dayData?.renewals.length} Renew
                          </span>
                        )}
                        {hasRecords && (
                          <span className="px-1 py-0.2 bg-teal-100 border border-teal-400 text-teal-900 text-[9px] font-mono leading-none truncate">
                            {dayData?.records.length} Cycle
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Day Agenda Panel (4 Cols) */}
            <div className="lg:col-span-4 border-2 border-brand-dark bg-brand-paper shadow-brutal p-4 space-y-4">
              <div>
                <span className="font-mono text-[10px] uppercase text-brand-muted block">Selected Date Agenda</span>
                <h4 className="font-heading font-extrabold text-brand-navy text-sm sm:text-base">
                  {formatCalendarDate(selectedCalendarDate)}
                </h4>
              </div>

              {(() => {
                const dayData = calendarEventsByDay.get(selectedCalendarDate);
                const renewals = dayData?.renewals || [];
                const records = dayData?.records || [];

                if (renewals.length === 0 && records.length === 0) {
                  return (
                    <div className="p-6 text-center text-xs text-brand-muted bg-brand-bg border border-brand-dark/15">
                      No cycles or renewals scheduled on this date.
                    </div>
                  );
                }

                return (
                  <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                    {renewals.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[11px] font-mono font-bold text-brand-muted uppercase">
                          Scheduled Renewals ({renewals.length})
                        </span>
                        {renewals.map((enr) => {
                          const stu = studentsMap.get(enr.student_id);
                          const prg = programsMap.get(enr.program_id);
                          return (
                            <div key={enr.id} className="p-2.5 bg-brand-bg border border-brand-dark/20 text-xs space-y-1">
                              <div className="font-bold text-brand-navy">{stu?.full_name || 'Scholar'}</div>
                              <div className="text-[10px] font-mono text-brand-muted">{prg?.name || 'Program'}</div>
                              <div className="flex justify-end pt-1">
                                <Button variant="outline" size="sm" className="text-[10px] py-0.5 px-2" onClick={() => openBillingAnchorModal(enr)}>
                                  Manage Anchor
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {records.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-brand-dark/15">
                        <span className="text-[11px] font-mono font-bold text-brand-muted uppercase">
                          Payment Cycles Due ({records.length})
                        </span>
                        {records.map((rec) => {
                          const stu = studentsMap.get(rec.student_id);
                          return (
                            <div key={rec.id} className="p-2.5 bg-brand-bg border border-brand-dark/20 text-xs space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-brand-navy">{stu?.full_name || 'Scholar'}</span>
                                {getStudentStatusBadge(rec.status)}
                              </div>
                              <div className="text-[10px] font-mono text-brand-muted">
                                Period: {formatCalendarDate(rec.cycle_start_date)} – {formatCalendarDate(rec.cycle_end_date)}
                              </div>
                              <div className="flex justify-end pt-1">
                                <Button variant="outline" size="sm" className="text-[10px] py-0.5 px-2" onClick={() => setSelectedStudentRecordForDrawer(rec)}>
                                  View Record
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: ACTIVITY & AUDIT LOG WORKSPACE                                 */}
      {/* ===================================================================== */}
      {activeTab === 'audit_notes' && (
        <div className="space-y-4">
          <div className="p-4 bg-brand-paper border-2 border-brand-dark shadow-brutal-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-heading font-extrabold text-sm sm:text-base text-brand-navy uppercase flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-teal" />
                Immutable System Activity & Audit Trail
              </h3>
              <p className="text-xs font-sans text-brand-muted">
                Append-only operational logs recording billing start date overrides and status waiver justifications.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={activityTypeFilter}
                onChange={(e) => setActivityTypeFilter(e.target.value as any)}
                aria-label="Filter activity type"
                className="px-2.5 py-1.5 text-xs font-heading font-bold uppercase border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none"
              >
                <option value="all">All Audit Events</option>
                <option value="overrides">Billing Date Overrides</option>
                <option value="waivers">Payment Waivers</option>
              </select>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal-sm overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-brand-navy text-brand-paper border-b-2 border-brand-dark font-heading uppercase text-[11px]">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Event Type</th>
                  <th className="p-3">Context / Scholar</th>
                  <th className="p-3">Audit Details</th>
                  <th className="p-3">Operational Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-dark/15">
                {auditLogs.map((log) => {
                  const enrollment = enrollmentsMap.get(log.enrollment_id);
                  const student = enrollment ? studentsMap.get(enrollment.student_id) : null;
                  return (
                    <tr key={log.id} className="hover:bg-brand-paper-tint/60 transition-colors">
                      <td className="p-3 font-mono text-[11px] whitespace-nowrap">
                        {log.created_at ? formatLocalDate(new Date(log.created_at)) : '—'}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-400 font-mono text-[10px] font-bold">
                          Date Override
                        </span>
                      </td>
                      <td className="p-3 font-medium">
                        {student ? `${student.full_name} (${student.poraplan_id || ''})` : log.enrollment_id.slice(0, 8)}
                      </td>
                      <td className="p-3 font-mono text-[11px]">
                        <span className="text-rose-700">{formatCalendarDate(log.old_billing_start_date)}</span>
                        {' → '}
                        <span className="text-teal-700 font-bold">{formatCalendarDate(log.new_billing_start_date)}</span>
                      </td>
                      <td className="p-3 text-[11px] text-brand-dark">
                        {log.reason}
                      </td>
                    </tr>
                  );
                })}

                {/* Waived Cycles Rows */}
                {activityTypeFilter !== 'overrides' &&
                  studentRecords
                    .filter((r) => r.status === 'waived' && r.waived_reason)
                    .map((rec) => {
                      const student = studentsMap.get(rec.student_id);
                      return (
                        <tr key={`waived-${rec.id}`} className="hover:bg-brand-paper-tint/60 transition-colors bg-brand-bg/40">
                          <td className="p-3 font-mono text-[11px] whitespace-nowrap">
                            {rec.updated_at ? formatLocalDate(new Date(rec.updated_at)) : '—'}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-400 font-mono text-[10px] font-bold">
                              Status Waived
                            </span>
                          </td>
                          <td className="p-3 font-medium">
                            {student ? `${student.full_name} (${student.poraplan_id || ''})` : rec.student_id.slice(0, 8)}
                          </td>
                          <td className="p-3 font-mono text-[11px]">
                            Cycle: {formatCalendarDate(rec.cycle_start_date)} – {formatCalendarDate(rec.cycle_end_date)}
                          </td>
                          <td className="p-3 text-[11px] text-brand-dark font-medium">
                            {rec.waived_reason}
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* DRAWER 1: DEDICATED STUDENT PAYMENT RECORD DETAILS                    */}
      {/* ===================================================================== */}
      {selectedStudentRecordForDrawer && (
        <StudentPaymentDrawer
          record={selectedStudentRecordForDrawer}
          studentsMap={studentsMap}
          enrollmentsMap={enrollmentsMap}
          programsMap={programsMap}
          allKnownReferences={allKnownReferences}
          onClose={() => setSelectedStudentRecordForDrawer(null)}
          onEdit={() => {
            setEditingStudentRecord(selectedStudentRecordForDrawer);
            setIsEditStudentModalOpen(true);
          }}
          onOpenAnchor={() => {
            const enr = enrollmentsMap.get(selectedStudentRecordForDrawer.enrollment_id);
            if (enr) openBillingAnchorModal(enr);
          }}
          onDelete={() => handleSoftDeleteStudent(selectedStudentRecordForDrawer.id)}
          onRefresh={loadDeskData}
        />
      )}

      {/* ===================================================================== */}
      {/* DRAWER 2: DEDICATED MENTOR PAYOUT RECORD DETAILS                      */}
      {/* ===================================================================== */}
      {selectedMentorRecordForDrawer && (
        <MentorPayoutDrawer
          record={selectedMentorRecordForDrawer}
          mentorsMap={mentorsMap}
          studentsMap={studentsMap}
          allKnownReferences={allKnownReferences}
          onClose={() => setSelectedMentorRecordForDrawer(null)}
          onEdit={() => {
            setEditingMentorRecord(selectedMentorRecordForDrawer);
            setIsEditMentorModalOpen(true);
          }}
          onDelete={() => handleSoftDeleteMentor(selectedMentorRecordForDrawer.id)}
          onRefresh={loadDeskData}
        />
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: CREATE STUDENT PAYMENT MODAL                                 */}
      {/* ===================================================================== */}
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

      {/* ===================================================================== */}
      {/* MODAL 2: EDIT STUDENT PAYMENT MODAL                                   */}
      {/* ===================================================================== */}
      {isEditStudentModalOpen && editingStudentRecord && (
        <EditStudentPaymentModal
          record={editingStudentRecord}
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

      {/* ===================================================================== */}
      {/* MODAL 3: CREATE MENTOR PAYOUT MODAL                                   */}
      {/* ===================================================================== */}
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

      {/* ===================================================================== */}
      {/* MODAL 4: EDIT MENTOR PAYOUT MODAL                                     */}
      {/* ===================================================================== */}
      {isEditMentorModalOpen && editingMentorRecord && (
        <EditMentorPayoutModal
          record={editingMentorRecord}
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

      {/* ===================================================================== */}
      {/* MODAL 5: CHILD PAYMENT EVENTS                                         */}
      {/* ===================================================================== */}
      {isEventsModalOpen && activeEventRecord && (
        <PaymentEventsModal
          recordType={activeEventRecord.type}
          recordId={activeEventRecord.id}
          recordTitle={activeEventRecord.title}
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

      {/* ===================================================================== */}
      {/* MODAL 6: PRIVATE ADMIN NOTES                                          */}
      {/* ===================================================================== */}
      {isNotesModalOpen && activeNoteTarget && (
        <div className="fixed inset-0 z-50 bg-brand-dark/70 flex items-center justify-center p-4">
          <div className="bg-brand-paper border-2 border-brand-dark shadow-brutal p-5 sm:p-6 w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
              <h3 className="font-heading font-extrabold text-brand-navy text-sm sm:text-base flex items-center gap-2">
                <Lock className="w-4 h-4 text-brand-coral" />
                Private Admin Notes
              </h3>
              <button type="button" onClick={() => setIsNotesModalOpen(false)} className="hover:opacity-75">
                <X className="w-5 h-5 text-brand-dark" />
              </button>
            </div>

            <div className="text-xs font-mono text-brand-muted">
              {activeNoteTarget.title}
            </div>

            {/* Existing Notes List */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {notesLoading ? (
                <div className="text-xs text-brand-muted p-2">Loading private notes...</div>
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
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setIsNotesModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleAddNote} disabled={!newNoteText.trim()}>
                  Save Note
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 7: MANAGE STUDENT BILLING START DATE ANCHOR                     */}
      {/* ===================================================================== */}
      {isBillingAnchorModalOpen && activeAnchorEnrollment && (
        <div className="fixed inset-0 z-50 bg-brand-dark/70 flex items-center justify-center p-4">
          <div className="bg-brand-paper border-2 border-brand-dark shadow-brutal p-5 sm:p-6 w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
              <h3 className="font-heading font-extrabold text-brand-navy text-sm sm:text-base flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-brand-teal" />
                Manage Billing Start Anchor
              </h3>
              <button type="button" onClick={() => setIsBillingAnchorModalOpen(false)} className="hover:opacity-75">
                <X className="w-5 h-5 text-brand-dark" />
              </button>
            </div>

            <div className="p-3 bg-brand-bg border border-brand-dark/20 text-xs space-y-1 font-sans">
              <div className="font-bold text-brand-navy">
                Scholar: {studentsMap.get(activeAnchorEnrollment.student_id)?.full_name || 'Scholar'}
              </div>
              <div className="font-mono text-brand-muted text-[11px]">
                Enrolled: {activeAnchorEnrollment.enrolled_at ? formatCalendarDate(activeAnchorEnrollment.enrolled_at.substring(0, 10)) : '—'}
              </div>
              <div className="font-mono text-brand-muted text-[11px]">
                Current Anchor: {formatCalendarDate(activeAnchorEnrollment.billing_start_date || (activeAnchorEnrollment.enrolled_at?.substring(0, 10) || todayBD))}
              </div>
            </div>

            <form onSubmit={handleSaveBillingAnchor} className="space-y-3 text-xs font-sans">
              <div>
                <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
                  New Billing Start Date (YYYY-MM-DD):
                </label>
                <input
                  type="date"
                  required
                  value={newAnchorDate}
                  onChange={(e) => setNewAnchorDate(e.target.value)}
                  className="w-full p-2 border-2 border-brand-dark bg-white font-mono text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
                  Operational Justification (Mandatory):
                </label>
                <textarea
                  rows={3}
                  required
                  value={anchorOverrideReason}
                  onChange={(e) => setAnchorOverrideReason(e.target.value)}
                  placeholder="Explain why this scholar's anniversary anchor is being adjusted (e.g. extension, medical deferral, manual correction)..."
                  className="w-full p-2 border-2 border-brand-dark bg-white text-xs focus:outline-none"
                />
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-300 text-amber-900 text-[11px]">
                <strong>Audit Note: </strong>This modification will be permanently recorded in the immutable audit log and will set future monthly anniversary cycle boundaries. Past completed cycle records will not be altered.
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-brand-dark/20">
                <button
                  type="button"
                  onClick={() => {
                    const original = activeAnchorEnrollment.enrolled_at ? activeAnchorEnrollment.enrolled_at.substring(0, 10) : todayBD;
                    setNewAnchorDate(original);
                    setAnchorOverrideReason('Reset to initial enrollment calendar date.');
                  }}
                  className="text-brand-muted hover:text-brand-dark text-xs underline"
                >
                  Reset to Enrolled Date
                </button>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" type="button" onClick={() => setIsBillingAnchorModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" type="submit" disabled={isOverridingAnchor}>
                    {isOverridingAnchor ? 'Saving...' : 'Save Anchor'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ==============================================================================
// SUB-COMPONENT: DEDICATED STUDENT PAYMENT DETAILS DRAWER
// ==============================================================================

interface StudentPaymentDrawerProps {
  record: StudentPaymentRecord;
  studentsMap: Map<string, Profile>;
  enrollmentsMap: Map<string, ProgramEnrollmentWithMeta>;
  programsMap: Map<string, Program>;
  allKnownReferences: Map<string, { type: string; id: string; date: string }>;
  onClose: () => void;
  onEdit: () => void;
  onOpenAnchor: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}

const StudentPaymentDrawer: React.FC<StudentPaymentDrawerProps> = ({
  record,
  studentsMap,
  enrollmentsMap,
  programsMap,
  onClose,
  onEdit,
  onOpenAnchor,
  onDelete,
  onRefresh,
}) => {
  const student = studentsMap.get(record.student_id);
  const enrollment = enrollmentsMap.get(record.enrollment_id);
  const program = enrollment ? programsMap.get(enrollment.program_id) : null;

  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [notes, setNotes] = useState<PaymentAdminNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  // New child event state inside drawer
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [eventMethod, setEventMethod] = useState<PaymentMethod>('bkash');
  const [eventRef, setEventRef] = useState('');
  const [eventDate, setEventDate] = useState(toBangladeshDateStr());
  const [eventNote, setEventNote] = useState('');
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);

  const loadDetails = useCallback(async () => {
    setEventsLoading(true);
    setNotesLoading(true);
    try {
      const [evtsRes, notesRes] = await Promise.all([
        getPaymentEvents('student', record.id),
        getPaymentAdminNotes('student_payment', record.id),
      ]);
      setEvents(evtsRes.events);
      setNotes(notesRes.notes);
    } catch {
      // Non-fatal
    } finally {
      setEventsLoading(false);
      setNotesLoading(false);
    }
  }, [record.id]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const handleSaveInlineNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setIsAddingNote(true);
    try {
      const res = await createPaymentAdminNote({
        recordType: 'student_payment',
        recordId: record.id,
        note: newNote.trim(),
      });
      if (res.error) throw res.error;
      if (res.note) {
        setNotes((prev) => [res.note!, ...prev]);
        setNewNote('');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save note.');
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleSaveChildEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingEvent(true);
    try {
      const res = await createPaymentEvent({
        record_type: 'student',
        student_payment_id: record.id,
        payment_method: eventMethod,
        transaction_reference: eventRef.trim() || null,
        payment_date: eventDate,
        note: eventNote.trim() || null,
      });
      if (res.error) throw res.error;
      if (res.event) {
        setEvents((prev) => [res.event!, ...prev]);
        setShowAddEvent(false);
        setEventRef('');
        setEventNote('');
        onRefresh();
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create payment event.');
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-brand-dark/60 flex justify-end">
      <div className="bg-brand-paper border-l-2 border-brand-dark shadow-brutal w-full max-w-xl h-full flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-5 border-b-2 border-brand-dark bg-brand-navy text-white flex items-center justify-between sticky top-0 z-10">
          <div className="space-y-0.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-brand-teal block">
              Student Payment Record
            </span>
            <h2 className="font-heading font-extrabold text-base sm:text-lg">
              {student?.full_name || 'Scholar'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 border border-white/20 hover:bg-white/10 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="p-5 space-y-6 flex-1 text-xs font-sans">
          {/* Status Bar */}
          <div className="p-3 bg-brand-bg border border-brand-dark/20 shadow-brutal-xs flex items-center justify-between">
            <div>
              <span className="font-mono text-[10px] uppercase text-brand-muted block">Current Status</span>
              <div className="mt-0.5">{getStudentStatusBadge(record.status)}</div>
            </div>

            <div className="text-right">
              <span className="font-mono text-[10px] uppercase text-brand-muted block">Renewal Due Date</span>
              <span className="font-mono font-bold text-xs text-brand-navy">
                {formatCalendarDate(record.next_due_date)}
              </span>
            </div>
          </div>

          {/* Section 1: Scholar & Academic Context */}
          <div className="space-y-2">
            <span className="font-heading font-bold text-brand-navy uppercase text-[11px] block border-b border-brand-dark/15 pb-1">
              1. Scholar & Program Context
            </span>
            <div className="grid grid-cols-2 gap-3 p-3 bg-brand-bg border border-brand-dark/15">
              <div>
                <span className="font-mono text-[10px] text-brand-muted block">Scholar Name</span>
                <span className="font-bold text-brand-navy">{student?.full_name || 'Scholar'}</span>
              </div>
              <div>
                <span className="font-mono text-[10px] text-brand-muted block">PoraPlan ID</span>
                <span className="font-mono text-brand-dark">{student?.poraplan_id || '—'}</span>
              </div>
              <div>
                <span className="font-mono text-[10px] text-brand-muted block">Program</span>
                <span className="text-brand-dark">{program?.name || 'Program'}</span>
              </div>
              <div>
                <span className="font-mono text-[10px] text-brand-muted block">Contact Email</span>
                <span className="text-brand-muted truncate block">{student?.email || '—'}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Cycle & Anniversary Information */}
          <div className="space-y-2">
            <span className="font-heading font-bold text-brand-navy uppercase text-[11px] block border-b border-brand-dark/15 pb-1">
              2. Billing Cycle Schedule
            </span>
            <div className="grid grid-cols-2 gap-3 p-3 bg-brand-bg border border-brand-dark/15">
              <div>
                <span className="font-mono text-[10px] text-brand-muted block">Cycle Start Date</span>
                <span className="font-mono font-bold text-brand-navy">{formatCalendarDate(record.cycle_start_date)}</span>
              </div>
              <div>
                <span className="font-mono text-[10px] text-brand-muted block">Cycle End Date (Exclusive)</span>
                <span className="font-mono text-brand-navy">{formatCalendarDate(record.cycle_end_date)}</span>
              </div>
              <div>
                <span className="font-mono text-[10px] text-brand-muted block">Enrolled Date</span>
                <span className="font-mono text-brand-muted">
                  {enrollment?.enrolled_at ? formatCalendarDate(enrollment.enrolled_at.substring(0, 10)) : '—'}
                </span>
              </div>
              <div>
                <span className="font-mono text-[10px] text-brand-muted block">Billing Start Anchor</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-teal-700">
                    {formatCalendarDate(enrollment?.billing_start_date || record.cycle_start_date)}
                  </span>
                  <button type="button" onClick={onOpenAnchor} className="text-[10px] text-brand-teal hover:underline font-bold">
                    Edit
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Payment & Transaction Details */}
          <div className="space-y-2">
            <span className="font-heading font-bold text-brand-navy uppercase text-[11px] block border-b border-brand-dark/15 pb-1">
              3. Payment Verification
            </span>
            <div className="grid grid-cols-2 gap-3 p-3 bg-brand-bg border border-brand-dark/15">
              <div>
                <span className="font-mono text-[10px] text-brand-muted block">Payment Method</span>
                <span className="font-bold text-brand-navy">{formatPaymentMethod(record.payment_method)}</span>
              </div>
              <div>
                <span className="font-mono text-[10px] text-brand-muted block">Payment Date</span>
                <span className="font-mono text-brand-navy">{record.payment_date ? formatCalendarDate(record.payment_date) : 'Pending'}</span>
              </div>
              <div className="col-span-2">
                <span className="font-mono text-[10px] text-brand-muted block">Transaction Reference</span>
                <span className="font-mono text-xs font-bold text-brand-navy break-all">
                  {record.transaction_reference || 'Not recorded'}
                </span>
              </div>
              {record.waived_reason && (
                <div className="col-span-2 p-2 bg-slate-100 border border-slate-300">
                  <span className="font-bold text-slate-800 block text-[10px] uppercase">Waiver Justification:</span>
                  <p className="text-slate-700 mt-0.5">{record.waived_reason}</p>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Child Events Timeline */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-brand-dark/15 pb-1">
              <span className="font-heading font-bold text-brand-navy uppercase text-[11px]">
                4. Payment Events & Installments ({events.length})
              </span>
              <button
                type="button"
                onClick={() => setShowAddEvent((prev) => !prev)}
                className="text-brand-teal hover:underline text-[11px] font-bold flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                {showAddEvent ? 'Cancel' : 'Record Event'}
              </button>
            </div>

            {/* Inline Event Form */}
            {showAddEvent && (
              <form onSubmit={handleSaveChildEvent} className="p-3 bg-brand-paper-tint border-2 border-brand-dark space-y-2">
                <span className="font-bold text-brand-navy text-[11px] block">Record New Child Payment Event</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono uppercase text-brand-muted block">Method</label>
                    <select
                      value={eventMethod}
                      onChange={(e) => setEventMethod(e.target.value as PaymentMethod)}
                      className="w-full p-1 border border-brand-dark bg-white text-xs"
                    >
                      <option value="bkash">bKash</option>
                      <option value="nagad">Nagad</option>
                      <option value="upay">Upay</option>
                      <option value="bank">Bank</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase text-brand-muted block">Date</label>
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full p-1 border border-brand-dark bg-white text-xs font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-brand-muted block">Transaction Reference (Optional)</label>
                  <input
                    type="text"
                    value={eventRef}
                    onChange={(e) => setEventRef(e.target.value)}
                    placeholder="e.g. TRX12345"
                    className="w-full p-1 border border-brand-dark bg-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-brand-muted block">Event Note</label>
                  <input
                    type="text"
                    value={eventNote}
                    onChange={(e) => setEventNote(e.target.value)}
                    placeholder="e.g. First partial payment received"
                    className="w-full p-1 border border-brand-dark bg-white text-xs"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" type="button" onClick={() => setShowAddEvent(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" type="submit" disabled={isSubmittingEvent}>
                    {isSubmittingEvent ? 'Saving...' : 'Save Event'}
                  </Button>
                </div>
              </form>
            )}

            {eventsLoading ? (
              <div className="p-3 text-brand-muted text-xs">Loading payment events...</div>
            ) : events.length === 0 ? (
              <div className="p-3 bg-brand-bg border border-brand-dark/15 text-brand-muted text-center text-xs">
                No child payment events recorded for this cycle yet.
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((evt) => (
                  <div key={evt.id} className="p-2.5 bg-brand-bg border border-brand-dark/20 space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-bold text-brand-navy">{formatPaymentMethod(evt.payment_method)}</span>
                      <span className="font-mono text-brand-muted">{formatCalendarDate(evt.payment_date)}</span>
                    </div>
                    {evt.transaction_reference && (
                      <div className="font-mono text-[10px] text-brand-muted">
                        Ref: {evt.transaction_reference}
                      </div>
                    )}
                    {evt.note && (
                      <p className="text-[11px] text-brand-dark italic bg-white/60 p-1 border border-brand-dark/10">
                        "{evt.note}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 5: Private Admin Notes */}
          <div className="space-y-2">
            <span className="font-heading font-bold text-brand-navy uppercase text-[11px] block border-b border-brand-dark/15 pb-1">
              5. Private Administrator Notes (Internal Only)
            </span>

            {notesLoading ? (
              <div className="p-3 text-brand-muted text-xs">Loading notes...</div>
            ) : notes.length === 0 ? (
              <div className="p-3 bg-brand-bg border border-brand-dark/15 text-brand-muted text-center text-xs">
                No private admin notes recorded yet.
              </div>
            ) : (
              <div className="space-y-2">
                {notes.map((n) => (
                  <div key={n.id} className="p-2.5 bg-brand-bg border border-brand-dark/20 text-xs space-y-1">
                    <p className="font-sans text-brand-dark">{n.note}</p>
                    <span className="font-mono text-[10px] text-brand-muted block">
                      {n.created_at ? formatLocalDate(new Date(n.created_at)) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Add Note Form */}
            <form onSubmit={handleSaveInlineNote} className="space-y-2 pt-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add private note (visible to admins only)..."
                className="w-full p-2 border border-brand-dark bg-white text-xs"
              />
              <div className="flex justify-end">
                <Button variant="outline" size="sm" type="submit" disabled={isAddingNote || !newNote.trim()}>
                  {isAddingNote ? 'Saving...' : 'Add Note'}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Drawer Action Footer */}
        <div className="p-4 border-t-2 border-brand-dark bg-brand-paper flex items-center justify-between gap-2 sticky bottom-0">
          <Button variant="outline" size="sm" onClick={onDelete} className="text-red-700 border-red-300 hover:bg-red-50" leftIcon={<Trash2 className="w-3.5 h-3.5" />}>
            Delete
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onOpenAnchor}>
              Anchor
            </Button>
            <Button variant="primary" size="sm" onClick={onEdit} leftIcon={<Edit2 className="w-3.5 h-3.5" />}>
              Update Status
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==============================================================================
// SUB-COMPONENT: DEDICATED MENTOR PAYOUT RECORD DETAILS DRAWER
// ==============================================================================

interface MentorPayoutDrawerProps {
  record: MentorPaymentRecord;
  mentorsMap: Map<string, Profile>;
  studentsMap: Map<string, Profile>;
  allKnownReferences: Map<string, { type: string; id: string; date: string }>;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}

const MentorPayoutDrawer: React.FC<MentorPayoutDrawerProps> = ({
  record,
  mentorsMap,
  studentsMap,
  onClose,
  onEdit,
  onDelete,
  onRefresh,
}) => {
  const mentor = mentorsMap.get(record.mentor_id);
  const student = record.related_student_id ? studentsMap.get(record.related_student_id) : null;

  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [notes, setNotes] = useState<PaymentAdminNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  // New child event inside mentor drawer
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [eventMethod, setEventMethod] = useState<PaymentMethod>('bank');
  const [eventRef, setEventRef] = useState('');
  const [eventDate, setEventDate] = useState(toBangladeshDateStr());
  const [eventNote, setEventNote] = useState('');
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);

  const loadDetails = useCallback(async () => {
    setEventsLoading(true);
    setNotesLoading(true);
    try {
      const [evtsRes, notesRes] = await Promise.all([
        getPaymentEvents('mentor', record.id),
        getPaymentAdminNotes('mentor_payment', record.id),
      ]);
      setEvents(evtsRes.events);
      setNotes(notesRes.notes);
    } catch {
      // Non-fatal
    } finally {
      setEventsLoading(false);
      setNotesLoading(false);
    }
  }, [record.id]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const handleSaveInlineNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setIsAddingNote(true);
    try {
      const res = await createPaymentAdminNote({
        recordType: 'mentor_payment',
        recordId: record.id,
        note: newNote.trim(),
      });
      if (res.error) throw res.error;
      if (res.note) {
        setNotes((prev) => [res.note!, ...prev]);
        setNewNote('');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save note.');
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleSaveChildEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingEvent(true);
    try {
      const res = await createPaymentEvent({
        record_type: 'mentor',
        mentor_payment_id: record.id,
        payment_method: eventMethod,
        transaction_reference: eventRef.trim() || null,
        payment_date: eventDate,
        note: eventNote.trim() || null,
      });
      if (res.error) throw res.error;
      if (res.event) {
        setEvents((prev) => [res.event!, ...prev]);
        setShowAddEvent(false);
        setEventRef('');
        setEventNote('');
        onRefresh();
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create payout event.');
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-brand-dark/60 flex justify-end">
      <div className="bg-brand-paper border-l-2 border-brand-dark shadow-brutal w-full max-w-xl h-full flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-5 border-b-2 border-brand-dark bg-brand-navy text-white flex items-center justify-between sticky top-0 z-10">
          <div className="space-y-0.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-brand-teal block">
              Mentor Payout Record
            </span>
            <h2 className="font-heading font-extrabold text-base sm:text-lg">
              {mentor?.full_name || 'Mentor'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 border border-white/20 hover:bg-white/10 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="p-5 space-y-6 flex-1 text-xs font-sans">
          {/* Status Bar */}
          <div className="p-3 bg-brand-bg border border-brand-dark/20 shadow-brutal-xs flex items-center justify-between">
            <div>
              <span className="font-mono text-[10px] uppercase text-brand-muted block">Payout Status</span>
              <div className="mt-0.5">{getMentorStatusBadge(record.status)}</div>
            </div>

            <div className="text-right">
              <span className="font-mono text-[10px] uppercase text-brand-muted block">Billing Month</span>
              <span className="font-heading font-extrabold text-sm text-brand-navy">
                {formatBillingMonth(record.billing_month)}
              </span>
            </div>
          </div>

          {/* Section 1: Mentor Context */}
          <div className="space-y-2">
            <span className="font-heading font-bold text-brand-navy uppercase text-[11px] block border-b border-brand-dark/15 pb-1">
              1. Mentor & Allocation Context
            </span>
            <div className="grid grid-cols-2 gap-3 p-3 bg-brand-bg border border-brand-dark/15">
              <div>
                <span className="font-mono text-[10px] text-brand-muted block">Mentor Name</span>
                <span className="font-bold text-brand-navy">{mentor?.full_name || 'Mentor'}</span>
              </div>
              <div>
                <span className="font-mono text-[10px] text-brand-muted block">Email Address</span>
                <span className="text-brand-muted truncate block">{mentor?.email || '—'}</span>
              </div>
              <div className="col-span-2">
                <span className="font-mono text-[10px] text-brand-muted block">Related Scholar Context</span>
                <span className="text-brand-dark">{student ? `Dedicated: ${student.full_name}` : 'Cohort / Platform Mentorship Pool'}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Disbursement Information */}
          <div className="space-y-2">
            <span className="font-heading font-bold text-brand-navy uppercase text-[11px] block border-b border-brand-dark/15 pb-1">
              2. Disbursement Details
            </span>
            <div className="grid grid-cols-2 gap-3 p-3 bg-brand-bg border border-brand-dark/15">
              <div>
                <span className="font-mono text-[10px] text-brand-muted block">Payment Method</span>
                <span className="font-bold text-brand-navy">{formatPaymentMethod(record.payment_method)}</span>
              </div>
              <div>
                <span className="font-mono text-[10px] text-brand-muted block">Disbursement Date</span>
                <span className="font-mono text-brand-navy">{record.payout_date ? formatCalendarDate(record.payout_date) : 'Pending'}</span>
              </div>
              <div className="col-span-2">
                <span className="font-mono text-[10px] text-brand-muted block">Transaction Reference</span>
                <span className="font-mono text-xs font-bold text-brand-navy break-all">
                  {record.transaction_reference || 'Not recorded'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Child Payout Events */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-brand-dark/15 pb-1">
              <span className="font-heading font-bold text-brand-navy uppercase text-[11px]">
                3. Child Payout Events ({events.length})
              </span>
              <button
                type="button"
                onClick={() => setShowAddEvent((prev) => !prev)}
                className="text-brand-teal hover:underline text-[11px] font-bold flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                {showAddEvent ? 'Cancel' : 'Record Event'}
              </button>
            </div>

            {showAddEvent && (
              <form onSubmit={handleSaveChildEvent} className="p-3 bg-brand-paper-tint border-2 border-brand-dark space-y-2">
                <span className="font-bold text-brand-navy text-[11px] block">Record Child Payout Event</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono uppercase text-brand-muted block">Method</label>
                    <select
                      value={eventMethod}
                      onChange={(e) => setEventMethod(e.target.value as PaymentMethod)}
                      className="w-full p-1 border border-brand-dark bg-white text-xs"
                    >
                      <option value="bank">Bank Transfer</option>
                      <option value="bkash">bKash</option>
                      <option value="nagad">Nagad</option>
                      <option value="upay">Upay</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase text-brand-muted block">Date</label>
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full p-1 border border-brand-dark bg-white text-xs font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-brand-muted block">Transaction Reference (Optional)</label>
                  <input
                    type="text"
                    value={eventRef}
                    onChange={(e) => setEventRef(e.target.value)}
                    placeholder="e.g. MNTR-TRX-101"
                    className="w-full p-1 border border-brand-dark bg-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-brand-muted block">Event Note</label>
                  <input
                    type="text"
                    value={eventNote}
                    onChange={(e) => setEventNote(e.target.value)}
                    placeholder="e.g. Disbursement processed via bank wire"
                    className="w-full p-1 border border-brand-dark bg-white text-xs"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" type="button" onClick={() => setShowAddEvent(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" type="submit" disabled={isSubmittingEvent}>
                    {isSubmittingEvent ? 'Saving...' : 'Save Event'}
                  </Button>
                </div>
              </form>
            )}

            {eventsLoading ? (
              <div className="p-3 text-brand-muted text-xs">Loading payout events...</div>
            ) : events.length === 0 ? (
              <div className="p-3 bg-brand-bg border border-brand-dark/15 text-brand-muted text-center text-xs">
                No child payout events recorded for this month yet.
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((evt) => (
                  <div key={evt.id} className="p-2.5 bg-brand-bg border border-brand-dark/20 space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-bold text-brand-navy">{formatPaymentMethod(evt.payment_method)}</span>
                      <span className="font-mono text-brand-muted">{formatCalendarDate(evt.payment_date)}</span>
                    </div>
                    {evt.transaction_reference && (
                      <div className="font-mono text-[10px] text-brand-muted">
                        Ref: {evt.transaction_reference}
                      </div>
                    )}
                    {evt.note && (
                      <p className="text-[11px] text-brand-dark italic bg-white/60 p-1 border border-brand-dark/10">
                        "{evt.note}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Private Admin Notes */}
          <div className="space-y-2">
            <span className="font-heading font-bold text-brand-navy uppercase text-[11px] block border-b border-brand-dark/15 pb-1">
              4. Private Administrator Notes
            </span>

            {notesLoading ? (
              <div className="p-3 text-brand-muted text-xs">Loading notes...</div>
            ) : notes.length === 0 ? (
              <div className="p-3 bg-brand-bg border border-brand-dark/15 text-brand-muted text-center text-xs">
                No private admin notes recorded yet.
              </div>
            ) : (
              <div className="space-y-2">
                {notes.map((n) => (
                  <div key={n.id} className="p-2.5 bg-brand-bg border border-brand-dark/20 text-xs space-y-1">
                    <p className="font-sans text-brand-dark">{n.note}</p>
                    <span className="font-mono text-[10px] text-brand-muted block">
                      {n.created_at ? formatLocalDate(new Date(n.created_at)) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSaveInlineNote} className="space-y-2 pt-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add private note (visible to admins only)..."
                className="w-full p-2 border border-brand-dark bg-white text-xs"
              />
              <div className="flex justify-end">
                <Button variant="outline" size="sm" type="submit" disabled={isAddingNote || !newNote.trim()}>
                  {isAddingNote ? 'Saving...' : 'Add Note'}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Drawer Action Footer */}
        <div className="p-4 border-t-2 border-brand-dark bg-brand-paper flex items-center justify-between gap-2 sticky bottom-0">
          <Button variant="outline" size="sm" onClick={onDelete} className="text-red-700 border-red-300 hover:bg-red-50" leftIcon={<Trash2 className="w-3.5 h-3.5" />}>
            Delete
          </Button>

          <Button variant="primary" size="sm" onClick={onEdit} leftIcon={<Edit2 className="w-3.5 h-3.5" />}>
            Update Status
          </Button>
        </div>
      </div>
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recalculate end/due date when start date changes
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
      setError('Please select an active program enrollment.');
      return;
    }

    const enrollment = enrollments.find((enr) => enr.id === selectedEnrollmentId);
    if (!enrollment) {
      setError('Invalid enrollment selected.');
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
        payment_date: paymentDate || null,
      });

      if (res.error) throw res.error;
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create student payment cycle.');
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
          <div className="p-3 bg-red-50 border border-red-500 text-red-900 text-xs font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
          {/* Step 1: Select Enrollment */}
          <div>
            <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
              Select Enrolled Scholar:
            </label>
            <select
              required
              value={selectedEnrollmentId}
              onChange={(e) => setSelectedEnrollmentId(e.target.value)}
              className="w-full p-2 border-2 border-brand-dark bg-white font-sans text-xs focus:outline-none"
            >
              <option value="">-- Choose active enrollment --</option>
              {enrollments.map((enr) => {
                const s = studentsMap.get(enr.student_id);
                const p = programsMap.get(enr.program_id);
                return (
                  <option key={enr.id} value={enr.id}>
                    {s?.full_name || 'Scholar'} ({s?.poraplan_id || ''}) — {p?.name || 'Program'}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Step 2: Cycle Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
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
              <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
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

            <div>
              <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
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

          {/* Step 3: Status & Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
                Payment Status:
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StudentPaymentStatus)}
                className="w-full p-2 border-2 border-brand-dark bg-white text-xs focus:outline-none"
              >
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="waived">Waived</option>
              </select>
            </div>

            <div>
              <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
                Payment Method:
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full p-2 border-2 border-brand-dark bg-white text-xs focus:outline-none"
              >
                <option value="">None / Pending</option>
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="upay">Upay</option>
                <option value="bank">Bank Transfer</option>
                <option value="cash">Cash</option>
              </select>
            </div>
          </div>

          {/* Step 4: Transaction Reference & Payment Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
                Transaction Reference:
              </label>
              <input
                type="text"
                placeholder="e.g. TRX1029384"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                className="w-full p-2 border-2 border-brand-dark bg-white font-mono text-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
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

          {/* Duplicate Reference Warning Callout */}
          {duplicateWarning && (
            <div className="p-2.5 bg-amber-50 border border-amber-300 text-amber-900 text-[11px] flex items-start gap-1.5">
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
  allKnownReferences: Map<string, { type: string; id: string; date: string }>;
  onClose: () => void;
  onSuccess: () => void;
}

const EditStudentPaymentModal: React.FC<EditStudentModalProps> = ({
  record,
  allKnownReferences,
  onClose,
  onSuccess,
}) => {
  const [status, setStatus] = useState<StudentPaymentStatus>(record.status);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>(record.payment_method || '');
  const [transactionRef, setTransactionRef] = useState(record.transaction_reference || '');
  const [paymentDate, setPaymentDate] = useState(record.payment_date || '');
  const [nextDueDate, setNextDueDate] = useState(record.next_due_date);
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

        {error && (
          <div className="p-3 bg-red-50 border border-red-500 text-red-900 text-xs font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
          <div className="p-3 bg-brand-bg border border-brand-dark/20 text-xs">
            <span className="font-mono text-brand-muted text-[10px] block">Billing Cycle:</span>
            <span className="font-mono font-bold text-brand-navy">
              {formatCalendarDate(record.cycle_start_date)} – {formatCalendarDate(record.cycle_end_date)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
                Payment Status:
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StudentPaymentStatus)}
                className="w-full p-2 border-2 border-brand-dark bg-white text-xs focus:outline-none"
              >
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="waived">Waived</option>
              </select>
            </div>

            <div>
              <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
                Payment Method:
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full p-2 border-2 border-brand-dark bg-white text-xs focus:outline-none"
              >
                <option value="">None / Pending</option>
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="upay">Upay</option>
                <option value="bank">Bank Transfer</option>
                <option value="cash">Cash</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
                Transaction Reference:
              </label>
              <input
                type="text"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                className="w-full p-2 border-2 border-brand-dark bg-white font-mono text-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
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
            <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
              Next Due Date:
            </label>
            <input
              type="date"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
              className="w-full p-2 border-2 border-brand-dark bg-white font-mono text-xs focus:outline-none"
            />
          </div>

          {status === 'waived' && (
            <div>
              <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
                Waiver Reason (Mandatory):
              </label>
              <textarea
                rows={2}
                required
                value={waivedReason}
                onChange={(e) => setWaivedReason(e.target.value)}
                placeholder="Explain why this scholar cycle is waived (scholarship, administrative override)..."
                className="w-full p-2 border-2 border-brand-dark bg-white text-xs focus:outline-none"
              />
            </div>
          )}

          {duplicateWarning && (
            <div className="p-2.5 bg-amber-50 border border-amber-300 text-amber-900 text-[11px] flex items-start gap-1.5">
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
              {isSubmitting ? 'Updating...' : 'Save Updates'}
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
  const [relatedStudentId, setRelatedStudentId] = useState('');
  const [billingMonth, setBillingMonth] = useState(() => {
    const today = toBangladeshDateStr();
    return today.substring(0, 7);
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
        payout_date: payoutDate || null,
      });

      if (res.error) throw res.error;
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create mentor payout record.');
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
          <div className="p-3 bg-red-50 border border-red-500 text-red-900 text-xs font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
          <div>
            <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
              Select Mentor:
            </label>
            <select
              required
              value={selectedMentorId}
              onChange={(e) => setSelectedMentorId(e.target.value)}
              className="w-full p-2 border-2 border-brand-dark bg-white text-xs focus:outline-none"
            >
              <option value="">-- Choose mentor --</option>
              {mentors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} ({m.email})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
                Billing Month (YYYY-MM):
              </label>
              <input
                type="month"
                required
                value={billingMonth}
                onChange={(e) => setBillingMonth(e.target.value)}
                className="w-full p-2 border-2 border-brand-dark bg-white font-mono text-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
                Payout Status:
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MentorPaymentStatus)}
                className="w-full p-2 border-2 border-brand-dark bg-white text-xs focus:outline-none"
              >
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
              Related Scholar Context (Optional):
            </label>
            <select
              value={relatedStudentId}
              onChange={(e) => setRelatedStudentId(e.target.value)}
              className="w-full p-2 border-2 border-brand-dark bg-white text-xs focus:outline-none"
            >
              <option value="">-- General / Cohort Pool Payout --</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  Scholar: {s.full_name} ({s.poraplan_id || ''})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
                Payment Method:
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full p-2 border-2 border-brand-dark bg-white text-xs focus:outline-none"
              >
                <option value="">None / Pending</option>
                <option value="bank">Bank Transfer</option>
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="upay">Upay</option>
                <option value="cash">Cash</option>
              </select>
            </div>

            <div>
              <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
                Disbursement Date:
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
            <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
              Transaction Reference (Optional):
            </label>
            <input
              type="text"
              placeholder="e.g. MTRX-202611-01"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              className="w-full p-2 border-2 border-brand-dark bg-white font-mono text-xs focus:outline-none"
            />
          </div>

          {duplicateWarning && (
            <div className="p-2.5 bg-amber-50 border border-amber-300 text-amber-900 text-[11px] flex items-start gap-1.5">
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
              {isSubmitting ? 'Recording...' : 'Record Payout'}
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
  allKnownReferences: Map<string, { type: string; id: string; date: string }>;
  onClose: () => void;
  onSuccess: () => void;
}

const EditMentorPayoutModal: React.FC<EditMentorModalProps> = ({
  record,
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

        {error && (
          <div className="p-3 bg-red-50 border border-red-500 text-red-900 text-xs font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
          <div className="p-3 bg-brand-bg border border-brand-dark/20 text-xs">
            <span className="font-mono text-brand-muted text-[10px] block">Billing Month:</span>
            <span className="font-heading font-bold text-brand-navy">
              {formatBillingMonth(record.billing_month)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
                Payout Status:
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MentorPaymentStatus)}
                className="w-full p-2 border-2 border-brand-dark bg-white text-xs focus:outline-none"
              >
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            <div>
              <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
                Payment Method:
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full p-2 border-2 border-brand-dark bg-white text-xs focus:outline-none"
              >
                <option value="">None / Pending</option>
                <option value="bank">Bank Transfer</option>
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="upay">Upay</option>
                <option value="cash">Cash</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
                Transaction Reference:
              </label>
              <input
                type="text"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                className="w-full p-2 border-2 border-brand-dark bg-white font-mono text-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="font-heading font-bold uppercase text-brand-navy block mb-1">
                Disbursement Date:
              </label>
              <input
                type="date"
                value={payoutDate}
                onChange={(e) => setPayoutDate(e.target.value)}
                className="w-full p-2 border-2 border-brand-dark bg-white font-mono text-xs focus:outline-none"
              />
            </div>
          </div>

          {duplicateWarning && (
            <div className="p-2.5 bg-amber-50 border border-amber-300 text-amber-900 text-[11px] flex items-start gap-1.5">
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
              {isSubmitting ? 'Updating...' : 'Save Updates'}
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
  recordTitle: string;
  events: PaymentEvent[];
  loading: boolean;
  allKnownReferences: Map<string, { type: string; id: string; date: string }>;
  onClose: () => void;
  onEventCreated: (evt: PaymentEvent) => void;
}

const PaymentEventsModal: React.FC<PaymentEventsModalProps> = ({
  recordType,
  recordId,
  recordTitle,
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
      <div className="bg-brand-paper border-2 border-brand-dark shadow-brutal p-5 sm:p-6 w-full max-w-lg space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
          <div>
            <h3 className="font-heading font-extrabold text-brand-navy text-sm sm:text-base flex items-center gap-2">
              <History className="w-4 h-4 text-brand-teal" />
              Payment Events & Installment History
            </h3>
            <span className="font-mono text-[10px] text-brand-muted">{recordTitle}</span>
          </div>
          <button type="button" onClick={onClose} className="hover:opacity-75">
            <X className="w-5 h-5 text-brand-dark" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-red-50 border border-red-500 text-red-900 text-xs">
            {error}
          </div>
        )}

        {/* Existing Events List */}
        <div className="space-y-2 max-h-56 overflow-y-auto">
          {loading ? (
            <div className="text-xs text-brand-muted p-2">Loading events...</div>
          ) : events.length === 0 ? (
            <div className="p-3 text-center text-xs text-brand-muted">No child payment events recorded yet.</div>
          ) : (
            events.map((evt) => (
              <div key={evt.id} className="p-2.5 bg-brand-bg border border-brand-dark/20 text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-brand-navy">{formatPaymentMethod(evt.payment_method)}</span>
                  <span className="font-mono text-[11px] text-brand-muted">{formatCalendarDate(evt.payment_date)}</span>
                </div>
                {evt.transaction_reference && (
                  <div className="font-mono text-[11px] text-brand-muted">
                    Reference: {evt.transaction_reference}
                  </div>
                )}
                {evt.note && (
                  <div className="text-brand-dark italic bg-white p-1 border border-brand-dark/10">
                    "{evt.note}"
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add Event Form Toggle */}
        {!isAdding ? (
          <div className="pt-2 border-t border-brand-dark/20">
            <Button variant="outline" size="sm" onClick={() => setIsAdding(true)} leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Record New Event
            </Button>
          </div>
        ) : (
          <form onSubmit={handleCreateEvent} className="p-3 bg-brand-bg border border-brand-dark/30 space-y-2 text-xs">
            <span className="font-heading font-bold uppercase text-brand-navy block text-[11px]">
              Record Child Payment Event
            </span>

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
                  <option value="bank">Bank Transfer</option>
                  <option value="cash">Cash</option>
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
              <label className="font-mono text-[10px] uppercase text-brand-muted block">Transaction Reference (Optional):</label>
              <input
                type="text"
                placeholder="e.g. TRX999"
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
