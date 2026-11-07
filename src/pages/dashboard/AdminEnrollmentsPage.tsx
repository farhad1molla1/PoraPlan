import React, { useState, useEffect } from 'react';
import {
  getEnrollments,
  updateEnrollmentStatus,
  getEnrollmentStatusBadgeVariant,
  adminManualEnrollStudent,
} from '../../lib/applications';
import { getPrograms, getCohorts } from '../../lib/programs';
import { getAdminUsers } from '../../lib/profiles';
import { getEligibleMentorsForProgram } from '../../lib/mentorAssignments';
import type {
  ProgramEnrollmentWithMeta,
  Program,
  Cohort,
  EnrollmentStatus,
  Profile,
} from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  UserCheck,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Phone,
  Loader2,
  Calendar,
  Layers,
  ChevronRight,
  Filter,
  UserPlus,
} from 'lucide-react';

export const AdminEnrollmentsPage: React.FC = () => {
  const [enrollments, setEnrollments] = useState<ProgramEnrollmentWithMeta[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EnrollmentStatus>('all');
  const [programFilter, setProgramFilter] = useState<string>('all');
  const [cohortFilter, setCohortFilter] = useState<string>('all');

  // Status Change State / Modal
  const [selectedEnrollment, setSelectedEnrollment] = useState<ProgramEnrollmentWithMeta | null>(null);
  const [newStatus, setNewStatus] = useState<EnrollmentStatus>('active');
  const [isUpdating, setIsUpdating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Manual Direct Enrollment Modal State
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [studentsList, setStudentsList] = useState<Profile[]>([]);
  const [eligibleMentors, setEligibleMentors] = useState<Profile[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingMentors, setLoadingMentors] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [selectedCohortId, setSelectedCohortId] = useState('');
  const [selectedMentorId, setSelectedMentorId] = useState('');
  const [enrollmentNotes, setEnrollmentNotes] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  const openEnrollModal = async () => {
    setEnrollModalOpen(true);
    setEnrollError(null);
    setSelectedStudentId('');
    setSelectedProgramId('');
    setSelectedCohortId('');
    setSelectedMentorId('');
    setEnrollmentNotes('');
    setLoadingStudents(true);
    try {
      const res = await getAdminUsers({ role: 'student' });
      setStudentsList(res.users || []);
    } catch {
      // fallback
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleProgramSelection = async (progId: string) => {
    setSelectedProgramId(progId);
    setSelectedCohortId('');
    setSelectedMentorId('');
    if (!progId) {
      setEligibleMentors([]);
      return;
    }
    setLoadingMentors(true);
    try {
      const res = await getEligibleMentorsForProgram(progId);
      setEligibleMentors(res.mentors || []);
    } catch {
      setEligibleMentors([]);
    } finally {
      setLoadingMentors(false);
    }
  };

  const handleDirectEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollError(null);

    if (!selectedStudentId) {
      setEnrollError('Please select a student.');
      return;
    }
    if (!selectedProgramId) {
      setEnrollError('Please select a program.');
      return;
    }
    if (!selectedCohortId) {
      setEnrollError('Please select a cohort.');
      return;
    }

    const studentObj = studentsList.find((s) => s.id === selectedStudentId);
    const progObj = programs.find((p) => p.id === selectedProgramId);
    const cohortObj = cohorts.find((c) => c.id === selectedCohortId);
    const mentorObj = eligibleMentors.find((m) => m.id === selectedMentorId);

    setIsEnrolling(true);
    try {
      const res = await adminManualEnrollStudent({
        studentId: selectedStudentId,
        programId: selectedProgramId,
        cohortId: selectedCohortId,
        mentorId: selectedMentorId || undefined,
        studentName: studentObj?.full_name,
        mentorName: mentorObj?.full_name,
        programName: progObj?.name,
        cohortName: cohortObj?.name,
        notes: enrollmentNotes.trim() || undefined,
      });

      if (!res.success || res.error) {
        setEnrollError(res.message || res.error?.message || 'Enrollment failed.');
      } else {
        setEnrollModalOpen(false);
        setSuccessMessage(`Scholar ${studentObj?.full_name || 'Student'} enrolled successfully in ${progObj?.name || 'Program'}.`);
        await loadData();
      }
    } catch (err: unknown) {
      setEnrollError(err instanceof Error ? err.message : 'An unexpected error occurred during direct enrollment.');
    } finally {
      setIsEnrolling(false);
    }
  };

  const loadData = async () => {
    try {
      const [enrRes, progRes, cohRes] = await Promise.all([
        getEnrollments(),
        getPrograms({ includeUnpublished: true }),
        getCohorts(),
      ]);

      if (enrRes.error) {
        setError(enrRes.error.message);
      } else {
        setEnrollments(enrRes.enrollments);
        setPrograms(progRes.programs);
        setCohorts(cohRes.cohorts);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load enrollments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function init() {
      setLoading(true);
      setError(null);
      try {
        const [enrRes, progRes, cohRes] = await Promise.all([
          getEnrollments(),
          getPrograms({ includeUnpublished: true }),
          getCohorts(),
        ]);
        if (!isMounted) return;
        if (enrRes.error) {
          setError(enrRes.error.message);
        } else {
          setEnrollments(enrRes.enrollments);
          setPrograms(progRes.programs);
          setCohorts(cohRes.cohorts);
        }
      } catch (err: unknown) {
        if (isMounted) setError(err instanceof Error ? err.message : 'Failed to load enrollments');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  const openStatusModal = (enr: ProgramEnrollmentWithMeta) => {
    setSelectedEnrollment(enr);
    setNewStatus(enr.status);
    setModalOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedEnrollment) return;
    setIsUpdating(true);
    setError(null);

    const { enrollment, error: updateError } = await updateEnrollmentStatus(
      selectedEnrollment.id,
      newStatus
    );

    setIsUpdating(false);

    if (updateError || !enrollment) {
      setError(updateError?.message || 'Failed to update enrollment status');
    } else {
      setSuccessMessage(
        `Enrollment for ${selectedEnrollment.student?.full_name || 'student'} updated to "${newStatus.replace('_', ' ').toUpperCase()}".`
      );
      setModalOpen(false);
      setSelectedEnrollment(null);
      // Reload updated list
      await loadData();
    }
  };

  // Filter cohort options when program filter changes
  const filteredCohorts =
    programFilter === 'all'
      ? cohorts
      : cohorts.filter((c) => c.program_id === programFilter);

  // Filtered enrollments
  const filteredEnrollments = enrollments.filter((enr) => {
    // Status
    if (statusFilter !== 'all' && enr.status !== statusFilter) return false;
    // Program
    if (programFilter !== 'all' && enr.program_id !== programFilter) return false;
    // Cohort
    if (cohortFilter !== 'all' && enr.cohort_id !== cohortFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const studentName = enr.student?.full_name?.toLowerCase() || '';
      const email = enr.student?.email?.toLowerCase() || '';
      const poraplanId = enr.student?.poraplan_id?.toLowerCase() || '';
      const uni = enr.student?.university?.toLowerCase() || '';
      const progName = enr.program?.name?.toLowerCase() || '';
      const cohortName = enr.cohort?.name?.toLowerCase() || '';

      const matches =
        studentName.includes(q) ||
        email.includes(q) ||
        poraplanId.includes(q) ||
        uni.includes(q) ||
        progName.includes(q) ||
        cohortName.includes(q);

      if (!matches) return false;
    }

    return true;
  });

  // Metric counts
  const totalCount = enrollments.length;
  const activeCount = enrollments.filter((e) => e.status === 'active').length;
  const onHoldCount = enrollments.filter((e) => e.status === 'on_hold').length;
  const completedCount = enrollments.filter((e) => e.status === 'completed').length;
  const withdrawnCount = enrollments.filter((e) => e.status === 'withdrawn').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-3 border-brand-dark bg-brand-paper p-6 shadow-brutal">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-brand-bg text-brand-navy border border-brand-dark mb-2">
              <UserCheck className="w-3.5 h-3.5 text-brand-teal" />
              Active Roster Desk
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-brand-navy">
              Program Enrollments
            </h1>
            <p className="text-sm text-brand-navy/70 mt-1 max-w-2xl font-medium">
              Manage admitted student rosters across programs and cohorts. Track progress,
              manage cohort participation status, and view academic profiles.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLoading(true);
                loadData();
              }}
              disabled={loading}
              className="gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Layers className="w-4 h-4" />
              )}
              Refresh Roster
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={openEnrollModal}
              className="gap-2 bg-[#0BA7B4] hover:bg-[#0BA7B4]/90 text-white font-bold"
            >
              <UserPlus className="w-4 h-4" />
              Enroll Student
            </Button>
          </div>
        </div>

        {/* Quick Stat Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-6 border-t-2 border-brand-dark/10">
          <div className="p-3 bg-brand-bg border-2 border-brand-dark">
            <p className="text-xs font-bold text-brand-navy/60 uppercase">Total Students</p>
            <p className="text-2xl font-black text-brand-navy mt-0.5">{totalCount}</p>
          </div>
          <div className="p-3 bg-[#0BA7B4]/10 border-2 border-[#0BA7B4]">
            <p className="text-xs font-bold text-brand-navy/70 uppercase">Active</p>
            <p className="text-2xl font-black text-brand-navy mt-0.5">{activeCount}</p>
          </div>
          <div className="p-3 bg-[#F5A623]/10 border-2 border-[#F5A623]">
            <p className="text-xs font-bold text-brand-navy/70 uppercase">On Hold</p>
            <p className="text-2xl font-black text-brand-navy mt-0.5">{onHoldCount}</p>
          </div>
          <div className="p-3 bg-brand-navy/10 border-2 border-brand-dark">
            <p className="text-xs font-bold text-brand-navy/70 uppercase">Completed</p>
            <p className="text-2xl font-black text-brand-navy mt-0.5">{completedCount}</p>
          </div>
          <div className="p-3 bg-gray-100 border-2 border-gray-400">
            <p className="text-xs font-bold text-gray-600 uppercase">Withdrawn</p>
            <p className="text-2xl font-black text-gray-700 mt-0.5">{withdrawnCount}</p>
          </div>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div className="p-4 bg-red-50 border-3 border-red-500 shadow-[4px_4px_0_0_#ef4444] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm font-bold text-red-800">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800"
            aria-label="Dismiss error"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-teal-50 border-3 border-[#0BA7B4] shadow-[4px_4px_0_0_#0BA7B4] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-brand-teal flex-shrink-0" />
            <p className="text-sm font-bold text-brand-navy">{successMessage}</p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-brand-navy hover:opacity-75"
            aria-label="Dismiss alert"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="border-3 border-brand-dark bg-brand-paper p-4 shadow-brutal">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search box */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-navy/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student, ID, university..."
              className="w-full pl-9 pr-3 py-2 text-base sm:text-sm min-h-[44px] sm:min-h-0 border-2 border-brand-dark font-medium placeholder-[#082B4C]/40 focus:outline-none focus:ring-2 focus:ring-brand-teal"
            />
          </div>

          {/* Program filter */}
          <div className="md:col-span-3">
            <select
              value={programFilter}
              onChange={(e) => {
                setProgramFilter(e.target.value);
                setCohortFilter('all');
              }}
              className="w-full px-3 py-2 text-base sm:text-sm min-h-[44px] sm:min-h-0 border-2 border-brand-dark font-semibold bg-brand-paper focus:outline-none focus:ring-2 focus:ring-brand-teal"
            >
              <option value="all">All Programs</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Cohort filter */}
          <div className="md:col-span-3">
            <select
              value={cohortFilter}
              onChange={(e) => setCohortFilter(e.target.value)}
              className="w-full px-3 py-2 text-base sm:text-sm min-h-[44px] sm:min-h-0 border-2 border-brand-dark font-semibold bg-brand-paper focus:outline-none focus:ring-2 focus:ring-brand-teal"
            >
              <option value="all">All Cohorts</option>
              {filteredCohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="md:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-base sm:text-sm min-h-[44px] sm:min-h-0 border-2 border-brand-dark font-semibold bg-brand-paper focus:outline-none focus:ring-2 focus:ring-brand-teal"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Roster List */}
      {loading ? (
        <div className="border-3 border-brand-dark bg-brand-paper p-12 text-center shadow-brutal">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-teal mb-3" />
          <p className="text-sm font-bold text-brand-navy">Loading enrollments roster...</p>
        </div>
      ) : filteredEnrollments.length === 0 ? (
        <div className="border-3 border-brand-dark bg-brand-paper p-12 text-center shadow-brutal">
          <UserCheck className="w-12 h-12 text-brand-navy/30 mx-auto mb-3" />
          <h3 className="text-lg font-black text-brand-navy">No Enrollments Found</h3>
          <p className="text-sm text-brand-navy/70 mt-1 max-w-md mx-auto">
            {searchQuery || statusFilter !== 'all' || programFilter !== 'all' || cohortFilter !== 'all'
              ? 'No enrollments match the selected filters or search query.'
              : 'Students will appear here automatically when their applications are approved.'}
          </p>
          {(searchQuery || statusFilter !== 'all' || programFilter !== 'all' || cohortFilter !== 'all') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setProgramFilter('all');
                setCohortFilter('all');
              }}
              className="mt-4 gap-1.5"
            >
              <Filter className="w-4 h-4" /> Reset Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="border-3 border-brand-dark bg-brand-paper shadow-brutal overflow-hidden">
          {/* Mobile Responsive Cards (< md: 768px) */}
          <div className="md:hidden p-3 sm:p-4 space-y-3 bg-brand-bg">
            {filteredEnrollments.map((enr) => {
              const student = enr.student;
              const program = enr.program;
              const cohort = enr.cohort;

              return (
                <div
                  key={enr.id}
                  className="border-2 border-brand-dark bg-brand-paper p-3.5 sm:p-4 shadow-brutal-xs space-y-3"
                >
                  {/* Student Identity + Status Badge */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 border-2 border-brand-dark bg-[#0BA7B4]/20 flex items-center justify-center font-black text-brand-navy shrink-0 text-sm">
                        {student?.full_name?.charAt(0) || 'S'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-black text-brand-navy flex flex-wrap items-center gap-1.5 leading-tight">
                          <span className="truncate">{student?.full_name || 'Unknown Student'}</span>
                          {student?.poraplan_id && (
                            <span className="font-mono text-[11px] px-1.5 py-0.5 bg-brand-bg border border-brand-dark/30 text-brand-navy/80 font-bold shrink-0">
                              {student.poraplan_id}
                            </span>
                          )}
                        </div>
                        {(student?.university || student?.department || student?.current_semester) && (
                          <div className="text-xs text-brand-navy/70 flex flex-wrap items-center gap-1 mt-0.5 font-medium">
                            {student?.university && <span>{student.university}</span>}
                            {student?.department && (
                              <>
                                <span>•</span>
                                <span>{student.department}</span>
                              </>
                            )}
                            {student?.current_semester && (
                              <>
                                <span>•</span>
                                <span>Sem {student.current_semester}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <Badge
                      variant={getEnrollmentStatusBadgeVariant(enr.status)}
                      size="sm"
                      className="font-bold uppercase tracking-wide shrink-0"
                    >
                      {enr.status.replace('_', ' ')}
                    </Badge>
                  </div>

                  {/* Program, Cohort, & Enrollment Date */}
                  <div className="p-2.5 bg-brand-bg border border-brand-dark/20 text-xs space-y-1.5">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-brand-muted font-mono uppercase text-[10px] shrink-0 font-bold">
                        Program
                      </span>
                      <span className="font-bold text-brand-navy text-right leading-tight">
                        {program?.name || 'General Mentorship'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center gap-2 pt-1 border-t border-brand-dark/10">
                      <span className="text-brand-muted font-mono uppercase text-[10px] shrink-0 font-bold">
                        Cohort
                      </span>
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="font-mono font-semibold px-1 py-0.5 bg-gray-100 border border-gray-300 text-gray-700">
                          {cohort?.name || 'Assigned Cohort'}
                        </span>
                        {cohort?.code && (
                          <span className="text-brand-navy/60 font-mono">({cohort.code})</span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center gap-2 pt-1 border-t border-brand-dark/10">
                      <span className="text-brand-muted font-mono uppercase text-[10px] shrink-0 font-bold">
                        Enrolled
                      </span>
                      <span className="font-mono text-brand-navy/80 text-[11px] flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-brand-teal" />
                        {new Date(enr.enrolled_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openStatusModal(enr)}
                    className="w-full min-h-[44px] flex items-center justify-center gap-1.5 font-bold text-xs"
                  >
                    Manage Status
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Desktop Table (>= md: 768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-3 border-brand-dark bg-brand-bg text-xs font-black uppercase text-brand-navy tracking-wider">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Program & Cohort</th>
                  <th className="py-3 px-4">Enrolled Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#082B4C]/10 text-sm">
                {filteredEnrollments.map((enr) => {
                  const student = enr.student;
                  const program = enr.program;
                  const cohort = enr.cohort;

                  return (
                    <tr
                      key={enr.id}
                      className="hover:bg-brand-bg/80 transition-colors"
                    >
                      {/* Student Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 border-2 border-brand-dark bg-[#0BA7B4]/20 flex items-center justify-center font-black text-brand-navy flex-shrink-0 text-sm">
                            {student?.full_name?.charAt(0) || 'S'}
                          </div>
                          <div>
                            <div className="font-black text-brand-navy flex items-center gap-2">
                              <span>{student?.full_name || 'Unknown Student'}</span>
                              {student?.poraplan_id && (
                                <span className="font-mono text-xs px-1.5 py-0.2 bg-brand-bg border border-brand-dark/30 text-brand-navy/80 font-bold">
                                  {student.poraplan_id}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-brand-navy/70 flex items-center gap-2 mt-0.5 font-medium">
                              {student?.university && (
                                <span>{student.university}</span>
                              )}
                              {student?.department && (
                                <>
                                  <span>•</span>
                                  <span>{student.department}</span>
                                </>
                              )}
                              {student?.current_semester && (
                                <>
                                  <span>•</span>
                                  <span>Sem {student.current_semester}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Program & Cohort */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-brand-navy">
                          {program?.name || 'General Mentorship'}
                        </div>
                        <div className="text-xs text-brand-navy/70 flex items-center gap-1.5 mt-0.5 font-medium">
                          <span className="font-mono font-semibold px-1 py-0.2 bg-gray-100 border border-gray-300 text-gray-700">
                            {cohort?.name || 'Assigned Cohort'}
                          </span>
                          {cohort?.code && (
                            <span className="text-brand-navy/50">({cohort.code})</span>
                          )}
                        </div>
                      </td>

                      {/* Enrolled Date */}
                      <td className="py-3.5 px-4 font-mono text-xs text-brand-navy/80">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-brand-teal" />
                          <span>{new Date(enr.enrolled_at).toLocaleDateString()}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={getEnrollmentStatusBadgeVariant(enr.status)}
                          size="sm"
                          className="font-bold uppercase tracking-wide"
                        >
                          {enr.status.replace('_', ' ')}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openStatusModal(enr)}
                          className="gap-1 font-bold"
                        >
                          Manage Status
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Status Management Modal */}
      {modalOpen && selectedEnrollment && (
        <div className="fixed inset-0 z-50 bg-brand-navy/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-brand-paper border-3 border-brand-dark shadow-brutal-xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b-2 border-brand-dark/10">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold uppercase tracking-wider bg-[#0BA7B4]/10 text-brand-navy border border-[#0BA7B4] mb-1.5">
                  <UserCheck className="w-3 h-3 text-brand-teal" />
                  Enrollment Record
                </div>
                <h2 className="text-xl font-black text-brand-navy">
                  Update Student Enrollment
                </h2>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 border border-transparent hover:border-brand-dark text-brand-navy/60 hover:text-brand-navy"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Student & Program Summary */}
            <div className="mt-4 p-3 bg-brand-bg border-2 border-brand-dark space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-brand-navy">
                    {selectedEnrollment.student?.full_name}
                  </p>
                  <p className="text-xs text-brand-navy/70 font-mono">
                    ID: {selectedEnrollment.student?.poraplan_id || 'N/A'} • {selectedEnrollment.student?.email}
                  </p>
                </div>
                <Badge
                  variant={getEnrollmentStatusBadgeVariant(selectedEnrollment.status)}
                  size="sm"
                >
                  {selectedEnrollment.status.replace('_', ' ')}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-brand-dark/10 text-xs">
                <div>
                  <span className="font-bold text-brand-navy/70">Program: </span>
                  <span className="font-semibold text-brand-navy">
                    {selectedEnrollment.program?.name}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-brand-navy/70">Cohort: </span>
                  <span className="font-semibold text-brand-navy">
                    {selectedEnrollment.cohort?.name}
                  </span>
                </div>
                {selectedEnrollment.student?.university && (
                  <div className="col-span-2">
                    <span className="font-bold text-brand-navy/70">University: </span>
                    <span className="font-semibold text-brand-navy">
                      {selectedEnrollment.student.university} ({selectedEnrollment.student.department || 'N/A'})
                    </span>
                  </div>
                )}
                {selectedEnrollment.student?.whatsapp_number && (
                  <div className="col-span-2 flex items-center gap-1.5 font-mono">
                    <Phone className="w-3 h-3 text-brand-teal" />
                    <span>{selectedEnrollment.student.whatsapp_number}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Status Selector */}
            <div className="mt-5 space-y-2">
              <label className="block text-xs font-black uppercase text-brand-navy tracking-wider">
                Select New Status
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['active', 'on_hold', 'completed', 'withdrawn'] as EnrollmentStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setNewStatus(st)}
                    className={`p-3 text-left border-2 font-bold transition-all ${
                      newStatus === st
                        ? 'border-brand-dark bg-[#0BA7B4]/15 shadow-[2px_2px_0_0_#082B4C]'
                        : 'border-brand-dark/30 bg-brand-paper hover:border-brand-dark'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="capitalize text-sm text-brand-navy">
                        {st.replace('_', ' ')}
                      </span>
                      {newStatus === st && (
                        <CheckCircle2 className="w-4 h-4 text-brand-teal" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t-2 border-brand-dark/10">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleUpdateStatus}
                disabled={isUpdating || newStatus === selectedEnrollment.status}
                className="gap-2"
              >
                {isUpdating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Save Status
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Direct Enrollment Modal */}
      {enrollModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-brand-paper border-3 border-brand-dark shadow-brutal-xl w-full max-w-lg p-6 animate-fade-in">
            <div className="flex items-start justify-between border-b-2 border-brand-dark/10 pb-4">
              <div>
                <h3 className="text-lg font-black text-brand-navy flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-brand-teal" />
                  Direct Student Enrollment
                </h3>
                <p className="text-xs text-brand-navy/70 mt-1">
                  Enroll an existing student directly into an active cohort without requiring a public application.
                </p>
              </div>
              <button
                onClick={() => setEnrollModalOpen(false)}
                className="text-brand-navy/50 hover:text-brand-navy p-1"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {enrollError && (
              <div className="mt-4 p-3 bg-red-50 border-2 border-red-500 text-red-800 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
                <span>{enrollError}</span>
              </div>
            )}

            <form onSubmit={handleDirectEnrollSubmit} className="mt-4 space-y-4">
              {/* 1. Select Student */}
              <div>
                <label className="block text-xs font-black uppercase text-brand-navy tracking-wider mb-1">
                  1. Select Student <span className="text-red-500">*</span>
                </label>
                {loadingStudents ? (
                  <div className="p-2 border-2 border-brand-dark bg-gray-50 text-xs text-brand-navy/60 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading scholars list...
                  </div>
                ) : (
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-base sm:text-sm min-h-[44px] sm:min-h-0 border-2 border-brand-dark font-semibold bg-brand-paper focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  >
                    <option value="">-- Choose Student --</option>
                    {studentsList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} {s.poraplan_id ? `(${s.poraplan_id})` : ''} — {s.email}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 2. Select Program */}
              <div>
                <label className="block text-xs font-black uppercase text-brand-navy tracking-wider mb-1">
                  2. Select Program <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedProgramId}
                  onChange={(e) => handleProgramSelection(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-base sm:text-sm min-h-[44px] sm:min-h-0 border-2 border-brand-dark font-semibold bg-brand-paper focus:outline-none focus:ring-2 focus:ring-brand-teal"
                >
                  <option value="">-- Choose Program --</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.category.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Select Cohort */}
              <div>
                <label className="block text-xs font-black uppercase text-brand-navy tracking-wider mb-1">
                  3. Select Cohort <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedCohortId}
                  onChange={(e) => setSelectedCohortId(e.target.value)}
                  required
                  disabled={!selectedProgramId}
                  className="w-full px-3 py-2 text-base sm:text-sm min-h-[44px] sm:min-h-0 border-2 border-brand-dark font-semibold bg-brand-paper focus:outline-none focus:ring-2 focus:ring-brand-teal disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">
                    {!selectedProgramId ? '-- Select Program First --' : '-- Choose Cohort --'}
                  </option>
                  {cohorts
                    .filter(
                      (c) =>
                        c.program_id === selectedProgramId &&
                        c.status !== 'completed' &&
                        c.publication_status !== 'archived'
                    )
                    .map((c) => {
                      const activeInCohort = enrollments.filter(
                        (e) => e.cohort_id === c.id && e.status === 'active'
                      ).length;
                      const isFull = c.capacity ? activeInCohort >= c.capacity : false;
                      return (
                        <option key={c.id} value={c.id} disabled={isFull}>
                          {c.name} ({c.code}) — Capacity: {activeInCohort}/{c.capacity || '∞'} {isFull ? '(FULL)' : ''}
                        </option>
                      );
                    })}
                </select>
              </div>

              {/* 4. Optional Mentor Allocation */}
              <div>
                <label className="block text-xs font-black uppercase text-brand-navy tracking-wider mb-1 flex items-center justify-between">
                  <span>4. Assign Mentor (Optional)</span>
                  {loadingMentors && <Loader2 className="w-3 h-3 animate-spin text-brand-teal" />}
                </label>
                <select
                  value={selectedMentorId}
                  onChange={(e) => setSelectedMentorId(e.target.value)}
                  disabled={!selectedProgramId || loadingMentors}
                  className="w-full px-3 py-2 text-base sm:text-sm min-h-[44px] sm:min-h-0 border-2 border-brand-dark font-semibold bg-brand-paper focus:outline-none focus:ring-2 focus:ring-brand-teal disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">-- No Direct Mentor (Use Cohort Default) --</option>
                  {eligibleMentors.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} {m.poraplan_id ? `(${m.poraplan_id})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-brand-navy/60 mt-1">
                  Only mentors eligible for the selected program appear here.
                </p>
              </div>

              {/* 5. Remarks / Notes */}
              <div>
                <label className="block text-xs font-black uppercase text-brand-navy tracking-wider mb-1">
                  5. Administrative Remarks
                </label>
                <textarea
                  value={enrollmentNotes}
                  onChange={(e) => setEnrollmentNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional intake rationale, sponsorship details, or special terms..."
                  className="w-full px-3 py-2 text-base sm:text-sm border-2 border-brand-dark font-medium bg-brand-paper focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </div>

              {/* Action buttons */}
              <div className="pt-4 border-t-2 border-brand-dark/10 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEnrollModalOpen(false)}
                  disabled={isEnrolling}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isEnrolling || !selectedStudentId || !selectedProgramId || !selectedCohortId}
                  className="gap-2 bg-[#0BA7B4] hover:bg-[#0BA7B4]/90 text-white font-bold"
                >
                  {isEnrolling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Confirm Direct Enrollment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
