import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  generateMentorReport,
  generateStudentReport,
  type MentorAcademicReport,
  type StudentAcademicReport,
  type ReportPeriod,
  REPORT_THRESHOLDS,
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
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  Target,
  MessageSquareQuote,
  Sparkles,
  ShieldCheck,
  Calendar,
  Award,
  Check,
  X,
} from 'lucide-react';

export const MentorReportPage: React.FC = () => {
  const { user, profile, role } = useAuth();
  const [searchParams] = useSearchParams();
  const paramMentorId = searchParams.get('mentorId');
  const isAdmin = role === 'admin';
  const mentorId = (isAdmin && paramMentorId) ? paramMentorId : (profile?.id || user?.id || '');

  const [period, setPeriod] = useState<ReportPeriod>('schedule');
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

  // Load mentor's assigned roster
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
      // 1. Generate Mentor Roster Report with strict server-side authorization check
      const { report: mReport, error: mErr } = await generateMentorReport(
        mentorId,
        period,
        period === 'custom' ? customStart : undefined,
        period === 'custom' ? customEnd : undefined,
        selectedStudentId === 'all' ? undefined : selectedStudentId,
        {
          requestingUserId: profile?.id || user?.id || '',
          requestingUserRole: (isAdmin ? 'admin' : 'mentor') as 'admin' | 'mentor',
        }
      );

      if (mErr) {
        setError(mErr.message || 'Unable to generate mentor academic report.');
        setLoading(false);
        return;
      }

      setMentorReport(mReport);

      // 2. If a specific student is selected, generate their detailed academic report
      if (selectedStudentId !== 'all') {
        const { report: sReport, error: sErr } = await generateStudentReport(
          selectedStudentId,
          period,
          period === 'custom' ? customStart : undefined,
          period === 'custom' ? customEnd : undefined,
          {
            requestingUserId: profile?.id || user?.id || '',
            requestingUserRole: (isAdmin ? 'admin' : 'mentor') as 'admin' | 'mentor',
          }
        );

        if (sErr) {
          setError(sErr.message || 'Unable to retrieve student report.');
        } else {
          setStudentDetailReport(sReport);
        }
      } else {
        setStudentDetailReport(null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An error occurred while compiling reports.');
    } finally {
      setLoading(false);
    }
  }, [mentorId, period, customStart, customEnd, selectedStudentId, isAdmin, profile?.id, user?.id]);

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
      {/* Dedicated Academic Typography & Print-specific A4 Stylesheet */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@600;700&family=Source+Sans+3:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,600&family=Source+Serif+4:ital,opsz,wght@0,8..60,600;0,8..60,700;0,8..60,800;1,8..60,600&display=swap');

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
      {/* 1. INTERACTIVE CONTROLS BAR (HIDDEN IN PRINT MODE)                        */}
      {/* ========================================================================= */}
      <div className="print:hidden p-4 sm:p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {isAdmin && (
              <Link
                to="/admin/reports"
                className="text-xs font-mono font-bold text-brand-navy hover:text-brand-teal flex items-center gap-1 mr-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Admin Reporting Center</span>
              </Link>
            )}
            <span className="font-mono text-[10px] uppercase font-extrabold tracking-wider text-brand-gold bg-brand-bg px-2 py-0.5 border border-brand-dark">
              {isAdmin ? `ADMINISTRATIVE MENTOR AUDIT • ${mentorReport?.mentorName || mentorId}` : 'MENTOR ROSTER OVERSIGHT'}
            </span>
            <span className="font-mono text-[10px] text-brand-muted">
              {assignedStudents.length} Assigned Scholar{assignedStudents.length === 1 ? '' : 's'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold font-heading text-brand-navy tracking-tight">
            Academic Performance &amp; Improvement Oversight
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
            className="flex items-center gap-1.5 shadow-brutal-xs bg-brand-navy text-white hover:bg-brand-navy/90"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report (A4)</span>
          </Button>
        </div>
      </div>

      {/* Filter Row: Period & Scholar Selector (Hidden in Print) */}
      <div className="print:hidden p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-wrap items-center justify-between gap-3">
        {/* Period Selector */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="font-bold text-brand-muted uppercase text-[10px]">Window:</span>
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
                : 'Custom Range'}
            </button>
          ))}

          {period === 'custom' && (
            <div className="flex items-center gap-1.5 ml-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2 py-1 border-2 border-brand-dark bg-brand-bg text-xs font-mono"
                aria-label="Start Date"
              />
              <span className="font-bold text-brand-muted">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2 py-1 border-2 border-brand-dark bg-brand-bg text-xs font-mono"
                aria-label="End Date"
              />
            </div>
          )}
        </div>

        {/* Scholar Selector */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="font-bold text-brand-muted uppercase text-[10px]">Scope:</span>
          <select
            aria-label="Filter by assigned scholar"
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="px-3 py-1.5 border-2 border-brand-dark bg-brand-bg font-mono text-xs font-bold text-brand-dark focus:outline-none focus:ring-1 focus:ring-brand-teal"
          >
            <option value="all">Full Mentee Roster ({assignedStudents.length})</option>
            {assignedStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} ({s.poraplan_id || s.email})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. REPORT CONTENT BODY                                                    */}
      {/* ========================================================================= */}
      {loading ? (
        <div className="p-16 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center space-y-3">
          <Loader2 className="w-8 h-8 text-brand-teal animate-spin mx-auto" />
          <h3 className="font-heading font-extrabold text-base text-brand-navy">
            COMPILING MENTORSHIP REPORT
          </h3>
          <p className="font-mono text-xs text-brand-muted">
            Aggregating mentee completion rates, review submissions queue, and milestone evaluations...
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
        <div className="academic-doc space-y-6">
          {/* ===================================================================== */}
          {/* VIEW A: ROSTER OVERVIEW (WHEN ALL STUDENTS SELECTED)                  */}
          {/* ===================================================================== */}
          {selectedStudentId === 'all' ? (
            <article className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-6 sm:p-8 space-y-6 print:border-none print:shadow-none print:p-0 print:space-y-4">
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
                    className="w-12 h-12 object-contain rounded border border-brand-dark/20 bg-brand-paper p-1 shrink-0"
                  />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="academic-sans text-[9px] uppercase font-bold tracking-widest text-brand-gold bg-brand-paper-tint px-2 py-0.5 border border-brand-dark">
                        PORAPLAN MENTORSHIP OVERSIGHT
                      </span>
                      <span className="academic-sans text-[9px] text-brand-muted">
                        CONFIDENTIAL • FACULTY ROSTER ARCHIVE
                      </span>
                    </div>
                    <h2 className="academic-heading text-xl sm:text-2xl font-bold text-brand-navy tracking-tight">
                      Mentee Academic Performance &amp; Triage Roster
                    </h2>
                    <p className="academic-sans text-xs text-brand-muted">
                      Operational audit of assigned scholars, task velocity, assignment reviews, and interventions.
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right space-y-0.5 text-xs academic-sans border-t sm:border-t-0 pt-2 sm:pt-0 border-brand-dark/20 shrink-0">
                  <div className="text-brand-navy font-bold">
                    <span className="text-brand-muted block text-[9px] uppercase tracking-wider">AUDIT WINDOW</span>
                    <span>{mentorReport.dateRange.startDate} — {mentorReport.dateRange.endDate}</span>
                  </div>
                  <div className="text-[10px] text-brand-muted">
                    Lead Mentor: <span className="font-bold text-brand-dark">{mentorReport.mentorName}</span> ({mentorReport.poraplanId})
                  </div>
                  <div className="text-[10px] text-brand-muted">
                    Generated: {new Date(mentorReport.generatedAt).toLocaleDateString()}
                  </div>
                </div>
              </header>

              {/* Roster Overview KPIs */}
              <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 break-inside-avoid">
                {/* 1. Task Velocity */}
                <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-brand-muted mb-1">
                    <span className="academic-sans text-[10px] font-bold uppercase">Tasks Executed</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal" />
                  </div>
                  <div>
                    <span className="academic-heading font-bold text-2xl text-brand-navy">
                      {mentorReport.aggregateMetrics.totalTasksCompleted}
                    </span>
                    <span className="academic-sans text-xs text-brand-muted">
                      {' '}/ {mentorReport.aggregateMetrics.totalTasksAssigned}
                    </span>
                  </div>
                  <span className="text-[10px] academic-sans font-bold text-brand-teal mt-1 pt-1 border-t border-brand-dark/10">
                    {mentorReport.aggregateMetrics.overallTaskCompletionRate}% roster velocity
                  </span>
                </div>

                {/* 2. Reviews Queue */}
                <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-brand-muted mb-1">
                    <span className="academic-sans text-[10px] font-bold uppercase">Submissions Queue</span>
                    <FileText className="w-3.5 h-3.5 text-brand-navy" />
                  </div>
                  <div>
                    <span
                      className={`academic-heading font-bold text-2xl ${
                        mentorReport.aggregateMetrics.totalSubmissionsPendingReview > 0
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {mentorReport.aggregateMetrics.totalSubmissionsPendingReview}
                    </span>
                    <span className="academic-sans text-xs text-brand-muted"> pending</span>
                  </div>
                  <span className="text-[10px] academic-sans font-bold text-brand-muted mt-1 pt-1 border-t border-brand-dark/10">
                    {mentorReport.aggregateMetrics.totalPendingRevisions} revision resubmission(s)
                  </span>
                </div>

                {/* 3. Milestone Evaluations */}
                <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-brand-muted mb-1">
                    <span className="academic-sans text-[10px] font-bold uppercase">Evaluations</span>
                    <Award className="w-3.5 h-3.5 text-brand-teal" />
                  </div>
                  <div>
                    <span className="academic-heading font-bold text-2xl text-brand-navy">
                      {mentorReport.aggregateMetrics.totalEvaluationsCompleted}
                    </span>
                    <span className="academic-sans text-xs text-brand-muted"> completed</span>
                  </div>
                  <span className="text-[10px] academic-sans font-bold text-brand-muted mt-1 pt-1 border-t border-brand-dark/10">
                    {mentorReport.aggregateMetrics.totalEvaluationsUpcoming} upcoming milestone(s)
                  </span>
                </div>

                {/* 4. Attention Triage */}
                <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-brand-muted mb-1">
                    <span className="academic-sans text-[10px] font-bold uppercase">Attention Triage</span>
                    <AlertTriangle className="w-3.5 h-3.5 text-brand-gold" />
                  </div>
                  <div>
                    <span
                      className={`academic-heading font-bold text-2xl ${
                        mentorReport.aggregateMetrics.scholarsNeedingAttentionCount > 0
                          ? 'text-red-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {mentorReport.aggregateMetrics.scholarsNeedingAttentionCount}
                    </span>
                    <span className="academic-sans text-xs text-brand-muted">
                      {' '}of {mentorReport.assignedStudentsCount} scholars
                    </span>
                  </div>
                  <span className="text-[10px] academic-sans font-bold text-brand-muted mt-1 pt-1 border-t border-brand-dark/10">
                    {mentorReport.aggregateMetrics.scholarsNeedingAttentionCount > 0
                      ? 'Requires mentor check-in'
                      : 'All scholars on track'}
                  </span>
                </div>
              </section>

              {/* Roster Progress Table */}
              <section className="space-y-3 break-inside-avoid">
                <div className="flex items-center justify-between border-b border-brand-dark/20 pb-1.5">
                  <h3 className="academic-heading font-bold text-sm sm:text-base text-brand-navy flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-brand-teal" />
                    <span>Assigned Mentees Performance &amp; Triage Status</span>
                  </h3>
                  <span className="text-[10px] academic-sans text-brand-muted">
                    {mentorReport.studentSummaries.length} Scholars Listed
                  </span>
                </div>

                {mentorReport.studentSummaries.length > 0 ? (
                  <div className="border-2 border-brand-dark overflow-x-auto bg-brand-paper">
                    <table className="w-full text-left academic-sans text-xs border-collapse">
                      <thead className="bg-brand-paper-tint border-b-2 border-brand-dark text-[10px] uppercase font-bold text-brand-navy">
                        <tr>
                          <th className="p-2.5">Scholar</th>
                          <th className="p-2.5 text-center">Tasks (Done/Due)</th>
                          <th className="p-2.5 text-center">Velocity</th>
                          <th className="p-2.5 text-center">Problem Sets</th>
                          <th className="p-2.5 text-center">Exams Avg</th>
                          <th className="p-2.5 text-center">Schedule Consistency</th>
                          <th className="p-2.5 text-center">Triage Status</th>
                          <th className="p-2.5 text-right print:hidden">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-dark/10">
                        {mentorReport.studentSummaries.map((s) => (
                          <tr key={s.studentId} className="hover:bg-brand-paper-tint/50">
                            <td className="p-2.5">
                              <span className="font-bold text-brand-navy block text-sm">
                                {s.studentName}
                              </span>
                              <span className="text-[10px] text-brand-muted font-normal">
                                {s.poraplanId} {s.cohortName ? `• ${s.cohortName}` : ''}
                              </span>
                            </td>
                            <td className="p-2.5 text-center font-bold">
                              {s.tasksCompleted} / {s.tasksAssigned}
                              {s.tasksOverdue > 0 && (
                                <span className="block text-[10px] text-red-700 font-bold">
                                  ({s.tasksOverdue} overdue)
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              <span
                                className={`px-2 py-0.5 border text-[10px] font-bold inline-block ${
                                  s.tasksCompletionRate >= 80
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-700'
                                    : s.tasksCompletionRate >= 50
                                    ? 'bg-amber-50 text-amber-800 border-amber-700'
                                    : 'bg-red-50 text-red-800 border-red-700'
                                }`}
                              >
                                {s.tasksCompletionRate}%
                              </span>
                            </td>
                            <td className="p-2.5 text-center">
                              {s.assignmentsSubmitted} / {s.assignmentsAssigned}
                              {s.assignmentsPendingReview > 0 && (
                                <span className="block text-[10px] text-amber-700 font-bold">
                                  {s.assignmentsPendingReview} to review
                                </span>
                              )}
                              {s.assignmentsNeedsRevision > 0 && (
                                <span className="block text-[10px] text-red-700 font-bold">
                                  {s.assignmentsNeedsRevision} revision req
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              {s.evaluationsCompleted > 0 ? (
                                <span>
                                  {s.evaluationsCompleted} done
                                  {s.averageScorePercentage !== null && (
                                    <strong
                                      className={`block text-[11px] ${
                                        s.averageScorePercentage >= REPORT_THRESHOLDS.MASTERY_SCORE_MIN
                                          ? 'text-emerald-700'
                                          : s.averageScorePercentage < REPORT_THRESHOLDS.ATTENTION_SCORE_MAX
                                          ? 'text-red-700'
                                          : 'text-brand-navy'
                                      }`}
                                    >
                                      ({s.averageScorePercentage}%)
                                    </strong>
                                  )}
                                </span>
                              ) : (
                                <span className="text-brand-muted">None</span>
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              {s.consistencyPercentage !== null ? (
                                <span>
                                  <strong className="text-brand-navy">{s.consistencyPercentage}%</strong>
                                  <span className="block text-[9px] text-brand-muted">
                                    {s.activeStudyDays}/{s.scheduledDaysCount} scheduled days
                                  </span>
                                </span>
                              ) : (
                                <span className="text-brand-muted text-[10px]">N/A (No tasks)</span>
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              {s.attentionLevel === 'critical' ? (
                                <span
                                  className="px-2 py-0.5 border text-[10px] font-bold bg-red-100 text-red-900 border-red-700 inline-block"
                                  title={s.attentionReason}
                                >
                                  Critical Focus
                                </span>
                              ) : s.attentionLevel === 'warning' ? (
                                <span
                                  className="px-2 py-0.5 border text-[10px] font-bold bg-amber-100 text-amber-900 border-amber-700 inline-block"
                                  title={s.attentionReason}
                                >
                                  Needs Attention
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 border text-[10px] font-bold bg-emerald-100 text-emerald-900 border-emerald-700 inline-block">
                                  On Track
                                </span>
                              )}
                              {s.attentionReason && (
                                <span className="block text-[9px] text-brand-muted truncate max-w-[150px] mx-auto mt-0.5" title={s.attentionReason}>
                                  {s.attentionReason}
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-right print:hidden">
                              <button
                                type="button"
                                onClick={() => setSelectedStudentId(s.studentId)}
                                className="px-2.5 py-1 border border-brand-dark bg-brand-bg text-[10px] academic-sans font-bold text-brand-navy hover:bg-brand-navy hover:text-white transition-colors"
                              >
                                View Report
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 border border-dashed border-brand-dark/30 text-center academic-sans text-xs text-brand-muted">
                    No scholars currently assigned to your mentorship roster.
                  </div>
                )}
              </section>

              {/* Roster Report Footer */}
              <footer className="border-t-2 border-brand-dark pt-3 flex items-center justify-between text-[10px] academic-sans text-brand-muted break-inside-avoid">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-brand-teal" />
                  <span>PoraPlan Platform Mentorship Analytics • Confidential Faculty Roster</span>
                </div>
                <div className="font-bold">Roster Overview</div>
              </footer>
            </article>
          ) : studentDetailReport ? (
            /* =================================================================== */
            /* VIEW B: DETAILED INDIVIDUAL SCHOLAR REPORT (SELECTED STUDENT)       */
            /* =================================================================== */
            <div className="space-y-6">
              {/* Back to Full Roster Navigation (Print-hidden) */}
              <div className="print:hidden flex items-center justify-between p-3 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs">
                <button
                  type="button"
                  onClick={() => setSelectedStudentId('all')}
                  className="text-xs academic-sans font-bold text-brand-navy hover:underline flex items-center gap-1"
                >
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                  <span>← Back to Full Mentee Roster</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs academic-sans text-brand-muted">
                    Inspecting: <strong className="text-brand-navy">{studentDetailReport.studentName}</strong>
                  </span>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handlePrint}
                    className="text-xs shadow-brutal-xs bg-brand-navy text-white hover:bg-brand-navy/90"
                  >
                    <Printer className="w-3.5 h-3.5 mr-1" />
                    Print Mentee Report
                  </Button>
                </div>
              </div>

              {/* Page 1 of Mentee Report */}
              <article className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-6 sm:p-8 space-y-6 print:border-none print:shadow-none print:p-0 print:space-y-5 print:page-break">
                {/* Header */}
                <header className="border-b-2 border-brand-dark pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <img
                      src="/poraplan-logo.png"
                      alt="PoraPlan Logo"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/assets/poraplan-logo.png';
                      }}
                      className="w-12 h-12 object-contain rounded border border-brand-dark/20 bg-brand-paper p-1 shrink-0"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="academic-sans text-[9px] uppercase font-bold tracking-widest text-brand-navy bg-brand-paper-tint px-2 py-0.5 border border-brand-dark">
                          PORAPLAN ACADEMIC MENTORSHIP
                        </span>
                        <span className="academic-sans text-[9px] text-brand-muted">
                          CONFIDENTIAL • MENTOR AUDIT COPY
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
                      <span>{studentDetailReport.dateRange.startDate} — {studentDetailReport.dateRange.endDate}</span>
                    </div>
                    <div className="text-[10px] text-brand-muted">
                      Schedule: <strong className="text-brand-dark">{studentDetailReport.studyConsistency.totalScheduledDays} Scheduled Study Day{studentDetailReport.studyConsistency.totalScheduledDays === 1 ? '' : 's'}</strong>
                    </div>
                    <div className="text-[10px] text-brand-muted">
                      Generated: {new Date(studentDetailReport.generatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </header>

                {/* Credentials Banner */}
                <div className="p-3.5 border-2 border-brand-dark bg-brand-bg grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs academic-sans break-inside-avoid">
                  <div>
                    <span className="text-brand-muted text-[10px] uppercase font-bold block">SCHOLAR NAME</span>
                    <span className="font-bold text-brand-navy text-sm">{studentDetailReport.studentName}</span>
                  </div>
                  <div>
                    <span className="text-brand-muted text-[10px] uppercase font-bold block">PORAPLAN ID</span>
                    <span className="font-bold text-brand-teal text-sm">{studentDetailReport.poraplanId}</span>
                  </div>
                  <div>
                    <span className="text-brand-muted text-[10px] uppercase font-bold block">ACADEMIC PROGRAM</span>
                    <span className="font-semibold text-brand-dark">
                      {studentDetailReport.programName || 'Academic Mentorship'}
                      {studentDetailReport.cohortName ? ` (${studentDetailReport.cohortName})` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-brand-muted text-[10px] uppercase font-bold block">ASSIGNED MENTOR</span>
                    <span className="font-semibold text-brand-dark">{studentDetailReport.mentorName || mentorReport.mentorName}</span>
                  </div>
                </div>

                {/* 4 Core KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 break-inside-avoid">
                  <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-brand-muted mb-1">
                      <span className="text-[10px] academic-sans font-bold uppercase">Task Completion</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal" />
                    </div>
                    <div>
                      <div className="academic-heading text-2xl sm:text-3xl font-bold text-brand-navy">
                        {studentDetailReport.taskMetrics.isCompletionRateApplicable
                          ? `${studentDetailReport.taskMetrics.completionRate}%`
                          : 'N/A'}
                      </div>
                      <div className="text-[10px] academic-sans mt-1 text-brand-muted">
                        {studentDetailReport.taskMetrics.completed}/{studentDetailReport.taskMetrics.totalAssigned} scheduled
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-brand-muted mb-1">
                      <span className="text-[10px] academic-sans font-bold uppercase">Weighted Mastery</span>
                      <Award className="w-3.5 h-3.5 text-brand-navy" />
                    </div>
                    <div>
                      <div className="academic-heading text-2xl sm:text-3xl font-bold text-brand-navy">
                        {studentDetailReport.evaluationMetrics.weightedAveragePercentage !== null
                          ? `${studentDetailReport.evaluationMetrics.weightedAveragePercentage}%`
                          : 'N/A'}
                      </div>
                      <div className="text-[10px] academic-sans mt-1 text-brand-muted">
                        {studentDetailReport.evaluationMetrics.scoredCount > 0
                          ? `${studentDetailReport.evaluationMetrics.totalEarnedPoints}/${studentDetailReport.evaluationMetrics.totalPossiblePoints} pts`
                          : 'No scored exams'}
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-brand-muted mb-1">
                      <span className="text-[10px] academic-sans font-bold uppercase">Practice Submissions</span>
                      <FileText className="w-3.5 h-3.5 text-brand-teal" />
                    </div>
                    <div>
                      <div className="academic-heading text-2xl sm:text-3xl font-bold text-brand-navy">
                        {studentDetailReport.assignmentMetrics.isSubmissionRateApplicable
                          ? `${studentDetailReport.assignmentMetrics.submissionRate}%`
                          : 'N/A'}
                      </div>
                      <div className="text-[10px] academic-sans mt-1 text-brand-muted">
                        {studentDetailReport.assignmentMetrics.submitted}/{studentDetailReport.assignmentMetrics.totalAssigned} problem sets
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-brand-muted mb-1">
                      <span className="text-[10px] academic-sans font-bold uppercase">Schedule Consistency</span>
                      <Calendar className="w-3.5 h-3.5 text-brand-gold" />
                    </div>
                    <div>
                      <div className="academic-heading text-2xl sm:text-3xl font-bold text-brand-navy">
                        {studentDetailReport.studyConsistency.consistencyPercentage !== null
                          ? `${studentDetailReport.studyConsistency.consistencyPercentage}%`
                          : 'N/A'}
                      </div>
                      <div className="text-[10px] academic-sans mt-1 text-brand-muted">
                        {studentDetailReport.studyConsistency.consistentScheduledDays} of {studentDetailReport.studyConsistency.totalScheduledDays} scheduled days
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subject Breakdown Matrix */}
                <div className="space-y-2 break-inside-avoid">
                  <div className="flex items-center justify-between">
                    <h3 className="academic-heading font-bold text-sm sm:text-base text-brand-navy flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-brand-teal" />
                      <span>Subject Performance &amp; Mastery Matrix</span>
                    </h3>
                  </div>

                  <div className="border-2 border-brand-dark overflow-x-auto bg-brand-paper">
                    <table className="w-full text-left border-collapse text-xs academic-sans">
                      <thead>
                        <tr className="bg-brand-paper-tint border-b-2 border-brand-dark text-brand-navy">
                          <th className="p-2.5 font-bold">Subject</th>
                          <th className="p-2.5 font-bold text-center">Score</th>
                          <th className="p-2.5 font-bold text-center">Exams</th>
                          <th className="p-2.5 font-bold text-center">Tasks</th>
                          <th className="p-2.5 font-bold text-center">Practice</th>
                          <th className="p-2.5 font-bold text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-dark/10">
                        {studentDetailReport.subjectBreakdown.map((subj) => (
                          <tr key={subj.subjectId}>
                            <td className="p-2.5 font-bold text-brand-navy">{subj.subjectName}</td>
                            <td className="p-2.5 text-center font-bold">
                              {subj.evaluationsAverageScore !== null ? `${subj.evaluationsAverageScore}%` : 'N/A'}
                            </td>
                            <td className="p-2.5 text-center">
                              {subj.evaluationsScoredCount} scored
                            </td>
                            <td className="p-2.5 text-center">
                              {subj.tasksCompleted}/{subj.tasksTotal} ({subj.tasksCompletionRate}%)
                            </td>
                            <td className="p-2.5 text-center">
                              {subj.assignmentsSubmitted}/{subj.assignmentsTotal}
                            </td>
                            <td className="p-2.5 text-right">
                              <span
                                className={`px-2 py-0.5 border text-[10px] font-bold inline-block ${
                                  subj.performanceStatus === 'mastery'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-700'
                                    : subj.performanceStatus === 'attention_required'
                                    ? 'bg-red-50 text-red-800 border-red-700'
                                    : 'bg-blue-50 text-blue-800 border-blue-700'
                                }`}
                              >
                                {subj.performanceStatusLabel}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Page 1 Footer */}
                <footer className="pt-3 border-t border-brand-dark/20 flex items-center justify-between text-[10px] academic-sans text-brand-muted break-inside-avoid">
                  <div>PoraPlan Academic Performance Report • Scholar {studentDetailReport.studentName}</div>
                  <div className="font-bold">Page 1 of 2</div>
                </footer>
              </article>

              {/* Page Break */}
              <div className="print:page-break my-6 print:my-0 border-t-2 border-dashed border-brand-dark/20 print:border-none" />

              {/* Page 2 of Mentee Report */}
              <article className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-6 sm:p-8 space-y-5 print:border-none print:shadow-none print:p-0 print:space-y-4">
                <header className="border-b-2 border-brand-dark pb-3 flex items-center justify-between text-xs academic-sans">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-brand-navy">{studentDetailReport.studentName}</span>
                    <span className="text-brand-teal font-bold">{studentDetailReport.poraplanId}</span>
                  </div>
                  <div className="text-brand-muted font-semibold">
                    Academic Performance &amp; Improvement Report • Page 2 of 2
                  </div>
                </header>

                {/* Daily Consistency Graph in Mentee Inspection */}
                <section className="space-y-2 break-inside-avoid">
                  <div className="flex items-center justify-between">
                    <h3 className="academic-heading font-bold text-sm sm:text-base text-brand-navy flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-brand-teal" />
                      <span>Daily Schedule Execution Consistency</span>
                    </h3>
                    <span className="text-[10px] academic-sans text-brand-muted">
                      {studentDetailReport.studyConsistency.totalScheduledDays} Mentor-Scheduled Days
                    </span>
                  </div>

                  {studentDetailReport.studyConsistency.totalScheduledDays === 0 ? (
                    <div className="p-3.5 border-2 border-brand-dark bg-brand-bg text-center text-xs academic-sans text-brand-muted italic">
                      No mentor-scheduled tasks were assigned during this audit window.
                    </div>
                  ) : (
                    <div className="p-3 border-2 border-brand-dark bg-brand-paper space-y-2.5">
                      <div className="flex items-end justify-between gap-2 overflow-x-auto pt-1 pb-1">
                        {studentDetailReport.studyConsistency.scheduledDays.map((day) => {
                          const onTimePct = day.assignedCount > 0 ? (day.completedOnTimeCount / day.assignedCount) * 100 : 0;
                          const latePct = day.assignedCount > 0 ? (day.completedLateCount / day.assignedCount) * 100 : 0;
                          const pendingPct = day.assignedCount > 0 ? (day.pendingCount / day.assignedCount) * 100 : 0;

                          return (
                            <div
                              key={day.date}
                              className="flex-1 min-w-[32px] max-w-[60px] flex flex-col items-center gap-1"
                            >
                              <span className="text-[9px] academic-sans font-bold text-brand-navy">
                                {day.totalCompletedCount}/{day.assignedCount}
                              </span>
                              <div className="w-full h-14 border border-brand-dark/40 bg-brand-bg rounded-t overflow-hidden flex flex-col-reverse">
                                {onTimePct > 0 && <div style={{ height: `${onTimePct}%` }} className="w-full bg-brand-teal" />}
                                {latePct > 0 && <div style={{ height: `${latePct}%` }} className="w-full bg-brand-gold" />}
                                {pendingPct > 0 && <div style={{ height: `${pendingPct}%` }} className="w-full bg-slate-200" />}
                              </div>
                              <div className="flex items-center justify-center">
                                {day.isConsistent ? (
                                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] text-white ${day.isOnTime ? 'bg-emerald-600' : 'bg-amber-600'}`}>
                                    <Check className="w-2 h-2 stroke-[3]" />
                                  </span>
                                ) : (
                                  <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] text-white bg-red-600">
                                    <X className="w-2 h-2 stroke-[3]" />
                                  </span>
                                )}
                              </div>
                              <span className="text-[9px] academic-sans font-semibold text-brand-dark text-center whitespace-nowrap">
                                {day.dayLabel}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="pt-1.5 border-t border-brand-dark/10 flex items-center justify-between text-[9px] academic-sans text-brand-muted">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-brand-teal inline-block" /> On-Time</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-brand-gold inline-block" /> Late</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-slate-200 border border-brand-dark/30 inline-block" /> Pending</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600 inline-block" /> Missed Day</span>
                        </div>
                        <span>Consistency Rate: {studentDetailReport.studyConsistency.consistencyPercentage}%</span>
                      </div>
                    </div>
                  )}
                </section>

                {/* Backlog Radar */}
                <div className="space-y-2 break-inside-avoid">
                  <h3 className="academic-heading font-bold text-sm sm:text-base text-brand-navy flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-brand-gold" />
                    <span>Task Backlog &amp; Deadline Status</span>
                  </h3>
                  <div className="p-3.5 border-2 border-brand-dark bg-brand-bg grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs academic-sans">
                    <div>
                      <span className="text-brand-muted text-[10px] uppercase font-bold block">OVERDUE TASKS</span>
                      <span className={`text-xl font-bold ${studentDetailReport.taskMetrics.overdue > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                        {studentDetailReport.taskMetrics.overdue}
                      </span>
                    </div>
                    <div>
                      <span className="text-brand-muted text-[10px] uppercase font-bold block">PENDING REVISIONS</span>
                      <span className={`text-xl font-bold ${studentDetailReport.assignmentMetrics.needsRevision > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                        {studentDetailReport.assignmentMetrics.needsRevision}
                      </span>
                    </div>
                    <div>
                      <span className="text-brand-muted text-[10px] uppercase font-bold block">ON-TIME EXECUTION</span>
                      <span className="text-xl font-bold text-brand-navy">
                        {studentDetailReport.taskMetrics.completed > 0
                          ? `${Math.round((studentDetailReport.taskMetrics.onTimeCompleted / studentDetailReport.taskMetrics.completed) * 100)}%`
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Observations & Strengths */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 break-inside-avoid">
                  <div className="p-3.5 border-2 border-brand-dark bg-emerald-50/40 space-y-2">
                    <h4 className="academic-heading font-bold text-xs uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Verified Strengths</span>
                    </h4>
                    <ul className="space-y-1.5 text-xs academic-sans text-emerald-950">
                      {studentDetailReport.insights.observations
                        .filter((o) => o.type === 'strength')
                        .map((obs, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-emerald-700 font-bold shrink-0">•</span>
                            <span>{obs.text}</span>
                          </li>
                        ))}
                    </ul>
                  </div>

                  <div className="p-3.5 border-2 border-brand-dark bg-red-50/40 space-y-2">
                    <h4 className="academic-heading font-bold text-xs uppercase tracking-wider text-red-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-700" />
                      <span>Areas Requiring Focus</span>
                    </h4>
                    <ul className="space-y-1.5 text-xs academic-sans text-red-950">
                      {studentDetailReport.insights.observations
                        .filter((o) => o.type === 'attention')
                        .map((obs, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-red-700 font-bold shrink-0">•</span>
                            <span>{obs.text}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>

                {/* Evaluation Feedback */}
                <div className="space-y-2 break-inside-avoid">
                  <h3 className="academic-heading font-bold text-sm sm:text-base text-brand-navy flex items-center gap-1.5">
                    <MessageSquareQuote className="w-4 h-4 text-brand-teal" />
                    <span>Evaluation Remarks &amp; Recommendations</span>
                  </h3>
                  <div className="space-y-2">
                    {studentDetailReport.evaluationMetrics.recentFeedback.map((fb) => (
                      <div key={fb.id} className="p-3 border-2 border-brand-dark bg-brand-bg text-xs academic-sans space-y-1">
                        <div className="flex items-center justify-between font-bold text-brand-navy">
                          <span>{fb.title}</span>
                          <span className="text-[10px] text-brand-muted">{fb.date}</span>
                        </div>
                        {fb.feedback && <p className="text-brand-dark"><strong>Feedback:</strong> "{fb.feedback}"</p>}
                        {fb.recommendation && (
                          <p className="text-brand-teal font-semibold">
                            <strong>Recommended Next Step:</strong> {fb.recommendation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendations */}
                <div className="space-y-2 break-inside-avoid">
                  <h3 className="academic-heading font-bold text-sm sm:text-base text-brand-navy flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-brand-gold" />
                    <span>Prioritized Improvement Recommendations</span>
                  </h3>
                  <div className="space-y-2">
                    {studentDetailReport.recommendations.map((rec) => (
                      <div key={rec.id} className="p-3 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs text-xs academic-sans space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 border text-[9px] font-bold bg-brand-navy text-white">
                            {rec.priority} • {rec.priorityLabel}
                          </span>
                          <span className="font-bold text-brand-navy">{rec.title}</span>
                        </div>
                        <p className="text-brand-muted"><strong>Evidence:</strong> {rec.evidence}</p>
                        <p className="text-brand-dark"><strong>Action:</strong> {rec.recommendedAction}</p>
                        <p className="text-brand-teal font-semibold"><strong>Outcome Target:</strong> {rec.measurableSuccessIndicator}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <footer className="pt-3 border-t border-brand-dark/20 flex items-center justify-between text-[10px] academic-sans text-brand-muted break-inside-avoid">
                  <div>PoraPlan Academic Performance &amp; Improvement Report • Lead Mentor Review</div>
                  <div className="font-bold">Page 2 of 2</div>
                </footer>
              </article>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
