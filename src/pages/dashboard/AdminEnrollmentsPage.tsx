import React, { useState, useEffect } from 'react';
import {
  getEnrollments,
  updateEnrollmentStatus,
  getEnrollmentStatusBadgeVariant,
} from '../../lib/applications';
import { getPrograms, getCohorts } from '../../lib/programs';
import type {
  ProgramEnrollmentWithMeta,
  Program,
  Cohort,
  EnrollmentStatus,
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
      <div className="border-3 border-[#082B4C] bg-white p-6 shadow-[4px_4px_0_0_#082B4C]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-[#F6FAFB] text-[#082B4C] border border-[#082B4C] mb-2">
              <UserCheck className="w-3.5 h-3.5 text-[#0BA7B4]" />
              Active Roster Desk
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-[#082B4C]">
              Program Enrollments
            </h1>
            <p className="text-sm text-[#082B4C]/70 mt-1 max-w-2xl font-medium">
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
          </div>
        </div>

        {/* Quick Stat Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-6 border-t-2 border-[#082B4C]/10">
          <div className="p-3 bg-[#F6FAFB] border-2 border-[#082B4C]">
            <p className="text-xs font-bold text-[#082B4C]/60 uppercase">Total Students</p>
            <p className="text-2xl font-black text-[#082B4C] mt-0.5">{totalCount}</p>
          </div>
          <div className="p-3 bg-[#0BA7B4]/10 border-2 border-[#0BA7B4]">
            <p className="text-xs font-bold text-[#082B4C]/70 uppercase">Active</p>
            <p className="text-2xl font-black text-[#082B4C] mt-0.5">{activeCount}</p>
          </div>
          <div className="p-3 bg-[#F5A623]/10 border-2 border-[#F5A623]">
            <p className="text-xs font-bold text-[#082B4C]/70 uppercase">On Hold</p>
            <p className="text-2xl font-black text-[#082B4C] mt-0.5">{onHoldCount}</p>
          </div>
          <div className="p-3 bg-[#082B4C]/10 border-2 border-[#082B4C]">
            <p className="text-xs font-bold text-[#082B4C]/70 uppercase">Completed</p>
            <p className="text-2xl font-black text-[#082B4C] mt-0.5">{completedCount}</p>
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
            <CheckCircle2 className="w-5 h-5 text-[#0BA7B4] flex-shrink-0" />
            <p className="text-sm font-bold text-[#082B4C]">{successMessage}</p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-[#082B4C] hover:opacity-75"
            aria-label="Dismiss alert"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="border-3 border-[#082B4C] bg-white p-4 shadow-[4px_4px_0_0_#082B4C]">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search box */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#082B4C]/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student, ID, university..."
              className="w-full pl-9 pr-3 py-2 text-sm border-2 border-[#082B4C] font-medium placeholder-[#082B4C]/40 focus:outline-none focus:ring-2 focus:ring-[#0BA7B4]"
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
              className="w-full px-3 py-2 text-sm border-2 border-[#082B4C] font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#0BA7B4]"
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
              className="w-full px-3 py-2 text-sm border-2 border-[#082B4C] font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#0BA7B4]"
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
              className="w-full px-3 py-2 text-sm border-2 border-[#082B4C] font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#0BA7B4]"
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
        <div className="border-3 border-[#082B4C] bg-white p-12 text-center shadow-[4px_4px_0_0_#082B4C]">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#0BA7B4] mb-3" />
          <p className="text-sm font-bold text-[#082B4C]">Loading enrollments roster...</p>
        </div>
      ) : filteredEnrollments.length === 0 ? (
        <div className="border-3 border-[#082B4C] bg-white p-12 text-center shadow-[4px_4px_0_0_#082B4C]">
          <UserCheck className="w-12 h-12 text-[#082B4C]/30 mx-auto mb-3" />
          <h3 className="text-lg font-black text-[#082B4C]">No Enrollments Found</h3>
          <p className="text-sm text-[#082B4C]/70 mt-1 max-w-md mx-auto">
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
        <div className="border-3 border-[#082B4C] bg-white shadow-[4px_4px_0_0_#082B4C] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-3 border-[#082B4C] bg-[#F6FAFB] text-xs font-black uppercase text-[#082B4C] tracking-wider">
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
                      className="hover:bg-[#F6FAFB]/80 transition-colors"
                    >
                      {/* Student Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 border-2 border-[#082B4C] bg-[#0BA7B4]/20 flex items-center justify-center font-black text-[#082B4C] flex-shrink-0 text-sm">
                            {student?.full_name?.charAt(0) || 'S'}
                          </div>
                          <div>
                            <div className="font-black text-[#082B4C] flex items-center gap-2">
                              <span>{student?.full_name || 'Unknown Student'}</span>
                              {student?.poraplan_id && (
                                <span className="font-mono text-xs px-1.5 py-0.2 bg-[#F6FAFB] border border-[#082B4C]/30 text-[#082B4C]/80 font-bold">
                                  {student.poraplan_id}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#082B4C]/70 flex items-center gap-2 mt-0.5 font-medium">
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
                        <div className="font-bold text-[#082B4C]">
                          {program?.name || 'General Mentorship'}
                        </div>
                        <div className="text-xs text-[#082B4C]/70 flex items-center gap-1.5 mt-0.5 font-medium">
                          <span className="font-mono font-semibold px-1 py-0.2 bg-gray-100 border border-gray-300 text-gray-700">
                            {cohort?.name || 'Assigned Cohort'}
                          </span>
                          {cohort?.code && (
                            <span className="text-[#082B4C]/50">({cohort.code})</span>
                          )}
                        </div>
                      </td>

                      {/* Enrolled Date */}
                      <td className="py-3.5 px-4 font-mono text-xs text-[#082B4C]/80">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#0BA7B4]" />
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
        <div className="fixed inset-0 z-50 bg-[#082B4C]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-3 border-[#082B4C] shadow-[8px_8px_0_0_#082B4C] max-w-lg w-full p-6 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b-2 border-[#082B4C]/10">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold uppercase tracking-wider bg-[#0BA7B4]/10 text-[#082B4C] border border-[#0BA7B4] mb-1.5">
                  <UserCheck className="w-3 h-3 text-[#0BA7B4]" />
                  Enrollment Record
                </div>
                <h2 className="text-xl font-black text-[#082B4C]">
                  Update Student Enrollment
                </h2>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 border border-transparent hover:border-[#082B4C] text-[#082B4C]/60 hover:text-[#082B4C]"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Student & Program Summary */}
            <div className="mt-4 p-3 bg-[#F6FAFB] border-2 border-[#082B4C] space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-[#082B4C]">
                    {selectedEnrollment.student?.full_name}
                  </p>
                  <p className="text-xs text-[#082B4C]/70 font-mono">
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

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#082B4C]/10 text-xs">
                <div>
                  <span className="font-bold text-[#082B4C]/70">Program: </span>
                  <span className="font-semibold text-[#082B4C]">
                    {selectedEnrollment.program?.name}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-[#082B4C]/70">Cohort: </span>
                  <span className="font-semibold text-[#082B4C]">
                    {selectedEnrollment.cohort?.name}
                  </span>
                </div>
                {selectedEnrollment.student?.university && (
                  <div className="col-span-2">
                    <span className="font-bold text-[#082B4C]/70">University: </span>
                    <span className="font-semibold text-[#082B4C]">
                      {selectedEnrollment.student.university} ({selectedEnrollment.student.department || 'N/A'})
                    </span>
                  </div>
                )}
                {selectedEnrollment.student?.whatsapp_number && (
                  <div className="col-span-2 flex items-center gap-1.5 font-mono">
                    <Phone className="w-3 h-3 text-[#0BA7B4]" />
                    <span>{selectedEnrollment.student.whatsapp_number}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Status Selector */}
            <div className="mt-5 space-y-2">
              <label className="block text-xs font-black uppercase text-[#082B4C] tracking-wider">
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
                        ? 'border-[#082B4C] bg-[#0BA7B4]/15 shadow-[2px_2px_0_0_#082B4C]'
                        : 'border-[#082B4C]/30 bg-white hover:border-[#082B4C]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="capitalize text-sm text-[#082B4C]">
                        {st.replace('_', ' ')}
                      </span>
                      {newStatus === st && (
                        <CheckCircle2 className="w-4 h-4 text-[#0BA7B4]" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t-2 border-[#082B4C]/10">
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
    </div>
  );
};
