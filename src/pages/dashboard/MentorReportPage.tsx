import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  generateMentorReport,
  generateStudentReport,
  type MentorAcademicReport,
  type StudentAcademicReport,
  type ReportPeriod,
} from '../../lib/reports';
import { getAssignedStudents } from '../../lib/mentorship';
import { formatLocalDate } from '../../lib/library';
import type { Profile } from '../../types/database';
import { Button } from '../../components/common/Button';
import {
  Printer,
  Users,
  RefreshCw,
  Loader2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

export const MentorReportPage: React.FC = () => {
  const { user, profile } = useAuth();
  const mentorId = profile?.id || user?.id || '';

  const [period, setPeriod] = useState<ReportPeriod>('weekly');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return formatLocalDate(d);
  });
  const [customEnd, setCustomEnd] = useState(() => formatLocalDate(new Date()));

  const [assignedStudents, setAssignedStudents] = useState<Profile[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');

  const [mentorReport, setMentorReport] = useState<MentorAcademicReport | null>(null);
  const [studentDetailReport, setStudentDetailReport] = useState<StudentAcademicReport | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load mentor's roster
  useEffect(() => {
    if (!mentorId) return;
    getAssignedStudents(mentorId)
      .then(({ students }) => {
        setAssignedStudents(students || []);
      })
      .catch(() => {});
  }, [mentorId]);

  const fetchReports = useCallback(async () => {
    if (!mentorId) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Generate Mentor Roster Report
      const { report: mReport, error: mErr } = await generateMentorReport(
        mentorId,
        period,
        period === 'custom' ? customStart : undefined,
        period === 'custom' ? customEnd : undefined,
        selectedStudentId === 'all' ? undefined : selectedStudentId
      );

      if (mErr) {
        setError(mErr.message || 'Unable to generate mentor academic report.');
        setLoading(false);
        return;
      }

      setMentorReport(mReport);

      // 2. If a specific student is selected, generate their detailed academic report
      if (selectedStudentId !== 'all') {
        const { report: sReport } = await generateStudentReport(
          selectedStudentId,
          period,
          period === 'custom' ? customStart : undefined,
          period === 'custom' ? customEnd : undefined
        );
        setStudentDetailReport(sReport);
      } else {
        setStudentDetailReport(null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An error occurred while compiling reports.');
    } finally {
      setLoading(false);
    }
  }, [mentorId, period, customStart, customEnd, selectedStudentId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Print-specific A4 Stylesheet */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            font-size: 10pt;
          }
          nav, aside, header, footer, .print\\:hidden {
            display: none !important;
          }
          .break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .shadow-brutal, .shadow-brutal-sm, .shadow-brutal-xs {
            box-shadow: none !important;
          }
        }
      `}</style>
      {/* ========================================================================= */}
      {/* 1. INTERACTIVE CONTROLS BAR (HIDDEN IN PRINT MODE)                        */}
      {/* ========================================================================= */}
      <div className="print:hidden p-4 sm:p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] uppercase font-extrabold tracking-wider text-brand-gold bg-brand-bg px-2 py-0.5 border border-brand-dark">
              MENTOR ROSTER OVERSIGHT
            </span>
            <span className="font-mono text-[10px] text-brand-muted">
              {assignedStudents.length} Assigned Scholars
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold font-heading text-brand-navy tracking-tight">
            Scholar Academic Progress Reports
          </h1>
          <p className="text-xs text-brand-muted mt-0.5">
            Audit mentee task execution velocity, review submissions queue, and verify milestone evaluations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchReports}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handlePrint}
            className="flex items-center gap-1.5 shadow-brutal-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save PDF</span>
          </Button>
        </div>
      </div>

      {/* Filter Row: Period & Scholar Selector (Hidden in Print) */}
      <div className="print:hidden p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-wrap items-center justify-between gap-3">
        {/* Period Selector */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="font-bold text-brand-muted uppercase text-[10px]">Window:</span>
          {(['weekly', 'monthly', 'custom'] as ReportPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 border-2 border-brand-dark font-mono text-xs font-bold transition-all ${
                period === p
                  ? 'bg-brand-navy text-white shadow-brutal-xs -translate-y-0.5'
                  : 'bg-brand-paper text-brand-dark hover:bg-brand-paper-tint'
              }`}
            >
              {p === 'weekly' ? 'Weekly (7 Days)' : p === 'monthly' ? 'Monthly (30 Days)' : 'Custom Range'}
            </button>
          ))}

          {period === 'custom' && (
            <div className="flex items-center gap-1.5 ml-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2 py-0.5 border border-brand-dark bg-brand-bg text-xs font-mono"
                aria-label="Start Date"
              />
              <span>to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2 py-0.5 border border-brand-dark bg-brand-bg text-xs font-mono"
                aria-label="End Date"
              />
            </div>
          )}
        </div>

        {/* Scholar Selector */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="font-bold text-brand-muted uppercase text-[10px]">Scholar:</span>
          <select
            aria-label="Filter by assigned scholar"
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="px-3 py-1.5 border-2 border-brand-dark bg-brand-bg font-mono text-xs font-bold text-brand-dark focus:outline-none focus:ring-1 focus:ring-brand-teal"
          >
            <option value="all">All Assigned Scholars ({assignedStudents.length})</option>
            {assignedStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} ({s.poraplan_id || s.email})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. REPORT CONTENT BODY (A4 PRINT FRIENDLY)                                */}
      {/* ========================================================================= */}
      {loading ? (
        <div className="p-16 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center space-y-3">
          <Loader2 className="w-8 h-8 text-brand-teal animate-spin mx-auto" />
          <h3 className="font-heading font-extrabold text-base text-brand-navy">
            COMPILING ROSTER REPORT
          </h3>
          <p className="font-mono text-xs text-brand-muted">
            Aggregating mentee completion rates, review submissions, and evaluations...
          </p>
        </div>
      ) : error ? (
        <div className="p-6 border-2 border-brand-dark bg-red-50 text-red-900 shadow-brutal flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-heading font-bold text-sm">Failed to generate mentor report</h4>
            <p className="font-mono text-xs text-red-800">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchReports} className="mt-2">
              Retry Generation
            </Button>
          </div>
        </div>
      ) : mentorReport ? (
        <article className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-6 sm:p-8 space-y-6 print:border-none print:shadow-none print:p-0 print:space-y-4">
          {/* Header & Mentor Identity */}
          <header className="border-b-2 border-brand-dark pb-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-[10px] uppercase font-extrabold tracking-widest text-brand-gold bg-brand-bg px-2 py-0.5 border border-brand-dark">
                  PORAPLAN MENTORSHIP OVERSIGHT
                </span>
                <span className="font-mono text-[10px] text-brand-muted">
                  CONFIDENTIAL • FACULTY ARCHIVE
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-brand-navy tracking-tight">
                Mentorship Progress Report
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-brand-dark pt-1">
                <div>
                  <span className="text-brand-muted font-bold">MENTOR: </span>
                  <span className="font-extrabold">{mentorReport.mentorName}</span>
                </div>
                <div>
                  <span className="text-brand-muted font-bold">ID: </span>
                  <span className="font-bold text-brand-teal">{mentorReport.poraplanId}</span>
                </div>
                <div>
                  <span className="text-brand-muted font-bold">ASSIGNED SCHOLARS: </span>
                  <span className="font-bold">{mentorReport.assignedStudentsCount}</span>
                </div>
              </div>
            </div>

            <div className="text-left sm:text-right space-y-1 text-xs font-mono border-t sm:border-t-0 pt-2 sm:pt-0 border-brand-dark/20">
              <div className="font-bold text-brand-navy bg-brand-paper-tint sm:bg-transparent p-2 sm:p-0 border sm:border-none border-brand-dark">
                <span className="text-brand-muted block text-[10px] uppercase">AUDIT WINDOW</span>
                <span>{mentorReport.dateRange.startDate} — {mentorReport.dateRange.endDate}</span>
              </div>
              <div className="text-[10px] text-brand-muted">
                {selectedStudentId === 'all'
                  ? 'SCOPE: Entire Assigned Roster'
                  : `SCOPE: Scholar ${studentDetailReport?.studentName || 'Selected'}`}
              </div>
            </div>
          </header>

          {/* Roster Overview KPIs */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
            {/* Task Velocity */}
            <div className="p-3.5 border-2 border-brand-dark bg-brand-bg flex flex-col justify-between">
              <span className="font-mono text-[10px] font-bold text-brand-muted uppercase">TASKS EXECUTED</span>
              <div className="my-1">
                <span className="font-heading font-extrabold text-2xl text-brand-navy">
                  {mentorReport.aggregateMetrics.totalTasksCompleted}
                </span>
                <span className="font-mono text-xs text-brand-muted"> / {mentorReport.aggregateMetrics.totalTasksAssigned}</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-brand-teal">
                {mentorReport.aggregateMetrics.overallTaskCompletionRate}% completion rate
              </span>
            </div>

            {/* Pending Reviews */}
            <div className="p-3.5 border-2 border-brand-dark bg-brand-bg flex flex-col justify-between">
              <span className="font-mono text-[10px] font-bold text-brand-muted uppercase">REVIEWS QUEUE</span>
              <div className="my-1">
                <span className={`font-heading font-extrabold text-2xl ${
                  mentorReport.aggregateMetrics.totalSubmissionsPendingReview > 0 ? 'text-brand-gold' : 'text-brand-teal'
                }`}>
                  {mentorReport.aggregateMetrics.totalSubmissionsPendingReview}
                </span>
                <span className="font-mono text-xs text-brand-muted"> awaiting review</span>
              </div>
              <Link to="/mentor/reviews" className="print:hidden text-[10px] font-mono font-bold text-brand-teal hover:underline flex items-center gap-0.5">
                <span>Open review queue</span>
                <ArrowRight className="w-2.5 h-2.5" />
              </Link>
            </div>

            {/* Milestone Checkpoints */}
            <div className="p-3.5 border-2 border-brand-dark bg-brand-bg flex flex-col justify-between">
              <span className="font-mono text-[10px] font-bold text-brand-muted uppercase">EVALUATIONS</span>
              <div className="my-1">
                <span className="font-heading font-extrabold text-2xl text-brand-navy">
                  {mentorReport.aggregateMetrics.totalEvaluationsCompleted}
                </span>
                <span className="font-mono text-xs text-brand-muted"> completed</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-brand-muted">
                {mentorReport.aggregateMetrics.totalEvaluationsUpcoming} upcoming sessions
              </span>
            </div>

            {/* Needs Attention */}
            <div className="p-3.5 border-2 border-brand-dark bg-brand-bg flex flex-col justify-between">
              <span className="font-mono text-[10px] font-bold text-brand-muted uppercase">SCHOLAR BACKLOGS</span>
              <div className="my-1">
                <span className={`font-heading font-extrabold text-2xl ${
                  mentorReport.aggregateMetrics.scholarsNeedingAttentionCount > 0 ? 'text-brand-coral' : 'text-brand-teal'
                }`}>
                  {mentorReport.aggregateMetrics.scholarsNeedingAttentionCount}
                </span>
                <span className="font-mono text-xs text-brand-muted"> scholars</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-brand-muted">
                {mentorReport.aggregateMetrics.scholarsNeedingAttentionCount > 0 ? 'Require mentor intervention' : 'All scholars on track'}
              </span>
            </div>
          </section>

          {/* Roster Progress Table */}
          <section className="space-y-3 break-inside-avoid">
            <div className="flex items-center justify-between border-b border-brand-dark/20 pb-1.5">
              <h3 className="font-heading font-extrabold text-sm sm:text-base text-brand-navy uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-brand-teal" />
                Assigned Scholar Progress Overview
              </h3>
              <span className="text-[10px] font-mono text-brand-muted">
                {mentorReport.studentSummaries.length} Scholars Listed
              </span>
            </div>

            {mentorReport.studentSummaries.length > 0 ? (
              <div className="border-2 border-brand-dark overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead className="bg-brand-paper-tint border-b-2 border-brand-dark text-[10px] uppercase font-bold text-brand-navy">
                    <tr>
                      <th className="p-2.5">Scholar</th>
                      <th className="p-2.5 text-center">Tasks (Done / Total)</th>
                      <th className="p-2.5 text-center">Task Velocity</th>
                      <th className="p-2.5 text-center">Assignments</th>
                      <th className="p-2.5 text-center">Reviews</th>
                      <th className="p-2.5 text-center">Status</th>
                      <th className="p-2.5 text-center print:hidden">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-brand-dark/20 bg-brand-paper">
                    {mentorReport.studentSummaries.map((s) => (
                      <tr key={s.studentId} className="hover:bg-brand-paper-tint/60 transition-colors">
                        <td className="p-2.5 font-sans">
                          <span className="font-bold text-brand-navy block">{s.studentName}</span>
                          <span className="font-mono text-[10px] text-brand-muted">
                            {s.poraplanId} {s.cohortName ? `• ${s.cohortName}` : ''}
                          </span>
                        </td>
                        <td className="p-2.5 text-center font-bold">
                          {s.tasksCompleted} / {s.tasksAssigned}
                          {s.tasksOverdue > 0 && (
                            <span className="block text-[10px] text-brand-coral font-bold">
                              ({s.tasksOverdue} overdue)
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${
                              s.tasksCompletionRate >= 80
                                ? 'bg-green-100 text-green-900 border-green-300'
                                : s.tasksCompletionRate >= 50
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-red-100 text-red-900 border-red-300'
                            }`}
                          >
                            {s.tasksCompletionRate}%
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          {s.assignmentsSubmitted} / {s.assignmentsAssigned}
                          {s.assignmentsPendingReview > 0 && (
                            <span className="block text-[10px] text-brand-gold font-bold">
                              {s.assignmentsPendingReview} awaiting
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          {s.evaluationsCompleted} done
                          {s.averageScorePercentage !== null && (
                            <span className="block text-[10px] text-brand-teal font-bold">
                              ({s.averageScorePercentage}%)
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          {s.needsAttention ? (
                            <span
                              className="px-1.5 py-0.5 text-[10px] font-bold bg-brand-coral text-white border border-brand-dark"
                              title={s.attentionReason}
                            >
                              Attention
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-brand-teal text-white border border-brand-dark">
                              On Track
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center print:hidden">
                          <button
                            type="button"
                            onClick={() => setSelectedStudentId(s.studentId)}
                            className="text-[10px] font-mono font-bold text-brand-teal hover:underline flex items-center justify-center gap-1 mx-auto"
                          >
                            <span>Inspect</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 border border-dashed border-brand-dark/30 text-center font-mono text-xs text-brand-muted">
                No scholars currently assigned to your mentorship roster.
              </div>
            )}
          </section>

          {/* Detailed Scholar Breakdown (when a specific student is inspected) */}
          {studentDetailReport && (
            <section className="space-y-4 pt-4 border-t-2 border-brand-dark break-before-page">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold uppercase text-brand-teal bg-brand-bg px-2 py-0.5 border border-brand-dark">
                      DETAILED SCHOLAR AUDIT
                    </span>
                    <span className="font-mono text-xs font-bold text-brand-navy">
                      {studentDetailReport.studentName} ({studentDetailReport.poraplanId})
                    </span>
                  </div>
                  <h4 className="font-heading font-extrabold text-base text-brand-navy mt-1">
                    Subject-Wise Breakdown &amp; Performance
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudentId('all')}
                  className="print:hidden text-xs font-mono font-bold text-brand-muted hover:text-brand-dark"
                >
                  Close Detail
                </button>
              </div>

              {/* Subject Breakdown Table */}
              <div className="border-2 border-brand-dark overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead className="bg-brand-paper-tint border-b-2 border-brand-dark text-[10px] uppercase font-bold text-brand-navy">
                    <tr>
                      <th className="p-2.5">Study Area</th>
                      <th className="p-2.5 text-center">Tasks</th>
                      <th className="p-2.5 text-center">Rate</th>
                      <th className="p-2.5 text-center">Assignments</th>
                      <th className="p-2.5 text-center">Avg Score</th>
                      <th className="p-2.5 text-center">Evaluations</th>
                      <th className="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-brand-dark/20 bg-brand-paper">
                    {studentDetailReport.subjectBreakdown.map((subj) => (
                      <tr key={subj.subjectId}>
                        <td className="p-2.5 font-sans font-bold text-brand-navy">
                          {subj.subjectName}
                        </td>
                        <td className="p-2.5 text-center font-bold">
                          {subj.tasksCompleted} / {subj.tasksTotal}
                        </td>
                        <td className="p-2.5 text-center font-bold">
                          {subj.tasksCompletionRate}%
                        </td>
                        <td className="p-2.5 text-center">
                          {subj.assignmentsSubmitted} / {subj.assignmentsTotal}
                        </td>
                        <td className="p-2.5 text-center font-bold">
                          {subj.assignmentsAverageScore !== null ? `${subj.assignmentsAverageScore}%` : '—'}
                        </td>
                        <td className="p-2.5 text-center font-bold">
                          {subj.evaluationsCompleted}
                        </td>
                        <td className="p-2.5 text-center">
                          {subj.needsAttention ? (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-brand-coral text-white border border-brand-dark">
                              Needs Focus
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-brand-teal text-white border border-brand-dark">
                              On Track
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Recent Evaluation Feedback */}
              {studentDetailReport.evaluationMetrics.recentFeedback.length > 0 && (
                <div className="space-y-2">
                  <h5 className="font-heading font-bold text-xs uppercase text-brand-muted tracking-wider">
                    Recent Evaluation Remarks &amp; Recommendations:
                  </h5>
                  <div className="space-y-2">
                    {studentDetailReport.evaluationMetrics.recentFeedback.map((fb) => (
                      <div key={fb.id} className="p-3 border border-brand-dark bg-brand-bg text-xs space-y-1">
                        <div className="flex items-center justify-between font-mono text-[10px] text-brand-muted">
                          <span className="font-bold text-brand-navy">{fb.title}</span>
                          <span>{fb.date} • Score: {fb.scorePercentage !== null ? `${fb.scorePercentage}%` : '—'}</span>
                        </div>
                        {fb.feedback && <p className="font-sans text-brand-dark text-xs">{fb.feedback}</p>}
                        {fb.recommendation && (
                          <p className="font-sans text-xs text-brand-teal font-medium">
                            <span className="font-bold">Next Steps: </span>{fb.recommendation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Report Footer */}
          <footer className="border-t-2 border-brand-dark pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] font-mono text-brand-muted">
            <div>
              <span>PoraPlan Platform Mentorship Analytics Engine</span>
              <span className="block text-[9px] text-brand-muted/80">
                Generated at: {new Date(mentorReport.generatedAt).toLocaleString()}
              </span>
            </div>
            <div className="text-left sm:text-right font-bold text-brand-navy">
              <span>"You study. We organize how, what and when."</span>
            </div>
          </footer>
        </article>
      ) : null}
    </div>
  );
};
