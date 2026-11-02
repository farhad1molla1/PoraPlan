import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  generateStudentReport,
  type StudentAcademicReport,
  type ReportPeriod,
} from '../../lib/reports';
import { formatLocalDate } from '../../lib/library';
import { Button } from '../../components/common/Button';
import {
  Printer,
  AlertTriangle,
  BookOpen,
  Sparkles,
  RefreshCw,
  Loader2,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';

export const StudentReportPage: React.FC = () => {
  const { user, profile } = useAuth();
  const studentId = profile?.id || user?.id || '';

  const [period, setPeriod] = useState<ReportPeriod>('weekly');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return formatLocalDate(d);
  });
  const [customEnd, setCustomEnd] = useState(() => formatLocalDate(new Date()));

  const [report, setReport] = useState<StudentAcademicReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    try {
      const { report: rep, error: err } = await generateStudentReport(
        studentId,
        period,
        period === 'custom' ? customStart : undefined,
        period === 'custom' ? customEnd : undefined
      );
      if (err) {
        setError(err.message || 'Unable to generate academic progress report.');
      } else {
        setReport(rep);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An error occurred during report generation.');
    } finally {
      setLoading(false);
    }
  }, [studentId, period, customStart, customEnd]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

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
            <Link
              to="/student/library?tab=evaluations"
              className="text-xs font-mono font-bold text-brand-muted hover:text-brand-dark flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Academic Library</span>
            </Link>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold font-heading text-brand-navy tracking-tight">
            Academic Progress &amp; Performance Report
          </h1>
          <p className="text-xs text-brand-muted mt-0.5">
            Audit your task execution velocity, practice submission status, and milestone evaluations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchReport}
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

      {/* Period Filter Selector (Hidden in Print) */}
      <div className="print:hidden p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="font-bold text-brand-muted uppercase text-[10px]">Report Window:</span>
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
              {p === 'weekly' ? 'Weekly (Last 7 Days)' : p === 'monthly' ? 'Monthly (Last 30 Days)' : 'Custom Period'}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-2 text-xs font-mono">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2.5 py-1 border-2 border-brand-dark bg-brand-bg text-xs font-mono"
              aria-label="Start Date"
            />
            <span className="font-bold text-brand-muted">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2.5 py-1 border-2 border-brand-dark bg-brand-bg text-xs font-mono"
              aria-label="End Date"
            />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. REPORT CONTENT BODY (A4 PRINT FRIENDLY)                                */}
      {/* ========================================================================= */}
      {loading ? (
        <div className="p-16 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center space-y-3">
          <Loader2 className="w-8 h-8 text-brand-teal animate-spin mx-auto" />
          <h3 className="font-heading font-extrabold text-base text-brand-navy">
            COMPUTING ACADEMIC REPORT
          </h3>
          <p className="font-mono text-xs text-brand-muted">
            Aggregating historical tasks, graded submissions, and milestone evaluations...
          </p>
        </div>
      ) : error ? (
        <div className="p-6 border-2 border-brand-dark bg-red-50 text-red-900 shadow-brutal flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-heading font-bold text-sm">Failed to generate report</h4>
            <p className="font-mono text-xs text-red-800">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchReport} className="mt-2">
              Retry Generation
            </Button>
          </div>
        </div>
      ) : report ? (
        <article className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-6 sm:p-8 space-y-6 print:border-none print:shadow-none print:p-0 print:space-y-4">
          {/* Header & Scholar Identity Card */}
          <header className="border-b-2 border-brand-dark pb-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-[10px] uppercase font-extrabold tracking-widest text-brand-teal bg-brand-bg px-2 py-0.5 border border-brand-dark">
                  PORAPLAN ACADEMIC AUDIT
                </span>
                <span className="font-mono text-[10px] text-brand-muted">
                  CONFIDENTIAL • SCHOLAR ARCHIVE
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-brand-navy tracking-tight">
                Academic Progress Report
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-brand-dark pt-1">
                <div>
                  <span className="text-brand-muted font-bold">SCHOLAR: </span>
                  <span className="font-extrabold">{report.studentName}</span>
                </div>
                <div>
                  <span className="text-brand-muted font-bold">ID: </span>
                  <span className="font-bold text-brand-teal">{report.poraplanId}</span>
                </div>
                {report.studentEmail && (
                  <div>
                    <span className="text-brand-muted font-bold">EMAIL: </span>
                    <span>{report.studentEmail}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="text-left sm:text-right space-y-1 text-xs font-mono border-t sm:border-t-0 pt-2 sm:pt-0 border-brand-dark/20">
              <div className="font-bold text-brand-navy bg-brand-paper-tint sm:bg-transparent p-2 sm:p-0 border sm:border-none border-brand-dark">
                <span className="text-brand-muted block text-[10px] uppercase">AUDIT WINDOW</span>
                <span>{report.dateRange.startDate} — {report.dateRange.endDate}</span>
              </div>
              {report.programName && (
                <div className="text-[11px] text-brand-muted">
                  <span className="font-bold">PROGRAM: </span>{report.programName}
                </div>
              )}
              {report.cohortName && (
                <div className="text-[11px] text-brand-muted">
                  <span className="font-bold">COHORT: </span>{report.cohortName}
                </div>
              )}
              {report.mentorName && (
                <div className="text-[11px] text-brand-teal font-bold">
                  <span>MENTOR: </span>{report.mentorName}
                </div>
              )}
            </div>
          </header>

          {/* KPI Summary Tiles */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
            {/* Task Velocity */}
            <div className="p-3.5 border-2 border-brand-dark bg-brand-bg flex flex-col justify-between">
              <span className="font-mono text-[10px] font-bold text-brand-muted uppercase">TASKS EXECUTED</span>
              <div className="my-1">
                <span className="font-heading font-extrabold text-2xl text-brand-navy">
                  {report.taskMetrics.completed}
                </span>
                <span className="font-mono text-xs text-brand-muted"> / {report.taskMetrics.totalAssigned}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono font-bold">
                <span className="text-brand-teal">{report.taskMetrics.completionRate}% completion</span>
                {report.taskMetrics.overdue > 0 && (
                  <span className="text-brand-coral">{report.taskMetrics.overdue} overdue</span>
                )}
              </div>
            </div>

            {/* Practice Submissions */}
            <div className="p-3.5 border-2 border-brand-dark bg-brand-bg flex flex-col justify-between">
              <span className="font-mono text-[10px] font-bold text-brand-muted uppercase">ASSIGNMENTS</span>
              <div className="my-1">
                <span className="font-heading font-extrabold text-2xl text-brand-navy">
                  {report.assignmentMetrics.submitted}
                </span>
                <span className="font-mono text-xs text-brand-muted"> / {report.assignmentMetrics.totalAssigned}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono font-bold">
                <span className="text-brand-teal">{report.assignmentMetrics.submissionRate}% turned in</span>
                <span className="text-brand-muted">{report.assignmentMetrics.reviewed} reviewed</span>
              </div>
            </div>

            {/* Graded Performance */}
            <div className="p-3.5 border-2 border-brand-dark bg-brand-bg flex flex-col justify-between">
              <span className="font-mono text-[10px] font-bold text-brand-muted uppercase">AVERAGE SCORE</span>
              <div className="my-1">
                <span className="font-heading font-extrabold text-2xl text-brand-navy">
                  {report.evaluationMetrics.averageScorePercentage !== null
                    ? `${report.evaluationMetrics.averageScorePercentage}%`
                    : report.assignmentMetrics.averageScorePercentage !== null
                    ? `${report.assignmentMetrics.averageScorePercentage}%`
                    : '—'}
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold text-brand-teal">
                {report.evaluationMetrics.scoredCount > 0
                  ? `${report.evaluationMetrics.scoredCount} graded review(s)`
                  : 'Awaiting graded sessions'}
              </span>
            </div>

            {/* Study Time / Volume */}
            <div className="p-3.5 border-2 border-brand-dark bg-brand-bg flex flex-col justify-between">
              <span className="font-mono text-[10px] font-bold text-brand-muted uppercase">ESTIMATED EFFORT</span>
              <div className="my-1">
                <span className="font-heading font-extrabold text-2xl text-brand-teal">
                  {Math.round((report.taskMetrics.totalEstimatedMinutes / 60) * 10) / 10}
                </span>
                <span className="font-mono text-xs text-brand-muted"> hours</span>
              </div>
              <span className="text-[10px] font-mono text-brand-muted">
                {report.taskMetrics.totalEstimatedMinutes} focused minutes logged
              </span>
            </div>
          </section>

          {/* Attention Banner if Any */}
          {report.subjectBreakdown.some((s) => s.needsAttention) && (
            <div className="p-3.5 border-2 border-brand-dark bg-brand-coral-light/40 flex items-start gap-2.5 print:border-brand-dark">
              <AlertTriangle className="w-4 h-4 text-brand-coral shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-xs">
                <span className="font-heading font-bold text-brand-navy block">
                  Academic Focus &amp; Attention Items
                </span>
                <ul className="list-disc pl-4 space-y-0.5 font-sans text-brand-dark text-xs">
                  {report.subjectBreakdown
                    .filter((s) => s.needsAttention && s.attentionReason)
                    .map((s) => (
                      <li key={s.subjectId}>
                        <span className="font-bold">{s.subjectName}: </span>
                        {s.attentionReason}
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          )}

          {/* Subject-Wise Academic Breakdown */}
          <section className="space-y-3 break-inside-avoid">
            <div className="flex items-center justify-between border-b border-brand-dark/20 pb-1.5">
              <h3 className="font-heading font-extrabold text-sm sm:text-base text-brand-navy uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-brand-teal" />
                Subject-Wise Performance Matrix
              </h3>
              <span className="text-[10px] font-mono text-brand-muted">
                {report.subjectBreakdown.length} Active Study Areas
              </span>
            </div>

            {report.subjectBreakdown.length > 0 ? (
              <div className="border-2 border-brand-dark overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead className="bg-brand-paper-tint border-b-2 border-brand-dark text-[10px] uppercase font-bold text-brand-navy">
                    <tr>
                      <th className="p-2.5">Study Area</th>
                      <th className="p-2.5 text-center">Tasks (Done / Total)</th>
                      <th className="p-2.5 text-center">Task Rate</th>
                      <th className="p-2.5 text-center">Assignments</th>
                      <th className="p-2.5 text-center">Asg Score</th>
                      <th className="p-2.5 text-center">Reviews</th>
                      <th className="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-brand-dark/20 bg-brand-paper">
                    {report.subjectBreakdown.map((subj) => (
                      <tr key={subj.subjectId} className="hover:bg-brand-paper-tint/60 transition-colors">
                        <td className="p-2.5 font-sans font-bold text-brand-navy">
                          {subj.subjectName}
                          {subj.subjectCode && (
                            <span className="block font-mono text-[10px] text-brand-muted font-normal">
                              {subj.subjectCode}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-bold">
                          {subj.tasksCompleted} / {subj.tasksTotal}
                        </td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${
                              subj.tasksCompletionRate >= 80
                                ? 'bg-green-100 text-green-900 border-green-300'
                                : subj.tasksCompletionRate >= 50
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-red-100 text-red-900 border-red-300'
                            }`}
                          >
                            {subj.tasksCompletionRate}%
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          {subj.assignmentsSubmitted} / {subj.assignmentsTotal}
                        </td>
                        <td className="p-2.5 text-center">
                          {subj.assignmentsAverageScore !== null ? `${subj.assignmentsAverageScore}%` : '—'}
                        </td>
                        <td className="p-2.5 text-center font-bold">
                          {subj.evaluationsCompleted} done
                          {subj.evaluationsAverageScore !== null && (
                            <span className="block text-[10px] text-brand-teal font-normal">
                              ({subj.evaluationsAverageScore}% avg)
                            </span>
                          )}
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
            ) : (
              <p className="font-mono text-xs text-brand-muted p-4 border border-dashed border-brand-dark/30 text-center">
                No active subjects associated with this scholar profile in the selected period.
              </p>
            )}
          </section>

          {/* Evaluations & Mentor Guidance Remarks */}
          <section className="space-y-3 break-inside-avoid">
            <div className="flex items-center justify-between border-b border-brand-dark/20 pb-1.5">
              <h3 className="font-heading font-extrabold text-sm sm:text-base text-brand-navy uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-brand-gold" />
                Evaluations &amp; Mentor Guidance History
              </h3>
              <span className="text-[10px] font-mono text-brand-muted">
                {report.evaluationMetrics.recentFeedback.length} Graded Session(s) Recorded
              </span>
            </div>

            {report.evaluationMetrics.recentFeedback.length > 0 ? (
              <div className="space-y-3">
                {report.evaluationMetrics.recentFeedback.map((fb) => (
                  <div
                    key={fb.id}
                    className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs space-y-2 break-inside-avoid"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-brand-dark/15 pb-2">
                      <div>
                        <span className="font-heading font-bold text-sm text-brand-navy block">
                          {fb.title}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-brand-muted">
                          <span>Date: {fb.date}</span>
                          {fb.subjectName && <span>• Subject: {fb.subjectName}</span>}
                          {fb.mentorName && <span>• Evaluator: {fb.mentorName}</span>}
                        </div>
                      </div>
                      {fb.scorePercentage !== null && (
                        <div className="px-2.5 py-1 border border-brand-dark bg-brand-teal-light font-mono text-xs font-bold text-brand-navy">
                          Score: {fb.scorePercentage}%
                        </div>
                      )}
                    </div>

                    {fb.feedback && (
                      <p className="text-xs font-sans text-brand-dark leading-relaxed whitespace-pre-line">
                        {fb.feedback}
                      </p>
                    )}

                    {fb.recommendation && (
                      <div className="p-2.5 border border-brand-dark bg-brand-paper-tint text-xs space-y-0.5">
                        <span className="font-mono text-[10px] uppercase font-bold text-brand-teal block">
                          Key Recommendation:
                        </span>
                        <p className="font-sans text-brand-dark">{fb.recommendation}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 border border-dashed border-brand-dark/30 text-center font-mono text-xs text-brand-muted">
                No evaluated sessions recorded during this reporting window.
              </div>
            )}
          </section>

          {/* Report Footer Certification */}
          <footer className="border-t-2 border-brand-dark pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] font-mono text-brand-muted">
            <div>
              <span>PoraPlan Platform Verification Engine • Automated Academic Audit</span>
              <span className="block text-[9px] text-brand-muted/80">
                Generated at: {new Date(report.generatedAt).toLocaleString()}
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
