import React, { useState, useEffect } from 'react';
import {
  getCohortMentors,
  getStudentMentorAssignments,
  getEffectiveMentor,
  getEligibleMentorsForProgram,
  getMentorWorkloadSummary,
  assignCohortMentor,
  endCohortMentor,
  assignIndividualMentor,
  endIndividualMentor,
  getAssignmentBadgeVariant,
  getAssignmentLabel,
} from '../../lib/mentorAssignments';
import { getPrograms, getCohorts } from '../../lib/programs';
import { getEnrollments } from '../../lib/applications';
import type {
  CohortMentorWithMeta,
  StudentMentorAssignmentWithMeta,
  EffectiveMentorResolution,
  MentorWorkloadSummary,
  Program,
  Cohort,
  ProgramEnrollmentWithMeta,
  Profile,
} from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  UserCheck,
  GraduationCap,
  Layers,
  Loader2,
  AlertTriangle,
  RotateCcw,
  History,
  Phone,
  Briefcase,
} from 'lucide-react';

export const AdminMentorAssignmentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'cohorts' | 'students' | 'workload'>('cohorts');

  // Master Data
  const [programs, setPrograms] = useState<Program[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [cohortMentors, setCohortMentors] = useState<CohortMentorWithMeta[]>([]);
  const [studentAssignments, setStudentAssignments] = useState<StudentMentorAssignmentWithMeta[]>([]);
  const [enrollments, setEnrollments] = useState<ProgramEnrollmentWithMeta[]>([]);
  const [workload, setWorkload] = useState<MentorWorkloadSummary[]>([]);
  const [studentResolutions, setStudentResolutions] = useState<Record<string, EffectiveMentorResolution>>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [programFilter, setProgramFilter] = useState<string>('all');
  const [cohortFilter, setCohortFilter] = useState<string>('all');
  const [studentSearch, setStudentSearch] = useState<string>('');

  // Cohort Assignment Modal State
  const [cohortModalOpen, setCohortModalOpen] = useState(false);
  const [selectedCohort, setSelectedCohort] = useState<Cohort | null>(null);
  const [eligibleMentorsForCohort, setEligibleMentorsForCohort] = useState<Profile[]>([]);
  const [selectedMentorId, setSelectedMentorId] = useState<string>('');
  const [assignmentNotes, setAssignmentNotes] = useState<string>('');
  const [isSubmittingCohort, setIsSubmittingCohort] = useState(false);

  // Individual Override Modal State
  const [individualModalOpen, setIndividualModalOpen] = useState(false);
  const [selectedStudentEnrollment, setSelectedStudentEnrollment] = useState<ProgramEnrollmentWithMeta | null>(null);
  const [eligibleMentorsForStudent, setEligibleMentorsForStudent] = useState<Profile[]>([]);
  const [selectedIndividualMentorId, setSelectedIndividualMentorId] = useState<string>('');
  const [individualNotes, setIndividualNotes] = useState<string>('');
  const [isSubmittingIndividual, setIsSubmittingIndividual] = useState(false);

  // History Drawer State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyTitle, setHistoryTitle] = useState<string>('');
  const [cohortHistoryList, setCohortHistoryList] = useState<CohortMentorWithMeta[]>([]);
  const [studentHistoryList, setStudentHistoryList] = useState<StudentMentorAssignmentWithMeta[]>([]);

  // Handle Escape key and body scroll lock when modals are open
  useEffect(() => {
    const isAnyModalOpen = cohortModalOpen || individualModalOpen || historyModalOpen;
    if (!isAnyModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (cohortModalOpen && !isSubmittingCohort) setCohortModalOpen(false);
        if (individualModalOpen && !isSubmittingIndividual) setIndividualModalOpen(false);
        if (historyModalOpen) setHistoryModalOpen(false);
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [cohortModalOpen, individualModalOpen, historyModalOpen, isSubmittingCohort, isSubmittingIndividual]);

  // Load all data
  const loadData = async () => {
    try {
      const [progRes, cohRes, cmRes, smaRes, enrRes, wlRes] = await Promise.all([
        getPrograms({ includeUnpublished: true }),
        getCohorts(),
        getCohortMentors(),
        getStudentMentorAssignments(),
        getEnrollments(),
        getMentorWorkloadSummary(),
      ]);

      if (progRes.error) setError(progRes.error.message);
      else setPrograms(progRes.programs);

      if (cohRes.error) setError(cohRes.error.message);
      else setCohorts(cohRes.cohorts);

      if (cmRes.error) setError(cmRes.error.message);
      else setCohortMentors(cmRes.cohortMentors);

      if (smaRes.error) setError(smaRes.error.message);
      else setStudentAssignments(smaRes.assignments);

      if (enrRes.error) setError(enrRes.error.message);
      else {
        setEnrollments(enrRes.enrollments);

        // Resolve effective mentors for all active student enrollments
        const resolutions: Record<string, EffectiveMentorResolution> = {};
        for (const enr of enrRes.enrollments) {
          if (enr.status === 'active') {
            const { resolution } = await getEffectiveMentor(enr.student_id, enr.program_id);
            resolutions[enr.student_id] = resolution;
          }
        }
        setStudentResolutions(resolutions);
      }

      if (wlRes.error) setError(wlRes.error.message);
      else setWorkload(wlRes.workload);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load assignment data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function init() {
      setLoading(true);
      setError(null);
      await loadData();
      if (!isMounted) return;
    }
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  // Open Cohort Assignment Modal
  const handleOpenCohortModal = async (cohort: Cohort) => {
    setSelectedCohort(cohort);
    setSelectedMentorId('');
    setAssignmentNotes('');
    setIsSubmittingCohort(false);
    setError(null);

    // Fetch eligible mentors for this cohort's program
    const { mentors: eligMentors } = await getEligibleMentorsForProgram(cohort.program_id);
    setEligibleMentorsForCohort(eligMentors);
    if (eligMentors.length > 0) {
      setSelectedMentorId(eligMentors[0].id);
    }
    setCohortModalOpen(true);
  };

  // Submit Cohort Assignment
  const handleAssignCohortMentor = async () => {
    if (!selectedCohort || !selectedMentorId) return;
    setIsSubmittingCohort(true);
    setError(null);

    const program = programs.find((p) => p.id === selectedCohort.program_id);
    const mentor = eligibleMentorsForCohort.find((m) => m.id === selectedMentorId);

    const result = await assignCohortMentor({
      cohortId: selectedCohort.id,
      mentorId: selectedMentorId,
      cohortName: selectedCohort.name,
      programName: program?.name,
      mentorName: mentor?.full_name,
      notes: assignmentNotes,
    });

    setIsSubmittingCohort(false);

    if (result.error || !result.success) {
      setError(result.error?.message || result.message);
    } else {
      setSuccessMessage(
        `Mentor ${mentor?.full_name || ''} successfully assigned to ${selectedCohort.name}.`
      );
      setCohortModalOpen(false);
      setSelectedCohort(null);
      await loadData();
    }
  };

  // End Cohort Assignment
  const handleEndCohortMentor = async (cohort: Cohort, activeAssignment: CohortMentorWithMeta) => {
    if (!confirm(`Are you sure you want to end the cohort mentor assignment for ${cohort.name}?`)) {
      return;
    }

    setLoading(true);
    setError(null);

    const result = await endCohortMentor({
      cohortId: cohort.id,
      mentorId: activeAssignment.mentor_id,
      cohortName: cohort.name,
      notes: 'Ended by administrator action.',
    });

    if (result.error || !result.success) {
      setError(result.error?.message || result.message);
      setLoading(false);
    } else {
      setSuccessMessage(`Cohort mentor assignment for ${cohort.name} has concluded.`);
      await loadData();
    }
  };

  // Open Individual Override Modal
  const handleOpenIndividualModal = async (enr: ProgramEnrollmentWithMeta) => {
    setSelectedStudentEnrollment(enr);
    setSelectedIndividualMentorId('');
    setIndividualNotes('');
    setIsSubmittingIndividual(false);
    setError(null);

    const { mentors: eligMentors } = await getEligibleMentorsForProgram(enr.program_id);
    setEligibleMentorsForStudent(eligMentors);
    if (eligMentors.length > 0) {
      setSelectedIndividualMentorId(eligMentors[0].id);
    }
    setIndividualModalOpen(true);
  };

  // Submit Individual Override
  const handleAssignIndividualMentor = async () => {
    if (!selectedStudentEnrollment || !selectedIndividualMentorId) return;
    setIsSubmittingIndividual(true);
    setError(null);

    const program = programs.find((p) => p.id === selectedStudentEnrollment.program_id);
    const mentor = eligibleMentorsForStudent.find((m) => m.id === selectedIndividualMentorId);
    const student = selectedStudentEnrollment.student;

    const result = await assignIndividualMentor({
      studentId: selectedStudentEnrollment.student_id,
      mentorId: selectedIndividualMentorId,
      programId: selectedStudentEnrollment.program_id,
      cohortId: selectedStudentEnrollment.cohort_id || undefined,
      studentName: student?.full_name,
      mentorName: mentor?.full_name,
      programName: program?.name,
      notes: individualNotes,
    });

    setIsSubmittingIndividual(false);

    if (result.error || !result.success) {
      setError(result.error?.message || result.message);
    } else {
      setSuccessMessage(
        `Individual override set: ${mentor?.full_name || 'Mentor'} assigned to ${student?.full_name || 'Student'}.`
      );
      setIndividualModalOpen(false);
      setSelectedStudentEnrollment(null);
      await loadData();
    }
  };

  // End Individual Override (Revert to Cohort Default)
  const handleEndIndividualOverride = async (assignmentId: string, studentName?: string) => {
    if (
      !confirm(
        `Ending this individual override will restore the student's cohort default mentor. Proceed?`
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);

    const result = await endIndividualMentor({
      assignmentId,
      studentName,
      notes: 'Individual override ended by admin. Reverted to cohort default mentor.',
    });

    if (result.error || !result.success) {
      setError(result.error?.message || result.message);
      setLoading(false);
    } else {
      setSuccessMessage(
        `Individual override ended for ${studentName || 'student'}. Reverted to cohort default.`
      );
      await loadData();
    }
  };

  // Open Cohort History
  const handleOpenCohortHistory = (cohort: Cohort) => {
    const history = cohortMentors.filter((cm) => cm.cohort_id === cohort.id);
    setCohortHistoryList(history);
    setStudentHistoryList([]);
    setHistoryTitle(`Cohort Assignment History: ${cohort.name} (${cohort.code})`);
    setHistoryModalOpen(true);
  };

  // Open Student History
  const handleOpenStudentHistory = (studentId: string, studentName?: string) => {
    const history = studentAssignments.filter((sma) => sma.student_id === studentId);
    setStudentHistoryList(history);
    setCohortHistoryList([]);
    setHistoryTitle(`Mentorship Assignment History: ${studentName || 'Student'}`);
    setHistoryModalOpen(true);
  };

  // Metric Computations
  const activeCohortAssignmentsCount = cohortMentors.filter((cm) => cm.is_active).length;
  const activeIndividualOverridesCount = studentAssignments.filter((sma) => sma.is_active).length;
  const activeEnrollments = enrollments.filter((e) => e.status === 'active');
  const studentsWithMentorCount = activeEnrollments.filter(
    (e) => studentResolutions[e.student_id]?.assignment_type !== 'none' && studentResolutions[e.student_id]?.mentor
  ).length;
  const studentsWithoutMentorCount = activeEnrollments.length - studentsWithMentorCount;
  const mentorsCount = workload.length;

  // Filtered Cohorts for Cohort Tab
  const filteredCohorts = cohorts.filter((c) => {
    if (programFilter !== 'all' && c.program_id !== programFilter) return false;
    return true;
  });

  // Filtered Enrollments for Student Tab
  const filteredEnrollments = activeEnrollments.filter((enr) => {
    if (programFilter !== 'all' && enr.program_id !== programFilter) return false;
    if (cohortFilter !== 'all' && enr.cohort_id !== cohortFilter) return false;

    if (studentSearch.trim()) {
      const q = studentSearch.toLowerCase();
      const sName = enr.student?.full_name?.toLowerCase() || '';
      const sId = enr.student?.poraplan_id?.toLowerCase() || '';
      const sEmail = enr.student?.email?.toLowerCase() || '';
      const sUni = enr.student?.university?.toLowerCase() || '';
      const pName = enr.program?.name?.toLowerCase() || '';
      const cName = enr.cohort?.name?.toLowerCase() || '';

      const match =
        sName.includes(q) ||
        sId.includes(q) ||
        sEmail.includes(q) ||
        sUni.includes(q) ||
        pName.includes(q) ||
        cName.includes(q);

      if (!match) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* 1. HEADER & DESK SUMMARY */}
      <div className="border-3 border-brand-dark bg-brand-paper p-6 shadow-brutal">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-brand-bg text-brand-navy border border-brand-dark mb-2">
              <Users className="w-3.5 h-3.5 text-brand-teal" />
              Mentorship Allocations
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-brand-navy">
              Mentor Assignment &amp; Matching Desk
            </h1>
            <p className="text-sm text-brand-navy/70 mt-1 max-w-2xl font-medium">
              Allocate default mentors to cohort groups, set individual student overrides,
              and manage mentor workload allocations with strict precedence resolution.
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
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
              Refresh Allocations
            </Button>
          </div>
        </div>

        {/* Quick Stat Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-6 border-t-2 border-brand-dark/10">
          <div className="p-3 bg-[#0BA7B4]/10 border-2 border-[#0BA7B4]">
            <p className="text-xs font-bold text-brand-navy/70 uppercase">Cohort Mentors</p>
            <p className="text-2xl font-black text-brand-navy mt-0.5">{activeCohortAssignmentsCount}</p>
          </div>
          <div className="p-3 bg-[#F5A623]/10 border-2 border-[#F5A623]">
            <p className="text-xs font-bold text-brand-navy/70 uppercase">Individual Overrides</p>
            <p className="text-2xl font-black text-brand-navy mt-0.5">{activeIndividualOverridesCount}</p>
          </div>
          <div className="p-3 bg-brand-navy/10 border-2 border-brand-dark">
            <p className="text-xs font-bold text-brand-navy/70 uppercase">Students Paired</p>
            <p className="text-2xl font-black text-brand-navy mt-0.5">{studentsWithMentorCount}</p>
          </div>
          <div className="p-3 bg-red-50 border-2 border-red-300">
            <p className="text-xs font-bold text-red-700 uppercase">Unassigned Students</p>
            <p className="text-2xl font-black text-red-800 mt-0.5">{studentsWithoutMentorCount}</p>
          </div>
          <div className="p-3 bg-brand-bg border-2 border-brand-dark">
            <p className="text-xs font-bold text-brand-navy/60 uppercase">Available Mentors</p>
            <p className="text-2xl font-black text-brand-navy mt-0.5">{mentorsCount}</p>
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
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
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
          <button onClick={() => setSuccessMessage(null)} className="text-brand-navy hover:opacity-75">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* 2. TAB CONTROLS */}
      <div className="flex flex-col lg:flex-row border-3 border-brand-dark bg-brand-paper shadow-brutal">
        <button
          onClick={() => setActiveTab('cohorts')}
          className={`flex-1 py-3 px-4 sm:px-6 text-xs sm:text-sm font-black border-b-2 lg:border-b-0 lg:border-r-2 border-brand-dark transition-colors flex items-center justify-center gap-2 text-center ${
            activeTab === 'cohorts'
              ? 'bg-[#0BA7B4] text-white'
              : 'bg-brand-paper text-brand-navy hover:bg-brand-bg'
          }`}
        >
          <GraduationCap className="w-4 h-4 shrink-0" />
          <span>Cohort Default Allocations ({cohorts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`flex-1 py-3 px-4 sm:px-6 text-xs sm:text-sm font-black border-b-2 lg:border-b-0 lg:border-r-2 border-brand-dark transition-colors flex items-center justify-center gap-2 text-center ${
            activeTab === 'students'
              ? 'bg-[#0BA7B4] text-white'
              : 'bg-brand-paper text-brand-navy hover:bg-brand-bg'
          }`}
        >
          <UserCheck className="w-4 h-4 shrink-0" />
          <span>Student Overrides ({activeEnrollments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('workload')}
          className={`flex-1 py-3 px-4 sm:px-6 text-xs sm:text-sm font-black transition-colors flex items-center justify-center gap-2 text-center ${
            activeTab === 'workload'
              ? 'bg-[#0BA7B4] text-white'
              : 'bg-brand-paper text-brand-navy hover:bg-brand-bg'
          }`}
        >
          <Briefcase className="w-4 h-4 shrink-0" />
          <span>Mentor Workload ({workload.length})</span>
        </button>
      </div>

      {/* ============================================================================== */}
      {/* TAB 1: COHORT-LEVEL ASSIGNMENTS */}
      {/* ============================================================================== */}
      {activeTab === 'cohorts' && (
        <div className="space-y-4">
          {/* Program Filter Bar */}
          <div className="border-3 border-brand-dark bg-brand-paper p-4 shadow-brutal flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto min-w-0">
              <span className="text-xs font-black uppercase text-brand-navy tracking-wider shrink-0">
                Filter by Program:
              </span>
              <select
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value)}
                className="w-full sm:w-auto max-w-full px-3 py-1.5 text-xs sm:text-sm border-2 border-brand-dark font-semibold bg-brand-paper focus:outline-none focus:ring-2 focus:ring-brand-teal truncate"
              >
                <option value="all">All Programs ({programs.length})</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs font-mono text-brand-navy/70 shrink-0">
              Showing {filteredCohorts.length} cohorts
            </div>
          </div>

          {/* Cohorts Grid */}
          {loading ? (
            <div className="border-3 border-brand-dark bg-brand-paper p-12 text-center shadow-brutal">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-teal mb-3" />
              <p className="text-sm font-bold text-brand-navy">Loading cohort allocations...</p>
            </div>
          ) : filteredCohorts.length === 0 ? (
            <div className="border-3 border-brand-dark bg-brand-paper p-12 text-center shadow-brutal">
              <GraduationCap className="w-12 h-12 text-brand-navy/30 mx-auto mb-3" />
              <h3 className="text-lg font-black text-brand-navy">No Cohorts Found</h3>
              <p className="text-sm text-brand-navy/70 mt-1">
                No cohorts match the selected program filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCohorts.map((cohort) => {
                const program = programs.find((p) => p.id === cohort.program_id);
                const activeAssignment = cohortMentors.find(
                  (cm) => cm.cohort_id === cohort.id && cm.is_active
                );
                const enrolledCount = enrollments.filter(
                  (e) => e.cohort_id === cohort.id && e.status === 'active'
                ).length;

                return (
                  <div
                    key={cohort.id}
                    className="border-3 border-brand-dark bg-brand-paper p-5 shadow-brutal flex flex-col justify-between space-y-4"
                  >
                    <div>
                      {/* Program & Status Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono text-xs font-bold text-brand-teal uppercase">
                          {program?.name || 'Academic Mentorship'}
                        </span>
                        <Badge
                          variant={cohort.status === 'active' ? 'teal' : 'paper'}
                          size="sm"
                          className="font-bold uppercase"
                        >
                          {cohort.status}
                        </Badge>
                      </div>

                      {/* Cohort Name & Code */}
                      <h3 className="text-lg font-black text-brand-navy">
                        {cohort.name}
                      </h3>
                      <div className="flex items-center gap-2 font-mono text-xs text-brand-navy/70 mt-0.5">
                        <span className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 font-bold">
                          {cohort.code}
                        </span>
                        <span>•</span>
                        <span>{enrolledCount} active students</span>
                      </div>

                      {/* Mentor Status Card */}
                      <div className="mt-4 p-3 bg-brand-bg border-2 border-brand-dark">
                        <p className="text-xs font-bold uppercase tracking-wider text-brand-navy/60 mb-1">
                          Default Cohort Mentor
                        </p>
                        {activeAssignment && activeAssignment.mentor ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-black text-brand-navy">
                                {activeAssignment.mentor.full_name}
                              </span>
                              <Badge variant="gold" size="sm" className="font-bold">
                                Cohort Default
                              </Badge>
                            </div>
                            <div className="text-xs text-brand-navy/70 font-mono">
                              ID: {activeAssignment.mentor.poraplan_id || 'N/A'} • {activeAssignment.mentor.email}
                            </div>
                            {activeAssignment.mentor.whatsapp_number && (
                              <div className="text-xs text-brand-navy/80 flex items-center gap-1 font-mono pt-0.5">
                                <Phone className="w-3 h-3 text-brand-teal" />
                                <span>{activeAssignment.mentor.whatsapp_number}</span>
                              </div>
                            )}
                            <div className="text-[11px] text-brand-navy/60 pt-1 font-mono">
                              Assigned {new Date(activeAssignment.assigned_at).toLocaleDateString()}
                            </div>
                          </div>
                        ) : (
                          <div className="py-1">
                            <p className="text-xs font-bold text-red-600 flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              No default mentor allocated to this cohort
                            </p>
                            <p className="text-[11px] text-brand-navy/60 mt-0.5">
                              Enrolled students currently have no default mentor unless individually overridden.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t-2 border-brand-dark/10 flex items-center justify-between gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenCohortHistory(cohort)}
                        className="gap-1 text-xs font-bold"
                      >
                        <History className="w-3.5 h-3.5" />
                        History
                      </Button>

                      <div className="flex items-center gap-2">
                        {activeAssignment ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEndCohortMentor(cohort, activeAssignment)}
                              className="text-xs text-red-600 border-red-600 hover:bg-red-50 font-bold"
                            >
                              End
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenCohortModal(cohort)}
                              className="text-xs font-bold"
                            >
                              Replace Mentor
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleOpenCohortModal(cohort)}
                            className="text-xs font-bold gap-1"
                          >
                            <Users className="w-3.5 h-3.5" />
                            Assign Mentor
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================================== */}
      {/* TAB 2: INDIVIDUAL STUDENT OVERRIDES */}
      {/* ============================================================================== */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          {/* Search and Filters */}
          <div className="border-3 border-brand-dark bg-brand-paper p-4 shadow-brutal">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              <div className="md:col-span-5 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-navy/50" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search student, PoraPlan ID, university..."
                  className="w-full pl-9 pr-3 py-2 text-sm border-2 border-brand-dark font-medium placeholder-[#082B4C]/40 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </div>

              <div className="md:col-span-4">
                <select
                  value={programFilter}
                  onChange={(e) => {
                    setProgramFilter(e.target.value);
                    setCohortFilter('all');
                  }}
                  className="w-full px-3 py-2 text-sm border-2 border-brand-dark font-semibold bg-brand-paper focus:outline-none focus:ring-2 focus:ring-brand-teal"
                >
                  <option value="all">All Programs ({programs.length})</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <select
                  value={cohortFilter}
                  onChange={(e) => setCohortFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm border-2 border-brand-dark font-semibold bg-brand-paper focus:outline-none focus:ring-2 focus:ring-brand-teal"
                >
                  <option value="all">All Cohorts</option>
                  {cohorts
                    .filter((c) => programFilter === 'all' || c.program_id === programFilter)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>

          {/* Student Roster Table */}
          {loading ? (
            <div className="border-3 border-brand-dark bg-brand-paper p-12 text-center shadow-brutal">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-teal mb-3" />
              <p className="text-sm font-bold text-brand-navy">Loading student roster &amp; resolutions...</p>
            </div>
          ) : filteredEnrollments.length === 0 ? (
            <div className="border-3 border-brand-dark bg-brand-paper p-12 text-center shadow-brutal">
              <UserCheck className="w-12 h-12 text-brand-navy/30 mx-auto mb-3" />
              <h3 className="text-lg font-black text-brand-navy">No Students Found</h3>
              <p className="text-sm text-brand-navy/70 mt-1">
                No active student enrollments match your filters.
              </p>
            </div>
          ) : (
            <div className="border-3 border-brand-dark bg-brand-paper shadow-brutal overflow-hidden">
              {/* Mobile & Tablet Responsive Cards (< lg: 1024px) */}
              <div className="lg:hidden p-3 sm:p-4 space-y-3 bg-brand-bg">
                {filteredEnrollments.map((enr) => {
                  const student = enr.student;
                  const resolution = studentResolutions[enr.student_id];
                  const effectiveMentor = resolution?.mentor;
                  const assignType = resolution?.assignment_type || 'none';
                  const isIndividual = assignType === 'individual';

                  return (
                    <div
                      key={enr.id}
                      className="border-2 border-brand-dark bg-brand-paper p-3.5 sm:p-4 shadow-brutal-xs space-y-3"
                    >
                      {/* Header: Student Name + ID + Assignment Badge */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0">
                          <div className="font-black text-brand-navy flex flex-wrap items-center gap-1.5 leading-tight">
                            <span className="truncate">{student?.full_name || 'Student'}</span>
                            {student?.poraplan_id && (
                              <span className="font-mono text-[11px] px-1.5 py-0.5 bg-brand-bg border border-brand-dark/30 font-bold shrink-0">
                                {student.poraplan_id}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-brand-navy/70 font-medium mt-0.5 truncate">
                            {student?.university || 'University'} • Sem {student?.current_semester || 'N/A'}
                          </div>
                        </div>

                        <Badge
                          variant={getAssignmentBadgeVariant(assignType)}
                          size="sm"
                          className="font-bold uppercase tracking-wide shrink-0"
                        >
                          {getAssignmentLabel(assignType)}
                        </Badge>
                      </div>

                      {/* Academic Context Box */}
                      <div className="p-2.5 bg-brand-bg border border-brand-dark/20 text-xs space-y-1.5">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-brand-muted font-mono uppercase text-[10px] shrink-0 font-bold">
                            Program &amp; Cohort
                          </span>
                          <div className="text-right leading-tight min-w-0">
                            <div className="font-bold text-brand-navy truncate">{enr.program?.name}</div>
                            <div className="text-[11px] text-brand-navy/70 font-mono font-medium truncate">
                              {enr.cohort?.name} ({enr.cohort?.code})
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between items-center gap-2 pt-1 border-t border-brand-dark/10">
                          <span className="text-brand-muted font-mono uppercase text-[10px] shrink-0 font-bold">
                            Effective Mentor
                          </span>
                          <div className="text-right">
                            {effectiveMentor ? (
                              <div>
                                <div className="font-black text-brand-navy flex items-center justify-end gap-1 text-[11px]">
                                  <span>{effectiveMentor.full_name}</span>
                                  {effectiveMentor.poraplan_id && (
                                    <span className="font-mono text-[10px] text-brand-teal font-bold">
                                      ({effectiveMentor.poraplan_id})
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-brand-navy/70 font-mono truncate">
                                  {effectiveMentor.email}
                                </div>
                              </div>
                            ) : (
                              <span className="text-[11px] font-bold text-red-600 flex items-center gap-1 justify-end">
                                <AlertTriangle className="w-3 h-3" />
                                No Mentor Assigned
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleOpenStudentHistory(enr.student_id, student?.full_name)
                          }
                          className="w-full min-h-[44px] flex items-center justify-center text-xs font-bold"
                        >
                          Allocation History
                        </Button>

                        {isIndividual && resolution?.assignment_id ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleEndIndividualOverride(
                                resolution.assignment_id!,
                                student?.full_name
                              )
                            }
                            className="w-full min-h-[44px] flex items-center justify-center text-xs font-bold text-amber-700 border-amber-600 hover:bg-amber-50 gap-1"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Revert to Default
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleOpenIndividualModal(enr)}
                            className="w-full min-h-[44px] flex items-center justify-center text-xs font-bold gap-1"
                          >
                            <Users className="w-3.5 h-3.5" />
                            Override Mentor
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table (>= lg: 1024px) */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-3 border-brand-dark bg-brand-bg text-xs font-black uppercase text-brand-navy tracking-wider">
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Program &amp; Cohort</th>
                      <th className="py-3 px-4">Effective Mentor</th>
                      <th className="py-3 px-4">Assignment Level</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-[#082B4C]/10 text-sm">
                    {filteredEnrollments.map((enr) => {
                      const student = enr.student;
                      const resolution = studentResolutions[enr.student_id];
                      const effectiveMentor = resolution?.mentor;
                      const assignType = resolution?.assignment_type || 'none';
                      const isIndividual = assignType === 'individual';

                      return (
                        <tr key={enr.id} className="hover:bg-brand-bg/80 transition-colors">
                          {/* Student */}
                          <td className="py-3 px-4">
                            <div className="font-black text-brand-navy flex items-center gap-2">
                              <span>{student?.full_name || 'Student'}</span>
                              {student?.poraplan_id && (
                                <span className="font-mono text-xs px-1.5 py-0.2 bg-brand-bg border border-brand-dark/30 font-bold">
                                  {student.poraplan_id}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-brand-navy/70 font-medium">
                              {student?.university || 'University'} • Sem {student?.current_semester || 'N/A'}
                            </div>
                          </td>

                          {/* Program & Cohort */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-brand-navy">{enr.program?.name}</div>
                            <div className="text-xs text-brand-navy/70 font-mono font-medium">
                              {enr.cohort?.name} ({enr.cohort?.code})
                            </div>
                          </td>

                          {/* Effective Mentor */}
                          <td className="py-3 px-4">
                            {effectiveMentor ? (
                              <div>
                                <div className="font-black text-brand-navy flex items-center gap-1.5">
                                  <span>{effectiveMentor.full_name}</span>
                                  {effectiveMentor.poraplan_id && (
                                    <span className="font-mono text-xs text-brand-teal font-bold">
                                      ({effectiveMentor.poraplan_id})
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-brand-navy/70 font-mono">
                                  {effectiveMentor.email}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                No Mentor Assigned
                              </span>
                            )}
                          </td>

                          {/* Assignment Level Badge */}
                          <td className="py-3 px-4">
                            <Badge
                              variant={getAssignmentBadgeVariant(assignType)}
                              size="sm"
                              className="font-bold uppercase tracking-wide"
                            >
                              {getAssignmentLabel(assignType)}
                            </Badge>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleOpenStudentHistory(enr.student_id, student?.full_name)
                                }
                                className="text-xs font-bold"
                              >
                                History
                              </Button>

                              {isIndividual && resolution?.assignment_id ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleEndIndividualOverride(
                                      resolution.assignment_id!,
                                      student?.full_name
                                    )
                                  }
                                  className="text-xs font-bold text-amber-700 border-amber-600 hover:bg-amber-50 gap-1"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  Revert to Default
                                </Button>
                              ) : (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleOpenIndividualModal(enr)}
                                  className="text-xs font-bold gap-1"
                                >
                                  <Users className="w-3.5 h-3.5" />
                                  Override Mentor
                                </Button>
                              )}
                            </div>
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

      {/* ============================================================================== */}
      {/* TAB 3: MENTOR WORKLOAD DISTRIBUTION */}
      {/* ============================================================================== */}
      {activeTab === 'workload' && (
        <div className="space-y-4">
          <div className="border-3 border-brand-dark bg-brand-paper p-6 shadow-brutal">
            <h2 className="text-lg font-black text-brand-navy flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-brand-teal" />
              Mentor Capacity &amp; Allocation Distribution
            </h2>
            <p className="text-xs text-brand-navy/70 mt-1">
              Informational workload distribution overview. Students with individual overrides
              are deduplicated so they are not double-counted across cohort and individual tallies.
            </p>
          </div>

          <div className="border-3 border-brand-dark bg-brand-paper shadow-brutal overflow-hidden">
            {/* Compact Responsive Table (< lg: 1024px) */}
            <div className="lg:hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b-2 border-brand-dark bg-brand-bg text-[10.5px] font-black uppercase text-brand-navy tracking-wider">
                    <th scope="col" className="py-2.5 px-3">Mentor &amp; Contact</th>
                    <th scope="col" className="py-2.5 px-2 text-center">Workload Allocation</th>
                    <th scope="col" className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#082B4C]/10">
                  {workload.map((w) => (
                    <tr key={w.mentor.id} className="hover:bg-brand-bg/50 transition-colors">
                      {/* Column 1: Mentor & Contact */}
                      <td className="py-2.5 px-3 align-top">
                        <div className="font-black text-brand-navy leading-snug">
                          {w.mentor.full_name}
                        </div>
                        {w.mentor.poraplan_id && (
                          <div className="font-mono text-[10px] text-brand-teal font-bold mt-0.5">
                            {w.mentor.poraplan_id}
                          </div>
                        )}
                        <div className="text-[11px] text-brand-navy/70 font-medium mt-0.5 line-clamp-1">
                          {w.mentor.academic_background || w.mentor.expertise || 'Mentor'}
                        </div>
                        <div className="font-mono text-[10.5px] text-brand-muted mt-1 break-all">
                          {w.mentor.email}
                        </div>
                        {w.mentor.whatsapp_number && (
                          <div className="text-brand-teal flex items-center gap-1 mt-0.5 font-mono text-[10.5px]">
                            <Phone className="w-2.5 h-2.5 shrink-0" />
                            <span>{w.mentor.whatsapp_number}</span>
                          </div>
                        )}
                      </td>

                      {/* Column 2: Workload Breakdown */}
                      <td className="py-2.5 px-2 text-center align-top whitespace-nowrap">
                        <div className="inline-block px-2 py-0.5 bg-[#0BA7B4]/20 border border-[#0BA7B4] font-black text-xs sm:text-sm text-brand-navy">
                          {w.totalEffectiveMenteesCount} Mentees
                        </div>
                        <div className="text-[10px] font-mono text-brand-muted mt-1 space-y-0.5">
                          <div>Cohorts: <strong className="text-brand-navy">{w.activeCohortsCount}</strong></div>
                          <div>Overrides: <strong className="text-brand-navy">{w.individualOverridesCount}</strong></div>
                        </div>
                      </td>

                      {/* Column 3: Status */}
                      <td className="py-2.5 px-3 text-right align-top">
                        <Badge
                          variant={w.mentor.status === 'active' ? 'teal' : 'paper'}
                          size="sm"
                        >
                          {w.mentor.status?.toUpperCase() || 'ACTIVE'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Desktop Table (>= lg: 1024px) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-3 border-brand-dark bg-brand-bg text-xs font-black uppercase text-brand-navy tracking-wider">
                    <th className="py-3 px-4">Mentor</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4 text-center">Active Cohorts</th>
                    <th className="py-3 px-4 text-center">Individual Overrides</th>
                    <th className="py-3 px-4 text-center">Effective Mentees</th>
                    <th className="py-3 px-4">Account Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-[#082B4C]/10 text-sm">
                  {workload.map((w) => (
                    <tr key={w.mentor.id} className="hover:bg-brand-bg/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-black text-brand-navy flex items-center gap-2">
                          <span>{w.mentor.full_name}</span>
                          {w.mentor.poraplan_id && (
                            <span className="font-mono text-xs px-1.5 py-0.2 bg-brand-bg border border-brand-dark/30 font-bold">
                              {w.mentor.poraplan_id}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-brand-navy/70 font-medium">
                          {w.mentor.academic_background || w.mentor.expertise || 'Mentor'}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-xs text-brand-navy">
                        <div>{w.mentor.email}</div>
                        {w.mentor.whatsapp_number && (
                          <div className="text-brand-teal flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" />
                            <span>{w.mentor.whatsapp_number}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center font-bold text-base text-brand-navy">
                        <span className="px-2.5 py-0.5 bg-gray-100 border border-gray-300">
                          {w.activeCohortsCount}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center font-bold text-base text-brand-navy">
                        <span className="px-2.5 py-0.5 bg-[#F5A623]/20 border border-[#F5A623]">
                          {w.individualOverridesCount}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="px-3 py-1 bg-[#0BA7B4]/20 border-2 border-[#0BA7B4] font-black text-base text-brand-navy">
                          {w.totalEffectiveMenteesCount}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <Badge
                          variant={w.mentor.status === 'active' ? 'teal' : 'paper'}
                          size="sm"
                        >
                          {w.mentor.status?.toUpperCase() || 'ACTIVE'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL 1: ASSIGN / REPLACE COHORT DEFAULT MENTOR */}
      {/* ============================================================================== */}
      {cohortModalOpen && selectedCohort && (
        <div
          className="fixed inset-0 z-50 bg-brand-navy/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cohort-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmittingCohort) {
              setCohortModalOpen(false);
            }
          }}
        >
          <div
            className="bg-brand-paper border-3 border-brand-dark shadow-brutal-xl max-w-lg w-full max-h-[85dvh] flex flex-col p-4 sm:p-6 animate-in fade-in zoom-in-95 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 sm:pb-4 border-b-2 border-brand-dark/10 shrink-0">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold uppercase tracking-wider bg-[#0BA7B4]/10 text-brand-navy border border-[#0BA7B4] mb-1.5">
                  <GraduationCap className="w-3 h-3 text-brand-teal" />
                  Cohort Mentorship
                </div>
                <h2 id="cohort-modal-title" className="text-xl font-black text-brand-navy">
                  Assign Default Mentor
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCohortModalOpen(false)}
                disabled={isSubmittingCohort}
                className="p-2 -mr-1 text-brand-navy/60 hover:text-brand-navy min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 py-3 space-y-4 pr-1">
              {/* Target Cohort Summary */}
              <div className="p-3 bg-brand-bg border-2 border-brand-dark space-y-1">
                <p className="text-xs font-bold uppercase text-brand-navy/60">Target Cohort</p>
                <p className="text-base font-black text-brand-navy">
                  {selectedCohort.name} ({selectedCohort.code})
                </p>
                <p className="text-xs text-brand-navy/70">
                  Program:{' '}
                  {programs.find((p) => p.id === selectedCohort.program_id)?.name || 'Mentorship Program'}
                </p>
                <p className="text-xs font-mono text-brand-teal pt-1">
                  Notice: All enrolled students in this cohort will inherit this mentor unless an
                  individual override is assigned.
                </p>
              </div>

              {/* Select Mentor */}
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase text-brand-navy tracking-wider">
                  Select Eligible Mentor
                </label>
                {eligibleMentorsForCohort.length === 0 ? (
                  <div className="p-3 bg-red-50 border-2 border-red-300 text-xs font-bold text-red-800">
                    No active mentors found. Provision mentor accounts from the Admin Dashboard first.
                  </div>
                ) : (
                  <select
                    value={selectedMentorId}
                    onChange={(e) => setSelectedMentorId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border-2 border-brand-dark font-semibold bg-brand-paper focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  >
                    {eligibleMentorsForCohort.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} ({m.poraplan_id || 'ID'}) — {m.email}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Admin Notes */}
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase text-brand-navy tracking-wider">
                  Internal Allocation Notes (Optional)
                </label>
                <textarea
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  placeholder="e.g. Lead academic mentor for undergraduate batch curriculum."
                  rows={2}
                  className="w-full p-2.5 text-xs border-2 border-brand-dark font-medium focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 sm:pt-4 border-t-2 border-brand-dark/10 flex items-center justify-end gap-3 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCohortModalOpen(false)}
                disabled={isSubmittingCohort}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAssignCohortMentor}
                disabled={isSubmittingCohort || !selectedMentorId || eligibleMentorsForCohort.length === 0}
                className="gap-2"
              >
                {isSubmittingCohort ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Confirm Allocation
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL 2: ASSIGN INDIVIDUAL STUDENT OVERRIDE */}
      {/* ============================================================================== */}
      {individualModalOpen && selectedStudentEnrollment && (
        <div
          className="fixed inset-0 z-50 bg-brand-navy/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="individual-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmittingIndividual) {
              setIndividualModalOpen(false);
            }
          }}
        >
          <div
            className="bg-brand-paper border-3 border-brand-dark shadow-brutal-xl max-w-lg w-full max-h-[85dvh] flex flex-col p-4 sm:p-6 animate-in fade-in zoom-in-95 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 sm:pb-4 border-b-2 border-brand-dark/10 shrink-0">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold uppercase tracking-wider bg-[#F5A623]/20 text-brand-navy border border-[#F5A623] mb-1.5">
                  <UserCheck className="w-3 h-3 text-[#F5A623]" />
                  Individual Override
                </div>
                <h2 id="individual-modal-title" className="text-xl font-black text-brand-navy">
                  Set Individual Mentor Override
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIndividualModalOpen(false)}
                disabled={isSubmittingIndividual}
                className="p-2 -mr-1 text-brand-navy/60 hover:text-brand-navy min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 py-3 space-y-4 pr-1">
              {/* Target Student Summary */}
              <div className="p-3 bg-brand-bg border-2 border-brand-dark space-y-1">
                <p className="text-xs font-bold uppercase text-brand-navy/60">Student Details</p>
                <p className="text-base font-black text-brand-navy">
                  {selectedStudentEnrollment.student?.full_name}
                </p>
                <p className="text-xs text-brand-navy/70 font-mono">
                  ID: {selectedStudentEnrollment.student?.poraplan_id || 'N/A'} • {selectedStudentEnrollment.student?.university}
                </p>
                <p className="text-xs text-brand-navy/80 pt-1">
                  <span className="font-bold">Cohort:</span> {selectedStudentEnrollment.cohort?.name} ({selectedStudentEnrollment.cohort?.code})
                </p>
                <p className="text-xs font-mono text-[#F5A623] pt-1">
                  Notice: Setting an individual mentor takes precedence over this cohort&apos;s default mentor for this student only.
                </p>
              </div>

              {/* Select Mentor */}
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase text-brand-navy tracking-wider">
                  Select Eligible Mentor
                </label>
                {eligibleMentorsForStudent.length === 0 ? (
                  <div className="p-3 bg-red-50 border-2 border-red-300 text-xs font-bold text-red-800">
                    No active mentors found. Provision mentor accounts from the Admin Dashboard first.
                  </div>
                ) : (
                  <select
                    value={selectedIndividualMentorId}
                    onChange={(e) => setSelectedIndividualMentorId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border-2 border-brand-dark font-semibold bg-brand-paper focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  >
                    {eligibleMentorsForStudent.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} ({m.poraplan_id || 'ID'}) — {m.email}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Admin Notes */}
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase text-brand-navy tracking-wider">
                  Reason / Override Notes (Optional)
                </label>
                <textarea
                  value={individualNotes}
                  onChange={(e) => setIndividualNotes(e.target.value)}
                  placeholder="e.g. Student requested specialized 1-on-1 algorithm pacing."
                  rows={2}
                  className="w-full p-2.5 text-xs border-2 border-brand-dark font-medium focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 sm:pt-4 border-t-2 border-brand-dark/10 flex items-center justify-end gap-3 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIndividualModalOpen(false)}
                disabled={isSubmittingIndividual}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAssignIndividualMentor}
                disabled={isSubmittingIndividual || !selectedIndividualMentorId || eligibleMentorsForStudent.length === 0}
                className="gap-2"
              >
                {isSubmittingIndividual ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Save Override
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL 3: ASSIGNMENT HISTORY LOG */}
      {/* ============================================================================== */}
      {historyModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-brand-navy/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setHistoryModalOpen(false);
            }
          }}
        >
          <div
            className="bg-brand-paper border-3 border-brand-dark shadow-brutal-xl max-w-xl w-full max-h-[85dvh] flex flex-col p-4 sm:p-6 animate-in fade-in zoom-in-95 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b-2 border-brand-dark/10 shrink-0">
              <div>
                <h3 id="history-modal-title" className="text-base font-black text-brand-navy flex items-center gap-2">
                  <History className="w-4 h-4 text-brand-teal" />
                  {historyTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="p-2 -mr-1 text-brand-navy/60 hover:text-brand-navy min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
                aria-label="Close history modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-3 overflow-y-auto flex-1 space-y-3 pr-1">
              {cohortHistoryList.length > 0 ? (
                cohortHistoryList.map((ch) => (
                  <div
                    key={ch.id}
                    className={`p-3 border-2 ${
                      ch.is_active
                        ? 'border-[#0BA7B4] bg-[#0BA7B4]/10'
                        : 'border-brand-dark/20 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-brand-navy text-sm">
                        {ch.mentor?.full_name || 'Mentor'}
                      </span>
                      <Badge variant={ch.is_active ? 'teal' : 'paper'} size="sm">
                        {ch.is_active ? 'ACTIVE' : 'ENDED'}
                      </Badge>
                    </div>
                    <div className="text-xs text-brand-navy/70 font-mono mt-0.5">
                      Assigned: {new Date(ch.assigned_at).toLocaleDateString()}
                      {ch.ended_at && ` • Ended: ${new Date(ch.ended_at).toLocaleDateString()}`}
                    </div>
                    {ch.notes && (
                      <p className="text-xs text-brand-navy/80 mt-1 italic">&ldquo;{ch.notes}&rdquo;</p>
                    )}
                  </div>
                ))
              ) : studentHistoryList.length > 0 ? (
                studentHistoryList.map((sh) => (
                  <div
                    key={sh.id}
                    className={`p-3 border-2 ${
                      sh.is_active
                        ? 'border-[#F5A623] bg-[#F5A623]/10'
                        : 'border-brand-dark/20 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-brand-navy text-sm">
                        {sh.mentor?.full_name || 'Mentor'}
                      </span>
                      <Badge variant={sh.is_active ? 'gold' : 'paper'} size="sm">
                        {sh.is_active ? 'ACTIVE OVERRIDE' : 'ENDED'}
                      </Badge>
                    </div>
                    <div className="text-xs text-brand-navy/70 font-mono mt-0.5">
                      Assigned: {new Date(sh.assigned_at).toLocaleDateString()}
                      {sh.ended_at && ` • Ended: ${new Date(sh.ended_at).toLocaleDateString()}`}
                    </div>
                    {sh.notes && (
                      <p className="text-xs text-brand-navy/80 mt-1 italic">&ldquo;{sh.notes}&rdquo;</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-center text-brand-navy/60 py-6">
                  No historical records logged yet.
                </p>
              )}
            </div>

            <div className="pt-3 border-t-2 border-brand-dark/10 flex justify-end shrink-0">
              <Button variant="outline" size="sm" onClick={() => setHistoryModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
