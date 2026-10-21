import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getMentorScholarsProgress,
  getScholarProgressDetail,
  type ScholarProgressOverview,
  type StudentProgressSummary,
} from '../../lib/progress';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  Users,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock,
  ListTodo,
  FileText,
  Calendar,
  BookOpen,
  Eye,
  X,
  ChevronRight,
} from 'lucide-react';

export const MentorProgressPage: React.FC = () => {
  const { user, profile } = useAuth();
  const mentorId = profile?.id || user?.id || '';

  const [scholars, setScholars] = useState<ScholarProgressOverview[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Detail Modal State
  const [selectedScholar, setSelectedScholar] = useState<ScholarProgressOverview | null>(null);
  const [scholarDetail, setScholarDetail] = useState<StudentProgressSummary | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (!mentorId) return;

    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const { scholars: list, error } = await getMentorScholarsProgress(mentorId);
        if (!isMounted) return;

        if (error) {
          setErrorMessage(error.message);
        } else {
          setScholars(list);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(msg);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [mentorId]);

  const handleRefresh = async () => {
    if (!mentorId) return;
    setRefreshing(true);
    setErrorMessage(null);
    const { scholars: list, error } = await getMentorScholarsProgress(mentorId);
    if (error) {
      setErrorMessage(error.message);
    } else {
      setScholars(list);
    }
    setRefreshing(false);
  };

  const handleOpenDetailModal = async (scholar: ScholarProgressOverview) => {
    setSelectedScholar(scholar);
    setScholarDetail(null);
    setDetailError(null);
    setLoadingDetail(true);

    try {
      const { summary, error } = await getScholarProgressDetail(mentorId, scholar.studentId);
      if (error) {
        setDetailError(error.message);
      } else {
        setScholarDetail(summary);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setDetailError(msg);
    } finally {
      setLoadingDetail(false);
    }
  };

  const filteredScholars = scholars.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      s.studentName.toLowerCase().includes(q) ||
      s.poraplanId.toLowerCase().includes(q) ||
      (s.studentEmail && s.studentEmail.toLowerCase().includes(q))
    );
  });

  // Calculate Mentor Overview KPIs
  const totalAssignedScholars = scholars.length;
  const scholarsWithActiveTasks = scholars.filter((s) => s.tasks.total > 0).length;
  const totalPendingReviews = scholars.reduce((acc, s) => acc + s.assignments.pendingReview, 0);
  const totalCompletedEvaluations = scholars.reduce((acc, s) => acc + s.evaluations.completed, 0);

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn pb-12">
      {/* ========================================================================= */}
      {/* 1. PAGE HEADER                                                            */}
      {/* ========================================================================= */}
      <section className="p-4 sm:p-6 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="font-mono text-xs uppercase font-bold text-brand-muted bg-brand-bg px-2 py-0.5 border border-brand-dark">
              MENTORSHIP CONSOLE
            </span>
            <Badge variant="gold" size="sm">
              SCHOLARS PROGRESS
            </Badge>
          </div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-navy tracking-tight">
            Assigned Scholars Progress Overview
          </h1>
          <p className="font-sans text-xs sm:text-sm text-brand-muted mt-1 max-w-2xl">
            Monitor academic activity, task completion, practice submissions, and milestone evaluations for students paired with your mentor account.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            leftIcon={
              refreshing ? (
                <Loader2 className="w-4 h-4 animate-spin text-brand-navy" />
              ) : (
                <RefreshCw className="w-4 h-4 text-brand-navy" />
              )
            }
          >
            {refreshing ? 'Updating...' : 'Refresh Roster'}
          </Button>
          <Link to="/mentor/dashboard">
            <Button variant="secondary" size="sm">
              Mentor Dashboard
            </Button>
          </Link>
        </div>
      </section>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 border-2 border-red-600 bg-red-50 text-red-900 shadow-brutal flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-heading font-bold text-sm">Failed to Load Scholar Progress</h4>
            <p className="font-mono text-xs mt-1 text-red-800">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. AGGREGATE KPI CARDS                                                    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] sm:text-xs uppercase font-extrabold text-brand-muted">
              ASSIGNED SCHOLARS
            </span>
            <Users className="w-4 h-4 text-brand-navy stroke-[2.5]" />
          </div>
          <div className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-navy">
            {totalAssignedScholars}
          </div>
          <span className="text-[10px] font-mono text-brand-muted mt-1">
            Authorized mentees
          </span>
        </div>

        <div className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] sm:text-xs uppercase font-extrabold text-brand-muted">
              ACTIVE TASKS TRACK
            </span>
            <ListTodo className="w-4 h-4 text-brand-teal stroke-[2.5]" />
          </div>
          <div className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-navy">
            {scholarsWithActiveTasks}
          </div>
          <span className="text-[10px] font-mono text-brand-teal font-bold mt-1">
            Scholars with study tasks
          </span>
        </div>

        <div className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] sm:text-xs uppercase font-extrabold text-brand-muted">
              PENDING REVIEWS
            </span>
            <FileText className="w-4 h-4 text-brand-gold stroke-[2.5]" />
          </div>
          <div className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-navy">
            {totalPendingReviews}
          </div>
          <span className="text-[10px] font-mono text-brand-gold font-bold mt-1">
            <Link to="/mentor/reviews" className="underline hover:text-brand-dark">
              In review queue
            </Link>
          </span>
        </div>

        <div className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] sm:text-xs uppercase font-extrabold text-brand-muted">
              COMPLETED EVALS
            </span>
            <Calendar className="w-4 h-4 text-brand-teal stroke-[2.5]" />
          </div>
          <div className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-navy">
            {totalCompletedEvaluations}
          </div>
          <span className="text-[10px] font-mono text-brand-muted mt-1">
            Milestones evaluated
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SCHOLARS PROGRESS ROSTER & SEARCH                                      */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
            <input
              type="text"
              placeholder="Search by student name or PoraPlan ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs font-mono border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none focus:ring-1 focus:ring-brand-teal"
            />
          </div>
          <span className="font-mono text-xs text-brand-muted">
            Showing {filteredScholars.length} of {scholars.length} assigned scholars
          </span>
        </div>

        {loading ? (
          <div className="p-12 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-teal mb-3" />
            <p className="font-heading font-extrabold text-base text-brand-navy">
              LOADING SCHOLAR ROSTER
            </p>
            <span className="font-mono text-xs text-brand-muted mt-1">
              Fetching assigned student metrics...
            </span>
          </div>
        ) : scholars.length === 0 ? (
          /* Empty State: No assigned students */
          <div className="p-8 sm:p-12 border-2 border-dashed border-brand-dark bg-brand-paper text-center shadow-brutal-sm">
            <div className="w-12 h-12 mx-auto mb-4 bg-brand-paper-tint border-2 border-brand-dark flex items-center justify-center shadow-brutal-xs">
              <Users className="w-6 h-6 text-brand-gold" />
            </div>
            <h3 className="font-heading font-extrabold text-lg sm:text-xl text-brand-navy">
              No Students Currently Assigned
            </h3>
            <p className="font-sans text-xs sm:text-sm text-brand-muted mt-2 max-w-lg mx-auto">
              You currently have 0 assigned scholars in the database. When platform administrators pair students with your mentor account, their progress tracking and academic metrics will appear here automatically.
            </p>
          </div>
        ) : filteredScholars.length === 0 ? (
          <div className="p-8 border-2 border-brand-dark bg-brand-paper text-center shadow-brutal-xs">
            <p className="font-heading font-bold text-sm text-brand-navy">
              No scholars matching "{searchQuery}"
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 text-xs font-mono text-brand-teal underline font-bold"
            >
              Clear search query
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredScholars.map((scholar) => (
              <div
                key={scholar.studentId}
                className="p-4 sm:p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="font-mono text-[10px] font-bold text-brand-teal bg-brand-bg px-1.5 py-0.5 border border-brand-dark">
                        {scholar.poraplanId}
                      </span>
                      <h3 className="font-heading font-extrabold text-base sm:text-lg text-brand-navy mt-1">
                        {scholar.studentName}
                      </h3>
                      {scholar.studentEmail && (
                        <span className="font-mono text-[11px] text-brand-muted truncate block max-w-[200px]">
                          {scholar.studentEmail}
                        </span>
                      )}
                    </div>
                    <Badge variant="teal" size="sm">
                      {scholar.subjectsCount} Subjects
                    </Badge>
                  </div>

                  {/* Metrics Grid */}
                  <div className="space-y-2.5 mt-3 pt-3 border-t border-brand-dark/15 text-xs font-mono">
                    {/* Tasks */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-brand-muted flex items-center gap-1">
                          <ListTodo className="w-3 h-3 text-brand-teal" /> Daily Tasks:
                        </span>
                        <span className="font-bold text-brand-navy">
                          {scholar.tasks.completed} / {scholar.tasks.total} ({scholar.tasks.completionRate}%)
                        </span>
                      </div>
                      <div className="w-full bg-brand-bg h-1.5 border border-brand-dark overflow-hidden">
                        <div
                          className="bg-brand-teal h-full"
                          style={{ width: `${scholar.tasks.completionRate}%` }}
                        />
                      </div>
                    </div>

                    {/* Practice */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-brand-muted flex items-center gap-1">
                        <FileText className="w-3 h-3 text-brand-navy" /> Practice Submissions:
                      </span>
                      <span className="font-bold text-brand-navy">
                        {scholar.assignments.submitted} / {scholar.assignments.totalAssigned}
                        {scholar.assignments.pendingReview > 0 && (
                          <span className="text-brand-gold ml-1 font-extrabold">
                            ({scholar.assignments.pendingReview} in queue)
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Evaluations */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-brand-muted flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-brand-gold" /> Evaluations:
                      </span>
                      <span className="font-bold text-brand-navy">
                        {scholar.evaluations.completed} Graded
                        {scholar.evaluations.scheduled > 0 && (
                          <span className="text-brand-muted ml-1">
                            ({scholar.evaluations.scheduled} scheduled)
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Last Activity */}
                    {scholar.lastActiveTimestamp && (
                      <div className="flex items-center justify-between pt-1 text-[10px] text-brand-muted">
                        <span>Last Active:</span>
                        <span>{new Date(scholar.lastActiveTimestamp).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-5 pt-3 border-t border-brand-dark/20 flex items-center justify-between">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleOpenDetailModal(scholar)}
                    leftIcon={<Eye className="w-3.5 h-3.5" />}
                  >
                    Inspect Progress
                  </Button>
                  <Link
                    to="/mentor/evaluations"
                    className="font-mono text-xs font-bold text-brand-navy hover:underline flex items-center gap-0.5"
                  >
                    Assess <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* 4. SCHOLAR DETAILED PROGRESS MODAL                                        */}
      {/* ========================================================================= */}
      {selectedScholar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-brand-dark/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-3xl max-h-[90vh] bg-brand-paper border-2 border-brand-dark shadow-brutal flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b-2 border-brand-dark bg-brand-paper-tint flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="teal" size="sm">
                    SCHOLAR PROGRESS DOSSIER
                  </Badge>
                  <span className="font-mono text-xs font-bold text-brand-teal">
                    {selectedScholar.poraplanId}
                  </span>
                </div>
                <h3 className="font-heading font-extrabold text-xl text-brand-navy">
                  {selectedScholar.studentName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedScholar(null)}
                className="p-1.5 border border-brand-dark bg-brand-paper hover:bg-brand-bg shadow-brutal-xs"
                title="Close Modal"
              >
                <X className="w-5 h-5 text-brand-dark" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
              {loadingDetail ? (
                <div className="py-12 text-center flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-brand-teal mb-3" />
                  <p className="font-heading font-bold text-sm text-brand-navy">
                    LOADING SCHOLAR DOSSIER
                  </p>
                </div>
              ) : detailError ? (
                <div className="p-4 border-2 border-red-600 bg-red-50 text-red-900 shadow-brutal">
                  <p className="font-mono text-xs">{detailError}</p>
                </div>
              ) : scholarDetail ? (
                <>
                  {/* KPI Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 border border-brand-dark bg-brand-paper shadow-brutal-xs">
                      <span className="text-[10px] font-mono text-brand-muted block uppercase">
                        Tasks Completed
                      </span>
                      <span className="font-heading font-extrabold text-lg text-brand-navy">
                        {scholarDetail.tasks.completed} / {scholarDetail.tasks.total}
                      </span>
                      <span className="text-[10px] font-mono text-brand-teal block font-bold">
                        {scholarDetail.tasks.completionRate}% Done
                      </span>
                    </div>

                    <div className="p-3 border border-brand-dark bg-brand-paper shadow-brutal-xs">
                      <span className="text-[10px] font-mono text-brand-muted block uppercase">
                        Practice Sets
                      </span>
                      <span className="font-heading font-extrabold text-lg text-brand-navy">
                        {scholarDetail.assignments.submitted} / {scholarDetail.assignments.totalAssigned}
                      </span>
                      <span className="text-[10px] font-mono text-brand-navy block font-bold">
                        {scholarDetail.assignments.submissionRate}% Submitted
                      </span>
                    </div>

                    <div className="p-3 border border-brand-dark bg-brand-paper shadow-brutal-xs">
                      <span className="text-[10px] font-mono text-brand-muted block uppercase">
                        Evaluations Graded
                      </span>
                      <span className="font-heading font-extrabold text-lg text-brand-navy">
                        {scholarDetail.evaluations.completed} / {scholarDetail.evaluations.total}
                      </span>
                      <span className="text-[10px] font-mono text-brand-gold block font-bold">
                        {scholarDetail.evaluations.averageScorePercentage !== null
                          ? `Avg ${scholarDetail.evaluations.averageScorePercentage}%`
                          : 'No score yet'}
                      </span>
                    </div>

                    <div className="p-3 border border-brand-dark bg-brand-paper shadow-brutal-xs">
                      <span className="text-[10px] font-mono text-brand-muted block uppercase">
                        Study Plans
                      </span>
                      <span className="font-heading font-extrabold text-lg text-brand-navy">
                        {scholarDetail.studyPlans.activePlans} Active
                      </span>
                      <span className="text-[10px] font-mono text-brand-teal block font-bold">
                        {scholarDetail.studyPlans.totalPlans} Total
                      </span>
                    </div>
                  </div>

                  {/* Subject Breakdown in Modal */}
                  <div>
                    <h4 className="font-heading font-extrabold text-sm text-brand-navy mb-2 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-brand-teal" />
                      Subject Performance Breakdown
                    </h4>
                    {scholarDetail.subjectsProgress.length === 0 ? (
                      <p className="font-mono text-xs text-brand-muted">No subjects assigned yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {scholarDetail.subjectsProgress.map((subj) => (
                          <div
                            key={subj.subjectId}
                            className="p-3 border border-brand-dark bg-brand-paper-tint text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-brutal-xs"
                          >
                            <div>
                              <span className="font-bold text-brand-navy block sm:inline">
                                {subj.subjectName} ({subj.subjectCode || 'General'})
                              </span>
                              <span className="text-brand-muted sm:ml-2">
                                Tasks: {subj.tasks.completed}/{subj.tasks.total} · Submissions: {subj.assignments.submitted}/{subj.assignments.total} · Evaluations: {subj.evaluations.completed}/{subj.evaluations.total}
                              </span>
                            </div>
                            {subj.evaluations.averageScorePercentage !== null && (
                              <span className="font-bold text-brand-teal shrink-0">
                                Eval Avg: {subj.evaluations.averageScorePercentage}%
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Activity Log in Modal */}
                  <div>
                    <h4 className="font-heading font-extrabold text-sm text-brand-navy mb-2 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-brand-teal" />
                      Recent Verified Academic Events
                    </h4>
                    {scholarDetail.recentActivity.length === 0 ? (
                      <p className="font-mono text-xs text-brand-muted">No activity logged yet.</p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {scholarDetail.recentActivity.map((act) => (
                          <div
                            key={act.id}
                            className="p-2.5 border border-brand-dark bg-brand-paper flex items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <span className="font-bold text-brand-navy block">{act.title}</span>
                              {act.details && (
                                <span className="text-brand-muted text-[11px]">{act.details}</span>
                              )}
                            </div>
                            <span className="font-mono text-[10px] text-brand-muted shrink-0">
                              {new Date(act.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t-2 border-brand-dark bg-brand-bg flex items-center justify-between">
              <span className="font-mono text-xs text-brand-muted">
                PoraPlan Academic Record
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedScholar(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
