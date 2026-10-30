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
      <div className="border-3 border-[#082B4C] bg-white p-6 shadow-[4px_4px_0_0_#082B4C]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-[#F6FAFB] text-[#082B4C] border border-[#082B4C] mb-2">
              <Users className="w-3.5 h-3.5 text-[#0BA7B4]" />
              Mentorship Allocations
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-[#082B4C]">
              Mentor Assignment &amp; Matching Desk
            </h1>
            <p className="text-sm text-[#082B4C]/70 mt-1 max-w-2xl font-medium">
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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-6 border-t-2 border-[#082B4C]/10">
          <div className="p-3 bg-[#0BA7B4]/10 border-2 border-[#0BA7B4]">
            <p className="text-xs font-bold text-[#082B4C]/70 uppercase">Cohort Mentors</p>
            <p className="text-2xl font-black text-[#082B4C] mt-0.5">{activeCohortAssignmentsCount}</p>
          </div>
          <div className="p-3 bg-[#F5A623]/10 border-2 border-[#F5A623]">
            <p className="text-xs font-bold text-[#082B4C]/70 uppercase">Individual Overrides</p>
            <p className="text-2xl font-black text-[#082B4C] mt-0.5">{activeIndividualOverridesCount}</p>
          </div>
          <div className="p-3 bg-[#082B4C]/10 border-2 border-[#082B4C]">
            <p className="text-xs font-bold text-[#082B4C]/70 uppercase">Students Paired</p>
            <p className="text-2xl font-black text-[#082B4C] mt-0.5">{studentsWithMentorCount}</p>
          </div>
          <div className="p-3 bg-red-50 border-2 border-red-300">
            <p className="text-xs font-bold text-red-700 uppercase">Unassigned Students</p>
            <p className="text-2xl font-black text-red-800 mt-0.5">{studentsWithoutMentorCount}</p>
          </div>
          <div className="p-3 bg-[#F6FAFB] border-2 border-[#082B4C]">
            <p className="text-xs font-bold text-[#082B4C]/60 uppercase">Available Mentors</p>
            <p className="text-2xl font-black text-[#082B4C] mt-0.5">{mentorsCount}</p>
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
            <CheckCircle2 className="w-5 h-5 text-[#0BA7B4] flex-shrink-0" />
            <p className="text-sm font-bold text-[#082B4C]">{successMessage}</p>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-[#082B4C] hover:opacity-75">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* 2. TAB CONTROLS */}
      <div className="flex border-b-3 border-[#082B4C] bg-white shadow-[4px_4px_0_0_#082B4C]">
        <button
          onClick={() => setActiveTab('cohorts')}
          className={`flex-1 sm:flex-none py-3 px-6 text-sm font-black border-r-2 border-[#082B4C] transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'cohorts'
              ? 'bg-[#0BA7B4] text-white'
              : 'bg-white text-[#082B4C] hover:bg-[#F6FAFB]'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          Cohort Default Allocations ({cohorts.length})
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`flex-1 sm:flex-none py-3 px-6 text-sm font-black border-r-2 border-[#082B4C] transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'students'
              ? 'bg-[#0BA7B4] text-white'
              : 'bg-white text-[#082B4C] hover:bg-[#F6FAFB]'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Student Overrides ({activeEnrollments.length})
        </button>

        <button
          onClick={() => setActiveTab('workload')}
          className={`flex-1 sm:flex-none py-3 px-6 text-sm font-black transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'workload'
              ? 'bg-[#0BA7B4] text-white'
              : 'bg-white text-[#082B4C] hover:bg-[#F6FAFB]'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Mentor Workload ({workload.length})
        </button>
      </div>

      {/* ============================================================================== */}
      {/* TAB 1: COHORT-LEVEL ASSIGNMENTS */}
      {/* ============================================================================== */}
      {activeTab === 'cohorts' && (
        <div className="space-y-4">
          {/* Program Filter Bar */}
          <div className="border-3 border-[#082B4C] bg-white p-4 shadow-[4px_4px_0_0_#082B4C] flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-black uppercase text-[#082B4C] tracking-wider">
                Filter by Program:
              </span>
              <select
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value)}
                className="px-3 py-1.5 text-sm border-2 border-[#082B4C] font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#0BA7B4]"
              >
                <option value="all">All Programs ({programs.length})</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs font-mono text-[#082B4C]/70">
              Showing {filteredCohorts.length} cohorts
            </div>
          </div>

          {/* Cohorts Grid */}
          {loading ? (
            <div className="border-3 border-[#082B4C] bg-white p-12 text-center shadow-[4px_4px_0_0_#082B4C]">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#0BA7B4] mb-3" />
              <p className="text-sm font-bold text-[#082B4C]">Loading cohort allocations...</p>
            </div>
          ) : filteredCohorts.length === 0 ? (
            <div className="border-3 border-[#082B4C] bg-white p-12 text-center shadow-[4px_4px_0_0_#082B4C]">
              <GraduationCap className="w-12 h-12 text-[#082B4C]/30 mx-auto mb-3" />
              <h3 className="text-lg font-black text-[#082B4C]">No Cohorts Found</h3>
              <p className="text-sm text-[#082B4C]/70 mt-1">
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
                    className="border-3 border-[#082B4C] bg-white p-5 shadow-[4px_4px_0_0_#082B4C] flex flex-col justify-between space-y-4"
                  >
                    <div>
                      {/* Program & Status Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono text-xs font-bold text-[#0BA7B4] uppercase">
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
                      <h3 className="text-lg font-black text-[#082B4C]">
                        {cohort.name}
                      </h3>
                      <div className="flex items-center gap-2 font-mono text-xs text-[#082B4C]/70 mt-0.5">
                        <span className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 font-bold">
                          {cohort.code}
                        </span>
                        <span>•</span>
                        <span>{enrolledCount} active students</span>
                      </div>

                      {/* Mentor Status Card */}
                      <div className="mt-4 p-3 bg-[#F6FAFB] border-2 border-[#082B4C]">
                        <p className="text-xs font-bold uppercase tracking-wider text-[#082B4C]/60 mb-1">
                          Default Cohort Mentor
                        </p>
                        {activeAssignment && activeAssignment.mentor ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-black text-[#082B4C]">
                                {activeAssignment.mentor.full_name}
                              </span>
                              <Badge variant="gold" size="sm" className="font-bold">
                                Cohort Default
                              </Badge>
                            </div>
                            <div className="text-xs text-[#082B4C]/70 font-mono">
                              ID: {activeAssignment.mentor.poraplan_id || 'N/A'} • {activeAssignment.mentor.email}
                            </div>
                            {activeAssignment.mentor.whatsapp_number && (
                              <div className="text-xs text-[#082B4C]/80 flex items-center gap-1 font-mono pt-0.5">
                                <Phone className="w-3 h-3 text-[#0BA7B4]" />
                                <span>{activeAssignment.mentor.whatsapp_number}</span>
                              </div>
                            )}
                            <div className="text-[11px] text-[#082B4C]/60 pt-1 font-mono">
                              Assigned {new Date(activeAssignment.assigned_at).toLocaleDateString()}
                            </div>
                          </div>
                        ) : (
                          <div className="py-1">
                            <p className="text-xs font-bold text-red-600 flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              No default mentor allocated to this cohort
                            </p>
                            <p className="text-[11px] text-[#082B4C]/60 mt-0.5">
                              Enrolled students currently have no default mentor unless individually overridden.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t-2 border-[#082B4C]/10 flex items-center justify-between gap-2">
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
          <div className="border-3 border-[#082B4C] bg-white p-4 shadow-[4px_4px_0_0_#082B4C]">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              <div className="md:col-span-5 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#082B4C]/50" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search student, PoraPlan ID, university..."
                  className="w-full pl-9 pr-3 py-2 text-sm border-2 border-[#082B4C] font-medium placeholder-[#082B4C]/40 focus:outline-none focus:ring-2 focus:ring-[#0BA7B4]"
                />
              </div>

              <div className="md:col-span-4">
                <select
                  value={programFilter}
                  onChange={(e) => {
                    setProgramFilter(e.target.value);
                    setCohortFilter('all');
                  }}
                  className="w-full px-3 py-2 text-sm border-2 border-[#082B4C] font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#0BA7B4]"
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
                  className="w-full px-3 py-2 text-sm border-2 border-[#082B4C] font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#0BA7B4]"
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
            <div className="border-3 border-[#082B4C] bg-white p-12 text-center shadow-[4px_4px_0_0_#082B4C]">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#0BA7B4] mb-3" />
              <p className="text-sm font-bold text-[#082B4C]">Loading student roster &amp; resolutions...</p>
            </div>
          ) : filteredEnrollments.length === 0 ? (
            <div className="border-3 border-[#082B4C] bg-white p-12 text-center shadow-[4px_4px_0_0_#082B4C]">
              <UserCheck className="w-12 h-12 text-[#082B4C]/30 mx-auto mb-3" />
              <h3 className="text-lg font-black text-[#082B4C]">No Students Found</h3>
              <p className="text-sm text-[#082B4C]/70 mt-1">
                No active student enrollments match your filters.
              </p>
            </div>
          ) : (
            <div className="border-3 border-[#082B4C] bg-white shadow-[4px_4px_0_0_#082B4C] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-3 border-[#082B4C] bg-[#F6FAFB] text-xs font-black uppercase text-[#082B4C] tracking-wider">
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
                        <tr key={enr.id} className="hover:bg-[#F6FAFB]/80 transition-colors">
                          {/* Student */}
                          <td className="py-3 px-4">
                            <div className="font-black text-[#082B4C] flex items-center gap-2">
                              <span>{student?.full_name || 'Student'}</span>
                              {student?.poraplan_id && (
                                <span className="font-mono text-xs px-1.5 py-0.2 bg-[#F6FAFB] border border-[#082B4C]/30 font-bold">
                                  {student.poraplan_id}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#082B4C]/70 font-medium">
                              {student?.university || 'University'} • Sem {student?.current_semester || 'N/A'}
                            </div>
                          </td>

                          {/* Program & Cohort */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-[#082B4C]">{enr.program?.name}</div>
                            <div className="text-xs text-[#082B4C]/70 font-mono font-medium">
                              {enr.cohort?.name} ({enr.cohort?.code})
                            </div>
                          </td>

                          {/* Effective Mentor */}
                          <td className="py-3 px-4">
                            {effectiveMentor ? (
                              <div>
                                <div className="font-black text-[#082B4C] flex items-center gap-1.5">
                                  <span>{effectiveMentor.full_name}</span>
                                  {effectiveMentor.poraplan_id && (
                                    <span className="font-mono text-xs text-[#0BA7B4] font-bold">
                                      ({effectiveMentor.poraplan_id})
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-[#082B4C]/70 font-mono">
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
          <div className="border-3 border-[#082B4C] bg-white p-6 shadow-[4px_4px_0_0_#082B4C]">
            <h2 className="text-lg font-black text-[#082B4C] flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-[#0BA7B4]" />
              Mentor Capacity &amp; Allocation Distribution
            </h2>
            <p className="text-xs text-[#082B4C]/70 mt-1">
              Informational workload distribution overview. Students with individual overrides
              are deduplicated so they are not double-counted across cohort and individual tallies.
            </p>
          </div>

          <div className="border-3 border-[#082B4C] bg-white shadow-[4px_4px_0_0_#082B4C] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-3 border-[#082B4C] bg-[#F6FAFB] text-xs font-black uppercase text-[#082B4C] tracking-wider">
                    <th className="py-3 px-4">Mentor</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4 text-center">Active Cohorts</th>
                    <th className="py-3 px-4 text-center">Individual Overrides</th>
                    <th className="py-3 px-4 text-center">Effective Mentees</th>
                    <th className="py-3 px-4">Status &amp; Eligibility</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-[#082B4C]/10 text-sm">
                  {workload.map((w) => (
                    <tr key={w.mentor.id} className="hover:bg-[#F6FAFB]/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-black text-[#082B4C] flex items-center gap-2">
                          <span>{w.mentor.full_name}</span>
                          {w.mentor.poraplan_id && (
                            <span className="font-mono text-xs px-1.5 py-0.2 bg-[#F6FAFB] border border-[#082B4C]/30 font-bold">
                              {w.mentor.poraplan_id}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#082B4C]/70 font-medium">
                          {w.mentor.academic_background || w.mentor.expertise || 'Mentor'}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-xs text-[#082B4C]">
                        <div>{w.mentor.email}</div>
                        {w.mentor.whatsapp_number && (
                          <div className="text-[#0BA7B4] flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" />
                            <span>{w.mentor.whatsapp_number}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center font-bold text-base text-[#082B4C]">
                        <span className="px-2.5 py-0.5 bg-gray-100 border border-gray-300">
                          {w.activeCohortsCount}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center font-bold text-base text-[#082B4C]">
                        <span className="px-2.5 py-0.5 bg-[#F5A623]/20 border border-[#F5A623]">
                          {w.individualOverridesCount}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="px-3 py-1 bg-[#0BA7B4]/20 border-2 border-[#0BA7B4] font-black text-base text-[#082B4C]">
                          {w.totalEffectiveMenteesCount}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={w.mentor.status === 'active' ? 'teal' : 'paper'}
                            size="sm"
                          >
                            {w.mentor.status?.toUpperCase() || 'ACTIVE'}
                          </Badge>
                          {w.isEligible ? (
                            <Badge variant="teal" size="sm">
                              PROGRAM APPROVED
                            </Badge>
                          ) : (
                            <Badge variant="paper" size="sm">
                              NO APPROVED APP
                            </Badge>
                          )}
                        </div>
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
        <div className="fixed inset-0 z-50 bg-[#082B4C]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-3 border-[#082B4C] shadow-[8px_8px_0_0_#082B4C] max-w-lg w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between pb-4 border-b-2 border-[#082B4C]/10">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold uppercase tracking-wider bg-[#0BA7B4]/10 text-[#082B4C] border border-[#0BA7B4] mb-1.5">
                  <GraduationCap className="w-3 h-3 text-[#0BA7B4]" />
                  Cohort Mentorship
                </div>
                <h2 className="text-xl font-black text-[#082B4C]">
                  Assign Default Mentor
                </h2>
              </div>
              <button
                onClick={() => setCohortModalOpen(false)}
                className="p-1 text-[#082B4C]/60 hover:text-[#082B4C]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Cohort Summary */}
            <div className="mt-4 p-3 bg-[#F6FAFB] border-2 border-[#082B4C] space-y-1">
              <p className="text-xs font-bold uppercase text-[#082B4C]/60">Target Cohort</p>
              <p className="text-base font-black text-[#082B4C]">
                {selectedCohort.name} ({selectedCohort.code})
              </p>
              <p className="text-xs text-[#082B4C]/70">
                Program:{' '}
                {programs.find((p) => p.id === selectedCohort.program_id)?.name || 'Mentorship Program'}
              </p>
              <p className="text-xs font-mono text-[#0BA7B4] pt-1">
                Notice: All enrolled students in this cohort will inherit this mentor unless an
                individual override is assigned.
              </p>
            </div>

            {/* Select Mentor */}
            <div className="mt-4 space-y-2">
              <label className="block text-xs font-black uppercase text-[#082B4C] tracking-wider">
                Select Eligible Mentor
              </label>
              {eligibleMentorsForCohort.length === 0 ? (
                <div className="p-3 bg-red-50 border-2 border-red-300 text-xs font-bold text-red-800">
                  No mentors have approved applications for this program. Review and approve mentor
                  applications first.
                </div>
              ) : (
                <select
                  value={selectedMentorId}
                  onChange={(e) => setSelectedMentorId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border-2 border-[#082B4C] font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#0BA7B4]"
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
            <div className="mt-4 space-y-2">
              <label className="block text-xs font-black uppercase text-[#082B4C] tracking-wider">
                Internal Allocation Notes (Optional)
              </label>
              <textarea
                value={assignmentNotes}
                onChange={(e) => setAssignmentNotes(e.target.value)}
                placeholder="e.g. Lead academic mentor for undergraduate batch curriculum."
                rows={2}
                className="w-full p-2.5 text-xs border-2 border-[#082B4C] font-medium focus:outline-none focus:ring-2 focus:ring-[#0BA7B4]"
              />
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t-2 border-[#082B4C]/10">
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
        <div className="fixed inset-0 z-50 bg-[#082B4C]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-3 border-[#082B4C] shadow-[8px_8px_0_0_#082B4C] max-w-lg w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between pb-4 border-b-2 border-[#082B4C]/10">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold uppercase tracking-wider bg-[#F5A623]/20 text-[#082B4C] border border-[#F5A623] mb-1.5">
                  <UserCheck className="w-3 h-3 text-[#F5A623]" />
                  Individual Override
                </div>
                <h2 className="text-xl font-black text-[#082B4C]">
                  Set Individual Mentor Override
                </h2>
              </div>
              <button
                onClick={() => setIndividualModalOpen(false)}
                className="p-1 text-[#082B4C]/60 hover:text-[#082B4C]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Student Summary */}
            <div className="mt-4 p-3 bg-[#F6FAFB] border-2 border-[#082B4C] space-y-1">
              <p className="text-xs font-bold uppercase text-[#082B4C]/60">Student Details</p>
              <p className="text-base font-black text-[#082B4C]">
                {selectedStudentEnrollment.student?.full_name}
              </p>
              <p className="text-xs text-[#082B4C]/70 font-mono">
                ID: {selectedStudentEnrollment.student?.poraplan_id || 'N/A'} • {selectedStudentEnrollment.student?.university}
              </p>
              <p className="text-xs text-[#082B4C]/80 pt-1">
                <span className="font-bold">Cohort:</span> {selectedStudentEnrollment.cohort?.name} ({selectedStudentEnrollment.cohort?.code})
              </p>
              <p className="text-xs font-mono text-[#F5A623] pt-1">
                Notice: Setting an individual mentor takes precedence over this cohort&apos;s default mentor for this student only.
              </p>
            </div>

            {/* Select Mentor */}
            <div className="mt-4 space-y-2">
              <label className="block text-xs font-black uppercase text-[#082B4C] tracking-wider">
                Select Eligible Mentor
              </label>
              {eligibleMentorsForStudent.length === 0 ? (
                <div className="p-3 bg-red-50 border-2 border-red-300 text-xs font-bold text-red-800">
                  No mentors have approved applications for this program.
                </div>
              ) : (
                <select
                  value={selectedIndividualMentorId}
                  onChange={(e) => setSelectedIndividualMentorId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border-2 border-[#082B4C] font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#0BA7B4]"
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
            <div className="mt-4 space-y-2">
              <label className="block text-xs font-black uppercase text-[#082B4C] tracking-wider">
                Reason / Override Notes (Optional)
              </label>
              <textarea
                value={individualNotes}
                onChange={(e) => setIndividualNotes(e.target.value)}
                placeholder="e.g. Student requested specialized 1-on-1 algorithm pacing."
                rows={2}
                className="w-full p-2.5 text-xs border-2 border-[#082B4C] font-medium focus:outline-none focus:ring-2 focus:ring-[#0BA7B4]"
              />
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t-2 border-[#082B4C]/10">
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
        <div className="fixed inset-0 z-50 bg-[#082B4C]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-3 border-[#082B4C] shadow-[8px_8px_0_0_#082B4C] max-w-xl w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b-2 border-[#082B4C]/10">
              <div>
                <h3 className="text-base font-black text-[#082B4C] flex items-center gap-2">
                  <History className="w-4 h-4 text-[#0BA7B4]" />
                  {historyTitle}
                </h3>
              </div>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="p-1 text-[#082B4C]/60 hover:text-[#082B4C]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 max-h-80 overflow-y-auto space-y-3">
              {cohortHistoryList.length > 0 ? (
                cohortHistoryList.map((ch) => (
                  <div
                    key={ch.id}
                    className={`p-3 border-2 ${
                      ch.is_active
                        ? 'border-[#0BA7B4] bg-[#0BA7B4]/10'
                        : 'border-[#082B4C]/20 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-[#082B4C] text-sm">
                        {ch.mentor?.full_name || 'Mentor'}
                      </span>
                      <Badge variant={ch.is_active ? 'teal' : 'paper'} size="sm">
                        {ch.is_active ? 'ACTIVE' : 'ENDED'}
                      </Badge>
                    </div>
                    <div className="text-xs text-[#082B4C]/70 font-mono mt-0.5">
                      Assigned: {new Date(ch.assigned_at).toLocaleDateString()}
                      {ch.ended_at && ` • Ended: ${new Date(ch.ended_at).toLocaleDateString()}`}
                    </div>
                    {ch.notes && (
                      <p className="text-xs text-[#082B4C]/80 mt-1 italic">&ldquo;{ch.notes}&rdquo;</p>
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
                        : 'border-[#082B4C]/20 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-[#082B4C] text-sm">
                        {sh.mentor?.full_name || 'Mentor'}
                      </span>
                      <Badge variant={sh.is_active ? 'gold' : 'paper'} size="sm">
                        {sh.is_active ? 'ACTIVE OVERRIDE' : 'ENDED'}
                      </Badge>
                    </div>
                    <div className="text-xs text-[#082B4C]/70 font-mono mt-0.5">
                      Assigned: {new Date(sh.assigned_at).toLocaleDateString()}
                      {sh.ended_at && ` • Ended: ${new Date(sh.ended_at).toLocaleDateString()}`}
                    </div>
                    {sh.notes && (
                      <p className="text-xs text-[#082B4C]/80 mt-1 italic">&ldquo;{sh.notes}&rdquo;</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-center text-[#082B4C]/60 py-6">
                  No historical records logged yet.
                </p>
              )}
            </div>

            <div className="mt-4 pt-3 border-t-2 border-[#082B4C]/10 flex justify-end">
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
