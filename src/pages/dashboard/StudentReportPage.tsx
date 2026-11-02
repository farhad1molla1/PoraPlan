import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  generateStudentReport,
  type StudentAcademicReport,
  type ReportPeriod,
  REPORT_THRESHOLDS,
} from '../../lib/reports';
import { formatLocalDate } from '../../lib/library';
import { Button } from '../../components/common/Button';
import {
  Printer,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Calendar,
  FileText,
  Target,
  MessageSquareQuote,
  Award,
  ShieldCheck,
  Check,
  X,
} from 'lucide-react';

export const StudentReportPage: React.FC = () => {
  const { user, profile, role } = useAuth();
  const [searchParams] = useSearchParams();
  const paramStudentId = searchParams.get('studentId');
  const isAdmin = role === 'admin';
  const studentId = (isAdmin && paramStudentId) ? paramStudentId : (profile?.id || user?.id || '');

  const [period, setPeriod] = useState<ReportPeriod>('schedule');
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
        period === 'custom' ? customEnd : undefined,
        {
          requestingUserId: profile?.id || user?.id || '',
          requestingUserRole: (isAdmin ? 'admin' : 'student') as 'admin' | 'student',
        }
      );
      if (err) {
        setError(err.message || 'Unable to generate academic performance report.');
      } else {
        setReport(rep);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An error occurred during report generation.');
    } finally {
      setLoading(false);
    }
  }, [studentId, period, customStart, customEnd, isAdmin, profile?.id, user?.id]);

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
      {/* ========================================================================= */}
      {/* DEDICATED ACADEMIC TYPOGRAPHY & PRINT-SPECIFIC A4 STYLESHEET              */}
      {/* ========================================================================= */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@600;700&family=Source+Sans+3:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,600&family=Source+Serif+4:ital,opsz,wght@0,8..60,600;0,8..60,700;0,8..60,800;1,8..60,600&display=swap');

        /* Scoped Academic Document Typography (Does NOT bleed into main app) */
        .academic-doc {
          font-family: 'Source Sans 3', 'Noto Sans Bengali', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          color: #082B4C;
          line-height: 1.45;
        }

        .academic-heading,
        .academic-doc h1,
        .academic-doc h2,
        .academic-doc h3,
        .academic-doc h4,
        .academic-serif {
          font-family: 'Source Serif 4', 'Noto Serif Bengali', Georgia, 'Times New Roman', Cambria, serif;
          font-feature-settings: 'cv01', 'cv02', 'onum';
        }

        .academic-sans {
          font-family: 'Source Sans 3', 'Noto Sans Bengali', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        @page {
          size: A4 portrait;
          margin: 10mm 12mm 10mm 12mm;
        }

        @media print {
          html, body {
            background-color: #ffffff !important;
            color: #082B4C !important;
            font-size: 9.2pt !important;
            line-height: 1.35 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-family: 'Source Sans 3', 'Noto Sans Bengali', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          }
          .academic-heading, h1, h2, h3, h4, .academic-serif {
            font-family: 'Source Serif 4', 'Noto Serif Bengali', Georgia, serif !important;
          }
          nav, aside, header.sticky, main > footer, .print\\:hidden {
            display: none !important;
          }
          article header, article footer, .academic-doc header, .academic-doc footer {
            display: flex !important;
          }
          .print\\:page-break {
            page-break-after: always !important;
            break-after: page !important;
          }
          .break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .shadow-brutal, .shadow-brutal-sm, .shadow-brutal-xs {
            box-shadow: none !important;
          }
          .border-2 {
            border-width: 1px !important;
          }
        }
      `}</style>

      {/* ========================================================================= */}
      {/* 1. INTERACTIVE CONTROL BAR (SCREEN ONLY — HIDDEN IN PRINT)                */}
      {/* ========================================================================= */}
      <div className="print:hidden p-4 sm:p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {isAdmin ? (
              <Link
                to="/admin/reports"
                className="text-xs font-mono font-bold text-brand-navy hover:text-brand-teal flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Admin Reporting Center</span>
              </Link>
            ) : (
              <Link
                to="/student/library?tab=evaluations"
                className="text-xs font-mono font-bold text-brand-muted hover:text-brand-dark flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Academic Library</span>
              </Link>
            )}
          </div>
          {isAdmin && (
            <span className="font-mono text-[10px] uppercase font-bold text-brand-gold bg-brand-navy px-2 py-0.5 border border-brand-dark inline-block mb-1">
              ADMINISTRATIVE AUDIT VIEW • {report?.studentName || studentId}
            </span>
          )}
          <h1 className="text-xl sm:text-2xl font-extrabold font-heading text-brand-navy tracking-tight">
            Academic Performance &amp; Improvement Report
          </h1>
          <p className="text-xs text-brand-muted mt-0.5">
            Audit syllabus execution, milestone evaluation scores, and targeted improvement actions.
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
            className="flex items-center gap-1.5 shadow-brutal-xs bg-brand-navy text-white hover:bg-brand-navy/90"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report (A4)</span>
          </Button>
        </div>
      </div>

      {/* Period Selector (Screen Only) */}
      <div className="print:hidden p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="font-bold text-brand-muted uppercase text-[10px]">Audit Window:</span>
          {(['schedule', 'weekly', 'monthly', 'custom'] as ReportPeriod[]).map((p) => (
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
              {p === 'schedule'
                ? 'Task Schedule (Active Syllabus)'
                : p === 'weekly'
                ? 'Weekly (Last 7 Days)'
                : p === 'monthly'
                ? 'Monthly (Last 30 Days)'
                : 'Custom Period'}
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
      {/* 2. REPORT CONTENT BODY (A4 DOCUMENT)                                      */}
      {/* ========================================================================= */}
      {loading ? (
        <div className="p-16 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center space-y-3">
          <Loader2 className="w-8 h-8 text-brand-teal animate-spin mx-auto" />
          <h3 className="font-heading font-extrabold text-base text-brand-navy">
            COMPUTING ACADEMIC REPORT
          </h3>
          <p className="font-mono text-xs text-brand-muted">
            Analyzing cohort tasks, weighted evaluations, practice submissions, and schedule consistency...
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
        <div className="academic-doc space-y-8 print:space-y-0">
          {/* ===================================================================== */}
          {/* PAGE 1: PERFORMANCE OVERVIEW                                          */}
          {/* ===================================================================== */}
          <article className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-6 sm:p-8 space-y-6 print:border-none print:shadow-none print:p-0 print:space-y-5 print:page-break">
            {/* Header: Logo, Branding, Metadata */}
            <header className="border-b-2 border-brand-dark pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <img
                  src="/poraplan-logo.png"
                  alt="PoraPlan Logo"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/assets/poraplan-logo.png';
                  }}
                  className="w-12 h-12 object-contain rounded border border-brand-dark/20 bg-white p-1 shrink-0"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="academic-sans text-[9px] uppercase font-bold tracking-widest text-brand-navy bg-brand-paper-tint px-2 py-0.5 border border-brand-dark">
                      PORAPLAN ACADEMIC MENTORSHIP
                    </span>
                    <span className="academic-sans text-[9px] text-brand-muted">
                      CONFIDENTIAL • SCHOLAR ARCHIVE
                    </span>
                  </div>
                  <h2 className="academic-heading text-xl sm:text-2xl font-bold text-brand-navy tracking-tight">
                    Academic Performance &amp; Improvement Report
                  </h2>
                  <p className="academic-sans text-xs text-brand-muted">
                    Official progress audit of syllabus execution, milestone exams, and targeted focus areas.
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right space-y-0.5 text-xs academic-sans border-t sm:border-t-0 pt-2 sm:pt-0 border-brand-dark/20 shrink-0">
                <div className="text-brand-navy font-bold">
                  <span className="text-brand-muted block text-[9px] uppercase tracking-wider">AUDIT WINDOW</span>
                  <span>{report.dateRange.startDate} — {report.dateRange.endDate}</span>
                </div>
                <div className="text-[10px] text-brand-muted">
                  Schedule: <strong className="text-brand-dark">{report.studyConsistency.totalScheduledDays} Scheduled Study Day{report.studyConsistency.totalScheduledDays === 1 ? '' : 's'}</strong>
                </div>
                <div className="text-[10px] text-brand-muted">
                  Generated: {new Date(report.generatedAt).toLocaleDateString()}
                </div>
              </div>
            </header>

            {/* Student & Mentor Academic Credentials Banner */}
            <div className="p-3.5 border-2 border-brand-dark bg-brand-bg grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs academic-sans break-inside-avoid">
              <div>
                <span className="text-brand-muted text-[10px] uppercase font-bold block">SCHOLAR NAME</span>
                <span className="font-bold text-brand-navy text-sm">{report.studentName}</span>
              </div>
              <div>
                <span className="text-brand-muted text-[10px] uppercase font-bold block">PORAPLAN ID</span>
                <span className="font-bold text-brand-teal text-sm">{report.poraplanId}</span>
              </div>
              <div>
                <span className="text-brand-muted text-[10px] uppercase font-bold block">ACADEMIC PROGRAM</span>
                <span className="font-semibold text-brand-dark">
                  {report.programName || 'Academic Mentorship'}
                  {report.cohortName ? ` (${report.cohortName})` : ''}
                </span>
              </div>
              <div>
                <span className="text-brand-muted text-[10px] uppercase font-bold block">ASSIGNED MENTOR</span>
                <span className="font-semibold text-brand-dark">{report.mentorName || 'Lead Mentor'}</span>
              </div>

              {(report.university || report.department || report.batch || report.currentSemester) && (
                <div className="col-span-2 sm:col-span-4 pt-2 border-t border-brand-dark/20 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-brand-muted">
                  {report.university && (
                    <span>
                      <strong className="text-brand-dark">Institution:</strong> {report.university}
                    </span>
                  )}
                  {report.department && (
                    <span>
                      <strong className="text-brand-dark">Department:</strong> {report.department}
                    </span>
                  )}
                  {report.batch && (
                    <span>
                      <strong className="text-brand-dark">Batch:</strong> {report.batch}
                    </span>
                  )}
                  {report.currentSemester && (
                    <span>
                      <strong className="text-brand-dark">Semester:</strong> {report.currentSemester}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 4 Core KPI Indicators */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 break-inside-avoid">
              {/* 1. Task Completion Rate */}
              <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-brand-muted mb-1">
                  <span className="text-[10px] academic-sans font-bold uppercase">Task Execution</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal" />
                </div>
                <div>
                  <div className="academic-heading text-2xl sm:text-3xl font-bold text-brand-navy">
                    {report.taskMetrics.isCompletionRateApplicable
                      ? `${report.taskMetrics.completionRate}%`
                      : 'N/A'}
                  </div>
                  <div className="text-[10px] academic-sans mt-1 text-brand-muted">
                    {report.taskMetrics.completed}/{report.taskMetrics.totalAssigned} scheduled tasks
                  </div>
                </div>
                {report.taskMetrics.completionRateDelta !== null && report.taskMetrics.completionRateDelta !== undefined && (
                  <div className={`text-[10px] academic-sans font-bold mt-1.5 pt-1.5 border-t border-brand-dark/10 ${
                    report.taskMetrics.completionRateDelta >= 0 ? 'text-emerald-700' : 'text-amber-700'
                  }`}>
                    {report.taskMetrics.completionRateDelta >= 0 ? '▲ +' : '▼ '}
                    {report.taskMetrics.completionRateDelta}% vs prev cycle
                  </div>
                )}
              </div>

              {/* 2. Weighted Evaluation Average */}
              <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-brand-muted mb-1">
                  <span className="text-[10px] academic-sans font-bold uppercase">Weighted Mastery</span>
                  <Award className="w-3.5 h-3.5 text-brand-navy" />
                </div>
                <div>
                  <div className="academic-heading text-2xl sm:text-3xl font-bold text-brand-navy">
                    {report.evaluationMetrics.weightedAveragePercentage !== null
                      ? `${report.evaluationMetrics.weightedAveragePercentage}%`
                      : 'N/A'}
                  </div>
                  <div className="text-[10px] academic-sans mt-1 text-brand-muted">
                    {report.evaluationMetrics.scoredCount > 0
                      ? `${report.evaluationMetrics.totalEarnedPoints}/${report.evaluationMetrics.totalPossiblePoints} pts (${report.evaluationMetrics.scoredCount} exam${report.evaluationMetrics.scoredCount === 1 ? '' : 's'})`
                      : 'No scored exams in window'}
                  </div>
                </div>
                {report.evaluationMetrics.evaluationAverageDelta !== null && report.evaluationMetrics.evaluationAverageDelta !== undefined && (
                  <div className={`text-[10px] academic-sans font-bold mt-1.5 pt-1.5 border-t border-brand-dark/10 ${
                    report.evaluationMetrics.evaluationAverageDelta >= 0 ? 'text-emerald-700' : 'text-amber-700'
                  }`}>
                    {report.evaluationMetrics.evaluationAverageDelta >= 0 ? '▲ +' : '▼ '}
                    {report.evaluationMetrics.evaluationAverageDelta}% vs prev cycle
                  </div>
                )}
              </div>

              {/* 3. Assignment Submission Rate */}
              <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-brand-muted mb-1">
                  <span className="text-[10px] academic-sans font-bold uppercase">Practice Submissions</span>
                  <FileText className="w-3.5 h-3.5 text-brand-teal" />
                </div>
                <div>
                  <div className="academic-heading text-2xl sm:text-3xl font-bold text-brand-navy">
                    {report.assignmentMetrics.isSubmissionRateApplicable
                      ? `${report.assignmentMetrics.submissionRate}%`
                      : 'N/A'}
                  </div>
                  <div className="text-[10px] academic-sans mt-1 text-brand-muted">
                    {report.assignmentMetrics.submitted}/{report.assignmentMetrics.totalAssigned} problem sets
                  </div>
                </div>
                {report.assignmentMetrics.submissionRateDelta !== null && report.assignmentMetrics.submissionRateDelta !== undefined && (
                  <div className={`text-[10px] academic-sans font-bold mt-1.5 pt-1.5 border-t border-brand-dark/10 ${
                    report.assignmentMetrics.submissionRateDelta >= 0 ? 'text-emerald-700' : 'text-amber-700'
                  }`}>
                    {report.assignmentMetrics.submissionRateDelta >= 0 ? '▲ +' : '▼ '}
                    {report.assignmentMetrics.submissionRateDelta}% vs prev cycle
                  </div>
                )}
              </div>

              {/* 4. Schedule Consistency (Milestone 12.2.1 Formula) */}
              <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-brand-muted mb-1">
                  <span className="text-[10px] academic-sans font-bold uppercase">Schedule Consistency</span>
                  <Calendar className="w-3.5 h-3.5 text-brand-gold" />
                </div>
                <div>
                  <div className="academic-heading text-2xl sm:text-3xl font-bold text-brand-navy">
                    {report.studyConsistency.isConsistencyApplicable && report.studyConsistency.consistencyPercentage !== null
                      ? `${report.studyConsistency.consistencyPercentage}%`
                      : 'N/A'}
                  </div>
                  <div className="text-[10px] academic-sans mt-1 text-brand-muted">
                    {report.studyConsistency.totalScheduledDays > 0
                      ? `${report.studyConsistency.consistentScheduledDays} of ${report.studyConsistency.totalScheduledDays} scheduled days active`
                      : 'No scheduled days in window'}
                  </div>
                </div>
                <div className="text-[10px] academic-sans text-brand-muted mt-1.5 pt-1.5 border-t border-brand-dark/10">
                  {report.studyConsistency.onTimeScheduledDays} days completed on-time
                </div>
              </div>
            </div>

            {/* Subject-wise Performance Matrix */}
            <div className="space-y-2 break-inside-avoid">
              <div className="flex items-center justify-between">
                <h3 className="academic-heading font-bold text-sm sm:text-base text-brand-navy flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-brand-teal" />
                  <span>Subject Performance &amp; Mastery Matrix</span>
                </h3>
                <span className="text-[10px] academic-sans text-brand-muted">
                  Benchmark: &ge;{REPORT_THRESHOLDS.MASTERY_SCORE_MIN}% Mastery / &lt;{REPORT_THRESHOLDS.ATTENTION_SCORE_MAX}% Attention
                </span>
              </div>

              <div className="border-2 border-brand-dark overflow-x-auto bg-brand-paper">
                <table className="w-full text-left border-collapse text-xs academic-sans">
                  <thead>
                    <tr className="bg-brand-paper-tint border-b-2 border-brand-dark text-brand-navy">
                      <th className="p-2.5 font-bold">Subject</th>
                      <th className="p-2.5 font-bold text-center">Weighted Score</th>
                      <th className="p-2.5 font-bold text-center">Exams</th>
                      <th className="p-2.5 font-bold text-center">Tasks Completed</th>
                      <th className="p-2.5 font-bold text-center">Practice Submitted</th>
                      <th className="p-2.5 font-bold text-right">Academic Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-dark/10">
                    {report.subjectBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-brand-muted italic">
                          No subjects assigned or active in this audit cycle.
                        </td>
                      </tr>
                    ) : (
                      report.subjectBreakdown.map((subj) => (
                        <tr key={subj.subjectId} className="hover:bg-brand-paper-tint/50">
                          <td className="p-2.5 font-bold text-brand-navy">
                            <div>{subj.subjectName}</div>
                            {subj.subjectCode && (
                              <span className="text-[10px] text-brand-muted font-normal">
                                {subj.subjectCode}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            {subj.evaluationsAverageScore !== null ? (
                              <span
                                className={`font-bold ${
                                  subj.evaluationsAverageScore >= REPORT_THRESHOLDS.MASTERY_SCORE_MIN
                                    ? 'text-emerald-700'
                                    : subj.evaluationsAverageScore < REPORT_THRESHOLDS.ATTENTION_SCORE_MAX
                                    ? 'text-red-700'
                                    : 'text-brand-navy'
                                }`}
                              >
                                {subj.evaluationsAverageScore}%
                              </span>
                            ) : (
                              <span className="text-brand-muted">N/A</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            {subj.evaluationsScoredCount > 0 ? (
                              <span>
                                {subj.evaluationsScoredCount} scored ({subj.evaluationsEarnedPoints}/{subj.evaluationsPossiblePoints} pts)
                              </span>
                            ) : subj.evaluationsCompleted > 0 ? (
                              <span className="text-brand-muted">{subj.evaluationsCompleted} oral/unscored</span>
                            ) : (
                              <span className="text-brand-muted">0</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            {subj.tasksTotal > 0 ? (
                              <span>
                                {subj.tasksCompleted}/{subj.tasksTotal} ({subj.tasksCompletionRate}%)
                              </span>
                            ) : (
                              <span className="text-brand-muted">No tasks due</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            {subj.assignmentsTotal > 0 ? (
                              <span>
                                {subj.assignmentsSubmitted}/{subj.assignmentsTotal}
                                {subj.assignmentsReviewed > 0 && ` (${subj.assignmentsReviewed} reviewed)`}
                              </span>
                            ) : (
                              <span className="text-brand-muted">No problem sets</span>
                            )}
                          </td>
                          <td className="p-2.5 text-right">
                            <span
                              className={`px-2 py-0.5 border text-[10px] font-bold inline-block ${
                                subj.performanceStatus === 'mastery'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-700'
                                  : subj.performanceStatus === 'attention_required'
                                  ? 'bg-red-50 text-red-800 border-red-700'
                                  : subj.performanceStatus === 'insufficient_evidence'
                                  ? 'bg-gray-100 text-gray-700 border-gray-400'
                                  : 'bg-blue-50 text-blue-800 border-blue-700'
                              }`}
                            >
                              {subj.performanceStatusLabel}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Assignment & Practice Execution Summary */}
            <div className="p-3.5 border-2 border-brand-dark bg-brand-bg space-y-2 break-inside-avoid">
              <h4 className="academic-heading font-bold text-xs uppercase tracking-wider text-brand-navy flex items-center justify-between">
                <span>Practice Assignment Quality &amp; Grading Status</span>
                <span className="text-[10px] academic-sans text-brand-muted">
                  {report.assignmentMetrics.totalAssigned} Unique Problem Sets Assigned
                </span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs academic-sans">
                <div className="p-2 border border-brand-dark/20 bg-white">
                  <span className="text-brand-muted text-[10px] block">SUBMITTED</span>
                  <span className="font-bold text-brand-navy text-base">
                    {report.assignmentMetrics.submitted}
                  </span>
                  <span className="text-[10px] text-brand-muted block">
                    {report.assignmentMetrics.submittedOnTime} on-time, {report.assignmentMetrics.submittedLate} late
                  </span>
                </div>
                <div className="p-2 border border-brand-dark/20 bg-white">
                  <span className="text-brand-muted text-[10px] block">PENDING REVIEW</span>
                  <span className="font-bold text-amber-700 text-base">
                    {report.assignmentMetrics.pendingReview}
                  </span>
                  <span className="text-[10px] text-brand-muted block">With mentor</span>
                </div>
                <div className="p-2 border border-brand-dark/20 bg-white">
                  <span className="text-brand-muted text-[10px] block">REVIEWED &amp; GRADED</span>
                  <span className="font-bold text-emerald-700 text-base">
                    {report.assignmentMetrics.reviewed}
                  </span>
                  <span className="text-[10px] text-brand-muted block">
                    {report.assignmentMetrics.averageScorePercentage !== null
                      ? `Avg: ${report.assignmentMetrics.averageScorePercentage}%`
                      : 'Graded'}
                  </span>
                </div>
                <div className="p-2 border border-brand-dark/20 bg-white">
                  <span className="text-brand-muted text-[10px] block">REVISION REQUESTED</span>
                  <span className="font-bold text-red-700 text-base">
                    {report.assignmentMetrics.needsRevision}
                  </span>
                  <span className="text-[10px] text-brand-muted block">Action required</span>
                </div>
                <div className="p-2 border border-brand-dark/20 bg-white">
                  <span className="text-brand-muted text-[10px] block">NOT SUBMITTED</span>
                  <span className="font-bold text-brand-muted text-base">
                    {report.assignmentMetrics.unsubmitted}
                  </span>
                  <span className="text-[10px] text-brand-muted block">Outstanding</span>
                </div>
              </div>
            </div>

            {/* Page 1 Footer */}
            <footer className="pt-3 border-t border-brand-dark/20 flex items-center justify-between text-[10px] academic-sans text-brand-muted break-inside-avoid">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-teal" />
                <span>PoraPlan Academic Mentorship Platform • Official Scholar Performance Archive</span>
              </div>
              <div className="font-bold">Page 1 of 2</div>
            </footer>
          </article>

          {/* ===================================================================== */}
          {/* PAGE BREAK (CLEAN SEPARATION FOR A4 PRINT)                            */}
          {/* ===================================================================== */}
          <div className="print:page-break my-6 print:my-0 border-t-2 border-dashed border-brand-dark/20 print:border-none" />

          {/* ===================================================================== */}
          {/* PAGE 2: INSIGHTS, CONSISTENCY GRAPH & ACTIONABLE ROADMAP              */}
          {/* ===================================================================== */}
          <article className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-6 sm:p-7 space-y-4 print:border-none print:shadow-none print:p-0 print:space-y-3">
            {/* Page 2 Running Header */}
            <header className="border-b border-brand-dark/30 pb-2.5 flex items-center justify-between text-xs academic-sans">
              <div className="flex items-center gap-3">
                <span className="font-bold text-brand-navy">{report.studentName}</span>
                <span className="text-brand-teal font-bold">{report.poraplanId}</span>
                <span className="text-brand-muted">
                  {report.programName || 'Academic Mentorship'}
                </span>
              </div>
              <div className="text-brand-muted font-semibold text-[11px]">
                Academic Performance &amp; Improvement Report • Page 2 of 2
              </div>
            </header>

            {/* =================================================================== */}
            {/* 1. DAILY CONSISTENCY GRAPH (MILESTONE 12.2.1 / 12.3 REQUIREMENT)   */}
            {/* =================================================================== */}
            <section className="space-y-1.5 break-inside-avoid">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <h3 className="academic-heading font-bold text-sm text-brand-navy flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-brand-teal" />
                  <span>Daily Schedule Execution Consistency</span>
                </h3>
                <span className="text-[10px] academic-sans text-brand-muted">
                  Evaluates {report.studyConsistency.totalScheduledDays} Mentor-Scheduled Day{report.studyConsistency.totalScheduledDays === 1 ? '' : 's'} (Unscheduled days excluded)
                </span>
              </div>

              {report.studyConsistency.totalScheduledDays === 0 ? (
                <div className="p-3 border border-brand-dark/30 bg-brand-bg text-center text-xs academic-sans text-brand-muted italic">
                  No mentor-scheduled tasks were assigned during this reporting window. Consistency tracking is marked N/A.
                </div>
              ) : (
                <div className="p-3 border border-brand-dark/30 bg-white space-y-2.5">
                  {/* Metric Summary Ribbon */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-brand-dark/15 text-xs academic-sans">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-brand-muted block">SCHEDULED DAYS</span>
                        <span className="font-bold text-brand-navy text-sm">{report.studyConsistency.totalScheduledDays}</span>
                      </div>
                      <div className="border-l border-brand-dark/20 pl-3">
                        <span className="text-[9px] uppercase font-bold text-brand-muted block">ACTIVE DAYS</span>
                        <span className="font-bold text-emerald-700 text-sm">{report.studyConsistency.consistentScheduledDays}</span>
                      </div>
                      <div className="border-l border-brand-dark/20 pl-3">
                        <span className="text-[9px] uppercase font-bold text-brand-muted block">MISSED DAYS</span>
                        <span className="font-bold text-red-700 text-sm">
                          {report.studyConsistency.totalScheduledDays - report.studyConsistency.consistentScheduledDays}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] uppercase font-bold text-brand-muted block">CONSISTENCY RATE</span>
                      <span className="font-bold text-brand-navy text-base">
                        {report.studyConsistency.consistencyPercentage !== null
                          ? `${report.studyConsistency.consistencyPercentage}%`
                          : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Visual Bar Tracks (Grouped by Scheduled Day) */}
                  <div className="overflow-x-auto pt-0.5 pb-0.5">
                    <div className="flex items-end justify-between gap-1.5 min-w-full sm:min-w-0">
                      {report.studyConsistency.scheduledDays.map((day) => {
                        const onTimePct = day.assignedCount > 0 ? (day.completedOnTimeCount / day.assignedCount) * 100 : 0;
                        const latePct = day.assignedCount > 0 ? (day.completedLateCount / day.assignedCount) * 100 : 0;
                        const pendingPct = day.assignedCount > 0 ? (day.pendingCount / day.assignedCount) * 100 : 0;

                        return (
                          <div
                            key={day.date}
                            className="flex-1 min-w-[32px] max-w-[56px] flex flex-col items-center gap-1"
                          >
                            {/* Values pill */}
                            <span className="text-[8.5px] academic-sans font-bold text-brand-navy">
                              {day.totalCompletedCount}/{day.assignedCount}
                            </span>

                            {/* Stacked Vertical Bar */}
                            <div className="w-full h-11 border border-brand-dark/30 bg-brand-bg rounded-t overflow-hidden flex flex-col-reverse justify-start">
                              {onTimePct > 0 && (
                                <div
                                  style={{ height: `${onTimePct}%` }}
                                  className="w-full bg-brand-teal transition-all"
                                  title={`${day.completedOnTimeCount} completed on-time`}
                                />
                              )}
                              {latePct > 0 && (
                                <div
                                  style={{ height: `${latePct}%` }}
                                  className="w-full bg-brand-gold transition-all"
                                  title={`${day.completedLateCount} completed late`}
                                />
                              )}
                              {pendingPct > 0 && (
                                <div
                                  style={{ height: `${pendingPct}%` }}
                                  className="w-full bg-slate-200/90 border-t border-brand-dark/10"
                                  title={`${day.pendingCount} incomplete`}
                                />
                              )}
                            </div>

                            {/* Base Status Indicator */}
                            <div className="flex items-center justify-center">
                              {day.isConsistent ? (
                                <span
                                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] text-white ${
                                    day.isOnTime ? 'bg-emerald-600' : 'bg-amber-600'
                                  }`}
                                  title={day.isOnTime ? 'Active (Completed On-Time)' : 'Active (Completed Late)'}
                                >
                                  <Check className="w-2 h-2 stroke-[3]" />
                                </span>
                              ) : (
                                <span
                                  className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] text-white bg-red-600"
                                  title="Missed (No tasks completed)"
                                >
                                  <X className="w-2 h-2 stroke-[3]" />
                                </span>
                              )}
                            </div>

                            {/* Date Label */}
                            <span className="text-[8.5px] academic-sans font-semibold text-brand-dark text-center whitespace-nowrap">
                              {day.dayLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Chart Legend & Academic Disclaimer */}
                  <div className="pt-1.5 border-t border-brand-dark/10 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[9.5px] academic-sans">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-xs bg-brand-teal inline-block" />
                        <span>Completed On-Time</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-xs bg-brand-gold inline-block" />
                        <span>Completed Late</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-xs bg-slate-200 border border-brand-dark/30 inline-block" />
                        <span>Pending</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />
                        <span>Missed Day</span>
                      </div>
                    </div>
                    <span className="text-brand-muted italic text-[8.5px]">
                      *Evaluates task schedule execution strictly; unscheduled days excluded from denominator.
                    </span>
                  </div>
                </div>
              )}
            </section>

            {/* Section 2: Task Backlog & Deadline Status */}
            <div className="space-y-1.5 break-inside-avoid">
              <h3 className="academic-heading font-bold text-sm text-brand-navy flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-brand-gold" />
                <span>Task Backlog &amp; Deadline Status</span>
              </h3>
              <div className="p-3 border border-brand-dark/30 bg-brand-bg grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs academic-sans">
                <div>
                  <span className="text-brand-muted text-[9.5px] uppercase font-bold block">
                    OVERDUE TASKS
                  </span>
                  <span className={`text-lg font-bold ${report.taskMetrics.overdue > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                    {report.taskMetrics.overdue} task{report.taskMetrics.overdue === 1 ? '' : 's'}
                  </span>
                  <p className="text-[9.5px] text-brand-muted mt-0.5">
                    {report.taskMetrics.overdue > 0
                      ? 'Action needed: prioritize in upcoming study session'
                      : 'Zero overdue tasks in reporting window'}
                  </p>
                </div>

                <div>
                  <span className="text-brand-muted text-[9.5px] uppercase font-bold block">
                    ON-TIME COMPLETION RATIO
                  </span>
                  <span className="text-lg font-bold text-brand-navy">
                    {report.taskMetrics.completed > 0
                      ? `${Math.round((report.taskMetrics.onTimeCompleted / report.taskMetrics.completed) * 100)}%`
                      : 'N/A'}
                  </span>
                  <p className="text-[9.5px] text-brand-muted mt-0.5">
                    {report.taskMetrics.onTimeCompleted} on-time, {report.taskMetrics.lateCompleted} completed late
                  </p>
                </div>

                <div>
                  <span className="text-brand-muted text-[9.5px] uppercase font-bold block">
                    PENDING IN-PROGRESS TASKS
                  </span>
                  <span className="text-lg font-bold text-brand-navy">
                    {report.taskMetrics.pending + report.taskMetrics.inProgress}
                  </span>
                  <p className="text-[9.5px] text-brand-muted mt-0.5">
                    Scheduled tasks awaiting execution
                  </p>
                </div>
              </div>
            </div>

            {/* Section 3: Academic Strengths & Attention Areas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 break-inside-avoid">
              {/* Strengths */}
              <div className="p-3 border border-brand-dark/30 bg-emerald-50/30 space-y-1.5">
                <h4 className="academic-heading font-bold text-xs uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Verified Academic Strengths</span>
                </h4>
                {report.insights.observations.filter((o) => o.type === 'strength').length > 0 ? (
                  <ul className="space-y-1 text-xs academic-sans text-emerald-950">
                    {report.insights.observations
                      .filter((o) => o.type === 'strength')
                      .map((obs, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-emerald-700 font-bold shrink-0">•</span>
                          <span>{obs.text}</span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="text-xs academic-sans text-brand-muted italic">
                    Additional evaluation data needed to declare verified subject mastery.
                  </p>
                )}
              </div>

              {/* Areas Requiring Attention */}
              <div className="p-3 border border-brand-dark/30 bg-red-50/30 space-y-1.5">
                <h4 className="academic-heading font-bold text-xs uppercase tracking-wider text-red-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-700" />
                  <span>Areas Requiring Focus &amp; Attention</span>
                </h4>
                {report.insights.observations.filter((o) => o.type === 'attention').length > 0 ? (
                  <ul className="space-y-1 text-xs academic-sans text-red-950">
                    {report.insights.observations
                      .filter((o) => o.type === 'attention')
                      .map((obs, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-red-700 font-bold shrink-0">•</span>
                          <span>{obs.text}</span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="text-xs academic-sans text-emerald-800 font-bold">
                    ✓ No critical academic deficits or overdue backlogs flagged in this window.
                  </p>
                )}
              </div>
            </div>

            {/* Section 4: Evaluation Feedback Highlights & Mentor Remarks */}
            <div className="space-y-1.5 break-inside-avoid">
              <h3 className="academic-heading font-bold text-sm text-brand-navy flex items-center gap-1.5">
                <MessageSquareQuote className="w-3.5 h-3.5 text-brand-teal" />
                <span>Evaluation Remarks &amp; Mentor Guidance</span>
              </h3>
              {report.evaluationMetrics.recentFeedback.length === 0 ? (
                <div className="p-2.5 border border-brand-dark/30 bg-brand-bg text-xs academic-sans text-brand-muted italic">
                  No mentor evaluation notes recorded within this reporting window.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {report.evaluationMetrics.recentFeedback.slice(0, 3).map((fb) => (
                    <div
                      key={fb.id}
                      className="p-2.5 border border-brand-dark/30 bg-brand-bg text-xs academic-sans space-y-1"
                    >
                      <div className="flex items-center justify-between font-bold text-brand-navy">
                        <span>
                          {fb.title} {fb.subjectName ? `(${fb.subjectName})` : ''}
                        </span>
                        <span className="text-[9.5px] text-brand-muted">
                          {fb.date} {fb.scorePercentage !== null ? `• Score: ${fb.scorePercentage}%` : ''}
                        </span>
                      </div>
                      {fb.feedback && (
                        <p className="text-brand-dark italic">
                          <strong className="text-brand-navy not-italic">Feedback:</strong> "{fb.feedback}"
                        </p>
                      )}
                      {fb.recommendation && (
                        <p className="text-brand-teal font-medium">
                          <strong>Mentor Recommendation:</strong> {fb.recommendation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 5: Prioritized Action Plan (Top 3 Recommendations) */}
            <div className="space-y-1.5 break-inside-avoid">
              <div className="flex items-center justify-between">
                <h3 className="academic-heading font-bold text-sm text-brand-navy flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
                  <span>Prioritized Action Plan for Next Cycle</span>
                </h3>
                <span className="text-[9.5px] academic-sans text-brand-muted">
                  Deterministic, Evidence-Based Next Steps
                </span>
              </div>

              <div className="space-y-1.5">
                {report.recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-2.5 border border-brand-dark/30 bg-brand-paper shadow-xs flex flex-col sm:flex-row sm:items-start gap-2.5"
                  >
                    <div className="shrink-0">
                      <span
                        className={`px-1.5 py-0.5 border text-[9px] font-bold uppercase inline-block ${
                          rec.priority === 'P1'
                            ? 'bg-red-700 text-white border-red-900'
                            : rec.priority === 'P2'
                            ? 'bg-amber-600 text-white border-amber-800'
                            : 'bg-brand-navy text-white border-brand-dark'
                        }`}
                      >
                        {rec.priority} • {rec.priorityLabel}
                      </span>
                    </div>
                    <div className="space-y-0.5 text-xs academic-sans flex-1">
                      <div className="font-bold text-brand-navy text-xs">{rec.title}</div>
                      <div className="text-[10.5px] text-brand-muted">
                        <strong className="text-brand-dark">Evidence:</strong> {rec.evidence}
                      </div>
                      <div className="text-[11px] text-brand-dark">
                        <strong className="text-brand-navy">Recommended Action:</strong> {rec.recommendedAction}
                      </div>
                      <div className="text-[10.5px] text-brand-teal font-bold pt-0.5">
                        <span>Target Outcome:</span> {rec.measurableSuccessIndicator}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Page 2 Sign-off / Verification Block */}
            <div className="pt-2.5 border-t border-brand-dark/30 grid grid-cols-2 gap-4 text-xs academic-sans break-inside-avoid">
              <div className="space-y-0.5">
                <span className="text-brand-muted text-[9px] uppercase font-bold block">
                  SCHOLAR ACKNOWLEDGMENT
                </span>
                <div className="h-6 border-b border-brand-dark/30 flex items-end">
                  <span className="text-brand-dark font-bold text-xs">{report.studentName}</span>
                </div>
                <span className="text-[8.5px] text-brand-muted">Digital Student Record</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-brand-muted text-[9px] uppercase font-bold block">
                  MENTOR VERIFICATION &amp; SIGN-OFF
                </span>
                <div className="h-6 border-b border-brand-dark/30 flex items-end">
                  <span className="text-brand-dark font-bold text-xs">
                    {report.mentorName ? `${report.mentorName} (Verified)` : 'PoraPlan Academic Team'}
                  </span>
                </div>
                <span className="text-[8.5px] text-brand-muted">Lead Academic Mentor Signature</span>
              </div>
            </div>

            {/* Page 2 Footer */}
            <footer className="pt-2 border-t border-brand-dark/20 flex items-center justify-between text-[9.5px] academic-sans text-brand-muted break-inside-avoid">
              <div>PoraPlan Academic Performance &amp; Improvement Report • Archive Copy</div>
              <div className="font-bold">Page 2 of 2</div>
            </footer>
          </article>
        </div>
      ) : null}
    </div>
  );
};
